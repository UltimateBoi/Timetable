import { store, DAY_KEYS, DAY_NAMES } from '../store.js';
import { getCurrentWeek, getDayKey, formatDate } from '../timetable.js';
import { renderDayView, getCurrentDisplayDate } from './dayView.js';

// State: what are we currently editing?
let editing = null; // { type: 'recurring'|'extra', lesson, week?, dayKey? }

export function initEditor() {
  document.getElementById('nav-edit').addEventListener('click', () => openAddLesson());
  document.getElementById('close-editor').addEventListener('click', closeEditor);
  document.getElementById('cancel-editor').addEventListener('click', closeEditor);
  document.getElementById('lesson-type').addEventListener('change', onTypeChange);
  document.getElementById('lesson-form').addEventListener('submit', onSubmit);
  document.getElementById('delete-lesson').addEventListener('click', onDelete);
}

/** Open the editor in "add new" mode, pre-filling week/day from current view. */
export function openAddLesson() {
  editing = null;
  const date   = getCurrentDisplayDate();
  const week   = getCurrentWeek(date);
  const dayKey = getDayKey(date);

  resetForm();
  document.getElementById('editor-title').textContent = 'Add Lesson';
  document.getElementById('delete-lesson').hidden = true;

  if (week)   document.getElementById('lesson-week').value = week;
  if (dayKey) document.getElementById('lesson-day').value  = dayKey;

  onTypeChange();
  document.getElementById('editor-modal').hidden = false;
}

/** Open the editor in "edit" mode for an existing lesson or extra. */
export function openEditLesson(lessonId) {
  // Search extras first
  const extra = store.getExtras().find(e => e.id === lessonId);
  if (extra) {
    editing = { type: 'extra', lesson: extra };
    resetForm();
    document.getElementById('editor-title').textContent = 'Edit Extra';
    document.getElementById('delete-lesson').hidden = false;
    document.getElementById('lesson-type').value = 'extra';
    fillForm(extra, 'extra');
    onTypeChange();
    document.getElementById('editor-modal').hidden = false;
    return;
  }

  // Search recurring timetable
  const found = store.findLessonById(lessonId);
  if (found) {
    editing = { type: 'recurring', lesson: found.lesson, week: found.week, dayKey: found.dayKey };
    resetForm();
    document.getElementById('editor-title').textContent = 'Edit Lesson';
    document.getElementById('delete-lesson').hidden = false;
    document.getElementById('lesson-type').value = 'recurring';
    fillForm(found.lesson, 'recurring', found.week, found.dayKey);
    onTypeChange();
    document.getElementById('editor-modal').hidden = false;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resetForm() {
  document.getElementById('lesson-form').reset();
  document.getElementById('edit-lesson-id').value = '';

  // Populate period dropdown from store (excludes break)
  const periods = store.getSettings().periods.filter(p => !p.isBreak);
  document.getElementById('lesson-period').innerHTML =
    periods.map(p => `<option value="${p.id}">${p.label} (${p.start}–${p.end})</option>`).join('');

  // Populate day dropdown
  document.getElementById('lesson-day').innerHTML =
    DAY_KEYS.map((k, i) => `<option value="${k}">${DAY_NAMES[i]}</option>`).join('');
}

function fillForm(lesson, type, week = null, dayKey = null) {
  document.getElementById('edit-lesson-id').value  = lesson.id;
  document.getElementById('lesson-period').value   = lesson.periodId ?? '';
  document.getElementById('lesson-subject').value  = lesson.subject  ?? '';
  document.getElementById('lesson-room').value     = lesson.room     ?? '';
  document.getElementById('lesson-teacher').value  = lesson.teacher  ?? '';
  document.getElementById('lesson-notes').value    = lesson.notes    ?? '';

  if (type === 'extra') {
    document.getElementById('extra-date').value = lesson.date ?? '';
  } else {
    if (week)   document.getElementById('lesson-week').value = week;
    if (dayKey) document.getElementById('lesson-day').value  = dayKey;
  }
}

function onTypeChange() {
  const isExtra = document.getElementById('lesson-type').value === 'extra';
  document.getElementById('recurring-fields').hidden = isExtra;
  document.getElementById('extra-fields').hidden     = !isExtra;
  document.getElementById('extra-date').required     = isExtra;
}

function onSubmit(e) {
  e.preventDefault();

  const type    = document.getElementById('lesson-type').value;
  const payload = {
    periodId: document.getElementById('lesson-period').value,
    subject:  document.getElementById('lesson-subject').value.trim(),
    room:     document.getElementById('lesson-room').value.trim(),
    // Force teacher initials to uppercase (e.g. rg → RG, smc → SMC)
    teacher:  document.getElementById('lesson-teacher').value.trim().toUpperCase(),
    notes:    document.getElementById('lesson-notes').value.trim(),
  };

  if (type === 'extra') {
    payload.date = document.getElementById('extra-date').value;

    if (editing?.type === 'extra') {
      store.updateExtra(editing.lesson.id, payload);
    } else {
      store.addExtra(payload);
    }
  } else {
    const weekVal = document.getElementById('lesson-week').value;
    const dayKey  = document.getElementById('lesson-day').value;

    if (editing?.type === 'recurring') {
      store.updateLesson(editing.week, editing.dayKey, editing.lesson.id, payload);
    } else {
      if (weekVal === 'both') {
        store.addLesson(1, dayKey, payload);
        store.addLesson(2, dayKey, payload);
      } else {
        store.addLesson(parseInt(weekVal), dayKey, payload);
      }
    }
  }

  closeEditor();
  renderDayView();
}

function onDelete() {
  if (!editing) return;
  if (!confirm('Delete this lesson?')) return;

  if (editing.type === 'extra') {
    store.deleteExtra(editing.lesson.id);
  } else {
    store.deleteLesson(editing.week, editing.dayKey, editing.lesson.id);
  }

  closeEditor();
  renderDayView();
}

function closeEditor() {
  document.getElementById('editor-modal').hidden = true;
  editing = null;
}
