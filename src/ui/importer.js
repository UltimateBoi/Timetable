import { store } from '../store.js';
import { renderDayView } from './dayView.js';

// ── Valid values for validation ───────────────────────────────────────────────
const VALID_PERIOD_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6a', 'p6b', 'p7', 'p8'];
const VALID_DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri'];

// ── The prompt users give to their external AI ────────────────────────────────
export const AI_PROMPT =
`TASK: Convert my school timetable into a specific JSON format. Read all instructions carefully before responding.

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!! OUTPUT FORMAT — THIS IS THE MOST IMPORTANT RULE                      !!
!! Your ENTIRE response must be ONLY the raw JSON object.               !!
!! The very first character of your response MUST be {                  !!
!! The very last character of your response MUST be }                   !!
!! Do NOT write any words, sentences, or explanations.                  !!
!! Do NOT use markdown. Do NOT use backticks. Do NOT use code fences.   !!
!! Do NOT write "Here is the JSON" or anything similar.                 !!
!! ONLY output the JSON — nothing before it, nothing after it.          !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

─── PERIOD IDs and their times ───────────────────────────────────
  "p1"  →  Period 1:   08:45 – 09:20
  "p2"  →  Period 2:   09:20 – 10:10
  "p3"  →  Period 3:   10:10 – 11:00
  *** BREAK 11:00–11:20 — SKIP this, do NOT include it ***
  "p4"  →  Period 4:   11:20 – 12:10
  "p5"  →  Period 5:   12:10 – 13:00
  "p6a" →  Period 6a:  13:00 – 13:45
  "p6b" →  Period 6b:  13:45 – 14:30
  "p7"  →  Period 7:   14:30 – 15:20
  "p8"  →  Period 8:   15:20 – 16:20  (only if a lesson actually appears here)

─── Day keys ─────────────────────────────────────────────────────
  Monday → "mon", Tuesday → "tue", Wednesday → "wed", Thursday → "thu", Friday → "fri"

─── Rules ────────────────────────────────────────────────────────
  1. Only include a period entry when there is a real lesson in that slot.
     Omit free periods — do NOT add placeholder or empty lesson objects.
  2. Skip the break (11:00–11:20) and any lunch-only slots entirely.
  3. "subject" — use exactly what is written on the timetable (abbreviations are fine, e.g. "Bu", "Cm", "Mu").
  4. "teacher" — initials in UPPERCASE (e.g. "RG", "SMC", "AH"). Use "" if unknown.
  5. "room" — the room code as shown (e.g. "FT13", "MH09"). Use "" if unknown.
  6. "notes" — use "" unless there is a specific annotation.
  7. Both "week1" and "week2" keys MUST always be present. Days with no lessons use an empty array [].
  8. Use ONLY the exact day keys and period IDs listed above.

─── Exact JSON structure to fill in ──────────────────────────────
{
  "week1": {
    "mon": [
      { "periodId": "p1", "subject": "Bu", "room": "FT13", "teacher": "RG", "notes": "" }
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

REMINDER: Output ONLY the JSON object above, populated with the timetable data I provide. No markdown, no backticks, no extra words — just the raw JSON starting with { and ending with }.`;

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

  // Robustly extract the JSON object — find the first { and last }
  // This handles AI responses that add markdown fences or explanatory text
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    errorEl.textContent = '⚠️ No JSON object found — make sure the AI\'s response contains a { … } block.';
    return;
  }
  const cleaned = raw.slice(start, end + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    errorEl.textContent = '⚠️ Invalid JSON — the AI\'s response could not be parsed. Try regenerating.';
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

  // Count imported lessons for success feedback
  const totalLessons = ['week1', 'week2'].reduce((sum, wk) =>
    sum + ['mon','tue','wed','thu','fri'].reduce((s, dk) =>
      s + (parsed[wk]?.[dk]?.length ?? 0), 0), 0);

  const { weekStartDate } = store.getSettings();
  const needsSetup = !weekStartDate;

  const msg = needsSetup
    ? `✅ Imported ${totalLessons} lesson${totalLessons !== 1 ? 's' : ''} successfully!\n\n⚠️ Your timetable won't show yet — open Settings to set your Week 1 start date so the app knows which week is which.`
    : `✅ Imported ${totalLessons} lesson${totalLessons !== 1 ? 's' : ''} successfully!`;

  alert(msg);
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
