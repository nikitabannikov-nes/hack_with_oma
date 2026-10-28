"""Собирает site/oma-furniture.js — мебель, сантехника и техника для 3D-вида, сметы и корзины.

Вход:
  site/p3d/catalog.json              — позиции 3D-каталога: категория, форма заглушки, комнаты, типовые габариты
  site/tools/oma-furniture-snapshot.json — товары oma.by под эти позиции (собраны через браузер):
                                       {id: {name, price, img, url, brand, W, D, H, L}} — размеры в мм, если есть на карточке
Выход: oma-furniture.js — root.OMA_FURN = [...]: позиция каталога + реальные название, цена, фото, ссылка.
Габариты: с карточки oma.by, если указаны все три и похожи на правду; иначе — типовые из catalog.json.

Запуск: python3 site/tools/build-oma-furniture.py
"""
import json
from datetime import date
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
BASE = json.loads((SITE / "p3d" / "catalog.json").read_text(encoding="utf-8"))
SNAP = json.loads((SITE / "tools" / "oma-furniture-snapshot.json").read_text(encoding="utf-8"))


def dims(base, r):
    """Ширина — длинная сторона в плане, глубина — короткая; высота — по вертикали."""
    w, d, h = r.get("W"), r.get("D") or r.get("L"), r.get("H")
    if r.get("L") and r.get("W") and not r.get("D"):
        w, d = max(r["L"], r["W"]), min(r["L"], r["W"])
    b = base["dimensions"]
    if not (w and d and h):
        return b
    if base.get("wallMounted"):
        w, d = max(w, d), min(w, d)
    # отбрасываем явно чужие цифры (размер упаковки, ошибка на карточке)
    if any(not (0.4 <= x / y <= 2.5) for x, y in ((w, b["width"]), (d, b["depth"]), (h, b["height"]))):
        return b
    return {"width": w, "depth": d, "height": h}


out = []
for base in BASE:
    r = SNAP.get(base["id"]) or {}
    item = {k: v for k, v in base.items() if k not in ("photo", "model")}
    if r.get("name") and r.get("price"):
        item.update(name=r["name"], price=round(r["price"], 2), photo=r["img"], url="https://www.oma.by" + r["url"], brand=r.get("brand"), real=True)
        item["dimensions"] = dims(base, r)
    else:
        item.update(photo=None, real=False)   # такого товара в ОМА не нашли — остаётся демо-позицией
    item["model"] = base.get("model")
    out.append(item)

js = (f"// Мебель, сантехника и техника для 3D-вида, сметы и корзины: товары oma.by (снимок {date.today():%d.%m.%Y}).\n"
      "// Сгенерировано tools/build-oma-furniture.py — не править руками.\n"
      "(function(root){root.OMA_FURN=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "})(this);\n")
(SITE / "oma-furniture.js").write_text(js, encoding="utf-8")
real = sum(1 for x in out if x["real"])
print(f"oma-furniture.js: {len(out)} позиций, реальных {real}")
for x in out:
    d = x["dimensions"]
    print(f" {x['id']:15} {'✓' if x['real'] else '—'} {x['price']:>8} {d['width']}×{d['depth']}×{d['height']}  {x['name'][:60]}")
