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
 // Размеры словами → цифры: «два на полтора» → «2 на 1,5», «метр семьдесят» → «1,7»
 const TENS={десять:1,двадцать:2,тридцать:3,сорок:4,пятьдесят:5,шестьдесят:6,семьдесят:7,восемьдесят:8,девяносто:9};
 const ONES={один:1,одна:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8};
 function words(t){
  t=t.replace(/(?<![а-я])полтор[аы](?![а-я])/g,'1,5');
  t=t.replace(/(?<![а-я])(один|одна|два|две|три|четыре|пять|шесть|семь|восемь)\s+с\s+половиной/g,(_,w)=>ONES[w]+',5');
  t=t.replace(/(?<![а-я])(один|одна|два|две|три|четыре|пять|шесть|семь|восемь)?\s*метр\S*\s+(десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто)/g,(_,w,d)=>(w?ONES[w]:1)+','+TENS[d]);
  t=t.replace(/(\d+)\s*метр\S*\s+(\d)0(?!\d)/g,'$1,$2');
  t=t.replace(/(?<![а-я])(один|одна|два|две|три|четыре|пять|шесть|семь|восемь)(?![а-я])/g,(_,w)=>ONES[w]);
  t=t.replace(/(на\s+)метр(?![а-я])/g,'$11').replace(/(^|\s)метр(?=\s+на\s)/g,'$11');
  return t;
 }
 function parse(text){
  // Разговорное: «тыщи», «косарь», «скок» — к обычным словам
  const t=words(norm(text).replace(/тыщ\S*|косар\S*|кусок|куска/g,'тыс').replace(/(?<![а-я])скок(о|а)?(?![а-я])/g,'сколько')),o={};
  if(/обо(и|ев|ями)(?![а-я])/.test(t))o.wallp=true;
  if(/ванн(ой|ая|ую|е|у|а)(?![а-я])|ванной комнат/.test(t))o.room='bath';else if(/санузел|санузл|туалет|уборн/.test(t))o.room='wc';else if(/кухн/.test(t))o.room='kitchen';else if(/комнат|спальн|гостин|детск|(?<![а-я])зал(?![а-я])/.test(t))o.room='living';else if(/коридор|прихож/.test(t))o.room='hall';
  const nm=t.match(/спальн|гостин|детск|кабинет|(?<![а-я])зал(?![а-я])/);if(nm&&o.room==='living')o.roomName={спальн:'Спальня',гостин:'Гостиная',детск:'Детская',кабинет:'Кабинет',зал:'Зал'}[nm[0]];
  if(/плитк|кафел|керамогранит/.test(t))o.work='tile';else if(/покрас|покраш|краск/.test(t))o.work='paint';else if(/ламинат/.test(t))o.work='laminate';
  if(o.work==='paint'&&/потол/.test(t))o.part=/стен/.test(t)?'all':'ceil';
  if(o.work==='tile'){if(/только\s+пол|на пол(?![а-я])(?!.*стен)/.test(t))o.part='floor';else if(/только\s+стен|на стен(ы|ах)?(?![а-я])(?!.*пол)/.test(t))o.part='walls';else if(/пол.*стен|стен.*пол/.test(t))o.part='both'}
  const d=t.match(/(\d+(?:[.,]\d+)?)\s*(?:м|см)?\s*(?:[xх×*]|на)\s*(\d+(?:[.,]\d+)?)/);
  if(d){let a=fl(d[1]),b=fl(d[2]);if(a>20)a/=100;if(b>20)b/=100;if(a>=0.5&&b>=0.5){o.L=a;o.W=b}}
  const ar=t.match(/(\d+(?:[.,]\d+)?)\s*(?:м2|м²|кв\.?\s*м|квадрат)/);if(ar&&!o.L)o.area=fl(ar[1]);
  const h=t.match(/высот\D{0,12}(\d+(?:[.,]\d+)?)/);if(h){let x=fl(h[1]);if(x>10)x/=100;o.h=x}
  // Бюджет: «бюджет 1500», «до 1500», «1,5 тыс», «полторы тысячи»; голое «до 2» без валюты бюджетом не считаем
  const b=t.match(/(?:бюджет\D{0,15}|до\s+|за\s+|в пределах\s+|не дороже\s+|уложиться в\s+)(\d[\d ]{0,6}(?:[.,]\d+)?)\s*(тыс\S*|к(?![а-я]))?\s*(?:byn|руб|р(?![а-я])|бел|br)?/);
  if(b&&(b[2]||/бюджет|byn|руб|р(?![а-я])|бел/.test(t)||/\d{3}/.test(b[1]))){const n=fl(b[1].replace(/ /g,''))*(b[2]?1000:1);if(n>=50)o.budget=Math.round(n)}
  if(o.budget==null){const k=t.match(/(\d+(?:[.,]\d+)?)\s*(?:тыс|к(?![а-я]))/);if(k&&fl(k[1])<100)o.budget=Math.round(fl(k[1])*1000)}
  if(o.budget==null&&/полтор\S*\s*тыс|тыс\S*\s*полтор/.test(t))o.budget=1500;
  if(o.budget==null){const k=t.match(/тыс\S*\s+(\d+(?:[.,]\d+)?)(?!\s*(?:на|[xх×*]))/);if(k&&fl(k[1])<100)o.budget=Math.round(fl(k[1])*1000)}
  if(o.budget==null){const w=t.match(/(?<![а-я\d])(одн[ау]|две|три|пять)?\s*тыс(яч[аиу]?)?(?![а-я])/);if(w&&!/\d/.test(t))o.budget={одна:1000,одну:1000,две:2000,три:3000,пять:5000}[w[1]]||1000}
  if(/г-образ|г образ|буквой г/.test(t))o.shape='L';else if(/п-образ|п образ/.test(t))o.shape='U';else if(/ниш/.test(t))o.shape='niche';else if(/скос|скошен/.test(t))o.shape='chamfer';
  return{t,o};
 }
 const SVC_KW=[[/смесител|кран/,'svc_mixer'],[/унитаз/,'svc_wc'],[/раковин|тумб/,'svc_sink'],[/полотенцесуш/,'svc_rail'],[/вентилят|вытяжк/,'svc_fan'],[/замер/,'svc_measure'],[/ламинат/,'svc_lam'],[/покрас|краск/,'svc_paint'],[/потол/,'svc_ceil'],[/плитк|кафел/,'svc_tile_wall'],[/ванн/,'svc_bath']];
 const PROD_KW=/клей|затирк|смесител|краск|ламинат|грунт|гидроизол|унитаз|полотенцесуш|вентилятор|шпател|валик|плиткорез|свп|выравниван|плинтус|подложк|герметик|раковин|трап|крестик|уровень|миксер|керамогранит|плитк|светильник|ванн[ау](?![а-я])/;
 const FAQ=[
  [/клей.*керамогранит|керамогранит.*клей|какой.{0,10}кле|кле[йя].{0,10}как|клей для плитк|плиточн.*кле/,()=>glueAnswer()],
  [/c1.*c2|c2.*c1|чем отлича.*кле/,'C1 — обычный клей, C2 — усиленный (выше адгезия). Буквы: <b>T</b> — плитка не сползает со стены, <b>E</b> — увеличенное открытое время, <b>S1</b> — деформируемый, для крупного формата и тёплого пола.'],
  [/гидроизол.*(нуж|надо|делать|обязат)|(нуж|надо|делать|обязат).*гидроизол|зачем гидроизол/,()=>withProducts('Во влажных помещениях — да: обмазочная гидроизоляция по полу и на 20 см на стены, в душевой зоне — выше. Углы и стыки проклеивают лентой. В калькуляторе это включается галочкой «Влажное помещение».',PRODUCTS.filter(x=>x.roles.includes('wp')||x.roles.includes('wpTape')),'Из каталога ОМА:')],
  [/сколько слоев|слоев краск|в сколько слоев/,'Обычно 2 слоя по загрунтованной поверхности. Калькулятор считает расход по укрывистости конкретной краски (м²/л на слой) из её характеристик.'],
  [/ламинат.*кухн|кухн.*ламинат|влагостойк.*ламинат/,()=>withProducts('Для кухни и коридора берите влагостойкий ламинат 33 класса и выше. Вокруг мойки и у входа надёжнее керамогранит.',PRODUCTS.filter(x=>x.roles.includes('laminate')&&/33|34/.test(x.name+JSON.stringify(x.props||''))),'Ламинат 33–34 класса в каталоге ОМА:')],
  [/подложк.*(нуж|надо)|(нуж|надо).*подложк/,'Да, под ламинат подложка нужна всегда: она выравнивает мелкие неровности, глушит шаги и бережёт замки досок. Калькулятор добавляет её в расчёт сам, по площади пола.'],
  [/грунт.{0,15}(нуж|надо|зачем|обязат)|(нуж|надо|зачем).{0,15}грунт/,'Да: грунтовка укрепляет основание и снижает впитываемость — клей и краска держатся лучше и расходуются ровнее. Калькулятор уже добавил её по площади всех поверхностей.'],
  [/без затирк|затирк.{0,15}(нуж|надо|обязат|можно без)/,'Без затирки нельзя: швы набьются грязью, а во влажном помещении вода уйдёт под плитку. Калькулятор считает затирку по формату плитки и ширине шва.'],
  [/запас|сколько брать сверху|на подрезку/,'Для прямой укладки обычно 10%, для сложной формы (Г-, П-образная, много углов) и диагонали — 15%. Запас меняется во вкладке «Отделка» планировщика, количество округляется до целых упаковок.'],
  [/сохнет|высыха|через сколько/,'Сроки зависят от конкретной смеси — смотрите техкарту на упаковке. Точные сроки я не придумываю: в демо у меня нет данных производителя по каждому товару.'],
  [/доставк/,'В демо доставка условная: при оформлении можно выбрать самовывоз или доставку. Реальные условия доставки ОМА в прототип не подключены.'],
  [/гарант|остат|налич|скидк|акци/,'В демо у меня нет реальных остатков, акций и гарантийных условий — я не буду их выдумывать. Цены в прототипе условные.']
 ];

 // ---------- Ответы ----------
 const NOTE='<p class="note" style="margin-top:6px">Справка Омика в демо-режиме — общие рекомендации, не замена инструкции производителя.</p>';
 // Ссылка на карточку товара в каталоге
 const plink=x=>`<a class="plink" href="product.html?id=${x.id}">${esc(x.name)}</a>`;
 const pline=(x,extra='')=>`<li>${plink(x)} — <b>${byn(x.price)}</b>${extra?` · ${extra}`:''}</li>`;
 function withProducts(text,list,title,n=3){
  const L=[...list].sort((a,b)=>a.price-b.price).slice(0,n);if(!L.length)return[B(text+NOTE)];loadSt().last=L.map(x=>x.id);
  return[B(`${text}<p style="margin-top:8px">${title}</p><ul class="plist">${L.map(x=>pline(x)).join('')}</ul>${NOTE}`,{pcs:L.map(x=>x.id)})];
 }
 // Клей под керамогранит: класс C2 и выше из каталога, с учётом плитки в текущем проекте
 function glueAnswer(){
  const G=PRODUCTS.filter(x=>x.roles.includes('glue')),c2=G.filter(x=>/^C2/i.test(x.spec.cls||'')).sort((a,b)=>a.price-b.price),c1=G.filter(x=>/^C[01]/i.test(x.spec.cls||'')).sort((a,b)=>a.price-b.price);
  const p=proj(),tiles=p?p.est.lines.filter(l=>l.role==='tileFloor'||l.role==='tileWall').map(l=>P(l.pid)).filter(x=>x&&x.spec.size):[],big=tiles.length?Math.max(...tiles.map(x=>Math.max(...x.spec.size))):0;
  const cur=p&&p.est.lines.find(l=>l.role==='glue'),curP=cur&&P(cur.pid);
  const fit=x=>!big||x.spec.maxTile>=big,best=c2.filter(fit)[0]||c2[0];
  let h='Для керамогранита нужен клей класса <b>C2</b> — усиленный, с высокой адгезией: керамогранит почти не впитывает воду, и обычный клей держит его хуже. Буква <b>T</b> — плитка не сползает со стены, <b>S1</b> — эластичный, для форматов 60×120 и больше и для тёплого пола.';
  if(big)h+=`<p style="margin-top:6px">В вашем проекте «${esc(p.title)}» плитка до ${big} см${curP?`, в смете сейчас ${plink(curP)} (класс ${esc(curP.spec.cls)})${fit(curP)&&/^C2/i.test(curP.spec.cls)?' — подходит ✓':' — для такого формата не подходит'}`:''}.</p>`;
  h+=`<p style="margin-top:8px">Подойдут из каталога ОМА:</p><ul class="plist">${c2.map(x=>pline(x,`класс ${esc(x.spec.cls)}, до ${x.spec.maxTile} см, расход ${num(x.spec.rate)} кг/м² на 1 мм${x===best?' · <b>рекомендую</b>':''}`)).join('')}</ul>`;
  if(c1.length)h+=`<p class="note" style="margin-top:6px">Дешевле, но только для обычной керамической плитки небольшого формата: ${c1.slice(0,2).map(x=>`${plink(x)} (${esc(x.spec.cls)}, ${byn(x.price)})`).join(', ')}.</p>`;
  loadSt().last=c2.slice(0,3).map(x=>x.id);
  const opts=[];
  if(p&&cur&&best&&curP&&curP.id!==best.id&&!(fit(curP)&&/^C2/i.test(curP.spec.cls)))opts.push({l:`Заменить в смете на ${best.name.split(',')[0].slice(0,40)}`,a:'pin',arg:`${p.id}:glue:${best.id}`,pri:true});
  if(c2.length>1)opts.push({l:'Сравнить клеи',a:'say',arg:'Сравни их'});
  opts.push({l:'Все клеи в каталоге',a:'go',arg:'catalog.html?q='+encodeURIComponent('клей для плитки')});
  return[B(h+NOTE,{pcs:c2.slice(0,3).map(x=>x.id),opts})];
 }
 const B=(html,o={})=>({who:'b',html,...o});
 // Намерения, общие для всех веток
 const CALC=/где (можно )?(по|рас)?счита|калькулятор|(по|рас)счита(ть|й|ешь|ет)|сколько (нужно|надо|брать|взять|купить|упаков|коробок|мешков|рулонов|банок|ведер|литров|плитки|ламината|краски)/;
 const CART=/в корзин|оформ(ить|ляй|и)|купить вс|заказать|беру|покупаю/;
 const MORE=/что (еще|ещ[её]) (нужно|надо|понадоб|купить|взять)|ничего не забыл|что забыл|инструмент.*(нужен|нужн|понадоб)|чем (клеить|резать|класть)/;
 const SHARE=/ссылк|согласов|(отправ|скин|покаж|переш|показат|посмотр)\S*.{0,25}(мастер|муж|жен|клиент|прораб|бригад)|(мастер|муж|жен|клиент|прораб|бригад)\S*.{0,25}(отправ|скин|покаж|переш|показат|посмотр)/;
 const CHEAP=/дешевле|подешевл|дорого|удешев|сэконом|уложусь|в бюджет/;
 const POLITE=/^(спасибо|спс|благодар|ок|окей|ага|понятно|ясно|хорошо|отлично|супер|класс|круто)[!. ]*$/;
 const BOT=/ты (бот|робот|человек|кто|живой|нейросет)|с кем я/;
 const BATH=/(ванн[ауы]|душев|поддон)\S*.{0,30}(стоит|стоять|вычест|вычит|учит|за ней|под ней)|(вычест|вычит|учесть|убер|забер|убра|без).{0,20}ванн[ауы]/;
 const ENOUGH=/хватит|не мало|достаточно|точно (ли )?(хват|столько)|с запасом/;
 const TIER=/(эконом|оптимум|премиум)/;
 const SHOWCART=/(покаж|откр|что в|где) ?\S* ?корзин/;
 const DIY=/(сам(а|ой|и|ому)?|своими руками) .{0,15}(можно|смогу|получится|положу|положить|справл)|(можно|смогу).{0,10}сам[аи]?(?![а-я])/;
 // Цепочка «мастер → прокат → инструкция»: отказ от мастера, свой инструмент, бронь проката
 const NOMASTER=/без мастера|мастер.{0,12}(не нужен|не надо|дорог|не буду)|не нужен мастер|не (хочу|буду|надо).{0,12}мастер|сделаю сам|сам(а)? сделаю|сам(а)? (положу|покрашу|уложу|справлюсь)|своими руками/;
 const OWNTOOLS=/инструмент (есть|свой|имеется)|свой инструмент|есть (свой )?инструмент|прокат не (нужен|надо)|без проката|не нужен прокат/;
 const RENTBOOK=/(брон|оформ|возьм|бер[уё]).{0,15}прокат|прокат.{0,10}(брон|оформ|давай|беру)/;
 const RENTASK=/прокат|аренд|взять инструмент/;
 const INSTR=/инструкц|как (самому|самостоятельно|положить|уложить|покрасить|клеить|класть)|пошагов/;
 const WORK=/работ[аыу] .{0,15}(мастер|плиточ|стоит)|плиточник|стоимость работ|сколько .{0,10}(за работу|работа)/;
 const ADD=/(добав|ещ[её]|плюс|и ещ)/;
 const FURN=/(шкаф|мебел|гарнитур|кухн[яюи] стоит).{0,30}(учит|вычест|вычит|стоит|под)/;
 const SKIP=/без огранич|не знаю|пропуст|нет бюджет|не важно|неважно|без разницы|любой|сколько угодно|^нет$|^хз|понятия не имею/;
 const YES=/^(да|ага|давай|ок|окей|угу|считай|подойдет|пойдет|так и считай)/;
 // Площадь без сторон: ближайший прямоугольник с соотношением ~1,3
 const rectOf=a=>{const W=Math.round(Math.sqrt(a/1.3)*20)/20;return{L:Math.round(a/W*20)/20,W}};
 // Последний проект, о котором шла речь в чате
 const lastP=()=>getProject(loadSt().lastProject)||proj();
 function reply(text){
  const{t,o}=parse(text),s=loadSt(),sl=s.slots;
  if(sl.active){
   if(/^(отмен|стоп|хватит)|начн(ем|и) заново|другое помещение/.test(t)){s.slots={};return[B('Хорошо, начнём заново. Что ремонтируем?',{opts:STARTS})]}
   if(BATH.test(t)&&!o.L){sl.bath=true;return resume('Учту ванну 170 × 70: под ней плитку на пол не кладут, а гидроизоляцию делают.')}
   if(o.wallp&&!o.work)return resume('Обои я пока не считаю — в демо есть плитка, ламинат и покраска.');
   // Ждём бюджет — принимаем и голое число: «1500», «1 500 рублей»
   if(sl.ask==='budget'&&o.budget==null&&!o.L&&!o.area){const m=t.match(/^\D{0,15}?(\d[\d ]{1,6})(?:[.,]\d+)?\s*\D{0,12}$/);if(m){const n=+m[1].replace(/ /g,'');if(n>=50)o.budget=n}}
   // Площадь есть, сторон нет: «да, считай так» — берём предложенный прямоугольник
   if(sl.ask==='size'&&sl.area&&!o.L&&YES.test(t))Object.assign(o,rectOf(sl.area));
   if(sl.ask==='size'&&SKIP.test(t)&&!o.L&&!o.area){const m=renovation()[0];return[{...m,html:'Ничего страшного — выберите типовой размер, точные цифры поправите на плане. '+m.html.replace(/^.*?какие размеры\? /,'').replace(/ Рулетка не под рукой.*?поправите\./,'')}]}
   if(o.L||o.area||o.budget!=null||o.room||o.work||o.part||o.shape||SKIP.test(t)){
    // Бюджет назвали раньше, чем спросили: подтверждаем, что запомнили
    const early=o.budget!=null&&sl.ask!=='budget';merge(sl,o,t);const out=renovation();
    return early&&loadSt().slots.active?[{...out[0],html:`<span class="note">Бюджет ${byn(o.budget)} запомнил.</span> `+out[0].html}]:out}
   // Действия, которые имеют смысл только после расчёта: обещаем и продолжаем с текущего шага
   const later=CART.test(t)?'Досчитаю — и сразу положу всё в корзину.':SHARE.test(t)||/мастер/.test(t)&&!NOMASTER.test(t)?'Досчитаю — и дам ссылку на смету для мастера.':MORE.test(t)?'Клей, грунт, затирку и остальное я добавлю в список сам.':CALC.test(t)?'Как раз считаю, до упаковки.':POLITE.test(t)?'':null;
   if(later!=null)return resume(later);
   // Побочный вопрос посреди расчёта: отвечаем и возвращаемся к шагу, на котором остановились
   const out=route(t,o,true);
   return loadSt().slots.active?[...out,...resume('Вернёмся к расчёту.')]:out;
  }
  return route(t,o);
 }
 function resume(note){const m=renovation()[0];return[{...m,html:(note?`<span class="note">${note}</span> `:'')+m.html}]}
 // Инструкция: страница отдаёт window.GUIDE_API — шаги, отметки и действия
 const G=()=>ctx().page==='instr'&&window.GUIDE_API;
 const stepMsg=(g,pre='')=>{const st=g.state();if(st.cur<0)return B(`${pre}Все ${st.n} шагов отмечены — работа «${esc(st.name)}» готова. Сфотографируйте результат и сохраните остатки материалов: пригодятся для ремонта мелочей.`,{opts:[{l:'Снять последнюю отметку',a:'say',arg:'назад'}]});
  return B(`${pre}<b>Шаг ${st.cur+1} из ${st.n}.</b> ${st.steps[st.cur]}`,{opts:[{l:'Шаг готов',a:'gstep',arg:String(st.cur),pri:true},{l:'Сколько сохнет?',a:'say'},{l:'Нужен мастер',a:'say',arg:'Нужен мастер'}]})};
 function guideReply(t){
  const g=G();if(!g)return null;const st=g.state();
  if(/^(шаг )?(готов|сделал|сделала|сделано|закончил|выполнил|есть)|шаг готов|готово/.test(t)){if(st.cur<0)return[stepMsg(g)];g.done(st.cur);return[stepMsg(g,`Отметил шаг ${st.cur+1}. `)]}
  if(/назад|отмени|не готов|верни|снять/.test(t)){const k=g.undo();return[stepMsg(g,k>=0?`Снял отметку с шага ${k+1}. `:'Отметок пока нет. ')]}
  if(/сколько (осталось|еще|ещё)|прогресс|где я/.test(t))return[stepMsg(g,`Готово ${st.done} из ${st.n}. `)];
  if(/что дальше|дальше|следующ|какой шаг|с чего начать|что делать|начнем|начать/.test(t))return[stepMsg(g)];
  return null;
 }
 function route(t,o,inFlow){
  const s=loadSt();
  const gr=!inFlow&&guideReply(t);if(gr)return gr;
  if(/что пора|по дому|напомин|обслуж|износ|сервисн|книжк|паспорт дома|когда менять|когда перекраш/.test(t))return homeReply();
  const lp=lastP();
  if(/^(стоп|отмен|хватит)/.test(t))return[B('Хорошо. Когда захотите посчитать другое помещение — просто напишите, что делаем и размеры.',{opts:STARTS})];
  if(POLITE.test(t))return[lp?B(`Пожалуйста! Проект «${esc(lp.title)}» сохранён в аккаунте — к нему можно вернуться в любой момент.`,{opts:resultOpts(lp)}):hello(false)];
  if(BOT.test(t))return[B('Я Омик — помощник ОМА по ремонту. В этом демо я работаю по готовым сценариям, без нейросети: понимаю задачи вроде «плитка в ванной 2 на 1,7, бюджет 1500». Количество считаю не я, а калькулятор — по площадям и нормам расхода товаров.',{opts:STARTS})];
  if(RENTBOOK.test(t))return rentBookReply();
  if(OWNTOOLS.test(t))return instrReply(true);
  if(NOMASTER.test(t)||DIY.test(t))return selfReply();
  if(RENTASK.test(t))return selfReply(true);
  if(INSTR.test(t)&&!/^как (положить|уложить|покрасить) .{0,6}(мастер)/.test(t))return instrReply(false);
  if(BATH.test(t))return bathReply();
  if(o.wallp&&!o.work)return[B('Обои я пока не считаю — в демо есть плитка, ламинат и покраска стен. Посчитать покраску?',{opts:[{l:`Покрасить ${acc(o)}${o.L?` ${num(o.L)} на ${num(o.W)}`:''}`,a:'say',arg:`Покрасить ${acc(o)}${o.L?` ${o.L} на ${o.W}`:''}`}]})];
  if(lp&&ADD.test(t)&&o.room&&lp.source==='omik'){s.slots={active:true,addTo:lp.id,budget:0};merge(s.slots,o,t);if(!s.slots.work)s.slots.work=o.room==='bath'||o.room==='wc'?'tile':o.room==='kitchen'?'tile':'laminate';const out=renovation();return out}
  if(lp&&lp.source==='omik'&&o.L&&!o.room&&!o.work&&!o.area)return resizeReply(lp,o);
  if(lp&&TIER.test(t)&&!o.room&&!o.work&&!/что такое|чем/.test(t)){const k={эконом:'eco',оптимум:'opt',премиум:'prem'}[t.match(TIER)[1]];lp.tier=k;recalc(lp);touchEst(lp,'Комплектация: '+TIERS[k]);save();return[B(`Перешли на «${TIERS[k]}»:${packCard(lp)}${lp.budget?budLine(lp):''}`,{opts:resultOpts(lp)})]}
  if(SHOWCART.test(t))return[B(cartCount()?`В корзине ${cartCount()} поз. на <b>${byn(cartTotal())}</b>.`:'Корзина пока пустая.',{opts:cartCount()?[{l:'Перейти в корзину →',a:'go',arg:'cart.html',pri:true}]:lp?[{l:'Положить смету в корзину',a:'tocart',arg:lp.id,pri:true}]:STARTS})];
  if(lp&&ENOUGH.test(t))return[B(`Должно хватить: калькулятор берёт площадь с запасом ${lp.rooms[0]?.waste??10}% на подрезку и округляет вверх до целых упаковок. Если положите меньше — неоткрытые упаковки в ОМА можно вернуть.`+packCard(lp),{opts:[{l:'Объясни расчёт',a:'say'},...resultOpts(lp).slice(0,1)]})];
  if(WORK.test(t))return masterReply((SVC_KW.find(([r])=>r.test(t))||[,'svc_tile_wall'])[1]);
  if(FURN.test(t))return[B('Под шкаф-купе и кухонный гарнитур ламинат и плитку обычно не кладут — это экономия. Отметьте место под мебель на плане во вкладке «Пол», и количество пересчитается.',{opts:lp?[{l:'Отметить на плане',a:'go',arg:`planner.html?project=${lp.id}&tab=floor`,pri:true}]:STARTS})];
  if(CHEAP.test(t)&&lp&&!ctx().productId&&!/аналог/.test(t))return cheaper(lp);
  if(CALC.test(t)&&!(lp&&/сколько/.test(t)&&!o.room&&!o.work&&!o.L))return calcStart(o,t);
  if(CART.test(t))return cartReply();
  if(MORE.test(t))return moreReply();
  if(SHARE.test(t)&&lastP())return shareReply();
  if(/сколько|упаков|коробок|мешков|список/.test(t)&&lastP()&&!o.room&&!o.work)return[B(`Вот что нужно купить по проекту «${esc(lastP().title)}»:`+packCard(lastP(),12),{opts:resultOpts(lastP())})];
  if(/фото|чертеж|скан|планировк|план (квартир|дом)/.test(t))return[B('Пришлите планировку: загрузите фото или скан. Я найду на чертеже стены, комнаты, двери и окна — нужен только общий размер для масштаба. Получится проект со сметой на все помещения.',{opts:[{l:'Загрузить планировку',a:'go',arg:'import.html',pri:true},{l:'Посмотреть пример',a:'go',arg:'import.html?example=house'}]})];
  if(/^(привет|здравств|добр|хай|hello)|что (ты )?умеешь|помоги|помощь/.test(t))return[hello(true)];
  if(/объясни|как посчитал|почему столько|откуда/.test(t)&&proj())return explain();
  if(/сравн|чем отлича|разниц/.test(t)&&!/c1|c2|кле/.test(t))return compare();
  if(/аналог|подешевле|замен|похож|дешевле/.test(t))return analog(t);
  const svcHit=SVC_KW.find(([r])=>r.test(t));
  if(/мастер|установ|уложит|монтаж|бригад|кто (может|сделает)|вызвать|замерщик|замер/.test(t))return masterReply(svcHit?svcHit[1]:null);
  const faq=FAQ.find(([r])=>r.test(t));if(faq)return typeof faq[1]==='function'?faq[1](t):[B(faq[1]+NOTE)];
  const renov=o.room||o.L||o.area||o.shape||/ремонт|положит|уложить|поменять|сделать|обновить|переделать|покрасить|постелить|отделк/.test(t);
  if(renov&&(o.room||o.work||o.L||o.area)){s.slots={active:true};merge(s.slots,o,t);return renovation()}
  if(inFlow&&!PROD_KW.test(t))return[B('Не совсем понял ответ.')];
  if(lp&&!PROD_KW.test(t)&&/\?|можно|нужн|надо|стоит ли|точно/.test(t))return[B('Не совсем понял вопрос. Могу объяснить, как посчитано количество, подобрать дешевле или положить всё в корзину.',{opts:[{l:'Объясни расчёт',a:'say'},{l:'Как удешевить смету?',a:'say'},...resultOpts(lp).slice(0,1)]})];
  if(PROD_KW.test(t)||searchProducts(t,1).length&&t.length>3)return productReply(t,o);
  return[B('Не совсем понял. Лучше всего я считаю ремонт: напишите, <b>что делаем, где и какого размера</b>, например «ламинат в комнате 4 на 3». Ещё могу подобрать товар или аналог дешевле.',{opts:STARTS})];
 }
 const STARTS=[{l:'Плитка в ванной 2,2 на 1,7, бюджет 1500',a:'say'},{l:'Ламинат в комнате 4 на 3',a:'say'},{l:'Покрасить комнату 4 на 3',a:'say'},{l:'Клей для керамогранита',a:'say'}];
 // «Где посчитать ламинат?», «сколько нужно плитки на ванную» — считаем прямо в чате, калькулятор — запасной путь
 function calcStart(o,t){
  const s=loadSt();
  if(!s.slots.active)s.slots={active:true};
  if(o.work==='laminate'&&!o.room&&!s.slots.room)o.room='living';
  merge(s.slots,o,t);
  const sl=s.slots,task=sl.room||'living',work=sl.work||'';
  const what={laminate:'ламинат',tile:'плитку',paint:'краску'}[work]||'материалы';
  const kit={laminate:'с подложкой и плинтусом',tile:'с клеем, затиркой, грунтом и гидроизоляцией',paint:'с грунтом'}[work]||'со всем, что идёт в комплект';
  const out=renovation(),m=out[0];if(!loadSt().slots.active)return out;
  return[{...m,html:`Посчитаю ${what} прямо здесь — до целых упаковок, ${kit}. `+m.html,opts:[...(m.opts||[]).filter(x=>x.arg!=='Г-образная'),{l:'Сложная форма — на плане',a:'go',arg:`planner.html?new=1&task=${task}${work?'&work='+work:''}&from=omik`}]}];
 }
 // «Ванна стоит — вычесть?»: вычитаем место под ванной из пола прямо в чате
 function bathReply(){
  const p=lastP(),r=p&&(p.rooms.find(x=>x.type==='bath')||p.rooms[0]);
  const h='Да, учтите: под ванной плитку на пол не кладут. Стандартная ванна 170 × 70 см — это минус 1,2 м² плитки.';
  if(!r)return[B(h+' Сначала посчитаем ванную — напишите размеры.',{opts:STARTS})];
  if((r.excl||[]).some(x=>/ванн/i.test(x.name)))return[B('Ванна уже вычтена из пола. Размер и место можно поправить на плане.',{opts:[{l:'Открыть план',a:'go',arg:`planner.html?project=${p.id}&room=${r.id}&tab=floor`}]})];
  return[B(h,{opts:[{l:'Вычесть ванну 170 × 70',a:'bathx',arg:p.id+':'+r.id,pri:true},{l:'Другой размер — на плане',a:'go',arg:`planner.html?project=${p.id}&room=${r.id}&tab=floor`}]})];
 }
 // Винительный падеж: «покрасить спальню»
 const acc=o=>({Спальня:'спальню',Гостиная:'гостиную',Детская:'детскую',Кабинет:'кабинет',Зал:'зал'})[o.roomName]||{bath:'ванную',wc:'санузел',kitchen:'кухню',living:'комнату',hall:'коридор'}[o.room]||'комнату';
 const budLine=p=>{const tot=estTotal(p),fit=tot<=p.budget;return`<div class="bud ${fit?'ok':'over'}">${fit?`✓ В бюджете ${byn(p.budget)}`:`Выше бюджета ${byn(p.budget)} на ${byn(tot-p.budget)}`}</div>`};
 // «добавь ещё коридор 3 на 1,2» — новое помещение в тот же проект
 function addRoomTo(p,r){
  if(p.rooms.some(q=>q.name===r.name)){let k=2;while(p.rooms.some(q=>q.name===r.name+' '+k))k++;r.name+=' '+k}
  p.rooms.push(r);recalc(p);touchEst(p,`Омик: добавлено помещение «${r.name}»`);save();loadSt().slots={};loadSt().lastProject=p.id;
  return[B(`Добавил «${esc(r.name)}» в проект «${esc(p.title)}» и пересчитал всё вместе:${packCard(p)}${p.budget?budLine(p):''}`,{opts:resultOpts(p)})];
 }
 // «а если 2 на 2» после расчёта — меняем размеры той же комнаты
 function resizeReply(p,o){
  const r=p.rooms[p.rooms.length-1];
  if(p.rooms.length>1||r.shape?.kind!=='rect')return[B('Размеры комнаты сложной формы удобнее поменять на плане.',{opts:[{l:'Открыть план',a:'go',arg:`planner.html?project=${p.id}&room=${r.id}`,pri:true}]})];
  r.shape={kind:'rect',params:{L:o.L,W:o.W}};r.pts=Geom.fromTemplate('rect',{L:o.L,W:o.W});
  r.excl=r.excl.filter(x=>Geom.rectInside(x,r.pts));
  r.openings.forEach(q=>{const w=r.walls.findIndex(x=>x.id===q.wallId),len=w<0?0:Geom.segLen(r.pts[w],r.pts[(w+1)%r.pts.length]);q.w=Math.min(q.w,len-0.2);q.off=Math.max(0.1,Math.min(q.off,len-q.w-0.1))});
  recalc(p);touchEst(p,`Омик: размеры ${num(o.L)} × ${num(o.W)} м`);save();
  if(!p.calc.ok)return[B('С такими размерами не сходится геометрия — поправьте на плане.',{opts:[{l:'Открыть план',a:'go',arg:'planner.html?project='+p.id,pri:true}]})];
  return[B(`Пересчитал «${esc(r.name)}» на ${num(o.L)} × ${num(o.W)} м:${packCard(p)}${p.budget?budLine(p):''}`,{opts:resultOpts(p)})];
 }
 // «Мой дом»: что пора сделать по дому
 function homeReply(){
  const L=careList(),due=L.filter(x=>x.status!=='ok');
  if(!homeProjects().length)return[B('Когда купите материалы по смете, я запишу их в раздел «Мой дом» и заранее напомню: когда менять герметик в ванной, пропитать швы, освежить покраску.',{opts:[{l:'Открыть «Мой дом»',a:'go',arg:'projects.html#home',pri:true}]})];
  const top=(due.length?due:L).slice(0,3);
  return[B(`${due.length?`По дому ${due.length} ${due.length===1?'дело':due.length<5?'дела':'дел'}:`:'Срочных дел нет. Ближайшие:'}<div class="card-in">${top.map(x=>`<div class="row pk"><span>${esc(x.rule.t)}<small>${esc(x.r.name)}</small></span><b>${new Date(x.due).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</b></div>`).join('')}</div>`,{opts:[{l:'Открыть «Мой дом»',a:'go',arg:'projects.html#home',pri:true}]})];
 }
 function cartMsg(p){
  if(!p.calc?.ok)return B('В проекте ошибка геометрии — сначала поправьте план, потом соберу корзину.',{opts:[{l:'Открыть план',a:'go',arg:'planner.html?project='+p.id,pri:true}]});
  cartSyncProject(p);const L=p.est.lines.filter(l=>l.qty>0);
  return B(`Положил в корзину <b>${L.length} ${L.length%10===1&&L.length%100!==11?'позицию':L.length%10>=2&&L.length%10<=4&&(L.length%100<10||L.length%100>=20)?'позиции':'позиций'}</b> на <b>${byn(estTotal(p))}</b> — ровно столько упаковок, сколько посчитал калькулятор. Заберите в магазине или закажите доставку.`,
   {opts:[{l:'Перейти в корзину →',a:'go',arg:'cart.html',pri:true},{l:'Что ещё понадобится?',a:'say'}]});
 }
 function cartReply(){
  const p=lastP();
  if(!p)return[B('Сначала посчитаем, что купить. Что ремонтируем?',{opts:STARTS})];
  return[cartMsg(p)];
 }
 // Сопутствующее: что уже входит в расчёт и какой инструмент обычно докупают
 function moreReply(){
  const p=lastP();
  if(!p)return[B('Скажите, что ремонтируем, — и я соберу полный список: материал, клей, грунт, затирку и инструмент.',{opts:STARTS})];
  const a=p.calc?.areas||{},works=new Set();if(a.tileWall||a.tileFloor)works.add('tile');if(a.paintWall||a.paintCeil)works.add('paint');if(a.laminate)works.add('floor');if(a.wp)works.add('wet');
  const inc=p.est.lines.filter(l=>l.role&&!['tileFloor','tileWall','laminate','paintWall','paintCeil'].includes(l.role)).map(l=>ROLES[l.role].toLowerCase());
  const kit=[...works].flatMap(w=>KITS[w]).filter((id,i,arr)=>arr.indexOf(id)===i&&!p.est.lines.some(l=>l.pid===id)).map(P).filter(Boolean).slice(0,4);
  loadSt().last=kit.map(x=>x.id);
  let h=inc.length?`Расходники уже в расчёте: <b>${[...new Set(inc)].join(', ')}</b>.`:'Основные материалы уже в расчёте.';
  h+=kit.length?`<p style="margin-top:6px">Обычно ещё докупают инструмент — если его нет дома:</p>`:'<p style="margin-top:6px">Из инструмента ничего особого не нужно.</p>';
  return[B(h,{pcs:kit.map(x=>x.id),opts:[{l:'Всё по смете в корзину',a:'tocart',arg:p.id,pri:true},{l:'Открыть смету',a:'go',arg:'smeta.html?project='+p.id}]})];
 }
 function shareReply(){
  const p=lastP();
  return[B('Отправьте смету ссылкой в Viber или Telegram. Она откроется на любом телефоне без регистрации: мастер или домашние увидят размеры, количество и расчёт и смогут согласовать или попросить изменения.',{opts:[{l:'Получить ссылку',a:'go',arg:`smeta.html?project=${p.id}&share=1`,pri:true}]})];
 }
 // Что купить: материалы и расходники с количеством в упаковках
 const MAIN_ROLES=['tileFloor','tileWall','laminate','paintWall','paintCeil'];
 function packCard(p,n=innerWidth<=800?4:6){
  const L=[...p.est.lines].filter(l=>l.qty>0&&P(l.pid)).sort((a,b)=>(MAIN_ROLES.includes(b.role)-MAIN_ROLES.includes(a.role))||lineTotal(b)-lineTotal(a));
  const rows=L.slice(0,n).map(l=>{const pr=P(l.pid);return`<div class="row pk"><span>${l.role?esc(ROLES[l.role]):'Товар'}<small>${plink(pr)}</small></span><b>${l.qty} ${esc(pr.unit)}</b></div>`}).join('');
  const rest=L.length-n;
  return`<div class="card-in">${rows}${rest>0?`<div class="row note"><span>и ещё ${rest} поз. — в смете</span></div>`:''}<div class="row tot"><span>Итого</span><b>${byn(estTotal(p))}</b></div></div>`;
 }
 function resultOpts(p,o={}){
  const rect=p.rooms.length===1&&p.rooms[0].shape?.kind==='rect';
  return[{l:'Всё в корзину',a:'tocart',arg:p.id,pri:!o.over},{l:'Смета с расчётом',a:'go',arg:'smeta.html?project='+p.id},rect?{l:'Ссылка для мастера',a:'go',arg:`smeta.html?project=${p.id}&share=1`}:{l:'Уточнить форму на плане',a:'go',arg:`planner.html?project=${p.id}&from=omik`},{l:'Кто сделает работу?',a:'say',arg:'Нужен мастер'}];
 }
 function merge(sl,o,t){
  Object.assign(sl,Object.fromEntries(Object.entries(o).filter(([,v])=>v!=null)));
  if(sl.ask==='budget'&&o.budget==null&&SKIP.test(t)||/без огранич|нет бюджет/.test(t))sl.budget=0;
  if(o.area&&!o.L){sl.L=null;sl.W=null}
 }
 function hello(full){
  const c=ctx(),p=proj();
  let h='Привет! Я <b>Омик</b>, помощник по ремонту ОМА. Скажите, что делаете и какого размера комната, — посчитаю материалы до упаковки, уложусь в бюджет и соберу корзину.';
  const opts=[{l:'Плитка в ванной 2,2 на 1,7, бюджет 1500',a:'say'},{l:'Где посчитать ламинат?',a:'say'},{l:'Покрасить комнату 4 на 3',a:'say'},{l:'Клей для керамогранита',a:'say'}];
  if(c.page==='smeta'&&p){h=`Это смета проекта «${esc(p.title)}». Могу объяснить, как посчитано количество, подсказать, как уложиться в бюджет, или собрать всё в корзину.`;opts.splice(0,4,{l:'Объясни расчёт',a:'say'},{l:'Как удешевить смету?',a:'say'},{l:'Что ещё понадобится?',a:'say'},{l:'Всё в корзину',a:'tocart',arg:p.id})}
  if(c.page==='dom'){const m=homeReply()[0];h=m.html;opts.splice(0,4,{l:'Что пора по дому?',a:'say'},{l:'Посчитать новый ремонт',a:'say',arg:'Плитка в ванной 2,2 на 1,7, бюджет 1500'})}
  else if(c.page==='instr'&&G()){const m=stepMsg(G(),`Я веду вас по инструкции «${esc(G().state().name)}». Отмечайте шаги здесь или в списке — подскажу, что дальше. `);h=m.html;opts.splice(0,4,...m.opts)}
  else if(c.page==='planner'&&p){h='Помогу с планом. Г-образную или П-образную комнату выберите в «Форма», сложную — нарисуйте по точкам. Количества пересчитаются сами.';opts.splice(0,4,{l:'Какой запас брать?',a:'say'},{l:'Нужна ли гидроизоляция?',a:'say'},{l:'Объясни расчёт',a:'say'})}
  if(c.page==='product'&&c.productId){const pr=P(c.productId);h=`Смотрите «${esc(pr.name)}». Могу посчитать нужное количество по плану комнаты, найти аналог или мастера для установки.`;
   opts.splice(0,4,...[pr.roles.length?{l:'Рассчитать количество',a:'go',arg:'product.html?id='+pr.id+'#calc'}:null,{l:'Найди аналог дешевле',a:'say'},pr.service?{l:'Нужен мастер для установки',a:'say'}:null].filter(Boolean))}
  return B(h+(full?'<p class="note" style="margin-top:6px">Демо-режим: отвечаю по сценариям, без внешней LLM. Цены и количества беру из каталога и калькулятора.</p>':''),{opts});
 }
 // Сценарий расчёта: помещение → работа → размеры → бюджет → результат. sl.ask — шаг, ответа на который ждём
 function renovation(){
  const sl=loadSt().slots;
  if(sl.work==='laminate'&&!sl.room)sl.room='living';
  if(!sl.room){sl.ask='room';const tile=sl.work==='tile';return[B('Какое помещение ремонтируем?',{opts:(tile?['Ванная','Санузел','Кухня']:['Комната','Кухня','Коридор']).map(l=>({l,a:'say'}))})]}
  if(!sl.work){sl.ask='work';return[B(`${RT[sl.room].name}: что делаем?`,{opts:(['bath','wc'].includes(sl.room)?['Плитка на пол и стены','Плитка только на пол','Покраска стен']:['Ламинат на пол','Покраска стен','Плитка на пол']).map(l=>({l,a:'say'}))})]}
  if(sl.work==='tile'&&!sl.part&&['bath','wc'].includes(sl.room))sl.part='both';
  if(!sl.L&&!sl.shape){
   sl.ask='size';
   if(sl.area){const{L,W}=rectOf(sl.area);
    return[B(`Площадь ${num(sl.area)} м² есть, но для стен и плинтуса нужны длина и ширина. Напишите их, например «${['bath','wc'].includes(sl.room)?'2,2 на 1,7':'4 на 3'}». Или посчитаю как прямоугольник ${num(L)} × ${num(W)} м — потом поправите на плане.`,{opts:[{l:`Считай ${num(L)} × ${num(W)} м`,a:'say',arg:`${L} на ${W}`},{l:'Комната не прямоугольная',a:'say',arg:'Г-образная'}]})]}
   const ex=['bath','wc'].includes(sl.room)?[['2,2 × 1,7 м','2,2 на 1,7'],['1,5 × 1,2 м','1,5 на 1,2']]:[['4 × 3 м','4 на 3'],['5 × 3,5 м','5 на 3,5']];
   return[B(`${RT[sl.room].name}: какие размеры? Напишите длину и ширину, например <b>«${ex[0][1]}»</b>. Рулетка не под рукой — возьмите примерно, на плане поправите.`,{opts:[...ex.map(([l,arg])=>({l,a:'say',arg})),{l:'Г-образная — нарисую план',a:'say',arg:'Г-образная'}]})]}
  if(sl.budget==null){sl.ask='budget';return[B('Есть бюджет на материалы? Напишите сумму — подберу комплектацию, которая в него помещается.',{opts:[{l:'до 800 BYN',a:'say',arg:'бюджет 800 BYN'},{l:'до 1500 BYN',a:'say',arg:'бюджет 1500 BYN'},{l:'до 3000 BYN',a:'say',arg:'бюджет 3000 BYN'},{l:'Без ограничений',a:'say'}]})]}
  return createFromSlots();
 }
 // Считаем только ту работу, о которой спросили: потолок и прочее добавляются на плане
 function surfaces(r,sl){
  r.ceil='none';
  if(sl.work==='tile'){r.floor=sl.part==='walls'?'none':'tile';r.walls.forEach(w=>w.finish=sl.part==='floor'?'none':'tile')}
  if(sl.work==='paint'){r.walls.forEach(w=>w.finish=sl.part==='ceil'?'none':'paint');r.floor='none';if(sl.part==='ceil'||sl.part==='all')r.ceil='paint'}
  if(sl.work==='laminate'){r.floor='laminate';r.walls.forEach(w=>w.finish='none')}
 }
 function createFromSlots(){
  const s=loadSt(),sl=s.slots,kind=sl.shape||'rect';
  const r=kind==='rect'?makeRoom(sl.room,'rect',{L:sl.L,W:sl.W}):makeRoom(sl.room,kind);
  if(sl.h)r.h=sl.h;if(sl.roomName)r.name=sl.roomName;surfaces(r,sl);
  if(sl.bath&&r.type==='bath')r.excl.push({id:uid(),name:'Ванна',x:0,y:0,w:Geom.r2(Math.min(1.7,sl.L||1.7)),h:Geom.r2(Math.min(0.7,sl.W||0.7))});
  const host=sl.addTo&&getProject(sl.addTo);
  if(host)return addRoomTo(host,r);
  const workN={tile:'плитка',paint:sl.part==='ceil'?'покраска потолка':'покраска',laminate:'ламинат'}[sl.work];
  let title=`${r.name}: ${workN}`;const same=load().projects.filter(x=>x.title===title||x.title.startsWith(title+' (')).length;if(same)title+=` (${same+1})`;
  const p=newProject({title,task:sl.room,rooms:[r],budget:sl.budget||null,source:'omik',logText:'Проект создан Омиком из диалога'});
  // Комплектация под бюджет: самая полная, которая помещается
  let tier='opt';const tt={};['eco','opt','prem'].forEach(k=>tt[k]=tierTotal(p,k));
  if(sl.budget){tier=['prem','opt','eco'].find(k=>tt[k]!=null&&tt[k]<=sl.budget)||'eco'}
  p.tier=tier;recalc(p);addProject(p);s.slots={};s.lastProject=p.id;
  const m=Geom.metrics(r),tot=estTotal(p),fit=!sl.budget||tot<=sl.budget;
  const size=kind==='rect'?`${num(sl.L)} × ${num(sl.W)} м`:Geom.TEMPLATES[kind].name.toLowerCase();
  const surf=[r.floor!=='none'?`пол ${num(m.floorNet)} м²`:'',r.walls.some(w=>w.finish!=='none')?`стены ${num(m.wallNet)} м² без двери`:'',r.ceil==='paint'?`потолок ${num(m.ceil)} м²`:''].filter(Boolean).join(', ');
  let h=`<b>${esc(r.name)} ${size}</b> — ${surf}. Комплектация «${TIERS[tier]}».`;
  if(sl.budget)h+=`<div class="bud ${fit?'ok':'over'}">${fit?`✓ ${byn(tot)} — в бюджете ${byn(sl.budget)}, остаётся ${byn(sl.budget-tot)}`:`${byn(tot)} — выше бюджета ${byn(sl.budget)} на ${byn(tot-sl.budget)}`}</div>`;
  h+=`<p style="margin-top:8px">Вот что купить:</p>${packCard(p)}`;
  h+=`<p class="note" style="margin-top:6px">Количество считает калькулятор по площадям и нормам расхода каждого товара, с запасом ${r.waste}% на подрезку и округлением до целых упаковок.${kind!=='rect'?' Форму я поставил типовую — задайте точные размеры на плане.':''}</p>`;
  const opts=resultOpts(p,{over:!fit});
  if(!fit){h+=sl.work==='tile'&&sl.part!=='floor'?`<p>Чтобы уложиться, можно оставить плитку на полу, а стены покрасить.</p>`:`<p>Могу подобрать, где сэкономить.</p>`;opts.unshift(sl.work==='tile'&&sl.part!=='floor'?{l:'Стены — покраска вместо плитки',a:'mod',arg:p.id+':wallsPaint',pri:true}:{l:'Как уложиться в бюджет?',a:'say',pri:true})}
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
  return[B(`Нашёл в каталоге ${L.length} ${L.length===1?'товар':'товара'}${stm?'. Есть вариант собственной марки ОМА — обычно дешевле при сопоставимых характеристиках':''}:<ul class="plist">${L.map(x=>pline(x,x.stm?'СТМ ОМА':'')).join('')}</ul>`,{pcs:L.map(x=>x.id),opts:[L.length>1?{l:'Сравнить',a:'say',arg:'Сравни их'}:null,{l:'Показать все в каталоге',a:'go',arg:'catalog.html?q='+encodeURIComponent(t)}].filter(Boolean)})];
 }
 function analog(t){
  const s=loadSt(),base=P(ctx().productId)||P(s.last[0]);
  if(!base){const L=searchProducts(t,1);if(L.length)return analogOf(L[0]);return[B('Аналог чего ищем? Откройте товар или напишите название, например «аналог клея C2TE».')]}
  return analogOf(base);
 }
 function analogOf(base){
  const A=analogs(base.id).slice(0,4);if(!A.length)return[B(`Для «${esc(base.name)}» аналогов в демо-каталоге нет.`)];
  loadSt().last=[base.id,...A.map(x=>x.id)].slice(0,3);
  const rows=A.map(x=>{const d=x.price-base.price;return`<div class="row"><span>${plink(x)}${x.stm?' <span class="tag stm">СТМ</span>':''}</span><b style="color:${d<0?'var(--ok)':'var(--ink)'}">${d<0?'−':'+'}${byn(Math.abs(d))}</b></div>`}).join('');
  return[B(`Аналоги для ${plink(base)} (${byn(base.price)}):<div class="card-in">${rows}</div><p class="note" style="margin-top:6px">Сравнивайте характеристики: дешевле не всегда равноценно. Например, класс клея или стойкость краски к мытью.</p>`,{pcs:A.slice(0,3).map(x=>x.id),opts:[{l:'Сравнить характеристики',a:'say',arg:'Сравни их'}]})];
 }
 function compare(){
  const ids=loadSt().last.slice(0,3).filter(P);
  if(ids.length<2)return[B('Сначала найдите 2–3 товара — например, «покажи клей для плитки», — и я их сравню.')];
  const L=ids.map(P),keys=[...new Set(L.flatMap(x=>(x.props||[]).map(q=>q[0])))].slice(0,6);
  const tbl=`<div style="overflow:auto"><table class="cmp" style="font-size:12px;margin-top:8px"><tr><th></th>${L.map(x=>`<td><b>${esc(x.name)}</b></td>`).join('')}</tr><tr><th>Цена</th>${L.map(x=>`<td><b>${byn(x.price)}</b></td>`).join('')}</tr>${keys.map(k=>`<tr><th>${k}</th>${L.map(x=>`<td>${esc((x.props.find(q=>q[0]===k)||[,'—'])[1])}</td>`).join('')}</tr>`).join('')}</table></div>`;
  return[B('Сравнение по характеристикам из карточек товаров:'+tbl,{opts:[{l:'Открыть подробное сравнение',a:'go',arg:'catalog.html?cmp='+ids.join(',')}]})];
 }
 // Отказались от мастера: предлагаем прокат под работы проекта; можно отказаться — тогда инструкция
 function selfReply(asked){
  const p=lastP(),rent=p?rentalFor(p):RENTAL.slice(0,4);
  if(p&&!asked){setDoer(p,'self')}
  if(p&&!rent.length)return instrReply(false,'Для ваших работ особый инструмент не нужен.');
  const R=p?rentalState(p):null,sum=p?rentalSum(p):null;
  const list=rent.map(r=>`<li style="display:flex;gap:8px;align-items:center"><img src="${r.img}" alt="" loading="lazy" style="width:44px;height:44px;object-fit:contain;flex:none;background:#fff;border-radius:6px"><span><b>${esc(r.name)}</b> — ${byn(r.day)}/сут.${R?.items[r.id]?`, ${R.items[r.id]} сут.`:r.opt?' — по желанию':''}<br><span class="note">${esc(r.why)}</span></span></li>`).join('');
  const h=`${asked?'':'Хорошо, делаем сами! '}Чтобы не покупать инструмент на пару дней, возьмите его в <b>прокат ОМА</b>${p?' — подобрал под ваши работы':''}:<ul class="plist">${list}</ul>${sum&&sum.sum?`Прокат ≈ <b>${byn(sum.sum)}</b>, залог ${byn(sum.dep)} вернём при сдаче.`:''}<p class="note" style="margin-top:6px">Цены проката демонстрационные.</p>`;
  return[B(h,{opts:[p?{l:'Забронировать прокат',a:'go',arg:`smeta.html?project=${p?.id}&doer=self#doer`,pri:true}:{l:'Посчитать прокат по проекту',a:'say',arg:'Посчитай ремонт'},{l:'У меня есть инструмент',a:'say',arg:'Инструмент есть, прокат не нужен'},{l:'Всё-таки мастер',a:'say',arg:'Нужен мастер'}].filter(Boolean)})];
 }
 // Бронь — в смете: там выбирают инструмент и сутки и оставляют белорусский номер; в чате не регистрируем
 function rentBookReply(){
  const p=lastP();
  if(!p)return[B('Сначала посчитаем ремонт — тогда подберу прокат под ваши работы. Что делаем и какого размера?',{opts:STARTS})];
  setDoer(p,'self');rentalState(p).skip=false;save();
  const{sum,dep}=rentalSum(p);
  return[B(`Отметил прокат под ваш проект: ≈ <b>${byn(sum)}</b>, залог ${byn(dep)}. Проверьте инструмент и сутки в смете и оставьте номер телефона — пункт проката перезвонит и подтвердит бронь. Регистрация не нужна.`,{opts:[{l:'Перейти к брони',a:'go',arg:`smeta.html?project=${p.id}#doer`,pri:true},...guideOpts(p).map(o=>({...o,pri:false})),{l:'Не нужно, спасибо',a:'say',arg:'спасибо'}]})];
 }
 // Инструкция: шаги с объёмами и товарами из сметы; можно отказаться и продолжить
 function instrReply(ownTools,note){
  const p=lastP();
  if(p&&ownTools){setDoer(p,'self');rentalState(p).skip=true;save()}
  const h=`${note?note+' ':ownTools?'Отлично, тогда инструмент свой. ':''}Вот пошаговая инструкция${p?` по проекту «${esc(p.title)}»: в шагах ваши площади и товары из сметы — сколько клея, какой шпатель, когда затирать`:''}. Её можно распечатать.`;
  return[B(h,{opts:[...guideOpts(p),{l:'Не нужно, спасибо',a:'say',arg:'спасибо'},{l:'Всё-таки мастер',a:'say',arg:'Нужен мастер'}]})];
 }
 function guideOpts(p){const w=p&&projectWorks(p).length?projectWorks(p):Object.keys(WORKS);return w.map((k,i)=>({l:`${WORKS[k].name}`,a:'go',arg:`instrukcii.html?work=${k}${p?'&project='+p.id:''}`,pri:i===0}))}
 function masterReply(sid){
  const p=proj();
  // по проекту сразу берём его основную работу — не переспрашиваем
  if(!sid){const lp=lastP(),w=lp&&projectWorks(lp)[0];if(w)sid={tile:'svc_tile_floor',floor:'svc_lam',paint:'svc_paint'}[w]}
  if(!sid){return[B('Какую работу нужно сделать?',{opts:[{l:'Установить смеситель',a:'say'},{l:'Уложить плитку',a:'say',arg:'Нужен мастер уложить плитку'},{l:'Покрасить стены',a:'say',arg:'Мастер покрасить стены'},{l:'Замер помещения',a:'say',arg:'Нужен замерщик'}]})]}
  const sv=svc(sid),ms=MASTERS.filter(m=>m.cats.includes(sv.cat)),e=svcEstimate(sv,p);
  const vol=sv.area&&p&&e.q?` По вашему проекту это ${num(e.q,1)} ${sv.unit}, ориентировочно <b>${byn(e.sum)}</b>.`:'';
  return[B(`«${sv.name}» — от <b>${byn(sv.price)}</b> за ${sv.unit}.${vol} Доступно мастеров: ${ms.length}, ближайший выезд — ${fmtDay(now()+Math.min(...ms.map(m=>m.days))*DAY)}.<p class="note" style="margin-top:6px">Мастера, цены и даты в прототипе демонстрационные. Работы оплачиваются мастеру, ОМА не гарантирует их в демо.</p>`,
   {opts:[{l:'Выбрать мастера',a:'go',arg:`masters.html?service=${sid}${p?'&project='+p.id:''}`,pri:true},{l:'Оставить заявку',a:'go',arg:`masters.html?service=${sid}${p?'&project='+p.id:''}#new`},{l:'Сделаю сам',a:'say',arg:'Мастер не нужен, сделаю сам'}]})];
 }
 function cheaper(lp){
  const p=lp||proj();if(!p.calc?.ok)return[B('В проекте ошибка геометрии — сначала исправьте план, потом посчитаю.',{opts:[{l:'Открыть план',a:'go',arg:'planner.html?project='+p.id}]})];
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
  if(a==='gstep'){const g=G();if(g){g.done(+arg);push(stepMsg(g,`Отметил шаг ${+arg+1}. `))}return}
  if(a==='cart'){cartAdd(arg,1);toast('Добавлено в корзину');return}
  if(a==='bathx'){const[pid,rid]=arg.split(':'),p=getProject(pid),r=p&&p.rooms.find(x=>x.id===rid);if(!r)return;
   const xs=r.pts.map(q=>q[0]),ys=r.pts.map(q=>q[1]),x0=Math.min(...xs),y0=Math.min(...ys),w=Geom.r2(Math.min(1.7,Math.max(...xs)-x0)),hh=Geom.r2(Math.min(0.7,Math.max(...ys)-y0));
   r.excl.push({id:uid(),name:'Ванна',x:x0,y:y0,w,h:hh});recalc(p);touchEst(p,'Омик: вычтено место под ванной');save();
   push(B(`Вычел ванну ${num(w*100,0)} × ${num(hh*100,0)} см из пола и пересчитал:${packCard(p)}`,{opts:resultOpts(p)}));updateBadges();return}
  if(a==='tocart'){const p=getProject(arg);if(p){push(cartMsg(p));updateBadges()}return}
  if(a==='est'){const p=ensureProject('bath');const r=addLine(p,arg,1,'omik');save();toast(r.dup?'Уже есть в смете':`<i class="ui ui-list"></i>В смете «${esc(p.title)}»`);return}
  if(a==='pin'){const[pid,role,alt]=arg.split(':'),p=getProject(pid);p.pinned[role]=alt;recalc(p);touchEst(p,`Омик: замена «${ROLES[role]}» на более дешёвую`);save();push(B(`Заменил. Новая сумма материалов: <b>${byn(estTotal(p))}</b>.`,{opts:[{l:'Открыть смету',a:'go',arg:'smeta.html?project='+p.id}]}));if(ctx().page==='smeta'&&window.renderSmeta)renderSmeta();return}
  if(a==='tier'){const[pid,t]=arg.split(':'),p=getProject(pid);p.tier=t;recalc(p);touchEst(p,'Комплектация: '+TIERS[t]);save();push(B(`Перешли на «${TIERS[t]}»: ${byn(estTotal(p))}.`,{opts:[{l:'Открыть смету',a:'go',arg:'smeta.html?project='+p.id}]}));if(window.renderSmeta)renderSmeta();return}
  if(a==='mod'){const[pid]=arg.split(':'),p=getProject(pid);p.rooms.forEach(r=>r.walls.forEach(w=>w.finish='paint'));recalc(p);p.tier=['prem','opt','eco'].find(k=>{const x=tierTotal(p,k);return p.budget&&x!=null&&x<=p.budget})||'eco';recalc(p);touchEst(p,'Омик: стены под покраску вместо плитки');save();
   const tot=estTotal(p),fit=!p.budget||tot<=p.budget;push(B(`Пересчитал: пол — плитка, стены — покраска, комплектация «${TIERS[p.tier]}».${packCard(p)}${p.budget?`<div class="bud ${fit?'ok':'over'}">${fit?`✓ Помещаетесь в бюджет ${byn(p.budget)}`:`Всё ещё выше бюджета на ${byn(tot-p.budget)}`}</div>`:''}`,{opts:resultOpts(p,{over:!fit})}));return}
 }

 // ---------- Отрисовка ----------
 function msgHTML(m,i){
  if(m.who==='u')return`<div class="m u"><div class="b">${esc(m.text)}</div></div>`;
  const pcs=(m.pcs||[]).map(P).filter(Boolean).map(x=>`<div class="mp">${pimg(x)}<div><a href="product.html?id=${x.id}" style="font-weight:600">${esc(x.name)}</a><b>${byn(x.price)}</b><div class="act"><button data-a="est" data-arg="${x.id}">В смету</button><button data-a="cart" data-arg="${x.id}">В корзину</button></div></div></div>`).join('');
  const opts=(m.opts||[]).map(o=>`<button class="${o.pri?'pri':''}" data-a="${o.a}" data-arg="${esc(o.arg||'')}" ${m.used&&o.a==='say'?'disabled':''}>${esc(o.l)}</button>`).join('');
  return`<div class="m" data-i="${i}"><img src="img/omik-avatar.png" alt=""><div class="b">${m.html}${pcs?`<div class="pcs">${pcs}</div>`:''}${opts?`<div class="opts">${opts}</div>`:''}</div></div>`;
 }
 // Длинный ответ показываем с начала, короткий — просто прокручиваем вниз
 function render(){if(!host)return;const box=host.querySelector('.msgs');box.innerHTML=loadSt().msgs.map(msgHTML).join('');box.scrollTop=1e9;
  const L=box.lastElementChild;if(L&&!L.classList.contains('u')&&L.offsetHeight>box.clientHeight*.75)box.scrollTop+=L.getBoundingClientRect().top-box.getBoundingClientRect().top-12}
 function push(m){loadSt().msgs.push(m);saveSt();render()}
 function send(text){
  text=String(text||'').trim();if(!text||busy)return;
  const s=loadSt();s.msgs.forEach(m=>{if(m.opts)m.used=true});push({who:'u',text});
  busy=true;const box=host.querySelector('.msgs');box.insertAdjacentHTML('beforeend','<div class="m typing"><img src="img/omik-avatar.png" alt=""><div class="b"><div class="dots"><i></i><i></i><i></i></div></div></div>');box.scrollTop=1e9;
  setTimeout(()=>{busy=false;let out;try{out=reply(text)}catch(e){console.error(e);out=[B('Что-то пошло не так в демо-сценарии. Попробуйте переформулировать.')]}out.forEach(m=>loadSt().msgs.push(m));saveSt();render();updateBadges()},550);
 }
 function suggestions(){
  const c=ctx();
  if(c.page==='smeta')return['Объясни расчёт','Как удешевить смету?','Что ещё понадобится?','Отправить смету мастеру'];
  if(c.page==='dom')return['Что пора по дому?','Когда менять герметик?','Плитка в ванной 2,2 на 1,7, бюджет 1500'];
  if(c.page==='instr')return['Шаг готов','Что дальше?','Сколько сохнет?','Сколько осталось?'];
  if(c.page==='planner')return['Какой запас брать?','Нужна ли гидроизоляция?','Объясни расчёт'];
  if(c.page==='product')return['Найди аналог дешевле','Сравни с аналогами','Нужен мастер для установки'];
  return['Плитка в ванной 2,2 на 1,7, бюджет 1500','Где посчитать ламинат?','Покрасить комнату 4 на 3','Клей для керамогранита'];
 }
 function mount(el){
  host=el;
  el.innerHTML=`<div class="chat"><div class="chd"><img src="img/omik-avatar.png" alt="Омик"><div><b>Омик · помощник по ремонту</b><small>Демо: ответы по сценариям, количество — из калькулятора</small></div>${el.dataset.close?'<button class="x" title="Закрыть" onclick="OmikWidget.close()">×</button>':''}</div>
   <div class="msgs"></div><div class="csug">${suggestions().map(s=>`<button>${esc(s)}</button>`).join('')}</div>
   <form class="cin"><input placeholder="Например: плитка в ванной 2,2 на 1,7, бюджет 1500" aria-label="Сообщение Омику"><button class="btn">→</button></form></div>`;
  el.querySelector('form').onsubmit=e=>{e.preventDefault();const i=e.target.querySelector('input');send(i.value);i.value=''};
  el.querySelectorAll('.csug button').forEach(b=>b.onclick=()=>send(b.textContent));
  el.querySelector('.msgs').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;act(b.dataset.a,b.dataset.arg,b.textContent)});
  const s=loadSt();
  const last=s.msgs[s.msgs.length-1];
  if(!s.msgs.length||ctx().page&&s.ctxPage!==ctx().page+(ctx().productId||'')+(ctx().work||'')){s.ctxPage=ctx().page+(ctx().productId||'')+(ctx().work||'');s.msgs.push(hello(!s.msgs.length));saveSt()}
  render();
  return{send};
 }
 // Страница сообщает Омику о своём событии — например, отмеченном шаге инструкции
 function note(){const g=G();if(g&&host)push(stepMsg(g,'Отлично! '))}
 return{mount,send,reply,parse,loadSt,note,reset:()=>{st={msgs:[],slots:{},last:[]};saveSt();render()}};
})();
// Плавающая кнопка и окно чата на всех страницах
// hideFab: на главной и в калькуляторе (и импорте) Омик уже встроен в страницу — плавающая кнопка там только перекрывает контент.
// Окно всё равно создаём: его могут открыть кнопки на странице
const OmikWidget={
 mount(hideFab){
  if($('#omikFab'))return;
  document.body.insertAdjacentHTML('beforeend',`<button class="fab" id="omikFab" onclick="OmikWidget.open()"${hideFab?' hidden':''}><img src="img/omik-avatar.png" alt=""><span>Спросить Омика</span></button><div class="drawer" id="omikDrawer" data-close="1"></div>`);
 },
 open(q){const d=$('#omikDrawer');if(!d.dataset.m){Omik.mount(d);d.dataset.m=1}d.classList.add('show');$('#omikFab').style.display='none';if(q)Omik.send(q);setTimeout(()=>d.querySelector('input')?.focus(),50)},
 close(){$('#omikDrawer').classList.remove('show');$('#omikFab').style.display=''}
};
