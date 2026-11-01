import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import {
  AlarmClock, Bell, CalendarDays, Quote, Repeat, Clock, FolderClosed, Hourglass, Lightbulb, MousePointerClick, Plus, Sparkles, Timer, Video, Wand2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { ICONS, TONES } from '../components/QuickAdd';
import { useProjectSuggest } from '../components/ProjectSuggest';
import { parseTask } from '../lib/parse';
import { createFromText, projectNames } from '../lib/actions';
import { useStore } from '../lib/store';

const SECTIONS = [
  {
    icon: CalendarDays,
    title: 'اليوم',
    en: 'Which day',
    body: 'اكتب اليوم بأي طريقة طبيعية. لو كتبت يوم من غير ساعة بيتحط “طول اليوم”.',
    examples: ['اتصل بالبنك النهارده', 'سلّم التقرير بكره', 'زيارة بعد بكره', 'جيم يوم الخميس', 'سفر الجمعة الجاية', 'خروجة الويكند', 'مذاكرة يوم 28', 'دكتور 15/11', 'عيد ميلاد ماما 3 ديسمبر', 'تجديد الباسبور بعد شهر', 'review PR next monday'],
  },
  {
    icon: Clock,
    title: 'الساعة',
    en: 'What time',
    body: 'قول “الساعة” أو “ع” قبل الرقم، أو ص/م/الصبح/العصر/بالليل بعده. ولو كتبت رقم من غير ص أو م بنحطه في أقرب ميعاد جاي النهارده (8 الصبح أو 8 بالليل).',
    examples: ['ميتينج الساعة 5', 'دوا 9 الصبح', 'كول 3 ونص العصر', 'الدوا الساعة 5 الا ربع', 'اجتماع 4 وتلت', 'سهرة 2 بالليل', 'مكالمة ع 8 كده', 'gym 7:30pm'],
  },
  {
    icon: Sparkles,
    title: 'مواعيد الصلاة',
    en: 'Prayer times',
    body: '“بعد صلاة …” بتحدد الفترة، فـ“ع 8” بعد العشاء تبقى 8 بالليل. ولو ماكتبتش رقم بنحط وقت تقريبي للصلاة.',
    examples: ['ميتينج بعد صلاة العشاء ع 8', 'زيارة بعد المغرب', 'مذاكرة بعد الفجر', 'شغل بعد صلاة الضهر الساعة 1'],
  },
  {
    icon: AlarmClock,
    title: 'بعد شوية',
    en: 'In a while',
    body: 'من دلوقتي. بتتحسب بالدقيقة.',
    examples: ['ارفع الفيرجن بعد ساعتين', 'رد على الإيميل بعد نص ساعة', 'قوم اتمشى بعد ساعة ونص', 'stretch in 45 minutes'],
  },
  {
    icon: Timer,
    title: 'من لحد',
    en: 'Ranges & duration',
    body: 'حدد البداية والنهاية، أو المدة، والتاسك بتاخد وقت في الكاليندر.',
    examples: ['كول من 3 لـ 5 العصر', 'اجتماع من الساعة 10 للساعة 12 الضهر', 'ميتينج الساعة 6 لمدة ساعة ونص', 'standup 3-4pm', 'call bank friday 10am for 30 min'],
  },
  {
    icon: Bell,
    title: 'التذكير',
    en: 'Reminders',
    body: 'تلقائيًا: الميتينج بيفكرك قبلها بـ10 دقايق، وأي حاجة ليها ساعة بتفكرك في ميعادها. ولو عاوز وقت تاني قوله.',
    examples: ['كول مع العميل بكره 5 فكرني قبلها بربع ساعة', 'دفع الفاتورة يوم 1 فكرني قبلها بيوم', 'dentist tomorrow 4pm remind me 30 min before'],
  },
  {
    icon: Video,
    title: 'ميتينج',
    en: 'Meetings',
    body: 'كلمات زي ميتينج، اجتماع، كول، مكالمة، زوم، مقابلة، meeting، call، sync… بتخلي التاسك “ميتينج” بأيقونة الكاميرا وتذكير قبلها.',
    examples: ['ميتينج مع أحمد بكره الساعة 5', 'كول مع الفريق ع 9', 'zoom with client friday 2pm'],
  },
  {
    icon: FolderClosed,
    title: 'المشروع',
    en: 'Projects',
    body: 'اكتب # وابدأ اسم المشروع واختار من الاقتراحات (Enter أو Tab)، أو اكتب “في” + اسم مشروع موجود. ولو المشروع مش موجود و كتبته بـ#، بيتعمل لوحده. الاسم اللي فيه مسافات اكتبه بـ _.',
    examples: ['صمم اللوجو #Website', 'اربط الـ API #تطبيق_الموبايل', 'اعمل الكام نقطة في Accounting'],
  },
  {
    icon: Repeat,
    title: 'تكرار',
    en: 'Repeating',
    body: 'التاسك بتتعاد لوحدها. لما تخلّصها بتنزل اللي بعدها في نفس الميعاد، ولو فات ميعادها من غير ما تخلّصها بتفضل مكانها “Late” وبتنزل واحدة جديدة للميعاد الجاي.',
    examples: ['جيم كل خميس 7 بالليل', 'دوا يوميا 9 الصبح', 'مراجعة كل اسبوعين', 'ادفع الايجار كل شهر يوم 1', 'اسقي الزرع كل 3 ايام', 'standup every day 10am', 'review every friday 3pm'],
  },
  {
    icon: Quote,
    title: 'زي ما هو',
    en: 'Keep as written',
    body: 'حط الكلام بين علامتين ` (backtick، جنب رقم 1 في الكيبورد) وهيتحط في العنوان زي ما هو من غير ما يتفهم كميعاد أو مشروع.',
    examples: ['نزلة `الخميس` كل خميس', 'اقرا `بكره الساعة 5` النهارده', 'اكتب عن `#Website` بكره'],
  },
  {
    icon: Hourglass,
    title: 'بعدين',
    en: 'Later',
    body: 'حاجة مش عارف هتعملها امتى؟ بتروح قسم Later بعيد عن زحمة النهارده.',
    examples: ['اقرا كتاب التصميم بعدين', 'تعلم Rust !later', 'learn piano someday'],
  },
];

const TIPS = [
  'أي حاجة البرنامج فهمها بتتشال من العنوان، والعنوان بيفضل نظيف.',
  'الشيبس اللي تحت خانة الكتابة بتوريك اللي اتفهم قبل ما تحفظ.',
  'الأرقام العربي (١٢٣) شغالة، والهمزات والتاء المربوطة مش فارقة.',
  'تقدر تجمع كله في جملة واحدة: “ميتينج بكره من 3 لـ 4 #Website فكرني قبلها بنص ساعة”.',
  'أي حاجة اتفهمت غلط؟ افتح التاسك وعدّلها، أو اسحبها ليوم تاني في الكاليندر.',
];

function Chips({ parsed, dim }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parsed.tokens.length === 0 && <span className="text-xs text-stone-500">No date — plain task</span>}
      {parsed.tokens.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <span key={t.type} className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', TONES[t.type], dim && 'opacity-90')}>
            <Icon size={11} /> {t.label}
          </span>
        );
      })}
    </div>
  );
}

export default function GuideView() {
  const items = useStore((s) => s.items);
  const projects = useMemo(() => projectNames(items), [items]);
  const [text, setText] = useState('ميتينج مع أحمد بكره من 3 لـ 4 العصر فكرني قبلها بنص ساعة');
  const [flash, setFlash] = useState(0);
  const ref = useRef(null);
  const suggest = useProjectSuggest(text, setText, ref);
  const parsed = useMemo(() => (text.trim() ? parseTask(text, new Date(), { projects }) : null), [text, projects]);

  const tryIt = (example) => {
    setText(example);
    setFlash((f) => f + 1);
    ref.current?.focus();
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <PageHeader title="Writing guide" subtitle="Write tasks the way you talk — Flowboard picks out the day, time, project and more." />

      <motion.div key={flash} initial={{ scale: flash ? 0.99 : 1 }} animate={{ scale: 1 }} className="card relative mb-8 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-300">
          <Wand2 size={14} /> Try it
        </div>
        <div className="relative">
          <input
            ref={ref}
            dir="auto"
            value={text}
            {...suggest.inputProps}
            onChange={(e) => {
              setText(e.target.value);
              suggest.onChange(e);
            }}
            onKeyDown={(e) => suggest.onKeyDown(e)}
            placeholder="اكتب أي حاجة…"
            className="input py-3 text-[15px]"
          />
          {suggest.dropdown}
        </div>
        <AnimatePresence mode="wait">
          {parsed && (
            <motion.div
              key={parsed.title + parsed.tokens.map((t) => t.label).join()}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/[.03] p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-stone-500">Saved as</div>
                <div dir="auto" className="mt-0.5 truncate font-semibold">{parsed.title}</div>
                <div className="mt-2"><Chips parsed={parsed} /></div>
              </div>
              <button onClick={async () => (await createFromText(text)) && setText('')} className="btn-primary">
                <Plus size={15} /> Add it
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="space-y-4">
        {SECTIONS.map((sec, si) => (
          <motion.section
            key={sec.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.3, delay: Math.min(si, 3) * 0.04 }}
            className="card p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-500/15 text-accent-300">
                <sec.icon size={17} />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold" dir="rtl">{sec.title}</h2>
                <div className="text-[11px] uppercase tracking-wider text-stone-500">{sec.en}</div>
              </div>
            </div>
            <p dir="rtl" className="mb-4 text-sm leading-relaxed text-stone-400">{sec.body}</p>
            <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
              {sec.examples.map((ex) => {
                const p = parseTask(ex, new Date(), { projects });
                return (
                  <button
                    key={ex}
                    onClick={() => tryIt(ex)}
                    className="group flex w-full flex-col gap-1.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[.04] sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span dir="auto" className="flex-1 text-[14px] text-stone-200"><span className="rounded-md bg-white/[.05] px-1.5 py-0.5">{ex}</span></span>
                    <span className="flex items-center gap-2 sm:justify-end">
                      <span dir="auto" className="max-w-40 truncate text-xs text-stone-500">“{p.title}”</span>
                      <Chips parsed={p} dim />
                      <MousePointerClick size={13} className="shrink-0 text-stone-600 opacity-0 transition group-hover:opacity-100" />
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.section>
        ))}

        <section className="card p-5" dir="rtl">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Lightbulb size={17} className="text-amber-300" /> نصايح
          </div>
          <ul className="space-y-2 text-sm leading-relaxed text-stone-400">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" /> {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
