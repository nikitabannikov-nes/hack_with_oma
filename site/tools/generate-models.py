"""Второй этап (пока не включён): 3D-модели для товаров 3D-планировщика по фото через fal.ai.

План: для каждой позиции p3d/catalog.json, у которой "model": null и есть "photo",
отправить фото в fal.ai (image-to-3D: Tripo или Hunyuan3D), скачать GLB в catalog/models/<id>.glb
и прописать путь в catalog.json. Масштаб не важен — планировщик сам подгоняет модель
под "dimensions" (p3d/normalizeModel.js).

Запуск: FAL_KEY=… python3 site/tools/generate-models.py
"""
import json
import os
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
CATALOG = SITE / "p3d" / "catalog.json"
MODELS = SITE / "catalog" / "models"


def generate(item, key):
    """Фото → GLB. Здесь будет вызов fal.ai; пока не реализовано."""
    raise NotImplementedError("Генерация моделей — второй этап")


def main():
    key = os.environ.get("FAL_KEY")
    if not key:
        sys.exit("Нет переменной окружения FAL_KEY")
    items = json.loads(CATALOG.read_text())
    todo = [x for x in items if not x.get("model") and x.get("photo")]
    print(f"Без модели и с фото: {len(todo)} из {len(items)}")
    MODELS.mkdir(parents=True, exist_ok=True)
    for x in todo:
        x["model"] = generate(x, key)
    CATALOG.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
