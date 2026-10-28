// Заглушки товаров без 3D-модели: простая геометрия под категорию, строго по габаритам из каталога.
// Начало координат — центр низа; перёд товара смотрит в +Z, задняя сторона (к стене) — в −Z. 1 единица = 1 метр.
import * as THREE from 'three';

const M = {
  ceramic: () => new THREE.MeshStandardMaterial({ color: 0xf6f7f9, roughness: 0.22, metalness: 0.02 }),
  inner: () => new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.3 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0xe8e1d4, roughness: 0.75 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xc8cdd4, roughness: 0.22, metalness: 0.85 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0xbfe1f7, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false }),
  mirror: () => new THREE.MeshStandardMaterial({ color: 0xcfe2ee, roughness: 0.08, metalness: 0.25, emissive: 0x9fb8c8, emissiveIntensity: 0.25 }),
};

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

function roundedRect(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// Вытягиваем фигуру вверх: плоскость XY фигуры ложится на пол XZ
function extrudeUp(shape, h, y0 = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}

function bath(w, d, h) {
  const g = new THREE.Group(), r = Math.min(0.14, d * 0.22), wall = Math.min(0.07, w * 0.05);
  const shell = roundedRect(w, d, r);
  shell.holes.push(roundedRect(w - 2 * wall, d - 2 * wall, Math.max(0.02, r - wall)));
  g.add(mesh(extrudeUp(shell, h), M.ceramic()));
  g.add(mesh(extrudeUp(roundedRect(w - 2 * wall + 0.002, d - 2 * wall + 0.002, Math.max(0.02, r - wall)), h * 0.35), M.inner()));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12), M.chrome(), -w / 2 + wall + 0.12, h + 0.05, -d / 2 + wall / 2)); // смеситель на борту
  return g;
}

function toilet(w, d, h) {
  const g = new THREE.Group(), cer = M.ceramic();
  const bowl = mesh(new THREE.CylinderGeometry(0.5, 0.36, 1, 28), cer, 0, h * 0.21, d * 0.1);
  bowl.scale.set(w, h * 0.42, d * 0.8);
  const seat = mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 28), M.ceramic(), 0, h * 0.435, d * 0.1);
  seat.scale.set(w * 1.02, 0.03, d * 0.8);
  g.add(bowl, seat, box(w * 0.92, h * 0.52, d * 0.2, cer, 0, h * 0.74, -d * 0.4));
  g.add(box(w * 0.18, 0.015, 0.05, M.chrome(), 0, h + 0.008, -d * 0.4)); // кнопка слива
  return g;
}

function sink(w, d, h) {
  const g = new THREE.Group(), top = 0.06;
  g.add(box(w - 0.01, h - top, d - 0.02, M.wood(), 0, (h - top) / 2, -0.01));
  g.add(box(0.004, h - top - 0.12, 0.004, M.dark(), 0, (h - top) / 2 + 0.03, d / 2 - 0.018)); // шов между дверцами
  for (const sx of [-1, 1]) g.add(box(0.012, 0.12, 0.02, M.chrome(), sx * 0.04, h - top - 0.12, d / 2 - 0.01));
  g.add(box(w, top, d, M.ceramic(), 0, h - top / 2, 0));
  const basin = mesh(new THREE.CircleGeometry(0.5, 32), M.inner(), 0, h + 0.002, d * 0.06);
  basin.rotation.x = -Math.PI / 2; basin.scale.set(w * 0.62, d * 0.62, 1);
  g.add(basin, mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.16, 12), M.chrome(), 0, h + 0.08, -d / 2 + 0.06));
  return g;
}

function shower(w, d, h) {
  const g = new THREE.Group(), tray = Math.min(0.14, h * 0.08), t = 0.008, gh = h - tray;
  g.add(box(w, tray, d, M.ceramic(), 0, tray / 2, 0));
  g.add(box(w - 0.02, gh, t, M.glass(), 0, tray + gh / 2, d / 2 - t));   // стекло спереди
  g.add(box(t, gh, d - 0.02, M.glass(), w / 2 - t, tray + gh / 2, 0));   // стекло сбоку
  g.add(box(0.025, gh, 0.025, M.chrome(), w / 2 - 0.012, tray + gh / 2, d / 2 - 0.012));
  g.add(box(0.02, h * 0.9 - tray, 0.02, M.chrome(), -w / 2 + 0.08, tray + (h * 0.9 - tray) / 2, -d / 2 + 0.03));
  const head = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 24), M.chrome(), -w / 2 + 0.08, h * 0.9, -d / 2 + 0.12);
  g.add(head);
  return g;
}

function cabinet(w, d, h, mirror) {
  const g = new THREE.Group();
  g.add(box(w, h, d - 0.01, M.wood(), 0, h / 2, -0.005));
  if (mirror) g.add(box(w - 0.02, h - 0.02, 0.006, M.mirror(), 0, h / 2, d / 2 - 0.004));
  else {
    g.add(box(w - 0.04, 0.004, 0.004, M.dark(), 0, h * 0.6, d / 2 - 0.008));
    g.add(box(0.012, 0.14, 0.02, M.chrome(), w / 2 - 0.05, h * 0.62, d / 2));
  }
  return g;
}

export function placeholder(product) {
  const { width, depth, height } = product.dimensions, w = width / 1000, d = depth / 1000, h = height / 1000;
  switch (product.category) {
    case 'bath': return bath(w, d, h);
    case 'toilet': return toilet(w, d, h);
    case 'sink': return sink(w, d, h);
    case 'shower': return shower(w, d, h);
    case 'cabinet': return cabinet(w, d, h, product.wallMounted);
    default: return cabinet(w, d, h, false);
  }
}
