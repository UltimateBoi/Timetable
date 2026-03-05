const STORAGE_KEY = 'timetable_data';
const DATA_VERSION = 1;

/**
 * The canonical school period structure.
 * id        — unique key used in lesson objects as `periodId`
 * label     — display name
 * start/end — 24-hour HH:MM strings (user-adjustable in settings)
 * isBreak   — rendered as a divider, never holds a lesson
 * isExtra   — hidden from the day view unless a lesson is assigned (e.g. Period 8)
 */
export const DEFAULT_PERIODS = [
  { id: 'p1',    label: 'Period 1',  start: '08:45', end: '09:20', isBreak: false, isExtra: false },
  { id: 'p2',    label: 'Period 2',  start: '09:20', end: '10:10', isBreak: false, isExtra: false },
  { id: 'p3',    label: 'Period 3',  start: '10:10', end: '11:00', isBreak: false, isExtra: false },
  { id: 'break', label: 'Break',     start: '11:00', end: '11:20', isBreak: true,  isExtra: false },
  { id: 'p4',    label: 'Period 4',  start: '11:20', end: '12:10', isBreak: false, isExtra: false },
  { id: 'p5',    label: 'Period 5',  start: '12:10', end: '13:00', isBreak: false, isExtra: false },
  { id: 'p6a',   label: 'Period 6a', start: '13:00', end: '13:45', isBreak: false, isExtra: false },
  { id: 'p6b',   label: 'Period 6b', start: '13:45', end: '14:30', isBreak: false, isExtra: false },
  { id: 'p7',    label: 'Period 7',  start: '14:30', end: '15:20', isBreak: false, isExtra: false },
  { id: 'p8',    label: 'Period 8',  start: '15:20', end: '16:20', isBreak: false, isExtra: true  },
];

export const DAY_KEYS  = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DEFAULT_DATA = {
  version: DATA_VERSION,
  settings: {
    weekStartDate: null,   // ISO date (YYYY-MM-DD) of a Monday that is Week 1
    yearGroup:     12,     // 7–13; determines whether a lunch period is shown
    lunchPeriodId: 'p6a', // Which period slot is lunch for this user (6th form only)
    periods:       DEFAULT_PERIODS,
  },
  timetable: {
    week1: { mon: [], tue: [], wed: [], thu: [], fri: [] },
    week2: { mon: [], tue: [], wed: [], thu: [], fri: [] },
  },
  extras: [], // One-off lessons: { id, date (YYYY-MM-DD), periodId, subject, room, teacher, notes }
};

export const store = {
  data: null,

  init() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.data = JSON.parse(raw);
        // Migration safety — fill any missing keys
        this.data.settings                ??= structuredClone(DEFAULT_DATA.settings);
        this.data.settings.periods        ??= DEFAULT_PERIODS;
        this.data.settings.yearGroup      ??= 12;
        this.data.settings.lunchPeriodId  ??= 'p6a';
        this.data.timetable               ??= structuredClone(DEFAULT_DATA.timetable);
        this.data.extras                  ??= [];
      } catch (e) {
        console.error('[store] Failed to parse localStorage, resetting.', e);
        this.data = structuredClone(DEFAULT_DATA);
      }
    } else {
      this.data = structuredClone(DEFAULT_DATA);
    }
    return this.data;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings() { return this.data.settings; },

  updateSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
  },

  // ── Recurring timetable ───────────────────────────────────────────────────

  /** @param {1|2} week  @param {'mon'|'tue'|'wed'|'thu'|'fri'} dayKey */
  getLessons(week, dayKey) {
    return this.data.timetable[`week${week}`]?.[dayKey] ?? [];
  },

  addLesson(week, dayKey, lesson) {
    const id    = `lesson_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const entry = { id, ...lesson };
    const arr   = this.data.timetable[`week${week}`][dayKey];
    arr.push(entry);
    this._sortLessons(arr);
    this.save();
    return entry;
  },

  updateLesson(week, dayKey, id, patch) {
    const arr = this.data.timetable[`week${week}`][dayKey];
    const i   = arr.findIndex(l => l.id === id);
    if (i !== -1) { arr[i] = { ...arr[i], ...patch }; this._sortLessons(arr); this.save(); }
  },

  deleteLesson(week, dayKey, id) {
    const key = `week${week}`;
    this.data.timetable[key][dayKey] =
      this.data.timetable[key][dayKey].filter(l => l.id !== id);
    this.save();
  },

  /** Search all weeks/days for a lesson by ID. Returns { lesson, week, dayKey } or null. */
  findLessonById(id) {
    for (let w = 1; w <= 2; w++) {
      for (const dk of DAY_KEYS) {
        const found = this.getLessons(w, dk).find(l => l.id === id);
        if (found) return { lesson: found, week: w, dayKey: dk };
      }
    }
    return null;
  },

  // ── Extras ────────────────────────────────────────────────────────────────

  getExtras() { return this.data.extras; },

  addExtra(extra) {
    const id    = `extra_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const entry = { id, ...extra };
    this.data.extras.push(entry);
    this.save();
    return entry;
  },

  updateExtra(id, patch) {
    const i = this.data.extras.findIndex(e => e.id === id);
    if (i !== -1) { this.data.extras[i] = { ...this.data.extras[i], ...patch }; this.save(); }
  },

  deleteExtra(id) {
    this.data.extras = this.data.extras.filter(e => e.id !== id);
    this.save();
  },

  // ── Bulk import ───────────────────────────────────────────────────────────

  /**
   * Replace the entire timetable with data produced by the AI importer.
   * Extras (one-off lessons) are preserved untouched.
   *
   * @param {{ week1: Record<string, RawLesson[]>, week2: Record<string, RawLesson[]> }} data
   */
  importTimetable(data) {
    const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const newTimetable = {
      week1: { mon: [], tue: [], wed: [], thu: [], fri: [] },
      week2: { mon: [], tue: [], wed: [], thu: [], fri: [] },
    };

    for (const wk of ['week1', 'week2']) {
      for (const dk of DAY_KEYS) {
        newTimetable[wk][dk] = (data[wk]?.[dk] ?? []).map(l => ({
          id:       `lesson_${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
          periodId: l.periodId,
          subject:  (l.subject ?? '').trim(),
          room:     (l.room    ?? '').trim(),
          teacher:  (l.teacher ?? '').trim().toUpperCase(),
          notes:    (l.notes   ?? '').trim(),
        }));
        this._sortLessons(newTimetable[wk][dk]);
      }
    }

    this.data.timetable = newTimetable;
    this.save();
  },

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Sort a lessons array by their period's position in settings.periods. */
  _sortLessons(arr) {
    const order = Object.fromEntries(
      this.data.settings.periods.map((p, i) => [p.id, i])
    );
    arr.sort((a, b) => (order[a.periodId] ?? 99) - (order[b.periodId] ?? 99));
  },
};
