import { initPantin, addKeyframe, getFramesCount, getFrame, applyTransformsToDoc, getElementIds } from './pantin.js';

let selectedElement = null;
let isRecording = false;
let recordingTimer = null;

function $(id){return document.getElementById(id)}

window.addEventListener('DOMContentLoaded', () => {
  initPantin();

  // Pantin loaded callback
  window.onPantinLoaded = (ids) => {
    populateLayers(ids);
    updateFramesUI();
  };

  // File import
  $('file-input').addEventListener('change', (e) => { const file = e.target.files[0]; if (file) initPantin(file); });

  // Add keyframe
  $('add-keyframe-btn').addEventListener('click', () => {
    const idx = addKeyframe();
    updateFramesUI();
    if (idx >= 0) { $('scrubber').value = idx; $('scrubber').dispatchEvent(new Event('input')); }
  });
  $('add-frame-btn').addEventListener('click', () => { const idx = addKeyframe(); updateFramesUI(); if (idx >= 0) { $('scrubber').value = idx; $('scrubber').dispatchEvent(new Event('input')); } });

  // Record toggle (continuous)
  $('record-btn').addEventListener('click', (e) => {
    isRecording = !isRecording;
    if (isRecording) {
      e.target.classList.add('primary');
      e.target.textContent = 'Recording...';
      // start continuous keyframe capture every 180ms
      recordingTimer = setInterval(()=>{ addKeyframe(); updateFramesUI(); }, 180);
    } else {
      e.target.classList.remove('primary');
      e.target.textContent = 'Record';
      clearInterval(recordingTimer); recordingTimer = null;
    }
  });

  // Play/pause
  $('play-pause-main').addEventListener('click', (e) => {
    if (e.target.textContent === 'Play') { if (window.play) { window.play(); e.target.textContent = 'Pause'; } }
    else { if (window.pause) { window.pause(); e.target.textContent = 'Play'; } }
  });

  // Export
  $('export-btn').addEventListener('click', () => { if (window.exportAnimation) window.exportAnimation(); });

  // Speed
  $('speed-range').addEventListener('input', (e) => { if (window.setSpeed) window.setSpeed(parseFloat(e.target.value)); });

  // Scrubber
  $('scrubber').addEventListener('input', (e) => {
    const idx = parseInt(e.target.value, 10);
    const frame = getFrame(idx);
    if (frame) applyTransformsToDoc(frame);
    highlightFrameMarker(idx);
  });

  // Step controls
  $('step-back').addEventListener('click', ()=>{ const s=$('scrubber'); s.value = Math.max(0, parseInt(s.value||0,10)-1); s.dispatchEvent(new Event('input')); });
  $('step-forward').addEventListener('click', ()=>{ const s=$('scrubber'); const max = parseInt(s.max||0,10); s.value = Math.min(max, parseInt(s.value||0,10)+1); s.dispatchEvent(new Event('input')); });

  // Inspector actions
  $('apply-transform').addEventListener('click', () => {
    if (!selectedElement) return;
    const v = $('inspector-transform').value.trim();
    const obj = document.getElementById('pantin');
    const doc = obj && obj.contentDocument;
    if (!doc) return;
    const el = doc.getElementById(selectedElement);
    if (!el) return;
    if (v) el.setAttribute('transform', v);
    else el.removeAttribute('transform');
  });
  $('reset-transform').addEventListener('click', () => {
    if (!selectedElement) return;
    const obj = document.getElementById('pantin'); const doc = obj && obj.contentDocument; if (!doc) return;
    const el = doc.getElementById(selectedElement); if (!el) return; el.removeAttribute('transform'); $('inspector-transform').value = '';
  });

  // Basic new project
  $('new-btn').addEventListener('click', () => { location.reload(); });

  // keyboard shortcuts: Space = play/pause, R = record
  window.addEventListener('keydown', (ev)=>{
    if (ev.code === 'Space') { ev.preventDefault(); $('play-pause-main').click(); }
    if (ev.key.toLowerCase() === 'r') { ev.preventDefault(); $('record-btn').click(); }
  });
});

function populateLayers(ids){
  const container = $('layers-list'); container.innerHTML = '';
  ids.forEach(id => {
    const row = document.createElement('div'); row.className = 'layer-item';
    const left = document.createElement('div'); left.style.display = 'flex'; left.style.alignItems = 'center'; left.style.gap='10px';
    const name = document.createElement('div'); name.textContent = id; name.style.cursor='pointer'; name.className='layer-name';
    name.addEventListener('click', () => selectElement(id));
    left.appendChild(name);

    const controls = document.createElement('div'); controls.className='layer-controls';
    const vis = document.createElement('input'); vis.type='checkbox'; vis.checked=true; vis.title='Visible';
    vis.addEventListener('change', (e)=>{ toggleVisibility(id, e.target.checked); });
    const lock = document.createElement('input'); lock.type='checkbox'; lock.title='Lock';
    lock.addEventListener('change', (e)=>{ toggleLock(id, e.target.checked); });
    controls.appendChild(vis); controls.appendChild(lock);

    row.appendChild(left); row.appendChild(controls); container.appendChild(row);
  });
}

function toggleVisibility(id, visible){
  const obj = document.getElementById('pantin'); const doc = obj && obj.contentDocument; if (!doc) return; const el = doc.getElementById(id); if (!el) return; el.style.display = visible ? '' : 'none';
}
function toggleLock(id, locked){
  const obj = document.getElementById('pantin'); const doc = obj && obj.contentDocument; if (!doc) return; const el = doc.getElementById(id); if (!el) return; el.style.pointerEvents = locked ? 'none' : '';
}

function selectElement(id){ selectedElement = id; $('inspector-id').value = id; const obj = document.getElementById('pantin'); const doc = obj && obj.contentDocument; if (!doc) return; const el = doc.getElementById(id); if (!el) return; const t = el.getAttribute('transform'); $('inspector-transform').value = t ? t : ''; }

function updateFramesUI(){
  const count = getFramesCount(); $('frames-count').textContent = count;
  const scrub = $('scrubber'); scrub.max = Math.max(0, count - 1);
  scrub.value = Math.min(scrub.value || 0, Math.max(0, count - 1));
  renderFrameMarkers(count);
}

function renderFrameMarkers(count){
  const container = $('frame-markers'); container.innerHTML = '';
  for(let i=0;i<count;i++){ const dot = document.createElement('div'); dot.className='frame-dot'; dot.title = `Frame ${i}`; dot.dataset.index = i; dot.addEventListener('click', ()=>{ $('scrubber').value = i; $('scrubber').dispatchEvent(new Event('input')); }); container.appendChild(dot); }
  highlightFrameMarker(parseInt($('scrubber').value||0,10));
}

function highlightFrameMarker(i){ const dots = document.querySelectorAll('.frame-dot'); dots.forEach(d=>d.classList.toggle('active', parseInt(d.dataset.index,10)===i)); }
