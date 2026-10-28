// ОМА Проект — отрисовка 2D-плана (строго вид сверху, SVG). Используется планировщиком, сметой и проектами.
const Plan=(()=>{
 const FIN={tile:'#0057d6',paint:'#ff9a1a',none:'#9aa3b5'};
 const FIN_N={tile:'Плитка',paint:'Покраска',none:'Без отделки'};
 const f2=n=>(+n).toFixed(2).replace('.',',');
 function fit(pts,W,H,pad=60){
  if(!pts.length)return{s:80,ox:W/2-120,oy:H/2-100};
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const s=Math.min((W-2*pad)/Math.max(x1-x0,0.5),(H-2*pad)/Math.max(y1-y0,0.5));
  return{s,ox:W/2-(x0+x1)/2*s,oy:H/2-(y0+y1)/2*s};
 }
 const T=(v,p)=>[v.ox+p[0]*v.s,v.oy+p[1]*v.s];
 function grid(v,W,H){
  const step=v.s>160?0.1:v.s>60?0.5:1,out=[];
  const x0=Math.floor(-v.ox/v.s/step)*step,x1=(W-v.ox)/v.s,y0=Math.floor(-v.oy/v.s/step)*step,y1=(H-v.oy)/v.s;
  for(let x=x0;x<=x1;x+=step){const X=v.ox+x*v.s,maj=Math.abs(x-Math.round(x))<1e-6;out.push(`<line x1="${X}" y1="0" x2="${X}" y2="${H}" stroke="${maj?'#dbe3f0':'#eef2f8'}"/>`)}
  for(let y=y0;y<=y1;y+=step){const Y=v.oy+y*v.s,maj=Math.abs(y-Math.round(y))<1e-6;out.push(`<line x1="0" y1="${Y}" x2="${W}" y2="${Y}" stroke="${maj?'#dbe3f0':'#eef2f8'}"/>`)}
  return out.join('');
 }
 function scaleBar(v,W,H){const L=v.s>=120?0.5:v.s>=40?1:2,px=L*v.s,x=W-px-18,y=H-44;
  return`<g font-size="11" fill="#6b7488"><line x1="${x}" y1="${y}" x2="${x+px}" y2="${y}" stroke="#1a2233" stroke-width="2"/><line x1="${x}" y1="${y-5}" x2="${x}" y2="${y+5}" stroke="#1a2233"/><line x1="${x+px}" y1="${y-5}" x2="${x+px}" y2="${y+5}" stroke="#1a2233"/><text x="${x+px/2}" y="${y-8}" text-anchor="middle">${String(L).replace('.',',')} м</text></g>`}
 // room → SVG-разметка в экранных координатах
 function draw(room,v,o={}){
  const pts=room.pts,n=pts.length,W=o.W||600,H=o.H||400,sp=pts.map(p=>T(v,p));
  const ok=o.valid!==false,sgn=Math.sign(Geom.signedArea(pts))||1;
  let s=`<defs><pattern id="tileP${o.id||''}" width="${Math.max(6,0.3*v.s)}" height="${Math.max(6,0.3*v.s)}" patternUnits="userSpaceOnUse" x="${v.ox}" y="${v.oy}"><path d="M0 0H${Math.max(6,0.3*v.s)}V${Math.max(6,0.3*v.s)}" fill="none" stroke="#c9d7f0" stroke-width="1"/></pattern>
   <pattern id="lamP${o.id||''}" width="${Math.max(10,1.2*v.s)}" height="${Math.max(4,0.2*v.s)}" patternUnits="userSpaceOnUse" x="${v.ox}" y="${v.oy}"><rect width="100%" height="100%" fill="#f5ead9"/><path d="M0 0H${Math.max(10,1.2*v.s)}" stroke="#e2cfb1"/></pattern>
   <pattern id="hatch${o.id||''}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#9aa3b5" stroke-width="2"/></pattern></defs>`;
  // Пол выбранным материалом: формат плитки или доски в масштабе плана
  const fm=o.floorMat;let fmFill=null;
  if(fm&&room.floor!=='none'){const id='fm'+(o.id||''),pw=fm.size[0]*v.s,ph=fm.size[1]*v.s,line=/^#(f|e|d)/i.test(fm.color)?'#00000026':'#ffffff55';
   // Фото товара на полу: из снимка 600×600 берём кусок из oma-crops.js — у дерева это одна целая доска без стыков —
   // и нарезаем на доски или плитки в масштабе плана. Волокна (C[4]: «h»/«v») поворачиваем вдоль длинной стороны доски;
   // без волокон поворачиваем, только если плитка на фото стоит поперёк. sh: −1/0/1 — какой участок доски по длине взять
   const C=fm.crop||[90,90,420,420,''],vb=C.slice(0,4).join(' '),
    turn=(w,h)=>C[4]?(C[4]==='h')!==(w>=h):Math.abs(C[2]-C[3])>Math.min(C[2],C[3])*.2&&(C[2]>C[3])!==(w>h),
    cut=(x,y,w,h,sh=0)=>{const rot=turn(w,h),k=['Min','Mid','Max'][sh+1],al=rot?`xMidY${k}`:`x${k}YMid`,
     img=(W,H)=>`<svg width="${W}" height="${H}" viewBox="${vb}" preserveAspectRatio="${al} slice"><image href="${esc(fm.img)}" width="600" height="600"/></svg>`;
     return rot?`<g transform="translate(${x+w} ${y}) rotate(90)">${img(h,w)}</g>`:`<g transform="translate(${x} ${y})">${img(w,h)}</g>`};
   const sw=Math.min(pw,ph)<8?.5:1;
   if(fm.img&&Math.min(pw,ph)>=1.5&&fm.kind==='plank'){s+=`<defs><pattern id="${id}" width="${pw}" height="${2*ph}" patternUnits="userSpaceOnUse" x="${v.ox}" y="${v.oy}"><rect width="${pw}" height="${2*ph}" fill="${fm.color}"/>${cut(0,0,pw,ph)}${cut(-pw/2,ph,pw,ph,-1)}${cut(pw/2,ph,pw,ph,1)}<path d="M0 0H${pw}M0 ${ph}H${pw}M0 0V${ph}M${pw/2} ${ph}V${2*ph}" stroke="#00000033" stroke-width="${sw}" fill="none"/></pattern></defs>`;fmFill=`url(#${id})`}
   else if(fm.img&&Math.min(pw,ph)>=1.5){s+=`<defs><pattern id="${id}" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse" x="${v.ox}" y="${v.oy}"><rect width="${pw}" height="${ph}" fill="${fm.color}"/>${cut(0,0,pw,ph)}<path d="M0 0H${pw}M0 0V${ph}" stroke="${line}" stroke-width="${sw*1.2}" fill="none"/></pattern></defs>`;fmFill=`url(#${id})`}
   else if(Math.min(pw,ph)<3)fmFill=fm.color;
   else if(fm.kind==='plank'){s+=`<defs><pattern id="${id}" width="${pw}" height="${2*ph}" patternUnits="userSpaceOnUse" x="${v.ox}" y="${v.oy}"><rect width="${pw}" height="${2*ph}" fill="${fm.color}"/><rect y="${ph}" width="${pw}" height="${ph}" fill="#0000000d"/><path d="M0 0H${pw}M0 ${ph}H${pw}M0 0V${ph}M${pw/2} ${ph}V${2*ph}" stroke="${line}" stroke-width="1" fill="none"/></pattern></defs>`;fmFill=`url(#${id})`}
   else{s+=`<defs><pattern id="${id}" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse" x="${v.ox}" y="${v.oy}"><rect width="${pw}" height="${ph}" fill="${fm.color}"/><path d="M0 0H${pw}M0 0V${ph}" stroke="${line}" stroke-width="1.2" fill="none"/></pattern></defs>`;fmFill=`url(#${id})`}}
  if(o.grid!==false)s+=grid(v,W,H);
  if(o.under){const u=o.under,[a,b]=T(v,[u.x,u.y]);s+=`<image href="${u.src}" x="${a}" y="${b}" width="${u.w*v.s}" height="${u.h*v.s}" opacity="${o.underOp??.4}" preserveAspectRatio="none" style="pointer-events:none"/>`}
  (o.ghosts||[]).forEach(g=>{if(!g.pts||g.pts.length<3)return;const gp=g.pts.map(q=>T(v,q)),c=T(v,Geom.labelPoint(g.pts));
   // Активная комната: пол и стены с отделкой, но без ручек — редактируется только выбранная
   if(o.full){const ok=Geom.validate(g).ok,body=draw(g,v,{W,H,grid:false,scale:false,labels:false,valid:ok,floorMat:o.lookOf&&o.lookOf(g),id:'a'+g.id}).replace(/ data-[wox]="[^"]*"/g,'').replace(/cursor:(pointer|move|grab)/g,'cursor:inherit');
    s+=`<g data-g="${g.id}" style="cursor:${o.movable?'move':'pointer'}">${body}<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="12" font-weight="700" fill="#1a2233" paint-order="stroke" stroke="#fff" stroke-width="3" style="pointer-events:none">${esc(g.name)}</text>${ok?`<text x="${c[0]}" y="${c[1]+15}" text-anchor="middle" font-size="11" font-weight="700" fill="#0b3a9e" paint-order="stroke" stroke="#fff" stroke-width="3" style="pointer-events:none">${f2(Geom.area(g.pts))} м²</text>`:''}</g>`;return}
   s+=`<g data-g="${g.id}" style="cursor:pointer"><polygon points="${gp.map(q=>q.join(',')).join(' ')}" fill="#dfe6f2" fill-opacity=".55" stroke="#9aa8c2" stroke-width="2"/><text x="${c[0]}" y="${c[1]+4}" text-anchor="middle" font-size="12" font-weight="700" fill="#5b6780">${esc(g.name)}</text></g>`});
  if(n>=3){
   const fill=!ok?'#fde6e3':fmFill?fmFill:room.floor==='tile'?`url(#tileP${o.id||''})`:room.floor==='laminate'?`url(#lamP${o.id||''})`:'#f6f8fc';
   const body=o.interactive?' data-b="1" style="cursor:move"':'';
   s+=`<polygon${body} points="${sp.map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="none"/>`;
   if(room.floor==='tile'&&ok&&!fmFill)s+=`<polygon${body} points="${sp.map(p=>p.join(',')).join(' ')}" fill="#eef4ff" opacity=".55"/>`;
   // Вычитаемые области
   (room.excl||[]).forEach(x=>{const[a,b]=T(v,[x.x,x.y]);s+=`<g data-x="${x.id}" style="cursor:${o.interactive?'move':'default'}"><rect x="${a}" y="${b}" width="${x.w*v.s}" height="${x.h*v.s}" fill="url(#hatch${o.id||''})" stroke="#6b7488" stroke-width="1.5" opacity=".8"/>${o.labels!==false&&x.w*v.s>40?`<text x="${a+x.w*v.s/2}" y="${b+x.h*v.s/2+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1a2233" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(x.name)}</text>`:''}</g>`});
   // Стены: тёмная линия + цвет отделки
   for(let i=0;i<n;i++){const a=sp[i],b=sp[(i+1)%n],w=room.walls[i]||{},sel=o.selWall===i;
    s+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ok?'#1a2233':'#c4321b'}" stroke-width="${o.thin?4:9}" stroke-linecap="round" ${ok?'':'stroke-dasharray="10 6"'}/>`;
    s+=`<line data-w="${i}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${sel?'#18a058':FIN[w.finish]||FIN.none}" stroke-width="${o.thin?2:sel?5:3.5}" stroke-linecap="round" style="cursor:${o.interactive?'pointer':'default'}"/>`;
   }
   // Проёмы
   (room.openings||[]).forEach(op=>{
    const i=room.walls.findIndex(w=>w.id===op.wallId);if(i<0)return;
    const A=pts[i],B=pts[(i+1)%n],L=Geom.segLen(A,B);if(L<1e-6)return;
    const ux=(B[0]-A[0])/L,uy=(B[1]-A[1])/L,nx=-uy*sgn,ny=ux*sgn; // нормаль внутрь помещения
    const p1=[A[0]+ux*op.off,A[1]+uy*op.off],p2=[A[0]+ux*(op.off+op.w),A[1]+uy*(op.off+op.w)],P1=T(v,p1),P2=T(v,p2);
    const bad=op.off<0||op.off+op.w>L+1e-6;
    s+=`<g data-o="${op.id}" style="cursor:${o.interactive?'grab':'default'}"><line x1="${P1[0]}" y1="${P1[1]}" x2="${P2[0]}" y2="${P2[1]}" stroke="#fff" stroke-width="${o.thin?5:11}"/>`;
    if(op.kind==='door'){const tip=T(v,[p1[0]+nx*op.w,p1[1]+ny*op.w]),sweep=sgn>0?1:0;
     s+=`<line x1="${P1[0]}" y1="${P1[1]}" x2="${tip[0]}" y2="${tip[1]}" stroke="${bad?'#c4321b':'#1a2233'}" stroke-width="2"/><path d="M${P2[0]} ${P2[1]} A${op.w*v.s} ${op.w*v.s} 0 0 ${sweep} ${tip[0]} ${tip[1]}" fill="none" stroke="${bad?'#c4321b':'#6b7488'}" stroke-dasharray="4 3"/>`}
    else{const o1=T(v,[p1[0]+nx*0.04,p1[1]+ny*0.04]),o2=T(v,[p2[0]+nx*0.04,p2[1]+ny*0.04]),i1=T(v,[p1[0]-nx*0.04,p1[1]-ny*0.04]),i2=T(v,[p2[0]-nx*0.04,p2[1]-ny*0.04]);
     s+=`<line x1="${o1[0]}" y1="${o1[1]}" x2="${o2[0]}" y2="${o2[1]}" stroke="${bad?'#c4321b':'#3aa0e8'}" stroke-width="2"/><line x1="${i1[0]}" y1="${i1[1]}" x2="${i2[0]}" y2="${i2[1]}" stroke="${bad?'#c4321b':'#3aa0e8'}" stroke-width="2"/><line x1="${P1[0]}" y1="${P1[1]}" x2="${P2[0]}" y2="${P2[1]}" stroke="#3aa0e8" stroke-width="1"/>`}
    s+=`</g>`;
   });
   // Размеры стен
   if(o.labels!==false)for(let i=0;i<n;i++){const A=pts[i],B=pts[(i+1)%n],L=Geom.segLen(A,B);if(L<1e-6)continue;
    const ux=(B[0]-A[0])/L,uy=(B[1]-A[1])/L,nx=uy*sgn,ny=-ux*sgn,m=T(v,[(A[0]+B[0])/2,(A[1]+B[1])/2]);
    const txt=f2(L)+' м',half=txt.length*3.6+6,dd=14+Math.abs(nx)*half+Math.abs(ny)*10,lx=m[0]+nx*dd,ly=m[1]+ny*dd,ix=m[0]-nx*26,iy=m[1]-ny*26;
    s+=`<g font-size="12" font-weight="700"><rect x="${lx-txt.length*3.6-6}" y="${ly-10}" width="${txt.length*7.2+12}" height="19" rx="9" fill="#fff" stroke="#dbe3f0"/><text x="${lx}" y="${ly+4}" text-anchor="middle" fill="#1a2233">${txt}</text></g>`;
    if(o.numbers)s+=`<g data-w="${i}" style="cursor:pointer"><circle cx="${ix}" cy="${iy}" r="9" fill="${o.selWall===i?'#18a058':'#fff'}" stroke="${FIN[(room.walls[i]||{}).finish]||FIN.none}" stroke-width="2"/><text x="${ix}" y="${iy+4}" text-anchor="middle" font-size="10" font-weight="800" fill="${o.selWall===i?'#fff':'#1a2233'}">${i+1}</text></g>`;
   }
   if(o.labels!==false&&ok){const c=T(v,Geom.labelPoint(pts)),a=Geom.area(pts);
    s+=`<text x="${c[0]}" y="${c[1]+6}" text-anchor="middle" font-size="${o.thin?12:18}" font-weight="800" fill="#0b3a9e" paint-order="stroke" stroke="#fff" stroke-width="4" style="pointer-events:none">${f2(a)} м²</text>`}
   // Ручки вершин и середин
   if(o.interactive){
    for(let i=0;i<n;i++){const a=sp[i],b=sp[(i+1)%n],Lw=Geom.segLen(pts[i],pts[(i+1)%n]);
     // «+» ставим в середину самого длинного участка стены без проёмов, чтобы не перекрывать двери и окна
     const busy=(room.openings||[]).filter(o=>o.wallId===(room.walls[i]||{}).id).map(o=>[o.off,o.off+o.w]).sort((x,y)=>x[0]-y[0]);
     let best=[0,0],cur=0;[...busy,[Lw,Lw]].forEach(([s0,s1])=>{if(s0-cur>best[1]-best[0])best=[cur,s0];cur=Math.max(cur,s1)});
     const t=Lw?(best[0]+best[1])/2/Lw:0.5,mx=a[0]+(b[0]-a[0])*t,my=a[1]+(b[1]-a[1])*t;
     if((best[1]-best[0])*v.s>40)s+=`<g data-m="${i}" data-t="${t.toFixed(4)}" style="cursor:copy"><circle cx="${mx}" cy="${my}" r="7" fill="#fff" stroke="#0057d6" stroke-width="1.5" opacity=".9"/><text x="${mx}" y="${my+4}" text-anchor="middle" font-size="12" font-weight="800" fill="#0057d6">+</text></g>`}
    sp.forEach((p,i)=>{const sel=o.selV===i;s+=`<circle data-v="${i}" cx="${p[0]}" cy="${p[1]}" r="${sel?9:7}" fill="${sel?'#ff9a1a':'#fff'}" stroke="${sel?'#c76b00':'#0057d6'}" stroke-width="2.5" style="cursor:grab"/>`});
   }
  }
  if(o.drawPts&&o.drawPts.length){const dp=o.drawPts.map(p=>T(v,p));
   s+=`<polyline points="${dp.map(p=>p.join(',')).join(' ')}${o.cursor?' '+T(v,o.cursor).join(','):''}" fill="none" stroke="#0057d6" stroke-width="3" stroke-dasharray="${o.cursor?'0':'0'}"/>`;
   dp.forEach((p,i)=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${i===0?9:6}" fill="${i===0?'#ff9a1a':'#fff'}" stroke="#0057d6" stroke-width="2"/>`);
   if(o.cursor&&o.drawPts.length){const last=o.drawPts[o.drawPts.length-1],L=Geom.segLen(last,o.cursor),c=T(v,o.cursor);s+=`<text x="${c[0]+12}" y="${c[1]-10}" font-size="12" font-weight="700" fill="#0057d6">${f2(L)} м</text>`}
  }
  if(o.drawPts&&o.cursor){const c=T(v,o.cursor);s+=`<circle cx="${c[0]}" cy="${c[1]}" r="4" fill="#0057d6"/>`}
  if(o.scale!==false)s+=scaleBar(v,W,H);
  return s;
 }
 function mini(room,W=150,H=110,valid,floorMat){
  const v=fit(room.pts,W,H,14);
  return`<svg class="mini" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="План помещения">${draw(room,v,{W,H,grid:false,labels:false,thin:true,scale:false,valid,floorMat,id:'m'+room.id})}<text x="${W-6}" y="${H-6}" text-anchor="end" font-size="11" font-weight="800" fill="#0b3a9e">${f2(Geom.area(room.pts))} м²</text></svg>`;
 }
 function tplIcon(kind){
  const t=Geom.TEMPLATES[kind],pts=t.pts(Object.fromEntries(t.params.map(([k,,v])=>[k,v]))),v=fit(pts,48,38,4);
  return`<svg viewBox="0 0 48 38"><polygon points="${pts.map(p=>T(v,p).join(',')).join(' ')}" fill="#e8f0fd" stroke="#0057d6" stroke-width="2"/></svg>`;
 }
 return{fit,draw,mini,tplIcon,T,FIN,FIN_N,f2};
})();
