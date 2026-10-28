// ОМА Проект — демонстрационные данные: каталог, услуги, мастера.
// Товары, цены, рейтинги и даты условные. Нормы расхода — типовые значения из техкарт, расчёт по ним ориентировочный.
(function(root){
const CATS={
 tile:{name:'Плитка и керамогранит',icon:'🧱'},
 mix:{name:'Сухие смеси и гидроизоляция',icon:'🪣'},
 paint:{name:'Краски',icon:'🎨'},
 floor:{name:'Напольные покрытия',icon:'🪵'},
 plumb:{name:'Сантехника',icon:'🚿'},
 tools:{name:'Инструмент',icon:'🔧'},
 elec:{name:'Электрика и вентиляция',icon:'💡'}
};
// Роли — что товар делает в расчёте. Для каждой роли есть товар на каждую комплектацию.
const ROLES={
 tileWall:'Плитка на стены',tileFloor:'Плитка на пол',glue:'Плиточный клей',grout:'Затирка',primer:'Грунтовка',
 wp:'Гидроизоляция',wpTape:'Гидроизоляционная лента',clips:'Система выравнивания',
 paintWall:'Краска для стен',paintCeil:'Краска для потолка',laminate:'Ламинат',underlay:'Подложка',skirting:'Плинтус'
};
const P=[];
const add=(o)=>P.push(o);
// --- Плитка: size [ширина, высота] см, thick мм, pack — м² в упаковке; цена за упаковку
const tile=(id,name,roles,tier,size,thick,pack,m2,color,extra={})=>add({id,name,cat:'tile',roles,tier,price:+(m2*pack).toFixed(2),priceM2:m2,unit:'уп.',
 pack:{q:pack,u:'м²'},spec:{size,thick,joint:2,...extra.spec},color,pattern:extra.pattern||'grid',stm:!!extra.stm,
 props:[['Формат',size.join('×')+' см'],['Толщина',thick+' мм'],['В упаковке',pack+' м² ('+Math.round(pack/(size[0]*size[1]/1e4))+' шт.)'],...(extra.props||[])],
 rel:['glue_opt','grout_opt','clips','trowel8','cross2'],service:roles.includes('tileFloor')?'svc_tile_floor':'svc_tile_wall',desc:extra.desc||''});
tile('tw_eco','Плитка настенная 25×40, белая глянцевая',['tileWall'],'eco',[25,40],7,1.5,19.90,'#f6f6f3',{props:[['Поверхность','глянцевая'],['Помещение','сухие и влажные, стены']],desc:'Базовая белая плитка для стен. Подходит для ванной и кухни.'});
tile('tw_opt','Плитка настенная 30×60 «Мрамор», матовая',['tileWall'],'opt',[30,60],8,1.44,34.90,'#ebe7e1',{pattern:'marble',props:[['Поверхность','матовая, ректификат'],['Помещение','влажные, стены']],desc:'Матовая плитка под мрамор. Ректифицированный край — узкий шов 2 мм.'});
tile('tw_prem','Плитка настенная 30×90 «Оникс», ректификат',['tileWall'],'prem',[30,90],10,1.35,68.00,'#e4d8c8',{pattern:'marble',props:[['Поверхность','полуполированная'],['Помещение','влажные, стены']],desc:'Крупный формат 30×90: меньше швов, нужен клей для крупноформатной плитки.'});
tile('tw_metro','Плитка «Кабанчик» 10×20, белая',['tileWall'],null,[10,20],7,1,27.50,'#fbfbfb',{pattern:'brick',props:[['Поверхность','глянцевая, фаска'],['Помещение','кухонный фартук, ванная']],desc:'Классическая «метро»-плитка с фаской. Много швов — расход затирки выше.'});
tile('tw_green','Плитка настенная 20×20, зелёная глазурь',['tileWall'],null,[20,20],8,1,31.90,'#5f8f7a',{props:[['Поверхность','глазурованная'],['Помещение','стены']],desc:'Акцентная плитка ручной формовки.'});
tile('tf_eco','Керамогранит 30×30, серый',['tileFloor'],'eco',[30,30],8,1.35,22.90,'#b9bcc0',{props:[['Класс износостойкости','PEI III'],['Противоскольжение','R10']],desc:'Недорогой керамогранит для пола ванной и коридора.'});
tile('tf_opt','Керамогранит 60×60 «Бетон», светлый',['tileFloor','tileWall'],'opt',[60,60],9,1.44,39.90,'#cfcac2',{pattern:'concrete',props:[['Класс износостойкости','PEI IV'],['Противоскольжение','R10'],['Применение','пол и стены']],desc:'Универсальный формат 60×60 для пола и стен. Нужен эластичный клей C2.'});
tile('tf_prem','Керамогранит 60×120 «Травертин», ректификат',['tileFloor','tileWall'],'prem',[60,120],10,1.44,79.00,'#ddd0bb',{pattern:'marble',props:[['Класс износостойкости','PEI IV'],['Противоскольжение','R10'],['Применение','пол и стены']],desc:'Крупный формат: монолитный вид, клей S1 и СВП обязательны.'});
tile('tf_wood','Керамогранит 20×120 «Дуб»',['tileFloor'],null,[20,120],9,1.2,44.90,'#b08a62',{pattern:'wood',props:[['Класс износостойкости','PEI IV'],['Противоскольжение','R11']],desc:'Керамогранит под дерево — для ванной, кухни и коридора.'});
// --- Смеси. rate — расход, кг/м² на 1 мм слоя; bag — кг
const mix=(o)=>add({cat:'mix',unit:'меш.',rel:[],...o});
mix({id:'glue_eco',name:'Клей плиточный C1, 25 кг',roles:['glue'],tier:'eco',price:12.90,pack:{q:25,u:'кг'},spec:{rate:1.5,cls:'C1',maxTile:45},props:[['Класс','C1 (обычный)'],['Расход','1,5 кг/м² на 1 мм слоя'],['Формат плитки','до 45 см']],desc:'Для керамической плитки небольшого формата на стабильном основании.'});
mix({id:'glue_opt',name:'Клей плиточный C2TE эластичный, 25 кг',roles:['glue'],tier:'opt',price:24.50,pack:{q:25,u:'кг'},spec:{rate:1.3,cls:'C2TE',maxTile:90},props:[['Класс','C2TE (усиленный, без сползания)'],['Расход','1,3 кг/м² на 1 мм слоя'],['Формат плитки','до 90 см, керамогранит']],desc:'Эластичный клей для керамогранита и влажных помещений.',stm:false});
mix({id:'glue_prem',name:'Клей C2TE S1 для крупного формата, 25 кг',roles:['glue'],tier:'prem',price:38.90,pack:{q:25,u:'кг'},spec:{rate:1.2,cls:'C2TE S1',maxTile:200},props:[['Класс','C2TE S1 (деформируемый)'],['Расход','1,2 кг/м² на 1 мм слоя'],['Формат плитки','крупный формат, тёплый пол']],desc:'Для плит 60×120 и больше, тёплого пола и сложных оснований.'});
mix({id:'glue_stm',name:'Клей плиточный C2T, 25 кг — СТМ ОМА',roles:['glue'],tier:null,stm:true,price:18.90,pack:{q:25,u:'кг'},spec:{rate:1.35,cls:'C2T',maxTile:60},props:[['Класс','C2T (усиленный)'],['Расход','1,35 кг/м² на 1 мм слоя'],['Формат плитки','до 60 см']],desc:'Собственная марка ОМА: усиленный клей по цене обычного.'});
mix({id:'grout_eco',name:'Затирка цементная CG1, 2 кг',roles:['grout'],tier:'eco',unit:'уп.',price:8.90,pack:{q:2,u:'кг'},spec:{dens:1.6},props:[['Класс','CG1'],['Ширина шва','1–6 мм']],desc:'Обычная цементная затирка для сухих помещений.'});
mix({id:'grout_opt',name:'Затирка влагостойкая CG2WA, антигрибковая, 2 кг',roles:['grout'],tier:'opt',unit:'уп.',price:15.90,pack:{q:2,u:'кг'},spec:{dens:1.6},props:[['Класс','CG2WA (водоотталкивающая)'],['Ширина шва','1–6 мм'],['Добавки','антигрибковые']],desc:'Для ванной и кухни: меньше впитывает воду и грязь.'});
mix({id:'grout_prem',name:'Затирка эпоксидная RG, 2,5 кг',roles:['grout'],tier:'prem',unit:'уп.',price:74.00,pack:{q:2.5,u:'кг'},spec:{dens:1.55},props:[['Класс','RG (реактивная)'],['Ширина шва','1–10 мм'],['Свойства','не впитывает воду, не темнеет']],desc:'Эпоксидная затирка: швы не темнеют и не требуют обработки.'});
mix({id:'primer_eco',name:'Грунтовка глубокого проникновения, 5 л',roles:['primer'],tier:'eco',unit:'кан.',price:11.50,pack:{q:5,u:'л'},spec:{rate:0.15},props:[['Расход','0,15 л/м²'],['Объём','5 л']],desc:'Укрепляет основание перед плиткой и покраской.'});
mix({id:'primer_opt',name:'Грунтовка-концентрат 1:4, 10 л',roles:['primer'],tier:'opt',unit:'кан.',price:26.00,pack:{q:10,u:'л'},spec:{rate:0.12},props:[['Расход','0,12 л/м² (готовый раствор)'],['Объём','10 л']],desc:'Концентрат: разводится водой, хватает на большую площадь.'});
mix({id:'primer_prem',name:'Грунтовка антигрибковая, 10 л',roles:['primer'],tier:'prem',unit:'кан.',price:34.00,pack:{q:10,u:'л'},spec:{rate:0.12},props:[['Расход','0,12 л/м²'],['Добавки','антисептик']],desc:'С антисептиком — для влажных помещений.'});
mix({id:'primer_stm',name:'Грунтовка универсальная, 10 л — СТМ ОМА',roles:['primer'],tier:null,stm:true,unit:'кан.',price:15.90,pack:{q:10,u:'л'},spec:{rate:0.15},props:[['Расход','0,15 л/м²'],['Объём','10 л']],desc:'Собственная марка ОМА.'});
mix({id:'wp_eco',name:'Гидроизоляция обмазочная, 4 кг',roles:['wp'],tier:'eco',unit:'ведро',price:29.90,pack:{q:4,u:'кг'},spec:{rate:1.5},props:[['Расход','1,5 кг/м² (2 слоя)'],['Тип','однокомпонентная']],desc:'Защищает пол и низ стен от протечек.'});
mix({id:'wp_opt',name:'Гидроизоляция эластичная двухкомпонентная, 5 кг',roles:['wp'],tier:'opt',unit:'компл.',price:54.00,pack:{q:5,u:'кг'},spec:{rate:1.4},props:[['Расход','1,4 кг/м² (2 слоя)'],['Тип','двухкомпонентная, перекрывает трещины']],desc:'Эластичная: не трескается при подвижках основания.'});
mix({id:'wp_prem',name:'Мастика гидроизоляционная полиуретановая, 6 кг',roles:['wp'],tier:'prem',unit:'ведро',price:89.00,pack:{q:6,u:'кг'},spec:{rate:1.2},props:[['Расход','1,2 кг/м² (2 слоя)'],['Тип','полиуретановая']],desc:'Максимальная эластичность, для душевых зон.'});
mix({id:'wp_tape',name:'Лента гидроизоляционная, 10 м',roles:['wpTape'],tier:'all',unit:'рул.',price:18.90,pack:{q:10,u:'м'},spec:{},props:[['Длина','10 м'],['Ширина','120 мм']],desc:'Проклеивается в углы и стыки под гидроизоляцию.'});
mix({id:'seal',name:'Герметик санитарный силиконовый, белый',roles:[],tier:null,unit:'шт.',price:9.90,pack:{q:280,u:'мл'},spec:{},props:[['Объём','280 мл']],desc:'Для швов между ванной, поддоном и плиткой.'});
// --- Краски. cover — м²/л на один слой
const paint=(o)=>add({cat:'paint',unit:'ведро',rel:['roller','tape_m','primer_opt'],service:o.roles[0]==='paintCeil'?'svc_ceil':'svc_paint',...o});
paint({id:'pw_eco',name:'Краска интерьерная матовая, 10 л',roles:['paintWall'],tier:'eco',price:39.90,pack:{q:10,u:'л'},spec:{cover:8,layers:2},color:'#f2efe8',props:[['Расход','8 м²/л на слой'],['Класс стойкости к мытью','4 (сухая чистка)'],['Помещение','сухие']],desc:'Для спальни и гостиной, где стены не моют.'});
paint({id:'pw_opt',name:'Краска моющаяся для стен, класс 2, 9 л',roles:['paintWall'],tier:'opt',price:79.00,pack:{q:9,u:'л'},spec:{cover:10,layers:2},color:'#e7ecf2',props:[['Расход','10 м²/л на слой'],['Класс стойкости к мытью','2 (можно мыть)'],['Помещение','кухня, коридор, детская']],desc:'Выдерживает влажную уборку — подходит для кухни и коридора.'});
paint({id:'pw_prem',name:'Краска износостойкая глубокоматовая, класс 1, 9 л',roles:['paintWall'],tier:'prem',price:139.00,pack:{q:9,u:'л'},spec:{cover:11,layers:2},color:'#dfe6e0',props:[['Расход','11 м²/л на слой'],['Класс стойкости к мытью','1 (максимальный)'],['Помещение','любые, включая влажные']],desc:'Глубокоматовая и при этом моющаяся. Скрывает мелкие неровности.'});
paint({id:'pw_stm',name:'Краска интерьерная моющаяся, класс 3, 9 л — СТМ ОМА',roles:['paintWall'],tier:null,stm:true,price:52.00,pack:{q:9,u:'л'},spec:{cover:9,layers:2},color:'#efeae2',props:[['Расход','9 м²/л на слой'],['Класс стойкости к мытью','3'],['Помещение','сухие, коридор']],desc:'Собственная марка ОМА: моющаяся краска дешевле брендовых.'});
paint({id:'pc_eco',name:'Краска для потолков белая, 5 л',roles:['paintCeil'],tier:'eco',price:21.90,pack:{q:5,u:'л'},spec:{cover:7,layers:2},color:'#ffffff',props:[['Расход','7 м²/л на слой'],['Белизна','95%']],desc:'Матовая краска для потолков сухих помещений.'});
paint({id:'pc_opt',name:'Краска для потолков супербелая, 9 л',roles:['paintCeil'],tier:'opt',price:49.00,pack:{q:9,u:'л'},spec:{cover:9,layers:2},color:'#ffffff',props:[['Расход','9 м²/л на слой'],['Белизна','98%']],desc:'Ровный белый цвет, хорошая укрывистость.'});
paint({id:'pc_prem',name:'Краска для потолков антиблик, влагостойкая, 9 л',roles:['paintCeil'],tier:'prem',price:82.00,pack:{q:9,u:'л'},spec:{cover:10,layers:2},color:'#ffffff',props:[['Расход','10 м²/л на слой'],['Свойства','влагостойкая, без бликов']],desc:'Подходит для ванной и кухни.'});
// --- Пол
const floor=(o)=>add({cat:'floor',rel:['underlay_opt','skirt_opt'],service:'svc_lam',...o});
floor({id:'lam_eco',name:'Ламинат 32 класс, 8 мм, «Дуб натуральный»',roles:['laminate'],tier:'eco',unit:'уп.',priceM2:19.90,price:+(19.90*2.4).toFixed(2),pack:{q:2.4,u:'м²'},spec:{},color:'#c9a77c',pattern:'wood',props:[['Класс','32'],['Толщина','8 мм'],['Влагостойкость','нет'],['В упаковке','2,4 м²']],desc:'Для спальни и гостиной.'});
floor({id:'lam_opt',name:'Ламинат 33 класс, 10 мм, влагостойкий, «Дуб серый»',roles:['laminate'],tier:'opt',unit:'уп.',priceM2:34.90,price:+(34.90*1.9).toFixed(2),pack:{q:1.9,u:'м²'},spec:{},color:'#a9a297',pattern:'wood',props:[['Класс','33'],['Толщина','10 мм'],['Влагостойкость','да, пропитка замка'],['В упаковке','1,9 м²']],desc:'Влагостойкий — можно в кухню и коридор.'});
floor({id:'lam_prem',name:'Ламинат 34 класс, 12 мм, аквастоп, «Орех»',roles:['laminate'],tier:'prem',unit:'уп.',priceM2:54.90,price:+(54.90*1.6).toFixed(2),pack:{q:1.6,u:'м²'},spec:{},color:'#7d5a3c',pattern:'wood',props:[['Класс','34'],['Толщина','12 мм'],['Влагостойкость','аквастоп 72 ч'],['В упаковке','1,6 м²']],desc:'Для высоких нагрузок, выдерживает воду до 72 часов.'});
floor({id:'underlay_eco',name:'Подложка XPS 3 мм, 5 м²',roles:['underlay'],tier:'eco',unit:'уп.',price:9.90,pack:{q:5,u:'м²'},spec:{},props:[['Толщина','3 мм'],['Материал','экструдированный пенополистирол']],desc:'Базовая подложка под ламинат.',rel:[]});
floor({id:'underlay_opt',name:'Подложка хвойная 4 мм, 5,1 м²',roles:['underlay'],tier:'opt',unit:'уп.',price:24.90,pack:{q:5.1,u:'м²'},spec:{},props:[['Толщина','4 мм'],['Материал','хвойное волокно']],desc:'Лучше выравнивает и глушит шаги.',rel:[]});
floor({id:'underlay_prem',name:'Подложка пробковая 2 мм, 10 м²',roles:['underlay'],tier:'prem',unit:'рул.',price:49.00,pack:{q:10,u:'м²'},spec:{},props:[['Толщина','2 мм'],['Материал','пробка']],desc:'Натуральная, долговечная.',rel:[]});
floor({id:'skirt_eco',name:'Плинтус ПВХ с кабель-каналом, 2,5 м',roles:['skirting'],tier:'eco',unit:'шт.',price:4.90,pack:{q:2.5,u:'м'},spec:{},props:[['Длина','2,5 м'],['Материал','ПВХ']],desc:'',rel:[]});
floor({id:'skirt_opt',name:'Плинтус МДФ под покраску, 2,4 м',roles:['skirting'],tier:'opt',unit:'шт.',price:9.90,pack:{q:2.4,u:'м'},spec:{},props:[['Длина','2,4 м'],['Материал','МДФ']],desc:'',rel:[]});
floor({id:'skirt_prem',name:'Плинтус шпонированный, 2,4 м',roles:['skirting'],tier:'prem',unit:'шт.',price:21.00,pack:{q:2.4,u:'м'},spec:{},props:[['Длина','2,4 м'],['Материал','МДФ, шпон дуба']],desc:'',rel:[]});
// --- Сантехника, электрика (не рассчитываются по площади — добавляются в смету)
const item=(o)=>add({unit:'шт.',roles:[],tier:null,pack:null,spec:{},rel:['seal'],...o});
item({id:'mix_bath',cat:'plumb',name:'Смеситель для ванны с душевым гарнитуром',price:129.00,service:'svc_mixer',icon:'🚿',props:[['Тип','однорычажный'],['Материал','латунь, хром'],['Гарантия','5 лет (демо)']],desc:'Настенный смеситель с переключателем на душ.'});
item({id:'mix_bath_p',cat:'plumb',name:'Смеситель термостатический для ванны',price:289.00,service:'svc_mixer',icon:'🚿',props:[['Тип','термостат'],['Материал','латунь, хром'],['Гарантия','5 лет (демо)']],desc:'Держит заданную температуру воды.'});
item({id:'mix_sink',cat:'plumb',name:'Смеситель для раковины',price:89.00,service:'svc_mixer',icon:'🚰',props:[['Тип','однорычажный'],['Материал','латунь']],desc:''});
item({id:'mix_sink_e',cat:'plumb',name:'Смеситель для раковины, эконом',price:49.00,service:'svc_mixer',icon:'🚰',props:[['Тип','однорычажный'],['Материал','силумин']],desc:''});
item({id:'wc',cat:'plumb',name:'Унитаз-компакт, сиденье микролифт',price:289.00,service:'svc_wc',icon:'🚽',props:[['Выпуск','косой'],['Сиденье','микролифт']],desc:''});
item({id:'sink',cat:'plumb',name:'Тумба с раковиной 60 см',price:349.00,service:'svc_sink',icon:'🪞',props:[['Ширина','60 см'],['Материал','влагостойкий ЛДСП']],desc:''});
item({id:'bath',cat:'plumb',name:'Ванна акриловая 170×70 с каркасом',price:459.00,service:'svc_bath',icon:'🛁',props:[['Размер','170×70 см'],['Материал','акрил']],desc:''});
item({id:'rail',cat:'plumb',name:'Полотенцесушитель водяной 50×80',price:159.00,service:'svc_rail',icon:'♨️',props:[['Размер','50×80 см'],['Подключение','боковое']],desc:''});
item({id:'drain',cat:'plumb',name:'Трап для душа 30 см',price:69.00,service:'svc_mixer',icon:'🕳️',props:[['Длина','30 см']],desc:''});
item({id:'fan',cat:'elec',name:'Вентилятор вытяжной 100 мм, с обратным клапаном',price:45.00,service:'svc_fan',icon:'🌀',props:[['Диаметр','100 мм'],['Обратный клапан','да']],desc:''});
item({id:'led',cat:'elec',name:'Светильник влагозащищённый IP44',price:38.00,icon:'💡',props:[['Защита','IP44']],desc:''});
// --- Инструмент (Werker — СТМ ОМА)
const tool=(o)=>add({cat:'tools',unit:'шт.',roles:[],tier:null,pack:null,spec:{},rel:[],...o});
tool({id:'clips',name:'Система выравнивания плитки 2 мм, 200 шт — Werker',roles:['clips'],tier:'all',stm:true,unit:'уп.',price:14.50,pack:{q:200,u:'шт.'},icon:'📏',props:[['Шов','2 мм'],['Количество','200 клипс']],desc:'Клипсы и клинья: плитка ложится без перепадов.'});
tool({id:'trowel8',name:'Шпатель зубчатый 8 мм — Werker',stm:true,price:7.90,icon:'🧰',props:[['Зуб','8×8 мм']],desc:'Для плитки 30–60 см.'});
tool({id:'cross2',name:'Крестики для плитки 2 мм, 200 шт',price:3.50,icon:'✚',props:[['Шов','2 мм']],desc:''});
tool({id:'cutter',name:'Плиткорез ручной 600 мм — Werker',stm:true,price:89.00,icon:'🔪',props:[['Длина реза','600 мм']],desc:''});
tool({id:'level',name:'Уровень строительный 60 см — Werker',stm:true,price:19.90,icon:'📐',props:[['Длина','60 см']],desc:''});
tool({id:'roller',name:'Валик малярный 25 см с ручкой — Werker',stm:true,price:12.90,icon:'🖌️',props:[['Ширина','25 см']],desc:''});
tool({id:'tape_m',name:'Лента малярная 50 мм × 50 м',price:4.50,icon:'🎞️',props:[['Ширина','50 мм']],desc:''});
tool({id:'mixer_d',name:'Миксер строительный 1200 Вт — Werker',stm:true,price:179.00,icon:'🌀',props:[['Мощность','1200 Вт']],desc:'Для замеса клея и затирки.'});

// Что предложить вместе с работой
const KITS={tile:['trowel8','cross2','clips','level','cutter'],paint:['roller','tape_m'],floor:['level'],wet:['seal','fan']};

// Услуги: цены ориентировочные, демо. area — откуда брать объём из расчёта проекта
const SERVICES=[
 {id:'svc_tile_wall',cat:'tile',name:'Укладка плитки на стены',price:38,unit:'м²',area:'tileWall'},
 {id:'svc_tile_floor',cat:'tile',name:'Укладка плитки на пол',price:35,unit:'м²',area:'tileFloor'},
 {id:'svc_wp',cat:'tile',name:'Гидроизоляция пола',price:8,unit:'м²',area:'wp'},
 {id:'svc_paint',cat:'paint',name:'Покраска стен в 2 слоя',price:7,unit:'м²',area:'paintWall'},
 {id:'svc_ceil',cat:'paint',name:'Покраска потолка',price:8,unit:'м²',area:'paintCeil'},
 {id:'svc_lam',cat:'floor',name:'Укладка ламината',price:9,unit:'м²',area:'laminate'},
 {id:'svc_skirt',cat:'floor',name:'Монтаж плинтуса',price:4,unit:'м',area:'skirt'},
 {id:'svc_mixer',cat:'plumb',name:'Установка смесителя',price:45,unit:'шт.'},
 {id:'svc_wc',cat:'plumb',name:'Установка унитаза',price:90,unit:'шт.'},
 {id:'svc_sink',cat:'plumb',name:'Установка тумбы с раковиной',price:80,unit:'шт.'},
 {id:'svc_bath',cat:'plumb',name:'Установка ванны',price:120,unit:'шт.'},
 {id:'svc_rail',cat:'plumb',name:'Установка полотенцесушителя',price:70,unit:'шт.'},
 {id:'svc_fan',cat:'elec',name:'Установка вытяжного вентилятора',price:35,unit:'шт.'},
 {id:'svc_measure',cat:'measure',name:'Замер помещения',price:30,unit:'выезд'}
];
const SVC_CATS={tile:'Плитка',paint:'Покраска',floor:'Полы',plumb:'Сантехника',elec:'Электрика',measure:'Замер'};
const MASTERS=[
 {id:'m1',photo:'https://randomuser.me/api/portraits/men/32.jpg',name:'Иван П.',color:'#0057d6',cats:['tile','plumb'],rating:4.9,jobs:214,district:'Центральный',days:1,from:35,about:'Плитка и сантехника, 12 лет опыта. Работаю с крупным форматом.'},
 {id:'m2',photo:'https://randomuser.me/api/portraits/men/45.jpg',name:'Сергей К.',color:'#ff9a1a',cats:['tile','floor'],rating:4.8,jobs:168,district:'Московский',days:2,from:33,about:'Плитка, ламинат, выравнивание полов.'},
 {id:'m3',photo:'https://randomuser.me/api/portraits/men/52.jpg',name:'Андрей М.',color:'#0b3a9e',cats:['plumb','elec'],rating:4.7,jobs:95,district:'Фрунзенский',days:1,from:45,about:'Сантехника и электрика: смесители, унитазы, вентиляция.'},
 {id:'m4',photo:'https://randomuser.me/api/portraits/women/44.jpg',name:'Ольга Р.',color:'#18a058',cats:['paint'],rating:4.9,jobs:131,district:'Первомайский',days:3,from:7,about:'Покраска стен и потолков, подготовка поверхностей.'},
 {id:'m5',photo:'https://randomuser.me/api/portraits/men/67.jpg',name:'Дмитрий Л.',color:'#7a4cc2',cats:['floor','paint'],rating:4.6,jobs:77,district:'Заводской',days:2,from:9,about:'Ламинат, плинтус, покраска.'},
 {id:'m6',photo:'https://randomuser.me/api/portraits/men/75.jpg',name:'Павел С.',color:'#c4321b',cats:['tile','plumb','elec'],rating:4.8,jobs:203,district:'Партизанский',days:4,from:36,about:'Ремонт санузлов «под ключ».'},
 {id:'m7',photo:'https://randomuser.me/api/portraits/men/22.jpg',name:'Виктор Н.',color:'#2a7f8f',cats:['measure','tile'],rating:4.7,jobs:58,district:'Советский',days:1,from:30,about:'Замеры, консультации, укладка плитки.'},
 {id:'m8',photo:'https://randomuser.me/api/portraits/men/86.jpg',name:'Алексей Т.',color:'#8a6a1f',cats:['plumb'],rating:4.5,jobs:42,district:'Ленинский',days:1,from:40,about:'Быстрая установка сантехники.'}
];
// Реальные товары с oma.by (oma-catalog.js): заменяют демо-позиции по id, дополнительные — наследуют поля от образца (like)
const REAL=typeof module!=='undefined'?(()=>{try{return require('./oma-catalog.js')}catch(e){return null}})():root.OMA_REAL;
if(REAL){
 P.forEach(p=>{const r=REAL.byId[p.id];if(r)Object.assign(p,r,{spec:{...p.spec,...(r.spec||{})}})});
 REAL.extra.forEach(x=>{const b=P.find(p=>p.id===x.like)||{};const{like,...o}=x;P.push({...b,...o,spec:{...(b.spec||{}),...(o.spec||{})}})});
}
// Прокат инструмента в гипермаркете ОМА: цена за сутки и залог — демо. works — для каких работ проекта предлагать;
// opt — по желанию: в списке есть, но галочка по умолчанию снята
const RENTAL=[
 {id:'r_cutter',name:'Плиткорез ручной 600 мм',icon:'📐',day:12,deposit:100,works:['tile'],why:'ровный прямой рез плитки до 60 см',replaces:['cutter']},
 {id:'r_mixer',name:'Строительный миксер',icon:'🌀',day:15,deposit:150,works:['tile'],why:'замес клея и затирки без комков'},
 {id:'r_grinder',name:'Болгарка с алмазным диском',icon:'⚙️',day:12,deposit:120,works:['tile'],why:'вырезы под трубы и розетки',opt:true},
 {id:'r_laser',name:'Лазерный уровень',icon:'🔴',day:14,deposit:200,works:['tile','floor'],why:'разметка рядов и проверка ровности пола'},
 {id:'r_jigsaw',name:'Электролобзик',icon:'🪚',day:10,deposit:120,works:['floor'],why:'подрезка доски по длине и вырезы под трубы'},
 {id:'r_sander',name:'Шлифмашина для стен',icon:'🧽',day:18,deposit:200,works:['paint'],why:'шлифовка шпаклёвки перед покраской'},
 {id:'r_sprayer',name:'Краскопульт',icon:'💨',day:20,deposit:250,works:['paint'],why:'быстрая покраска больших площадей',opt:true}
];
const WORKS={tile:{name:'Укладка плитки',icon:'🧱'},floor:{name:'Укладка ламината',icon:'🪵'},paint:{name:'Покраска стен и потолка',icon:'🎨'}};
const DATA={CATS,ROLES,PRODUCTS:P,KITS,SERVICES,SVC_CATS,MASTERS,RENTAL,WORKS};
if(typeof module!=='undefined')module.exports=DATA;else Object.assign(root,DATA);
})(this);
