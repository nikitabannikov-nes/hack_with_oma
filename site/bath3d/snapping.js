// Геометрия комнаты на плоскости пола (x, z в метрах): контур, удержание товара внутри стен, сетка, прилипание к стене
export const GRID = 0.05;        // шаг сетки, м
export const WALL_SNAP = 0.15;   // ближе этого к стене — товар прилипает
const GAP = 0.003;               // зазор между товаром и стеной, чтобы не мерцали грани

export const snapToGrid = v => Math.round(v / GRID) * GRID;

// Габарит товара на полу с учётом поворота: ширина вдоль локальной X, глубина вдоль локальной Z; задняя сторона — локальная −Z
export function footprint(it, dims) {
  const w = dims.width / 1000, d = dims.depth / 1000, c = Math.cos(it.rot), s = Math.sin(it.rot);
  const ax = { x: c, z: -s }, az = { x: s, z: c };   // локальные оси X и Z в мировых координатах (поворот вокруг Y)
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({
    x: it.x + ax.x * i * w / 2 + az.x * j * d / 2,
    z: it.z + ax.z * i * w / 2 + az.z * j * d / 2,
  }));
  return { pts, ax, az, hw: w / 2, hd: d / 2 };
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function segCross(p1, p2, q1, q2) {
  const d = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const d1 = d(q1, q2, p1), d2 = d(q1, q2, p2), d3 = d(p1, p2, q1), d4 = d(p1, p2, q2);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

// Прямоугольник целиком внутри многоугольника: все углы внутри и ни одна стена его не пересекает (важно для Г-образных комнат)
export function fitsRoom(fp, poly) {
  const eps = 1e-4, P = fp.pts;
  const shrunk = P.map(p => ({ x: p.x + (fp.pts[0].x + fp.pts[2].x - 2 * p.x) * eps, z: p.z + (fp.pts[0].z + fp.pts[2].z - 2 * p.z) * eps }));
  if (!shrunk.every(p => pointInPoly(p, poly))) return false;
  for (let i = 0; i < 4; i++) for (let j = 0; j < poly.length; j++)
    if (segCross(shrunk[i], shrunk[(i + 1) % 4], poly[j], poly[(j + 1) % poly.length])) return false;
  return true;
}

export function bbox(poly) {
  const xs = poly.map(p => p.x), zs = poly.map(p => p.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

// Стены с внутренней нормалью (контур может идти в любую сторону)
export function walls(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.z - b.x * a.z; }
  const sgn = s > 0 ? 1 : -1;
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length], len = Math.hypot(b.x - a.x, b.z - a.z), t = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    return { a, b, len, t, n: { x: -t.z * sgn, z: t.x * sgn } };
  });
}

// Ближайшая стена к точке: расстояние и положение вдоль стены
export function nearestWall(p, poly) {
  let best = null;
  for (const w of walls(poly)) {
    const u = Math.max(0, Math.min(w.len, (p.x - w.a.x) * w.t.x + (p.z - w.a.z) * w.t.z));
    const q = { x: w.a.x + w.t.x * u, z: w.a.z + w.t.z * u }, dist = Math.hypot(p.x - q.x, p.z - q.z);
    if (!best || dist < best.dist) best = { w, u, dist };
  }
  return best;
}

/**
 * Новое положение товара при перетаскивании в точку want.
 * Порядок: сетка → прилипание к стене (для настенных — всегда) → рамки комнаты → проверка контура.
 * Если товар в точке не помещается, скользит вдоль одной оси, иначе остаётся на прежнем месте.
 */
export function place(it, dims, want, poly, { grid = true, snapWall = true } = {}) {
  let next = { ...it, x: grid ? snapToGrid(want.x) : want.x, z: grid ? snapToGrid(want.z) : want.z, wall: null };
  const fp0 = footprint(next, dims);

  if (snapWall) {
    // расстояние до стены считаем от ближайшего края товара, а не от центра
    const nw = nearestWall(next, poly);
    const backGap = nw ? nw.dist - Math.min(fp0.hd, fp0.hw) : Infinity;
    if (nw && (dims.wallMounted || backGap < WALL_SNAP)) {
      const { w } = nw, hw = dims.width / 2000, hd = dims.depth / 2000;
      let u = grid ? snapToGrid(nw.u) : nw.u;
      u = w.len >= 2 * hw ? Math.max(hw, Math.min(w.len - hw, u)) : w.len / 2;
      const cand = { ...next, rot: Math.atan2(w.n.x, w.n.z), wall: poly.indexOf(w.a),
        x: w.a.x + w.t.x * u + w.n.x * (hd + GAP), z: w.a.z + w.t.z * u + w.n.z * (hd + GAP) };
      if (fitsRoom(footprint(cand, dims), poly)) return cand;
    }
  }

  // прямоугольная комната: точно прижимаем к рамкам; для сложного контура — первое приближение
  const b = bbox(poly), fp = footprint(next, dims);
  const ex = Math.max(...fp.pts.map(p => Math.abs(p.x - next.x))), ez = Math.max(...fp.pts.map(p => Math.abs(p.z - next.z)));
  next.x = Math.min(b.x1 - ex - GAP, Math.max(b.x0 + ex + GAP, next.x));
  next.z = Math.min(b.z1 - ez - GAP, Math.max(b.z0 + ez + GAP, next.z));
  if (fitsRoom(footprint(next, dims), poly)) return next;

  for (const cand of [{ ...next, z: it.z }, { ...next, x: it.x }, { ...it }])
    if (fitsRoom(footprint(cand, dims), poly)) return { ...cand, wall: cand === it ? it.wall : null };
  return { ...it };
}

// Свободное место для нового товара: сначала вдоль стен (сантехника обычно у стены), потом по сетке от центра
export function freeSpot(dims, poly, rot = 0, isFree = () => true) {
  const b = bbox(poly), c = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
  const along = [];
  for (const w of walls(poly)) for (let u = 0; u <= w.len; u += 0.1)
    along.push({ x: w.a.x + w.t.x * u + w.n.x * 0.05, z: w.a.z + w.t.z * u + w.n.z * 0.05, wall: true });
  const inner = [c];
  for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) inner.push({ x: b.x0 + (b.x1 - b.x0) * i / 12, z: b.z0 + (b.z1 - b.z0) * j / 12 });
  inner.sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z));
  let fallback = null;
  for (const p of [...along, ...inner]) {
    const it = place({ x: p.x, z: p.z, rot }, dims, p, poly, { snapWall: p.wall || dims.wallMounted });
    if (!fitsRoom(footprint(it, dims), poly)) continue;
    if (isFree(it)) return it;
    fallback = fallback || it;
  }
  return fallback || { x: c.x, z: c.z, rot };
}
