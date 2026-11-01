# Flowboard Web

React + Tailwind v4 + Vite client for Flowboard.

## Run

```bash
cp .env.example .env
npm install
npm run dev    # http://localhost:5173 — needs the API running
```

In dev, `/api` is proxied to `VITE_PROXY_TARGET`. For a production build pointing at a deployed API, set `VITE_API_URL` (e.g. `https://api.example.com/api`) then `npm run build`.

## Features

- Nested tree (tasks ⊃ tasks, projects ⊃ projects) with drag & drop; drag right to nest
- Drag any task (tree, Today, Calendar) onto sidebar targets: Tasks, Today, Later, or a project
- Natural-language quick add (Arabic + English): dates, times, ranges, durations, reminders, `#project`, `بعدين` / `!later`
  - `كول من 3 لـ 5 العصر فكرني قبلها بربع ساعة` · `ميتينج بكره الصبح` · `standup 3-4pm` · `call bank friday 10am for 30 min`
- Type `#` (or `في` / `in` + name) for project suggestions; editing a task's title re-parses it too
- Rich-text notes (headings, lists, checklists, links) — saved as HTML
- Writing guide page (`/guide`) with live examples and a playground
- Work sessions: block time on a project for a specific day and time
- Today, Later, Calendar (week / month / year, drag to reschedule), dependency Map
- In-app + browser reminders, optional azkar notifications (random, no repeats among the last 10)
- Custom UI only: searchable selects, date/time pickers, dialogs (no native alert/confirm/select)
