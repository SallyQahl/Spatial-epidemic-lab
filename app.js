/* =========================================================================
   Spatial Epidemic Research Lab — Version 1.1
   Model: Spatial SEIR Individual-Level Model (ILM)
   
   Transmission:  P(S→E) = 1 - exp(-(β/N) × Σ_j d_ij^(-α))
                  where sum is over presymptomatic + infectious individuals
   
   Disease timeline (deterministic day counters):
     E state, days 0 to (incubationDays - presymptomaticDays - 1): latent, NOT infectious
     E state, days (incubationDays - presymptomaticDays) to (incubationDays - 1): presymptomatic, INFECTIOUS
     I state, days 0 to (infectiousDays - 1): symptomatic, INFECTIOUS
     I → R: deterministic at daysInI >= infectiousDays
   
   Population structure:
     Households of householdSize individuals placed around a common center.
     No household transmission multiplier — spatial proximity handles clustering.
   
   Transmission Efficiency:
     Mean secondary infections among completed (recovered) non-seed cases.
     Seed cases (Y0 initial infections) excluded from denominator.
   
   Ref: Deardon et al. (2010), Statistica Sinica 20:239-261.
   ========================================================================= */

/* ---- Constants ---- */
const COLORS = { S:'#16a34a', E:'#d97706', I:'#dc2626', R:'#7c3aed' };
const ST = { S:0, E:1, I:2, R:3 };
const HOUSEHOLD_SIZE = 4;
const HOUSEHOLD_NOISE = 3.5; // spatial spread within household (domain units)

/* ---- Disease presets ---- */
const DISEASES = [
  {
    id: 'covid',
    emoji: '🦠',
    name: 'COVID-19',
    sub: 'Multi-route, moderate spread',
    incubationDays: 5,
    presymptomaticDays: 2,
    infectiousDays: 8,
    dualKernel: true,
    params: { N:300, beta:95, alpha:1.3, gamma:null, Y0:3, size:1.0 },
    latencyRange: '1–3 days pre-symptomatic spread',
    bgColor: '#fef3e2'
  },
  {
    id: 'flu',
    emoji: '🤧',
    name: 'Influenza',
    sub: 'Fast spread, fast recovery',
    incubationDays: 2,
    presymptomaticDays: 1,
    infectiousDays: 5,
    dualKernel: false,
    params: { N:300, beta:110, alpha:1.4, gamma:null, Y0:2, size:1.0 },
    latencyRange: '~1 day pre-symptomatic spread',
    bgColor: '#eef3f8'
  },
  {
    id: 'measles',
    emoji: '💨',
    name: 'Measles',
    sub: 'Highly airborne, long incubation',
    incubationDays: 10,
    presymptomaticDays: 4,
    infectiousDays: 8,
    dualKernel: false,
    params: { N:300, beta:160, alpha:0.9, gamma:null, Y0:1, size:1.0 },
    latencyRange: '~4 days before rash onset',
    bgColor: '#fdf4ff'
  },
  {
    id: 'ebola',
    emoji: '🩸',
    name: 'Ebola',
    sub: 'Close contact only, severe',
    incubationDays: 10,
    presymptomaticDays: 0,
    infectiousDays: 10,
    dualKernel: false,
    params: { N:300, beta:38, alpha:2.8, gamma:null, Y0:2, size:1.0 },
    latencyRange: 'Not contagious before symptoms',
    bgColor: '#fff1f2'
  },
  {
    id: 'plague',
    emoji: '🐀',
    name: 'Bubonic Plague',
    sub: 'Clustered, contact/vector spread',
    incubationDays: 4,
    presymptomaticDays: 0,
    infectiousDays: 6,
    dualKernel: false,
    params: { N:300, beta:65, alpha:2.2, gamma:null, Y0:2, size:1.0 },
    latencyRange: 'Limited evidence on pre-symptomatic window',
    bgColor: '#f0fdf4'
  },
  {
    id: 'custom',
    emoji: '⚙️',
    name: 'Custom',
    sub: 'Configure manually',
    incubationDays: 5,
    presymptomaticDays: 2,
    infectiousDays: 8,
    dualKernel: false,
    params: null,
    latencyRange: 'User-defined',
    bgColor: '#f4f6f8'
  }
];

/* ---- Setting presets (spatial/population only) ---- */
const SCENARIOS = [
  { id:'residential', icon:'home',     title:'Residential',   desc:'Spread-out households.',  params:{ N:300, size:1.2, Y0:2 } },
  { id:'downtown',    icon:'building', title:'Downtown core', desc:'Dense, frequent contact.', params:{ N:450, size:0.7, Y0:3 } },
  { id:'airport',     icon:'plane',    title:'Airport',       desc:'High long-range mixing.',  params:{ N:350, size:1.4, Y0:4 } },
  { id:'school',      icon:'school',   title:'School',        desc:'Tight clusters.',          params:{ N:250, size:0.6, Y0:2 } },
  { id:'superspr',    icon:'flame',    title:'Super-spreader',desc:'High initial cases.',      params:{ N:300, size:0.8, Y0:12} },
  { id:'custom',      icon:'target',   title:'Custom',        desc:'Adjust sliders freely.',   params:null }
];

const ICONS = {
  home:     '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>',
  building: '<rect x="4" y="2" width="16" height="20" rx="1"></rect><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line>',
  plane:    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.6 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
  school:   '<path d="M22 10 12 5 2 10l10 5 10-5z"></path><path d="M6 12v5c3 1.5 9 1.5 12 0v-5"></path>',
  flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.4-1.5-2-1.5-3.5 0 0 3 1 3 5a4.5 4.5 0 0 1-9 0c0-2 1-3 1-3s.5 2 1.5 2z"></path><path d="M12 2c0 4-4 4-4 8a4 4 0 0 0 8 0c0-2-1-4-2-5z"></path>',
  target:   '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>'
};

/* ---- Simulation state ---- */
let pop = [];
let history = [];
let timer = null;
let running = false;
let activeDisease = 'custom';
let activeScenario = 'custom';
let currentDisease = DISEASES.find(d => d.id === 'custom');
let peakI = 0, peakDay = 0;
let transmissionEfficiency = null;

/* ---- DOM refs ---- */
const sliderIds = ['N','beta','alpha','Y0','size','speed'];
const els = {};
sliderIds.forEach(id => { els[id] = document.getElementById(id); });

const valFmt = {
  N:     v => String(Math.round(v)),
  beta:  v => String(Math.round(v)),
  alpha: v => Number(v).toFixed(2),
  Y0:    v => String(Math.round(v)),
  size:  v => Number(v).toFixed(1) + '\u00d7',
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
    N:    Math.round(+els.N.value),
    beta: +els.beta.value,
    alpha:+els.alpha.value,
    Y0:   Math.round(+els.Y0.value),
    size: +els.size.value
  };
}

function setSliders(p){
  if(!p) return;
  ['N','beta','alpha','Y0','size'].forEach(k => {
    if(p[k] !== undefined && p[k] !== null && els[k]) els[k].value = p[k];
  });
  syncLabels();
}

/* ============================================================
   POPULATION — HOUSEHOLD CLUSTERS
   No household transmission multiplier.
   Proximity alone drives intra-household spread via the kernel.
   ============================================================ */

function initPopulation(){
  const { N, Y0, size } = getParams();
  const W = 100 * size, H = 58 * size;
  const nHouseholds = Math.ceil(N / HOUSEHOLD_SIZE);
  pop = [];

  // Generate household centers
  const centers = [];
  for(let h = 0; h < nHouseholds; h++){
    centers.push({ x: Math.random()*W, y: Math.random()*H });
  }

  // Place individuals around household centers
  for(let i = 0; i < N; i++){
    const hh = Math.floor(i / HOUSEHOLD_SIZE);
    const cx = centers[hh].x, cy = centers[hh].y;
    pop.push({
      x: cx + (Math.random()-0.5)*2*HOUSEHOLD_NOISE,
      y: cy + (Math.random()-0.5)*2*HOUSEHOLD_NOISE,
      state: ST.S,
      householdId: hh,
      daysInE: 0,
      daysInI: 0,
      seedCase: false,
      infectedBy: null,
      secondaryCount: 0
    });
  }

  // Seed initial infections
  const seeds = new Set();
  while(seeds.size < Math.min(Y0, N)) seeds.add(Math.floor(Math.random()*N));
  seeds.forEach(i => {
    pop[i].state = ST.E;
    pop[i].daysInE = 0;
    pop[i].seedCase = true;
  });

  history = [];
  peakI = 0; peakDay = 0;
  transmissionEfficiency = null;
  recordHistory(0);
}

/* ============================================================
   SIMULATION STEP — deterministic disease progression
   ============================================================ */

function step(){
  const { beta, alpha } = getParams();
  const N = pop.length;
  const d = currentDisease;

  // Who is currently infectious?
  // Presymptomatic (in E but past latent window) + Symptomatic (I)
  const latentDays = d.incubationDays - d.presymptomaticDays;
  const infectious = pop.filter(p =>
    (p.state === ST.E && p.daysInE >= latentDays) ||
    p.state === ST.I
  );

  // S → E: compute force of infection
  const newlyExposed = [];
  for(let i = 0; i < N; i++){
    const p = pop[i];
    if(p.state !== ST.S) continue;
    let force = 0;
    let maxContrib = 0;
    let likelyInfector = null;

    if(d.dualKernel){
      // COVID-19: aerosol (long-range α=0.8) + droplet (short-range α=2.5)
      infectious.forEach((inf, idx) => {
        const dx = p.x - inf.x, dy = p.y - inf.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const contrib = 0.5*Math.pow(dist,-0.8) + 0.5*Math.pow(dist,-2.5);
        force += contrib;
        if(contrib > maxContrib){ maxContrib = contrib; likelyInfector = inf; }
      });
    } else {
      infectious.forEach(inf => {
        const dx = p.x - inf.x, dy = p.y - inf.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const contrib = Math.pow(dist, -alpha);
        force += contrib;
        if(contrib > maxContrib){ maxContrib = contrib; likelyInfector = inf; }
      });
    }

    const prob = 1 - Math.exp(-(beta/N)*force);
    if(Math.random() < prob){
      newlyExposed.push({ idx: i, infector: likelyInfector });
    }
  }

  // Apply S → E
  newlyExposed.forEach(({ idx, infector }) => {
    pop[idx].state = ST.E;
    pop[idx].daysInE = 0;
    pop[idx].infectedBy = infector ? pop.indexOf(infector) : null;
    if(infector) infector.secondaryCount++;
  });

  // E: advance day counter; E → I at incubationDays
  pop.forEach(p => {
    if(p.state === ST.E){
      p.daysInE++;
      if(p.daysInE >= d.incubationDays){
        p.state = ST.I;
        p.daysInI = 0;
      }
    }
  });

  // I: advance day counter; I → R deterministically at infectiousDays
  pop.forEach(p => {
    if(p.state === ST.I){
      p.daysInI++;
      if(p.daysInI >= d.infectiousDays) p.state = ST.R;
    }
  });

  recordHistory(history.length);
  updateTransmissionEfficiency();
}

function recordHistory(day){
  let S=0, E=0, I=0, R=0;
  pop.forEach(p => {
    if(p.state===ST.S) S++;
    else if(p.state===ST.E) E++;
    else if(p.state===ST.I) I++;
    else R++;
  });
  history.push({ day, S, E, I, R });
  if(I > peakI){ peakI = I; peakDay = day; }
}

function updateTransmissionEfficiency(){
  // Only recovered non-seed cases contribute to denominator
  const completed = pop.filter(p => p.state === ST.R && !p.seedCase);
  if(completed.length === 0){ transmissionEfficiency = null; return; }
  const totalSecondary = completed.reduce((sum, p) => sum + p.secondaryCount, 0);
  transmissionEfficiency = totalSecondary / completed.length;
}

function isFinished(){
  const last = history[history.length-1];
  return (last.I === 0 && last.E === 0) || history.length > 300;
}

/* ============================================================
   CANVAS
   ============================================================ */
const mapCanvas = document.getElementById('mapCanvas');
const mctx = mapCanvas.getContext('2d');

function drawPerson(ctx, px, py, r, state){
  ctx.fillStyle = COLORS[['S','E','I','R'][state]];
  ctx.globalAlpha = 0.88;
  // head
  ctx.beginPath();
  ctx.arc(px, py - r*0.55, r*0.42, 0, Math.PI*2);
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.moveTo(px - r*0.55, py + r*0.55);
  ctx.quadraticCurveTo(px - r*0.6, py - r*0.05, px, py - r*0.05);
  ctx.quadraticCurveTo(px + r*0.6, py - r*0.05, px + r*0.55, py + r*0.55);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* Scenario backgrounds */
function bgResidential(ctx,W,H){
  ctx.fillStyle='#dbe5f0';const baseY=H*.82;
  [{x:W*.07,w:90,h:68,rf:38},{x:W*.23,w:70,h:52,rf:28},{x:W*.42,w:100,h:78,rf:44},{x:W*.62,w:75,h:58,rf:32},{x:W*.80,w:92,h:70,rf:40}].forEach(b=>{
    ctx.fillRect(b.x,baseY-b.h,b.w,b.h);
    ctx.beginPath();ctx.moveTo(b.x-8,baseY-b.h);ctx.lineTo(b.x+b.w/2,baseY-b.h-b.rf);ctx.lineTo(b.x+b.w+8,baseY-b.h);ctx.closePath();ctx.fill();
  });
  ctx.fillRect(0,baseY,W,H-baseY);
}
function bgDowntown(ctx,W,H){
  ctx.fillStyle='#d3dde8';const baseY=H*.88;
  [{x:W*.04,w:60,h:180},{x:W*.13,w:80,h:240},{x:W*.26,w:55,h:148},{x:W*.36,w:95,h:275},{x:W*.50,w:65,h:198},{x:W*.61,w:85,h:255},{x:W*.74,w:60,h:168},{x:W*.85,w:90,h:228}].forEach(b=>{
    const h=Math.min(b.h,baseY-10);ctx.fillRect(b.x,baseY-h,b.w,h);
  });
  ctx.fillRect(0,baseY,W,H-baseY);
  ctx.fillStyle='#bccddc';
  [{x:W*.04,w:60,h:180},{x:W*.13,w:80,h:240},{x:W*.26,w:55,h:148},{x:W*.36,w:95,h:275},{x:W*.50,w:65,h:198},{x:W*.61,w:85,h:255},{x:W*.74,w:60,h:168},{x:W*.85,w:90,h:228}].forEach(b=>{
    const h=Math.min(b.h,baseY-10);
    for(let wy=baseY-h+14;wy<baseY-10;wy+=22) for(let wx=b.x+10;wx<b.x+b.w-8;wx+=18) ctx.fillRect(wx,wy,8,12);
  });
}
function bgAirport(ctx,W,H){
  ctx.fillStyle='#dbe5f0';const baseY=H*.78;
  ctx.fillRect(0,baseY,W,H-baseY);
  ctx.strokeStyle='#bccddc';ctx.lineWidth=4;ctx.setLineDash([28,22]);
  ctx.beginPath();ctx.moveTo(0,H-(H-baseY)/2);ctx.lineTo(W,H-(H-baseY)/2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#c7d6e6';ctx.fillRect(W*.30,baseY-70,W*.40,70);
  ctx.beginPath();ctx.moveTo(W*.30,baseY-70);ctx.lineTo(W*.50,baseY-100);ctx.lineTo(W*.70,baseY-70);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(W*.76,H*.16);ctx.rotate(-0.25);
  ctx.fillStyle='#bccddc';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(70,6);ctx.lineTo(74,12);ctx.lineTo(40,14);ctx.lineTo(34,32);ctx.lineTo(22,32);ctx.lineTo(22,16);ctx.lineTo(0,14);ctx.closePath();ctx.fill();
  ctx.restore();
}
function bgSchool(ctx,W,H){
  ctx.fillStyle='#dbe5f0';const baseY=H*.85;
  ctx.fillRect(0,baseY,W,H-baseY);
  ctx.fillStyle='#c7d6e6';const bx=W*.28,bw=W*.44,bh=148;
  ctx.fillRect(bx,baseY-bh,bw,bh);
  ctx.beginPath();ctx.moveTo(bx-14,baseY-bh);ctx.lineTo(bx+bw/2,baseY-bh-46);ctx.lineTo(bx+bw+14,baseY-bh);ctx.closePath();ctx.fill();
  ctx.fillRect(bx+bw/2-6,baseY-bh-68,12,24);
  ctx.fillStyle='#aec1d4';
  for(let wx=bx+16;wx<bx+bw-16;wx+=34){ctx.fillRect(wx,baseY-bh+24,18,26);ctx.fillRect(wx,baseY-bh+68,18,26);}
  ctx.fillRect(bx+bw/2-14,baseY-48,28,48);
}
function bgSuperspread(ctx,W,H){
  ctx.fillStyle='#f6dada';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#e8bcbc';ctx.lineWidth=2;
  for(let r=40;r<Math.max(W,H);r+=50){ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();}
}
function bgCustom(ctx,W,H){
  ctx.fillStyle='#e6eaee';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#cdd4dc';ctx.lineWidth=1;
  for(let gx=0;gx<=W;gx+=80){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(let gy=0;gy<=H;gy+=80){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
  ctx.strokeStyle='#bcc7d2';ctx.lineWidth=2;
  [50,90,130].forEach(r=>{ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();});
}
function bgCovid(ctx,W,H){
  ctx.fillStyle='#faebd0';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#f0d0a0';ctx.lineWidth=1.5;
  for(let r=30;r<Math.max(W,H);r+=40){ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#f0c880';ctx.beginPath();ctx.arc(W/2,H/2,18,0,Math.PI*2);ctx.fill();
  for(let a=0;a<Math.PI*2;a+=Math.PI/5){
    ctx.beginPath();ctx.moveTo(W/2+18*Math.cos(a),H/2+18*Math.sin(a));ctx.lineTo(W/2+28*Math.cos(a),H/2+28*Math.sin(a));ctx.lineWidth=4;ctx.strokeStyle='#f0c880';ctx.stroke();
  }
}
function bgMeasles(ctx,W,H){
  ctx.fillStyle='#f3e8ff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#e8d0f8';
  for(let i=0;i<18;i++){const x=Math.sin(i*2.8)*W*0.38+W/2,y=Math.cos(i*1.9)*H*0.35+H/2;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();}
}
function bgEbola(ctx,W,H){
  ctx.fillStyle='#ffe4e6';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#fca5a5';ctx.lineWidth=1;
  for(let x=0;x<=W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<=H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
}
function bgPlague(ctx,W,H){
  ctx.fillStyle='#dcf0e4';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#b8d8c8';
  [[W*.15,H*.6],[W*.40,H*.75],[W*.65,H*.55],[W*.85,H*.7]].forEach(([x,y])=>{
    ctx.beginPath();ctx.moveTo(x,y-30);ctx.lineTo(x-18,y+18);ctx.lineTo(x+18,y+18);ctx.closePath();ctx.fill();
    ctx.fillRect(x-3,y+18,6,20);
  });
}

const DISEASE_BG = {covid:bgCovid,flu:bgAirport,measles:bgMeasles,ebola:bgEbola,plague:bgPlague,custom:bgCustom};
const SCENARIO_BG = {residential:bgResidential,downtown:bgDowntown,airport:bgAirport,school:bgSchool,superspr:bgSuperspread,custom:bgCustom};

function drawMap(){
  const { size } = getParams();
  const W=mapCanvas.width,H=mapCanvas.height;
  mctx.clearRect(0,0,W,H);
  const bgFn = DISEASE_BG[activeDisease] || SCENARIO_BG[activeScenario] || bgCustom;
  bgFn(mctx,W,H);
  mctx.strokeStyle='rgba(255,255,255,0.45)';mctx.lineWidth=1;
  for(let gx=0;gx<=W;gx+=40){mctx.beginPath();mctx.moveTo(gx,0);mctx.lineTo(gx,H);mctx.stroke();}
  for(let gy=0;gy<=H;gy+=40){mctx.beginPath();mctx.moveTo(0,gy);mctx.lineTo(W,gy);mctx.stroke();}
  const domainW=100*size,domainH=58*size;
  const sc=Math.min(W/domainW,H/domainH);
  const offX=(W-domainW*sc)/2,offY=(H-domainH*sc)/2;
  const r=Math.max(3,Math.min(7,700/pop.length));
  pop.forEach(p=>{ drawPerson(mctx,offX+p.x*sc,offY+p.y*sc,r,p.state); });
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
      plugins:{
        legend:{position:'top',align:'end',labels:{boxWidth:12,boxHeight:12,usePointStyle:true,pointStyle:'circle',font:{size:12}}},
        tooltip:{titleFont:{size:12},bodyFont:{size:12}}
      }
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
  document.getElementById('m-S').textContent   = last.S;
  document.getElementById('m-E').textContent   = last.E;
  document.getElementById('m-I').textContent   = last.I;
  document.getElementById('m-R').textContent   = last.R;
  document.getElementById('m-S-pct').textContent = ((last.S/N)*100).toFixed(1)+'%';
  document.getElementById('m-E-pct').textContent = ((last.E/N)*100).toFixed(1)+'%';
  document.getElementById('m-R-pct').textContent = ((last.R/N)*100).toFixed(1)+'%';
  document.getElementById('m-peak').textContent  = peakI > 0 ? 'Peak: '+peakI+' (day '+peakDay+')' : '\u2014';

  // Transmission efficiency
  const teEl = document.getElementById('m-te');
  const teSubEl = document.getElementById('m-te-sub');
  if(transmissionEfficiency !== null){
    teEl.textContent = transmissionEfficiency.toFixed(2);
    teSubEl.textContent = 'secondary cases / case';
  } else {
    teEl.textContent = '\u2014';
    teSubEl.textContent = 'awaiting recoveries';
  }

  updateAlert(last, N);
}

function updateAlert(last, N){
  const panel = document.getElementById('alertPanel');
  const title = document.getElementById('alertTitle');
  const body  = document.getElementById('alertBody');
  const list  = document.getElementById('alertInterventions');
  const pctI  = last.I/N;
  const pctEI = (last.E+last.I)/N;

  let level,icon,t,b,interventions=[];
  if(!running && history.length<=1){
    level='green';icon='🟢';t='No active outbreak';
    b='Run the simulation to see real-time public health recommendations.';
  } else if(pctI===0 && last.day>1){
    level='green';icon='✅';t='Outbreak resolved';
    b='Epidemic ended on day '+last.day+'. '+last.R+' individuals recovered ('+((last.R/N)*100).toFixed(0)+'% of population exposed).';
  } else if(pctEI<0.05){
    level='green';icon='🟢';t='Containment phase — low activity';
    b='Transmission is limited. Early case detection and isolation is effective at this stage.';
    interventions=['Contact tracing','Case isolation','Targeted testing'];
  } else if(pctI<0.15&&pctEI<0.25){
    level='yellow';icon='⚠️';t='Moderate outbreak — intervention recommended';
    b='The outbreak is growing. Rapid action can still limit peak infection.';
    interventions=['Mask mandates','Social distancing','Close high-risk venues','Accelerate vaccination'];
  } else if(pctI<0.35){
    level='yellow';icon='🚨';t='Active community spread — urgent action needed';
    b='Significant community transmission underway. Healthcare capacity may be strained.';
    interventions=['Restrict gatherings','Remote work policy','School closures','Emergency capacity'];
  } else {
    level='red';icon='🔴';t='Critical — epidemic peak';
    b='Over '+(pctI*100).toFixed(0)+'% currently infectious. Immediate suppression required.';
    interventions=['Full lockdown','Field hospital deployment','Emergency supply mobilization','Mandatory quarantine'];
  }

  panel.className='alert-panel level-'+level;
  document.querySelector('.alert-icon').textContent=icon;
  title.textContent=t; body.textContent=b;
  list.innerHTML=interventions.map(i=>'<li>'+i+'</li>').join('');
}

function setStatus(state){
  const badge=document.getElementById('statusBadge');
  const statusEl=document.getElementById('m-status');
  const styles={
    ready:  {color:'#1d4ed8',bg:'#eaf1fd',text:'Ready',   sub:'Not started'},
    running:{color:'#0c7a3a',bg:'#eafaf0',text:'Running', sub:'Simulation running\u2026'},
    done:   {color:'#1d4ed8',bg:'#eaf1fd',text:'Complete',sub:'Epidemic resolved'}
  };
  const s=styles[state]||styles.ready;
  badge.style.color=s.color;badge.style.background=s.bg;
  badge.innerHTML=clockSVG()+' '+s.text;
  statusEl.textContent=s.sub;
}

function clockSVG(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; }
function playIconSVG(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'; }
function pauseIconSVG(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'; }

/* ============================================================
   RUN CONTROLS
   ============================================================ */
const btnRun   = document.getElementById('btnRun');
const btnReset = document.getElementById('btnReset');

function speedToMs(v){ return Math.max(50,650-Math.round(v)*60); }

function startRun(){
  if(running) return;
  if(history.length<=1||isFinished()) initPopulation();
  running=true; setStatus('running');
  btnRun.innerHTML=pauseIconSVG()+' Pause';
  tick();
}

function pauseRun(){
  running=false; clearInterval(timer);
  btnRun.innerHTML=playIconSVG()+' Resume';
}

function tick(){
  clearInterval(timer);
  timer=setInterval(()=>{
    if(!running) return;
    step(); drawMap(); updateChart(); updateMetrics();
    updateSituationAssessment();
    if(isFinished()){
      running=false; clearInterval(timer);
      setStatus('done');
      btnRun.innerHTML=playIconSVG()+' Run again';
      showSummary();
      updateSituationAssessment();
      showTimelineReplay();
      computeAndShowEpiSummary();
    }
  }, speedToMs(els.speed.value));
}

btnRun.addEventListener('click',()=>{ if(running) pauseRun(); else startRun(); });
btnReset.addEventListener('click',()=>{
  running=false; clearInterval(timer);
  document.getElementById('summaryCard').classList.remove('visible');
  resetSituationAssessment();
  hideTimelineAndSummary();
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML=playIconSVG()+' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
});

sliderIds.forEach(id=>{
  els[id].addEventListener('input',()=>{
    syncLabels();
    if(id!=='speed'){
      activeDisease='custom'; activeScenario='custom';
      highlightDisease('custom'); highlightScenario('custom');
      document.getElementById('diseaseLabel').textContent='Custom configuration';
      if(!running){
        running=false; clearInterval(timer);
        initPopulation(); drawMap(); updateChart(); updateMetrics();
        setStatus('ready'); btnRun.innerHTML=playIconSVG()+' Run simulation';
      }
    } else if(running){ tick(); }
  });
});

/* ============================================================
   DISEASE CARDS
   ============================================================ */
function buildDiseaseCards(){
  const grid=document.getElementById('diseaseGrid');
  DISEASES.forEach(d=>{
    const card=document.createElement('div');
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
  const d=DISEASES.find(x=>x.id===id);
  activeDisease=id; activeScenario='custom';
  currentDisease=d;
  highlightDisease(id); highlightScenario('custom');
  document.getElementById('diseaseLabel').textContent=d.name+(d.dualKernel?' (dual-kernel)':'');
  if(d.params) setSliders(d.params);
  updateDiseaseTimeline(d);
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML=playIconSVG()+' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
}

function updateDiseaseTimeline(d){
  const el=document.getElementById('diseaseTimeline');
  if(!el) return;
  el.innerHTML=`
    <div class="dtl-row"><span class="dtl-phase dtl-latent">Latent</span><span class="dtl-days">${d.incubationDays - d.presymptomaticDays} days — not infectious</span></div>
    <div class="dtl-row"><span class="dtl-phase dtl-presymp">Pre-symptomatic</span><span class="dtl-days">${d.presymptomaticDays} days — infectious, no symptoms</span></div>
    <div class="dtl-row"><span class="dtl-phase dtl-infectious">Infectious</span><span class="dtl-days">${d.infectiousDays} days — symptomatic &amp; infectious</span></div>
    <div class="dtl-note">${d.latencyRange}</div>
  `;
}

/* ============================================================
   SCENARIO CARDS
   ============================================================ */
function buildScenarioCards(){
  const grid=document.getElementById('scenarioGrid');
  SCENARIOS.forEach(sc=>{
    const card=document.createElement('div');
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
  const sc=SCENARIOS.find(s=>s.id===id);
  activeScenario=id; highlightScenario(id);
  if(sc.params){
    if(sc.params.N!==undefined) els.N.value=sc.params.N;
    if(sc.params.size!==undefined) els.size.value=sc.params.size;
    if(sc.params.Y0!==undefined) els.Y0.value=sc.params.Y0;
    syncLabels();
  }
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML=playIconSVG()+' Run simulation';
}

/* ============================================================
   SHOW MATH TOGGLE
   ============================================================ */
function toggleMath(){
  const panel=document.getElementById('mathPanel');
  const btn=document.getElementById('btnMath');
  const open=panel.classList.toggle('open');
  btn.textContent=open?'Hide mathematical model':'Show mathematical model';
}

/* ============================================================
   ACCORDION
   ============================================================ */
function toggleHow(i){
  const card=document.getElementById('howCard'+i);
  card.classList.toggle('open');
}

/* ============================================================
   SITUATION ASSESSMENT — Live Decision Support
   Five phases determined by current simulation state:
   Green  → Infectious <2%, TE<1
   Yellow → Infectious 2-10%, TE>1
   Orange → Infectious 10-25%, TE>1.5
   Red    → Infectious >25%
   Blue   → TE<1 AND infectious declining
   ============================================================ */

const PHASES = {
  idle: {
    key:'idle', label:'Awaiting simulation', dot:'#94a3b1',
    risk: null, action: null, consequence: null
  },
  green: {
    key:'green', label:'🟢 Green — Monitor',
    dot:'#16a34a',
    risk: '<strong>Low activity.</strong> Infectious cases remain below 2% of the population. Transmission efficiency is below 1 — each case is generating less than one secondary infection.',
    action: 'Maintain routine surveillance. Continue monitoring case counts and transmission metrics. No large-scale intervention is required at this stage. Use this window to ensure response plans are current and healthcare supplies are at adequate baseline levels.',
    consequence: 'If conditions change and no monitoring is in place, early warning signals may be missed. A low-activity outbreak can accelerate rapidly if transmission conditions change — particularly in dense household clusters.'
  },
  yellow: {
    key:'yellow', label:'🟡 Yellow — Early Intervention',
    dot:'#ca8a04',
    risk: '<strong>Growing outbreak.</strong> Infectious cases represent 2–10% of the population. Each case is generating more than one secondary infection — the outbreak is in an exponential growth phase. This is the most critical window for intervention.',
    action: 'Act now — this window closes quickly. Reduce gathering density in high-risk settings. Increase testing and contact tracing capacity. Begin preparing healthcare resources for surge demand. Communicate early with staff, suppliers, and stakeholders.',
    consequence: 'Without intervention during this phase, the outbreak will likely transition to Orange or Red within days. The cost of action now is significantly lower than the cost of reactive response at peak. Each day of delay allows transmission chains to multiply.'
  },
  orange: {
    key:'orange', label:'🟠 Orange — Accelerate Response',
    dot:'#ea580c',
    risk: '<strong>Significant community spread.</strong> 10–25% of the population is currently infectious. Transmission efficiency exceeds 1.5. Healthcare systems are beginning to experience elevated demand. The outbreak has moved past the early intervention window.',
    action: 'Restrict large gatherings and high-density events. Implement distancing measures in workplaces and public settings. Activate surge staffing plans and begin redistributing critical supplies. Escalate communication to leadership and external partners.',
    consequence: 'If the current trajectory continues unchecked, the outbreak will likely peak within the next 5–10 simulation days. Healthcare demand may exceed normal capacity. Supply shortages, staff burnout, and service disruption become increasingly probable.'
  },
  red: {
    key:'red', label:'🔴 Red — Emergency Response',
    dot:'#dc2626',
    risk: '<strong>Critical — peak or near-peak conditions.</strong> Over 25% of the population is simultaneously infectious. This represents maximum pressure on healthcare systems, supply chains, and operational continuity.',
    action: 'Mobilize all contingency resources immediately. Deploy field capacity if available. Implement aggressive mitigation — restrict movement, enforce isolation protocols, and activate emergency staffing agreements. Communicate a clear operational timeline to all stakeholders.',
    consequence: 'Without immediate action, healthcare demand will overwhelm normal capacity. Staff absence, supply exhaustion, and cascading service failures become probable. Recovery time after an unmitigated Red phase is substantially longer than after a contained outbreak.'
  },
  blue: {
    key:'blue', label:'🔵 Blue — Recovery Phase',
    dot:'#3b82f6',
    risk: '<strong>Outbreak contracting.</strong> Transmission efficiency has dropped below 1 and infectious cases are declining. The acute phase is resolving. Focus shifts from containment to recovery and restoration of normal operations.',
    action: 'Begin a controlled return to normal operations. Maintain monitoring — do not withdraw all measures simultaneously. Rebuild depleted stocks, address staff fatigue, and document lessons learned. Evaluate what interventions were most effective for future preparedness.',
    consequence: 'Premature withdrawal of all measures risks a secondary wave if residual transmission remains. A gradual, evidence-based return to normal is safer than a rapid reopening. Monitor transmission efficiency closely over the next 5–7 simulation days.'
  }
};

function getPhase(last, N, te, prevI){
  const pctI = last.I / N;
  const declining = prevI !== null && last.I < prevI;

  if(last.I === 0 && last.E === 0 && last.day > 0) return 'blue'; // resolved
  if(pctI > 0.25) return 'red';
  if(pctI > 0.10 && (te === null || te > 1.5)) return 'orange';
  if(pctI > 0.02 && (te === null || te > 1)) return 'yellow';
  if(te !== null && te < 1 && declining) return 'blue';
  if(pctI <= 0.02) return 'green';
  return 'yellow';
}

let prevI = null;

function updateSituationAssessment(){
  const last = history[history.length-1];
  const N = pop.length;
  const te = transmissionEfficiency;
  const phaseKey = getPhase(last, N, te, prevI);
  prevI = last.I;
  const phase = PHASES[phaseKey];

  const panel = document.getElementById('dsaPanel');
  // Remove all phase classes
  ['green','yellow','orange','red','blue','idle'].forEach(k => panel.classList.remove('phase-'+k));
  panel.classList.add('phase-'+phaseKey);

  document.getElementById('dsaPhaseLabel').textContent = phase.label;

  if(phaseKey === 'idle'){
    document.getElementById('dsaIdleState').style.display = 'block';
    document.getElementById('dsaActiveState').style.display = 'none';
    return;
  }

  document.getElementById('dsaIdleState').style.display = 'none';
  document.getElementById('dsaActiveState').style.display = 'block';

  document.getElementById('dsaDot1').style.background = phase.dot;
  document.getElementById('dsaRiskText').innerHTML = phase.risk;
  document.getElementById('dsaActionText').textContent = phase.action;
  document.getElementById('dsaConsequenceText').textContent = phase.consequence;

  // Key metrics row
  const attackRate = ((N - last.S) / N * 100).toFixed(1);
  document.getElementById('dsaMetrics').innerHTML = `
    <div class="dsa-metric"><span class="dm-val" style="color:var(--infected);">${last.I}</span><span class="dm-lbl">infectious now</span></div>
    <div class="dsa-metric"><span class="dm-val">${attackRate}%</span><span class="dm-lbl">attack rate</span></div>
    <div class="dsa-metric"><span class="dm-val" style="color:var(--accent-dark);">${te !== null ? te.toFixed(2) : '—'}</span><span class="dm-lbl">trans. efficiency</span></div>
    <div class="dsa-metric"><span class="dm-val">${last.day}</span><span class="dm-lbl">day</span></div>
  `;
}

function resetSituationAssessment(){
  prevI = null;
  ['green','yellow','orange','red','blue','idle'].forEach(k =>
    document.getElementById('dsaPanel').classList.remove('phase-'+k));
  document.getElementById('dsaPanel').classList.add('phase-idle');
  document.getElementById('dsaPhaseLabel').textContent = 'Awaiting simulation';
  document.getElementById('dsaIdleState').style.display = 'block';
  document.getElementById('dsaActiveState').style.display = 'none';
}


/* ============================================================
   TIMELINE REPLAY
   Reconstructs what decision-makers would have seen at any
   historical day. History array is never overwritten.
   ============================================================ */

let replayMarkerPlugin = null;
let replayDay = null;

function initReplaySlider(){
  const slider = document.getElementById('replaySlider');
  slider.addEventListener('input', () => {
    const day = parseInt(slider.value);
    replayDay = day;
    updateReplayView(day);
    updateChartMarker(day);
  });
}

function showTimelineReplay(){
  const panel = document.getElementById('timelinePanel');
  panel.classList.add('visible');
  const maxDay = history[history.length-1].day;
  const slider = document.getElementById('replaySlider');
  slider.max = maxDay;
  slider.value = maxDay;
  document.getElementById('replayMaxLabel').textContent = 'Day ' + maxDay;
  replayDay = maxDay;
  updateReplayView(maxDay);
  updateChartMarker(maxDay);
}

function updateReplayView(day){
  const h = history.find(x => x.day === day) || history[history.length-1];
  const N = pop.length;
  document.getElementById('replayDayLabel').textContent = day;
  document.getElementById('rp-S').textContent = h.S;
  document.getElementById('rp-E').textContent = h.E;
  document.getElementById('rp-I').textContent = h.I;
  document.getElementById('rp-R').textContent = h.R;
  document.getElementById('rp-S-pct').textContent = ((h.S/N)*100).toFixed(1)+'% of population';
  document.getElementById('rp-E-pct').textContent = ((h.E/N)*100).toFixed(1)+'% incubating';
  document.getElementById('rp-I-pct').textContent = ((h.I/N)*100).toFixed(1)+'% infectious';
  document.getElementById('rp-R-pct').textContent = ((h.R/N)*100).toFixed(1)+'% immune';

  // Reconstruct phase at that day
  const prevH = day > 0 ? (history.find(x => x.day === day-1) || h) : h;
  const teAtDay = computeTEAtDay(day);
  const phaseKey = getPhase(h, N, teAtDay, prevH.I);
  const phase = PHASES[phaseKey];

  const badge = document.getElementById('replayPhaseBadge');
  const rec   = document.getElementById('replayRec');
  const row   = document.getElementById('replayPhaseRow');

  // Phase background colours
  const phaseBg = {
    green:'#dcfce7', yellow:'#fef9c3', orange:'#ffedd5',
    red:'#fee2e2', blue:'#eff6ff', idle:'#f1f3f6'
  };
  const phaseText = {
    green:'#14532d', yellow:'#854d0e', orange:'#9a3412',
    red:'#991b1b', blue:'#1e40af', idle:'#6b7280'
  };

  badge.textContent = phase.label;
  badge.style.background = phaseBg[phaseKey] || '#f1f3f6';
  badge.style.color = phaseText[phaseKey] || '#6b7280';
  row.style.background = phaseBg[phaseKey] + '66' || '#f1f3f6';
  rec.textContent = phase.action || 'Awaiting simulation data.';
}

function computeTEAtDay(day){
  // Approximate TE from completed non-seed cases up to this day
  // Uses the infector tracking stored on pop
  const completedBefore = pop.filter(p => p.state === ST.R && !p.seedCase);
  if(completedBefore.length === 0) return null;
  const total = completedBefore.reduce((s,p) => s + p.secondaryCount, 0);
  return total / completedBefore.length;
}

/* ============================================================
   CHART VERTICAL MARKER (day line)
   ============================================================ */

function updateChartMarker(day){
  if(!chart) return;
  // Remove existing annotation dataset if present
  const existing = chart.data.datasets.findIndex(d => d._isMarker);
  if(existing >= 0) chart.data.datasets.splice(existing,1);

  // Add a vertical line as a scatter point pair dataset
  const N = pop.length;
  const maxY = N * 1.05;
  chart.data.datasets.push({
    _isMarker: true,
    label: 'Day ' + day,
    data: [{x: day, y: 0}, {x: day, y: maxY}],
    borderColor: '#374151',
    backgroundColor: '#374151',
    borderWidth: 1.5,
    borderDash: [4,3],
    pointRadius: 0,
    tension: 0,
    type: 'line',
    parsing: false,
    order: 0
  });
  chart.update('none');
}

function clearChartMarker(){
  if(!chart) return;
  const idx = chart.data.datasets.findIndex(d => d._isMarker);
  if(idx >= 0){ chart.data.datasets.splice(idx,1); chart.update('none'); }
}

/* ============================================================
   EPIDEMIC SUMMARY
   Summary statistics suitable for likelihood-free inference
   ============================================================ */

function computeAndShowEpiSummary(){
  const N = pop.length;
  const last = history[history.length-1];

  // Peak
  const peakEntry = history.reduce((best,h) => h.I > best.I ? h : best, history[0]);

  // Attack rate
  const attackRate = ((N - last.S) / N * 100);

  // Duration (last day with I>0)
  const lastActiveDay = [...history].reverse().find(h => h.I > 0 || h.E > 0);
  const duration = lastActiveDay ? lastActiveDay.day : last.day;

  // Early growth rate (log-linear fit on days 1-peak where I>0)
  let doublingTime = null;
  let growthRate = null;
  const growthPhase = history.filter(h => h.day >= 1 && h.day <= peakEntry.day && h.I > 2);
  if(growthPhase.length >= 4){
    // Simple linear regression on log(I) vs day
    const xs = growthPhase.map(h => h.day);
    const ys = growthPhase.map(h => Math.log(h.I));
    const n = xs.length;
    const xbar = xs.reduce((a,b)=>a+b,0)/n;
    const ybar = ys.reduce((a,b)=>a+b,0)/n;
    const num = xs.reduce((s,x,i)=>s+(x-xbar)*(ys[i]-ybar),0);
    const den = xs.reduce((s,x)=>s+(x-xbar)**2,0);
    if(den > 0){
      growthRate = num/den;
      doublingTime = growthRate > 0 ? (Math.log(2)/growthRate) : null;
    }
  }

  // Time above emergency threshold (I > 25% of N)
  const emergencyDays = history.filter(h => h.I/N > 0.25).length;

  // Phase history for summary
  const phaseCounts = {green:0,yellow:0,orange:0,red:0,blue:0};
  history.forEach((h,idx) => {
    const prev = idx > 0 ? history[idx-1] : h;
    const k = getPhase(h, N, transmissionEfficiency, prev.I);
    if(phaseCounts[k] !== undefined) phaseCounts[k]++;
  });

  // Render
  const d = currentDisease;
  document.getElementById('esSub').textContent =
    d.name + ' · ' + N + ' individuals · completed day ' + last.day;

  const stats = [
    { label:'Peak infectious', value: peakEntry.I + ' individuals', sub:'on day ' + peakEntry.day },
    { label:'Final attack rate', value: attackRate.toFixed(1) + '%', sub: Math.round(N - last.S) + ' of ' + N + ' individuals' },
    { label:'Outbreak duration', value: duration + ' days', sub:'until no active cases' },
    { label:'Early growth rate', value: growthRate !== null ? growthRate.toFixed(3) + '/day' : 'N/A', sub:'log-linear fit, pre-peak' },
    { label:'Doubling time', value: doublingTime !== null ? doublingTime.toFixed(1) + ' days' : 'N/A', sub:'ln(2) / growth rate' },
    { label:'Time above 25% threshold', value: emergencyDays + ' days', sub:'Emergency / Red phase duration' },
    { label:'Transmission efficiency', value: transmissionEfficiency !== null ? transmissionEfficiency.toFixed(2) : 'N/A', sub:'mean secondary cases / case' },
    { label:'Individuals escaped', value: last.S, sub: ((last.S/N)*100).toFixed(1) + '% never infected' }
  ];

  document.getElementById('epiStatsGrid').innerHTML = stats.map(s => `
    <div class="es-stat">
      <p class="ess-label">${s.label}</p>
      <p class="ess-value">${s.value}</p>
      <p class="ess-sub">${s.sub}</p>
    </div>
  `).join('');

  document.getElementById('epiSummary').classList.add('visible');
}

function hideTimelineAndSummary(){
  document.getElementById('timelinePanel').classList.remove('visible');
  document.getElementById('epiSummary').classList.remove('visible');
  clearChartMarker();
  replayDay = null;
}

/* ============================================================
   OUTBREAK SUMMARY CARD
   ============================================================ */
function showSummary(){
  const N = pop.length;
  const last = history[history.length-1];
  const totalInfected = last.R + last.I; // recovered + still infectious
  const attackRate = ((N - last.S) / N * 100).toFixed(1);
  const escaped = last.S;
  const d = currentDisease;

  document.getElementById('sum-N').textContent = N;
  document.getElementById('sum-disease').textContent = d.name + (d.dualKernel ? ' (dual-kernel)' : '');
  document.getElementById('sum-attack').textContent = attackRate + '%';
  document.getElementById('sum-peak').textContent = peakI;
  document.getElementById('sum-peak-day').textContent = 'on day ' + peakDay;
  document.getElementById('sum-duration').textContent = last.day;
  document.getElementById('sum-escaped').textContent = escaped;
  document.getElementById('sum-te').textContent = transmissionEfficiency !== null
    ? transmissionEfficiency.toFixed(2)
    : 'N/A';

  const scenario = SCENARIOS.find(s => s.id === activeScenario);
  const scenarioLabel = scenario ? scenario.title : 'Custom';
  document.getElementById('summarySubtitle').textContent =
    d.name + ' · ' + scenarioLabel + ' · ' + N + ' individuals · day ' + last.day;

  document.getElementById('summaryCard').classList.add('visible');
  document.getElementById('summaryCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.getElementById('btnExportPng').addEventListener('click',()=>{
  const a=document.createElement('a');a.href=chart.toBase64Image();a.download='epidemic-curve.png';a.click();
});
document.getElementById('btnExportCsv').addEventListener('click',()=>{
  let csv='day,susceptible,exposed,infectious,recovered\n';
  history.forEach(h=>{csv+=`${h.day},${h.S},${h.E},${h.I},${h.R}\n`;});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='epidemic-data.csv';a.click();
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
  updateDiseaseTimeline(currentDisease);
  initChart();
  initPopulation();
  drawMap();
  updateChart();
  updateMetrics();
  setStatus('ready');
  btnRun.innerHTML=playIconSVG()+' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
}

init();
initReplaySlider();
