// 3D-вид внутри 2D-калькулятора: та же квартира, что на плане (контуры, высоты, проёмы, отделка),
// плюс расстановка мебели и сантехники. Товары хранятся в проекте (p.furniture), сохраняются вместе с ним.
// Общие функции сайта (esc, byn, toast, save, Geom, matOf, matLook, RT) приходят из core.js/geom.js.
import { createStore, newUid } from './store.js';
import { createScene, visibleRooms } from './scene.js';
import { place, freeSpot, fitsRoom, footprint } from './snapping.js';
import { overlaps } from './collision.js';
import { preloadModels } from './normalizeModel.js';
import { renderThumbs } from './thumbs.js';

const CATS = { bath: 'Ванны', shower: 'Душевые', toilet: 'Унитазы', sink: 'Раковины', cabinet: 'Шкафы для ванной', kitchen: 'Кухни', appliance: 'Техника',
  table: 'Столы и стулья', sofa: 'Диваны и кресла', bed: 'Кровати', storage: 'Хранение' };
// Каталог — реальные товары ОМА (oma-furniture.js, tools/build-oma-furniture.py); без него — заготовка позиций
const catalog = window.OMA_FURN || await fetch('p3d/catalog.json').then(r => r.json());
preloadModels(catalog);
const byId = id => catalog.find(p => p.id === id);
const dimsOf = it => { const p = byId(it.id); return { ...p.dimensions, elevation: p.elevation || 0, wallMounted: !!p.wallMounted }; };

// Отделка из калькулятора → вид поверхности для 3D. Плитка и ламинат — с фото товара (img/tex/<id>.jpg),
// если для него есть вырезка в oma-crops.js; иначе рисунок по цвету
function lookOf(prod, kind) {
  const l = prod && matLook(prod);
  if (!l) return null;
  const k = kind || l.kind;
  return { kind: k, color: l.color, size: l.size, ...(l.crop && k !== 'paint' ? { tex: `img/tex/${prod.id}.jpg`, grain: l.crop[4] || '' } : {}) };
}
function wallLook(p, r, finish) {
  // настенную плитку кладём длинной стороной вдоль стены — как обычно укладывают 30×60
  if (finish === 'tile') { const l = lookOf(matOf(p, r, 'tileWall')); return l && { ...l, kind: l.kind === 'plank' ? 'plank' : 'tile', size: [...l.size].sort((a, b) => b - a) }; }
  if (finish === 'paint') return lookOf(matOf(p, r, 'paintWall'), 'paint');
  return null;
}
function floorLook3(p, r) {
  const role = r.floor === 'tile' ? 'tileFloor' : r.floor === 'laminate' ? 'laminate' : null;
  return role ? lookOf(matOf(p, r, role)) : null;
}
export function roomsOf(p) {
  return p.rooms.filter(r => r.pts.length >= 3 && Geom.validate(r).ok).map(r => ({
    id: r.id, name: r.name, type: r.type, height: +r.h || 2.7,
    polygon: r.pts.map(([x, y]) => ({ x, z: y })),
    floor: r.floor !== 'none' ? floorLook3(p, r) : null,
    walls: r.walls.map(w => ({ look: wallLook(p, r, w.finish), h: w.h != null && w.h !== '' ? +w.h : null })),
    openings: r.openings.map(o => ({ wall: r.walls.findIndex(w => w.id === o.wallId), kind: o.kind, off: +o.off, w: +o.w, h: +o.h, sill: +(o.sill || 0) })),
  }));
}

// Товары, которые после правки плана оказались вне своей комнаты, возвращаем внутрь
function refit(rooms, items) {
  return items.filter(it => byId(it.id)).map(it => {
    const room = rooms.find(r => r.id === it.room);
    if (!room) return null;   // комнату удалили — товар уходит вместе с ней
    const d = dimsOf(it);
    if (fitsRoom(footprint(it, d), room.polygon)) return it;
    const moved = place(it, d, it, room.polygon, { snapWall: d.wallMounted || it.wall != null });
    if (fitsRoom(footprint(moved, d), room.polygon)) return { ...moved, room: room.id };
    return { ...it, ...freeSpot(d, room.polygon, it.rot), uid: it.uid, id: it.id, room: room.id };
  }).filter(Boolean);
}

export function mount({ host, tools, panel, project: p, focus = 'all', activeRoom }) {
  const rooms0 = roomsOf(p);
  // стены срезаем, только когда на сцене несколько комнат: иначе мебель кажется выше стен
  const store = createStore({ rooms: rooms0, items: refit(rooms0, p.furniture || []), focus, lowWalls: focus === 'all' && rooms0.length > 1 },
    items => { p.furniture = items; p.updated = now(); save(); });
  const ui = createScene(host, store, catalog);
  const thumbs = renderThumbs(catalog);
  let cat = 'room', cd = null, active = true;

  // В какую комнату добавлять: показанная одна или выбранная в списке слева
  const targetRoom = () => {
    const s = store.get(), vr = visibleRooms(s);
    return vr.length === 1 ? vr[0] : vr.find(r => r.id === activeRoom()) || vr[0];
  };

  function addItem(id, at) {
    const s = store.get(), prod = byId(id), d = dimsOf({ id });
    const room = (at && ui.roomAt(at)) || targetRoom();
    if (!room) return toast('Сначала нарисуйте помещение на плане', false);
    const others = s.items.filter(o => o.room === room.id);
    const free = cand => others.every(o => !overlaps(cand, d, o, dimsOf(o)));
    let it = at ? place({ x: at.x, z: at.z, rot: 0 }, d, at, room.polygon, { grid: s.grid }) : freeSpot(d, room.polygon, 0, free);
    if (!fitsRoom(footprint(it, d), room.polygon)) it = freeSpot(d, room.polygon, 0, free);
    if (!fitsRoom(footprint(it, d), room.polygon)) return toast(`«${esc(prod.name)}» не помещается в «${esc(room.name)}»`, false);
    const item = { uid: newUid(), id, room: room.id, x: it.x, z: it.z, rot: it.rot, wall: it.wall ?? null };
    store.set({ items: [...s.items, item], selected: item.uid });
  }
  function rotateSelected() {
    const s = store.get(), it = s.items.find(i => i.uid === s.selected);
    if (!it) return toast('Сначала выберите товар в комнате', false);
    const room = s.rooms.find(r => r.id === it.room), d = dimsOf(it), turned = { ...it, rot: it.rot + Math.PI / 2 };
    const next = place(turned, d, it, room.polygon, { grid: false, snapWall: false });
    if (!fitsRoom(footprint(next, d), room.polygon)) return toast('Так не помещается — отодвиньте от стены', false);
    store.set({ items: s.items.map(i => i.uid === it.uid ? { ...next, room: it.room, rot: next.rot % (2 * Math.PI) } : i) });
  }
  function removeItem(uid) {
    const s = store.get(); uid = uid || s.selected;
    if (!uid) return toast('Сначала выберите товар в комнате', false);
    store.set({ items: s.items.filter(i => i.uid !== uid), selected: s.selected === uid ? null : s.selected });
  }

  // --- Кнопки на холсте
  tools.innerHTML = `<div class="grp"><button data-v="3d">3D</button><button data-v="top">Сверху</button></div>
   <button data-a="cam" title="Вернуть камеру">⟲</button><span class="sep"></span>
   <button data-a="rot" title="Повернуть на 90° (R)">↻<span class="lb"> Повернуть</span></button><button data-a="del" title="Удалить (Delete)"><i class="ui ui-trash"></i><span class="lb">Удалить</span></button>
`;
  tools.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) store.set({ view: b.dataset.v });
    const a = b.dataset.a;
    if (a === 'cam') ui.resetView();
    if (a === 'rot') rotateSelected();
    if (a === 'del') removeItem();
  };
  function drawTools(s) {
    tools.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === s.view));
    tools.querySelectorAll('[data-a="rot"],[data-a="del"]').forEach(b => b.disabled = !s.selected);
  }
  function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); }

  // --- Панель: каталог и расставленные товары
  function renderPanel() {
    const s = store.get(), room = targetRoom(), vr = visibleRooms(s), shownIds = new Set(vr.map(r => r.id));
    const bad = ui.collisions();
    const list = catalog.filter(x => cat === 'all' || (cat === 'room' ? !room || x.rooms.includes(room.type) : x.category === cat));
    const placed = s.items.filter(i => shownIds.has(i.room));
    const total = placed.reduce((t, i) => t + byId(i.id).price, 0), all = s.items.reduce((t, i) => t + byId(i.id).price, 0);
    const usedCats = [...new Set(catalog.map(x => x.category))];
    panel.innerHTML = `<div class="fur">
     <div class="fur-h"><b>Мебель и сантехника</b><span>${vr.length > 1 ? 'Вся квартира' : esc(room?.name || '')}</span></div>
     <p class="note fur-to">Новый товар встанет в <b>${esc(room?.name || '—')}</b>. Можно перетащить карточку прямо в нужную комнату.</p>
     <div class="fur-chips"><button data-cat="room" class="${cat === 'room' ? 'on' : ''}">Для «${esc(room?.name || 'комнаты')}»</button><button data-cat="all" class="${cat === 'all' ? 'on' : ''}">Все</button>${usedCats.map(k => `<button data-cat="${k}" class="${cat === k ? 'on' : ''}">${CATS[k] || k}</button>`).join('')}</div>
     <div class="fur-list">${list.map(x => {
       const { width, depth, height } = x.dimensions;
       return `<div class="c3" data-id="${x.id}" title="Нажмите или перетащите в комнату"><img src="${esc(x.photo || thumbs[x.id] || '')}" alt="" draggable="false">
        <div><b>${esc(x.name)}</b><small>${width}×${depth}×${height} мм${x.wallMounted ? ' · настенный' : ''}${x.real === false ? ' · <em class="demo">демо</em>' : ''}</small><span>${byn(x.price)}</span></div><i aria-hidden="true">＋</i></div>`;
     }).join('') || '<p class="note">Для этого помещения пока ничего нет — откройте «Все».</p>'}</div>
     <div class="fur-h fur-h2"><b>Расставлено</b><span>${placed.length}</span></div>
     <div class="fur-placed">${placed.length ? placed.map(i => {
       const x = byId(i.id), rn = s.rooms.find(r => r.id === i.room)?.name || '';
       return `<div class="s3 ${s.selected === i.uid ? 'on' : ''} ${bad.has(i.uid) ? 'bad' : ''}" data-uid="${i.uid}"><img src="${esc(x.photo || thumbs[x.id] || '')}" alt="">
        <div><b>${esc(x.name)}</b><small>${bad.has(i.uid) ? '<em>Пересекается с другим товаром</em>' : vr.length > 1 ? esc(rn) : ''}</small></div><span>${byn(x.price)}</span><button class="x" data-del="${i.uid}" title="Убрать">×</button></div>`;
     }).join('') : '<p class="note">Пока пусто. Нажмите на товар в каталоге.</p>'}</div>
     <div class="fur-tot"><span>${vr.length > 1 ? 'Итого по квартире' : 'Итого по помещению'}</span><b>${byn(total)}</b></div>
     ${s.items.length ? `<div class="fur-acts"><button class="btn o" data-tocart><i class="ui ui-cart"></i>Мебель в корзину</button><a class="btn g" href="smeta.html?project=${p.id}"><i class="ui ui-list"></i>В смете</a></div>` : ''}
     ${vr.length === 1 && all !== total ? `<p class="note">Во всей квартире: ${byn(all)}</p>` : ''}
     <p class="note">Тащите товар по полу мышью или пальцем, в соседнюю комнату — тоже можно. <kbd>R</kbd> — повернуть, <kbd>Delete</kbd> — удалить. Ближе 15 см к стене товар прилипает к ней. Товары и цены — из каталога ОМА; с пометкой «демо» — примерные, такой позиции в ОМА не нашлось.</p>
    </div>`;
  }
  panel.addEventListener('click', e => {
    if (!active) return;
    const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; return renderPanel(); }
    if (e.target.closest('[data-tocart]')) { const n = cartSyncFurniture(p); return toast(`В корзине мебель: ${n} поз. · <a href="cart.html">открыть корзину</a>`); }
    const del = e.target.closest('[data-del]'); if (del) return removeItem(del.dataset.del);
    const row = e.target.closest('.s3'); if (row) store.set({ selected: row.dataset.uid });
  });
  // Карточку можно нажать (товар встанет на свободное место) или утащить на холст — мышью или пальцем
  panel.addEventListener('pointerdown', e => {
    if (!active) return;
    const c = e.target.closest('.c3'); if (!c || e.button > 0) return;
    cd = { id: c.dataset.id, x: e.clientX, y: e.clientY, ghost: null, card: c };
  });
  addEventListener('pointermove', e => {
    if (!cd) return;
    if (!cd.ghost && Math.hypot(e.clientX - cd.x, e.clientY - cd.y) > 8) {
      cd.ghost = cd.card.querySelector('img').cloneNode(); cd.ghost.className = 'c3-ghost'; document.body.append(cd.ghost);
      try { cd.card.setPointerCapture(e.pointerId); } catch (_) {}
    }
    if (cd.ghost) { cd.ghost.style.left = e.clientX + 'px'; cd.ghost.style.top = e.clientY + 'px'; host.classList.toggle('drop', ui.inCanvas(e.clientX, e.clientY)); }
  });
  addEventListener('pointerup', e => {
    if (!cd) return;
    const { id, ghost } = cd; cd = null; host.classList.remove('drop');
    if (!ghost) return addItem(id);
    ghost.remove();
    if (ui.inCanvas(e.clientX, e.clientY)) addItem(id, ui.floorPoint(e.clientX, e.clientY) || undefined);
  });
  addEventListener('pointercancel', () => { cd?.ghost?.remove(); cd = null; });

  addEventListener('keydown', e => {
    if (!active || e.target.closest('input,textarea,select')) return;
    if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') { e.preventDefault(); rotateSelected(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.get().selected) { e.preventDefault(); removeItem(); }
    if (e.key === 'Escape') store.set({ selected: null });
  });

  store.subscribe(s => { drawTools(s); if (active) renderPanel(); });
  drawTools(store.get());

  return {
    renderPanel,
    // вся квартира — стены пониже, чтобы видеть комнаты; одна комната — в полную высоту
    setFocus: f => store.set(s => s.focus === f ? {} : { focus: f, selected: null, lowWalls: f === 'all' && s.rooms.length > 1 }),
    // план поменяли в 2D — пересобираем комнаты и подтягиваем товары внутрь стен
    refresh() { const rooms = roomsOf(p); store.set(s => ({ rooms, items: refit(rooms, s.items) })); },
    setActive(on) { active = on; if (on) { ui.resize(); renderPanel(); } },
  };
}
