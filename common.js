const LOGO='<svg viewBox="0 0 120 40"><path d="M2 20a18 18 0 0 1 18-18h4L10 38A18 18 0 0 1 2 20z" fill="#0057d6"/><path d="M26 38 40 4h6l14 34z" fill="#0057d6"/><path d="M60 38 74 4h6l14 34z" fill="#0057d6"/><path d="M26 38h20l-4-8zM60 38h20l-4-8z" fill="#fff" opacity=".0"/></svg>';
function chrome(active){
 const cart=JSON.parse(localStorage.getItem('omaCartN')||'0');
 document.querySelector('#chrome').innerHTML=`
 <div class="top"><div class="wrap"><span>Ваш регион: <b>Минск</b></span><span class="hide">Акции</span><span class="hide">Листовка</span><span class="hide">Оплата частями</span><span class="sp"></span><span>☎ 536-45-00</span></div></div>
 <header class="main"><div class="wrap">
  <a class="logo" href="index.html">${LOGO}<span>ГИПЕРМАРКЕТ<br>ОМА</span></a>
  <a class="cat" href="#">☰ Каталог</a>
  <div class="search"><input placeholder="Поиск по товарам и услугам"><b>Найти</b></div>
  <div class="hico"><a href="passport.html"><i>🏠</i>Паспорт дома</a><a href="#"><i>♡</i>Избранное</a><a href="cart.html"><i>🛒</i>Корзина<span class="cnt" id="cn" style="display:${cart?'inline':'none'}">${cart}</span></a></div>
 </div></header>
 <nav class="sub"><div class="wrap"><span>Интерьер и отделка</span><span>Сантехника</span><span>Инструмент</span><span>Стройматериалы</span><span>Электрика</span><b class="hot">ВСЕ АКЦИИ</b><span>Прокат</span><a href="index.html#services" style="color:var(--blue)">Услуги мастеров</a></div></nav>`;
 if(!/prorab/.test(location.pathname)) document.body.insertAdjacentHTML('beforeend','<a class="fab" href="prorab.html"><img src="img/omik-avatar.png" alt=""><span>Рассчитать ремонт</span></a>');
 document.body.insertAdjacentHTML('beforeend','<footer><div class="wrap"><div><b>ОМА Проект</b>Демо-прототип для Space Hackathon with ОМА<br>Визуальный концепт, не реальный сервис</div><div><b>Покупателям</b>Доставка · Оплата · Гарантия</div><div><b>Контакты</b>536-45-00 · oma.by</div></div></footer>');
}
function byn(n){return n.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).replace(',','.')+' BYN'}
