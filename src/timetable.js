import { store, DAY_KEYS, DAY_NAMES } from './store.js';

// ── Week / day helpers ────────────────────────────────────────────────────────

/**
 * Returns 1 or 2 (the week number) for the given date relative to the
 * configured Week-1 start date, or null if unconfigured / before the start.
 */
export function getCurrentWeek(date = new Date()) {
  const { weekStartDate } = store.getSettings();
  if (!weekStartDate) return null;

  const ref = new Date(weekStartDate);
  const d   = new Date(date);
  ref.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((d - ref) / 86_400_000);
  if (daysDiff < 0) return null;
  return (Math.floor(daysDiff / 7) % 2) + 1;
}

/** Returns 0–4 (Mon–Fri) or -1 for weekends. */
export function getDayIndex(date = new Date()) {
  const js = new Date(date).getDay(); // 0=Sun … 6=Sat
  if (js === 0 || js === 6) return -1;
  return js - 1;
}

export function getDayKey(date = new Date()) {
  const i = getDayIndex(date);
  return i >= 0 ? DAY_KEYS[i] : null;
}

export function getDayName(date = new Date()) {
  const i = getDayIndex(date);
  return i >= 0 ? DAY_NAMES[i] : 'Weekend';
}

// ── Lesson fetching ───────────────────────────────────────────────────────────

/** Returns { week, dayKey, lessons } for a date, merging recurring + extras. */
export function getLessonsForDate(date = new Date()) {
  const week   = getCurrentWeek(date);
  const dayKey = getDayKey(date);
  if (!week || !dayKey) return { week, dayKey, lessons: [] };

  const recurring = store.getLessons(week, dayKey);
  const extras    = getExtrasForDate(date);

  const order = Object.fromEntries(
    store.getSettings().periods.map((p, i) => [p.id, i])
  );

  const combined = [...recurring, ...extras]
    .sort((a, b) => (order[a.periodId] ?? 99) - (order[b.periodId] ?? 99));

  return { week, dayKey, lessons: combined };
}

export function getExtrasForDate(date = new Date()) {
  const ds = formatDate(date);
  return store.getExtras().filter(e => e.date === ds);
}

// ── Period helpers ────────────────────────────────────────────────────────────

export function getPeriodById(periodId) {
  return store.getSettings().periods.find(p => p.id === periodId);
}

export function getPeriodTimeRange(periodId) {
  const p = getPeriodById(periodId);
  return p ? `${p.start}–${p.end}` : '';
}

/** Returns the ID of the period currently in progress, or null. */
export function getCurrentPeriodId() {
  const now  = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const p = store.getSettings().periods.find(p => hhmm >= p.start && hhmm < p.end);
  return p?.id ?? null;
}

/**
 * Returns true if the given period ID is the user's designated lunch period.
 * Only applies to sixth-formers (Year 12 / 13).
 */
export function isLunchPeriod(periodId) {
  const { yearGroup, lunchPeriodId } = store.getSettings();
  return (yearGroup === 12 || yearGroup === 13) && periodId === lunchPeriodId;
}

// ── Colour ────────────────────────────────────────────────────────────────────

/** Deterministically generates a pastel HSL colour from a subject name. */
export function getSubjectColour(subject) {
  if (!subject) return 'hsl(0,0%,88%)';
  let h = 0;
  for (let i = 0; i < subject.length; i++) {
    h = subject.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h % 360)},55%,82%)`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatDate(date = new Date()) {
  return new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
}
