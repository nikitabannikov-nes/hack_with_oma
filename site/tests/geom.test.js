// Тесты геометрии и расчёта: node tests/geom.test.js
const assert=require('assert');
const G=require('../geom.js'),C=require('../calc.js');
let n=0;const t=(name,fn)=>{fn();n++;console.log('✓',name)};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} ≈ ${b}`);
const room=(pts,o={})=>({id:'r',name:'Тест',type:'living',pts,h:2.5,walls:pts.map((_,i)=>({id:'w'+i,finish:'paint'})),openings:[],excl:[],floor:'laminate',ceil:'paint',waste:10,...o});

t('прямоугольник 2×1,7: площадь и периметр',()=>{const p=G.fromTemplate('rect',{L:2,W:1.7});near(G.area(p),3.4);near(G.perimeter(p),7.4)});
t('Г-образная: площадь не равна ограничивающему прямоугольнику',()=>{const p=G.fromTemplate('L',{A:4,B:3,a:1.5,b:1.2});near(G.area(p),12-1.8);near(G.perimeter(p),14);assert.ok(G.validate(room(p)).ok)});
t('П-образная: площадь и периметр с выступом',()=>{const p=G.fromTemplate('U',{A:5,B:4,a:2,b:1.2});near(G.area(p),20-2.4);near(G.perimeter(p),18+2.4);assert.ok(G.validate(room(p)).ok)});
t('ниша добавляет площадь',()=>{const p=G.fromTemplate('niche',{L:3.6,W:3,a:1.4,b:0.7});near(G.area(p),10.8+0.98)});
t('скошенный угол: формула Гаусса',()=>{const p=G.fromTemplate('chamfer',{L:3.2,W:2.6,c:0.8});near(G.area(p),3.2*2.6-0.32);near(G.perimeter(p),2.4+Math.hypot(.8,.8)+1.8+3.2+2.6)});
t('вогнутый многоугольник',()=>{const p=[[0,0],[4,0],[4,4],[2,2],[0,4]];near(G.area(p),12);assert.ok(!G.selfIntersects(p));assert.ok(G.validate(room(p)).ok)});
t('самопересекающийся контур отклоняется',()=>{const p=[[0,0],[3,3],[3,0],[0,3]];assert.ok(G.selfIntersects(p));const v=G.validate(room(p));assert.ok(!v.ok);assert.ok(v.errors.some(e=>/пересекаются/.test(e)))});
t('меньше трёх вершин и нулевая стена',()=>{assert.ok(!G.validate(room([[0,0],[1,0]])).ok);assert.ok(!G.validate(room([[0,0],[3,0],[3,0.01],[3,2],[0,2]])).ok)});
t('перемещение одной вершины меняет площадь',()=>{const p=G.fromTemplate('rect',{L:3,W:2});const q=G.movePoint(p,2,[3,3]);near(G.area(q),7.5)});
t('изменение длины стены сохраняет прямые углы',()=>{const p=G.fromTemplate('rect',{L:3,W:2});const q=G.setWallLength(p,0,4);near(G.area(q),8);near(G.segLen(q[1],q[2]),2)});
t('вставка и удаление вершины',()=>{const p=G.fromTemplate('rect',{L:3,W:2});const q=G.insertVertex(p,0);assert.equal(q.length,5);near(G.area(q),6);assert.equal(G.removeVertex(q,1).length,4)});
t('проёмы вычитаются из площади стен',()=>{const p=G.fromTemplate('rect',{L:2,W:1.7});const r=room(p,{openings:[{id:'o',wallId:'w2',kind:'door',w:0.8,h:2,off:0.6}]});const m=G.metrics(r);near(m.wallGross,18.5);near(m.wallNet,16.9);near(m.doorW,0.8)});
t('проём шире стены — ошибка',()=>{const r=room(G.fromTemplate('rect',{L:2,W:1.7}),{openings:[{id:'o',wallId:'w1',kind:'door',w:1.5,h:2,off:0.5}]});assert.ok(!G.validate(r).ok)});
t('вычитаемая область вне помещения — ошибка',()=>{const r=room(G.fromTemplate('L',{A:4,B:3,a:1.5,b:1.2}),{excl:[{name:'Шкаф',x:3,y:2.2,w:0.6,h:0.6}]});assert.ok(!G.validate(r).ok);const ok=room(r.pts,{excl:[{name:'Шкаф',x:0.2,y:0.2,w:0.6,h:0.6}]});assert.ok(G.validate(ok).ok);near(G.metrics(ok).floorNet,10.2-0.36)});
t('разная высота стен',()=>{const p=G.fromTemplate('rect',{L:2,W:2});const r=room(p);r.walls[0].h=3;near(G.metrics(r).wallGross,2*3+2*2.5*3)});
t('расчёт ванной: плитка округляется до упаковок, клей и затирка из норм товара',()=>{
 const pts=G.fromTemplate('rect',{L:2,W:1.7});
 const r=room(pts,{type:'bath',floor:'tile',walls:pts.map((_,i)=>({id:'w'+i,finish:'tile'})),openings:[{id:'o',wallId:'w2',kind:'door',w:0.7,h:2,off:0.6}]});
 const res=C.compute({rooms:[r],tier:'opt',pinned:{}});assert.ok(res.ok);
 const L=k=>res.lines.find(l=>l.role===k);
 // количество считается от упаковки и нормы конкретного товара (реальные товары ОМА)
 const pr=id=>C.byId(id),tf=pr(L('tileFloor').pid),tw=pr(L('tileWall').pid),gl=pr(L('glue').pid);
 // пол 3,4 м² ×1,1 = 3,74 м² → целые упаковки
 assert.equal(L('tileFloor').qty,Math.ceil(3.74/tf.pack.q-1e-9));
 // стены 18,5 − 1,4 (дверь) = 17,1 ×1,1 = 18,81 м² → целые упаковки
 assert.equal(L('tileWall').qty,Math.ceil(18.81/tw.pack.q-1e-9));
 // клей: площадь × норма товара × слой по формату плитки + 5%, округление до мешков
 const kg=(3.4*gl.spec.rate*C.glueLayer(tf.spec.size)+17.1*gl.spec.rate*C.glueLayer(tw.spec.size))*1.05;
 assert.equal(L('glue').qty,Math.ceil(kg/gl.pack.q-1e-9));
 assert.ok(L('grout').qty>=1&&L('wp')&&L('wpTape'));
});
t('Г-образная комната: ламинат считается по реальной площади',()=>{
 const pts=G.fromTemplate('L',{A:4,B:3,a:1.5,b:1.2});const res=C.compute({rooms:[room(pts)],tier:'eco',pinned:{}});
 const lam=res.lines.find(l=>l.role==='laminate');near(res.areas.laminate,10.2);assert.equal(lam.qty,Math.ceil(10.2*1.1/C.byId(lam.pid).pack.q-1e-9));
});
t('выбранный пользователем товар сохраняется при смене комплектации',()=>{
 const pts=G.fromTemplate('rect',{L:2,W:2});const r=room(pts,{type:'bath',floor:'tile',walls:pts.map((_,i)=>({id:'w'+i,finish:'tile'}))});
 const res=C.compute({rooms:[r],tier:'eco',pinned:{tileWall:'tw_metro'}});assert.equal(res.lines.find(l=>l.role==='tileWall').pid,'tw_metro');assert.equal(res.lines.find(l=>l.role==='glue').pid,'glue_eco');
});
t('клей C1 на крупный формат — предупреждение',()=>{const pts=G.fromTemplate('rect',{L:2,W:2});const r=room(pts,{type:'bath',floor:'tile'});const res=C.compute({rooms:[r],tier:'eco',pinned:{tileFloor:'tf_opt'}});assert.ok(res.warn.some(w=>w.role==='glue'))});
t('ошибка геометрии не даёт ложную смету',()=>{const r=room([[0,0],[3,3],[3,0],[0,3]]);const res=C.compute({rooms:[r],tier:'opt'});assert.ok(!res.ok);assert.equal(res.lines.length,0)});
t('разные материалы в разных помещениях — отдельные позиции, одинаковые — суммируются',()=>{
 const r1=room(G.fromTemplate('rect',{L:4,W:3}),{id:'a',name:'Спальня'}),r2=room(G.fromTemplate('rect',{L:3,W:3}),{id:'b',name:'Детская'}),r3=room(G.fromTemplate('rect',{L:2,W:2}),{id:'c',name:'Кабинет'});
 r2.mat={laminate:'lam_prem'};
 const res=C.compute({rooms:[r1,r2,r3],tier:'eco',pinned:{}});const lam=res.lines.filter(l=>l.role==='laminate');
 assert.equal(lam.length,2);
 const eco=C.byId('lam_eco'),prem=C.byId('lam_prem');
 // спальня и кабинет — один товар, округляется общей площадью
 assert.equal(lam.find(l=>l.pid==='lam_eco').qty,Math.ceil((12+4)*1.1/eco.pack.q-1e-9));
 assert.equal(lam.find(l=>l.pid==='lam_prem').qty,Math.ceil(9*1.1/prem.pack.q-1e-9));
 // выбор помещения виден в разбивке по комнатам
 assert.equal(res.per.find(x=>x.id==='b').mats.laminate.pid,'lam_prem');
 // подложка и плинтус — на всю площадь ламината
 assert.ok(res.lines.find(l=>l.role==='underlay'));
});
t('выбор помещения важнее комплектации и общего выбора',()=>{
 const r=room(G.fromTemplate('rect',{L:2,W:2}),{type:'bath',floor:'tile'});r.mat={tileFloor:'tf_wood'};
 const res=C.compute({rooms:[r],tier:'prem',pinned:{tileFloor:'tf_opt'}});assert.equal(res.lines.find(l=>l.role==='tileFloor').pid,'tf_wood');
});
console.log(`\n${n} тестов пройдено`);
