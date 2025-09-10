const PUPPET_HIERARCHY = [
    ["main_droite", "avant_bras_droite"], ["avant_bras_droite", "haut_bras_droite"],
    ["main_gauche", "avant_bras_gauche"], ["avant_bras_gauche", "haut_bras_gauche"],
    ["pied_droite", "tibia_droite"], ["tibia_droite", "cuisse_droite"],
    ["pied_gauche", "tibia_gauche"], ["tibia_gauche", "cuisse_gauche"]
];

const TORSO_PARTS = {
    before: ['jambe_gauche', 'jambe_droite'],
    after: ['tete', 'bras_gauche', 'bras_droite']
};

const PUPPET_JOINTS = [
    ['avant_bras_gauche', 'coude_gauche', 'main_gauche'],
    ['haut_bras_gauche', 'epaule_gauche', 'coude_gauche'],
    ['main_gauche', 'poignet_gauche', 'main_gauche'],
    ['avant_bras_droite', 'coude_droite', 'main_droite'],
    ['haut_bras_droite', 'epaule_droite', 'coude_droite'],
    ['main_droite', 'poignet_droite', 'main_droite'],
    ['tibia_gauche', 'genou_gauche', 'pied_gauche'],
    ['cuisse_gauche', 'hanche_gauche', 'genou_gauche'],
    ['pied_gauche', 'cheville_gauche', 'pied_gauche'],
    ['tibia_droite', 'genou_droite', 'pied_droite'],
    ['cuisse_droite', 'hanche_droite', 'genou_droite'],
    ['pied_droite', 'cheville_droite', 'pied_droite'],
    ['tete', 'cou', 'tete']
];

function setupPuppetStructure(doc) {
    // Setup hierarchy
    PUPPET_HIERARCHY.forEach(([childId, parentId]) => {
        const child = doc.getElementById(childId);
        const parent = doc.getElementById(parentId);
        if (!child || !parent || child.parentNode === parent) return;

        if (childId.startsWith('main_')) {
            parent.insertBefore(child, parent.firstChild);
        } else {
            parent.appendChild(child);
        }
    });

    // Setup torso order
    const torso = doc.getElementById('torse');
    if (!torso || !torso.parentNode) return;

    const parentNode = torso.parentNode;
    TORSO_PARTS.before.forEach(id => {
        const el = doc.getElementById(id);
        if (el) parentNode.insertBefore(el, torso);
    });
    TORSO_PARTS.after.forEach(id => {
        const el = doc.getElementById(id);
        if (el) parentNode.appendChild(el);
    });
}

export function resetPantin() {
    const obj = document.getElementById('pantin');
    const doc = obj && obj.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[id]').forEach(el => el.removeAttribute('transform'));
}

let offsetX = 0, offsetY = 0, scaleFactorScene = 1;
let wrapper = null;

function updateTransform() {
    if (!wrapper) return;
    wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleFactorScene})`;
    if (!wrapper.style.transformOrigin) wrapper.style.transformOrigin = '0 0';
}

// Animation recording / playback
let frames = [];
let recording = false;
let playbackTimer = null;
let playbackIndex = 0;
let playbackSpeed = 1; // multiplier

function snapshotTransforms(doc) {
    const out = {};
    doc.querySelectorAll('[id]').forEach(el => {
        const id = el.id;
        const t = el.getAttribute('transform');
        if (t) out[id] = t; else out[id] = null;
    });
    return out;
}

function applyTransformsToClone(cloneRoot, transforms) {
    Object.keys(transforms).forEach(id => {
        const el = cloneRoot.getElementById && cloneRoot.getElementById(id);
        if (!el) return;
        const t = transforms[id];
        if (t) el.setAttribute('transform', t);
        else el.removeAttribute('transform');
    });
}

function startRecordingIfNeeded(doc) {
    // Ensure at least frames exist by taking an initial snapshot
    if (!recording) {
        frames = [];
        recording = true;
        // take an initial snapshot
        frames.push(snapshotTransforms(doc));
        // then keep capturing at intervals while user interacts
        recording = false; // don't run continuous interval; snapshots are pushed on transform change
    }
}

export function initPantin(file) {
    const container = document.getElementById('pantin-container');
    wrapper = container.querySelector('#pantin-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'pantin-wrapper';
        wrapper.className = 'pantin-wrapper';
        container.appendChild(wrapper);
    } else {
        wrapper.innerHTML = '';
    }

    let pantinObj = wrapper.querySelector('#pantin');
    if (pantinObj) wrapper.removeChild(pantinObj);

    pantinObj = document.createElement('object');
    pantinObj.id = 'pantin';
    pantinObj.className = 'pantin-object';
    pantinObj.type = 'image/svg+xml';
    pantinObj.data = file ? URL.createObjectURL(file) : './assets/manufutur.svg';
    wrapper.appendChild(pantinObj);
    updateTransform();

    pantinObj.addEventListener('load', () => {
        const doc = pantinObj.contentDocument;
        if (!doc) return;
        const root = doc.documentElement;

        setupPuppetStructure(doc);

        const centerToScreen = (el) => {
            const b = el.getBBox();
            const pt = root.createSVGPoint();
            pt.x = b.x + b.width / 2;
            pt.y = b.y + b.height / 2;
            return pt.matrixTransform(el.getScreenCTM());
        };

        const preCssPoint = (e) => {
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left - offsetX) / scaleFactorScene + rect.left;
            const y = (e.clientY - rect.top - offsetY) / scaleFactorScene + rect.top;
            const pt = root.createSVGPoint();
            pt.x = x; pt.y = y;
            return pt;
        };

        let active = false, seg = null, pivot = null, start = 0, base = '', inv = null;

        const rotate = e => {
            const loc = preCssPoint(e).matrixTransform(inv);
            const ang = Math.atan2(loc.y - pivot.y, loc.x - pivot.x);
            const d = (ang - start) * 180 / Math.PI;
            seg.setAttribute('transform', `${base} rotate(${d.toFixed(1)},${pivot.x.toFixed(1)},${pivot.y.toFixed(1)})`);
            // push a snapshot of transforms for recording
            // throttle a bit by pushing only last snapshot if different
            const snap = snapshotTransforms(doc);
            frames.push(snap);
        };

        doc.addEventListener('mousedown', e => {
            const t = e.target && e.target.closest && e.target.closest('[id]');
            if (!t) return;
            const triplet = PUPPET_JOINTS.find(j => { const el = doc.getElementById(j[0]); return el && el.contains(t); });
            if (!triplet) return;
            const [segId, pivotId, endId] = triplet;
            const segEl = doc.getElementById(segId);
            const pivotEl = doc.getElementById(pivotId);
            const endEl = doc.getElementById(endId);
            if (!segEl || !pivotEl || !endEl) return;
            inv = segEl.getScreenCTM().inverse();
            const pScr = centerToScreen(pivotEl);
            const eScr = centerToScreen(endEl);
            const pLoc = root.createSVGPoint(); pLoc.x = pScr.x; pLoc.y = pScr.y;
            const eLoc = root.createSVGPoint(); eLoc.x = eScr.x; eLoc.y = eScr.y;
            const p = pLoc.matrixTransform(inv);
            const ed = eLoc.matrixTransform(inv);
            seg = segEl;
            pivot = p;
            start = Math.atan2(ed.y - p.y, ed.x - p.x);
            base = (seg.getAttribute('transform') || '').replace(/rotate\([^)]*\)/, '').trim();
            active = true;
            // record initial state
            frames.push(snapshotTransforms(doc));
            e.preventDefault();
        });

        doc.addEventListener('mousemove', e => { if (active) rotate(e); });
        ['mouseup', 'mouseleave'].forEach(evt => doc.addEventListener(evt, () => active = false));

        let draggingScene = false;
        let startX = 0, startY = 0;
        container.addEventListener('mousedown', e => {
            if (e.target !== container) return;
            draggingScene = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
        });
        container.addEventListener('mousemove', e => {
            if (!draggingScene) return;
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            updateTransform();
        });
        ['mouseup', 'mouseleave'].forEach(evt => container.addEventListener(evt, () => draggingScene = false));

        // expose controls on window
        window.resetPantin = resetPantin;
        window.play = play;
        window.pause = pause;
        window.setSpeed = setSpeed;
        window.setZoom = setZoom;
        window.exportAnimation = exportAnimation;

        // initialize first snapshot
        frames = [snapshotTransforms(doc)];
    });
}

export function zoomPantin(factor) {
    scaleFactorScene *= factor;
    updateTransform();
}

// Playback controls
function play() {
    if (!playbackTimer && frames.length > 0) {
        const fps = 25 * playbackSpeed;
        const delay = 1000 / fps;
        playbackIndex = 0;
        const obj = document.getElementById('pantin');
        const doc = obj && obj.contentDocument;
        if (!doc) return;
        const root = doc.documentElement;
        playbackTimer = setInterval(() => {
            if (playbackIndex >= frames.length) {
                clearInterval(playbackTimer);
                playbackTimer = null;
                return;
            }
            const trans = frames[playbackIndex];
            Object.keys(trans).forEach(id => {
                const el = doc.getElementById(id);
                if (!el) return;
                const t = trans[id];
                if (t) el.setAttribute('transform', t);
                else el.removeAttribute('transform');
            });
            playbackIndex++;
        }, delay);
    }
}

function pause() {
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
}

function setSpeed(value) {
    playbackSpeed = value;
    // restart playback if running to apply new speed
    if (playbackTimer) {
        pause();
        play();
    }
}

function setZoom(value) {
    scaleFactorScene = value;
    updateTransform();
}

// Export animation by rendering frames to an offscreen canvas and recording via MediaRecorder
async function exportAnimation() {
    const obj = document.getElementById('pantin');
    const doc = obj && obj.contentDocument;
    if (!doc || frames.length === 0) {
        alert('No animation frames available to export. Interact with the puppet to create frames.');
        return;
    }

    // create a clone of the SVG for rendering
    const root = doc.documentElement;
    const bbox = root.getBBox();
    const width = Math.ceil(bbox.width || 500);
    const height = Math.ceil(bbox.height || 550);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(25);
    const recChunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) recChunks.push(ev.data); };

    recorder.start();

    const fps = 25 * playbackSpeed;
    const delay = 1000 / fps;

    for (let i = 0; i < frames.length; i++) {
        ctx.clearRect(0, 0, width, height);
        const clone = root.cloneNode(true);
        // apply transforms
        applyTransformsToClone({ getElementById: (id) => clone.querySelector('#' + id) }, frames[i]);
        // serialize
        const svgStr = new XMLSerializer().serializeToString(clone);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        await drawImageToCanvas(url, ctx, width, height);
        URL.revokeObjectURL(url);
        await wait(delay);
    }

    // stop recorder
    recorder.stop();

    const blob = await new Promise(resolve => recorder.onstop = () => resolve(new Blob(recChunks, { type: 'video/webm' })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'puppet-animation.webm';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function drawImageToCanvas(url, ctx, w, h) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve();
        };
        img.onerror = reject;
        img.src = url;
    });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
