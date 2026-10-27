// ОМА Проект — автоматическое распознавание комнат на чертеже планировки. Без нейросети: обработка изображения.
// Подходит для ортогональных планов (стены под прямым углом), где стены нарисованы толще прочих линий.
// Вход: {width,height,gray:Uint8Array}. Выход: комнаты как многоугольники в пикселях по осям стен, двери и окна.
(function(root){
function boxSum(mask,W,H,r){
 // интегральное изображение для быстрых эрозии и дилатации квадратом (2r+1)
 const I=new Int32Array((W+1)*(H+1));
 for(let y=0;y<H;y++){let s=0;for(let x=0;x<W;x++){s+=mask[y*W+x];I[(y+1)*(W+1)+x+1]=I[y*(W+1)+x+1]+s}}
 return(x,y)=>{const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(W,x+r+1),y1=Math.min(H,y+r+1);return I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0]};
}
function erode(m,W,H,r){const S=boxSum(m,W,H,r),o=new Uint8Array(W*H),full=(2*r+1)**2;for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[y*W+x]=S(x,y)===full?1:0;return o}
function dilate(m,W,H,r){const S=boxSum(m,W,H,r),o=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)o[y*W+x]=S(x,y)>0?1:0;return o}

// Толщина стен по гистограмме длин тёмных отрезков поперёк линий (длина × количество), не меньше 3 px
function wallThickness(D,W,H){
 const h=new Float64Array(61);
 const scan=(len,get)=>{let run=0;for(let i=0;i<=len;i++){if(i<len&&get(i))run++;else{if(run>0&&run<=60)h[run]++;run=0}}};
 for(let y=0;y<H;y++)scan(W,x=>D[y*W+x]);for(let x=0;x<W;x++)scan(H,y=>D[y*W+x]);
 // отрезок длиной L встречается поперёк стены ~ на всей её длине; текст даёт короткие отрезки 1–2 px
 // берём самую тонкую из заметных толщин: внутренние перегородки тоньше наружных стен
 let bv=0;for(let L=3;L<=40;L++)bv=Math.max(bv,h[L]*L);
 for(let L=3;L<=40;L++)if(h[L]*L>=0.25*bv)return L;
 return 3;
}

function recognize(img,o={}){
 const W=img.width,H=img.height,g=img.gray,T=o.threshold||120;
 const D=new Uint8Array(W*H);for(let i=0;i<W*H;i++)D[i]=g[i]<T?1:0;
 const t=o.thick||wallThickness(D,W,H);
 const r=Math.max(1,Math.floor(t/2)-1);
 // Открытие (эрозия + дилатация) оставляет только толстые линии — стены
 const Wm=dilate(erode(D,W,H,r),W,H,r);
 const ppm=o.ppm||null;
 const hw=Math.ceil(t/2)+1;
 // Оси стен: строки/столбцы с длинными сплошными отрезками стены
 const minRun=Math.max(3*t,ppm?0.3*ppm:12);
 const axes=(n,len,get)=>{const mark=[];for(let i=0;i<n;i++){let run=0,best=0;for(let j=0;j<len;j++){if(get(i,j)){run++;if(run>best)best=run}else run=0}mark.push(best>=minRun)}
  const out=[];for(let i=0;i<n;i++){if(!mark[i])continue;let j=i;while(j+1<n&&mark[j+1])j++;out.push((i+j)/2);i=j}return out};
 let ys=axes(H,W,(y,x)=>Wm[y*W+x]),xs=axes(W,H,(x,y)=>Wm[y*W+x]);
 if(xs.length<2||ys.length<2)return{ok:false,error:'Не нашёл стены на чертеже',t,rooms:[]};
 // Рамка снаружи, чтобы «улица» была отдельными ячейками по краю
 xs=[0,...xs.filter(x=>x>hw&&x<W-hw),W-1];ys=[0,...ys.filter(y=>y>hw&&y<H-hw),H-1];
 // Покрытие стеной вдоль каждой оси
 // Тонкие длинные линии (остекление, окна) тоже замыкают комнату; короткие штрихи текста — нет
 const Lmin=ppm?0.45*ppm:25,Dh=new Uint8Array(W*H),Dv=new Uint8Array(W*H);
 const TL=o.thinThreshold||215,DL=new Uint8Array(W*H);for(let i=0;i<W*H;i++)DL[i]=g[i]<TL?1:0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!DL[y*W+x])continue;let e=x;while(e+1<W&&DL[y*W+e+1])e++;if(e-x+1>=Lmin)for(let k=x;k<=e;k++)Dh[y*W+k]=1;x=e}
 for(let x=0;x<W;x++)for(let y=0;y<H;y++){if(!DL[y*W+x])continue;let e=y;while(e+1<H&&DL[(e+1)*W+x])e++;if(e-y+1>=Lmin)for(let k=y;k<=e;k++)Dv[k*W+x]=1;y=e}
 // Покрытие оси: стена, а разрыв в стене считается закрытым, только если он целиком заполнен тонкой линией
 // (остекление между двумя участками стены). Створка двери тоже тонкая линия, но заполняет разрыв лишь частично.
 const cover=(n,wallAt,thinAt)=>{const c=new Uint8Array(n);for(let i=0;i<n;i++)c[i]=wallAt(i)?1:0;
  for(let i=0;i<n;i++){if(c[i])continue;let j=i;while(j+1<n&&!c[j+1])j++;
   if(i>0&&j<n-1){let k=0;for(let q=i;q<=j;q++)k+=thinAt(q)?1:0;if(k>=0.9*(j-i+1))for(let q=i;q<=j;q++)c[q]=1}i=j}return c};
 const near=(fn)=>{for(let d=-hw;d<=hw;d++)if(fn(d))return true;return false};
 const covV=xs.map(x=>cover(H,y=>near(d=>{const xx=Math.round(x)+d;return xx>=0&&xx<W&&Wm[y*W+xx]}),y=>near(d=>{const xx=Math.round(x)+d;return xx>=0&&xx<W&&Dv[y*W+xx]})));
 const covH=ys.map(y=>cover(W,x=>near(d=>{const yy=Math.round(y)+d;return yy>=0&&yy<H&&Wm[yy*W+x]}),x=>near(d=>{const yy=Math.round(y)+d;return yy>=0&&yy<H&&Dh[yy*W+x]})));
 const runLen=c=>{const L=new Int32Array(c.length);for(let i=0;i<c.length;i++){if(c[i])continue;let j=i;while(j+1<c.length&&!c[j+1])j++;for(let k=i;k<=j;k++)L[k]=j-i+1;i=j}return L};
 const gapV=covV.map(runLen),gapH=covH.map(runLen);
 const doorMax=ppm?1.0*ppm:Math.max(34,8*t);
 // Граница между ячейками открыта, если на ней есть разрыв стены длиннее двери (вместе с продолжением разрыва вдоль оси)
 const open=(cov,gap,a,b)=>{const m=hw+1;let any=false;for(let i=Math.ceil(a+m);i<=Math.floor(b-m);i++){if(!cov[i]){any=true;if(gap[i]>doorMax)return true}}
  // короткий участок без стены вовсе и без соседей-стен тоже открыт
  return false};
 const nx=xs.length-1,ny=ys.length-1,id=(i,j)=>j*nx+i;
 // Ячейка свободна, если внутри почти нет стены
 const free=new Uint8Array(nx*ny);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x0=Math.ceil(xs[i]+hw),x1=Math.floor(xs[i+1]-hw),y0=Math.ceil(ys[j]+hw),y1=Math.floor(ys[j+1]-hw);
  if(x1<=x0||y1<=y0){free[id(i,j)]=0;continue}let w=0,n=0;for(let y=y0;y<=y1;y+=2)for(let x=x0;x<=x1;x+=2){n++;w+=Wm[y*W+x]}free[id(i,j)]=w/n<0.3?1:0}
 // Объединение ячеек (union-find)
 const par=new Int32Array(nx*ny).map((_,k)=>k),f=k=>{while(par[k]!==k){par[k]=par[par[k]];k=par[k]}return k},un=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b};
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){if(!free[id(i,j)])continue;
  if(i+1<nx&&free[id(i+1,j)]&&open(covV[i+1],gapV[i+1],ys[j],ys[j+1]))un(id(i,j),id(i+1,j));
  if(j+1<ny&&free[id(i,j+1)]&&open(covH[j+1],gapH[j+1],xs[i],xs[i+1]))un(id(i,j),id(i,j+1));}
 const comps=new Map();
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){if(!free[id(i,j)])continue;const k=f(id(i,j));if(!comps.has(k))comps.set(k,[]);comps.get(k).push([i,j])}
 const rooms=[];
 for(const cells of comps.values()){
  if(cells.some(([i,j])=>i===0||j===0||i===nx-1||j===ny-1))continue; // связано с улицей
  const set=new Set(cells.map(([i,j])=>id(i,j)));
  let area=0;cells.forEach(([i,j])=>area+=(xs[i+1]-xs[i])*(ys[j+1]-ys[j]));
  const minA=ppm?1.0*ppm*ppm:(8*t)**2;if(area<minA)continue;
  const pts=outline(cells,set,xs,ys,nx,id);if(!pts)continue;
  rooms.push({pts,areaPx:area,cells:cells.length});
 }
 // Двери и окна: разрывы стены на сторонах комнаты. Окно — в разрыве есть тонкие линии (рама), дверь — пусто.
 rooms.forEach(rm=>{rm.ops=[];const n=rm.pts.length;
  for(let k=0;k<n;k++){const a=rm.pts[k],b=rm.pts[(k+1)%n],vert=Math.abs(a[0]-b[0])<0.5;
   const L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=hw+2;let run=null;
   const thin=(s)=>{let sum=0,n=0;for(let d=-hw+1;d<=hw-1;d++){const x=vert?Math.round(a[0])+d:Math.round(s),y=vert?Math.round(s):Math.round(a[1])+d;if(x>=0&&y>=0&&x<W&&y<H){n++;sum+=g[y*W+x]}}return n&&sum/n<238};
   const dir=vert?Math.sign(b[1]-a[1]):Math.sign(b[0]-a[0]),start=vert?a[1]:a[0];
   const covered=s=>{for(let d=-hw;d<=hw;d++){const x=vert?Math.round(a[0])+d:Math.round(s),y=vert?Math.round(s):Math.round(a[1])+d;if(x>=0&&y>=0&&x<W&&y<H&&Wm[y*W+x])return true}return false};
   const flush=(s)=>{if(!run)return;const len=Math.abs(s-run.s),kind=run.thin/run.n>0.5?'window':'door',minW=ppm?0.5*ppm:3*t,maxW=kind==='window'?(ppm?5*ppm:doorMax*4):doorMax;if(len>=minW&&len<=maxW)rm.ops.push({w:k,kind,offPx:Math.abs(run.s-start),lenPx:len});run=null};
   for(let q=m;q<=L-m;q++){const s=start+dir*q;if(!covered(s)){if(!run)run={s,thin:0,n:0};run.n++;if(thin(s))run.thin++}else flush(s)}
   flush(start+dir*(L-m));
  }});
 rooms.sort((A,B)=>A.pts[0][1]-B.pts[0][1]||A.pts[0][0]-B.pts[0][0]);
 // Габарит здания по внешним стенам — для калибровки масштаба
 let bx0=W,bx1=0,by0=H,by1=0;rooms.forEach(r=>r.pts.forEach(([x,y])=>{bx0=Math.min(bx0,x);bx1=Math.max(bx1,x);by0=Math.min(by0,y);by1=Math.max(by1,y)}));
 return{ok:rooms.length>0,t,xs,ys,rooms,bbox:[bx0,by0,bx1,by1],wallMask:Wm,error:rooms.length?null:'Замкнутых комнат не найдено'};
}
// Контур объединения ячеек: обход граничных рёбер, затем удаление вершин на прямых
function outline(cells,set,xs,ys,nx,id){
 const E=new Map(),key=p=>p.join(',');
 const add=(a,b)=>E.set(key(a),b);
 cells.forEach(([i,j])=>{const has=(a,b)=>set.has(id(a,b));
  // обход по часовой стрелке на экране (ось Y вниз): верх слева направо, право сверху вниз…
  if(!has(i,j-1))add([i,j],[i+1,j]);if(!has(i+1,j))add([i+1,j],[i+1,j+1]);
  if(!has(i,j+1))add([i+1,j+1],[i,j+1]);if(!has(i-1,j))add([i,j+1],[i,j]);});
 // самый длинный цикл — внешний контур
 const used=new Set();let best=null;
 for(const k0 of E.keys()){if(used.has(k0))continue;const loop=[];let k=k0;let guard=0;
  while(!used.has(k)&&guard++<10000){used.add(k);const p=k.split(',').map(Number);loop.push(p);const nb=E.get(k);if(!nb)break;k=key(nb)}
  if(!best||loop.length>best.length)best=loop}
 if(!best||best.length<4)return null;
 const P=best.map(([i,j])=>[xs[i],ys[j]]),out=[];
 for(let k=0;k<P.length;k++){const a=P[(k-1+P.length)%P.length],b=P[k],c=P[(k+1)%P.length];if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>1e-6)out.push(b)}
 return out.length>=4?out:null;
}
const R={recognize,wallThickness};
if(typeof module!=='undefined')module.exports=R;else root.Recognize=R;
})(this);
