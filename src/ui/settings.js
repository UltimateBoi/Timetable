import { store } from '../store.js';
import { formatDate, getLessonsForDate, getCurrentPeriodId, isLunchPeriod } from '../timetable.js';
import { updateLiveActivityData } from '../liveActivity.js';
import { renderDayView } from './dayView.js';

export function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', () => openSettings());
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('cancel-settings').addEventListener('click', closeSettings);
  document.getElementById('settings-form').addEventListener('submit', onSave);
  document.getElementById('year-group').addEventListener('change', onYearGroupChange);

  document.getElementById('debug-live-start')?.addEventListener('click', onLiveActivityTest);
  document.getElementById('debug-live-end')?.addEventListener('click', onLiveActivityEnd);
  document.getElementById('debug-live-log')?.addEventListener('click', onLiveActivityLog);

  // Auto-open on first visit (no week start date configured)
  if (!store.getSettings().weekStartDate) {
    setTimeout(() => openSettings(true), 300);
  }
}

function openSettings(firstTime = false) {
  const s = store.getSettings();

  // Week 1 start date — default to the most recent Monday
  const weekInput = document.getElementById('week-start-date');
  if (s.weekStartDate) {
    weekInput.value = s.weekStartDate;
  } else {
    const today = new Date();
    const diff  = today.getDay() === 0 ? -6 : 1 - today.getDay();
    const mon   = new Date(today);
    mon.setDate(today.getDate() + diff);
    weekInput.value = formatDate(mon);
  }

  // Year group
  document.getElementById('year-group').value = s.yearGroup ?? 12;

  // Lunch period (shown only for 6th form)
  const lunchEl = document.getElementById('lunch-period');
  if (lunchEl) lunchEl.value = s.lunchPeriodId ?? 'p6a';

  onYearGroupChange();

  // Period times
  renderPeriodTimes(s.periods);

  document.getElementById('settings-modal').hidden = false;

  if (firstTime) weekInput.focus();
}

function onYearGroupChange() {
  const yg  = parseInt(document.getElementById('year-group').value, 10);
  const sec = document.getElementById('sixth-form-settings');
  if (sec) sec.hidden = !(yg === 12 || yg === 13);
}

function renderPeriodTimes(periods) {
  const container = document.getElementById('period-times-container');
  container.innerHTML = periods.map(p => `
    <div class="period-row${p.isBreak ? ' period-row--break' : ''}${p.isExtra ? ' period-row--extra' : ''}">
      <span class="period-row-label">${p.label}${p.isBreak ? ' ☕' : ''}${p.isExtra ? ' *' : ''}</span>
      <input type="time" class="period-start" data-id="${p.id}" value="${p.start}" required>
      <span class="period-sep">to</span>
      <input type="time" class="period-end"  data-id="${p.id}" value="${p.end}"   required>
    </div>
  `).join('') + `<p class="help-text" style="margin-top:.5rem">* Period 8 is only shown when a lesson is assigned to it.</p>`;
}

function onSave(e) {
  e.preventDefault();

  const weekStartDate = document.getElementById('week-start-date').value;
  const yearGroup     = parseInt(document.getElementById('year-group').value, 10);
  const lunchEl       = document.getElementById('lunch-period');
  const lunchPeriodId = lunchEl ? lunchEl.value : 'p6a';

  // Collect updated start/end times for each period (flags stay unchanged)
  const periods = store.getSettings().periods.map(p => {
    const startEl = document.querySelector(`.period-start[data-id="${p.id}"]`);
    const endEl   = document.querySelector(`.period-end[data-id="${p.id}"]`);
    return {
      ...p,
      start: startEl ? startEl.value : p.start,
      end:   endEl   ? endEl.value   : p.end,
    };
  });

  store.updateSettings({ weekStartDate, yearGroup, lunchPeriodId, periods });
  closeSettings();
  renderDayView();
}

function closeSettings() {
  document.getElementById('settings-modal').hidden = true;
}

// ── Live Activity debug helpers (temporary) ────────────────────────────────

async function onLiveActivityTest() {
  const status = computeCurrentStatusForNow() ?? buildSyntheticStatus();
  try {
    await updateLiveActivityData(status);
    setDebugStatus(`Sent test state: ${describeStatus(status)}`);
  } catch (e) {
    console.error('[live-activity] test send failed', e);
    setDebugStatus('Failed to send test live activity — see console.');
  }
}

async function onLiveActivityEnd() {
  try {
    await updateLiveActivityData(null);
    setDebugStatus('Requested live activity end.');
  } catch (e) {
    console.error('[live-activity] end failed', e);
    setDebugStatus('Failed to end live activity — see console.');
  }
}

function onLiveActivityLog() {
  const status = computeCurrentStatusForNow();
  console.log('[live-activity] current status', status);
  setDebugStatus(status ? `Current status logged: ${describeStatus(status)}` : 'No current status (likely weekend or unconfigured).');
}

function computeCurrentStatusForNow() {
  const { periods } = store.getSettings();
  const { lessons } = getLessonsForDate(new Date());
  const activePeriodId = getCurrentPeriodId();
  return buildStatus(periods, lessons, activePeriodId);
}

function buildSyntheticStatus() {
  const now = new Date();
  const start = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const endDate = new Date(now.getTime() + 45 * 60_000);
  const end = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
  const period = { id: 'debug', label: 'Debug Period', start, end, isBreak: false, isExtra: false };
  return {
    inPeriod: true,
    period,
    lesson: { subject: 'Live Activity Test', room: 'DBG', teacher: 'BOT' },
    isLunch: false,
    progress: getPeriodProgress(period),
  };
}

function buildStatus(periods, lessons, activePeriodId) {
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

function describeStatus(status) {
  if (!status) return 'none';
  if (!status.inPeriod) return 'no active period';
  return `${status.period.label} · ${status.period.start}-${status.period.end} (${status.lesson?.subject ?? (status.isLunch ? 'Lunch' : 'Free')})`;
}

function setDebugStatus(text) {
  const el = document.getElementById('debug-live-status');
  if (el) el.textContent = text;
}
