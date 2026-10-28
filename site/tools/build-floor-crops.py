"""Собирает site/oma-crops.js: где на фото товара сама плитка или доска, без белых полей.

На oma.by фото вписаны в квадрат 600×600 с белыми полями: у плитки 30×60 сверху и снизу пусто.
Браузер не может прочитать пиксели чужих фото (нет CORS), поэтому рамку считаем заранее.

Запуск: python3 site/tools/build-floor-crops.py   (нужны интернет и Pillow)
"""
import io
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
# Товары, которые рисуются на плане: плитка и ламинат
PREFIX = ("lam_", "tf_", "tw_", "x_lam", "x_tf", "x_tw")
WHITE = 238  # светлее — считаем белым полем
INSET = 0.03  # срезаем край рамки: тени и обводка на фото


def catalog():
    src = (SITE / "oma-catalog.js").read_text(encoding="utf-8")
    m = re.search(r"const OMA=(\{.*?\});\n", src, re.S)
    d = json.loads(m.group(1))
    # демо-товары лежат в byId, дополнительные (x_…) — в extra со своим id
    return {**d["byId"], **{x["id"]: x for x in d.get("extra", []) if x.get("id")}}


def box(img):
    g = img.convert("L").resize((600, 600))
    mask = g.point(lambda v: 255 if v < WHITE else 0)
    b = mask.getbbox()
    if not b:
        return None
    x0, y0, x1, y1 = b
    dx, dy = (x1 - x0) * INSET, (y1 - y0) * INSET
    return [round(x0 + dx), round(y0 + dy), round(x1 - x0 - 2 * dx), round(y1 - y0 - 2 * dy)]


def main():
    out = {}
    for pid, p in sorted(catalog().items()):
        if not pid.startswith(PREFIX) or not p.get("img"):
            continue
        req = urllib.request.Request(p["img"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            b = box(Image.open(io.BytesIO(r.read())))
        if b:
            out[pid] = b
            print(pid, b)
    js = (f"// Рамка плитки или доски на фото товара (координаты в снимке 600×600), снимок {date.today():%d.%m.%Y}.\n"
          "// Сгенерировано tools/build-floor-crops.py — не править руками.\n"
          f"const OMA_CROPS={json.dumps(out, separators=(',', ':'))};\n")
    (SITE / "oma-crops.js").write_text(js, encoding="utf-8")
    print(f"{len(out)} товаров → oma-crops.js")


if __name__ == "__main__":
    main()
