"""Собирает site/ui-icons.css — линейные иконки сайта вместо эмодзи, в стиле каталога oma.by.

Иконка — CSS-маска: <i class="ui ui-cart"></i> берёт цвет текста (currentColor) и размер шрифта.
Запуск: python3 site/tools/build-ui-icons.py
"""
from pathlib import Path
from urllib.parse import quote

SITE = Path(__file__).resolve().parent.parent

# Контуры 24×24, обводка 1,8, скруглённые концы
ICONS = {
    "cart": "<path d='M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L19.5 8H6'/><circle cx='9' cy='19.5' r='1.4'/><circle cx='17' cy='19.5' r='1.4'/>",
    "plan": "<path d='M4 4v16h16z'/><path d='M8 12v4h4z'/><path d='M4 8h2M4 12h2M4 16h2'/>",
    "list": "<rect x='5' y='4' width='14' height='17' rx='2'/><path d='M9 3h6v3H9zM8.5 11h7M8.5 15h5'/>",
    "worker": "<path d='M3 18h18'/><path d='M5 18a7 7 0 0 1 14 0'/><path d='M10 11V7h4v4'/>",
    "link": "<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>",
    "camera": "<rect x='3' y='7' width='18' height='13' rx='2'/><path d='M8 7l1.5-3h5L16 7'/><circle cx='12' cy='13.5' r='3.5'/>",
    "book": "<path d='M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2a2 2 0 0 0 2 2h14'/><path d='M8 7h8'/>",
    "tool": "<path d='M14.5 4.2a4.5 4.5 0 0 0-5 6L3.8 15.9a2 2 0 0 0 2.8 2.8l5.7-5.7a4.5 4.5 0 0 0 6-5l-2.8 2.8-2.6-.4-.4-2.6z'/>",
    "box": "<path d='M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z'/><path d='M3 7.5L12 12l9-4.5M12 12v9'/>",
    "folder": "<path d='M3 6h6l2 2h10v11H3z'/>",
    "sofa": "<path d='M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3'/><path d='M3 17v-5a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5z'/><path d='M5 17v2M19 17v2'/>",
    "bath": "<path d='M3 12h18v1.5a5.5 5.5 0 0 1-5.5 5.5h-7A5.5 5.5 0 0 1 3 13.5z'/><path d='M6 12V6.5a2.5 2.5 0 0 1 5 0'/><path d='M7 19l-1 2M17 19l1 2'/>",
    "wc": "<path d='M6 3h6v6H6z'/><path d='M4 9h14c0 4-3 7-7 7H9.5l-.8 5h6'/>",
    "kitchen": "<path d='M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z'/><path d='M2 10h2M20 10h2M9 6.5c0-1.2 1.2-1.2 1.2-2.5M14 6.5c0-1.2 1.2-1.2 1.2-2.5'/>",
    "door": "<path d='M6 21V3h12v18M3 21h18'/><path d='M14.5 12h.01'/>",
    "window": "<rect x='4' y='4' width='16' height='16' rx='1'/><path d='M12 4v16M4 12h16'/>",
    "check": "<path d='M5 12.5l4.5 4.5L19 7'/>",
    "clock": "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3.5 2'/>",
    "level": "<rect x='2' y='8.5' width='20' height='7' rx='1.5'/><circle cx='12' cy='12' r='1.6'/><path d='M7 8.5v2.5M17 8.5v2.5'/>",
    "print": "<path d='M7 8V3h10v5'/><path d='M7 17H4V9h16v8h-3'/><path d='M7 14h10v7H7z'/>",
    "chat": "<path d='M4 5h16v11H10l-5 4v-4H4z'/>",
    "bell": "<path d='M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z'/><path d='M10 21h4'/>",
    "warn": "<path d='M12 3.5L21.5 20h-19z'/><path d='M12 10v4.5M12 17.5h.01'/>",
    "edit": "<path d='M4 20h4L19 9l-4-4L4 16z'/><path d='M13.5 6.5l4 4'/>",
    "magnet": "<path d='M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4z'/><path d='M5 8h4M15 8h4'/>",
    "home": "<path d='M3 11l9-7 9 7'/><path d='M5 9.5V20h14V9.5'/>",
    "phone": "<path d='M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z'/>",
    "menu": "<path d='M4 6h16M4 12h16M4 18h16'/>",
    "heart": "<path d='M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z'/>",
    "tile": "<rect x='3' y='3' width='8' height='8' rx='1'/><rect x='13' y='3' width='8' height='8' rx='1'/><rect x='3' y='13' width='8' height='8' rx='1'/><rect x='13' y='13' width='8' height='8' rx='1'/>",
    "bucket": "<path d='M5 9h14l-1.6 11H6.6z'/><path d='M7 9a5 5 0 0 1 10 0'/>",
    "paint": "<rect x='3' y='3' width='14' height='6' rx='1.5'/><path d='M17 6h3v5h-8v3'/><rect x='10.5' y='14' width='3' height='7' rx='1'/>",
    "floor": "<rect x='3' y='4' width='18' height='16' rx='1'/><path d='M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M7 14.7V20'/>",
    "drop": "<path d='M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z'/>",
    "bulb": "<path d='M9 18h6M10 21h4'/><path d='M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z'/>",
    "user": "<circle cx='12' cy='8' r='4'/><path d='M4 21a8 8 0 0 1 16 0'/>",
    "plus": "<path d='M12 5v14M5 12h14'/>",
    "copy": "<rect x='8' y='8' width='12' height='12' rx='2'/><path d='M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'/>",
    "cube": "<path d='M12 3l8 4.5v9L12 21l-8-4.5v-9z'/><path d='M4 7.5l8 4.5 8-4.5M12 12v9'/>",
    "flag": "<path d='M5 21V4h11l-1.5 4L16 12H5'/>",
}


def svg(body):
    s = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' "
         f"stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>{body}</svg>")
    return "url(\"data:image/svg+xml," + quote(s, safe="/:=' ") + "\")"


def main():
    css = ["/* Сгенерировано tools/build-ui-icons.py — не править руками. Линейные иконки вместо эмодзи: <i class=\"ui ui-cart\"></i> */",
           ".ui{display:inline-block;flex:none;width:1.2em;height:1.2em;vertical-align:-.25em;background:currentColor;"
           "-webkit-mask:var(--ui) center/contain no-repeat;mask:var(--ui) center/contain no-repeat}",
           # отступ до подписи; у иконки без подписи — класс solo
           ".ui{margin-right:.4em}.ui.solo{margin-right:0}",
           ".btn .ui,.oma-act .ui{width:1.25em;height:1.25em}"]
    css += [f".ui-{k}{{--ui:{svg(v)}}}" for k, v in ICONS.items()]
    (SITE / "ui-icons.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    print(len(ICONS), "иконок → ui-icons.css")


if __name__ == "__main__":
    main()
