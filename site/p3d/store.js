// Состояние 3D-вида: комнаты (контур {x,z}[] в метрах, высота, отделка), расставленные товары, настройки вида.
// Маленькое хранилище с подпиской вместо zustand. Куда сохранять товары, решает страница (onSave).
export function createStore(initial, onSave = () => {}) {
  let state = { grid: true, view: '3d', focus: 'all', selected: null, lowWalls: false, ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      if (state.items !== prev.items) onSave(state.items);
      subs.forEach(fn => fn(state, prev));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const newUid = () => Math.random().toString(36).slice(2, 9);
