/* ===================================================================
   KINGDOM OF SAINT-DIÉ — motor del mapa (map-engine.js)
   Mundo horneado a un canvas + mosaico toroidal (scroll infinito sin
   costura). La prosperidad decide cuánto del mapa está vivo; al bajar,
   el pueblo se apaga (no desaparece). Sin animaciones. Arte: Tiny Swords.
   Expone window.KingdomMap = { init, setProsperity, toggleNight, setActive }
   =================================================================== */
window.KingdomMap = (function(){
"use strict";
const TS = 'assets/Tiny Swords/Tiny Swords (Update 010)/';
const A = {
  flat:   'Terrain/Ground/Tilemap_Flat.png',
  water:  'Terrain/Water/Water.png',
  bridge: 'Terrain/Bridge/Bridge_All.png',
  tree:   'Resources/Trees/Tree.png',
  sheep:  'Resources/Sheep/HappySheep_Idle.png',
  pawn:   'Factions/Knights/Troops/Pawn/Yellow/Pawn_Yellow.png',
  warrior:'Factions/Knights/Troops/Warrior/Yellow/Warrior_Yellow.png',
  castle: 'Factions/Knights/Buildings/Castle/Castle_Yellow.png',
  castleC:'Factions/Knights/Buildings/Castle/Castle_Construction.png',
  house:  'Factions/Knights/Buildings/House/House_Yellow.png',
  houseC: 'Factions/Knights/Buildings/House/House_Construction.png',
  tower:  'Factions/Knights/Buildings/Tower/Tower_Yellow.png',
  towerC: 'Factions/Knights/Buildings/Tower/Tower_Construction.png',
  barn:   'Factions/Goblins/Buildings/Wood_House/Goblin_House.png',
  mine:   'Resources/Gold Mine/GoldMine_Active.png',
  mineOff:'Resources/Gold Mine/GoldMine_Inactive.png',
  wpile:  'Resources/Resources/W_Idle_(NoShadow).png',
  gpile:  'Resources/Resources/G_Idle_(NoShadow).png',
  mpile:  'Resources/Resources/M_Idle_(NoShadow).png',
  fire:   'Effects/Fire/Fire.png',
  rock1:  'Terrain/Water/Rocks/Rocks_01.png',
  rock3:  'Terrain/Water/Rocks/Rocks_03.png',
};
for(let i=1;i<=18;i++) A['d'+i] = 'Deco/'+String(i).padStart(2,'0')+'.png';

const img = {};
function loadAll(done){
  const keys = Object.keys(A); let left = keys.length;
  keys.forEach(k=>{
    const im = new Image();
    im.onload = im.onerror = ()=>{ if(--left===0) done(); };
    im.src = encodeURI(TS + A[k]);
    img[k] = im;
  });
}

/* ---- recorte de sprites ---- */
function trimmed(source, sx, sy, sw, sh){
  const tmp = document.createElement('canvas'); tmp.width=sw; tmp.height=sh;
  const g = tmp.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(source, sx,sy,sw,sh, 0,0,sw,sh);
  const d = g.getImageData(0,0,sw,sh).data;
  let x0=sw,y0=sh,x1=0,y1=0;
  for(let y=0;y<sh;y++) for(let x=0;x<sw;x++)
    if(d[(y*sw+x)*4+3] > 8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  if(x1<x0) return tmp;
  const w=x1-x0+1, h=y1-y0+1;
  const out = document.createElement('canvas'); out.width=w; out.height=h;
  out.getContext('2d').drawImage(tmp, x0,y0,w,h, 0,0,w,h);
  return out;
}
const whole = k => trimmed(img[k], 0,0, img[k].width, img[k].height);
const frame = (k,fw,fh,i,cols) => trimmed(img[k], (i%cols)*fw, ((i/cols)|0)*fh, fw, fh);
function tileOf(k, tx, ty, ts){
  const c=document.createElement('canvas'); c.width=ts; c.height=ts;
  c.getContext('2d').drawImage(img[k], tx*ts, ty*ts, ts,ts, 0,0, ts,ts);
  return c;
}
function mirror(cnv){
  const c=document.createElement('canvas'); c.width=cnv.width; c.height=cnv.height;
  const g=c.getContext('2d'); g.translate(cnv.width,0); g.scale(-1,1); g.drawImage(cnv,0,0);
  return c;
}

const SPR = {};
function buildSprites(){
  SPR.castle  = whole('castle');   SPR.castleC = whole('castleC');
  SPR.house   = whole('house');    SPR.houseC  = whole('houseC');
  SPR.houseM  = mirror(SPR.house);
  SPR.tower   = whole('tower');    SPR.towerC  = whole('towerC');
  SPR.barn    = whole('barn');
  SPR.mine    = whole('mine');     SPR.mineOff = whole('mineOff');
  SPR.tree    = frame('tree', 192,192, 0, 4);
  SPR.tree2   = frame('tree', 192,192, 5, 4);
  SPR.sheep   = frame('sheep',128,128, 0, 8);
  SPR.pawn    = [0,6,7,12].map(i=>frame('pawn',192,192,i,6));
  SPR.warrior = frame('warrior',192,192,0,6);
  SPR.wpile   = whole('wpile'); SPR.gpile = whole('gpile'); SPR.mpile = whole('mpile');
  SPR.fire    = frame('fire', 128,128, 0, 7);
  SPR.rock1   = frame('rock1',128,128, 0, 8);
  SPR.rock3   = frame('rock3',128,128, 0, 8);
  for(let i=1;i<=18;i++) SPR['d'+i] = whole('d'+i);
}

/* ===================================================================
   GENERACIÓN DEL MUNDO — determinista (misma semilla = mismo reino)
   =================================================================== */
const WORLD = 2560;              // múltiplo de 64 → el suelo casa al envolver el mundo
const CX = WORLD/2, CY = WORLD/2;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

let placed=[], fields=[], forest=[], deco=[], vignettes=[], paths=[], lamps=[],
    mottle=[], waterRocks=[], torches=[], water=null, rise=null;

function generate(){
  const rnd = mulberry32(20260911);
  const rr = (a,b)=> a + rnd()*(b-a);
  placed=[]; fields=[]; forest=[]; deco=[]; vignettes=[]; paths=[]; lamps=[];
  mottle=[]; waterRocks=[]; torches=[];

  // manchas grandes y suaves de tono para que la hierba no sea fieltro plano
  for(let i=0;i<46;i++){
    mottle.push({ x:rnd()*WORLD, y:rnd()*WORLD, r:rr(180,460), light: rnd()<.5 });
  }

  // el pueblo se asienta en una loma, un pelín al NO del castillo
  const VX = CX - 70, VY = CY - 60;
  rise = { x:VX, y:VY, r:540 };

  placed.push({ t:'castle', x:CX, y:CY, at:0 });
  lamps.push({ x:CX, y:CY-70, at:0 });

  // casas en sub-racimos separados alrededor del castillo (no un anillo)
  const clusters = [ [VX-300,VY-190], [VX+320,VY-90], [VX-90,VY+300], [VX+300,VY+250] ];
  let hi = 0;
  clusters.forEach((c,ci)=>{
    const n = 2 + ((rnd()*3)|0);
    for(let j=0;j<n;j++){
      const x = c[0] + rr(-110,110), y = c[1] + rr(-80,100);
      const sc = rr(.68,.92);
      placed.push({ t:'house', x, y, sc, m: rnd()<.5, at: 4 + hi*5 });
      lamps.push({ x, y:y - 38*sc, at: 4 + hi*5 + 20 });
      hi++;
    }
  });
  placed.push({ t:'tower', x:VX-380, y:VY+40,  at:40 });
  placed.push({ t:'tower', x:VX+390, y:VY+60,  at:58 });
  placed.push({ t:'barn',  x:VX+70,  y:VY-360, at:24 });

  // mercadillo junto al castillo (aparece con prosperidad alta)
  placed.push({ t:'market', x:CX+170, y:CY+110, at:76 });
  placed.push({ t:'market', x:CX-160, y:CY+140, at:104 });
  placed.push({ t:'market', x:CX+30,  y:CY+210, at:132 });

  // río: onda periódica sobre WORLD (casa al envolver el mundo)
  water = { amp:95, base:CY+780, k:2*Math.PI*2/WORLD, half:135 };

  // caminos: cada uno arranca de un punto distinto del borde del pueblo y
  // lleva un quiebre cercano, para que salgan curvando y no como rayos rectos
  paths.push([[VX+90,VY+150],[CX+40,CY+330],[CX-40,CY+470],[CX+120,CY+640],[CX+50,CY+930],[CX+100,CY+1220]]); // sur, cruza el río
  paths.push([[VX+210,VY+30],[CX+330,CY+70],[CX+470,CY-70],[CX+700,CY-210],[CX+980,CY-140]]);                 // este, a la mina
  paths.push([[VX-200,VY+70],[CX-360,CY+10],[CX-470,CY-170],[CX-760,CY-330],[CX-1080,CY-300]]);               // oeste, al bosque
  paths.push([[VX-40,VY-190],[CX-140,CY-330],[CX-70,CY-520],[CX+130,CY-760],[CX+40,CY-1040]]);                // norte

  // puente donde el camino sur cruza el río
  const bx = CX+70, by = water.base + Math.sin(water.k*bx)*water.amp;
  placed.push({ t:'bridge', x:bx, y:by, at:50 });

  // mina de oro + rocas + sacos
  placed.push({ t:'mine', x:CX+960, y:CY-150, at:70 });
  for(let i=0;i<9;i++) deco.push({ s:'d'+(4+((rnd()*3)|0)), x:CX+960+rr(-210,210), y:CY-150+rr(-140,170), at:66, sc:rr(.7,1.25) });
  deco.push({ s:'gpile', x:CX+1010, y:CY-80, at:80, sc:.9 });

  // rocas en el río + juncos en las orillas
  for(let i=0;i<6;i++){
    const wx = rr(200, WORLD-200);
    const wy = water.base + Math.sin(water.k*wx)*water.amp + rr(-70,70);
    waterRocks.push({ x:wx, y:wy, r: rnd()<.5, sc: rr(.4,.7) });
  }
  for(let i=0;i<26;i++){
    const wx = rr(120, WORLD-120);
    const edge = water.base + Math.sin(water.k*wx)*water.amp + (rnd()<.5 ? -water.half : water.half) + rr(-14,14);
    deco.push({ s:'d'+(rnd()<.5?7:10), x:wx, y:edge, at: rr(0,30), sc: rr(.5,.9) });
  }

  // antorchas: solo junto al pueblo, en el camino, nunca en el río
  {
    const cp = paths[0], seg = [];
    for(let i=0;i<cp.length-1;i++) for(let t=0;t<1;t+=.05){
      seg.push([ cp[i][0]+(cp[i+1][0]-cp[i][0])*t, cp[i][1]+(cp[i+1][1]-cp[i][1])*t ]);
    }
    let n = 0;
    for(let s=6; s<seg.length && n<5; s+=14){
      const p = seg[s];
      if(Math.hypot(p[0]-VX, p[1]-VY) < 470 && p[1] < CY+320){
        const tc = { x:p[0] + (n%2?28:-28), y:p[1], at: 54 + n*8 };
        torches.push(tc); lamps.push({ x:tc.x, y:tc.y-24, at:tc.at });
        n++;
      }
    }
  }

  // barriles y cajas cerca del pueblo (vida de fondo, discreto)
  for(let i=0;i<8;i++){
    const ang=rnd()*Math.PI*2, rad=rr(180,460);
    const s = rnd()<.5 ? 'wpile' : (rnd()<.5?'mpile':'gpile');
    deco.push({ s, x:CX+Math.cos(ang)*rad, y:CY+Math.sin(ang)*rad*.9, at: rr(40,120), sc: rr(.5,.7) });
  }

  // campos: UNA mancha irregular por zona (sin surcos ni bordes rectos, lejos del río)
  const blocks = [
    { cx:CX-760, cy:CY+140, rx:360, ry:230, at:10,  crop:'gold' },      // O/SO
    { cx:CX+560, cy:CY+150, rx:280, ry:210, at:40,  crop:'greengold' }, // SE
    { cx:CX-220, cy:CY-640, rx:300, ry:220, at:92,  crop:'green' },     // lejos N
    { cx:CX+560, cy:CY-560, rx:250, ry:190, at:122, crop:'gold' },      // lejos NE
  ];
  blocks.forEach(B=>{
    const pts=[], n=13;
    for(let i=0;i<n;i++){
      const a = i/n*Math.PI*2;
      const k = rr(.68,1.12);
      pts.push([ B.cx + Math.cos(a)*B.rx*k, B.cy + Math.sin(a)*B.ry*k ]);
    }
    fields.push({ pts, x:B.cx, y:B.cy, rx:B.rx, ry:B.ry, crop:B.crop, at:B.at });
    // vida en el campo (arbustos y ovejas), no líneas
    for(let i=0;i<4;i++) deco.push({ s:'d'+(7+((rnd()*3)|0)), x:B.cx+rr(-B.rx*.8,B.rx*.8), y:B.cy+rr(-B.ry*.7,B.ry*.7), at:B.at, sc:rr(.7,1.05) });
    for(let i=0;i<3;i++) deco.push({ s:'sheep', x:B.cx+rr(-B.rx*.7,B.rx*.7), y:B.cy+rr(-B.ry*.5,B.ry*.6), at:B.at+18, sc:rr(.26,.36) });
  });

  // bosque: cúmulos en anillo, envuelve sin costura, más denso hacia fuera
  for(let c=0;c<30;c++){
    const ang = rnd()*Math.PI*2;
    const rad = rr(600, 1240);
    const gx = CX + Math.cos(ang)*rad, gy = CY + Math.sin(ang)*rad*.92;
    const k = 3 + ((rnd()*8)|0);
    for(let j=0;j<k;j++) forest.push({ x:gx+rr(-130,130), y:gy+rr(-110,110), at: Math.max(0, 12 - c*0.4), sc: rr(.55,.95), v: rnd()<.5 });
  }

  // maleza suelta por todas partes
  for(let i=0;i<210;i++){
    const ang=rnd()*Math.PI*2, rad=rr(150,1220);
    const set = rnd()<.38 ? [7,8,9] : rnd()<.6 ? [1,2,3] : rnd()<.8 ? [10,11,17] : [4,5,6];
    deco.push({ s:'d'+set[(rnd()*set.length)|0], x:CX+Math.cos(ang)*rad, y:CY+Math.sin(ang)*rad*.92, at: rr(0,70), sc: rr(.5,1.15) });
  }

  // rebaños de ovejas (más al subir la prosperidad)
  for(let f=0;f<7;f++){
    const ang=rnd()*Math.PI*2, rad=rr(350,900);
    const cx2=CX+Math.cos(ang)*rad, cy2=CY+Math.sin(ang)*rad*.9;
    const n=2+((rnd()*4)|0), at=20+f*18;
    for(let j=0;j<n;j++) deco.push({ s:'sheep', x:cx2+rr(-70,70), y:cy2+rr(-50,50), at, sc:rr(.28,.4) });
  }

  // easter eggs — viñetas quietas, algunas lejos para explorar
  const V = [
    ['fisher',28],['argue',44],['roofsheep',64],['wedding',92],['chase',54],
    ['picnic',78],['lost',112],['bard',68],['scarecrow',36],['campfire',50],
    ['statue',132],['nap',120],['guard',60],['harvest',96],['well',40],
    ['duel',150],['fish2',104],['market3',126]
  ];
  V.forEach((v,i)=>{
    const ang = i/V.length*Math.PI*2 + rr(-.35,.35);
    const rad = i<8 ? rr(300,640) : rr(680,1150);
    vignettes.push({ k:v[0], at:v[1], x:CX+Math.cos(ang)*rad, y:CY+Math.sin(ang)*rad*.9 });
  });
}

/* ===================================================================
   HORNEADO DEL MUNDO — se rehace al cambiar la prosperidad
   =================================================================== */
const world = document.createElement('canvas');
world.width = WORLD; world.height = WORLD;
const wctx = world.getContext('2d');
wctx.imageSmoothingEnabled = false;

function softShadow(g, x, y, rx, ry, a){
  g.save(); g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(18,22,12,'+(a||.34)+')';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  g.restore();
}
function stamp(g, spr, x, y, sc, shadow){
  const w = spr.width*sc, h = spr.height*sc;
  if(shadow) softShadow(g, x, y - h*0.04, w*0.36, w*0.13);
  g.drawImage(spr, x - w/2, y - h, w, h);
}
function smoothPts(cp, iters){
  // Chaikin: recorta esquinas. Curva suave sin tramos rectos ni "rayos".
  let pts = cp.map(p=>[p[0],p[1]]);
  for(let k=0; k<(iters||3); k++){
    const out=[pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1];
      out.push([a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25]);
      out.push([a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75]);
    }
    out.push(pts[pts.length-1]);
    pts = out;
  }
  return pts;
}
function drawGround(g){
  // manchas suaves de tono: rompe el "fieltro plano"
  g.save(); g.filter = 'blur(34px)';
  mottle.forEach(m=>{
    g.fillStyle = m.light ? 'rgba(180,205,120,.16)' : 'rgba(70,110,64,.18)';
    g.beginPath(); g.ellipse(m.x, m.y, m.r, m.r*.82, 0, 0, 7); g.fill();
  });
  g.restore();
}
function drawRise(g){
  const grd = g.createRadialGradient(rise.x, rise.y, 40, rise.x, rise.y, rise.r);
  grd.addColorStop(0,'rgba(196,216,156,.30)');
  grd.addColorStop(.7,'rgba(160,196,128,.10)');
  grd.addColorStop(1,'rgba(120,160,100,0)');
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(rise.x, rise.y, rise.r, rise.r*.82, 0, 0, 7); g.fill();
  g.save(); g.filter='blur(12px)'; g.strokeStyle='rgba(60,80,45,.18)'; g.lineWidth=16;
  g.beginPath(); g.ellipse(rise.x, rise.y, rise.r*.9, rise.r*.74, 0, 0, 7); g.stroke(); g.restore();
}
function apron(g, x, y, w){
  g.save(); g.filter='blur(3px)';
  g.fillStyle='rgba(150,120,80,.4)';
  g.beginPath(); g.ellipse(x, y, w*.62, w*.24, 0, 0, 7); g.fill();
  g.restore();
}
function waterEdge(x){ return water.base + Math.sin(water.k*x)*water.amp + Math.sin(water.k*x*4 + 1.7)*18; }
function drawWater(g){
  g.save();
  g.beginPath();
  for(let x=0;x<=WORLD;x+=10){ const y=waterEdge(x); x===0?g.moveTo(x,y-water.half):g.lineTo(x,y-water.half); }
  for(let x=WORLD;x>=0;x-=10){ g.lineTo(x, waterEdge(x)+water.half); }
  g.closePath();
  g.fillStyle = '#47aba9';           // el tile de agua es un color plano: lo uso directo, sin textura ni degradado
  g.fill();
  // sombrita interior en las dos orillas (sensación de profundidad, sin bandas)
  g.save(); g.clip();
  g.strokeStyle='rgba(18,44,60,.30)'; g.lineWidth=26;
  g.beginPath(); for(let x=0;x<=WORLD;x+=10){ const y=waterEdge(x); x===0?g.moveTo(x,y-water.half):g.lineTo(x,y-water.half); } g.stroke();
  g.beginPath(); for(let x=0;x<=WORLD;x+=10){ const y=waterEdge(x); x===0?g.moveTo(x,y+water.half):g.lineTo(x,y+water.half); } g.stroke();
  g.restore();
  // espuma en la orilla superior
  g.lineWidth=6; g.strokeStyle='rgba(224,242,246,.5)';
  g.beginPath(); for(let x=0;x<=WORLD;x+=10){ const y=waterEdge(x)-water.half; x===0?g.moveTo(x,y):g.lineTo(x,y); } g.stroke();
  g.restore();
}
function drawPath(g, cp){
  const pts = smoothPts(cp);
  const N = pts.length;
  g.save(); g.lineJoin=g.lineCap='round';
  // 3 pasadas: base ancha difusa, cuerpo, hendidura clara
  const passes = [[38,'rgba(120,92,58,.35)'],[28,'rgba(126,96,60,.9)'],[11,'rgba(158,128,84,.55)']];
  passes.forEach(([w,col],pi)=>{
    for(let i=1;i<N;i++){
      const edgeFade = Math.min(1, Math.min(i, N-i) / 6);   // los extremos se difuminan
      g.strokeStyle = col; g.lineWidth = w;
      g.globalAlpha = pi===0 ? edgeFade*.6 : edgeFade;
      g.beginPath(); g.moveTo(pts[i-1][0],pts[i-1][1]); g.lineTo(pts[i][0],pts[i][1]); g.stroke();
    }
  });
  g.globalAlpha = 1; g.restore();
}
const CROP = {
  gold:      'rgba(226,178,62,.68)',
  greengold: 'rgba(198,196,86,.58)',
  green:     'rgba(120,168,86,.5)',
  plough:    'rgba(126,92,58,.6)',
};
function drawField(g, f, P){
  const grown = P >= f.at + 16;
  const key = grown ? f.crop : 'plough';
  const pts = smoothPts(f.pts.concat([f.pts[0]]));   // borde orgánico cerrado
  g.save();
  g.beginPath(); pts.forEach((p,i)=> i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath();
  softShadow(g, f.x, f.y+22, f.rx*.75, f.ry*.28, .2);
  g.save(); g.clip();
  const R = Math.max(f.rx, f.ry) + 40;
  g.fillStyle = GRASS_COL;    g.fillRect(f.x-R, f.y-R, R*2, R*2);
  g.fillStyle = CROP[key];    g.fillRect(f.x-R, f.y-R, R*2, R*2);
  // textura suave: dos manchas de tono, difuminadas (sin líneas)
  g.save(); g.filter = 'blur(26px)';
  g.fillStyle = 'rgba(255,255,255,.10)';
  g.beginPath(); g.ellipse(f.x - f.rx*.3, f.y - f.ry*.3, f.rx*.5, f.ry*.5, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.10)';
  g.beginPath(); g.ellipse(f.x + f.rx*.35, f.y + f.ry*.35, f.rx*.55, f.ry*.55, 0, 0, 7); g.fill();
  g.restore();
  // borde: sombra interior ancha y difusa (nunca una línea nítida)
  g.filter = 'blur(7px)';
  g.lineWidth = 16; g.strokeStyle = 'rgba(50,64,40,.4)';
  g.beginPath(); pts.forEach((p,i)=> i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.stroke();
  g.restore();
  g.restore();
}
function drawSmoke(g, x, y){
  g.save(); g.fillStyle='rgba(232,232,236,.5)';
  for(let i=0;i<3;i++){ g.beginPath(); g.ellipse(x + i*4 - 4, y - i*16, 8+i*3, 6+i*2, 0, 0, 7); g.fill(); }
  g.restore();
}
function drawMarket(g, x, y){
  stamp(g, SPR.barn, x, y, .42, true);
  stamp(g, SPR.wpile, x-40, y+6, .6, false);
  stamp(g, SPR.mpile, x+40, y+2, .55, false);
  stamp(g, SPR.pawn[1], x+6, y-4, .3, true);
}
function drawVignette(g, v, P){
  const [P0,P1,P2,P3] = SPR.pawn;
  const x=v.x, y=v.y;
  switch(v.k){
    case 'fisher': case 'fish2': stamp(g,P0,x,y,.34,true); stamp(g,SPR.d17,x+26,y-4,.5); break;
    case 'argue': case 'duel':   stamp(g,P1,x-16,y,.34,true); stamp(g,P2,x+16,y,.34,true); stamp(g,SPR.wpile,x,y+6,.5); break;
    case 'roofsheep':            stamp(g,SPR.sheep,x,y,.42,true); break;
    case 'wedding':              stamp(g,P0,x-14,y,.34,true); stamp(g,P1,x+14,y,.34,true); stamp(g,SPR.d13,x,y-2,.6); break;
    case 'chase':                stamp(g,P3,x-20,y,.34,true); stamp(g,SPR.sheep,x+14,y+4,.3,true); break;
    case 'picnic':               stamp(g,P0,x-14,y,.32,true); stamp(g,P1,x+14,y,.32,true); stamp(g,SPR.mpile,x,y+4,.5); break;
    case 'lost':                 stamp(g,P1,x,y,.34,true); stamp(g,SPR.d18,x+22,y,.7); break;
    case 'bard':                 stamp(g,P0,x,y,.34,true); stamp(g,SPR.d12,x+20,y-2,.7); break;
    case 'scarecrow':            stamp(g,SPR.d18,x,y,.95,true); break;
    case 'campfire':             stamp(g,SPR.d16,x,y,.8,true); stamp(g,P2,x-24,y+2,.3,true); break;
    case 'statue':               stamp(g,SPR.warrior,x,y,.34,true); stamp(g,SPR.d6,x,y+8,1.1); break;
    case 'nap':                  stamp(g,P0,x,y,.3,true); stamp(g,SPR.tree2,x+30,y+6,.5,true); break;
    case 'guard':                stamp(g,SPR.warrior,x-10,y,.32,true); stamp(g,SPR.warrior,x+10,y,.32,true); break;
    case 'harvest':              stamp(g,P0,x-12,y,.3,true); stamp(g,P3,x+12,y,.3,true); stamp(g,SPR.wpile,x,y+4,.5); break;
    case 'well':                 stamp(g,SPR.d5,x,y,1.0,true); stamp(g,P1,x-22,y+2,.3,true); break;
    case 'market3':              drawMarket(g,x,y); break;
  }
}

const GRASS_COL = '#97b356';   // el tile de hierba, como color plano (sin costura al envolver)
function bakeWorld(P){
  wctx.clearRect(0,0,WORLD,WORLD);
  wctx.fillStyle = GRASS_COL; wctx.fillRect(0,0,WORLD,WORLD);
  drawGround(wctx);
  drawRise(wctx);
  paths.forEach(cp=> drawPath(wctx, cp));
  drawWater(wctx);
  waterRocks.forEach(r=> stamp(wctx, r.r?SPR.rock1:SPR.rock3, r.x, r.y, r.sc, false));
  fields.filter(f=> P>=f.at).forEach(f=> drawField(wctx, f, P));

  const list = [];
  placed.filter(p=> P>=p.at).forEach(p=> list.push({...p, kind:'b'}));
  forest.filter(f=> P>=f.at).forEach(f=> list.push({...f, kind:'tree'}));
  deco.filter(d=> P>=d.at).forEach(d=> list.push({...d, kind:'deco'}));
  vignettes.filter(v=> P>=v.at).forEach(v=> list.push({...v, kind:'vig'}));
  list.sort((a,b)=> a.y - b.y);

  list.forEach(o=>{
    if(o.kind==='tree'){ stamp(wctx, o.v?SPR.tree2:SPR.tree, o.x, o.y, o.sc, true); return; }
    if(o.kind==='deco'){ stamp(wctx, SPR[o.s], o.x, o.y, o.sc||1, o.s==='sheep'); return; }
    if(o.kind==='vig'){ drawVignette(wctx, o, P); return; }
    const grown = P >= o.at + 12;
    if(o.t==='castle'){ apron(wctx, o.x, o.y, SPR.castle.width*.92); stamp(wctx, grown?SPR.castle:SPR.castleC, o.x, o.y, .92, true); }
    else if(o.t==='house'){
      const sp = grown ? (o.m?SPR.houseM:SPR.house) : SPR.houseC;
      const sc = 0.82 * (o.sc||1);
      apron(wctx, o.x, o.y, sp.width*sc*.9);
      stamp(wctx, sp, o.x, o.y, sc, true);
      if(P >= o.at + 22) drawSmoke(wctx, o.x + sp.width*sc*(o.m?-.18:.18), o.y - sp.height*sc*.86);
    }
    else if(o.t==='tower'){ apron(wctx, o.x, o.y, SPR.tower.width*.78); stamp(wctx, grown?SPR.tower:SPR.towerC, o.x, o.y, .78, true); }
    else if(o.t==='barn'){ apron(wctx, o.x, o.y, SPR.barn.width*.7); stamp(wctx, SPR.barn, o.x, o.y, .7, true); }
    else if(o.t==='market') drawMarket(wctx, o.x, o.y);
    else if(o.t==='mine')  stamp(wctx, P>=o.at+18?SPR.mine:SPR.mineOff, o.x, o.y, .8, true);
    else if(o.t==='bridge') stamp(wctx, bridgeSpr, o.x, o.y + bridgeSpr.height*.25, .5, false);
  });

  // antorchas del camino (poste + llamita tenue; el halo va de noche en draw())
  torches.filter(tc=> P>=tc.at).forEach(tc=>{
    wctx.save();
    wctx.strokeStyle='rgba(40,28,18,.9)'; wctx.lineWidth=5; wctx.lineCap='round';
    wctx.beginPath(); wctx.moveTo(tc.x, tc.y); wctx.lineTo(tc.x, tc.y-30); wctx.stroke();
    wctx.globalAlpha=.85; stamp(wctx, SPR.fire, tc.x, tc.y-26, .18, false);
    wctx.restore();
  });

  // "aliento": prosperidad baja = velo apagado sutil
  if(P < 45){
    wctx.save();
    wctx.fillStyle = 'rgba(70,80,100,'+(0.20*(1 - P/45))+')';
    wctx.fillRect(0,0,WORLD,WORLD);
    wctx.restore();
  }
}

let bridgeSpr;
function buildBridge(){
  const ts=64, c=document.createElement('canvas'); c.width=ts*3; c.height=ts;
  const g=c.getContext('2d');
  for(let i=0;i<3;i++) g.drawImage(img.bridge, (i===0?0:i===1?ts:ts*2), 64, ts,ts, i*ts,0, ts,ts);
  bridgeSpr = c;
}

/* ===================================================================
   RUNTIME — cámara, entrada, dibujo bajo demanda (sin bucle permanente)
   =================================================================== */
let cv, stage, ctx, opts = {};
let cam = { x:CX, y:CY, vx:0, vy:0 };
let ZOOM = 0.5, dpr = 1;
let prosperity = 0, bakedAt = -1, isNight = true, active = true, ready = false;
let rafId = 0, scheduled = false;
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches);
const wrapW = v => ((v % WORLD) + WORLD) % WORLD;

function resize(){
  if(!cv) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width  = Math.max(1, Math.round(stage.clientWidth  * dpr));
  cv.height = Math.max(1, Math.round(stage.clientHeight * dpr));
  ctx.imageSmoothingEnabled = false;
  requestPaint();
}

function paint(){
  scheduled = false;
  if(!ready || !active) return;
  const W = cv.width, H = cv.height, z = ZOOM * dpr, sw = WORLD * z;
  ctx.clearRect(0,0,W,H);
  let ox = (W/2 - cam.x*z) % sw; if(ox > 0) ox -= sw;
  let oy = (H/2 - cam.y*z) % sw; if(oy > 0) oy -= sw;
  for(let x = ox; x < W; x += sw)
    for(let y = oy; y < H; y += sw)
      ctx.drawImage(world, 0,0,WORLD,WORLD, x, y, sw, sw);

  if(isNight){
    ctx.fillStyle = 'rgba(24,22,60,0.46)'; ctx.fillRect(0,0,W,H);
    const moon = ctx.createLinearGradient(0,0,0,H);
    moon.addColorStop(0,'rgba(150,170,230,.12)'); moon.addColorStop(1,'rgba(150,170,230,0)');
    ctx.fillStyle = moon; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    lamps.filter(l => prosperity >= l.at).forEach(l => {
      let sx = wrapW(l.x - cam.x); if(sx > WORLD/2) sx -= WORLD;
      let sy = wrapW(l.y - cam.y); if(sy > WORLD/2) sy -= WORLD;
      const px = W/2 + sx*z, py = H/2 + sy*z;
      if(px < -70 || px > W+70 || py < -70 || py > H+70) return;
      const r = 52*z;
      const grd = ctx.createRadialGradient(px,py,0, px,py,r);
      grd.addColorStop(0,'rgba(255,196,104,.62)');
      grd.addColorStop(.5,'rgba(255,170,80,.22)');
      grd.addColorStop(1,'rgba(255,170,80,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(px,py,r,0,7); ctx.fill();
    });
    ctx.restore();
  }
  // grado de color: calidez + viñeta (una sola estampa)
  const vg = ctx.createRadialGradient(W/2,H*0.44,Math.min(W,H)*0.42, W/2,H*0.5,Math.max(W,H)*0.8);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1, isNight ? 'rgba(6,6,20,0.38)' : 'rgba(28,20,10,0.18)');
  ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
  if(!isNight){ ctx.fillStyle = 'rgba(255,214,150,0.05)'; ctx.fillRect(0,0,W,H); }

  updateZone();
}
function requestPaint(){ if(scheduled) return; scheduled = true; requestAnimationFrame(paint); }

function glide(){
  cam.x = wrapW(cam.x + cam.vx); cam.y = wrapW(cam.y + cam.vy);
  cam.vx *= 0.9; cam.vy *= 0.9;
  paint();
  if(Math.hypot(cam.vx, cam.vy) > 0.15) rafId = requestAnimationFrame(glide);
  else rafId = 0;
}

const REGIONS = [
  {n:'EL PUEBLO', x:CX-70,   y:CY-60,    r:540},
  {n:'LOS CAMPOS',x:CX+560,  y:CY+150,   r:520},
  {n:'LOS CAMPOS',x:CX-760,  y:CY+140,   r:540},
  {n:'LA RIBERA', x:CX+40,   y:CY+780,   r:440},
  {n:'LAS MINAS', x:CX+960,  y:CY-150,   r:440},
  {n:'EL BOSQUE', x:CX-1000, y:CY-330,   r:600},
  {n:'EL BOSQUE', x:CX+120,  y:CY-1000,  r:600},
];
let zoneName = '';
function updateZone(){
  let hit = 'EL PAÍS';
  for(const R of REGIONS){
    let dx = Math.abs(cam.x - R.x); dx = Math.min(dx, WORLD - dx);
    let dy = Math.abs(cam.y - R.y); dy = Math.min(dy, WORLD - dy);
    if(Math.hypot(dx, dy) < R.r){ hit = R.n; break; }
  }
  if(hit !== zoneName){ zoneName = hit; if(opts.onZone) opts.onZone(hit); }
}

/* --- entrada: arrastre (ratón + táctil) + teclado (a11y) --- */
let drag = null;
function onDown(e){
  drag = { x:e.clientX, y:e.clientY };
  cam.vx = cam.vy = 0;
  if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
  if(stage.setPointerCapture && e.pointerId != null) try{ stage.setPointerCapture(e.pointerId); }catch(_){}
}
function onMove(e){
  if(!drag) return;
  const dx = (e.clientX - drag.x) / ZOOM, dy = (e.clientY - drag.y) / ZOOM;
  cam.x = wrapW(cam.x - dx); cam.y = wrapW(cam.y - dy);
  cam.vx = reduceMotion ? 0 : -dx * 0.12;
  cam.vy = reduceMotion ? 0 : -dy * 0.12;
  drag.x = e.clientX; drag.y = e.clientY;
  requestPaint();
}
function onUp(){
  drag = null;
  if(!reduceMotion && Math.hypot(cam.vx, cam.vy) > 0.4 && !rafId) rafId = requestAnimationFrame(glide);
}
function onKey(e){
  const step = 160;
  const m = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] }[e.key];
  if(!m) return;
  e.preventDefault();
  cam.x = wrapW(cam.x + m[0]*step); cam.y = wrapW(cam.y + m[1]*step);
  requestPaint();
}

return {
  init(canvasEl, stageEl, options){
    cv = canvasEl; stage = stageEl; opts = options || {};
    ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    if(!cv.hasAttribute('tabindex')) cv.tabIndex = 0;
    generate();
    window.addEventListener('resize', resize, { passive:true });
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('lostpointercapture', onUp);
    cv.addEventListener('keydown', onKey);
    resize();
    loadAll(() => {
      buildSprites(); buildBridge();
      bakeWorld(prosperity); bakedAt = prosperity;
      ready = true;
      const l = document.getElementById('mapLoading'); if(l) l.style.display = 'none';
      requestPaint();
    });
  },
  setProsperity(p){
    p = Math.max(0, Math.round(p || 0));
    prosperity = p;
    if(ready && p !== bakedAt){ bakeWorld(p); bakedAt = p; requestPaint(); }
  },
  toggleNight(){ isNight = !isNight; requestPaint(); return isNight; },
  setNight(on){ isNight = !!on; requestPaint(); },
  setActive(on){ active = !!on; if(active){ resize(); requestPaint(); } },
  recenter(){ cam.x = CX; cam.y = CY; cam.vx = cam.vy = 0; requestPaint(); },
};
})();
