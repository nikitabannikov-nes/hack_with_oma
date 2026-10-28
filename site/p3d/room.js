// Квартира в 3D: у каждой комнаты пол с отделкой и стены с отделкой, двери и окна вырезаны в стенах.
// Стена = облицовка внутри комнаты (её отделка) + несущая часть снаружи. Если за стеной соседняя комната,
// несущей части нет — у соседки своя облицовка. Стены, за которыми стоит камера, становятся прозрачными.
import * as THREE from 'three';
import { walls, pointInPoly } from './snapping.js';
import { finishTexture, BARE_FLOOR, BARE_WALL } from './textures.js';

const T = 0.12;       // толщина наружной стены, м
export const LINING = 0.012; // толщина облицовки внутри комнаты, м

// Куски стены вокруг проёмов: [u0,u1] вдоль стены, [y0,y1] по высоте
function pieces(len, H, ops) {
  const out = [], push = (u0, u1, y0, y1) => { if (u1 - u0 > 0.002 && y1 - y0 > 0.002) out.push({ u0, u1, y0, y1 }); };
  let cur = 0;
  for (const o of [...ops].sort((a, b) => a.off - b.off)) {
    const a = Math.max(cur, o.off), b = Math.min(len, o.off + o.w);
    if (b <= a) continue;
    push(cur, a, 0, H);
    push(a, b, 0, Math.min(H, o.sill || 0));
    push(a, b, Math.min(H, (o.sill || 0) + o.h), H);
    cur = b;
  }
  push(cur, len, 0, H);
  return out;
}

function wallMesh(w, p, thick, inward, mat) {
  const len = p.u1 - p.u0, hh = p.y1 - p.y0, mid = (p.u0 + p.u1) / 2, s = inward ? 1 : -1;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, hh, thick), mat);
  m.position.set(w.a.x + w.t.x * mid + s * w.n.x * thick / 2, p.y0 + hh / 2, w.a.z + w.t.z * mid + s * w.n.z * thick / 2);
  m.rotation.y = -Math.atan2(w.t.z, w.t.x);
  m.castShadow = !inward; m.receiveShadow = true;
  return m;
}

function material(look, len, hh, u0, y0) {
  const map = finishTexture(look, len, hh), [a, b] = look.size || [0.5, 0.5];
  if (look.kind === 'tile') map.offset.set(u0 / a, y0 / b);   // швы плитки совпадают на соседних кусках стены
  return new THREE.MeshStandardMaterial({ map, roughness: look.kind === 'tile' ? 0.35 : 0.9, transparent: true, opacity: 1 });
}

/**
 * rooms: [{ id, polygon:{x,z}[], height, floor: look|null, walls: [{ look, h }], openings: [{ wall, kind, off, w, h, sill }] }]
 */
// cut — высота среза стен (вид «кукольный домик» для всей квартиры), null — стены в полную высоту
export function buildApartment(rooms, { cut = null } = {}) {
  const group = new THREE.Group(), fading = [];
  // срез стены — тёмная полоса сверху, как разрез на чертеже: видно, что это не потолок
  const capMat = new THREE.MeshBasicMaterial({ color: 0x3c4654, transparent: true, opacity: 1 });
  const capped = (w, p, thick, inward) => { const m = wallMesh(w, { ...p, y0: p.y1, y1: p.y1 + 0.006 }, thick + 0.002, inward, capMat); m.castShadow = false; return m; };   // fading: { meshes, w } — гасим, если камера снаружи стены
  for (const r of rooms) {
    const poly = r.polygon, H = cut ? Math.min(cut, r.height) : r.height;
    // пол по контуру; UV пола — координаты в метрах, так что рисунок плитки в реальном масштабе
    const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p.x, -p.z)));
    const fg = new THREE.ShapeGeometry(shape); fg.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: finishTexture(r.floor || BARE_FLOOR, 1, 1), roughness: 0.75 }));
    floor.receiveShadow = true; floor.userData.room = r.id;
    group.add(floor);

    const W = walls(poly);
    W.forEach((w, i) => {
      const spec = r.walls[i] || {}, look = spec.look || BARE_WALL, wh = Math.min(H, spec.h || H);
      const ops = r.openings.filter(o => o.wall === i);
      const meshes = [];
      // облицовка: своя отделка внутри комнаты
      for (const p of pieces(w.len, wh, ops)) {
        meshes.push(wallMesh(w, p, LINING, true, material(look, p.u1 - p.u0, p.y1 - p.y0, p.u0, p.y0)));
        if (cut && p.y1 >= H - 1e-6) meshes.push(capped(w, p, LINING, true));
      }
      if (wh < H) meshes.push(wallMesh(w, { u0: 0, u1: w.len, y0: wh, y1: H }, LINING, true, material(BARE_WALL, w.len, H - wh, 0, wh)));
      // несущая часть — только у наружных стен (за стеной нет другой комнаты)
      const mid = { x: w.a.x + w.t.x * w.len / 2 - w.n.x * 0.06, z: w.a.z + w.t.z * w.len / 2 - w.n.z * 0.06 };
      const shared = rooms.some(o => o !== r && pointInPoly(mid, o.polygon));
      if (!shared) {
        const prev = W[(i - 1 + W.length) % W.length], next = W[(i + 1) % W.length];
        const extA = prev.t.x * w.n.x + prev.t.z * w.n.z < 0 ? T : 0, extB = next.t.x * w.n.x + next.t.z * w.n.z > 0 ? T : 0;
        const body = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: 0.95, transparent: true, opacity: 1 });
        const ps = pieces(w.len, H, ops);
        ps.forEach(p => {
          const q = { ...p };
          if (p.u0 < 0.001) q.u0 -= extA;
          if (p.u1 > w.len - 0.001) q.u1 += extB;
          meshes.push(wallMesh(w, q, T, false, body));
          if (cut && q.y1 >= H - 1e-6) meshes.push(capped(w, q, T, false));
        });
      }
      // окна: стекло в проёме
      for (const o of ops.filter(o => o.kind === 'window')) {
        const gm = new THREE.MeshStandardMaterial({ color: 0xbfe0f5, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
        const gl = wallMesh(w, { u0: o.off, u1: o.off + o.w, y0: o.sill || 0, y1: Math.min(H, (o.sill || 0) + o.h) }, 0.02, false, gm);
        gl.castShadow = false; meshes.push(gl);
      }
      meshes.forEach(m => group.add(m));
      fading.push({ meshes, w });
    });
    // контур пола — видно границу комнаты даже за прозрачной стеной
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(poly.map(p => new THREE.Vector3(p.x, 0.004, p.z))), new THREE.LineBasicMaterial({ color: 0x005ead }));
    group.add(line);
  }

  // Стены между камерой и комнатой (камера с наружной стороны) почти прозрачные; сверху всё видно и так
  function updateWalls(camera, topView) {
    const c = camera.position;
    for (const { meshes, w } of fading) {
      const outside = !topView && (c.x - w.a.x) * w.n.x + (c.z - w.a.z) * w.n.z < 0;
      for (const m of meshes) {
        const base = m.userData.base ?? (m.userData.base = m.material.opacity);
        const op = outside ? Math.min(base, 0.08) : base;
        if (m.material.opacity !== op) { m.material.opacity = op; m.material.depthWrite = op >= 1; }
      }
    }
  }
  return { group, updateWalls };
}
