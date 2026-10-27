// ОМА Объект — общие данные, расчёты и хранилище (демо, localStorage)
const KEY='omaObjekt.v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>(+n).toLocaleString('ru-RU',{maximumFractionDigits:2}).replace(',','.');
const money=n=>byn(Math.round(n*100)/100);
const fmtDate=t=>new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const qp=k=>new URLSearchParams(location.search).get(k);

// Демонстрационный каталог: товары и цены условные
const CAT={
 floorEco:{name:'Керамогранит 30×30, серый',unit:'м²',price:22.90,pack:1.35,group:'Плитка'},
 floorOpt:{name:'Керамогранит 60×60, «Бетон» светлый',unit:'м²',price:39.90,pack:1.44,group:'Плитка'},
 wallEco:{name:'Плитка настенная 25×40, белая глянцевая',unit:'м²',price:19.90,pack:1.5,group:'Плитка'},
 wallOpt:{name:'Плитка настенная 30×60, «Мрамор» матовая',unit:'м²',price:34.90,pack:1.44,group:'Плитка'},
 glueEco:{name:'Клей плиточный C1, 25 кг',unit:'меш.',price:12.90,group:'Сухие смеси'},
 glueOpt:{name:'Клей плиточный C2 TE эластичный, 25 кг',unit:'меш.',price:24.50,group:'Сухие смеси'},
 groutEco:{name:'Затирка цементная, 2 кг',unit:'уп.',price:8.90,group:'Сухие смеси'},
 groutOpt:{name:'Затирка влагостойкая с антигрибковой добавкой, 2 кг',unit:'уп.',price:15.90,group:'Сухие смеси'},
 primerEco:{name:'Грунтовка глубокого проникновения, 5 л',unit:'кан.',price:11.50,vol:5,group:'Сухие смеси'},
 primerOpt:{name:'Грунтовка-концентрат, 10 л',unit:'кан.',price:26.00,vol:10,group:'Сухие смеси'},
 wpEco:{name:'Гидроизоляция обмазочная, 4 кг',unit:'ведро',price:29.90,kg:4,group:'Гидроизоляция'},
 wpOpt:{name:'Гидроизоляция эластичная двухкомпонентная, 5 кг',unit:'компл.',price:54.00,kg:5,group:'Гидроизоляция'},
 tape:{name:'Лента гидроизоляционная, 10 м',unit:'рул.',price:18.90,group:'Гидроизоляция'},
 cross:{name:'Система выравнивания плитки 2 мм, 200 шт',unit:'уп.',price:14.50,group:'Инструмент'},
 // Добавляются мастером вручную
 mixBath:{name:'Смеситель для ванны с душевым гарнитуром',unit:'шт.',price:129.00,group:'Сантехника'},
 mixSink:{name:'Смеситель для раковины',unit:'шт.',price:89.00,group:'Сантехника'},
 wc:{name:'Унитаз-компакт с сиденьем микролифт',unit:'шт.',price:289.00,group:'Сантехника'},
 sink:{name:'Тумба с раковиной 60 см',unit:'шт.',price:349.00,group:'Сантехника'},
 bath:{name:'Ванна акриловая 170×70 с каркасом',unit:'шт.',price:459.00,group:'Сантехника'},
 rail:{name:'Полотенцесушитель водяной 50×80',unit:'шт.',price:159.00,group:'Сантехника'},
 drain:{name:'Трап для душа 30 см',unit:'шт.',price:69.00,group:'Сантехника'},
 fan:{name:'Вентилятор вытяжной 100 мм',unit:'шт.',price:45.00,group:'Электрика'},
 seal:{name:'Герметик санитарный силиконовый, белый',unit:'шт.',price:9.90,group:'Сухие смеси'}
};
const ADDONS=['mixBath','mixSink','wc','sink','bath','rail','drain','fan','seal'];
const TIERS={eco:'Эконом',opt:'Оптимум'};
const ROLES={floor:'Плитка на пол',wall:'Плитка на стены',glue:'Клей',grout:'Затирка',primer:'Грунтовка',wp:'Гидроизоляция',tape:'Лента в углы',cross:'Выравнивание'};

// Расчёт материалов для ванной по формулам (не LLM)
function geo(d){
 const F=d.L*d.W,P=2*(d.L+d.W),Wl=Math.max(0,P*d.H-d.D);
 return{F,P,Wl,all:F+Wl};
}
function calcLines(d,tier,off=[]){
 const g=geo(d),T=tier==='eco'?'Eco':'Opt',R=1.1,out=[];
 const tile=(role,key,area,label)=>{
  const p=CAT[key],packs=Math.ceil(area*R/p.pack),q=+(packs*p.pack).toFixed(2);
  out.push({role,key,qty:q,hint:`${label} ${num(area.toFixed(2))} м² + 10% запас → ${packs} уп. × ${p.pack} м²`});
 };
 tile('floor','floor'+T,g.F,'Пол');
 tile('wall','wall'+T,g.Wl,'Стены за вычетом двери');
 out.push({role:'glue',key:'glue'+T,qty:Math.ceil(g.all*5/25),hint:`${num(g.all.toFixed(1))} м² × 5 кг/м² ÷ 25 кг`});
 out.push({role:'grout',key:'grout'+T,qty:Math.ceil(g.all*0.35/2),hint:`${num(g.all.toFixed(1))} м² × 0,35 кг/м² ÷ 2 кг`});
 const pv=CAT['primer'+T].vol;
 out.push({role:'primer',key:'primer'+T,qty:Math.ceil(g.all*0.2/pv),hint:`${num(g.all.toFixed(1))} м² × 0,2 л/м² ÷ ${pv} л`});
 const wpA=g.F+g.P*0.2,kg=CAT['wp'+T].kg;
 out.push({role:'wp',key:'wp'+T,qty:Math.ceil(wpA*1.5/kg),hint:`пол + 20 см на стены = ${num(wpA.toFixed(1))} м² × 1,5 кг/м² (2 слоя) ÷ ${kg} кг`});
 out.push({role:'tape',key:'tape',qty:Math.ceil((g.P+4*d.H*0.2)/10),hint:`периметр ${num(g.P.toFixed(1))} м + углы ÷ 10 м`});
 out.push({role:'cross',key:'cross',qty:Math.max(1,Math.ceil(g.all/8)),hint:`1 уп. на 8 м² плитки`});
 return out.filter(l=>!off.includes(l.role)).map(l=>({...l,src:'calc',name:CAT[l.key].name,unit:CAT[l.key].unit,price:CAT[l.key].price}));
}
const sum=l=>l.qty*l.price;
function totals(e){
 const oma=e.lines.filter(l=>l.src!=='free').reduce((s,l)=>s+sum(l),0);
 const free=e.lines.filter(l=>l.src==='free').reduce((s,l)=>s+sum(l),0);
 return{oma,free,work:+e.work.amount||0};
}

// Хранилище
const STATUS={
 draft:['Черновик',''],sent:['Отправлена клиенту','or'],changes:['Клиент просит изменения','red'],
 approved:['Согласована клиентом','gr'],paid:['Материалы оплачены','paid']
};
const now=()=>Date.now(),DAY=864e5;
function mkEstimate(o){
 const e={id:Math.random().toString(36).slice(2,8),title:'Ремонт ванной',address:'',client:'',created:now(),updated:now(),
  dims:{L:2,W:1.7,H:2.5,D:1.6},tier:'opt',off:[],extra:[],work:{amount:1400,note:'Демонтаж, гидроизоляция, укладка плитки'},
  status:'draft',version:1,versions:[],approved:null,comment:'',order:null,history:[],seen:true,...o};
 e.lines=e.lines||build(e);
 return e;
}
function build(e){return[...calcLines(e.dims,e.tier,e.off),...e.extra]}
function snap(e){return{version:e.version,lines:JSON.parse(JSON.stringify(e.lines)),work:{...e.work},t:totals(e),at:now()}}
function seed(){
 const a=mkEstimate({title:'Ванная, ул. Притыцкого',address:'Минск, ул. Притыцкого (демо)',client:'Ольга',dims:{L:1.8,W:1.7,H:2.6,D:1.5},created:now()-26*DAY,
  extra:[{src:'catalog',key:'mixBath',name:CAT.mixBath.name,unit:'шт.',price:CAT.mixBath.price,qty:1},{src:'free',name:'Профиль алюминиевый для торца (у знакомого поставщика)',unit:'шт.',price:6.5,qty:4}]});
 a.lines=build(a);a.status='paid';a.versions=[snap(a)];a.approved=snap(a);a.updated=now()-20*DAY;
 a.order={no:'D-10482',delivery:'pickup',payer:'client',total:totals(a).oma,at:now()-20*DAY};
 a.history=[{at:now()-26*DAY,who:'master',text:'Смета отправлена клиенту'},{at:now()-24*DAY,who:'client',text:'Клиент согласовал смету v1'},{at:now()-20*DAY,who:'client',text:'Заказ D-10482 оплачен, самовывоз'}];
 const b=mkEstimate({title:'Санузел, ул. Каменногорская',address:'Минск, ул. Каменногорская (демо)',client:'Дмитрий',tier:'eco',dims:{L:1.5,W:1.2,H:2.5,D:1.4},created:now()-2*DAY});
 b.status='sent';b.versions=[snap(b)];b.updated=now()-DAY;b.history=[{at:now()-DAY,who:'master',text:'Смета отправлена клиенту'}];
 return{master:{name:'Алексей Н.',phone:'+375 29 000-00-00'},estimates:[b,a]};
}
function load(){
 try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.estimates)return d}catch(e){}
 const d=seed();save(d);return d;
}
function save(d){localStorage.setItem(KEY,JSON.stringify(d))}
function getE(d,id){return d.estimates.find(e=>e.id===id)}
function log(e,who,text){e.history.push({at:now(),who,text});e.updated=now();if(who==='client')e.seen=false}

// Ссылка клиенту: id + копия сметы в хэше, чтобы открывалась и на другом устройстве
function clientUrl(e,d){
 const pack={e,m:d.master};
 const h=btoa(unescape(encodeURIComponent(JSON.stringify(pack))));
 return new URL('client.html?id='+e.id,location.href).href+'#d='+h;
}
function importFromHash(d,id){
 const m=location.hash.match(/#d=(.+)/);if(!m)return null;
 try{const p=JSON.parse(decodeURIComponent(escape(atob(m[1]))));if(p.e&&p.e.id===id){d.estimates.unshift(p.e);save(d);return p.e}}catch(e){}
 return null;
}

// Разница между версиями сметы
function diff(oldL,newL){
 const k=l=>l.name,res=[];
 const om=new Map(oldL.map(l=>[k(l),l])),nm=new Map(newL.map(l=>[k(l),l]));
 newL.forEach(l=>{const o=om.get(k(l));
  if(!o)res.push({t:'add',text:`Добавлено: ${l.name} — ${num(l.qty)} ${l.unit}`});
  else if(o.qty!==l.qty||o.price!==l.price)res.push({t:'chg',text:`Изменено: ${l.name} — ${num(o.qty)} → ${num(l.qty)} ${l.unit}`});
 });
 oldL.forEach(l=>{if(!nm.has(k(l)))res.push({t:'del',text:`Удалено: ${l.name}`})});
 return res;
}

// Шапка, демо-панель и подвал
function ochrome(role,hint){
 const d=load();
 const live=d.estimates.filter(e=>e.status!=='draft').sort((a,b)=>b.updated-a.updated)[0];
 const cid=qp('id')&&getE(d,qp('id'))?.status!=='draft'?qp('id'):live?.id;
 const unseen=d.estimates.filter(e=>!e.seen).length;
 document.querySelector('#chrome').innerHTML=`
 <div class="demo"><div class="wrap"><b>ДЕМО</b><span class="dh">${hint||''}</span><span class="sp"></span>
  <span class="role">Роль:</span><a class="${role==='master'?'on':''}" href="master.html">👷 Мастер${unseen?` <i>${unseen}</i>`:''}</a><a class="${role==='client'?'on':''}" href="client.html?id=${cid}">🙋 Клиент</a>
  <button onclick="if(confirm('Вернуть демо-данные к исходным?')){localStorage.removeItem(KEY);location='master.html'}">↺ Сброс</button></div></div>
 <header class="main"><div class="wrap">
  <a class="logo" href="${role==='master'?'master.html':'#'}">${LOGO}<span>ГИПЕРМАРКЕТ<br>ОМА</span></a>
  <span class="prod">ОМА Объект <small>${role==='master'?'кабинет мастера':'смета от мастера'}</small></span><span class="sp"></span>
  ${role==='master'?`<span class="who"><span class="av">АН</span>${esc(d.master.name)}<small>ОМА PRO</small></span>`:''}
 </div></header>`;
 if(!document.querySelector('footer'))document.body.insertAdjacentHTML('beforeend','<footer><div class="wrap"><div><b>ОМА Объект</b>Демо-прототип для Space Hackathon with ОМА.<br>Не является реальным сервисом ОМА: товары, цены, расчёты и оплата условные.</div><div><b>Как устроено</b>ОМА продаёт материалы.<br>Работы мастер согласует с клиентом напрямую.</div></div></footer>');
}
function chip(s){const[t,c]=STATUS[s];return`<span class="st ${c}">${t}</span>`}

// Таблица позиций сметы: общая для мастера и клиента
const SRC={calc:'Рассчитано',catalog:'Добавлено мастером',free:'Не из ОМА'};
function linesHTML(lines,o={}){
 const marks=o.marks||{};
 return`<div class="lines"><div class="ln h"><span>Позиция</span><span class="r">Кол-во</span><span class="r">Цена</span><span class="r">Сумма</span><span></span></div>`+
 lines.map((l,i)=>`<div class="ln ${marks[l.name]||''}">
  <span class="c-name">${esc(l.name)} <span class="src ${l.src}">${SRC[l.src]}</span>${o.hints&&l.hint?`<span class="hint">${esc(l.hint)}</span>`:''}${l.src==='free'?'<span class="hint">Мастер покупает сам, в заказ ОМА не входит</span>':''}</span>
  <span class="r c-qty">${num(l.qty)} ${esc(l.unit)}</span><span class="r c-price">${money(l.price)}</span><span class="r c-sum"><b>${money(sum(l))}</b></span>
  <span class="c-x">${o.remove?`<button class="x" title="Убрать" onclick="${o.remove}(${i})">×</button>`:''}</span></div>`).join('')+`</div>`;
}
function totalsHTML(t){
 return`<div class="row"><span>Материалы ОМА</span><b>${money(t.oma)}</b></div>
 ${t.free?`<div class="row"><span>Позиции не из ОМА</span><b>${money(t.free)}</b></div>`:''}
 <div class="row"><span>Работы мастера <small>(справочно)</small></span><b>${money(t.work)}</b></div>`;
}
