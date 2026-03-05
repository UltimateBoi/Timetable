import { store } from './store.js';
import { initDayView } from './ui/dayView.js';
import { initEditor, openEditLesson } from './ui/editor.js';
import { initSettings } from './ui/settings.js';
import { initImporter } from './ui/importer.js';
import './style.css';

// Boot
store.init();
initDayView();
initEditor();
initSettings();
initImporter();

// Wire lesson-card taps → editor (keeps dayView ↔ editor dep one-directional)
document.getElementById('lessons-container').addEventListener('click', e => {
  const card = e.target.closest('.lesson-card[data-lesson-id]');
  if (card) openEditLesson(card.dataset.lessonId);
});

// Bottom-nav active state
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
