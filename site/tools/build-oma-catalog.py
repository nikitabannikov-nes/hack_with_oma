"""Собирает site/oma-catalog.js из снимка товаров oma.by (JSON, собранный через браузер).

Запуск: python3 site/tools/build-oma-catalog.py oma-details.json
Формат входа: {id: {name, price, old, unit, sku, brand, rating, url, img, imgs, pt, specs, desc}}
  pt    — строка цен со страницы товара: «… 3,88BYN /шт. 15,73BYN /кв.м. 34,92BYN /уп.»
  specs — [[название, значение], …] из блока «Характеристики»
id совпадает с демо-товаром в data.js; id с префиксом x_ — дополнительный товар (наследует поля от LIKE[id]).
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
BASE = "https://www.oma.by"

# Дополнительные товары: от какого демо-товара берём роль/услугу/связи; tier сбрасываем
LIKE = {
    "x_lam1": "lam_opt", "x_lam2": "lam_opt", "x_lam3": "lam_opt", "x_lam4": "lam_opt", "x_lam5": "lam_opt",
    "x_tf1": "tf_opt", "x_tf2": "tf_opt", "x_tf3": "tf_wood", "x_tf4": "tf_wood",
    "x_tw1": "tw_opt", "x_tw2": "tw_opt", "x_tw3": "tw_opt",
    "x_glue1": "glue_opt", "x_glue2": "glue_opt", "x_glue3": "glue_opt", "x_glue4": "glue_opt",
    "x_trowel10": "trowel8", "x_trowel6": "trowel8", "x_spat100": "trowel8", "x_spat350": "trowel8", "x_spat450": "trowel8",
    "x_level1000": "level", "x_mixnoz": "mixer_d", "x_mixer950": "mixer_d", "x_handle": "roller", "x_roller2": "roller",
    "x_wedge": "clips", "x_cutter400": "cutter", "x_cross25": "cross2", "x_tape30": "tape_m", "x_seal2": "seal", "x_wp2": "wp_opt",
}
# Доп. товары, которые не должны участвовать в расчёте как «клипсы»
NO_ROLE = {"x_wedge"}
SKIP_SPECS = {"Единицы измерения", "Вес нетто", "Высота"}
PAINT_KG_PER_L = 1.4  # плотность ВД-краски, кг/л — чтобы перевести фасовку в литры для расчёта


def num(s):
    return float(str(s).replace(",", ".").replace(" ", ""))


def prices(pt):
    """«8,40BYN /шт. 37,81BYN /кв.м.» → {'шт': 8.4, 'кв.м': 37.81}"""
    return {u.strip(".").strip(): num(p) for p, u in re.findall(r"([\d\s]+,\d+)\s*BYN\s*/\s*(\S+)", pt)}


def spec(specs, *names):
    for n, v in specs:
        if any(x.lower() in n.lower() for x in names):
            return v
    return None


def first(rx, s, conv=num):
    m = re.search(rx, s, re.I)
    return conv(m.group(1)) if m else None


def tile_size(name, specs):
    m = re.search(r"(\d{3,4})\s*[xх×*]\s*(\d{3,4})", name)
    if m:
        a, b = sorted(round(int(x) / 10) for x in m.groups())
        return [a, b]
    L, W = spec(specs, "Длина"), spec(specs, "Ширина")
    if L and W:
        return sorted([round(num(L.split()[0])), round(num(W.split()[0]))])
    return None


def glue_class(name, specs):
    s = (spec(specs, "Класс") or "") + " " + name
    s = s.upper().replace("С", "C").replace("Т", "T").replace("Е", "E")  # кириллица → латиница
    m = re.search(r"C([012])\s*(T)?\s*(E)?\s*(S[12])?", s)
    return "C" + "".join(x for x in m.groups() if x) if m else None


def build(id_, r):
    name = r["name"].replace(" ", " ").strip()
    pr = prices(r.get("pt", ""))
    specs = [[n, v] for n, v in r.get("specs", []) if n not in SKIP_SPECS]
    o = {
        "name": name, "price": r["price"], "brand": r.get("brand") or None, "sku": r.get("sku"),
        "rating": float(r["rating"]) if r.get("rating") else None, "url": BASE + r["url"],
        "img": BASE + (r["imgs"][0] if r.get("imgs") else r["img"]),
        "imgs": [BASE + x for x in r.get("imgs", [])],
        "props": specs[:10] or None, "desc": re.sub(r"^Описание\s*", "", r.get("desc") or ""), "real": True,
        # СТМ ОМА отмечаем только у WERKER — про остальные бренды собственной марки не знаем
        "stm": bool(re.search(r"werker", name, re.I)),
    }
    old = r.get("old") or (first(r"^([\d\s]+,\d+)BYN\s+[\d\s]+,\d+BYN", r.get("pt", "")) if "экономия" in r.get("pt", "") else None)
    if old and old > r["price"]:
        o["oldPrice"] = old
    kind = LIKE.get(id_, id_)

    if kind.startswith(("lam_", "tw_", "tf_", "underlay_")):
        pack_m2 = None
        if "уп" in pr and "кв.м" in pr:
            pack_m2 = round(pr["уп"] / pr["кв.м"], 3)
            o.update(price=pr["уп"], priceM2=pr["кв.м"], unit="уп.")
        pack_m2 = first(r"([\d.,]+)", spec(specs, "Площадь пачки", "В упаковке, м²", "Площадь упаковки") or "") or pack_m2
        if not pack_m2:
            pack_m2 = first(r"S\s*=\s*([\d,.]+)", name) or first(r"([\d,.]+)\s*м2", name)
        if not pack_m2 and "м2" in pr:  # продаётся поштучно за м² — «упаковка» 1 м²
            pack_m2 = 1
            o.update(price=pr["м2"], priceM2=pr["м2"], unit="м²")
        if pack_m2:
            o["pack"] = {"q": round(pack_m2, 3), "u": "м²"}
            if "priceM2" not in o and kind.startswith("underlay_"):
                o["unit"] = "уп."
        if kind.startswith(("tw_", "tf_")):
            size = tile_size(name, specs)
            thick = first(r"(\d+(?:[.,]\d)?)\s*мм", spec(specs, "Толщина") or "") or first(r"\d{3,4}\s*[xх]\s*\d{3,4}\s*[xх]\s*([\d,.]+)", name)
            o["spec"] = {k: v for k, v in (("size", size), ("thick", thick)) if v}
    elif kind.startswith("glue_"):
        # класс по названию; если не указан — по назначению: «для грес» ≈ C1, иначе обычный C0
        cls = glue_class(name, specs) or ("C1" if "грес" in (spec(specs, "Тип") or "") else "C0")
        o["pack"] = {"q": first(r"(\d+)\s*кг", name) or 25, "u": "кг"}
        o["unit"] = "меш."
        o["spec"] = {"cls": cls, "maxTile": 120 if "S" in cls else 90 if cls.startswith("C2") else 60 if cls.startswith("C1") else 40}
        rate = first(r"([\d.]+)", spec(specs, "Расход смеси") or "")
        if rate:
            o["spec"]["rate"] = rate
        o["props"] = [["Класс", cls]] + (o["props"] or [])
    elif kind.startswith("grout_"):
        o["pack"] = {"q": first(r"([\d,.]+)\s*кг", name) or 2, "u": "кг"}
    elif kind.startswith(("primer_", "wp_")) and kind != "wp_tape":
        q = first(r"([\d,.]+)\s*(?:л|кг)\b", name)
        if q:
            o["pack"] = {"q": q, "u": "л" if re.search(r"[\d,.]+\s*л\b", name) else "кг"}
    elif kind == "wp_tape":
        m = first(r"(\d{4,5})\s*[xх]", name)
        o["pack"] = {"q": m / 1000 if m else first(r"([\d,.]+)\s*м", name) or 10, "u": "м"}
    elif kind.startswith(("pw_", "pc_")):
        kg, l = first(r"([\d,.]+)\s*кг", name), first(r"([\d,.]+)\s*л\b", name)
        litres = l or (round(kg / PAINT_KG_PER_L, 1) if kg else None)
        if litres:
            o["pack"] = {"q": litres, "u": "л"}
            if kg:
                o["props"] = [["Фасовка", f"{kg:g} кг ≈ {litres:g} л"]] + (o["props"] or [])
    elif kind.startswith("skirt_"):
        o["pack"] = {"q": first(r"([\d,.]+)\s*м\b", name) or 2.2, "u": "м"}
    elif kind == "clips":
        o["pack"] = {"q": first(r"(\d+)\s*шт", name) or 100, "u": "шт."}

    o = {k: v for k, v in o.items() if v is not None}
    if id_ in LIKE:
        o.update(id=id_, like=LIKE[id_], tier=None)
        if id_ in NO_ROLE:
            o["roles"] = []
    return o


def main(path):
    raw = json.load(open(path))
    by_id, extra = {}, []
    for id_, r in raw.items():
        o = build(id_, r)
        (extra.append(o) if id_ in LIKE else by_id.__setitem__(id_, o))
    js = (
        f"// Реальные товары гипермаркета ОМА: названия, цены, фото и характеристики с oma.by (снимок {date.today():%d.%m.%Y}).\n"
        "// Сгенерировано tools/build-oma-catalog.py — не править руками. Фото грузятся с oma.by по ссылке.\n"
        "(function(root){\nconst OMA=" + json.dumps({"byId": by_id, "extra": extra}, ensure_ascii=False, separators=(",", ":"))
        + ";\nif(typeof module!=='undefined')module.exports=OMA;else root.OMA_REAL=OMA;\n})(this);\n"
    )
    (SITE / "oma-catalog.js").write_text(js)
    print(f"oma-catalog.js: {len(by_id)} замен, {len(extra)} новых, {len(js) // 1024} КБ")
    for id_, o in list(by_id.items()) + [(x["id"], x) for x in extra]:
        print(f" {id_:14} {o['price']:>8} {o.get('unit', ''):5} pack={o.get('pack')} spec={o.get('spec')}  {o['name'][:55]}")


if __name__ == "__main__":
    main(sys.argv[1])
