// Омик — AI-прораб ОМА. Демо-режим: распознавание намерений по правилам, без внешней LLM и без ключей в коде.
// Омик не считает материалы сам: количества даёт calc.js, цены — каталог.
const Omik=(()=>{
 const CK='omaChat.v2';
 let st=null,host=null,busy=false;
 const norm=t=>String(t||'').toLowerCase().replace(/ё/g,'е');
 const fl=s=>parseFloat(String(s).replace(',','.'));
 function loadSt(){if(st)return st;try{st=JSON.parse(localStorage.getItem(CK))}catch(e){}if(!st||!st.msgs)st={msgs:[],slots:{},last:[]};return st}
 function saveSt(){st.msgs=st.msgs.slice(-60);localStorage.setItem(CK,JSON.stringify(st))}
 const ctx=()=>window.OMIK_CTX||{};
 const proj=()=>getProject(ctx().projectId)||activeProject();

 // ---------- Разбор фразы ----------
 function parse(text){
  const t=norm(text),o={};
  if(/ванн(ой|ая|ую|е)(?![а-я])|ванной комнат/.test(t))o.room='bath';else if(/санузел|санузл|туалет|уборн/.test(t))o.room='wc';else if(/кухн/.test(t))o.room='kitchen';else if(/комнат|спальн|гостин|детск|(?<![а-я])зал(?![а-я])/.test(t))o.room='living';else if(/коридор|прихож/.test(t))o.room='hall';
  if(/плитк|кафел|керамогранит/.test(t))o.work='tile';else if(/покрас|покраш|краск/.test(t))o.work='paint';else if(/ламинат/.test(t))o.work='laminate';
  if(o.work==='tile'){if(/только\s+пол|на пол(?![а-я])(?!.*стен)/.test(t))o.part='floor';else if(/только\s+стен|на стен(ы|ах)?(?![а-я])(?!.*пол)/.test(t))o.part='walls';else if(/пол.*стен|стен.*пол/.test(t))o.part='both'}
  const d=t.match(/(\d+(?:[.,]\d+)?)\s*(?:м|см)?\s*(?:[xх×*]|на)\s*(\d+(?:[.,]\d+)?)/);
  if(d){let a=fl(d[1]),b=fl(d[2]);if(a>20)a/=100;if(b>20)b/=100;if(a>=0.5&&b>=0.5){o.L=a;o.W=b}}
  const ar=t.match(/(\d+(?:[.,]\d+)?)\s*(?:м2|м²|кв\.?\s*м|квадрат)/);if(ar&&!o.L)o.area=fl(ar[1]);
  const h=t.match(/высот\D{0,12}(\d+(?:[.,]\d+)?)/);if(h){let x=fl(h[1]);if(x>10)x/=100;o.h=x}
  const b=t.match(/(?:бюджет\D{0,15}|до\s+|за\s+|в пределах\s+|не дороже\s+)(\d[\d\s]{1,6})\s*(?:byn|руб|р(?![а-я])|бел|br)?/);if(b&&/бюджет|byn|руб|р(?![а-я])|бел/.test(t)){const n=+b[1].replace(/\s/g,'');if(n>=50)o.budget=n}
  if(/г-образ|г образ|буквой г/.test(t))o.shape='L';else if(/п-образ|п образ/.test(t))o.shape='U';else if(/ниш/.test(t))o.shape='niche';else if(/скос|скошен/.test(t))o.shape='chamfer';
  return{t,o};
 }
 const SVC_KW=[[/смесител|кран/,'svc_mixer'],[/унитаз/,'svc_wc'],[/раковин|тумб/,'svc_sink'],[/полотенцесуш/,'svc_rail'],[/вентилят|вытяжк/,'svc_fan'],[/замер/,'svc_measure'],[/ламинат/,'svc_lam'],[/покрас|краск/,'svc_paint'],[/потол/,'svc_ceil'],[/плитк|кафел/,'svc_tile_wall'],[/ванн/,'svc_bath']];
 const PROD_KW=/клей|затирк|смесител|краск|ламинат|грунт|гидроизол|унитаз|полотенцесуш|вентилятор|шпател|валик|плиткорез|свп|выравниван|плинтус|подложк|герметик|раковин|трап|крестик|уровень|миксер|керамогранит|плитк|светильник|ванн[ау](?![а-я])/;
 const FAQ=[
  [/клей.*керамогранит|керамогранит.*клей|какой клей/,'Для керамогранита и плитки от 60 см нужен клей класса <b>C2</b> (усиленный), лучше C2TE. Для форматов 60×120 и тёплого пола — C2TE S1 (деформируемый). Клей C1 подходит для керамической плитки до ~45 см. В нашей смете Омик предупредит, если клей не подходит к формату.'],
  [/c1.*c2|c2.*c1|чем отлича.*кле/,'C1 — обычный клей, C2 — усиленный (выше адгезия). Буквы: <b>T</b> — плитка не сползает со стены, <b>E</b> — увеличенное открытое время, <b>S1</b> — деформируемый, для крупного формата и тёплого пола.'],
  [/гидроизоляц.*нужн|нужн.*гидроизоляц|зачем гидроизол/,'Во влажных помещениях — да: обмазочная гидроизоляция по полу и на 20 см на стены, в душевой зоне — выше. Углы и стыки проклеивают лентой. В калькуляторе это включается галочкой «Влажное помещение».'],
  [/сколько слоев|слоев краск|в сколько слоев/,'Обычно 2 слоя по загрунтованной поверхности. Калькулятор считает расход по укрывистости конкретной краски (м²/л на слой) из её характеристик.'],
  [/ламинат.*кухн|кухн.*ламинат|влагостойк.*ламинат/,'Для кухни и коридора берите влагостойкий ламинат 33 класса и выше. Вокруг мойки и у входа надёжнее керамогранит.'],
  [/запас|сколько брать сверху|на подрезку/,'Для прямой укладки обычно 10%, для сложной формы (Г-, П-образная, много углов) и диагонали — 15%. Запас меняется во вкладке «Отделка» планировщика, количество округляется до целых упаковок.'],
  [/сохнет|высыха|через сколько/,'Сроки зависят от конкретной смеси — смотрите техкарту на упаковке. Точные сроки я не придумываю: в демо у меня нет данных производителя по каждому товару.'],
  [/доставк/,'В демо доставка условная: при оформлении можно выбрать самовывоз или доставку. Реальные условия доставки ОМА в прототип не подключены.'],
  [/гарант|остат|налич|скидк|акци/,'В демо у меня нет реальных остатков, акций и гарантийных условий — я не буду их выдумывать. Цены в прототипе условные.']
 ];

 // ---------- Ответы ----------
 const B=(html,o={})=>({who:'b',html,...o});
 function reply(text){
  const{t,o}=parse(text),s=loadSt(),sl=s.slots;
  // Ответы на уточнения — продолжаем сценарий ремонта
  if(sl.active&&(o.L||o.area||o.budget!=null||o.room||o.work||o.part||o.shape||/без огранич|не знаю|пропуст|нет бюджет/.test(t))){merge(sl,o,t);return renovation()}
  if(/^(привет|здравств|добр|хай|hello)|что (ты )?умеешь|помоги|помощь/.test(t))return[hello(true)];
  if(/удешев|дешевле.*смет|сэконом|уложусь|бюджет.*смет|в бюджет/.test(t)&&proj())return cheaper();
  if(/объясни|как посчитал|почему столько|откуда/.test(t)&&proj())return explain();
  if(/сравн|чем отлича|разниц/.test(t)&&!/c1|c2|кле/.test(t))return compare();
  if(/аналог|подешевле|замен|похож|дешевле/.test(t))return analog(t);
  const svcHit=SVC_KW.find(([r])=>r.test(t));
  if(/мастер|установ|уложит|монтаж|бригад|кто (может|сделает)|вызвать|замерщик|замер/.test(t))return masterReply(svcHit?svcHit[1]:null);
  const faq=FAQ.find(([r])=>r.test(t));if(faq)return[B(faq[1]+'<p class="note" style="margin-top:6px">Справка Омика в демо-режиме — общие рекомендации, не замена инструкции производителя.</p>')];
  const renov=o.room||o.L||o.area||o.shape||/ремонт|положит|уложить|поменять|сделать|обновить|переделать|покрасить|постелить|отделк/.test(t);
  if(renov&&(o.room||o.work||o.L||o.area)){s.slots={active:true};merge(s.slots,o,t);return renovation()}
  if(PROD_KW.test(t)||searchProducts(t,1).length&&t.length>3)return productReply(t,o);
  return[B('Пока я в демо-режиме и понимаю такие задачи: <b>ремонт помещения</b> («плитка в ванной 2 на 1,7»), <b>поиск товара</b> («клей для керамогранита»), <b>аналоги и сравнение</b>, <b>мастера</b> («установить смеситель»), вопросы по своей смете.',{opts:[{l:'Плитка в ванной, бюджет 1500',a:'say'},{l:'Покрасить комнату 4 на 3',a:'say'},{l:'Клей для керамогранита',a:'say'},{l:'Установить смеситель',a:'say'}]})];
 }
 function merge(sl,o,t){
  Object.assign(sl,Object.fromEntries(Object.entries(o).filter(([,v])=>v!=null)));
  if(/без огранич|нет бюджет|пропуст/.test(t))sl.budget=0;
  if(o.area&&!o.L){sl.L=null;sl.W=null}
 }
 function hello(full){
  const c=ctx(),p=proj();
  let h='Привет! Я <b>Омик</b>, AI-прораб ОМА. Помогу рассчитать ремонт, подобрать материалы под бюджет и найти мастера.';
  const opts=[{l:'Плитка в ванной, бюджет до 1500 BYN',a:'say'},{l:'Покрасить комнату 4 на 3',a:'say'},{l:'Найти клей для керамогранита',a:'say'},{l:'Установить смеситель',a:'say'}];
  if(c.page==='smeta'&&p){h=`Это смета проекта «${esc(p.title)}». Могу объяснить, как посчитано количество, и подсказать, как уложиться в бюджет.`;opts.splice(0,4,{l:'Объясни расчёт',a:'say'},{l:'Как удешевить смету?',a:'say'},{l:'Нужен мастер',a:'say'})}
  if(c.page==='planner'&&p){h='Помогу с планом. Г-образную или П-образную комнату выберите в «Форма», сложную — нарисуйте по точкам. Количества пересчитаются сами.';opts.splice(0,4,{l:'Какой запас брать?',a:'say'},{l:'Нужна ли гидроизоляция?',a:'say'},{l:'Объясни расчёт',a:'say'})}
  if(c.page==='product'&&c.productId){const pr=P(c.productId);h=`Смотрите «${esc(pr.name)}». Могу посчитать нужное количество по плану комнаты, найти аналог или мастера для установки.`;
   opts.splice(0,4,...[pr.roles.length?{l:'Рассчитать количество',a:'go',arg:'product.html?id='+pr.id+'#calc'}:null,{l:'Найди аналог дешевле',a:'say'},pr.service?{l:'Нужен мастер для установки',a:'say'}:null].filter(Boolean))}
  return B(h+(full?'<p class="note" style="margin-top:6px">Демо-режим: отвечаю по сценариям, без внешней LLM. Цены и количества беру из каталога и калькулятора.</p>':''),{opts});
 }
 function renovation(){
  const sl=loadSt().slots;
  if(!sl.room){const tile=sl.work==='tile';return[B('Какое помещение ремонтируем?',{opts:(tile?['Ванная','Санузел','Кухня']:['Комната','Кухня','Коридор']).map(l=>({l,a:'say'}))})]}
  if(!sl.work){return[B(`${RT[sl.room].name}: что делаем?`,{opts:(['bath','wc'].includes(sl.room)?['Плитка на пол и стены','Плитка только на пол','Покраска стен']:['Покраска стен','Ламинат на пол','Плитка на пол']).map(l=>({l,a:'say'}))})]}
  if(sl.work==='tile'&&!sl.part&&['bath','wc'].includes(sl.room))sl.part='both';
  if(!sl.L&&!sl.shape){
   if(sl.area){const W=Math.round(Math.sqrt(sl.area/1.3)*20)/20,L=Math.round(sl.area/W*20)/20;
    return[B(`Площадь ${num(sl.area)} м² есть, но для стен нужны длина и ширина. Напишите их, например «2,2 на 1,7». Или посчитаю как прямоугольник ${num(L)} × ${num(W)} м — потом поправите на плане.`,{opts:[{l:`Считай ${num(L)} × ${num(W)} м`,a:'say',arg:`${L} на ${W}`},{l:'Комната не прямоугольная',a:'say',arg:'Г-образная'}]})]}
   return[B('Какие размеры помещения? Напишите длину и ширину, например <b>«2,2 на 1,7»</b>.',{opts:[{l:'2,2 × 1,7 м',a:'say',arg:'2,2 на 1,7'},{l:'1,5 × 1,2 м',a:'say',arg:'1,5 на 1,2'},{l:'4 × 3 м',a:'say',arg:'4 на 3'},{l:'Г-образная — нарисую план',a:'say',arg:'Г-образная'}]})]}
  if(sl.budget==null)return[B('Есть бюджет на материалы? Подберу комплектацию, которая в него помещается.',{opts:[{l:'до 800 BYN',a:'say',arg:'бюджет 800 BYN'},{l:'до 1500 BYN',a:'say',arg:'бюджет 1500 BYN'},{l:'до 3000 BYN',a:'say',arg:'бюджет 3000 BYN'},{l:'Без ограничений',a:'say'}]})];
  return createFromSlots();
 }
 function surfaces(r,sl){
  if(sl.work==='tile'){r.floor=sl.part==='walls'?'none':'tile';r.walls.forEach(w=>w.finish=sl.part==='floor'?'paint':'tile')}
  if(sl.work==='paint'){r.walls.forEach(w=>w.finish='paint');r.floor='none'}
  if(sl.work==='laminate'){r.floor='laminate';r.walls.forEach(w=>w.finish='none')}
 }
 function createFromSlots(){
  const s=loadSt(),sl=s.slots,kind=sl.shape||'rect';
  const r=kind==='rect'?makeRoom(sl.room,'rect',{L:sl.L,W:sl.W}):makeRoom(sl.room,kind);
  if(sl.h)r.h=sl.h;surfaces(r,sl);
  const workN={tile:'плитка',paint:'покраска',laminate:'ламинат'}[sl.work];
  const p=newProject({title:`${RT[sl.room].name}: ${workN}`,task:sl.room,rooms:[r],budget:sl.budget||null,source:'omik',logText:'Проект создан Омиком из диалога'});
  // Комплектация под бюджет: самая полная, которая помещается
  let tier='opt';const tt={};['eco','opt','prem'].forEach(k=>tt[k]=tierTotal(p,k));
  if(sl.budget){tier=['prem','opt','eco'].find(k=>tt[k]!=null&&tt[k]<=sl.budget)||'eco'}
  p.tier=tier;recalc(p);addProject(p);s.slots={};s.lastProject=p.id;
  const m=Geom.metrics(r),tot=estTotal(p),fit=!sl.budget||tot<=sl.budget;
  const card=`<div class="card-in"><div class="row"><span>Помещение</span><b>${RT[sl.room].name}${kind==='rect'?`, ${num(sl.L)} × ${num(sl.W)} м`:`, ${Geom.TEMPLATES[kind].name.toLowerCase()}`}</b></div>
   <div class="row"><span>Пол</span><b>${num(m.floor)} м²</b></div><div class="row"><span>Стены без проёмов</span><b>${num(m.wallNet)} м²</b></div>
   <div class="row"><span>Комплектация</span><b>${TIERS[tier]}</b></div><div class="row"><span>Материалы, ${p.est.lines.length} поз.</span><b>${byn(tot)}</b></div>
   ${sl.budget?`<div class="row"><span>Бюджет</span><b style="color:${fit?'var(--ok)':'var(--red)'}">${byn(sl.budget)} ${fit?'✓':'— не помещается'}</b></div>`:''}</div>`;
  let h=`Готово! Создал проект и посчитал материалы.${card}<p class="note" style="margin-top:6px">Количество посчитал калькулятор по площадям и нормам расхода товаров, цены взяты из каталога.${kind!=='rect'?' Форму я поставил типовую — задайте точные размеры на плане.':''}</p>`;
  const opts=[{l:'📐 Открыть 2D-план',a:'go',arg:`planner.html?project=${p.id}&from=omik`,pri:kind!=='rect'},{l:'📋 Смета',a:'go',arg:`smeta.html?project=${p.id}`,pri:kind==='rect'},{l:'👷 Подобрать мастера',a:'go',arg:`masters.html?project=${p.id}`}];
  if(!fit){h+=`<p>Даже «${TIERS[tier]}» выходит на ${byn(tot-sl.budget)} дороже бюджета. Можно уменьшить объём: плитка только на пол, а стены — покраска.</p>`;opts.unshift({l:'Стены — покраска вместо плитки',a:'mod',arg:p.id+':wallsPaint',pri:true})}
  else if(sl.budget&&tier!=='prem'){const up=['eco','opt','prem'][['eco','opt','prem'].indexOf(tier)+1];h+=`<p class="note">«${TIERS[up]}» стоил бы ${byn(tt[up])} — выше бюджета.</p>`}
  return[B(h,{opts})];
 }
 function productReply(t,o){
  let L=searchProducts(t,12);
  if(o.budget)L=L.filter(x=>x.price<=o.budget);
  if(/керамогранит/.test(t)&&/клей/.test(t))L=L.filter(x=>x.roles.includes('glue')&&x.spec.maxTile>=60);
  L=L.slice(0,4);
  if(!L.length)return[B('В демо-каталоге такого не нашёл. Попробуйте сформулировать иначе или откройте <a href="catalog.html">каталог</a>.')];
  loadSt().last=L.map(x=>x.id);
  const stm=L.find(x=>x.stm);
  return[B(`Нашёл в каталоге ${L.length} ${L.length===1?'товар':'товара'}${stm?'. Есть вариант собственной марки ОМА — обычно дешевле при сопоставимых характеристиках':''}:`,{pcs:L.map(x=>x.id),opts:[L.length>1?{l:'Сравнить',a:'say',arg:'Сравни их'}:null,{l:'Показать все в каталоге',a:'go',arg:'catalog.html?q='+encodeURIComponent(t)}].filter(Boolean)})];
 }
 function analog(t){
  const s=loadSt(),base=P(ctx().productId)||P(s.last[0]);
  if(!base){const L=searchProducts(t,1);if(L.length)return analogOf(L[0]);return[B('Аналог чего ищем? Откройте товар или напишите название, например «аналог клея C2TE».')]}
  return analogOf(base);
 }
 function analogOf(base){
  const A=analogs(base.id).slice(0,4);if(!A.length)return[B(`Для «${esc(base.name)}» аналогов в демо-каталоге нет.`)];
  loadSt().last=[base.id,...A.map(x=>x.id)].slice(0,3);
  const rows=A.map(x=>{const d=x.price-base.price;return`<div class="row"><span>${esc(x.name)}${x.stm?' <span class="tag stm">СТМ</span>':''}</span><b style="color:${d<0?'var(--ok)':'var(--ink)'}">${d<0?'−':'+'}${byn(Math.abs(d))}</b></div>`}).join('');
  return[B(`Аналоги для «${esc(base.name)}» (${byn(base.price)}):<div class="card-in">${rows}</div><p class="note" style="margin-top:6px">Сравнивайте характеристики: дешевле не всегда равноценно. Например, класс клея или стойкость краски к мытью.</p>`,{pcs:A.slice(0,3).map(x=>x.id),opts:[{l:'Сравнить характеристики',a:'say',arg:'Сравни их'}]})];
 }
 function compare(){
  const ids=loadSt().last.slice(0,3).filter(P);
  if(ids.length<2)return[B('Сначала найдите 2–3 товара — например, «покажи клей для плитки», — и я их сравню.')];
  const L=ids.map(P),keys=[...new Set(L.flatMap(x=>(x.props||[]).map(q=>q[0])))].slice(0,6);
  const tbl=`<div style="overflow:auto"><table class="cmp" style="font-size:12px;margin-top:8px"><tr><th></th>${L.map(x=>`<td><b>${esc(x.name)}</b></td>`).join('')}</tr><tr><th>Цена</th>${L.map(x=>`<td><b>${byn(x.price)}</b></td>`).join('')}</tr>${keys.map(k=>`<tr><th>${k}</th>${L.map(x=>`<td>${esc((x.props.find(q=>q[0]===k)||[,'—'])[1])}</td>`).join('')}</tr>`).join('')}</table></div>`;
  return[B('Сравнение по характеристикам из карточек товаров:'+tbl,{opts:[{l:'Открыть подробное сравнение',a:'go',arg:'catalog.html?cmp='+ids.join(',')}]})];
 }
 function masterReply(sid){
  const p=proj();
  if(!sid){return[B('Какую работу нужно сделать?',{opts:[{l:'Установить смеситель',a:'say'},{l:'Уложить плитку',a:'say',arg:'Нужен мастер уложить плитку'},{l:'Покрасить стены',a:'say',arg:'Мастер покрасить стены'},{l:'Замер помещения',a:'say',arg:'Нужен замерщик'}]})]}
  const sv=svc(sid),ms=MASTERS.filter(m=>m.cats.includes(sv.cat)),e=svcEstimate(sv,p);
  const vol=sv.area&&p&&e.q?` По вашему проекту это ${num(e.q,1)} ${sv.unit}, ориентировочно <b>${byn(e.sum)}</b>.`:'';
  return[B(`«${sv.name}» — от <b>${byn(sv.price)}</b> за ${sv.unit}.${vol} Доступно мастеров: ${ms.length}, ближайший выезд — ${fmtDay(now()+Math.min(...ms.map(m=>m.days))*DAY)}.<p class="note" style="margin-top:6px">Мастера, цены и даты в прототипе демонстрационные. Работы оплачиваются мастеру, ОМА не гарантирует их в демо.</p>`,
   {opts:[{l:'Выбрать мастера',a:'go',arg:`masters.html?service=${sid}${p?'&project='+p.id:''}`,pri:true},{l:'Оставить заявку',a:'go',arg:`masters.html?service=${sid}${p?'&project='+p.id:''}#new`}]})];
 }
 function cheaper(){
  const p=proj();if(!p.calc?.ok)return[B('В проекте ошибка геометрии — сначала исправьте план, потом посчитаю.',{opts:[{l:'Открыть план',a:'go',arg:'planner.html?project='+p.id}]})];
  const tot=estTotal(p),tt={};['eco','opt','prem'].forEach(k=>tt[k]=tierTotal(p,k));
  const ideas=p.est.lines.filter(l=>l.role).map(l=>{const cur=P(l.pid),alt=analogs(l.pid).filter(x=>x.price<cur.price&&x.roles.includes(l.role)).sort((a,b)=>a.price-b.price)[0];if(!alt)return null;
   const tmp=JSON.parse(JSON.stringify(p));tmp.pinned={...tmp.pinned,[l.role]:alt.id};const res=Calc.compute(tmp),nl=res.lines.find(x=>x.role===l.role);const save=lineTotal(l)-(nl?alt.price*nl.qty:0);return save>1?{l,alt,save}:null}).filter(Boolean).sort((a,b)=>b.save-a.save).slice(0,3);
  let h=`Сейчас материалы — <b>${byn(tot)}</b> («${TIERS[p.tier]}»)${p.budget?`, бюджет ${byn(p.budget)} — ${tot<=p.budget?'<span style="color:var(--ok)">помещаетесь ✓</span>':`<span style="color:var(--red)">выше на ${byn(tot-p.budget)}</span>`}`:''}.`;
  h+=`<div class="card-in">${['eco','opt','prem'].map(k=>`<div class="row"><span>${TIERS[k]}</span><b>${tt[k]!=null?byn(tt[k]):'—'}</b></div>`).join('')}</div>`;
  if(ideas.length)h+=`<p style="margin-top:8px">Где можно сэкономить без смены всей комплектации:</p>`;
  return[B(h,{opts:[...ideas.map(x=>({l:`${ROLES[x.l.role]}: ${x.alt.name.split(',')[0]} (−${byn(x.save)})`,a:'pin',arg:`${p.id}:${x.l.role}:${x.alt.id}`})),p.tier!=='eco'?{l:'Перейти на «Эконом»',a:'tier',arg:p.id+':eco'}:null].filter(Boolean)})];
 }
 function explain(){
  const p=proj(),L=p.est.lines.filter(l=>l.role&&l.basis).slice(0,5);
  if(!L.length)return[B('В смете пока нет рассчитанных позиций.')];
  return[B(`Я не придумываю количество — его считает калькулятор по площадям плана и нормам товара:<div class="card-in">${L.map(l=>`<div style="padding:4px 0"><b>${ROLES[l.role]}: ${l.qty} ${P(l.pid).unit}</b><br><span class="note">${esc(l.basis)}</span></div>`).join('')}</div>`,{opts:[{l:'Открыть смету',a:'go',arg:'smeta.html?project='+p.id}]})];
 }

 // ---------- Действия кнопок ----------
 function act(a,arg,label){
  if(a==='say')return send(arg||label);
  if(a==='go'){location=arg;return}
  if(a==='cart'){cartAdd(arg,1);toast('🛒 Добавлено в корзину');return}
  if(a==='est'){const p=ensureProject('bath');const r=addLine(p,arg,1,'omik');save();toast(r.dup?'Уже есть в смете':`📋 В смете «${esc(p.title)}»`);return}
  if(a==='pin'){const[pid,role,alt]=arg.split(':'),p=getProject(pid);p.pinned[role]=alt;recalc(p);touchEst(p,`Омик: замена «${ROLES[role]}» на более дешёвую`);save();push(B(`Заменил. Новая сумма материалов: <b>${byn(estTotal(p))}</b>.`,{opts:[{l:'Открыть смету',a:'go',arg:'smeta.html?project='+p.id}]}));if(ctx().page==='smeta'&&window.renderSmeta)renderSmeta();return}
  if(a==='tier'){const[pid,t]=arg.split(':'),p=getProject(pid);p.tier=t;recalc(p);touchEst(p,'Комплектация: '+TIERS[t]);save();push(B(`Перешли на «${TIERS[t]}»: ${byn(estTotal(p))}.`,{opts:[{l:'Открыть смету',a:'go',arg:'smeta.html?project='+p.id}]}));if(window.renderSmeta)renderSmeta();return}
  if(a==='mod'){const[pid]=arg.split(':'),p=getProject(pid);p.rooms.forEach(r=>r.walls.forEach(w=>w.finish='paint'));recalc(p);p.tier=['prem','opt','eco'].find(k=>{const x=tierTotal(p,k);return p.budget&&x!=null&&x<=p.budget})||'eco';recalc(p);touchEst(p,'Омик: стены под покраску вместо плитки');save();
   const tot=estTotal(p);push(B(`Пересчитал: стены — покраска, пол — плитка. «${TIERS[p.tier]}»: <b>${byn(tot)}</b>${p.budget?(tot<=p.budget?' — в бюджете ✓':' — всё ещё выше бюджета'):''}.`,{opts:[{l:'📋 Смета',a:'go',arg:'smeta.html?project='+p.id,pri:true},{l:'📐 План',a:'go',arg:'planner.html?project='+p.id}]}));return}
 }

 // ---------- Отрисовка ----------
 function msgHTML(m,i){
  if(m.who==='u')return`<div class="m u"><div class="b">${esc(m.text)}</div></div>`;
  const pcs=(m.pcs||[]).map(P).filter(Boolean).map(x=>`<div class="mp">${pimg(x)}<div><a href="product.html?id=${x.id}" style="font-weight:600">${esc(x.name)}</a><b>${byn(x.price)}</b><div class="act"><button data-a="est" data-arg="${x.id}">В смету</button><button data-a="cart" data-arg="${x.id}">В корзину</button></div></div></div>`).join('');
  const opts=(m.opts||[]).map(o=>`<button class="${o.pri?'pri':''}" data-a="${o.a}" data-arg="${esc(o.arg||'')}" ${m.used&&o.a==='say'?'disabled':''}>${esc(o.l)}</button>`).join('');
  return`<div class="m" data-i="${i}"><img src="img/omik-avatar.png" alt=""><div class="b">${m.html}${pcs?`<div class="pcs">${pcs}</div>`:''}${opts?`<div class="opts">${opts}</div>`:''}</div></div>`;
 }
 function render(){if(!host)return;const box=host.querySelector('.msgs');box.innerHTML=loadSt().msgs.map(msgHTML).join('');box.scrollTop=1e9}
 function push(m){loadSt().msgs.push(m);saveSt();render()}
 function send(text){
  text=String(text||'').trim();if(!text||busy)return;
  const s=loadSt();s.msgs.forEach(m=>{if(m.opts)m.used=true});push({who:'u',text});
  busy=true;const box=host.querySelector('.msgs');box.insertAdjacentHTML('beforeend','<div class="m typing"><img src="img/omik-avatar.png" alt=""><div class="b"><div class="dots"><i></i><i></i><i></i></div></div></div>');box.scrollTop=1e9;
  setTimeout(()=>{busy=false;let out;try{out=reply(text)}catch(e){console.error(e);out=[B('Что-то пошло не так в демо-сценарии. Попробуйте переформулировать.')]}out.forEach(m=>loadSt().msgs.push(m));saveSt();render();updateBadges()},550);
 }
 function suggestions(){
  const c=ctx();
  if(c.page==='smeta')return['Объясни расчёт','Как удешевить смету?','Нужен мастер','Какой клей для керамогранита?'];
  if(c.page==='planner')return['Какой запас брать?','Нужна ли гидроизоляция?','Объясни расчёт'];
  if(c.page==='product')return['Найди аналог дешевле','Нужен мастер для установки','Сравни с аналогами'];
  return['Плитка в ванной 2,2 на 1,7, бюджет 1500','Покрасить комнату 4 на 3','Клей для керамогранита','Установить смеситель'];
 }
 function mount(el){
  host=el;
  el.innerHTML=`<div class="chat"><div class="chd"><img src="img/omik-avatar.png" alt="Омик"><div><b>Омик · AI-прораб ОМА</b><small>Демо-режим · сценарии без внешней LLM</small></div>${el.dataset.close?'<button class="x" title="Закрыть" onclick="OmikWidget.close()">×</button>':''}</div>
   <div class="msgs"></div><div class="csug">${suggestions().map(s=>`<button>${esc(s)}</button>`).join('')}</div>
   <form class="cin"><input placeholder="Например: плитка в ванной 2,2 на 1,7, бюджет 1500" aria-label="Сообщение Омику"><button class="btn">→</button></form></div>`;
  el.querySelector('form').onsubmit=e=>{e.preventDefault();const i=e.target.querySelector('input');send(i.value);i.value=''};
  el.querySelectorAll('.csug button').forEach(b=>b.onclick=()=>send(b.textContent));
  el.querySelector('.msgs').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;act(b.dataset.a,b.dataset.arg,b.textContent)});
  const s=loadSt();
  const last=s.msgs[s.msgs.length-1];
  if(!s.msgs.length||ctx().page&&s.ctxPage!==ctx().page+(ctx().productId||'')){s.ctxPage=ctx().page+(ctx().productId||'');s.msgs.push(hello(!s.msgs.length));saveSt()}
  render();
  return{send};
 }
 return{mount,send,reply,parse,loadSt,reset:()=>{st={msgs:[],slots:{},last:[]};saveSt();render()}};
})();
// Плавающая кнопка и окно чата на всех страницах
const OmikWidget={
 mount(){
  if($('#omikFab'))return;
  document.body.insertAdjacentHTML('beforeend',`<button class="fab" id="omikFab" onclick="OmikWidget.open()"><img src="img/omik-avatar.png" alt=""><span>Спросить Омика</span></button><div class="drawer" id="omikDrawer" data-close="1"></div>`);
 },
 open(q){const d=$('#omikDrawer');if(!d.dataset.m){Omik.mount(d);d.dataset.m=1}d.classList.add('show');$('#omikFab').style.display='none';if(q)Omik.send(q);setTimeout(()=>d.querySelector('input')?.focus(),50)},
 close(){$('#omikDrawer').classList.remove('show');$('#omikFab').style.display=''}
};
