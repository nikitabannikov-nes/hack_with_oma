// Загрузка GLB и приведение модели к реальным габаритам товара
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { placeholder } from './placeholders.js';

/**
 * Подгоняет модель под размеры из каталога (мм) — 1 единица сцены = 1 метр.
 * Модели от производителей и из генераторов приходят в любых единицах и с любым центром,
 * поэтому масштабируем по каждой оси отдельно по Box3, затем ставим низ на пол (y = 0), центр — в начало координат.
 */
export function normalizeModel(object, dimensions) {
  const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3());
  const want = new THREE.Vector3(dimensions.width, dimensions.height, dimensions.depth).multiplyScalar(1 / 1000);
  object.scale.multiply(new THREE.Vector3(
    size.x > 1e-6 ? want.x / size.x : 1, size.y > 1e-6 ? want.y / size.y : 1, size.z > 1e-6 ? want.z / size.z : 1));
  object.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(object), c = fitted.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(c.x, fitted.min.y, c.z));
  const wrap = new THREE.Group();
  wrap.add(object);
  object.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return wrap;
}

// Кэш загрузок: аналог useGLTF.preload — модели начинают грузиться сразу при открытии страницы
const loader = new GLTFLoader(), cache = new Map();
const loadGLB = url => {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).catch(e => { console.warn('Модель не загрузилась, будет заглушка:', url, e); return null; }));
  return cache.get(url);
};
export const preloadModels = catalog => catalog.forEach(p => p.model && loadGLB(p.model));

// Объект для сцены: GLB, если есть и загрузился, иначе заглушка с теми же габаритами
export async function buildObject(product) {
  if (product.model) {
    const gltf = await loadGLB(product.model);
    if (gltf) return normalizeModel(gltf.scene.clone(true), product.dimensions);
  }
  return placeholder(product);
}
