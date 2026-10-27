"""Собирает из снимка главной oma.by дерево каталога (oma-menu.js) и спрайт иконок (img/oma-icons.svg).

Запуск: python3 site/tools/build-oma-chrome.py oma-home.json
oma-home.json — выгрузка со страницы oma.by: {banners: html блока меню, footer: html подвала, symbols: {id: <symbol>}}
"""
import html as H
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
d = json.load(open(sys.argv[1]))

# --- дерево каталога: левое меню + выпадающие колонки
b = d["banners"]
tops = re.findall(r'<a href="([^"]+)" class="section-menu_item[^"]*"[^>]*data-submenu="(\d+)"[^>]*>.*?#([\w-]+)".*?<span>([^<]+)</span>', b)
subs = re.split(r'<div class="section-submenu ', b)[1:]
menu = []
for (href, sid, icon, name), sub in zip(tops, subs):
    cols = []
    for col in re.split(r'<div class="section-submenu_col', sub)[1:]:
        groups = []
        for g in re.split(r'<div class="section-submenu_item', col)[1:]:
            t = re.search(r'accordion-item_title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)</a>', g)
            if not t:
                continue
            items = [[H.unescape(n).strip(), h] for h, n in re.findall(r'<a href="([^"]+)" class="section-submenu-sublink[^"]*"[^>]*>([^<]+)</a>', g)]
            groups.append({"t": H.unescape(t.group(2)).strip(), "h": t.group(1), "i": items})
        if groups:
            cols.append(groups)
    menu.append({"name": H.unescape(name).strip(), "h": href, "icon": icon, "cols": cols})

(SITE / "oma-menu.js").write_text(
    "// Дерево каталога гипермаркета ОМА (снимок oma.by). Сгенерировано tools/build-oma-chrome.py\n"
    "(function(root){root.OMA_MENU=" + json.dumps(menu, ensure_ascii=False, separators=(",", ":")) + "})(this);\n"
)
print("oma-menu.js:", len(menu), "разделов,", sum(len(g["i"]) for m in menu for c in m["cols"] for g in c), "подкатегорий")

# --- спрайт: иконки разделов каталога и шапки
need = {m["icon"] for m in menu} | {"icon__heart-header", "icon__heart", "icon__user", "icon__shopping-cart", "icon__search",
                                    "icon__search-main", "icon__stars", "icon__cart-add", "icon__location", "chevron-down",
                                    "eye", "like", "fire", "icon__percent", "icon__arrow-right", "icon__arrow-left", "check"}
syms = [d["symbols"][k] for k in sorted(need) if k in d["symbols"]] + list(d.get("footer_symbols", {}).values())
(SITE / "img" / "oma-icons.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:none">' + "".join(syms) + "</svg>")
print("oma-icons.svg:", len(syms), "иконок; нет:", sorted(need - set(d["symbols"])))

# --- соцсети из подвала: значки берём из footer.svg (d["footer_symbols"]) в тот же спрайт
soc = re.findall(r'<a [^>]*href="([^"]+)"[^>]*class="social-icon_cell social-icon__(\w+)"[^>]*>\s*<svg.*?#(social-[\w-]+)', d["footer"])
(SITE / "oma-social.js").write_text(
    "// Соцсети ОМА из подвала oma.by. Сгенерировано tools/build-oma-chrome.py\n(function(root){root.OMA_SOCIAL="
    + json.dumps([[n, h, s] for h, n, s in soc], ensure_ascii=False, separators=(",", ":")) + "})(this);\n"
)
print("oma-social.js:", len(soc), "соцсетей")
