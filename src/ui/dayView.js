import {
  getCurrentWeek, getDayIndex, getLessonsForDate,
  getCurrentPeriodId, isLunchPeriod, getSubjectColour, formatDate,
} from '../timetable.js';
import { store } from '../store.js';

let currentDate = new Date();

export function initDayView() {
  document.getElementById('prev-day').addEventListener('click', () => shiftDay(-1));
  document.getElementById('next-day').addEventListener('click', () => shiftDay(1));
  document.getElementById('nav-today').addEventListener('click', goToToday);

  renderDayView();
  // Refresh current-period highlight every minute
  setInterval(renderDayView, 60_000);
}

export function renderDayView() {
  const week   = getCurrentWeek(currentDate);
  const dayIdx = getDayIndex(currentDate);

  // Week badge
  document.getElementById('week-indicator').textContent =
    week ? `Week ${week}` : 'Setup Required';

  // Date heading
  document.getElementById('current-day').textContent =
    currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  const container = document.getElementById('lessons-container');

  if (!week) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Open <strong>Settings</strong> to configure your timetable.</p>
      </div>`;
    return;
  }

  if (dayIdx < 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No lessons &mdash; it's the weekend.</p>
      </div>`;
    return;
  }

  const { lessons } = getLessonsForDate(currentDate);
  const { periods } = store.getSettings();
  const occupied    = new Set(lessons.map(l => l.periodId));

  const isToday        = formatDate(currentDate) === formatDate(new Date());
  const activePeriodId = isToday ? getCurrentPeriodId() : null;

  let html = '';

  for (const period of periods) {
    // Period 8 — hidden unless something is actually scheduled in it
    if (period.isExtra && !occupied.has(period.id)) continue;

    // ── Break divider ──────────────────────────────────────────────────────
    if (period.isBreak) {
      html += `<div class="break-divider">Break &nbsp;·&nbsp; ${period.start}–${period.end}</div>`;
      continue;
    }

    // ── Sixth-form lunch slot (no lesson booked over it) ───────────────────
    if (isLunchPeriod(period.id) && !occupied.has(period.id)) {
      html += `
        <div class="lunch-card">
          <div class="period-meta">
            <span class="period-label">${period.label}</span>
            <span class="period-time">${period.start}–${period.end}</span>
          </div>
          <span class="lunch-text">Lunch</span>
        </div>`;
      continue;
    }

    const lesson = lessons.find(l => l.periodId === period.id);

    // ── Free period ────────────────────────────────────────────────────────
    if (!lesson) {
      html += `
        <div class="free-period">
          <div class="period-meta">
            <span class="period-label">${period.label}</span>
            <span class="period-time">${period.start}–${period.end}</span>
          </div>
          <span class="free-text">Free</span>
        </div>`;
      continue;
    }

    // ── Lesson card ────────────────────────────────────────────────────────
    const isCurrent = period.id === activePeriodId;
    const colour    = getSubjectColour(lesson.subject);
    const isExtra   = !!lesson.date;

    html += `
      <div class="lesson-card ${isCurrent ? 'current' : ''}"
           style="--accent: ${colour}"
           data-lesson-id="${lesson.id}">
        <div class="period-meta">
          <span class="period-label">${period.label}</span>
          <span class="period-time">${period.start}–${period.end}</span>
        </div>
        <div class="lesson-body">
          <h3 class="lesson-subject">${lesson.subject}</h3>
          <div class="lesson-meta">
            <span class="lesson-room">${lesson.room}</span>
            <span class="lesson-teacher">${lesson.teacher}</span>
          </div>
          ${lesson.notes ? `<p class="lesson-notes">${lesson.notes}</p>` : ''}
          ${isExtra ? `<span class="badge-extra">One-off</span>` : ''}
        </div>
      </div>`;
  }

  if (!html) {
    html = `
      <div class="empty-state">
        <p>No lessons today. Tap <strong>Add Lesson</strong> to get started.</p>
      </div>`;
  }

  container.innerHTML = html;
}

function shiftDay(offset) {
  currentDate = new Date(currentDate);
  currentDate.setDate(currentDate.getDate() + offset);
  renderDayView();
}

function goToToday() {
  currentDate = new Date();
  renderDayView();
}

export function getCurrentDisplayDate() {
  return currentDate;
}
