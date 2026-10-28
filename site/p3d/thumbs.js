// Картинки для карточек каталога: если фото товара нет — рисуем его заглушку в маленьком отдельном рендере
import * as THREE from 'three';
import { placeholder } from './placeholders.js';

export function renderThumbs(products, size = 200) {
  const out = {}, need = products.filter(p => !p.photo);
  if (!need.length) return out;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size * 0.75, false); r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bb, 2.2));
  const l = new THREE.DirectionalLight(0xffffff, 1.4); l.position.set(2, 3, 4); scene.add(l);
  const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.01, 50);
  for (const p of need) {
    const obj = placeholder(p); scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const dist = Math.max(s.x, s.y * 1.25, s.z) * 2.3;
    cam.position.set(c.x + dist * 0.55, c.y + dist * 0.45, c.z + dist * 0.8); cam.lookAt(c);
    r.render(scene, cam);
    out[p.id] = r.domElement.toDataURL('image/png');
    scene.remove(obj); obj.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  r.dispose(); r.forceContextLoss();
  return out;
}
