// Пересечения товаров: повёрнутые прямоугольники на полу (SAT) + перекрытие по высоте (шкаф над раковиной — не пересечение)
import { footprint } from './snapping.js';

const EPS = 0.004; // касание вплотную пересечением не считаем

function project(pts, axis) {
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { const v = p.x * axis.x + p.z * axis.z; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return [lo, hi];
}

export function overlaps(a, da, b, db) {
  const ya = [(da.elevation || 0) / 1000, ((da.elevation || 0) + da.height) / 1000];
  const yb = [(db.elevation || 0) / 1000, ((db.elevation || 0) + db.height) / 1000];
  if (ya[1] <= yb[0] + EPS || yb[1] <= ya[0] + EPS) return false;
  const fa = footprint(a, da), fb = footprint(b, db);
  for (const axis of [fa.ax, fa.az, fb.ax, fb.az]) {
    const [a0, a1] = project(fa.pts, axis), [b0, b1] = project(fb.pts, axis);
    if (a1 <= b0 + EPS || b1 <= a0 + EPS) return false;
  }
  return true;
}

// uid всех товаров, которые с кем-то пересекаются
export function collisions(items, dimsOf) {
  const bad = new Set();
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++)
    if (overlaps(items[i], dimsOf(items[i]), items[j], dimsOf(items[j]))) { bad.add(items[i].uid); bad.add(items[j].uid); }
  return bad;
}
