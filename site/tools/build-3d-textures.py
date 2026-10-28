"""Собирает текстуры отделки для 3D-вида: site/img/tex/<id>.jpg — вырезанный кусок фото товара с oma.by.

Браузер не может положить чужое фото в WebGL (у oma.by нет CORS), поэтому куски фото храним на сайте.
Какой кусок брать, уже посчитано в oma-crops.js (tools/build-floor-crops.py): одна целая доска ламината
без стыков или плитка без полей вокруг. Режем и уменьшаем встроенной в macOS утилитой sips.

Запуск: python3 site/tools/build-3d-textures.py   (нужен интернет; между запросами пауза)
"""
import json
import re
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "img" / "tex"
MAX = 512      # длинная сторона текстуры, px
PAUSE = 1.5    # пауза между запросами к oma.by, с


def catalog():
    src = (SITE / "oma-catalog.js").read_text(encoding="utf-8")
    d = json.loads(re.search(r"const OMA=(\{.*?\});\n", src, re.S).group(1))
    return {**d["byId"], **{x["id"]: x for x in d.get("extra", []) if x.get("id")}}


def crops():
    src = (SITE / "oma-crops.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"OMA_CROPS=(\{.*?\});", src).group(1))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cat, cr = catalog(), crops()
    for pid, (x, y, w, h, _) in sorted(cr.items()):
        p = cat.get(pid)
        if not p or not p.get("img"):
            continue
        dst = OUT / f"{pid}.jpg"
        req = urllib.request.Request(p["img"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r, tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
            tmp.write(r.read()); tmp.flush()
            # снимок 600×600; рамка из oma-crops.js в тех же координатах
            subprocess.run(["sips", "-z", "600", "600", tmp.name], check=True, capture_output=True)
            subprocess.run(["sips", "--cropOffset", str(y), str(x), "-c", str(h), str(w), tmp.name, "--out", str(dst)], check=True, capture_output=True)
        subprocess.run(["sips", "-Z", str(MAX), "-s", "formatOptions", "82", str(dst)], check=True, capture_output=True)
        print(pid, f"{w}×{h}", dst.stat().st_size // 1024, "КБ")
        time.sleep(PAUSE)


if __name__ == "__main__":
    main()
