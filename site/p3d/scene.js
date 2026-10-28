// Сцена: рендер, камеры (3D и вид сверху), свет, квартира, синхронизация товаров со store, перетаскивание по полу
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildApartment } from './room.js';
import { buildObject } from './normalizeModel.js';
import { bbox, place, pointInPoly } from './snapping.js';
import { collisions } from './collision.js';
import { onTexturesChange } from './textures.js';

const BLUE = 0x005ead, RED = 0xef2e23, LOW_WALLS = 1.1;   // высота среза стен, м

// Какие комнаты сейчас на сцене: вся квартира или одна выбранная
export const visibleRooms = s => {
  const one = s.focus !== 'all' && s.rooms.find(r => r.id === s.focus);
  return one ? [one] : s.rooms;
};

export function createScene(host, store, catalog) {
  const byId = id => catalog.find(p => p.id === id);
  const dimsOf = it => { const p = byId(it.id); return { ...p.dimensions, elevation: p.elevation || 0, wallMounted: !!p.wallMounted }; };
  const roomOf = it => store.get().rooms.find(r => r.id === it.room);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));   // слабым ноутбукам хватит
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none'; canvas.style.display = 'block';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2f6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c6, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);   // без теней: так план читается чище и быстрее на слабых ноутбуках
  scene.add(sun, sun.target);

  const persp = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 200);
  ortho.up.set(0, 0, -1);   // сверху: +X вправо, +Z вниз — как на 2D-плане

  // свои обработчики указателя вешаем ДО OrbitControls — тогда при захвате товара успеваем выключить вращение камеры
  const drag = { uid: null, off: null, moved: false, start: null };
  canvas.addEventListener('pointerdown', onDown);
  const orbit = new OrbitControls(persp, canvas);
  orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI / 2 - 0.05; orbit.minDistance = 0.8; orbit.maxDistance = 60;
  const top = new OrbitControls(ortho, canvas);
  top.enableRotate = false; top.screenSpacePanning = true; top.enabled = false;
  top.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  top.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  let apt = null, roomKey = '', view = '3d', dirty = true;
  const objs = new Map();   // uid → { group, frame, model, tint }
  const cam = () => view === 'top' ? ortho : persp;
  const controls = () => view === 'top' ? top : orbit;
  const invalidate = () => { dirty = true; };
  orbit.addEventListener('change', invalidate); top.addEventListener('change', invalidate);
  onTexturesChange(invalidate);   // догрузилось фото плитки или ламината — перерисовать

  function fitCameras(reset) {
    const vr = visibleRooms(store.get());
    const b = bbox(vr.flatMap(r => r.polygon).concat(vr.length ? [] : [{ x: 0, z: 0 }, { x: 3, z: 3 }]));
    const h = Math.max(2.5, ...vr.map(r => r.height));
    const c = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2), span = Math.max(b.x1 - b.x0, b.z1 - b.z0, 1.5);
    if (reset) {
      persp.position.set(c.x + span * 0.55 + 0.8, h + span * 0.95 + 1, c.z + span * 1.25 + 1.6);
      orbit.target.set(c.x, 0.4, c.z);
    }
    ortho.position.set(c.x, 30, c.z); top.target.set(c.x, 0, c.z); ortho.lookAt(c.x, 0, c.z);
    const { width, height } = host.getBoundingClientRect(), a = width / Math.max(height, 1);
    const half = Math.max((b.z1 - b.z0) / 2, (b.x1 - b.x0) / 2 / a) + 0.3;
    // сверху оставляем место под кнопки на холсте (~90 px), чтобы они не закрывали план
    const pad = 90 / Math.max(height, 200) * 2 * half;
    Object.assign(ortho, { left: -(half + pad / 2) * a, right: (half + pad / 2) * a, top: half + pad, bottom: -half });
    if (reset) ortho.zoom = 1;
    ortho.updateProjectionMatrix();
    sun.position.set(c.x + span * 0.6, h + 6, c.z + span * 0.4); sun.target.position.copy(c);
    orbit.update(); top.update(); invalidate();
  }

  function rebuildRooms(s) {
    if (apt) { scene.remove(apt.group); apt.group.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); }
    apt = buildApartment(visibleRooms(s), { cut: s.lowWalls ? LOW_WALLS : null }); scene.add(apt.group);
  }

  // Рамка выделения/пересечения: рёбра габаритного короба
  function makeFrame(d) {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(d.width / 1000 + 0.02, d.height / 1000 + 0.02, d.depth / 1000 + 0.02));
    const f = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: BLUE, depthTest: false, transparent: true }));
    f.position.y = d.height / 2000; f.renderOrder = 10; f.visible = false;
    return f;
  }

  function syncItems(s) {
    const shown = new Set(visibleRooms(s).map(r => r.id));
    const items = s.items.filter(i => shown.has(i.room));
    // пересечения ищем внутри одной комнаты
    const bad = new Set();
    for (const id of shown) collisions(items.filter(i => i.room === id), dimsOf).forEach(u => bad.add(u));
    const alive = new Set(items.map(i => i.uid));
    for (const [uid, o] of objs) if (!alive.has(uid)) { scene.remove(o.group); objs.delete(uid); }
    for (const it of items) {
      let o = objs.get(it.uid);
      if (!o) {
        const g = new THREE.Group(); g.userData.uid = it.uid;
        o = { group: g, frame: makeFrame(dimsOf(it)), model: null, tint: null };
        g.add(o.frame); scene.add(g); objs.set(it.uid, o);
        buildObject(byId(it.id)).then(m => {
          if (objs.get(it.uid) !== o) return;
          m.traverse(x => { if (x.isMesh) { x.material = x.material.clone(); x.castShadow = x.receiveShadow = true; } });
          o.model = m; g.add(m); o.tint = null; paint(o, lastBad.has(it.uid)); invalidate();
        });
      }
      o.group.position.set(it.x, dimsOf(it).elevation / 1000, it.z);
      o.group.rotation.y = it.rot;
      const hit = bad.has(it.uid), sel = s.selected === it.uid;
      o.frame.visible = hit || sel;
      o.frame.material.color.setHex(hit ? RED : BLUE);
      paint(o, hit);
    }
    invalidate();
    return bad;
  }

  // Красная подсветка пересекающихся товаров
  function paint(o, red) {
    if (!o.model || o.tint === red) return;
    o.tint = red;
    o.model.traverse(x => { if (x.isMesh && x.material.emissive) { x.material.emissive.setHex(red ? RED : 0); x.material.emissiveIntensity = red ? 0.45 : 0; } });
  }

  // --- Точка на полу под указателем
  const ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function setRay(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam());
  }
  function floorPoint(cx, cy) {
    setRay(cx, cy);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(floorPlane, p) ? { x: p.x, z: p.z } : null;
  }
  // В какую из показанных комнат попала точка пола
  const roomAt = p => p && visibleRooms(store.get()).find(r => pointInPoly(p, r.polygon));
  function pickItem(cx, cy) {
    setRay(cx, cy);
    const meshes = [];
    for (const o of objs.values()) if (o.model) o.model.traverse(x => x.isMesh && meshes.push(x));
    const hit = ray.intersectObjects(meshes, false)[0];
    let n = hit?.object;
    while (n && !n.userData.uid) n = n.parent;
    return n?.userData.uid || null;
  }
  function inCanvas(cx, cy) { const r = canvas.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; }

  // --- Перетаскивание товара по полу (луч на плоскость пола, без стрелок TransformControls)
  function onDown(e) {
    if (e.button > 0) return;
    const uid = pickItem(e.clientX, e.clientY);
    drag.start = { x: e.clientX, y: e.clientY }; drag.moved = false;
    if (!uid) { drag.uid = null; return; }
    const it = store.get().items.find(i => i.uid === uid), p = floorPoint(e.clientX, e.clientY);
    if (!it || !p) return;
    drag.uid = uid; drag.off = { x: it.x - p.x, z: it.z - p.z };
    controls().enabled = false;
    canvas.setPointerCapture(e.pointerId);
    store.set({ selected: uid });
  }
  canvas.addEventListener('pointermove', e => {
    if (drag.start && Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) > 4) drag.moved = true;
    if (!drag.uid) return;
    const p = floorPoint(e.clientX, e.clientY); if (!p) return;
    const s = store.get(), it = s.items.find(i => i.uid === drag.uid);
    // перетащили в соседнюю комнату — товар переезжает туда
    const want = { x: p.x + drag.off.x, z: p.z + drag.off.z }, other = roomAt(p);
    const room = other && other.id !== it.room ? other : roomOf(it);
    if (!room) return;
    const next = { ...place(it, dimsOf(it), want, room.polygon, { grid: s.grid }), room: room.id };
    if (next.x !== it.x || next.z !== it.z || next.rot !== it.rot || next.room !== it.room)
      store.set({ items: s.items.map(i => i.uid === it.uid ? next : i) });
  });
  const up = e => {
    if (!drag.uid && drag.start && !drag.moved) store.set({ selected: null });  // клик по пустому месту снимает выделение
    if (drag.uid) { controls().enabled = true; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} }
    drag.uid = null; drag.start = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  // --- Подписка на состояние
  let lastBad = new Set();
  const keyOf = s => JSON.stringify([visibleRooms(s), s.lowWalls]);
  store.subscribe((s, prev) => {
    const key = keyOf(s);
    if (key !== roomKey) { const refocus = s.focus !== prev.focus || !roomKey; roomKey = key; rebuildRooms(s); fitCameras(refocus); }
    if (s.view !== view) {
      view = s.view; orbit.enabled = view === '3d'; top.enabled = view === 'top';
      if (view === 'top') fitCameras(false);
    }
    lastBad = syncItems(s);
  });

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    persp.aspect = width / height; persp.updateProjectionMatrix();
    fitCameras(false);
  }
  new ResizeObserver(resize).observe(host);

  function render() {
    apt?.updateWalls(cam(), view === 'top');
    renderer.render(scene, cam());
    dirty = false;
  }
  (function loop() {
    requestAnimationFrame(loop);
    if (!host.offsetParent) return;           // 3D скрыт (включён 2D) — не рисуем
    if (controls().update()) dirty = true;   // инерция вращения
    if (dirty) render();
  })();

  const s0 = store.get();
  roomKey = keyOf(s0); rebuildRooms(s0);
  view = s0.view; orbit.enabled = view === '3d'; top.enabled = view === 'top';
  lastBad = syncItems(s0); resize(); fitCameras(true);

  return {
    floorPoint, inCanvas, dimsOf, roomAt,
    collisions: () => lastBad,
    resetView: () => fitCameras(true),
    resize,
    // PNG сцены без рамок выделения
    screenshot() {
      const frames = [...objs.values()].map(o => [o.frame, o.frame.visible]);
      frames.forEach(([f]) => f.visible = false);
      render();
      const url = canvas.toDataURL('image/png');
      frames.forEach(([f, v]) => f.visible = v); invalidate();
      return url;
    },
  };
}
