# ОМА Проект — демо-прототип (Space Hackathon with ОМА)

Запуск: `cd site && python3 -m http.server 8765` → http://localhost:8765/
Тесты геометрии и расчёта: `node site/tests/geom.test.js`

Модули: Омик (`omik.html` + виджет на всех страницах), 2D-калькулятор (`planner.html`),
каталог/товар/смета/корзина (`catalog.html`, `product.html`, `smeta.html`, `cart.html`, `share.html`),
мастера и заявки (`masters.html`), проекты (`projects.html`).
Общая модель: `core.js` (Project/Room/Estimate/ServiceRequest, localStorage `omaProject.v2`),
геометрия `geom.js`, расчёт материалов `calc.js`, данные `data.js`. Старые страницы — в `legacy/`.
