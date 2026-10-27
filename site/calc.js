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

// Собираем объёмы работ со всех помещений проекта
function volumes(rooms){
 const v={tileWall:[],tileFloor:[],paintWall:0,paintCeil:0,laminate:[],wp:0,wpTape:0,skirt:0,primer:0},per=[];
 let ok=true;const errors=[];
 rooms.forEach(r=>{
  const val=G.validate(r);
  if(!val.ok){ok=false;val.errors.forEach(e=>errors.push(`${r.name}: ${e}`));per.push({id:r.id,ok:false,errors:val.errors});return}
  const m=G.metrics(r),w=(+r.waste||0)/100;per.push({id:r.id,ok:true,m});
  if(m.byFinish.tile>0)v.tileWall.push({a:m.byFinish.tile,w,room:r.name});
  v.paintWall+=m.byFinish.paint||0;
  if(r.floor==='tile')v.tileFloor.push({a:m.floorNet,w,room:r.name});
  if(r.floor==='laminate'){v.laminate.push({a:m.floorNet,w,room:r.name});v.skirt+=Math.max(0,m.perim-m.doorW)}
  if(r.ceil==='paint')v.paintCeil+=m.ceil;
  if(r.wet??WET.includes(r.type)){v.wp+=m.floorNet+Math.max(0,m.perim-m.doorW)*0.2;v.wpTape+=Math.max(0,m.perim-m.doorW)+m.corners*0.2}
  v.primer+=(m.byFinish.tile||0)+(m.byFinish.paint||0)+(r.floor==='tile'?m.floorNet:0)+(r.ceil==='paint'?m.ceil:0);
 });
 const S=a=>a.reduce((s,x)=>s+x.a,0);
 v.area={tileWall:S(v.tileWall),tileFloor:S(v.tileFloor),paintWall:v.paintWall,paintCeil:v.paintCeil,laminate:S(v.laminate),wp:v.wp,skirt:v.skirt};
 return{ok,errors,v,per};
}

function compute(project,tierOverride){
 const tier=tierOverride||project.tier||'opt',pinned=project.pinned||{};
 const{ok,errors,v,per}=volumes(project.rooms||[]);
 const out=[],warn=[];
 if(!ok)return{ok,errors,lines:[],areas:{},per,tier,warn};
 const push=(role,qty,basis,approx)=>{if(qty>0){const p=pick(role,tier,pinned);out.push({role,pid:p.id,qty,basis,approx:!!approx})}};
 // Плитка: площадь + запас, округление до целых упаковок
 const tiles={};
 ['tileWall','tileFloor'].forEach(role=>{
  const L=v[role];if(!L.length)return;
  const p=pick(role,tier,pinned);tiles[role]=p;
  const net=L.reduce((s,x)=>s+x.a,0),gross=L.reduce((s,x)=>s+x.a*(1+x.w),0),packs=Math.ceil(gross/p.pack.q-1e-9);
  const wp=[...new Set(L.map(x=>Math.round(x.w*100)))];
  push(role,packs,`${f2(net)} м² + запас ${wp.join('/')}% = ${f2(gross)} м² ÷ ${f2(p.pack.q)} м² в уп. → ${packs} уп.`);
 });
 // Клей: площадь × норма товара (кг/м²·мм) × толщина слоя по формату плитки
 if(Object.keys(tiles).length){
  const g=pick('glue',tier,pinned);let kg=0;const parts=[];
  Object.entries(tiles).forEach(([role,t])=>{const a=v.area[role],th=glueLayer(t.spec.size);kg+=a*g.spec.rate*th;parts.push(`${f2(a)} м² × ${f2(g.spec.rate)} кг × ${th} мм`)});
  kg*=1.05;const bags=Math.ceil(kg/g.pack.q-1e-9);
  push('glue',bags,`${parts.join(' + ')} + 5% = ${f2(kg)} кг ÷ ${g.pack.q} кг → ${bags} меш. Слой по формату плитки — ориентировочно`,true);
  const big=Math.max(...Object.values(tiles).map(t=>Math.max(...t.spec.size)));
  if(big>g.spec.maxTile)warn.push({role:'glue',text:`Клей ${g.spec.cls} не рассчитан на плитку ${big} см. Нужен клей класса C2 или выше.`});
  // Затирка: (L+W)/(L·W) × толщина × шов × плотность
  const gr=pick('grout',tier,pinned);let gkg=0;const gp=[];
  Object.entries(tiles).forEach(([role,t])=>{const[a,b]=t.spec.size.map(x=>x*10),T=t.spec.thick,J=t.spec.joint||2,r=(a+b)/(a*b)*T*J*gr.spec.dens;gkg+=v.area[role]*r;gp.push(`${f2(v.area[role])} м² × ${f2(r)} кг/м²`)});
  gkg*=1.1;const gpk=Math.ceil(gkg/gr.pack.q-1e-9);
  push('grout',gpk,`${gp.join(' + ')} (формат, толщина, шов 2 мм) + 10% = ${f2(gkg)} кг → ${gpk} уп.`,true);
  // СВП — для плитки от 30 см: ≈3 клипсы на плитку
  const clipTiles=Object.entries(tiles).filter(([,t])=>Math.min(...t.spec.size)>=30);
  if(clipTiles.length){const cq=pick('clips',tier,pinned)?.pack?.q||200,n=clipTiles.reduce((s,[role,t])=>s+v.area[role]/(t.spec.size[0]*t.spec.size[1]/1e4)*3,0),pk=Math.ceil(n/cq);push('clips',pk,`≈${Math.round(n)} клипс (3 на плитку) ÷ ${cq} → ${pk} уп.`,true)}
 }
 if(v.wp>0){const p=pick('wp',tier,pinned),kg=v.wp*p.spec.rate,n=Math.ceil(kg/p.pack.q-1e-9);push('wp',n,`пол + 20 см на стены = ${f2(v.wp)} м² × ${f2(p.spec.rate)} кг/м² (2 слоя) = ${f2(kg)} кг → ${n} шт.`);
  const t=pick('wpTape',tier,pinned),rl=Math.ceil(v.wpTape/t.pack.q-1e-9);push('wpTape',rl,`примыкание пол–стена и углы ${f2(v.wpTape)} м ÷ ${t.pack.q} м → ${rl} рул.`)}
 if(v.paintWall>0){const p=pick('paintWall',tier,pinned),l=v.paintWall*p.spec.layers/p.spec.cover,n=Math.ceil(l/p.pack.q-1e-9);push('paintWall',n,`${f2(v.paintWall)} м² × ${p.spec.layers} слоя ÷ ${p.spec.cover} м²/л = ${f2(l)} л → ${n} × ${p.pack.q} л`)}
 if(v.paintCeil>0){const p=pick('paintCeil',tier,pinned),l=v.paintCeil*p.spec.layers/p.spec.cover,n=Math.ceil(l/p.pack.q-1e-9);push('paintCeil',n,`${f2(v.paintCeil)} м² × ${p.spec.layers} слоя ÷ ${p.spec.cover} м²/л = ${f2(l)} л → ${n} × ${p.pack.q} л`)}
 if(v.primer>0){const p=pick('primer',tier,pinned),l=v.primer*p.spec.rate,n=Math.ceil(l/p.pack.q-1e-9);push('primer',n,`все отделываемые поверхности ${f2(v.primer)} м² × ${f2(p.spec.rate)} л/м² = ${f2(l)} л → ${n} кан.`)}
 if(v.laminate.length){
  const p=pick('laminate',tier,pinned),net=v.area.laminate,gross=v.laminate.reduce((s,x)=>s+x.a*(1+x.w),0),n=Math.ceil(gross/p.pack.q-1e-9);
  push('laminate',n,`${f2(net)} м² + запас = ${f2(gross)} м² ÷ ${f2(p.pack.q)} м² → ${n} уп.`);
  const u=pick('underlay',tier,pinned),un=Math.ceil(net*1.05/u.pack.q-1e-9);push('underlay',un,`${f2(net)} м² + 5% ÷ ${f2(u.pack.q)} м² → ${un} уп.`);
  const s=pick('skirting',tier,pinned),sl=v.skirt*1.05,sn=Math.ceil(sl/s.pack.q-1e-9);push('skirting',sn,`периметр без дверей ${f2(v.skirt)} м + 5% ÷ ${f2(s.pack.q)} м → ${sn} шт.`);
 }
 return{ok:true,errors:[],lines:out,areas:v.area,per,tier,warn};
}
const lineSum=l=>{const p=byId(l.pid);return p?p.price*l.qty:0};
const C={compute,pick,byId,TIERS,ROOM_TYPES,WET,glueLayer,lineSum,f2};
if(typeof module!=='undefined')module.exports=C;else root.Calc=C;
})(this);
