import { initPantin } from './pantin.js';

window.addEventListener('DOMContentLoaded', () => {
  initPantin();

  document.getElementById('reset-btn').addEventListener('click', () => { if (window.resetPantin) window.resetPantin(); });
  document.getElementById('export-btn').addEventListener('click', () => { if (window.exportAnimation) window.exportAnimation(); });
  document.getElementById('play-pause-btn').addEventListener('click', (e) => {
    if (e.target.textContent === 'Play') {
      if (window.play) { window.play(); e.target.textContent = 'Pause'; }
    }
    else { if (window.pause) { window.pause(); e.target.textContent = 'Play'; } }
  });
  document.getElementById('speed-range').addEventListener('input', (e) => { if (window.setSpeed) window.setSpeed(parseFloat(e.target.value)); });
  document.getElementById('zoom-range').addEventListener('input', (e) => { if (window.setZoom) window.setZoom(parseFloat(e.target.value)); });
  document.getElementById('bg-color-btn').addEventListener('click', () => {
    const hue = Math.floor(Math.random() * 360);
    document.getElementById('pantin-container').style.background = `hsl(${hue}, 100%, 90%)`;
  });
  document.getElementById('grid-btn').addEventListener('click', () => {
    const grid = document.getElementById('grid-overlay');
    grid.style.display = grid.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) initPantin(file);
  });
});
