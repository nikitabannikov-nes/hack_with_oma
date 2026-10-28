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
  fabric: c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }),
  oak: () => new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.7 }),
  white: () => new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.4 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0xb9bec5, roughness: 0.35, metalness: 0.6 }),
  screen: () => new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.15, metalness: 0.3 }),
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

// --- Мебель и техника

function sofa(w, d, h, color = 0x8c9aa8) {
  const g = new THREE.Group(), f = M.fabric(color), seat = Math.min(0.45, h * 0.55), arm = Math.min(0.2, w * 0.12);
  g.add(box(w, seat * 0.55, d, f, 0, seat * 0.275, 0));                                   // основание
  g.add(box(w - 2 * arm, seat * 0.45, d * 0.72, M.fabric(new THREE.Color(color).offsetHSL(0, 0, .06)), 0, seat * 0.775, d * 0.12)); // подушки
  g.add(box(w, h - seat * 0.55, d * 0.24, f, 0, seat * 0.55 + (h - seat * 0.55) / 2, -d * 0.38)); // спинка
  for (const sx of [-1, 1]) g.add(box(arm, seat * 1.35, d, f, sx * (w / 2 - arm / 2), seat * 0.675, 0)); // подлокотники
  return g;
}

function bed(w, d, h) {
  const g = new THREE.Group(), frame = M.oak(), base = Math.min(0.32, h * 0.3);
  g.add(box(w, base, d, frame, 0, base / 2, 0));
  g.add(box(w - 0.06, 0.2, d - 0.12, M.white(), 0, base + 0.1, 0.03));                     // матрас
  g.add(box(w - 0.06, 0.06, d * 0.6, M.fabric(0x9bb0c4), 0, base + 0.23, d * 0.17));      // одеяло
  const pw = Math.min(0.62, (w - 0.2) / 2);
  for (const sx of (w > 1.2 ? [-1, 1] : [0])) g.add(box(pw, 0.12, 0.38, M.white(), sx * (pw / 2 + 0.04), base + 0.26, -d / 2 + 0.3));
  g.add(box(w, h, 0.08, M.fabric(0x6f7d8c), 0, h / 2, -d / 2 + 0.04));                     // изголовье
  return g;
}

function table(w, d, h, mat = M.oak()) {
  const g = new THREE.Group(), top = 0.035, leg = 0.05;
  g.add(box(w, top, d, mat, 0, h - top / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(leg, h - top, leg, M.dark(), sx * (w / 2 - leg), (h - top) / 2, sz * (d / 2 - leg)));
  return g;
}

function chair(w, d, h) {
  const g = new THREE.Group(), seat = Math.min(0.46, h * 0.52), leg = 0.035, wood = M.oak();
  g.add(box(w, 0.04, d, wood, 0, seat, 0));
  g.add(box(w, h - seat, 0.04, wood, 0, seat + (h - seat) / 2, -d / 2 + 0.02));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(leg, seat, leg, M.dark(), sx * (w / 2 - leg), seat / 2, sz * (d / 2 - leg)));
  return g;
}

// Корпусная мебель: шкаф (дверцы), комод (ящики), стеллаж (полки)
function storage(w, d, h, kind) {
  const g = new THREE.Group(), body = M.wood();
  if (kind === 'shelf') {
    const t = 0.025;
    for (const sx of [-1, 1]) g.add(box(t, h, d, body, sx * (w / 2 - t / 2), h / 2, 0));
    const n = Math.max(2, Math.round(h / 0.38));
    for (let i = 0; i <= n; i++) g.add(box(w, t, d, body, 0, t / 2 + (h - t) * i / n, 0));
    g.add(box(w, h, 0.01, body, 0, h / 2, -d / 2 + 0.005));
    return g;
  }
  g.add(box(w, h, d - 0.01, body, 0, h / 2, -0.005));
  if (kind === 'drawers') {
    const n = Math.max(2, Math.round(h / 0.22));
    for (let i = 1; i < n; i++) g.add(box(w - 0.03, 0.005, 0.004, M.dark(), 0, h * i / n, d / 2 - 0.008));
    for (let i = 0; i < n; i++) g.add(box(Math.min(0.16, w * 0.3), 0.015, 0.02, M.chrome(), 0, h * (i + 0.5) / n, d / 2));
  } else {
    const doors = Math.max(1, Math.round(w / 0.5));
    for (let i = 1; i < doors; i++) g.add(box(0.005, h - 0.04, 0.004, M.dark(), -w / 2 + w * i / doors, h / 2, d / 2 - 0.008));
    for (let i = 0; i < doors; i++) g.add(box(0.015, Math.min(0.3, h * 0.2), 0.02, M.chrome(), -w / 2 + w * (i + (i % 2 ? 0.12 : 0.88)) / doors, h * 0.52, d / 2));
  }
  return g;
}

function tv(w, d, h) {
  const g = new THREE.Group();
  g.add(box(w, h, Math.min(d, 0.05), M.screen(), 0, h / 2, -d / 2 + 0.025));
  return g;
}

function fridge(w, d, h) {
  const g = new THREE.Group(), st = M.steel();
  g.add(box(w, h, d - 0.02, st, 0, h / 2, -0.01));
  g.add(box(w - 0.02, 0.006, 0.004, M.dark(), 0, h * 0.62, d / 2 - 0.008));
  for (const y of [h * 0.45, h * 0.8]) g.add(box(0.02, 0.28, 0.03, M.dark(), w / 2 - 0.06, y, d / 2 + 0.01));
  return g;
}

function stove(w, d, h) {
  const g = new THREE.Group();
  g.add(box(w, h - 0.01, d, M.white(), 0, (h - 0.01) / 2, 0));
  g.add(box(w, 0.01, d, M.screen(), 0, h - 0.005, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const b = mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.12, 0.006, 6, 24), M.dark(), sx * w * 0.22, h + 0.002, sz * d * 0.22);
    b.rotation.x = Math.PI / 2; g.add(b);
  }
  g.add(box(w * 0.8, h * 0.4, 0.01, M.screen(), 0, h * 0.4, d / 2 + 0.004));   // дверца духовки
  return g;
}

function washer(w, d, h) {
  const g = new THREE.Group();
  g.add(box(w, h, d, M.white(), 0, h / 2, 0));
  const door = mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.3, 0.02, 32), M.glass(), 0, h * 0.45, d / 2 + 0.01);
  door.rotation.x = Math.PI / 2;
  const ring = mesh(new THREE.TorusGeometry(w * 0.31, 0.018, 8, 32), M.steel(), 0, h * 0.45, d / 2 + 0.012);
  g.add(door, ring, box(w * 0.9, 0.08, 0.01, M.steel(), 0, h - 0.06, d / 2 + 0.004));
  return g;
}

// Кухонный гарнитур: тумбы со столешницей, мойка и навесные шкафы на высоте 1,45 м
function kitchen(w, d, h) {
  const g = new THREE.Group(), base = 0.86, top = 0.04, body = M.white();
  g.add(box(w, base - top, d - 0.04, body, 0, (base - top) / 2, -0.02));
  g.add(box(w, top, d, M.oak(), 0, base - top / 2, 0));
  const doors = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < doors; i++) g.add(box(0.005, base - top - 0.04, 0.004, M.dark(), -w / 2 + w * i / doors, (base - top) / 2, d / 2 - 0.04));
  const sink = mesh(new THREE.BoxGeometry(0.5, 0.005, 0.4), M.steel(), w / 2 - 0.45, base + 0.003, 0.02);
  g.add(sink, mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.25, 10), M.chrome(), w / 2 - 0.45, base + 0.125, -d / 2 + 0.07));
  if (h > 1.6) {
    const ud = Math.min(0.35, d * 0.55), y0 = 1.45;
    g.add(box(w, h - y0, ud, body, 0, y0 + (h - y0) / 2, -d / 2 + ud / 2));
    for (let i = 1; i < doors; i++) g.add(box(0.005, h - y0 - 0.04, 0.004, M.dark(), -w / 2 + w * i / doors, y0 + (h - y0) / 2, -d / 2 + ud + 0.002));
  }
  return g;
}

const BUILD = {
  bath, toilet, sink, shower,
  sofa: (w, d, h) => sofa(w, d, h), armchair: (w, d, h) => sofa(w, d, h, 0x7d6b5d), bed, chair, tv, fridge, stove, washer, kitchen,
  table: (w, d, h) => table(w, d, h), desk: (w, d, h) => table(w, d, h, M.white()),
  wardrobe: (w, d, h) => storage(w, d, h, 'doors'), dresser: (w, d, h) => storage(w, d, h, 'drawers'), shelf: (w, d, h) => storage(w, d, h, 'shelf'),
};

// shape — какую заглушку рисовать; по умолчанию совпадает с категорией
export function placeholder(product) {
  const { width, depth, height } = product.dimensions, w = width / 1000, d = depth / 1000, h = height / 1000;
  const kind = product.shape || product.category;
  if (kind === 'cabinet') return cabinet(w, d, h, product.wallMounted);
  return (BUILD[kind] || ((w, d, h) => storage(w, d, h, 'doors')))(w, d, h);
}
