import { store } from '../store.js';
import { renderDayView } from './dayView.js';

// ── Valid values for validation ───────────────────────────────────────────────
const VALID_PERIOD_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6a', 'p6b', 'p7', 'p8'];
const VALID_DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri'];

// ── The prompt users give to their external AI ────────────────────────────────
export const AI_PROMPT =
`You are helping me import my school timetable into a web app.
I will provide you with my 2-week timetable (as images, a photo, or text).
Return ONLY a JSON object in the exact format below — no explanation, no markdown, no code fences. Your entire response must start with { and end with }.

─── PERIOD IDs and their times ───────────────────────────────────
  "p1"  →  Period 1:   08:45 – 09:20
  "p2"  →  Period 2:   09:20 – 10:10
  "p3"  →  Period 3:   10:10 – 11:00
  *** BREAK 11:00–11:20 — do NOT include this in the JSON ***
  "p4"  →  Period 4:   11:20 – 12:10
  "p5"  →  Period 5:   12:10 – 13:00
  "p6a" →  Period 6a:  13:00 – 13:45
  "p6b" →  Period 6b:  13:45 – 14:30
  "p7"  →  Period 7:   14:30 – 15:20
  "p8"  →  Period 8:   15:20 – 16:20   (only include if a lesson actually appears in this slot)

─── Day keys ─────────────────────────────────────────────────────
  Monday → "mon", Tuesday → "tue", Wednesday → "wed", Thursday → "thu", Friday → "fri"

─── Rules ────────────────────────────────────────────────────────
  1. Only include a period if there is a real lesson in that slot.
     Omit free periods entirely — do not add empty lesson objects.
  2. Do NOT include the break (11:00–11:20) or any lunch-only slot in the JSON.
  3. "teacher" must be the teacher's initials in UPPERCASE only (e.g. "RG", "SMC", "AH").
     If the teacher is unknown, use "".
  4. "room" should be the room code shown on the timetable (e.g. "FT13", "MH09").
     If unknown, use "".
  5. "notes" should be "" unless there is a specific annotation on the timetable.
  6. Both "week1" and "week2" must always be present, even if one week has no lessons.
  7. Use exactly the day keys and period IDs listed above — no variations.

─── Required JSON format (fill in your timetable data) ───────────
{
  "week1": {
    "mon": [
      { "periodId": "p1", "subject": "Business Studies", "room": "FT13", "teacher": "RG", "notes": "" },
      { "periodId": "p3", "subject": "Maths",            "room": "MH09", "teacher": "SMC","notes": "" }
    ],
    "tue": [],
    "wed": [],
    "thu": [],
    "fri": []
  },
  "week2": {
    "mon": [],
    "tue": [],
    "wed": [],
    "thu": [],
    "fri": []
  }
}

IMPORTANT: Return ONLY the raw JSON shown above, filled with my timetable. No markdown, no backticks, no text before or after the JSON.`;

// ── Init ──────────────────────────────────────────────────────────────────────

export function initImporter() {
  document.getElementById('open-import-btn').addEventListener('click', openImporter);
  document.getElementById('close-import').addEventListener('click', closeImporter);
  document.getElementById('cancel-import').addEventListener('click', closeImporter);
  document.getElementById('copy-prompt-btn').addEventListener('click', copyPrompt);
  document.getElementById('import-form').addEventListener('submit', onImport);

  // Toggle prompt preview
  document.getElementById('toggle-prompt-preview').addEventListener('click', () => {
    const pre = document.getElementById('prompt-preview');
    const btn = document.getElementById('toggle-prompt-preview');
    const hidden = pre.hidden;
    pre.hidden = !hidden;
    btn.textContent = hidden ? 'Hide prompt ▲' : 'Show full prompt ▼';
  });
  // Pre-fill the preview textarea
  document.getElementById('prompt-preview').value = AI_PROMPT;
}

// ── Modal open / close ────────────────────────────────────────────────────────

function openImporter() {
  // Close settings first
  document.getElementById('settings-modal').hidden = true;
  document.getElementById('import-json').value     = '';
  document.getElementById('import-error').textContent = '';
  document.getElementById('copy-prompt-btn').textContent = 'Copy AI Prompt';
  document.getElementById('import-modal').hidden   = false;
}

function closeImporter() {
  document.getElementById('import-modal').hidden = true;
}

// ── Copy prompt to clipboard ──────────────────────────────────────────────────

async function copyPrompt() {
  const btn = document.getElementById('copy-prompt-btn');
  try {
    await navigator.clipboard.writeText(AI_PROMPT);
  } catch {
    // Fallback for non-HTTPS
    const ta = Object.assign(document.createElement('textarea'), {
      value: AI_PROMPT, style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy AI Prompt'; }, 2500);
}

// ── Import submit ─────────────────────────────────────────────────────────────

function onImport(e) {
  e.preventDefault();
  const errorEl = document.getElementById('import-error');
  errorEl.textContent = '';

  const raw = document.getElementById('import-json').value.trim();
  if (!raw) { errorEl.textContent = '⚠️ Please paste the JSON from your AI.'; return; }

  // Strip accidental markdown fences (```json … ```)
  const cleaned = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    errorEl.textContent = '⚠️ Invalid JSON — make sure you pasted only the AI\'s raw output.';
    return;
  }

  const errors = validate(parsed);
  if (errors.length) {
    errorEl.textContent = '⚠️ ' + errors.slice(0, 3).join('  •  ');
    return;
  }

  if (!confirm(
    'This will replace your entire 2-week timetable.\n' +
    'Your one-off extra lessons will be kept.\n\n' +
    'Continue?'
  )) return;

  store.importTimetable(parsed);
  closeImporter();
  renderDayView();
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(data) {
  const errors = [];

  if (typeof data !== 'object' || Array.isArray(data) || data === null) {
    return ['Top-level value must be a JSON object { … }.'];
  }

  for (const wk of ['week1', 'week2']) {
    if (!data[wk] || typeof data[wk] !== 'object') {
      errors.push(`Missing or invalid "${wk}" key.`);
      continue;
    }
    for (const dk of VALID_DAY_KEYS) {
      if (!Array.isArray(data[wk][dk])) {
        errors.push(`"${wk}.${dk}" must be an array (use [] if empty).`);
        continue;
      }
      for (const lesson of data[wk][dk]) {
        if (!lesson.periodId) {
          errors.push(`A lesson in ${wk}.${dk} is missing "periodId".`);
        } else if (!VALID_PERIOD_IDS.includes(lesson.periodId)) {
          errors.push(`Unknown periodId "${lesson.periodId}" in ${wk}.${dk}.`);
        }
        if (!lesson.subject || typeof lesson.subject !== 'string' || !lesson.subject.trim()) {
          errors.push(`A lesson in ${wk}.${dk} has an empty or missing "subject".`);
        }
      }
    }
  }

  return errors;
}
