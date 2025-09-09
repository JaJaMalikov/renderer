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

export function initPantin(file) {
    const container = document.getElementById('pantin-container');
    wrapper = container.querySelector('#pantin-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'pantin-wrapper';
        wrapper.style.position = 'absolute';
        wrapper.style.left = '0';
        wrapper.style.top = '0';
        wrapper.style.transformOrigin = '0 0';
        container.appendChild(wrapper);
    } else {
        wrapper.innerHTML = '';
    }

    let pantinObj = wrapper.querySelector('#pantin');
    if (pantinObj) wrapper.removeChild(pantinObj);

    pantinObj = document.createElement('object');
    pantinObj.id = 'pantin';
    pantinObj.type = 'image/svg+xml';
    pantinObj.data = file ? URL.createObjectURL(file) : './assets/manufutur.svg';
    pantinObj.style.cssText = 'max-width:500px;min-height:550px;display:block;';
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
    });
}

export function zoomPantin(factor) {
    scaleFactorScene *= factor;
    updateTransform();
}