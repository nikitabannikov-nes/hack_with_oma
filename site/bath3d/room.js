// Комната: пол по контуру с сеткой, стены снаружи контура. Стены, за которыми стоит камера, становятся прозрачными.
import * as THREE from 'three';
import { walls } from './snapping.js';

const T = 0.1; // толщина стены, м

// Текстура сетки: квадрат 0,5 м, линии каждые 10 см, по краю — линия каждые 50 см
function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 250;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, 250, 250);
  g.strokeStyle = 'rgba(0,40,90,.10)'; g.lineWidth = 1;
  for (let i = 50; i < 250; i += 50) { g.beginPath(); g.moveTo(i + .5, 0); g.lineTo(i + .5, 250); g.moveTo(0, i + .5); g.lineTo(250, i + .5); g.stroke(); }
  g.strokeStyle = 'rgba(0,60,140,.28)'; g.lineWidth = 2; g.strokeRect(0, 0, 250, 250);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRoom(room) {
  const group = new THREE.Group(), poly = room.polygon, h = room.height;
  const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p.x, -p.z)));
  const floorGeo = new THREE.ShapeGeometry(shape); floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.9 }));
  floor.receiveShadow = true; floor.name = 'floor';
  group.add(floor);

  const W = walls(poly), wallMeshes = [];
  W.forEach((w, i) => {
    // у выпуклых углов продлеваем стену на толщину, чтобы угол снаружи был закрыт; у внутренних — нет
    const prev = W[(i - 1 + W.length) % W.length], next = W[(i + 1) % W.length];
    const extA = prev.t.x * w.n.x + prev.t.z * w.n.z < 0 ? T : 0;   // предыдущая стена «уходит» от комнаты — угол выпуклый
    const extB = next.t.x * w.n.x + next.t.z * w.n.z > 0 ? T : 0;
    const len = w.len + extA + extB, mid = (w.len + extB - extA) / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.95, transparent: true, opacity: 1 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, T), mat);
    m.position.set(w.a.x + w.t.x * mid - w.n.x * T / 2, h / 2, w.a.z + w.t.z * mid - w.n.z * T / 2);
    m.rotation.y = -Math.atan2(w.t.z, w.t.x);
    m.receiveShadow = true;
    m.userData.wall = w;
    // тонкий плинтус-полоса по низу стены — видно границу пола даже у прозрачной стены
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w.len, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x005ead }));
    edge.position.set(w.a.x + w.t.x * w.len / 2 + w.n.x * 0.006, 0.006, w.a.z + w.t.z * w.len / 2 + w.n.z * 0.006);
    edge.rotation.y = m.rotation.y;
    group.add(m, edge);
    wallMeshes.push(m);
  });

  // Стена между камерой и комнатой (камера снаружи по нормали) становится почти прозрачной
  function updateWalls(camera, topView) {
    for (const m of wallMeshes) {
      const w = m.userData.wall, c = camera.position;
      const outside = (c.x - w.a.x) * w.n.x + (c.z - w.a.z) * w.n.z < 0;
      const op = topView ? 1 : outside ? 0.1 : 1;
      if (m.material.opacity !== op) { m.material.opacity = op; m.material.depthWrite = op === 1; }
      m.material.color.setHex(topView ? 0x6b7a8c : 0xf4f4f2);   // сверху стены — тёмная рамка, как на чертеже
    }
  }
  return { group, floor, updateWalls };
}
