import * as chrono from 'chrono-node';
import { addDays, addMinutes, addMonths, addWeeks, addYears, format, isSameDay, isToday, isTomorrow, startOfDay } from 'date-fns';

/*
 * Natural-language task parser (Egyptian Arabic + English).
 *   "ميتينج مع احمد بكره الساعة 5 #Website"    → meeting, tomorrow 17:00, project Website
 *   "كول من 3 لـ 5 العصر فكرني قبلها بربع ساعة" → 15:00–17:00, remind 15 min before
 *   "call the bank friday 10am for 30 min"      → meeting, Fri 10:00–10:30
 *   "اقرا كتاب التصميم بعدين" / "deploy !later" → Later list
 *   "جيم كل خميس 7 بالليل" / "standup every day 10am"   → repeats
 *   "نزلة `الخميس` كل خميس"                     → text in `backticks` is kept as written
 *
 * Matching runs on a normalized copy (أ/إ/آ→ا, ة→ه, ى→ي) of the same length,
 * so cut positions apply to the original text and the title keeps its spelling.
 */

const W = (s) => `(?<![\\p{L}\\p{N}])(?:${s})(?![\\p{L}\\p{N}])`; // word boundary that works for Arabic
const rx = (s) => new RegExp(W(s), 'iu');

const normalize = (s) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const arDigits = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

const AR_DAYS = [
  'الاحد|الحد',
  'الاثنين|الاتنين|التنين',
  'الثلاثاء|الثلاثا|التلات|التلاتاء|الثلاث',
  'الاربعاء|الاربع|الاربعا',
  'الخميس',
  'الجمعه',
  'السبت',
];
const AR_MONTHS = [
  'يناير|كانون الثاني', 'فبراير|شباط', 'مارس|اذار', 'ابريل|نيسان', 'مايو|ايار', 'يونيو|يونيه|حزيران',
  'يوليو|يوليه|تموز', 'اغسطس|اب', 'سبتمبر|ايلول', 'اكتوبر|تشرين الاول', 'نوفمبر|تشرين الثاني', 'ديسمبر|كانون الاول',
];
const NEXT = '(?:\\s+(?:الجاي|الجايه|القادم|القادمه|اللي جاي|اللي جايه))?';

// Period words. NIGHT is special: "2 بالليل" means 2 AM.
const NIGHT = 'بالليل|بليل|الليل|ليلا';
const EVENING = 'م|مساء|مساءا|المغرب|بالمغرب|العشا|بالعشا|العشاء';
const AFTERNOON = 'العصر|عصرا|بالعصر|بعد الضهر|بعد الظهر';
const MORNING = 'ص|صباحا|الصبح|الصبحيه|بالصبح|الفجر|فجرا';
const NOON = 'الضهر|الظهر|ضهرا|ظهرا|بالضهر';
const PERIOD = [NIGHT, EVENING, AFTERNOON, MORNING, NOON].join('|');
const PRAYERS = {
  الفجر: { h: 5, m: 0, period: 'الفجر' },
  الضهر: { h: 12, m: 30, period: 'الضهر' },
  الظهر: { h: 12, m: 30, period: 'الضهر' },
  العصر: { h: 15, m: 30, period: 'العصر' },
  المغرب: { h: 18, m: 0, period: 'المغرب' },
  العشا: { h: 19, m: 30, period: 'العشا' },
  العشاء: { h: 19, m: 30, period: 'العشا' },
};
const FRACTION = 'ونص|وربع|وثلث|وتلت|وخمسه|وعشره|الا ربع|الا ثلث|الا تلت|الا خمسه|الا عشره';

const MEETING = rx(
  'meeting|meet|call|zoom|sync|standup|stand-up|interview|demo|session|webinar|1:1|' +
    'ميتينج|ميتنج|ميتنغ|اجتماع|مكالمه|كول|زوم|زووم|مقابله|انترفيو|لقاء|ديمو|سيشن|جلسه'
);
const LATER = rx('!later|!someday|someday|!بعدين|بعدين|يوما ما|في وقت لاحق|مش مستعجل');

const EN_DAYS = ['sunday|sun', 'monday|mon', 'tuesday|tue|tues', 'wednesday|wed', 'thursday|thu|thurs', 'friday|fri', 'saturday|sat'];
const LITERAL = '\uE000'; // stands in for `kept` text while parsing: neither letter nor digit, so nothing matches it

const UNIT_MIN = { دقيقه: 1, دقايق: 1, دقائق: 1, ساعه: 60, ساعات: 60, ساعتين: 120, يوم: 1440, يومين: 2880, ايام: 1440 };

export function parseTask(input, now = new Date(), { projects = [] } = {}) {
  const src = arDigits(input.replace(/[ً-ْ]/g, '')); // drop tashkeel
  // `text in backticks` stays as written: hidden from every rule, put back in the title.
  const kept = new Map(); // index in `rest` → original character
  let rest = ` ${src} `.replace(/`([^`]+)`/g, (whole, inner, at) => {
    for (let i = 0; i < inner.length; i++) kept.set(at + 1 + i, inner[i]);
    return ` ${LITERAL.repeat(inner.length)} `;
  });
  let norm = normalize(rest);
  const out = { kind: 'task', someday: false, project: null, start: null, end: null, allDay: false, remindBefore: null, repeat: null };
  let day = null; // Date (start of day)
  let time = null; // { h, m, nextDay? }
  let endTime = null;
  let exact = null; // absolute Date ("بعد ساعتين")
  let duration = null; // minutes
  let remind = null;

  // Runs fn on each match until one is accepted, then blanks it out (same length keeps indexes valid).
  const take = (re, fn) => {
    for (const m of norm.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      if (fn(m) === false) continue;
      const blank = ' '.repeat(m[0].length);
      rest = rest.slice(0, m.index) + blank + rest.slice(m.index + m[0].length);
      norm = norm.slice(0, m.index) + blank + norm.slice(m.index + m[0].length);
      return true;
    }
    return false;
  };

  // #project (multi-word with _ : #تطبيق_الموبايل)
  take(/#([\p{L}\p{N}_.-]+)/u, (m) => {
    out.project = rest.slice(m.index + 1, m.index + m[0].length).replace(/_/g, ' ');
  });

  // "في Accounting" / "in Website" — only for names of projects that already exist (longest first).
  if (!out.project && projects.length) {
    const esc = (t) => normalize(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const names = [...projects].sort((a, b) => b.length - a.length);
    names.some((name) =>
      take(rx(`(?:في|ف|in|into|ل|لـ)\\s+${esc(name)}`), () => {
        out.project = name;
      })
    );
  }

  if (take(LATER, () => {})) out.someday = true;
  if (MEETING.test(norm)) out.kind = 'meeting';

  // Reminder: "فكرني قبلها بربع ساعه" / "remind me 15 min before"
  take(
    rx('(?:فكرني|ذكرني|نبهني)(?:\\s+(?:قبلها|قبل الميعاد|قبل))?\\s*(?:ب|بـ)?\\s*(\\d+)?\\s*(نص ساعه|ربع ساعه|دقيقه|دقايق|دقائق|ساعتين|ساعه|ساعات|يومين|يوم|ايام)'),
    (m) => {
      const u = m[2];
      remind = u === 'نص ساعه' ? 30 : u === 'ربع ساعه' ? 15 : (m[1] ? +m[1] : 1) * (u === 'ساعتين' || u === 'يومين' ? UNIT_MIN[u] / (m[1] ? +m[1] : 1) : UNIT_MIN[u]);
    }
  );
  take(/remind(?:\s+me)?\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\b(?:\s+before)?:?/i, (m) => {
    remind = +m[1] * (/^h/i.test(m[2]) ? 60 : /^d/i.test(m[2]) ? 1440 : 1);
  });

  // Duration: "لمده ساعتين" / "for 30 min"
  take(rx('لمده\\s+(?:(\\d+)\\s*)?(نص ساعه|ربع ساعه|ساعتين|ساعه|ساعات|دقيقه|دقايق|دقائق)(\\s+ونص)?'), (m) => {
    const u = m[2];
    duration = u === 'نص ساعه' ? 30 : u === 'ربع ساعه' ? 15 : u === 'ساعتين' ? 120 : (m[1] ? +m[1] : 1) * UNIT_MIN[u];
    if (m[3]) duration += 30;
  });
  take(/\bfor\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/i, (m) => {
    duration = Math.round(+m[1] * (/^h/i.test(m[2]) ? 60 : 1));
  });

  // Relative: بعد ساعتين / بعد 3 ايام / بعد ساعه ونص / بعد شهر
  take(
    rx('بعد\\s+(?:(\\d+)\\s*)?(نص ساعه|ربع ساعه|ساعتين|ساعه|ساعات|دقيقه|دقايق|دقائق|يومين|يوم|ايام|اسبوعين|اسبوع|اسابيع|شهرين|شهر|شهور|اشهر|سنه)(\\s+ونص)?'),
    (m) => {
      const n = m[1] ? +m[1] : 1;
      const u = m[2];
      const half = m[3] ? 30 : 0;
      if (u === 'نص ساعه') exact = addMinutes(now, 30);
      else if (u === 'ربع ساعه') exact = addMinutes(now, 15);
      else if (u === 'ساعتين') exact = addMinutes(now, 120 + half);
      else if (/^ساع/.test(u)) exact = addMinutes(now, n * 60 + half);
      else if (/^دق/.test(u)) exact = addMinutes(now, n);
      else if (u === 'يومين') day = addDays(startOfDay(now), 2);
      else if (/^(يوم|ايام)$/.test(u)) day = addDays(startOfDay(now), n);
      else if (u === 'اسبوعين') day = addWeeks(startOfDay(now), 2);
      else if (/^اسب|^اساب/.test(u)) day = addWeeks(startOfDay(now), n);
      else if (u === 'شهرين') day = addMonths(startOfDay(now), 2);
      else if (/شه/.test(u)) day = addMonths(startOfDay(now), n);
      else day = addYears(startOfDay(now), n);
    }
  );

  // Repeat: "كل خميس" / "كل يوم" / "كل اسبوعين" / "every friday" / "daily" / "every 3 days"
  let repeatDow = null;
  const repeatAs = (every, interval = 1) => () => void (out.repeat = { every, interval });
  AR_DAYS.some((names, dow) =>
    take(rx(`كل\\s+(?:يوم\\s+)?(?:${names.split('|').flatMap((n) => [n, n.replace(/^ال/, '')]).join('|')})`), () => {
      out.repeat = { every: 'week', interval: 1 };
      repeatDow = dow;
    })
  );
  if (!out.repeat)
    EN_DAYS.some((names, dow) =>
      take(new RegExp(`\\bevery\\s+(?:${names})\\b`, 'i'), () => {
        out.repeat = { every: 'week', interval: 1 };
        repeatDow = dow;
      })
    );
  if (!out.repeat) {
    const AR_UNIT = { يوم: 'day', ايام: 'day', اسبوع: 'week', اسابيع: 'week', شهر: 'month', شهور: 'month', اشهر: 'month', سنه: 'year', سنين: 'year', سنوات: 'year' };
    const EN_UNIT = { day: 'day', week: 'week', month: 'month', year: 'year' };
    take(rx('كل\\s+(\\d+)\\s*(يوم|ايام|اسبوع|اسابيع|شهر|شهور|اشهر|سنه|سنين|سنوات)'), (m) => repeatAs(AR_UNIT[m[2]], +m[1])()) ||
      take(rx('كل\\s+(يومين|اسبوعين|شهرين|سنتين)'), (m) => repeatAs({ يومين: 'day', اسبوعين: 'week', شهرين: 'month', سنتين: 'year' }[m[1]], 2)()) ||
      take(rx('يوم\\s+ويوم|يوم\\s+اه\\s+ويوم\\s+لا'), repeatAs('day', 2)) ||
      take(rx('كل\\s+يوم|يوميا|كل\\s+اسبوع|اسبوعيا|كل\\s+شهر|شهريا|كل\\s+سنه|سنويا'), (m) =>
        repeatAs(/يوم/.test(m[0]) ? 'day' : /اسبوع/.test(m[0]) ? 'week' : /شهر/.test(m[0]) ? 'month' : 'year')()
      ) ||
      take(/\bevery\s+(\d+)\s+(day|week|month|year)s?\b/i, (m) => repeatAs(EN_UNIT[m[2].toLowerCase()], +m[1])()) ||
      take(/\bevery\s+other\s+(day|week|month|year)\b/i, (m) => repeatAs(EN_UNIT[m[1].toLowerCase()], 2)()) ||
      take(/\b(?:every\s+(day|week|month|year)|(daily)|(weekly)|(monthly)|(yearly|annually))\b/i, (m) =>
        repeatAs(m[1]?.toLowerCase() || (m[2] ? 'day' : m[3] ? 'week' : m[4] ? 'month' : 'year'))()
      );
  }

  // Day words
  const rel = (w, fn) => !day && !exact && take(rx(w), () => void (day = fn(startOfDay(now))));
  rel('بعد بكره|بعد بكرا', (d) => addDays(d, 2));
  rel('النهارده|النهاردا|انهارده|اليوم|النهار ده|today|tonight', (d) => d);
  rel('بكره|بكرا|غدا|tomorrow', (d) => addDays(d, 1));
  rel('الاسبوع\\s+(?:الجاي|القادم|اللي جاي)', (d) => addWeeks(d, 1));
  rel('الشهر\\s+(?:الجاي|القادم|اللي جاي)', (d) => addMonths(d, 1));
  rel('السنه\\s+(?:الجايه|القادمه|اللي جايه)', (d) => addYears(d, 1));
  rel('الويكند|الويك اند|ويك اند|اخر الاسبوع|نهايه الاسبوع', (d) => addDays(d, (5 - d.getDay() + 7) % 7));
  if (repeatDow != null && !day && !exact) day = addDays(startOfDay(now), (repeatDow - now.getDay() + 7) % 7);
  if (!day && !exact)
    AR_DAYS.some((names, dow) =>
      take(rx(`(?:يوم\\s+)?(?:${names})${NEXT}`), () => {
        day = addDays(startOfDay(now), (dow - now.getDay() + 7) % 7 || 7);
      })
    );

  // 15 نوفمبر (2027)
  if (!day && !exact)
    AR_MONTHS.some((names, mi) =>
      take(rx(`(?:يوم\\s+)?(\\d{1,2})\\s*(?:${names})(?:\\s+(\\d{4}))?`), (m) => {
        if (+m[1] < 1 || +m[1] > 31) return false;
        day = new Date(m[2] ? +m[2] : now.getFullYear(), mi, +m[1]);
        if (!m[2] && day < startOfDay(now)) day.setFullYear(day.getFullYear() + 1);
      })
    );

  // 15/11 or 15/11/2026 (day first, Egyptian style)
  if (!day && !exact)
    take(/(?<![\d:])(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?![\d:])(?!\s*(?:am|pm|a\.m|p\.m|ص|م)(?![\p{L}]))/iu, (m) => {
      const d = +m[1], mo = +m[2] - 1;
      if (d < 1 || d > 31 || mo < 0 || mo > 11) return false;
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
      day = new Date(y, mo, d);
      if (!m[3] && day < startOfDay(now)) day.setFullYear(y + 1);
    });

  // "يوم 15" → the 15th (this month, or next if passed)
  if (!day && !exact)
    take(rx('يوم\\s+(\\d{1,2})(?!\\s*(?::|ساعه|ص|م))'), (m) => {
      const d = +m[1];
      if (d < 1 || d > 31) return false;
      day = new Date(now.getFullYear(), now.getMonth(), d);
      if (day < startOfDay(now)) day = addMonths(day, 1);
    });

  // "بعد صلاة العشاء" / "قبل المغرب": sets the period for a bare hour ("ع 8" → 8 PM), or an approximate time on its own.
  let context = null;
  take(rx(`(?:(?:بعد|قبل)\\s+(?:صلاه\\s+)?|صلاه\\s+)(${Object.keys(PRAYERS).join('|')})`), (m) => {
    context = PRAYERS[m[1]];
  });

  // Arabic clock time → { h, m, nextDay, ambiguous }
  const clock = (h0, mm, frac, suffix) => {
    suffix = suffix || context?.period;
    let h = +h0, min = mm ? +mm : 0;
    if (h > 23 || min > 59) return null;
    const delta = { ونص: 30, وربع: 15, وثلث: 20, وتلت: 20, وخمسه: 5, وعشره: 10 }[frac];
    if (delta) min = delta;
    else if (frac) {
      const back = { 'الا ربع': 15, 'الا ثلث': 20, 'الا تلت': 20, 'الا خمسه': 5, 'الا عشره': 10 }[frac];
      h -= 1;
      min = 60 - back;
    }
    const is = (group) => suffix && new RegExp(`^(?:${group})$`).test(suffix);
    let nextDay = false;
    if (is(NIGHT)) {
      if (h === 12) { h = 0; nextDay = true; }
      else if (h >= 1 && h <= 4) nextDay = true; // "2 بالليل" = 2 AM
      else if (h < 12) h += 12;
    } else if (is(EVENING) || is(AFTERNOON)) {
      if (h < 12) h += 12;
    } else if (is(MORNING)) {
      if (h === 12) h = 0;
    } else if (is(NOON)) {
      if (h <= 5) h += 12;
    } else if (h >= 1 && h <= 11) return { h, m: min, ambiguous: true }; // AM or PM decided when composing
    return { h: h % 24, m: min, nextDay };
  };
  // Groups: 1 prefix, 2 hour, 3 minutes, 4 fraction, 5 period
  const T = `((?:ال|لل|ل)?ساعه\\s*|(?:ع|على|علي|حوالي|نحو)\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(${FRACTION})?\\s*(${PERIOD})?(?:\\s+(?:كده|تقريبا|بالظبط))?`;

  // Range: "من 3 لـ 5 العصر" / "من الساعه 3 للساعه 5"
  take(rx(`من\\s+${T}\\s*(?:لحد|الي|ل|لـ|-|–)\\s*${T}`), (m) => {
    const sfx = m[10] || m[5];
    const a = clock(m[2], m[3], m[4], m[5] || sfx);
    const b = clock(m[7], m[8], m[9], sfx);
    if (!a || !b) return false;
    time = a;
    endTime = b;
  });

  // Single time: الساعة 5 / 5:30 م / 9 الصبح / 3 ونص العصر / 5 الا ربع
  if (!time)
    take(rx(T), (m) => {
      const approx = /(كده|تقريبا|بالظبط)$/.test(m[0]);
      if (!m[1] && !m[3] && !m[4] && !m[5] && !approx) return false; // plain number, not a time
      // "على 5 أشخاص" is a count, not a time: after a bare "ع/على N" only allow connector words.
      const onlyOn = m[1] && !/ساعه/.test(m[1]) && !m[3] && !m[4] && !m[5] && !approx;
      const nextWord = norm.slice(m.index + m[0].length).trim().split(/\s+/)[0] || '';
      if (onlyOn && nextWord && !/^(عشان|علشان|ان|و|مع|في|يوم|بكره|بكرا|النهارده|اليوم|#|[a-z\d,.،!؟?])/i.test(nextWord)) return false;
      time = clock(m[2], m[3], m[4], m[5]);
      if (!time) return false;
    });

  // Period word alone: "بكره الصبح", "النهارده بالليل"
  if (!time && !exact && context) time = { h: context.h, m: context.m };
  if (!time && !exact) {
    const periods = [
      [AFTERNOON, 16], [NOON, 12], [MORNING.replace(/^ص\|/, ''), 9], [EVENING.replace(/^م\|/, ''), 19], [NIGHT, 21],
    ];
    periods.some(([words, h]) => take(rx(words), () => void (time = { h, m: 0 })));
  }

  // English via chrono ("next friday at 3pm", "nov 20", "in 2 hours", "3-5pm")
  const [res] = chrono.parse(rest, now, { forwardDate: true });
  if (res) {
    const s = res.start;
    const hasDay = s.isCertain('day') || s.isCertain('weekday');
    const hasTime = s.isCertain('hour');
    if (hasDay || hasTime) {
      const d = s.date();
      if (!day && !exact && hasDay) day = startOfDay(d);
      if (!time && !exact && hasTime) {
        time = { h: d.getHours(), m: d.getMinutes() };
        if (res.end?.isCertain('hour')) endTime = { h: res.end.date().getHours(), m: res.end.date().getMinutes() };
      }
      const i = rest.indexOf(res.text);
      if (i >= 0) {
        const blank = ' '.repeat(res.text.length);
        rest = rest.slice(0, i) + blank + rest.slice(i + res.text.length);
      }
    }
  }

  // Compose
  if (exact) out.start = exact;
  else if (day || time) {
    let base = day || startOfDay(now);
    if (time) {
      base = new Date(base);
      let h = time.h;
      if (time.ambiguous) {
        // Bare "8": the next one coming today (8 AM or 8 PM); otherwise 1–7 → PM, 8–11 → AM.
        const at = (hh) => new Date(base).setHours(hh, time.m, 0, 0);
        const upcoming = !day && [h, h + 12].find((hh) => at(hh) > now);
        h = upcoming || (h <= 7 ? h + 12 : h);
      }
      base.setHours(h, time.m, 0, 0);
      if (time.nextDay) base = addDays(base, 1);
      if (!day && base < now) base = addDays(base, 1);
    }
    out.start = base;
    out.allDay = !time;
  }
  if (out.start && !out.allDay) {
    if (endTime) {
      let end = new Date(out.start);
      end.setHours(endTime.h, endTime.m, 0, 0);
      if (end <= out.start) end = addDays(end, 1);
      out.end = end;
    } else if (duration) out.end = addMinutes(out.start, duration);
  }
  // Repeating with no date starts today; a first occurrence already past moves to the next one.
  if (out.repeat && !out.start) {
    out.start = startOfDay(now);
    out.allDay = true;
  }
  if (out.repeat && out.start && (out.allDay ? out.start < startOfDay(now) : out.start < now)) {
    const length = out.end ? out.end - out.start : 0;
    while (out.allDay ? out.start < startOfDay(now) : out.start < now) out.start = stepRepeat(out.start, out.repeat);
    if (out.end) out.end = new Date(out.start.getTime() + length);
  }
  if (out.start) {
    out.someday = false;
    out.remindBefore = remind ?? (out.allDay ? null : out.kind === 'meeting' ? 10 : 0);
  }

  // Put `kept` text back (without the backticks)
  if (kept.size) rest = [...rest].map((c, i) => kept.get(i) ?? c).join('');

  // Title: what's left, minus dangling connectors
  let title = rest.replace(/\s+/g, ' ').trim();
  const edge = '(?:on|at|by|the|in|from|to|and|في|يوم|ع|على|علي|من|ل|الساعه|الساعة|و|يعني|كده|تقريبا|،|,|-|–)';
  for (let i = 0; i < 4; i++)
    title = title.replace(new RegExp(`^${edge}(?:\\s+|$)|(?:^|\\s+)${edge}$`, 'iu'), '').trim();
  title = title.replace(/^[\s,،:;.\-–]+|[\s,،:;\-–]+$/g, '');
  out.title = title || input.trim();

  const tokens = [];
  if (out.start) tokens.push({ type: 'date', label: describeDate(out.start, out.allDay, out.end, now) });
  if (out.repeat) tokens.push({ type: 'repeat', label: describeRepeat(out.repeat, out.start) });
  if (out.start && out.remindBefore != null) tokens.push({ type: 'reminder', label: describeReminder(out.remindBefore) });
  if (out.kind === 'meeting') tokens.push({ type: 'meeting', label: 'Meeting' });
  if (out.project) tokens.push({ type: 'project', label: out.project });
  if (out.someday) tokens.push({ type: 'later', label: 'Later' });
  out.tokens = tokens;
  return out;
}

function stepRepeat(d, { every, interval = 1 }) {
  return every === 'day' ? addDays(d, interval) : every === 'week' ? addWeeks(d, interval) : every === 'month' ? addMonths(d, interval) : addYears(d, interval);
}

/** "Every Thursday", "Daily", "Every 2 weeks", "Monthly"… */
export function describeRepeat(repeat, start) {
  if (!repeat?.every) return '';
  const n = repeat.interval || 1;
  if (repeat.every === 'week' && n === 1 && start) return `Every ${format(new Date(start), 'EEEE')}`;
  if (n === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[repeat.every];
  return `Every ${n} ${repeat.every}s`;
}

export function describeReminder(min) {
  if (min === 0) return 'At start';
  if (min % 1440 === 0) return `${min / 1440}d before`;
  if (min % 60 === 0) return `${min / 60}h before`;
  return `${min}m before`;
}

export function describeDate(date, allDay, end, now = new Date()) {
  const d = new Date(date);
  const dayLabel = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, d.getFullYear() === now.getFullYear() ? 'EEE, MMM d' : 'MMM d, yyyy');
  if (allDay) return dayLabel;
  let s = `${dayLabel} · ${format(d, 'h:mm a')}`;
  if (end) {
    const e = new Date(end);
    s += ` – ${format(e, isSameDay(d, e) ? 'h:mm a' : 'EEE h:mm a')}`;
  }
  return s;
}

export { normalize as normalizeText };
