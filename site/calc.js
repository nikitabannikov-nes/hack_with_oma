// ОМА Проект — расчёт материалов по геометрии и характеристикам товаров. Без LLM, без DOM.
(function(root){
const D=typeof module!=='undefined'?require('./data.js'):root;
const G=typeof module!=='undefined'?require('./geom.js'):root.Geom;
const byId=id=>D.PRODUCTS.find(p=>p.id===id);
const f2=n=>(Math.round(n*100)/100).toString().replace('.',',');
const TIERS={eco:'Эконом',opt:'Оптимум',prem:'Премиум'};
const WET=['bath','wc'];
const ROOM_TYPES={
 bath:{name:'Ванная',floor:'tile',walls:'tile',ceil:'paint',icon:'🛁'},
 wc:{name:'Санузел',floor:'tile',walls:'tile',ceil:'paint',icon:'🚽'},
 kitchen:{name:'Кухня',floor:'tile',walls:'paint',ceil:'paint',icon:'🍳'},
 living:{name:'Комната',floor:'laminate',walls:'paint',ceil:'paint',icon:'🛋'},
 hall:{name:'Коридор',floor:'laminate',walls:'paint',ceil:'paint',icon:'🚪'}
};
// Толщина клеевого слоя по большей стороне плитки (типовые рекомендации, ориентировочно)
const glueLayer=size=>{const m=Math.max(...size);return m<=20?3:m<=40?4:m<=60?5:m<=90?7:8};

function pick(role,tier,pinned){
 const pin=pinned&&pinned[role];
 if(pin){const p=byId(pin);if(p&&p.roles.includes(role))return p}
 return D.PRODUCTS.find(p=>p.roles.includes(role)&&p.tier===tier)||D.PRODUCTS.find(p=>p.roles.includes(role)&&p.tier==='all');
}

// Отделочные материалы выбираются для каждого помещения отдельно (room.mat), остальное — на проект
const MAT_ROLES=['tileFloor','tileWall','laminate','paintWall','paintCeil'];
function pickFor(role,tier,pinned,room){
 const id=room&&room.mat&&room.mat[role];
 if(id){const p=byId(id);if(p&&p.roles.includes(role))return p}
 return pick(role,tier,pinned);
}
// Какие отделочные материалы нужны помещению и на какую площадь
function roomSurfaces(r,m){
 const s=[];
 if(r.floor==='tile')s.push({role:'tileFloor',a:m.floorNet});
 if(r.floor==='laminate')s.push({role:'laminate',a:m.floorNet});
 if(m.byFinish.tile>0)s.push({role:'tileWall',a:m.byFinish.tile});
 if(m.byFinish.paint>0)s.push({role:'paintWall',a:m.byFinish.paint});
 if(r.ceil==='paint')s.push({role:'paintCeil',a:m.ceil});
 return s;
}
// Собираем объёмы работ со всех помещений проекта
function volumes(rooms,tier,pinned){
 const v={surf:[],wp:0,wpTape:0,skirt:0,primer:0,lamNet:0},per=[];
 let ok=true;const errors=[];
 rooms.forEach(r=>{
  const val=G.validate(r);
  if(!val.ok){ok=false;val.errors.forEach(e=>errors.push(`${r.name}: ${e}`));per.push({id:r.id,ok:false,errors:val.errors});return}
  const m=G.metrics(r),w=(+r.waste||0)/100,mats={};
  roomSurfaces(r,m).forEach(x=>{const p=pickFor(x.role,tier,pinned,r);v.surf.push({...x,w,p,room:r.name,rid:r.id});mats[x.role]={pid:p.id,a:x.a,own:!!(r.mat&&r.mat[x.role]===p.id)}});
  per.push({id:r.id,ok:true,m,mats});
  if(r.floor==='laminate'){v.skirt+=Math.max(0,m.perim-m.doorW);v.lamNet+=m.floorNet}
  if(r.wet??WET.includes(r.type)){v.wp+=m.floorNet+Math.max(0,m.perim-m.doorW)*0.2;v.wpTape+=Math.max(0,m.perim-m.doorW)+m.corners*0.2}
  v.primer+=(m.byFinish.tile||0)+(m.byFinish.paint||0)+(r.floor==='tile'?m.floorNet:0)+(r.ceil==='paint'?m.ceil:0);
 });
 const A=role=>v.surf.filter(x=>x.role===role).reduce((s,x)=>s+x.a,0);
 v.area={tileWall:A('tileWall'),tileFloor:A('tileFloor'),paintWall:A('paintWall'),paintCeil:A('paintCeil'),laminate:A('laminate'),wp:v.wp,skirt:v.skirt};
 return{ok,errors,v,per};
}

function compute(project,tierOverride){
 const tier=tierOverride||project.tier||'opt',pinned=project.pinned||{};
 const{ok,errors,v,per}=volumes(project.rooms||[],tier,pinned);
 const out=[],warn=[];
 if(!ok)return{ok,errors,lines:[],areas:{},per,tier,warn};
 const push=(role,qty,basis,approx,pid)=>{if(qty>0){const p=pid?byId(pid):pick(role,tier,pinned);out.push({role,pid:p.id,qty,basis,approx:!!approx})}};
 const rooms=L=>[...new Set(L.map(x=>x.room))].join(', ');
 // Отделка: один товар в нескольких помещениях покупается общим количеством и округляется до упаковок один раз
 MAT_ROLES.forEach(role=>{
  const groups=new Map();v.surf.filter(x=>x.role===role).forEach(x=>{if(!groups.has(x.p.id))groups.set(x.p.id,[]);groups.get(x.p.id).push(x)});
  groups.forEach((L,pid)=>{
   const p=byId(pid),net=L.reduce((s,x)=>s+x.a,0);
   if(role==='paintWall'||role==='paintCeil'){const l=net*p.spec.layers/p.spec.cover,n=Math.ceil(l/p.pack.q-1e-9);push(role,n,`${rooms(L)}: ${f2(net)} м² × ${p.spec.layers} слоя ÷ ${p.spec.cover} м²/л = ${f2(l)} л → ${n} × ${p.pack.q} л`,false,pid);return}
   const gross=L.reduce((s,x)=>s+x.a*(1+x.w),0),n=Math.ceil(gross/p.pack.q-1e-9),wp=[...new Set(L.map(x=>Math.round(x.w*100)))];
   push(role,n,`${rooms(L)}: ${f2(net)} м² + запас ${wp.join('/')}% = ${f2(gross)} м² ÷ ${f2(p.pack.q)} м² в уп. → ${n} уп.`,false,pid);
  });
 });
 // Клей, затирка и СВП — по формату плитки каждого помещения
 const T=v.surf.filter(x=>x.role==='tileFloor'||x.role==='tileWall');
 if(T.length){
  const g=pick('glue',tier,pinned);let kg=0;const parts=[];
  T.forEach(x=>{const th=glueLayer(x.p.spec.size);kg+=x.a*g.spec.rate*th;parts.push(`${f2(x.a)} м² × ${f2(g.spec.rate)} кг × ${th} мм`)});
  kg*=1.05;const bags=Math.ceil(kg/g.pack.q-1e-9);
  push('glue',bags,`${parts.join(' + ')} + 5% = ${f2(kg)} кг ÷ ${g.pack.q} кг → ${bags} меш. Слой по формату плитки — ориентировочно`,true);
  const big=Math.max(...T.map(x=>Math.max(...x.p.spec.size)));
  if(big>g.spec.maxTile)warn.push({role:'glue',text:`Клей ${g.spec.cls} не рассчитан на плитку ${big} см. Нужен клей класса C2 или выше.`});
  const gr=pick('grout',tier,pinned);let gkg=0;const gp=[];
  T.forEach(x=>{const[a,b]=x.p.spec.size.map(q=>q*10),Th=x.p.spec.thick,J=x.p.spec.joint||2,r=(a+b)/(a*b)*Th*J*gr.spec.dens;gkg+=x.a*r;gp.push(`${f2(x.a)} м² × ${f2(r)} кг/м²`)});
  gkg*=1.1;const gpk=Math.ceil(gkg/gr.pack.q-1e-9);
  push('grout',gpk,`${gp.join(' + ')} (формат, толщина, шов 2 мм) + 10% = ${f2(gkg)} кг → ${gpk} уп.`,true);
  const CT=T.filter(x=>Math.min(...x.p.spec.size)>=30);
  if(CT.length){const cq=pick('clips',tier,pinned)?.pack?.q||200,n=CT.reduce((s,x)=>s+x.a/(x.p.spec.size[0]*x.p.spec.size[1]/1e4)*3,0),pk=Math.ceil(n/cq);push('clips',pk,`≈${Math.round(n)} клипс (3 на плитку) ÷ ${cq} → ${pk} уп.`,true)}
 }
 if(v.wp>0){const p=pick('wp',tier,pinned),kg=v.wp*p.spec.rate,n=Math.ceil(kg/p.pack.q-1e-9);push('wp',n,`пол + 20 см на стены = ${f2(v.wp)} м² × ${f2(p.spec.rate)} кг/м² (2 слоя) = ${f2(kg)} кг → ${n} шт.`);
  const t=pick('wpTape',tier,pinned),rl=Math.ceil(v.wpTape/t.pack.q-1e-9);push('wpTape',rl,`примыкание пол–стена и углы ${f2(v.wpTape)} м ÷ ${t.pack.q} м → ${rl} рул.`)}
 if(v.primer>0){const p=pick('primer',tier,pinned),l=v.primer*p.spec.rate,n=Math.ceil(l/p.pack.q-1e-9);push('primer',n,`все отделываемые поверхности ${f2(v.primer)} м² × ${f2(p.spec.rate)} л/м² = ${f2(l)} л → ${n} кан.`)}
 if(v.lamNet>0){
  const net=v.lamNet,u=pick('underlay',tier,pinned),un=Math.ceil(net*1.05/u.pack.q-1e-9);push('underlay',un,`${f2(net)} м² + 5% ÷ ${f2(u.pack.q)} м² → ${un} уп.`);
  const s=pick('skirting',tier,pinned),sl=v.skirt*1.05,sn=Math.ceil(sl/s.pack.q-1e-9);push('skirting',sn,`периметр без дверей ${f2(v.skirt)} м + 5% ÷ ${f2(s.pack.q)} м → ${sn} шт.`);
 }
 return{ok:true,errors:[],lines:out,areas:v.area,per,tier,warn};
}
const lineSum=l=>{const p=byId(l.pid);return p?p.price*l.qty:0};
const C={compute,pick,pickFor,MAT_ROLES,byId,TIERS,ROOM_TYPES,WET,glueLayer,lineSum,f2};
if(typeof module!=='undefined')module.exports=C;else root.Calc=C;
})(this);
