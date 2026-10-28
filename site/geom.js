// ОМА Проект — геометрия помещений. Чистые функции: без DOM, тестируются в node (tests/geom.test.js).
// Контур — массив вершин [[x,y],…] в метрах, обход замкнутый (последняя вершина соединяется с первой).
(function(root){
const EPS=1e-9,MIN_SEG=0.05;
const r2=v=>Math.round(v*100)/100;

function signedArea(pts){let s=0;for(let i=0;i<pts.length;i++){const[a,b]=pts[i],[c,d]=pts[(i+1)%pts.length];s+=a*d-c*b}return s/2}
const area=pts=>Math.abs(signedArea(pts));
const segLen=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function perimeter(pts){let s=0;for(let i=0;i<pts.length;i++)s+=segLen(pts[i],pts[(i+1)%pts.length]);return s}
function edges(pts){return pts.map((p,i)=>[p,pts[(i+1)%pts.length]])}

function orient(a,b,c){const v=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return Math.abs(v)<EPS?0:v>0?1:-1}
function onSeg(a,b,p){return Math.min(a[0],b[0])-EPS<=p[0]&&p[0]<=Math.max(a[0],b[0])+EPS&&Math.min(a[1],b[1])-EPS<=p[1]&&p[1]<=Math.max(a[1],b[1])+EPS}
function segIntersect(a,b,c,d){
 const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
 if(o1!==o2&&o3!==o4)return true;
 if(o1===0&&onSeg(a,b,c))return true;if(o2===0&&onSeg(a,b,d))return true;
 if(o3===0&&onSeg(c,d,a))return true;if(o4===0&&onSeg(c,d,b))return true;
 return false;
}
// Самопересечение: любые две несмежные стороны пересекаются; смежные — накладываются (разворот на 180°)
function selfIntersects(pts){
 const n=pts.length,E=edges(pts);
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  const adj=j===i+1||(i===0&&j===n-1);
  if(adj){
   const shared=j===i+1?E[i][1]:E[i][0],o1=j===i+1?E[i][0]:E[i][1],o2=j===i+1?E[j][1]:E[j][0];
   if(orient(o1,shared,o2)===0){const dx1=o1[0]-shared[0],dy1=o1[1]-shared[1],dx2=o2[0]-shared[0],dy2=o2[1]-shared[1];if(dx1*dx2+dy1*dy2>0)return true}
   continue;
  }
  if(segIntersect(E[i][0],E[i][1],E[j][0],E[j][1]))return true;
 }
 return false;
}
function pointInPoly(p,pts){
 let inside=false;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const[xi,yi]=pts[i],[xj,yj]=pts[j];
  if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))inside=!inside;
 }
 return inside;
}
function distToSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
function rectPts(x){return[[x.x,x.y],[x.x+x.w,x.y],[x.x+x.w,x.y+x.h],[x.x,x.y+x.h]]}
// Стороны пересекаются крест-накрест (касание и наложение на одной линии не считаются)
function crosses(a,b,c,d){return orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0}
// Прямоугольник внутри контура. Вплотную к стене можно (ванна, шкаф), выходить за стену — нельзя
function rectInside(x,pts){
 const E=edges(pts),inOrOn=p=>pointInPoly(p,pts)||E.some(([a,b])=>distToSeg(p,a,b)<1e-6),R=rectPts(x);
 // углы, середины сторон и центр — внутри или на стене
 const probe=[...R,...edges(R).map(([a,b])=>[(a[0]+b[0])/2,(a[1]+b[1])/2]),[x.x+x.w/2,x.y+x.h/2]];
 if(!probe.every(inOrOn))return false;
 for(const[a,b]of edges(R))for(const[c,d]of E)if(crosses(a,b,c,d))return false;
 // внутренний угол Г-образной комнаты не должен попадать в прямоугольник
 return!pts.some(p=>p[0]>x.x+1e-6&&p[0]<x.x+x.w-1e-6&&p[1]>x.y+1e-6&&p[1]<x.y+x.h-1e-6);
}
// Точка для подписи площади: центроид, если он внутри, иначе самая «глубокая» точка сетки
function labelPoint(pts){
 const A=signedArea(pts);let cx=0,cy=0;
 for(let i=0;i<pts.length;i++){const[a,b]=pts[i],[c,d]=pts[(i+1)%pts.length],f=a*d-c*b;cx+=(a+c)*f;cy+=(b+d)*f}
 const c=A?[cx/(6*A),cy/(6*A)]:pts[0];
 const depth=p=>Math.min(...edges(pts).map(([a,b])=>distToSeg(p,a,b)));
 if(pointInPoly(c,pts)&&depth(c)>0.3)return c;
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 let best=c,bd=-1;
 for(let i=1;i<24;i++)for(let j=1;j<24;j++){const p=[x0+(x1-x0)*i/24,y0+(y1-y0)*j/24];if(pointInPoly(p,pts)){const d=depth(p);if(d>bd){bd=d;best=p}}}
 return best;
}

// --- Шаблоны форм. Обход по часовой стрелке на экране (ось Y вниз)
const TEMPLATES={
 rect:{name:'Прямоугольная',params:[['L','Длина',3],['W','Ширина',2.5]],
  pts:({L,W})=>[[0,0],[L,0],[L,W],[0,W]]},
 L:{name:'Г-образная',params:[['A','Общая длина',4],['B','Общая ширина',3],['a','Вырез: длина',1.5],['b','Вырез: ширина',1.2]],
  pts:({A,B,a,b})=>[[0,0],[A,0],[A,B-b],[A-a,B-b],[A-a,B],[0,B]],
  check:({A,B,a,b})=>a<A&&b<B?null:'Вырез должен быть меньше общих размеров'},
 U:{name:'П-образная',params:[['A','Общая длина',5],['B','Общая ширина',4],['a','Выступ: ширина',2],['b','Выступ: глубина',1.2]],
  pts:({A,B,a,b})=>[[0,0],[(A-a)/2,0],[(A-a)/2,b],[(A+a)/2,b],[(A+a)/2,0],[A,0],[A,B],[0,B]],
  check:({A,B,a,b})=>a<A&&b<B?null:'Выступ должен быть меньше общих размеров'},
 niche:{name:'С нишей',params:[['L','Длина',3.6],['W','Ширина',3],['a','Ниша: ширина',1.4],['b','Ниша: глубина',0.7]],
  pts:({L,W,a,b})=>[[0,0],[L,0],[L,W],[(L+a)/2,W],[(L+a)/2,W+b],[(L-a)/2,W+b],[(L-a)/2,W],[0,W]],
  check:({L,a})=>a<L?null:'Ниша должна быть уже стены'},
 chamfer:{name:'Скошенный угол',params:[['L','Длина',3.2],['W','Ширина',2.6],['c','Скос',0.8]],
  pts:({L,W,c})=>[[0,0],[L-c,0],[L,c],[L,W],[0,W]],
  check:({L,W,c})=>c<L&&c<W?null:'Скос должен быть меньше сторон'}
};
function fromTemplate(kind,params){const t=TEMPLATES[kind];return t.pts(params).map(p=>p.map(r2))}

// --- Редактирование контура
// Изменить длину стены i: сдвигаем следующую стену целиком вдоль направления стены i,
// поэтому прямые углы сохраняются, а длину компенсирует стена через одну.
function setWallLength(pts,i,len){
 const n=pts.length,a=pts[i],b=pts[(i+1)%n],L=segLen(a,b);
 if(!(len>0)||L<EPS)return pts.map(p=>[...p]);
 const k=(len-L)/L,dx=(b[0]-a[0])*k,dy=(b[1]-a[1])*k,out=pts.map(p=>[...p]);
 const mv=n>=4?[(i+1)%n,(i+2)%n]:[(i+1)%n];
 mv.forEach(j=>{out[j]=[r2(out[j][0]+dx),r2(out[j][1]+dy)]});
 return out;
}
function insertVertex(pts,i,t=0.5){const n=pts.length,a=pts[i],b=pts[(i+1)%n],out=pts.map(p=>[...p]);out.splice(i+1,0,[r2(a[0]+(b[0]-a[0])*t),r2(a[1]+(b[1]-a[1])*t)]);return out}
function removeVertex(pts,i){if(pts.length<=3)return pts.map(p=>[...p]);const out=pts.map(p=>[...p]);out.splice(i,1);return out}
function movePoint(pts,i,p){const out=pts.map(q=>[...q]);out[i]=[r2(p[0]),r2(p[1])];return out}

// --- Проверка помещения
// room: {pts, h, walls:[{id,h?,finish}], openings:[{wallId,kind,w,h,off,sill}], excl:[{x,y,w,h}]}
function validate(room){
 const errors=[],warnings=[],pts=room.pts||[];
 if(pts.length<3){errors.push('Контур не замкнут: нужно минимум три вершины.');return{ok:false,errors,warnings}}
 const keys=new Set(pts.map(p=>p.map(v=>v.toFixed(3)).join(',')));
 if(keys.size!==pts.length)errors.push('В контуре есть повторяющиеся вершины.');
 edges(pts).forEach(([a,b],i)=>{if(segLen(a,b)<MIN_SEG)errors.push(`Стена ${i+1} короче 5 см — удалите лишнюю вершину.`)});
 if(selfIntersects(pts))errors.push('Стены пересекаются. Переместите вершины так, чтобы контур не перекрещивался.');
 const A=area(pts);
 if(A<0.5)errors.push('Площадь меньше 0,5 м² — проверьте размеры.');
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 if(Math.max(...xs)-Math.min(...xs)>40||Math.max(...ys)-Math.min(...ys)>40)errors.push('Размер помещения больше 40 м — проверьте единицы (нужны метры).');
 const H=room.h;
 if(!(H>=1.8&&H<=6))errors.push('Высота потолка должна быть от 1,8 до 6 м.');
 (room.walls||[]).forEach((w,i)=>{if(w.h!=null&&w.h!==''&&!(w.h>=0.5&&w.h<=6))errors.push(`Стена ${i+1}: высота от 0,5 до 6 м.`)});
 if(!errors.length){
  const L=edges(pts).map(([a,b])=>segLen(a,b));
  (room.openings||[]).forEach(o=>{
   const i=(room.walls||[]).findIndex(w=>w.id===o.wallId),nm=o.kind==='door'?'Дверь':'Окно';
   if(i<0){errors.push(`${nm}: стена не найдена.`);return}
   const wh=wallH(room,i);
   if(!(o.w>0)||!(o.h>0))errors.push(`${nm} на стене ${i+1}: укажите ширину и высоту.`);
   else if(o.off<0||o.off+o.w>L[i]+1e-6)errors.push(`${nm} на стене ${i+1} не помещается: стена ${L[i].toFixed(2)} м, проём ${o.off}+${o.w} м.`);
   if((o.sill||0)+o.h>wh+1e-6)errors.push(`${nm} на стене ${i+1} выше стены.`);
  });
  (room.excl||[]).forEach(x=>{
   if(!(x.w>0&&x.h>0))errors.push(`Вычет «${x.name}»: укажите размеры.`);
   else if(!rectInside(x,pts))errors.push(`Вычет «${x.name}» выходит за пределы помещения.`);
  });
 }
 return{ok:!errors.length,errors,warnings};
}
const wallH=(room,i)=>{const w=(room.walls||[])[i];return w&&w.h!=null&&w.h!==''?+w.h:+room.h};

// --- Метрики помещения
function metrics(room){
 const pts=room.pts,E=edges(pts),A=area(pts),P=perimeter(pts);
 const walls=E.map(([a,b],i)=>{
  const len=segLen(a,b),h=wallH(room,i),w=room.walls[i]||{},ops=(room.openings||[]).filter(o=>o.wallId===w.id);
  const opA=ops.reduce((s,o)=>s+o.w*o.h,0),doorW=ops.filter(o=>o.kind==='door').reduce((s,o)=>s+o.w,0);
  return{i,len,h,gross:len*h,openings:opA,net:Math.max(0,len*h-opA),finish:w.finish||'none',doorW};
 });
 const exclFloor=(room.excl||[]).reduce((s,x)=>s+x.w*x.h,0);
 const by={tile:0,paint:0,none:0};walls.forEach(w=>{by[w.finish]=(by[w.finish]||0)+w.net});
 const doorW=walls.reduce((s,w)=>s+w.doorW,0);
 return{floor:A,floorNet:Math.max(0,A-exclFloor),excl:exclFloor,ceil:A,perim:P,walls,
  wallGross:walls.reduce((s,w)=>s+w.gross,0),wallNet:walls.reduce((s,w)=>s+w.net,0),openings:walls.reduce((s,w)=>s+w.openings,0),
  byFinish:by,doorW,corners:pts.length};
}
const G={signedArea,area,perimeter,segLen,edges,segIntersect,selfIntersects,pointInPoly,rectInside,labelPoint,distToSeg,
 TEMPLATES,fromTemplate,setWallLength,insertVertex,removeVertex,movePoint,validate,metrics,wallH,r2,MIN_SEG};
if(typeof module!=='undefined')module.exports=G;else root.Geom=G;
})(this);
