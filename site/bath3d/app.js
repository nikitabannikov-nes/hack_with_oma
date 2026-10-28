// 3D-планировщик ванной: каталог слева, сцена, инструменты, список товаров с суммой.
// Общие помощники сайта ($, esc, byn, qp, toast, getProject) приходят из core.js.
import { createStore, rectRoom, newUid } from './store.js';
import { createScene } from './scene.js';
import { place, freeSpot, fitsRoom, footprint, bbox } from './snapping.js';
import { overlaps } from './collision.js';
import { preloadModels } from './normalizeModel.js';
import { renderThumbs } from './thumbs.js';

const CATS = { bath: 'Ванны', toilet: 'Унитазы', sink: 'Раковины', shower: 'Душевые', cabinet: 'Шкафы' };
const catalog = await fetch('bath3d/catalog.json').then(r => r.json());
preloadModels(catalog);
const byId = id => catalog.find(p => p.id === id);
const dimsOf = it => { const p = byId(it.id); return { ...p.dimensions, elevation: p.elevation || 0, wallMounted: !!p.wallMounted }; };

// --- Комната из 2D-калькулятора (?project=…&room=…): контур [x,y] в метрах → {x,z}
const proj = qp('project') ? getProject(qp('project')) : null;
const pRoom = proj ? (proj.rooms.find(r => r.id === qp('room')) || proj.rooms[0]) : null;
const store = createStore('oma3d:' + (pRoom ? proj.id + ':' + pRoom.id : 'default'));
store.set(s => ({ items: s.items.filter(i => byId(i.id)) }));   // товаров, которых больше нет в каталоге, не показываем
if (pRoom?.pts?.length >= 3) {
  const polygon = pRoom.pts.map(([x, y]) => ({ x, z: y }));
  store.set(s => { const room = { polygon, height: pRoom.h || 2.7, source: 'project', name: pRoom.name }; return { room, items: refit({ ...s, room }) }; });
}
const ui = createScene($('#stage'), store, catalog);

// После смены комнаты возвращаем товары внутрь (если не помещаются — к ближайшему свободному месту)
function refit(s) {
  const poly = s.room.polygon;
  return s.items.map(it => {
    const d = dimsOf(it);
    if (fitsRoom(footprint(it, d), poly)) return it;
    const moved = place(it, d, it, poly, { grid: s.grid, snapWall: d.wallMounted || it.wall != null });
    return fitsRoom(footprint(moved, d), poly) ? moved : { ...freeSpot(d, poly, it.rot), uid: it.uid, id: it.id };
  });
}

function addItem(id, at) {
  const s = store.get(), p = byId(id), d = { ...p.dimensions, elevation: p.elevation || 0, wallMounted: !!p.wallMounted };
  const free = cand => s.items.every(o => !overlaps(cand, d, o, dimsOf(o)));
  let it = at
    ? place({ x: at.x, z: at.z, rot: 0 }, d, at, s.room.polygon, { grid: s.grid })
    : freeSpot(d, s.room.polygon, 0, free);
  if (!fitsRoom(footprint(it, d), s.room.polygon)) it = freeSpot(d, s.room.polygon, 0, free);
  if (!fitsRoom(footprint(it, d), s.room.polygon)) return toast(`«${esc(p.name)}» не помещается в комнату`, false);
  const item = { uid: newUid(), id, x: it.x, z: it.z, rot: it.rot, wall: it.wall ?? null };
  store.set({ items: [...s.items, item], selected: item.uid });
}

function rotateSelected() {
  const s = store.get(), it = s.items.find(i => i.uid === s.selected);
  if (!it) return toast('Сначала выберите товар в комнате', false);
  const d = dimsOf(it), turned = { ...it, rot: it.rot + Math.PI / 2 };
  const next = place(turned, d, it, s.room.polygon, { grid: false, snapWall: false });
  if (!fitsRoom(footprint(next, d), s.room.polygon)) return toast('Так не помещается — отодвиньте от стены', false);
  store.set({ items: s.items.map(i => i.uid === it.uid ? { ...next, rot: next.rot % (2 * Math.PI) } : i) });
}
function removeItem(uid) {
  const s = store.get(); uid = uid || s.selected;
  if (!uid) return toast('Сначала выберите товар в комнате', false);
  store.set({ items: s.items.filter(i => i.uid !== uid), selected: s.selected === uid ? null : s.selected });
}

// --- Каталог
const thumbs = renderThumbs(catalog);
let cat = '';
function drawCatalog() {
  $('#cchips').innerHTML = `<button class="${!cat ? 'on' : ''}" data-cat="">Все</button>` +
    Object.entries(CATS).map(([k, t]) => `<button class="${cat === k ? 'on' : ''}" data-cat="${k}">${t}</button>`).join('');
  $('#clist').innerHTML = catalog.filter(p => !cat || p.category === cat).map(p => {
    const { width, depth, height } = p.dimensions;
    return `<div class="c3" data-id="${p.id}" title="Нажмите или перетащите в комнату">
      <img src="${esc(p.photo || thumbs[p.id] || '')}" alt="" draggable="false">
      <div><b>${esc(p.name)}</b><small>${width}×${depth}×${height} мм${p.wallMounted ? ' · настенный' : ''}</small><span>${byn(p.price)}</span></div>
      <i aria-hidden="true">＋</i></div>`;
  }).join('');
}
$('#cchips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { cat = b.dataset.cat; drawCatalog(); } });

// Карточку можно нажать (товар встанет на свободное место) или утащить в комнату — мышью или пальцем
let cd = null;
$('#clist').addEventListener('pointerdown', e => {
  const c = e.target.closest('.c3'); if (!c || e.button > 0) return;
  cd = { id: c.dataset.id, x: e.clientX, y: e.clientY, ghost: null, card: c };
});
addEventListener('pointermove', e => {
  if (!cd) return;
  if (!cd.ghost && Math.hypot(e.clientX - cd.x, e.clientY - cd.y) > 8) {
    cd.ghost = cd.card.querySelector('img').cloneNode(); cd.ghost.className = 'c3-ghost'; document.body.append(cd.ghost);
    try { cd.card.setPointerCapture(e.pointerId); } catch (_) {}
  }
  if (cd.ghost) { cd.ghost.style.left = e.clientX + 'px'; cd.ghost.style.top = e.clientY + 'px'; $('#stage').classList.toggle('drop', ui.inCanvas(e.clientX, e.clientY)); }
});
addEventListener('pointerup', e => {
  if (!cd) return;
  const { id, ghost } = cd; cd = null;
  $('#stage').classList.remove('drop');
  if (!ghost) return addItem(id);
  ghost.remove();
  if (ui.inCanvas(e.clientX, e.clientY)) { const p = ui.floorPoint(e.clientX, e.clientY); addItem(id, p || undefined); }
});
addEventListener('pointercancel', () => { cd?.ghost?.remove(); cd = null; });

// --- Инструменты
const num = v => Math.round(v * 100) / 100;
function drawTools(s) {
  const b = bbox(s.room.polygon);
  $('#rw').value = num(b.x1 - b.x0); $('#rl').value = num(b.z1 - b.z0); $('#rh').value = num(s.room.height);
  const fromProj = s.room.source === 'project';
  $('#rw').disabled = $('#rl').disabled = fromProj && s.room.polygon.length !== 4;
  $('#rsrc').innerHTML = fromProj
    ? `Контур из проекта «${esc(proj?.title || '')}»${s.room.name ? ', ' + esc(s.room.name) : ''}. ${s.room.polygon.length !== 4 ? 'Сложная форма — размеры меняйте в <a href="planner.html?project=' + proj.id + '">редакторе плана</a>.' : ''}`
    : 'Прямоугольная комната. Размеры в метрах.';
  $('#tgrid').classList.toggle('on', s.grid);
  $('#v3d').classList.toggle('on', s.view === '3d'); $('#vtop').classList.toggle('on', s.view === 'top');
  $('#trot').disabled = $('#tdel').disabled = !s.selected;
}
function setRoomSize() {
  const w = +$('#rw').value, l = +$('#rl').value, h = +$('#rh').value;
  if (!(w >= 0.8 && w <= 15 && l >= 0.8 && l <= 15 && h >= 2 && h <= 4)) { drawTools(store.get()); return toast('Ширина и длина от 0,8 до 15 м, высота от 2 до 4 м', false); }
  const s = store.get();
  const room = s.room.source === 'project' && s.room.polygon.length !== 4
    ? { ...s.room, height: h }
    : rectRoom(w, l, h);
  store.set(st => ({ room, items: refit({ ...st, room }) }));
}
['#rw', '#rl', '#rh'].forEach(q => $(q).addEventListener('change', setRoomSize));
$('#tgrid').onclick = () => store.set(s => ({ grid: !s.grid }));
$('#v3d').onclick = () => store.set({ view: '3d' });
$('#vtop').onclick = () => store.set({ view: 'top' });
$('#tcam').onclick = () => ui.resetView();
$('#trot').onclick = rotateSelected;
$('#tdel').onclick = () => removeItem();
$('#tpng').onclick = () => download(ui.screenshot(), 'ванная-3d.png');
$('#texp').onclick = () => download(URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' })), 'ванная-3d.json');
$('#timp').onclick = () => $('#fimp').click();
$('#fimp').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    store.importJSON(await f.text());
    const s = store.get();
    store.set({ items: refit({ ...s, items: s.items.filter(i => byId(i.id)) }) });
    toast('Проект загружен');
  } catch (err) { toast(esc(err.message || 'Не получилось прочитать файл'), false); }
};
$('#tclr').onclick = () => { if (store.get().items.length && confirm('Убрать все товары из комнаты?')) store.set({ items: [], selected: null }); };
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); }

addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') { e.preventDefault(); rotateSelected(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (store.get().selected) { e.preventDefault(); removeItem(); } }
  if (e.key === 'Escape') store.set({ selected: null });
});

// --- Список товаров и сумма
function polyArea(poly) { let s = 0; poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length]; s += a.x * b.z - b.x * a.z; }); return Math.abs(s / 2); }
function drawSummary(s) {
  const bad = ui.collisions(), total = s.items.reduce((t, i) => t + byId(i.id).price, 0);
  $('#slist').innerHTML = s.items.length ? s.items.map(i => {
    const p = byId(i.id);
    return `<div class="s3 ${s.selected === i.uid ? 'on' : ''} ${bad.has(i.uid) ? 'bad' : ''}" data-uid="${i.uid}">
      <img src="${esc(p.photo || thumbs[p.id] || '')}" alt=""><div><b>${esc(p.name)}</b>${bad.has(i.uid) ? '<small class="warn">Пересекается с другим товаром</small>' : ''}</div>
      <span>${byn(p.price)}</span><button class="x" data-del="${i.uid}" title="Убрать" aria-label="Убрать">×</button></div>`;
  }).join('') : `<p class="note">Комната пуста. Нажмите на товар в каталоге или перетащите его в комнату.</p>`;
  $('#stot').innerHTML = `<span>Итого · ${s.items.length} ${plural(s.items.length)}</span><b>${byn(total)}</b>`;
  $('#sarea').textContent = `Пол ${num(polyArea(s.room.polygon)).toLocaleString('ru-RU')} м² · высота ${num(s.room.height).toLocaleString('ru-RU')} м`;
  $('#swarn').hidden = !bad.size;
  $('#mbar').textContent = s.items.length ? '· ' + byn(total) : '';
}
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'товар' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'товара' : 'товаров';
$('#slist').addEventListener('click', e => {
  const del = e.target.closest('[data-del]'); if (del) return removeItem(del.dataset.del);
  const row = e.target.closest('.s3'); if (row) store.set({ selected: row.dataset.uid });
});

// Мобильная версия: каталог — нижняя выезжающая панель
$('#csheet').onclick = () => document.body.classList.toggle('cat-open');

store.subscribe(s => { drawTools(s); drawSummary(s); });
drawCatalog(); drawTools(store.get()); drawSummary(store.get());
if (proj) $('#ctx').innerHTML = `<a href="planner.html?project=${proj.id}">← К плану «${esc(proj.title)}»</a>`;
