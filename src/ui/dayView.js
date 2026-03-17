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
  const currentStatus  = isToday
    ? getCurrentStatus(periods, lessons, activePeriodId)
    : null;

  let html = currentStatus ? renderCurrentStatus(currentStatus) : '';

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
    const currentProgress = isCurrent ? getPeriodProgress(period) : null;

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
          ${currentProgress ? `
            <div class="lesson-progress" aria-label="${currentProgress.percentage}% through this lesson">
              <div class="lesson-progress-meta">
                <span>Now</span>
                <span>${currentProgress.elapsedMinutes}m / ${currentProgress.totalMinutes}m (${currentProgress.percentage}%)</span>
              </div>
              <div class="lesson-progress-track" role="presentation">
                <div class="lesson-progress-fill" style="width: ${currentProgress.percentage}%"></div>
              </div>
            </div>` : ''}
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

function renderCurrentStatus(status) {
  if (!status) return '';

  if (!status.inPeriod) {
    return `
      <section class="current-status-card" aria-live="polite">
        <p class="current-status-title">Current Lesson</p>
        <p class="current-status-main">No active period right now</p>
        ${status.nextPeriodLabel ? `<p class="current-status-sub">Next: ${status.nextPeriodLabel} at ${status.nextPeriodStart}</p>` : '<p class="current-status-sub">No more periods left today</p>'}
      </section>`;
  }

  const title = status.lesson
    ? status.lesson.subject
    : (status.isLunch ? 'Lunch' : 'Free Period');

  return `
    <section class="current-status-card" aria-live="polite">
      <p class="current-status-title">Current Lesson</p>
      <p class="current-status-main">${title}</p>
      <p class="current-status-sub">${status.period.label} · ${status.period.start}–${status.period.end}</p>
      <div class="current-status-progress" aria-label="${status.progress.percentage}% through current period">
        <div class="current-status-progress-meta">
          <span>${status.progress.percentage}% through</span>
          <span>${status.progress.elapsedMinutes}m / ${status.progress.totalMinutes}m</span>
        </div>
        <div class="current-status-track" role="presentation">
          <div class="current-status-fill" style="width: ${status.progress.percentage}%"></div>
        </div>
      </div>
    </section>`;
}

function getCurrentStatus(periods, lessons, activePeriodId) {
  if (!activePeriodId) {
    const nextPeriod = getNextPeriod(periods);
    return {
      inPeriod: false,
      nextPeriodLabel: nextPeriod?.label ?? null,
      nextPeriodStart: nextPeriod?.start ?? null,
    };
  }

  const period = periods.find(p => p.id === activePeriodId);
  if (!period) return null;

  const lesson = lessons.find(l => l.periodId === activePeriodId) ?? null;

  return {
    inPeriod: true,
    period,
    lesson,
    isLunch: isLunchPeriod(period.id) && !lesson,
    progress: getPeriodProgress(period),
  };
}

function getNextPeriod(periods) {
  const nowMinutes = getNowMinutes();
  return periods.find(period => toMinutes(period.start) > nowMinutes) ?? null;
}

function getPeriodProgress(period) {
  const nowMinutes   = getNowMinutes();
  const startMinutes = toMinutes(period.start);
  const endMinutes   = toMinutes(period.end);

  if (nowMinutes < startMinutes || nowMinutes >= endMinutes) return null;

  const totalMinutes   = endMinutes - startMinutes;
  const elapsedMinutes = nowMinutes - startMinutes;
  const percentage     = Math.max(0, Math.min(100, Math.round((elapsedMinutes / totalMinutes) * 100)));

  return { totalMinutes, elapsedMinutes, percentage };
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return (hours * 60) + minutes;
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
