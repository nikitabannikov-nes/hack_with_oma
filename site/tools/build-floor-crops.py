"""Собирает site/oma-crops.js: какой кусок фото товара класть на пол и куда идут волокна.

На oma.by фото вписаны в квадрат 600×600: вокруг плитки 30×60 поля (белые или цветные),
а на фото ламината сняты сразу несколько досок со стыками. Для плана нужна одна целая доска
без стыков и направление волокон, чтобы рисунок шёл вдоль доски. Браузер не может прочитать
пиксели чужих фото (нет CORS), поэтому всё считаем заранее.

Запуск: python3 site/tools/build-floor-crops.py   (нужны интернет, Pillow и numpy)
Выход: {id: [x, y, w, h, dir]} — рамка в координатах снимка 600×600, dir — «h»/«v» для волокон или «» если рисунка нет.
"""
import io
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image

SITE = Path(__file__).resolve().parent.parent
# Товары, которые рисуются на плане: плитка и ламинат
PREFIX = ("lam_", "tf_", "tw_", "x_lam", "x_tf", "x_tw")
# Дерево — ламинат и плитка «под дерево» (сама tf_wood и товары, которые от неё наследуются в build-oma-catalog.py):
# ищем одну целую доску и направление волокон
def _like():
    src = (SITE / "tools" / "build-oma-catalog.py").read_text(encoding="utf-8")
    return dict(re.findall(r'"(x_\w+)": "(\w+)"', src[src.index("LIKE = {"):src.index("}", src.index("LIKE = {"))]))
LIKE = _like()
is_wood = lambda pid: pid.startswith(("lam_", "x_lam")) or "tf_wood" in (pid, LIKE.get(pid))
BG_DIFF = 28     # насколько пиксель должен отличаться от цвета углов, чтобы считаться товаром
GRAIN = 1.25     # во сколько раз перепады поперёк волокон сильнее, чем вдоль
SEAM = 4          # стык: отклонение средней яркости линии от соседей во столько раз выше обычного
SEAM_ABS = 4      # и не меньше стольких уровней яркости
INSET = 4        # отступ от найденного края, px
END = 0.06       # сколько длины доски срезать с каждого торца
SIDE = 0.1       # и сколько ширины — с каждого длинного края


def catalog():
    src = (SITE / "oma-catalog.js").read_text(encoding="utf-8")
    m = re.search(r"const OMA=(\{.*?\});\n", src, re.S)
    d = json.loads(m.group(1))
    # демо-товары лежат в byId, дополнительные (x_…) — в extra со своим id
    return {**d["byId"], **{x["id"]: x for x in d.get("extra", []) if x.get("id")}}


def product_box(rgb):
    """Рамка товара: всё, что заметно отличается от цвета фона в углах."""
    c = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3), rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)])
    bg = np.median(c, axis=0)
    mask = np.abs(rgb.astype(int) - bg).max(axis=2) > BG_DIFF
    ys, xs = np.where(mask)
    if not len(xs):
        return 0, 0, rgb.shape[1], rgb.shape[0]
    return xs.min() + INSET, ys.min() + INSET, xs.max() - xs.min() - 2 * INSET, ys.max() - ys.min() - 2 * INSET


def widest(mean, min_part=0.18):
    """Самый длинный участок между стыками. Стык — узкая тёмная (или светлая) линия поперёк:
    средняя яркость в ней резко отличается от соседей. Участки короче min_part не считаем."""
    n = len(mean)
    k = max(9, n // 20) | 1
    pad = np.pad(mean, k // 2, mode="edge")
    base = np.array([np.median(pad[i:i + k]) for i in range(n)])
    dip = np.abs(base - mean)
    thr = max(SEAM_ABS, SEAM * np.median(dip))
    cuts = [0] + [i for i in range(2, n - 2) if dip[i] > thr and dip[i] == dip[max(0, i - 3):i + 4].max()] + [n]
    parts = [(a, b) for a, b in zip(cuts, cuts[1:]) if b - a >= min_part * n] or [(0, n)]
    a, b = max(parts, key=lambda p: p[1] - p[0])
    return a + INSET, b - a - 2 * INSET


def analyse(img, wood):
    rgb = np.asarray(img.convert("RGB").resize((600, 600)))
    x, y, w, h = product_box(rgb)
    g = np.asarray(Image.fromarray(rgb).convert("L"), dtype=float)[y:y + h, x:x + w]
    gx, gy = np.abs(np.diff(g, axis=1)).mean(), np.abs(np.diff(g, axis=0)).mean()
    # волокна вертикальные — яркость сильнее меняется по горизонтали
    grain = ("v" if gx > GRAIN * gy else "h" if gy > GRAIN * gx else "") if wood else ""
    if not grain:
        return [x, y, w, h, ""]
    # поворачиваем мысленно так, чтобы волокна шли по горизонтали: строки — поперёк досок
    t = g.T if grain == "v" else g
    r0, rh = widest(t.mean(axis=1), 0.12)              # продольные стыки между досками
    r0, rh = r0 + int(rh * SIDE), int(rh * (1 - 2 * SIDE))  # у длинных краёв на фото фаска и тени
    c0, cw = widest(t[r0:r0 + rh].mean(axis=0), 0.3)   # торцевые стыки внутри доски
    c0, cw = c0 + int(cw * END), int(cw * (1 - 2 * END))  # торцы на фото часто затемнены — срезаем
    return [x + r0, y + c0, rh, cw, grain] if grain == "v" else [x + c0, y + r0, cw, rh, grain]


def main():
    out = {}
    for pid, p in sorted(catalog().items()):
        if not pid.startswith(PREFIX) or not p.get("img"):
            continue
        req = urllib.request.Request(p["img"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            out[pid] = [int(v) if not isinstance(v, str) else v for v in analyse(Image.open(io.BytesIO(r.read())), is_wood(pid))]
        print(pid, out[pid])
    js = (f"// Какой кусок фото товара класть на пол: рамка [x, y, w, h] в снимке 600×600 и направление волокон, снимок {date.today():%d.%m.%Y}.\n"
          "// Сгенерировано tools/build-floor-crops.py — не править руками.\n"
          f"const OMA_CROPS={json.dumps(out, separators=(',', ':'))};\n")
    (SITE / "oma-crops.js").write_text(js, encoding="utf-8")
    print(f"{len(out)} товаров → oma-crops.js")


if __name__ == "__main__":
    main()
