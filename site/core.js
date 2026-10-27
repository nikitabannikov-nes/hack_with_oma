// ОМА Проект — единая модель данных и общий интерфейс для всех модулей.
// Один источник истины: объект state в localStorage (демо). Проекты, корзина, заявки.
const KEY='omaProject.v2';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=2)=>(+n).toLocaleString('ru-RU',{maximumFractionDigits:d}).replace(/ /g,' ');
const byn=n=>(Math.round(n*100)/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/ /g,' ')+' BYN';
const qp=k=>new URLSearchParams(location.search).get(k);
const uid=()=>Math.random().toString(36).slice(2,9);
const now=()=>Date.now(),DAY=864e5;
const fmtDate=t=>new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const fmtDay=t=>new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
const P=id=>Calc.byId(id);
const TIERS=Calc.TIERS,RT=Calc.ROOM_TYPES;

// ---------- Хранилище ----------
let S=null;
function load(){
 if(S)return S;
 try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
 if(!S||!S.projects){S=seed();persist()}
 return S;
}
function persist(){localStorage.setItem(KEY,JSON.stringify(S))}
function save(){persist();updateBadges()}
function resetDemo(){localStorage.removeItem(KEY);localStorage.removeItem('omaChat.v2');S=null;location='index.html'}

// ---------- Помещение ----------
function makeRoom(type='bath',kind='rect',params){
 const t=RT[type]||RT.living,tp=Geom.TEMPLATES[kind];
 params=params||Object.fromEntries(tp.params.map(([k,,v])=>[k,v]));
 if(kind==='rect'&&!arguments[2]&&(type==='bath'||type==='wc'))params={L:type==='wc'?1.5:2.2,W:type==='wc'?1.2:1.7};
 const pts=Geom.fromTemplate(kind,params);
 const r={id:uid(),name:t.name,type,shape:{kind,params},pts,h:type==='bath'||type==='wc'?2.5:2.7,
  walls:pts.map(()=>({id:uid(),finish:t.walls,h:null})),openings:[],excl:[],floor:t.floor,ceil:t.ceil,waste:10};
 // Дверь по умолчанию на последней стене
 const last=r.walls.length-1,len=Geom.segLen(pts[last],pts[0]);
 r.openings.push({id:uid(),kind:'door',wallId:r.walls[last].id,w:Math.min(type==='bath'||type==='wc'?0.7:0.8,len-0.2),h:2,off:Math.max(0.1,Math.min(0.3,len-0.9)),sill:0});
 return r;
}
// Пересобрать стены после изменения числа вершин, сохраняя отделку и проёмы где возможно
function syncWalls(r,map){
 const n=r.pts.length,old=r.walls;
 if(map)r.walls=map.map(i=>i==null?{id:uid(),finish:old[0]?.finish||'paint',h:null}:old[i]);
 else if(old.length!==n)r.walls=r.pts.map((_,i)=>old[i]||{id:uid(),finish:old[old.length-1]?.finish||'paint',h:null});
 const ids=new Set(r.walls.map(w=>w.id));
 r.openings=r.openings.filter(o=>ids.has(o.wallId));
}

// ---------- Проект ----------
function newProject(o={}){
 const p={id:uid(),title:o.title||'Мой ремонт',task:o.task||'bath',status:'draft',created:now(),updated:now(),
  rooms:o.rooms||[makeRoom(o.task||'bath')],activeRoom:null,tier:o.tier||'opt',budget:o.budget||null,pinned:o.pinned||{},
  est:{id:uid(),version:1,rev:0,lines:[],off:{},status:'draft',approved:null,comment:'',versions:[],dirty:false},
  requests:[],history:[],source:o.source||'site'};
 p.activeRoom=p.rooms[0].id;
 recalc(p);log(p,o.logText||'Проект создан');
 return p;
}
function addProject(p){load().projects.unshift(p);S.active=p.id;save();return p}
function getProject(id){return load().projects.find(p=>p.id===id)}
function activeProject(){const s=load();return getProject(qp('project'))||getProject(s.active)||null}
function setActive(p){load().active=p.id;persist()}
function ensureProject(task='bath',title){let p=activeProject();if(!p){p=addProject(newProject({task,title:title||RT[task].name}))}return p}
function log(p,text){p.history.push({at:now(),text});p.updated=now()}
function room(p,id){return p.rooms.find(r=>r.id===(id||p.activeRoom))||p.rooms[0]}

// Пересчёт сметы из геометрии. Ручные количества не перезаписываются молча.
function recalc(p){
 const res=Calc.compute(p),E=p.est;
 p.calc={ok:res.ok,errors:res.errors,areas:res.areas,warn:res.warn,at:now()};
 if(!res.ok)return res; // при ошибке геометрии смета не меняется, а помечается
 const seen=new Set();
 // Позиция сметы = роль + товар: у разных помещений могут быть разные плитка, краска, ламинат
 res.lines.forEach(c=>{
  if(E.off[c.role])return;seen.add(c.role+'|'+c.pid);
  let l=E.lines.find(x=>x.role===c.role&&x.pid===c.pid);
  if(!l){l={id:uid(),role:c.role,pid:c.pid,qty:c.qty,calcQty:c.qty,manual:false,ack:null,src:'calc'};E.lines.push(l)}
  l.pid=c.pid;l.calcQty=c.qty;l.basis=c.basis;l.approx=c.approx;l.gone=false;
  if(!l.manual)l.qty=c.qty;
 });
 E.lines.forEach(l=>{if(l.role&&!seen.has(l.role+'|'+l.pid)&&!E.off[l.role]){l.gone=true;l.calcQty=0}});
 E.lines=E.lines.filter(l=>!(l.gone&&!l.manual));
 return res;
}
const stale=l=>l.role&&l.manual&&(l.gone||(l.qty!==l.calcQty&&l.ack!==l.calcQty));
function lineTotal(l){const p=P(l.pid);return p?p.price*l.qty:0}
function estTotal(p){return p.est.lines.reduce((s,l)=>s+lineTotal(l),0)}
function tierTotal(p,t){const res=Calc.compute(p,t);if(!res.ok)return null;
 const extra=p.est.lines.filter(l=>!l.role).reduce((s,l)=>s+lineTotal(l),0);
 return res.lines.filter(l=>!p.est.off[l.role]).reduce((s,l)=>s+Calc.lineSum(l),0)+extra}
// Любое изменение сметы после отправки клиенту помечает её как новую неотправленную версию
function touchEst(p,text){p.est.rev++;if(['sent','approved','changes'].includes(p.est.status))p.est.dirty=true;if(text)log(p,text);p.updated=now()}
function addLine(p,pid,qty=1,src='catalog'){
 const ex=p.est.lines.find(l=>l.pid===pid);
 if(ex)return{dup:true,line:ex};
 const prod=P(pid);
 // Если товар закрывает расчётную роль — закрепляем его вместо типового
 const role=prod.roles.find(r=>p.est.lines.some(l=>l.role===r));
 if(role){p.pinned[role]=pid;recalc(p);touchEst(p,`Выбран товар «${prod.name}»`);return{replaced:true,line:p.est.lines.find(l=>l.role===role)}}
 const l={id:uid(),role:null,pid,qty,src};p.est.lines.push(l);touchEst(p,`Добавлено в смету: ${prod.name}`);return{line:l};
}
function copyProject(src){
 const p=JSON.parse(JSON.stringify(src));
 p.id=uid();p.title='Копия — '+src.title;p.created=p.updated=now();p.status='draft';p.requests=[];p.history=[];
 p.est={...p.est,id:uid(),version:1,rev:0,status:'draft',approved:null,comment:'',versions:[],dirty:false};
 log(p,`Создан копированием проекта «${src.title}»`);return addProject(p);
}
function areaSummary(p){const a=p.calc?.areas||{};const parts=[];
 if(a.tileFloor||a.tileWall)parts.push(`плитка ${num((a.tileFloor||0)+(a.tileWall||0),1)} м²`);
 if(a.paintWall)parts.push(`покраска ${num(a.paintWall,1)} м²`);if(a.laminate)parts.push(`ламинат ${num(a.laminate,1)} м²`);return parts.join(' · ')}
function floorArea(p){return p.rooms.reduce((s,r)=>{try{return s+Geom.area(r.pts)}catch(e){return s}},0)}

// ---------- Корзина ----------
// Позиция: {pid, qty, projectId|null, rev} — товар из проекта хранится отдельно от разовых покупок, без дублей
function cartAdd(pid,qty=1,projectId=null){
 const s=load(),ex=s.cart.find(i=>i.pid===pid&&i.projectId===projectId);
 if(ex)ex.qty+=qty;else s.cart.push({pid,qty,projectId});save();
}
function cartSyncProject(p){
 const s=load();s.cart=s.cart.filter(i=>i.projectId!==p.id);
 p.est.lines.filter(l=>l.qty>0).forEach(l=>s.cart.push({pid:l.pid,qty:l.qty,projectId:p.id}));
 p.cartRev=p.est.rev;log(p,'Смета добавлена в корзину');save();
}
const cartCount=()=>load().cart.length;
const cartTotal=()=>load().cart.reduce((s,i)=>s+(P(i.pid)?.price||0)*i.qty,0);

// ---------- Заявки мастерам ----------
const REQ_ST=['Создана','На рассмотрении','Мастер назначен','Выполнена'];
function addRequest(o){
 const s=load(),r={id:'З-'+(1000+s.requests.length+1),created:now(),status:0,statusAt:[now()],...o};
 s.requests.unshift(r);
 if(r.projectId){const p=getProject(r.projectId);if(p){p.requests.push(r.id);log(p,`Создана заявка ${r.id}: ${svc(r.service).name}`)}}
 save();return r;
}
const svc=id=>SERVICES.find(s=>s.id===id)||{name:'Услуга',price:0,unit:''};
const master=id=>MASTERS.find(m=>m.id===id);
function svcEstimate(sv,p){if(sv.area&&p?.calc?.areas){const q=p.calc.areas[sv.area]||0;return{q,sum:q*sv.price}}return{q:1,sum:sv.price}}

// ---------- Ссылка на смету ----------
// Без сервера: снимок проекта кодируется в адрес ссылки и открывается на любом устройстве
function shareUrl(p){
 const snap={id:p.id,title:p.title,v:p.est.version,tier:p.tier,rooms:p.rooms.map(r=>({name:r.name,type:r.type,pts:r.pts,h:r.h,walls:r.walls,openings:r.openings,excl:r.excl,floor:r.floor,ceil:r.ceil,waste:r.waste})),
  lines:p.est.lines.map(l=>({pid:l.pid,qty:l.qty,role:l.role,basis:l.basis,manual:!!l.manual,calcQty:l.calcQty})),areas:p.calc?.areas,author:p.author||null};
 const h=btoa(unescape(encodeURIComponent(JSON.stringify(snap))));
 return new URL('share.html',location.href).href+'#d='+h;
}
function readShare(){const m=location.hash.match(/#d=(.+)/);if(!m)return null;try{return JSON.parse(decodeURIComponent(escape(atob(m[1]))))}catch(e){return null}}

// ---------- Общие элементы интерфейса ----------
const LOGO='<svg viewBox="0 0 120 40" aria-hidden="true"><path d="M2 20a18 18 0 0 1 18-18h4L10 38A18 18 0 0 1 2 20z" fill="#0057d6"/><path d="M26 38 40 4h6l14 34z" fill="#0057d6"/><path d="M60 38 74 4h6l14 34z" fill="#0057d6"/></svg>';
const NAV=[['index','Главная','index.html'],['omik','Омик','omik.html'],['planner','Калькулятор','planner.html'],['catalog','Каталог','catalog.html'],['masters','Мастера и услуги','masters.html'],['projects','Мои проекты','projects.html']];
function chrome(active,o={}){
 const s=load(),p=o.noCtx?null:activeProject();
 $('#chrome').innerHTML=`
 <div class="demo"><div class="wrap"><b>ДЕМО</b><span>Прототип для Space Hackathon with ОМА. Товары, цены, мастера и оплата условные.</span><span class="sp"></span><button onclick="if(confirm('Сбросить все демо-данные?'))resetDemo()">↺ Сбросить демо</button></div></div>
 <header class="main"><div class="wrap">
  <a class="logo" href="index.html">${LOGO}<span>ГИПЕРМАРКЕТ<br>ОМА</span></a>
  <a class="cat" href="catalog.html">☰ Каталог</a>
  <form class="search" onsubmit="event.preventDefault();location='catalog.html?q='+encodeURIComponent(this.q.value)"><input name="q" placeholder="Плитка, клей, смеситель, укладка…" value="${esc(active==='catalog'?qp('q')||'':'')}"><button>Найти</button></form>
  <nav class="hico"><a href="projects.html"><i>📁</i>Проекты<span class="cnt" data-b="proj"></span></a><a href="masters.html#requests"><i>👷</i>Заявки<span class="cnt" data-b="req"></span></a><a href="cart.html"><i>🛒</i>Корзина<span class="cnt" data-b="cart"></span></a></nav>
 </div></header>
 <nav class="sub"><div class="wrap">${NAV.map(([k,t,h])=>`<a href="${h}" class="${k===active?'on':''}">${k==='omik'?'<img src="img/omik-avatar.png" alt="">':''}${t}</a>`).join('')}</div></nav>
 ${p?`<div class="ctx"><div class="wrap"><span class="ctx-l">Текущий проект:</span><a class="ctx-p" href="projects.html">${RT[p.task]?.icon||'📁'} <b>${esc(p.title)}</b></a>
  <span class="ctx-s">${num(floorArea(p),1)} м² · ${p.est.lines.length} поз. · ${byn(estTotal(p))}</span><span class="sp"></span>
  <a href="planner.html?project=${p.id}" class="${active==='planner'?'on':''}">📐 План</a><a href="smeta.html?project=${p.id}" class="${active==='smeta'?'on':''}">📋 Смета</a><a href="masters.html?project=${p.id}" class="${active==='masters'?'on':''}">👷 Мастер</a></div></div>`:''}`;
 if(!$('footer'))document.body.insertAdjacentHTML('beforeend',`<footer><div class="wrap"><div><b>ОМА Проект</b>Демо-прототип: от идеи ремонта до материалов и мастера.<br>Не является действующим сервисом ОМА.</div><div><b>Модули</b><a href="omik.html">Омик — AI-прораб</a><br><a href="planner.html">2D-калькулятор</a><br><a href="catalog.html">Каталог и смета</a><br><a href="masters.html">Мастера и услуги</a></div><div><b>Честно о демо</b>Омик работает по сценариям без внешней LLM.<br>Оплата и выплаты мастерам не проводятся.</div></div></footer>`);
 updateBadges();
 if(active!=='omik'&&typeof OmikWidget!=='undefined')OmikWidget.mount();
}
function updateBadges(){
 const s=load(),set=(k,v)=>$$(`[data-b="${k}"]`).forEach(e=>{e.textContent=v;e.style.display=v?'inline-block':'none'});
 set('cart',s.cart.length);set('proj',s.projects.length);set('req',s.requests.filter(r=>r.status<3).length);
}
function toast(t,ok=true){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';document.body.append(e)}e.innerHTML=t;e.className='show '+(ok?'':'bad');clearTimeout(e._t);e._t=setTimeout(()=>e.className='',2600)}

// Изображение товара: для плитки и покрытий — образец рисунка, для остального — иконка
function pimg(p,cls=''){
 if(p.img)return`<div class="pimg ${cls} ph"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy"></div>`;
 if(p.cat==='tile'||p.cat==='floor'&&p.color||p.cat==='paint'){
  const c=p.color||'#eee';let bg;
  if(p.cat==='paint')bg=`radial-gradient(circle at 30% 30%,#fff8 0 20%,transparent 21%),${c}`;
  else if(p.pattern==='wood')bg=`repeating-linear-gradient(90deg,${c} 0 22%,#0000001a 22% 22.6%),repeating-linear-gradient(0deg,#ffffff14 0 3px,#0000000d 3px 6px),${c}`;
  else if(p.pattern==='brick')bg=`linear-gradient(#0000 0 46%,#c9c9c9 46% 50%,#0000 50% 96%,#c9c9c9 96%) 0 0/100% 40px,linear-gradient(90deg,#0000 0 48%,#c9c9c9 48% 50%,#0000 50%) 0 0/60px 20px,${c}`;
  else if(p.pattern==='marble')bg=`linear-gradient(115deg,#0000 30%,#9a8f8040 31% 32%,#0000 33% 60%,#9a8f8030 61% 61.6%,#0000 62%),linear-gradient(#0000 calc(100% - 2px),#fff 0) 0 0/100% 50%,linear-gradient(90deg,#0000 calc(100% - 2px),#fff 0) 0 0/50% 100%,${c}`;
  else if(p.pattern==='concrete')bg=`radial-gradient(#0000000d 1px,#0000 1.5px) 0 0/7px 7px,linear-gradient(#0000 calc(100% - 2px),#fff 0) 0 0/100% 50%,linear-gradient(90deg,#0000 calc(100% - 2px),#fff 0) 0 0/50% 100%,${c}`;
  else bg=`linear-gradient(#0000 calc(100% - 2px),#d8d8d8 0) 0 0/100% 33.3%,linear-gradient(90deg,#0000 calc(100% - 2px),#d8d8d8 0) 0 0/33.3% 100%,${c}`;
  return`<div class="pimg ${cls}" style="background:${bg}">${p.cat==='paint'?'<span>🎨</span>':''}</div>`;
 }
 return`<div class="pimg ${cls} ic">${p.icon||CATS[p.cat]?.icon||'📦'}</div>`;
}
const priceTag=p=>p.priceM2?`<b>${byn(p.price)}</b><small> / ${p.unit} · ${byn(p.priceM2)} за м²</small>`:`<b>${byn(p.price)}</b><small> / ${p.unit}</small>`;
const badges=p=>`${p.stm?'<span class="tag stm">СТМ ОМА</span>':''}${p.tier&&TIERS[p.tier]?`<span class="tag t-${p.tier}">${TIERS[p.tier]}</span>`:''}`;
function pcard(p,o={}){
 return`<div class="card pc"><a href="product.html?id=${p.id}">${pimg(p)}</a><div class="pc-b">
  <div class="pc-t">${badges(p)}</div><a class="pc-n" href="product.html?id=${p.id}">${esc(p.name)}</a>
  <div class="pc-p">${priceTag(p)}</div>
  <div class="pc-a">${o.actions||`<button class="btn sm" onclick="quickCart('${p.id}')">В корзину</button><button class="btn sm g" onclick="quickEst('${p.id}')">В смету</button>`}</div></div></div>`;
}
function quickCart(pid){cartAdd(pid,1);toast(`🛒 «${esc(P(pid).name)}» в корзине`)}
function quickEst(pid){
 const p=ensureProject(P(pid).cat==='plumb'?'bath':'bath');const r=addLine(p,pid,1);save();
 toast(r.dup?'Этот товар уже есть в смете — количество можно изменить там':r.replaced?`Товар закреплён в смете вместо типового · <a href="smeta.html?project=${p.id}">открыть</a>`:`📋 Добавлено в смету «${esc(p.title)}» · <a href="smeta.html?project=${p.id}">открыть</a>`,!r.dup);
}
function omikTip(img,html,cls=''){return`<div class="tip ${cls}"><img src="img/omik-${img}.png" alt="Омик"><div>${html}</div></div>`}
function searchProducts(q,limit=60){
 const w=String(q||'').toLowerCase().replace(/ё/g,'е').split(/[^a-zа-я0-9]+/).filter(x=>x.length>1).map(x=>x.slice(0,Math.max(3,x.length-2)));
 if(!w.length)return PRODUCTS.slice(0,limit);
 return PRODUCTS.map(p=>{const h=(p.name+' '+CATS[p.cat].name+' '+(p.roles||[]).map(r=>ROLES[r]).join(' ')+' '+(p.desc||'')+(p.stm?' стм ома':'')).toLowerCase().replace(/ё/g,'е');
  return{p,s:w.reduce((s,x)=>s+(h.includes(x)?1:0),0)}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.p.price-b.p.price).slice(0,limit).map(x=>x.p);
}
function analogs(pid){const p=P(pid);if(!p)return[];const r=p.roles[0];
 return PRODUCTS.filter(x=>x.id!==pid&&(r?x.roles.includes(r):x.cat===p.cat&&x.service===p.service)).sort((a,b)=>a.price-b.price)}

// ---------- Демо-данные при первом запуске ----------
function seed(){
 S={projects:[],cart:[],requests:[],orders:[],active:null};
 const r=makeRoom('wc','L',{A:2.4,B:1.8,a:0.9,b:0.6});r.name='Санузел';
 const p=newProject({title:'Санузел на Сурганова (пример)',task:'wc',rooms:[r],tier:'eco',logText:'Проект создан (демо-пример)'});
 p.created=p.updated=now()-12*DAY;p.history[0].at=p.created;
 S.projects.push(p);
 return S;
}

// ---------- Материалы помещения ----------
const MAT_N={tileFloor:'Плитка на пол',laminate:'Ламинат',tileWall:'Плитка на стены',paintWall:'Краска для стен',paintCeil:'Краска для потолка'};
const MAT_PLACE={tileFloor:'Пол',laminate:'Пол',tileWall:'Стены',paintWall:'Стены',paintCeil:'Потолок'};
// Какие отделочные материалы нужны помещению по его отделке
function roomRoles(r){const s=[];if(r.floor==='tile')s.push('tileFloor');if(r.floor==='laminate')s.push('laminate');
 if(r.walls.some(w=>w.finish==='tile'))s.push('tileWall');if(r.walls.some(w=>w.finish==='paint'))s.push('paintWall');if(r.ceil==='paint')s.push('paintCeil');return s}
const matOf=(p,r,role)=>Calc.pickFor(role,p.tier,p.pinned,r);
function setRoomMat(p,rooms,role,pid){
 rooms.forEach(r=>{r.mat=r.mat||{};if(pid)r.mat[role]=pid;else delete r.mat[role]});
 recalc(p);touchEst(p,pid?`${rooms.map(r=>r.name).join(', ')}: ${MAT_N[role].toLowerCase()} — ${P(pid).name}`:`${rooms.map(r=>r.name).join(', ')}: ${MAT_N[role].toLowerCase()} по комплектации`);
}
// Цвет и формат материала для рисунка пола на плане
function matLook(prod){
 if(!prod)return null;
 const n=(prod.name||'').toLowerCase();
 const C=[[/венге/,'#4a3426'],[/орех/,'#7d5a3c'],[/вишн/,'#8a4b38'],[/тик|мербау/,'#8b5a3c'],[/графит|антрацит|черн/,'#4b4f55'],[/сер(ый|ая|ое)|grey|gray/,'#a9a8a3'],[/бел(ый|ая|ое)|white|снеж/,'#f1efea'],[/беж|песоч|крем|сливоч/,'#ddd0b8'],[/кашемир|светл/,'#d8c7ab'],[/бетон|цемент/,'#bdbab4'],[/мрамор|оникс|травертин/,'#e9e3d8'],[/зел[её]н/,'#6f9a83'],[/голуб|син/,'#9fb8d6'],[/дуб/,'#c49b6c'],[/сосн|бук|ясен|берез/,'#d9b88a']];
 let color=prod.color||'#e5e1da';for(const[re,c]of C)if(re.test(n)){color=c;break}
 let size=prod.spec&&prod.spec.size?prod.spec.size.map(x=>x/100):null;
 // размер доски из названия: «1285х192х8мм» или «195x1380x8мм» — длина и ширина = два больших числа
 if(!size&&prod.roles.includes('laminate')){const m=n.match(/(\d+)\s*[хx×*]\s*(\d+)\s*[хx×*]\s*(\d+)/);const d=m?[+m[1],+m[2],+m[3]].sort((a,b)=>b-a):null;size=d&&d[1]>=50?[d[0]/1000,d[1]/1000]:[1.2,0.19]}
 return{color,size:size||[0.3,0.3],kind:prod.roles.includes('laminate')||prod.pattern==='wood'?'plank':'tile'};
}
// Выпадающий список материала для поверхности помещения; страница определяет onMat(roomId, role, pid)
function matPicker(p,r,role){
 const cur=matOf(p,r,role),own=!!(r.mat&&r.mat[role]),def=Calc.pick(role,p.tier,p.pinned);
 const L=PRODUCTS.filter(x=>x.roles.includes(role)).sort((a,b)=>(a.priceM2||a.price)-(b.priceM2||b.price));
 const price=x=>x.priceM2?byn(x.priceM2)+'/м²':byn(x.price);
 return`<div class="matp"><span class="sw" style="${swatchCss(cur)}"></span><select onchange="onMat('${r.id}','${role}',this.value)">
  <option value="" ${own?'':'selected'}>Как в комплектации: ${esc(def.name.slice(0,48))}</option>
  ${L.map(x=>`<option value="${x.id}" ${own&&x.id===cur.id?'selected':''}>${esc(x.name.slice(0,60))} — ${price(x)}${x.stm?' · СТМ':''}</option>`).join('')}</select>
  <a class="btn ghost sm" href="product.html?id=${cur.id}&project=${p.id}" title="Карточка товара">↗</a></div>`;
}
function swatchCss(prod){const l=matLook(prod);if(!l)return'';
 if(prod.roles.some(r=>r.startsWith('paint')))return`background:${l.color}`;
 return l.kind==='plank'?`background:repeating-linear-gradient(90deg,${l.color} 0 70%,#0002 70% 72%,${l.color} 72%),${l.color}`:`background:linear-gradient(#0000 calc(100% - 1px),#fff 0) 0 0/100% 50%,linear-gradient(90deg,#0000 calc(100% - 1px),#fff 0) 0 0/50% 100%,${l.color}`}
function floorLook(p,r){const role=r.floor==='tile'?'tileFloor':r.floor==='laminate'?'laminate':null;return role?matLook(matOf(p,r,role)):null}
