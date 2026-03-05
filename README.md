# School Timetable

A mobile-first progressive web app (PWA) for managing a 2-week rotating school timetable.

**Live:** https://ultimateboi.github.io/Timetable/

## Features

- 2-week rotating timetable with automatic Week 1 / Week 2 detection
- Full school period structure: P1–P3, Break, P4–P7, optional P8
- Sixth-form lunch period support (Year 12 / 13)
- Add one-off extra lessons (music, revision sessions, etc.)
- Bulk import via AI — photograph your timetable and import in seconds
- Offline-capable PWA, installable to home screen
- Dark mode support
- Data stored locally in the browser (localStorage)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Project structure

```
src/
├── main.js            # Entry point
├── store.js           # localStorage data layer
├── timetable.js       # Week/day/period logic
├── style.css          # Mobile-first styles
└── ui/
    ├── dayView.js     # Day view
    ├── editor.js      # Add/edit lesson modal
    ├── settings.js    # Settings modal
    └── importer.js    # AI bulk-import
```

## Roadmap

- iOS Live Activity (current lesson + time remaining)
- Android home screen widget
- Push notifications for lesson changes
- Firebase sync with Google login
