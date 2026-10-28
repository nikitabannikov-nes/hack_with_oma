// Состояние планировщика: комната (контур {x,z}[] в метрах + высота), расставленные товары, настройки.
// Маленькое хранилище с подпиской вместо zustand; само сохраняется в localStorage.
const VERSION = 1;

export function rectRoom(width = 2.5, length = 3, height = 2.7) {
  return { polygon: [{ x: 0, z: 0 }, { x: width, z: 0 }, { x: width, z: length }, { x: 0, z: length }], height, source: 'rect' };
}

const initial = () => ({ v: VERSION, room: rectRoom(), items: [], selected: null, grid: true, view: '3d' });

export function createStore(storageKey) {
  let state = read() || initial();
  const subs = new Set();

  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey));
      return s && s.v === VERSION && s.room?.polygon?.length >= 3 ? { ...initial(), ...s, selected: null } : null;
    } catch (e) { return null; }
  }
  function persist() {
    try { const { selected, ...keep } = state; localStorage.setItem(storageKey, JSON.stringify(keep)); } catch (e) { /* приватный режим — живём без сохранения */ }
  }

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      persist();
      subs.forEach(fn => fn(state));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    hadSaved: () => !!read(),
    exportJSON() { const { selected, ...keep } = state; return JSON.stringify(keep, null, 1); },
    importJSON(text) {
      const s = JSON.parse(text);
      if (!s?.room?.polygon?.length || !Array.isArray(s.items)) throw new Error('Это не файл проекта 3D-планировщика');
      this.set({ ...initial(), ...s, v: VERSION, selected: null });
    },
  };
}

export const newUid = () => Math.random().toString(36).slice(2, 9);
