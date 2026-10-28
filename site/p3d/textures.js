// Текстуры отделки из «внешнего вида» материала (matLook в core.js): плитка со швами, доска ламината, краска.
// Повтор считается в метрах: UV пола — координаты в метрах, у стен — задаётся под длину и высоту куска.
import * as THREE from 'three';

const cache = new Map();

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return '#' + c.getHexString();
}

// Холст одного модуля рисунка: плитка — один квадрат со швом, ламинат — две ряда досок со сдвигом
function draw(look) {
  const g = document.createElement('canvas'), x = g.getContext('2d');
  if (look.kind === 'plank') {
    g.width = 512; g.height = 128;
    for (let row = 0; row < 2; row++) {
      const y = row * 64, off = row ? 256 : 0;
      for (let i = -1; i < 2; i++) {
        const x0 = off + i * 512;
        x.fillStyle = shade(look.color, ((i + row * 3) % 3 - 1) * 0.025); x.fillRect(x0, y, 512, 64);
        x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1;
        for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(x0, y + 8 + k * 9 + (k % 2) * 3); x.bezierCurveTo(x0 + 170, y + 4 + k * 9, x0 + 340, y + 14 + k * 9, x0 + 512, y + 8 + k * 9); x.stroke(); }
        x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(x0, y, 2, 64);
      }
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y + 63, 512, 1);
    }
  } else if (look.kind === 'tile') {
    g.width = g.height = 256;
    x.fillStyle = look.color; x.fillRect(0, 0, 256, 256);
    const grd = x.createLinearGradient(0, 0, 256, 256);
    grd.addColorStop(0, 'rgba(255,255,255,.10)'); grd.addColorStop(1, 'rgba(0,0,0,.05)');
    x.fillStyle = grd; x.fillRect(0, 0, 256, 256);
    x.fillStyle = look.grout || '#d9d6cf'; x.fillRect(0, 0, 256, 4); x.fillRect(0, 0, 4, 256);
  } else {
    g.width = g.height = 64;
    x.fillStyle = look.color; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},.025)`; x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  }
  return g;
}

// look: {kind:'tile'|'plank'|'paint'|'bare', color, size:[a,b] в метрах}
export function finishTexture(look, uLen = 1, vLen = 1) {
  const key = JSON.stringify(look);
  if (!cache.has(key)) cache.set(key, draw(look));
  const t = new THREE.CanvasTexture(cache.get(key));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const [a, b] = look.size || [1, 1];
  if (look.kind === 'plank') { const L = Math.max(a, b), W = Math.min(a, b); t.repeat.set(uLen / L, vLen / (2 * W)); }
  else if (look.kind === 'tile') t.repeat.set(uLen / a, vLen / b);
  else t.repeat.set(uLen / 0.5, vLen / 0.5);
  return t;
}

export const BARE_FLOOR = { kind: 'bare', color: '#cfcac1' };
export const BARE_WALL = { kind: 'bare', color: '#e7e4de' };
