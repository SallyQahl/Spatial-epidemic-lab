/* =========================================================================
   Spatial Epidemic Research Lab — app.js
   Model: Spatial SEIR with distance-dependent force of infection
   S → E → I → R
   Transmission: P(S→E) = 1 - exp(-(β/N) × Σ kernel(d_ij))
   Latency:      P(E→I) = 1/latency_days  per day
   Recovery:     P(I→R) = γ  per day
   COVID-19 uses dual-kernel: aerosol (long-range) + droplet (short-range)
   ========================================================================= */

const COLORS = {
  S: '#16a34a',   // susceptible — green
  E: '#d97706',   // exposed — amber
  I: '#dc2626',   // infectious — red
  R: '#7c3aed'    // recovered — purple
};

const ST = { S:0, E:1, I:2, R:3 };

/* ---- Disease presets ---- */
const DISEASES = [
  {
    id: 'covid',
    emoji: '🦠',
    name: 'COVID-19',
    sub: 'Moderate, multi-route',
    latency: 2,          // midpoint of 1–3 day pre-symptomatic window
    latencyRange: '1–3 days',
    dualKernel: true,
    params: { N:300, beta:95, alpha:1.3, gamma:0.10, Y0:3, size:1.0 },
    bgColor: '#fef3e2'
  },
  {
    id: 'flu',
    emoji: '🤧',
    name: 'Influenza',
    sub: 'Fast spread, fast recovery',
    latency: 1,          // ~1 day pre-symptomatic spread commonly cited
    latencyRange: '1–2 days',
    dualKernel: false,
    params: { N:300, beta:110, alpha:1.4, gamma:0.18, Y0:2, size:1.0 },
    bgColor: '#eef3f8'
  },
  {
    id: 'measles',
    emoji: '💨',
    name: 'Measles',
    sub: 'Highly airborne, slow recovery',
    latency: 4,          // ~4 days infectious before rash onset
    latencyRange: '~4 days',
    dualKernel: false,
    params: { N:300, beta:160, alpha:0.9, gamma:0.10, Y0:1, size:1.0 },
    bgColor: '#fdf4ff'
  },
  {
    id: 'ebola',
    emoji: '🩸',
    name: 'Ebola',
    sub: 'Close contact only, severe',
    latency: 0,          // generally not contagious before symptoms appear
    latencyRange: '~0 days',
    dualKernel: false,
    params: { N:300, beta:38, alpha:2.8, gamma:0.06, Y0:2, size:1.0 },
    bgColor: '#fff1f2'
  },
  {
    id: 'plague',
    emoji: '🐀',
    name: 'Bubonic Plague',
    sub: 'Clustered, historical',
    latency: 1,          // limited evidence; minimal pre-symptomatic window assumed
    latencyRange: 'unclear',
    dualKernel: false,
    params: { N:300, beta:65, alpha:2.2, gamma:0.05, Y0:2, size:1.0 },
    bgColor: '#f0fdf4'
  },
  {
    id: 'custom',
    emoji: '⚙️',
    name: 'Custom',
    sub: 'Configure manually',
    latency: 4,
    latencyRange: 'custom',
    dualKernel: false,
    params: null,
    bgColor: '#f4f6f8'
  }
];

/* ---- Setting presets — spatial/population only, never disease biology ---- */
const SCENARIOS = [
  { id:'residential', icon:'home',     title:'Residential',   desc:'Spread-out households.',   params:{ N:300, size:1.2, Y0:2 } },
  { id:'downtown',    icon:'building', title:'Downtown core', desc:'Dense, frequent contact.',  params:{ N:450, size:0.7, Y0:3 } },
  { id:'airport',     icon:'plane',    title:'Airport',       desc:'High long-range mixing.',   params:{ N:350, size:1.4, Y0:4 } },
  { id:'school',      icon:'school',   title:'School',        desc:'Tight clusters, fast rec.', params:{ N:250, size:0.6, Y0:2 } },
  { id:'superspr',    icon:'flame',    title:'Super-spreader',desc:'High transmission event.',  params:{ N:300, size:0.8, Y0:12} },
  { id:'custom',      icon:'target',   title:'Custom',        desc:'Adjust sliders freely.',    params:null }
];

const ICONS = {
  home:     '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>',
  building: '<rect x="4" y="2" width="16" height="20" rx="1"></rect><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line>',
  plane:    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.6 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
  school:   '<path d="M22 10 12 5 2 10l10 5 10-5z"></path><path d="M6 12v5c3 1.5 9 1.5 12 0v-5"></path>',
  flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.4-1.5-2-1.5-3.5 0 0 3 1 3 5a4.5 4.5 0 0 1-9 0c0-2 1-3 1-3s.5 2 1.5 2z"></path><path d="M12 2c0 4-4 4-4 8a4 4 0 0 0 8 0c0-2-1-4-2-5z"></path>',
  target:   '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>'
};

/* ---- State ---- */
let pop = [];
let history = [];
let timer = null;
let running = false;
let activeDisease = 'custom';
let activeScenario = 'custom';
let currentLatency = 4;
let useDualKernel = false;
let peakI = 0, peakDay = 0;

/* ---- DOM refs ---- */
const sliderIds = ['N','beta','alpha','gamma','Y0','size','speed'];
const els = {};
sliderIds.forEach(id => { els[id] = document.getElementById(id); });

const valFmt = {
  N: v => String(Math.round(v)),
  beta: v => String(Math.round(v)),
  alpha: v => Number(v).toFixed(2),
  gamma: v => Number(v).toFixed(2),
  Y0: v => String(Math.round(v)),
  size: v => Number(v).toFixed(1) + '\u00d7',
  speed: v => Math.round(v) + '\u00d7'
};

function syncLabels(){
  sliderIds.forEach(id => {
    const el = document.getElementById('val-' + id);
    if(el) el.textContent = valFmt[id](els[id].value);
  });
}

function getParams(){
  return {
    N: Math.round(+els.N.value),
    beta: +els.beta.value,
    alpha: +els.alpha.value,
    gamma: +els.gamma.value,
    Y0: Math.round(+els.Y0.value),
    size: +els.size.value
  };
}

function setSliders(p){
  if(!p) return;
  Object.keys(p).forEach(k => { if(els[k]) els[k].value = p[k]; });
  syncLabels();
}

/* ============================================================
   SEIR SIMULATION
   ============================================================ */

function initPopulation(){
  const { N, Y0, size } = getParams();
  const W = 100 * size, H = 58 * size;
  pop = [];
  for(let i = 0; i < N; i++){
    pop.push({ x: Math.random()*W, y: Math.random()*H, state: ST.S, daysE: 0 });
  }
  const seeds = new Set();
  while(seeds.size < Math.min(Y0, N)) seeds.add(Math.floor(Math.random()*N));
  seeds.forEach(i => { pop[i].state = ST.E; pop[i].daysE = 0; });
  history = [];
  peakI = 0; peakDay = 0;
  recordHistory(0);
}

function recordHistory(day){
  let S=0, E=0, I=0, R=0;
  pop.forEach(p => { if(p.state===ST.S)S++; else if(p.state===ST.E)E++; else if(p.state===ST.I)I++; else R++; });
  history.push({ day, S, E, I, R });
  if(I > peakI){ peakI = I; peakDay = day; }
}

function step(){
  const { beta, alpha, gamma } = getParams();
  const N = pop.length;
  const sigma = currentLatency > 0 ? 1 / currentLatency : 1; // latency=0 → immediately infectious

  const infectious = pop.filter(p => p.state === ST.I);

  // S → E
  const newlyExposed = [];
  for(let i = 0; i < N; i++){
    const p = pop[i];
    if(p.state !== ST.S) continue;
    let force = 0;
    if(useDualKernel){
      // COVID dual-kernel: aerosol (long-range α=0.8) + droplet (close α=2.5)
      for(const inf of infectious){
        const dx = p.x-inf.x, dy = p.y-inf.y;
        const d = Math.sqrt(dx*dx+dy*dy) || 0.001;
        force += 0.5*Math.pow(d,-0.8) + 0.5*Math.pow(d,-2.5);
      }
    } else {
      for(const inf of infectious){
        const dx = p.x-inf.x, dy = p.y-inf.y;
        const d = Math.sqrt(dx*dx+dy*dy) || 0.001;
        force += Math.pow(d,-alpha);
      }
    }
    if(Math.random() < 1 - Math.exp(-(beta/N)*force)) newlyExposed.push(i);
  }

  // E → I  (each exposed individual progresses with prob sigma)
  const newlyInfectious = [];
  pop.forEach((p,i) => {
    if(p.state === ST.E && Math.random() < sigma) newlyInfectious.push(i);
  });

  // I → R
  infectious.forEach(p => { if(Math.random() < gamma) p.state = ST.R; });

  // Apply E→I
  newlyInfectious.forEach(i => { pop[i].state = ST.I; });

  // Apply S→E
  newlyExposed.forEach(i => { pop[i].state = ST.E; pop[i].daysE = 0; });

  recordHistory(history.length);
}

function isFinished(){
  const last = history[history.length-1];
  return (last.I === 0 && last.E === 0) || history.length > 250;
}

/* ============================================================
   CANVAS — scenario backgrounds
   ============================================================ */

const mapCanvas = document.getElementById('mapCanvas');
const mctx = mapCanvas.getContext('2d');

function drawPerson(ctx, px, py, r, state){
  ctx.fillStyle = COLORS[['S','E','I','R'][state]];
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(px, py - r*0.55, r*0.42, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px - r*0.55, py + r*0.55);
  ctx.quadraticCurveTo(px - r*0.6, py - r*0.05, px, py - r*0.05);
  ctx.quadraticCurveTo(px + r*0.6, py - r*0.05, px + r*0.55, py + r*0.55);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* -- background per scenario -- */
function bgResidential(ctx, W, H){
  ctx.fillStyle='#dbe5f0'; const baseY=H*0.82;
  [{x:W*.07,w:90,h:68,rf:38},{x:W*.23,w:70,h:52,rf:28},{x:W*.42,w:100,h:78,rf:44},{x:W*.62,w:75,h:58,rf:32},{x:W*.80,w:92,h:70,rf:40}].forEach(b=>{
    ctx.fillRect(b.x,baseY-b.h,b.w,b.h);
    ctx.beginPath();ctx.moveTo(b.x-8,baseY-b.h);ctx.lineTo(b.x+b.w/2,baseY-b.h-b.rf);ctx.lineTo(b.x+b.w+8,baseY-b.h);ctx.closePath();ctx.fill();
  });
  ctx.fillRect(0,baseY,W,H-baseY);
}

function bgDowntown(ctx, W, H){
  ctx.fillStyle='#d3dde8'; const baseY=H*.88;
  [{x:W*.04,w:60,h:180},{x:W*.13,w:80,h:240},{x:W*.26,w:55,h:148},{x:W*.36,w:95,h:275},{x:W*.50,w:65,h:198},{x:W*.61,w:85,h:255},{x:W*.74,w:60,h:168},{x:W*.85,w:90,h:228}].forEach(b=>{
    const h=Math.min(b.h,baseY-10);
    ctx.fillRect(b.x,baseY-h,b.w,h);
  });
  ctx.fillRect(0,baseY,W,H-baseY);
  ctx.fillStyle='#bccddc';
  [{x:W*.04,w:60,h:180},{x:W*.13,w:80,h:240},{x:W*.26,w:55,h:148},{x:W*.36,w:95,h:275},{x:W*.50,w:65,h:198},{x:W*.61,w:85,h:255},{x:W*.74,w:60,h:168},{x:W*.85,w:90,h:228}].forEach(b=>{
    const h=Math.min(b.h,baseY-10);
    for(let wy=baseY-h+14;wy<baseY-10;wy+=22) for(let wx=b.x+10;wx<b.x+b.w-8;wx+=18) ctx.fillRect(wx,wy,8,12);
  });
}

function bgAirport(ctx, W, H){
  ctx.fillStyle='#dbe5f0'; const baseY=H*.78;
  ctx.fillRect(0,baseY,W,H-baseY);
  ctx.strokeStyle='#bccddc';ctx.lineWidth=4;ctx.setLineDash([28,22]);
  ctx.beginPath();ctx.moveTo(0,H-(H-baseY)/2);ctx.lineTo(W,H-(H-baseY)/2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#c7d6e6';ctx.fillRect(W*.30,baseY-70,W*.40,70);
  ctx.beginPath();ctx.moveTo(W*.30,baseY-70);ctx.lineTo(W*.50,baseY-100);ctx.lineTo(W*.70,baseY-70);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(W*.76,H*.16);ctx.rotate(-0.25);
  ctx.fillStyle='#bccddc';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(70,6);ctx.lineTo(74,12);ctx.lineTo(40,14);ctx.lineTo(34,32);ctx.lineTo(22,32);ctx.lineTo(22,16);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
  ctx.restore();
}

function bgSchool(ctx, W, H){
  ctx.fillStyle='#dbe5f0'; const baseY=H*.85;
  ctx.fillRect(0,baseY,W,H-baseY);
  ctx.fillStyle='#c7d6e6';const bx=W*.28,bw=W*.44,bh=148;
  ctx.fillRect(bx,baseY-bh,bw,bh);
  ctx.beginPath();ctx.moveTo(bx-14,baseY-bh);ctx.lineTo(bx+bw/2,baseY-bh-46);ctx.lineTo(bx+bw+14,baseY-bh);ctx.closePath();ctx.fill();
  ctx.fillRect(bx+bw/2-6,baseY-bh-68,12,24);
  ctx.fillStyle='#aec1d4';
  for(let wx=bx+16;wx<bx+bw-16;wx+=34){ctx.fillRect(wx,baseY-bh+24,18,26);ctx.fillRect(wx,baseY-bh+68,18,26);}
  ctx.fillRect(bx+bw/2-14,baseY-48,28,48);
}

function bgSuperspread(ctx, W, H){
  ctx.fillStyle='#f6dada';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#e8bcbc';ctx.lineWidth=2;
  for(let r=40;r<Math.max(W,H);r+=50){ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();}
}

function bgCustom(ctx, W, H){
  ctx.fillStyle='#e6eaee';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#cdd4dc';ctx.lineWidth=1;
  for(let gx=0;gx<=W;gx+=80){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<=H;gy+=80){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
  ctx.strokeStyle='#bcc7d2';ctx.lineWidth=2;
  [50,90,130].forEach(r=>{ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();});
}

/* Disease-themed backgrounds */
function bgCovid(ctx, W, H){
  ctx.fillStyle='#faebd0';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#f0d0a0';ctx.lineWidth=1.5;
  for(let r=30;r<Math.max(W,H);r+=40){ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();}
  // virus spike silhouette center
  ctx.fillStyle='#f0c880';ctx.beginPath();ctx.arc(W/2,H/2,18,0,Math.PI*2);ctx.fill();
  for(let a=0;a<Math.PI*2;a+=Math.PI/5){
    ctx.beginPath();ctx.moveTo(W/2+18*Math.cos(a),H/2+18*Math.sin(a));ctx.lineTo(W/2+28*Math.cos(a),H/2+28*Math.sin(a));ctx.lineWidth=4;ctx.strokeStyle='#f0c880';ctx.stroke();
  }
}

function bgMeasles(ctx, W, H){
  ctx.fillStyle='#f3e8ff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#e8d0f8';
  for(let i=0;i<18;i++){
    const x=Math.sin(i*2.8)*W*0.38+W/2,y=Math.cos(i*1.9)*H*0.35+H/2;
    ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
  }
}

function bgEbola(ctx, W, H){
  ctx.fillStyle='#ffe4e6';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#fca5a5';ctx.lineWidth=1;
  for(let x=0;x<=W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<=H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
}

function bgPlague(ctx, W, H){
  ctx.fillStyle='#dcf0e4';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#b8d8c8';
  [[W*.15,H*.6],[W*.40,H*.75],[W*.65,H*.55],[W*.85,H*.7]].forEach(([x,y])=>{
    ctx.beginPath();ctx.moveTo(x,y-30);ctx.lineTo(x-18,y+18);ctx.lineTo(x+18,y+18);ctx.closePath();ctx.fill();
    ctx.fillRect(x-3,y+18,6,20);
  });
}

const DISEASE_BG = { covid:bgCovid, flu:bgAirport, measles:bgMeasles, ebola:bgEbola, plague:bgPlague, custom:bgCustom };
const SCENARIO_BG = { residential:bgResidential, downtown:bgDowntown, airport:bgAirport, school:bgSchool, superspr:bgSuperspread, custom:bgCustom };

function drawMap(){
  const { size } = getParams();
  const W=mapCanvas.width, H=mapCanvas.height;
  mctx.clearRect(0,0,W,H);

  const bgFn = DISEASE_BG[activeDisease] || SCENARIO_BG[activeScenario] || bgCustom;
  bgFn(mctx, W, H);

  mctx.strokeStyle='rgba(255,255,255,0.45)';mctx.lineWidth=1;
  for(let gx=0;gx<=W;gx+=40){mctx.beginPath();mctx.moveTo(gx,0);mctx.lineTo(gx,H);mctx.stroke();}
  for(let gy=0;gy<=H;gy+=40){mctx.beginPath();mctx.moveTo(0,gy);mctx.lineTo(W,gy);mctx.stroke();}

  const domainW=100*size, domainH=58*size;
  const sc=Math.min(W/domainW, H/domainH);
  const offX=(W-domainW*sc)/2, offY=(H-domainH*sc)/2;
  const r=Math.max(3,Math.min(7,700/pop.length));
  pop.forEach(p=>{ drawPerson(mctx, offX+p.x*sc, offY+p.y*sc, r, p.state); });
}

/* ============================================================
   CHART
   ============================================================ */
let chart = null;
function initChart(){
  chart = new Chart(document.getElementById('curveChart').getContext('2d'),{
    type:'line',
    data:{
      labels:[],
      datasets:[
        {label:'Susceptible',data:[],borderColor:COLORS.S,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2},
        {label:'Exposed',    data:[],borderColor:COLORS.E,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2},
        {label:'Infectious', data:[],borderColor:COLORS.I,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2},
        {label:'Recovered',  data:[],borderColor:COLORS.R,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,animation:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{title:{display:true,text:'Day',font:{size:12}},grid:{color:'#f1f3f6'},ticks:{font:{size:11}}},
        y:{title:{display:true,text:'Individuals',font:{size:12}},beginAtZero:true,grid:{color:'#f1f3f6'},ticks:{font:{size:11}}}
      },
      plugins:{legend:{position:'top',align:'end',labels:{boxWidth:12,boxHeight:12,usePointStyle:true,pointStyle:'circle',font:{size:12}}},tooltip:{titleFont:{size:12},bodyFont:{size:12}}}
    }
  });
}

function updateChart(){
  chart.data.labels = history.map(h=>h.day);
  chart.data.datasets[0].data = history.map(h=>h.S);
  chart.data.datasets[1].data = history.map(h=>h.E);
  chart.data.datasets[2].data = history.map(h=>h.I);
  chart.data.datasets[3].data = history.map(h=>h.R);
  chart.update();
}

/* ============================================================
   METRICS + ALERT
   ============================================================ */
function updateMetrics(){
  const last = history[history.length-1];
  const N = pop.length;
  document.getElementById('m-day').textContent = last.day;
  document.getElementById('m-S').textContent = last.S;
  document.getElementById('m-E').textContent = last.E;
  document.getElementById('m-I').textContent = last.I;
  document.getElementById('m-R').textContent = last.R;
  document.getElementById('m-S-pct').textContent = ((last.S/N)*100).toFixed(1)+'% of population';
  document.getElementById('m-E-pct').textContent = ((last.E/N)*100).toFixed(1)+'% incubating';
  document.getElementById('m-R-pct').textContent = ((last.R/N)*100).toFixed(1)+'% immune';
  document.getElementById('m-peak').textContent = peakI>0 ? 'Peak: '+peakI+' on day '+peakDay : '\u2014';
  updateAlert(last, N);
}

function updateAlert(last, N){
  const panel = document.getElementById('alertPanel');
  const title = document.getElementById('alertTitle');
  const body  = document.getElementById('alertBody');
  const list  = document.getElementById('alertInterventions');
  const pctI  = last.I / N;
  const pctEI = (last.E + last.I) / N;

  let level, icon, t, b, interventions=[];

  if(!running && history.length <= 1){
    level='green'; icon='🟢'; t='No active outbreak';
    b='Run the simulation to see real-time public health recommendations.';
  } else if(pctI === 0 && last.day > 1){
    level='green'; icon='✅'; t='Outbreak resolved';
    b=`Epidemic ended on day ${last.day}. ${last.R} individuals recovered (${((last.R/N)*100).toFixed(0)}% of population exposed).`;
  } else if(pctEI < 0.05){
    level='green'; icon='🟢'; t='Containment phase — low activity';
    b='Transmission is limited. Early detection and isolation of cases is effective at this stage.';
    interventions=['Contact tracing','Case isolation','Targeted testing'];
  } else if(pctI < 0.15 && pctEI < 0.25){
    level='yellow'; icon='⚠️'; t='Moderate outbreak — intervention recommended';
    b='The outbreak is growing. Rapid action can still limit peak infection.';
    interventions=['Mask mandates','Social distancing','Close high-risk venues','Accelerate vaccination'];
  } else if(pctI < 0.35){
    level='yellow'; icon='🚨'; t='Active community spread — urgent action needed';
    b='Significant community transmission is underway. Healthcare capacity may be strained.';
    interventions=['Restrict gatherings','Remote work policy','School closures','Emergency healthcare capacity'];
  } else {
    level='red'; icon='🔴'; t='Critical — epidemic peak';
    b=`Over ${(pctI*100).toFixed(0)}% of the population is currently infectious. Healthcare system overload is likely. Immediate suppression measures are required.`;
    interventions=['Full lockdown','Field hospital deployment','Emergency supply mobilization','Mandatory quarantine'];
  }

  panel.className = 'alert-panel level-' + level;
  document.querySelector('.alert-icon').textContent = icon;
  title.textContent = t;
  body.textContent = b;
  list.innerHTML = interventions.map(i=>`<li>${i}</li>`).join('');
}

function setStatus(state){
  const badge = document.getElementById('statusBadge');
  const statusEl = document.getElementById('m-status');
  const styles = {
    ready:   {color:'#1d4ed8', bg:'#eaf1fd', text:'Ready',    sub:'Not started'},
    running: {color:'#0c7a3a', bg:'#eafaf0', text:'Running',  sub:'Simulation running\u2026'},
    done:    {color:'#1d4ed8', bg:'#eaf1fd', text:'Complete', sub:'Epidemic resolved'}
  };
  const s = styles[state] || styles.ready;
  badge.style.color = s.color; badge.style.background = s.bg;
  badge.innerHTML = clockIcon() + ' ' + s.text;
  statusEl.textContent = s.sub;
}

function clockIcon(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; }
function playIconSVG(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'; }
function pauseIconSVG(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'; }

/* ============================================================
   RUN CONTROLS
   ============================================================ */
const btnRun   = document.getElementById('btnRun');
const btnReset = document.getElementById('btnReset');

function speedToMs(v){ return Math.max(50, 650 - Math.round(v)*60); }

function startRun(){
  if(running) return;
  if(history.length <= 1 || isFinished()){ initPopulation(); }
  running = true;
  setStatus('running');
  btnRun.innerHTML = pauseIconSVG() + ' Pause';
  tick();
}

function pauseRun(){
  running = false;
  clearInterval(timer);
  btnRun.innerHTML = playIconSVG() + ' Resume';
}

function tick(){
  clearInterval(timer);
  timer = setInterval(()=>{
    if(!running) return;
    step(); drawMap(); updateChart(); updateMetrics();
    if(isFinished()){
      running=false; clearInterval(timer);
      setStatus('done');
      btnRun.innerHTML = playIconSVG() + ' Run again';
    }
  }, speedToMs(els.speed.value));
}

btnRun.addEventListener('click',()=>{ if(running) pauseRun(); else startRun(); });
btnReset.addEventListener('click',()=>{
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML = playIconSVG() + ' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
});

/* ---- Sliders ---- */
sliderIds.forEach(id=>{
  els[id].addEventListener('input',()=>{
    syncLabels();
    if(id !== 'speed'){
      activeDisease = 'custom'; activeScenario = 'custom';
      highlightDisease('custom'); highlightScenario('custom');
      document.getElementById('diseaseLabel').textContent = 'Custom configuration';
      if(!running){ running=false; clearInterval(timer); initPopulation(); drawMap(); updateChart(); updateMetrics(); setStatus('ready'); btnRun.innerHTML = playIconSVG() + ' Run simulation'; }
    } else if(running){ tick(); }
  });
});

/* ============================================================
   DISEASE CARDS
   ============================================================ */
function buildDiseaseCards(){
  const grid = document.getElementById('diseaseGrid');
  DISEASES.forEach(d=>{
    const card = document.createElement('div');
    card.className='disease-card'; card.dataset.id=d.id;
    card.innerHTML=`<span class="d-icon">${d.emoji}</span><p class="d-name">${d.name}</p><p class="d-sub">${d.sub}</p>`;
    card.addEventListener('click',()=>applyDisease(d.id));
    grid.appendChild(card);
  });
}

function highlightDisease(id){
  document.querySelectorAll('.disease-card').forEach(c=>c.classList.toggle('active',c.dataset.id===id));
}

function applyDisease(id){
  const d = DISEASES.find(x=>x.id===id);
  activeDisease = id; activeScenario = 'custom';
  highlightDisease(id); highlightScenario('custom');
  currentLatency = d.latency;
  useDualKernel = d.dualKernel;
  document.getElementById('diseaseLabel').textContent = d.name + (d.dualKernel ? ' (dual-kernel transmission)' : '');
  if(d.params){ setSliders(d.params); }
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML = playIconSVG() + ' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
}

/* ============================================================
   SCENARIO CARDS
   ============================================================ */
function buildScenarioCards(){
  const grid = document.getElementById('scenarioGrid');
  SCENARIOS.forEach(sc=>{
    const card = document.createElement('div');
    card.className='scenario-card'; card.dataset.id=sc.id;
    card.innerHTML=`<div class="sc-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[sc.icon]}</svg></div><p class="sc-title">${sc.title}</p><p class="sc-desc">${sc.desc}</p>`;
    card.addEventListener('click',()=>applyScenario(sc.id));
    grid.appendChild(card);
  });
}

function highlightScenario(id){
  document.querySelectorAll('.scenario-card').forEach(c=>c.classList.toggle('active',c.dataset.id===id));
}

function applyScenario(id){
  const sc = SCENARIOS.find(s=>s.id===id);
  activeScenario = id;
  highlightScenario(id);
  if(sc.params){
    // only update spatial/population params — never touch beta, alpha, gamma
    if(sc.params.N    !== undefined) els.N.value    = sc.params.N;
    if(sc.params.size !== undefined) els.size.value = sc.params.size;
    if(sc.params.Y0   !== undefined) els.Y0.value   = sc.params.Y0;
    syncLabels();
  }
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML = playIconSVG() + ' Run simulation';
}

/* ============================================================
   EXPORT
   ============================================================ */
document.getElementById('btnExportPng').addEventListener('click',()=>{
  const a=document.createElement('a'); a.href=chart.toBase64Image(); a.download='epidemic-curve.png'; a.click();
});
document.getElementById('btnExportCsv').addEventListener('click',()=>{
  let csv='day,susceptible,exposed,infectious,recovered\n';
  history.forEach(h=>{ csv+=`${h.day},${h.S},${h.E},${h.I},${h.R}\n`; });
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='epidemic-data.csv'; a.click();
});

/* ============================================================
   INIT
   ============================================================ */
function init(){
  syncLabels();
  buildDiseaseCards();
  buildScenarioCards();
  highlightDisease('custom');
  highlightScenario('custom');
  initChart();
  initPopulation();
  drawMap();
  updateChart();
  updateMetrics();
  setStatus('ready');
  btnRun.innerHTML = playIconSVG() + ' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
}

init();
