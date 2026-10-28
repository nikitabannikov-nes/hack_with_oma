// Текстуры отделки: фото выбранной плитки или ламината (img/tex/<id>.jpg, tools/build-3d-textures.py),
// а пока фото грузится или если его нет — рисунок по цвету. Краска — ровный цвет с лёгкой фактурой.
// Повтор считается в метрах: UV пола — координаты в метрах, у стен — задаётся под длину и высоту куска.
import * as THREE from 'three';

const canvases = new Map();   // ключ вида → { canvas, textures: Set }
const listeners = new Set();
export const onTexturesChange = fn => listeners.add(fn);

function shade(hex, k) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); }

// Плитка — один квадрат со швом сверху и слева; ламинат — два ряда досок со сдвигом на полдоски
function drawPattern(g, look, img) {
  const x = g.getContext('2d');
  if (look.kind === 'plank') {
    g.width = 1024; g.height = 256;
    const rowH = 128;
    // доска на фото: волокна «v» — вертикально, поворачиваем вдоль доски
    const plank = (dx, dy, flip, tone) => {
      x.save(); x.translate(dx, dy);
      if (img) {
        if (look.grain === 'v') { x.translate(1024, 0); x.rotate(Math.PI / 2); if (flip) { x.translate(rowH, 0); x.scale(-1, 1); } x.drawImage(img, 0, 0, rowH, 1024); }
        else { if (flip) { x.translate(1024, 0); x.scale(-1, 1); } x.drawImage(img, 0, 0, 1024, rowH); }
      } else {
        x.fillStyle = shade(look.color, tone); x.fillRect(0, 0, 1024, rowH);
        x.strokeStyle = 'rgba(0,0,0,.07)';
        for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(0, 12 + k * 19); x.bezierCurveTo(340, 6 + k * 19, 680, 22 + k * 19, 1024, 12 + k * 19); x.stroke(); }
      }
      x.restore();
    };
    plank(0, 0, false, 0);
    plank(-512, rowH, true, -0.03);
    plank(512, rowH, true, -0.03);
    x.fillStyle = 'rgba(0,0,0,.28)';
    x.fillRect(0, 0, 2, rowH); x.fillRect(512, rowH, 2, rowH);   // торцевые стыки
    x.fillRect(0, rowH - 1, 1024, 2); x.fillRect(0, 2 * rowH - 1, 1024, 2);   // продольные
  } else if (look.kind === 'tile') {
    g.width = g.height = 512;
    if (img) {
      // плитка на фото стоит поперёк — поворачиваем
      const [a, b] = look.size || [1, 1], turn = Math.abs(img.width - img.height) > Math.min(img.width, img.height) * 0.2 && (img.width > img.height) !== (a > b);
      if (turn) { x.save(); x.translate(512, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0, 512, 512); x.restore(); }
      else x.drawImage(img, 0, 0, 512, 512);
    } else {
      x.fillStyle = look.color; x.fillRect(0, 0, 512, 512);
      const grd = x.createLinearGradient(0, 0, 512, 512);
      grd.addColorStop(0, 'rgba(255,255,255,.10)'); grd.addColorStop(1, 'rgba(0,0,0,.05)');
      x.fillStyle = grd; x.fillRect(0, 0, 512, 512);
    }
    x.fillStyle = 'rgba(205,200,190,.95)'; x.fillRect(0, 0, 512, 5); x.fillRect(0, 0, 5, 512);   // затирка
  } else {
    g.width = g.height = 64;
    x.fillStyle = look.color; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${(i * 7919) % 2 ? '0,0,0' : '255,255,255'},.025)`; x.fillRect((i * 37) % 64, (i * 53) % 64, 2, 2); }
  }
}

function entry(look) {
  const key = JSON.stringify(look);
  let e = canvases.get(key);
  if (e) return e;
  e = { canvas: document.createElement('canvas'), textures: new Set() };
  drawPattern(e.canvas, look, null);
  canvases.set(key, e);
  if (look.tex) {
    const img = new Image();
    img.onload = () => {
      drawPattern(e.canvas, look, img);
      e.textures.forEach(t => { t.needsUpdate = true; });
      listeners.forEach(fn => fn());
    };
    img.src = look.tex;   // фото с нашего сайта — WebGL его примет
  }
  return e;
}

// look: {kind:'tile'|'plank'|'paint'|'bare', color, size:[a,b] в метрах, tex?: url фото, grain?: 'h'|'v'}
export function finishTexture(look, uLen = 1, vLen = 1) {
  const e = entry(look);
  const t = new THREE.CanvasTexture(e.canvas);
  e.textures.add(t);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const [a, b] = look.size || [1, 1];
  if (look.kind === 'plank') { const L = Math.max(a, b), W = Math.min(a, b); t.repeat.set(uLen / L, vLen / (2 * W)); }
  else if (look.kind === 'tile') t.repeat.set(uLen / a, vLen / b);
  else t.repeat.set(uLen / 0.5, vLen / 0.5);
  t.addEventListener('dispose', () => e.textures.delete(t));
  return t;
}

export const BARE_FLOOR = { kind: 'bare', color: '#cfcac1' };
export const BARE_WALL = { kind: 'bare', color: '#e7e4de' };
