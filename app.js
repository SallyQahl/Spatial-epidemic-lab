/* =========================================================================
   Spatial Epidemic Research Lab — Version 1.1
   Model: Spatial SEIR Individual-Level Model (ILM)

   Key improvements over v1.0:
   - Household spatial clustering (no multiplier — spatial kernel handles it)
   - Disease-specific day counters replacing geometric recovery
   - Presymptomatic infectious window within E state
   - Deterministic infectious period (no memoryless geometric distribution)
   - Infector ID tracking with seed case exclusion
   - Transmission Efficiency metric (empirical secondary cases, correct denominator)
   - Show Math toggle panel

   Transmission: P(S→E) = 1 - exp(-(β/N) × Σ d_ij^-α)
     COVID-19 dual-kernel: P(S→E) = 1 - exp(-(β/N) × Σ [0.5·d^-0.8 + 0.5·d^-2.5])
   Latency:     E is non-infectious for incubationDays - presymptomaticDays,
                then infectious for presymptomaticDays
   Recovery:    I is infectious for exactly infectiousDays, then recovers
   ========================================================================= */

const COLORS = { S:'#16a34a', E:'#d97706', I:'#dc2626', R:'#7c3aed' };
const ST = { S:0, E:1, I:2, R:3 };

/* ---- Disease definitions ---- */
const DISEASES = [
  {
    id: 'covid', emoji: '🦠', name: 'COVID-19', sub: 'Moderate, multi-route',
    incubationDays: 5,       // days before any infectiousness
    presymptomaticDays: 2,   // infectious while still in E state
    infectiousDays: 8,       // days in I state before recovery
    dualKernel: true,
    params: { N:300, beta:95, alpha:1.3, Y0:3, size:1.0 },
    bgColor: '#fef3e2'
  },
  {
    id: 'flu', emoji: '🤧', name: 'Influenza', sub: 'Fast spread, fast recovery',
    incubationDays: 2,
    presymptomaticDays: 1,
    infectiousDays: 5,
    dualKernel: false,
    params: { N:300, beta:110, alpha:1.4, Y0:2, size:1.0 },
    bgColor: '#eef3f8'
  },
  {
    id: 'measles', emoji: '💨', name: 'Measles', sub: 'Highly airborne, slow recovery',
    incubationDays: 10,
    presymptomaticDays: 4,
    infectiousDays: 8,
    dualKernel: false,
    params: { N:300, beta:160, alpha:0.9, Y0:1, size:1.0 },
    bgColor: '#fdf4ff'
  },
  {
    id: 'ebola', emoji: '🩸', name: 'Ebola', sub: 'Close contact only, severe',
    incubationDays: 10,
    presymptomaticDays: 0,   // not contagious before symptoms
    infectiousDays: 10,
    dualKernel: false,
    params: { N:300, beta:38, alpha:2.8, Y0:2, size:1.0 },
    bgColor: '#fff1f2'
  },
  {
    id: 'plague', emoji: '🐀', name: 'Bubonic Plague', sub: 'Clustered, historical',
    incubationDays: 4,
    presymptomaticDays: 0,
    infectiousDays: 6,
    dualKernel: false,
    params: { N:300, beta:65, alpha:2.2, Y0:2, size:1.0 },
    bgColor: '#f0fdf4'
  },
  {
    id: 'custom', emoji: '⚙️', name: 'Custom', sub: 'Configure manually',
    incubationDays: 4,
    presymptomaticDays: 1,
    infectiousDays: 7,
    dualKernel: false,
    params: null,
    bgColor: '#f4f6f8'
  }
];

/* ---- Setting presets — spatial/population only ---- */
const SCENARIOS = [
  { id:'residential', icon:'home',     title:'Residential',   desc:'Spread-out households.',  params:{ N:300, size:1.2, Y0:2 } },
  { id:'downtown',    icon:'building', title:'Downtown core', desc:'Dense, frequent contact.', params:{ N:450, size:0.7, Y0:3 } },
  { id:'airport',     icon:'plane',    title:'Airport',       desc:'High long-range mixing.',  params:{ N:350, size:1.4, Y0:4 } },
  { id:'school',      icon:'school',   title:'School',        desc:'Tight clusters.',          params:{ N:250, size:0.6, Y0:2 } },
  { id:'superspr',    icon:'flame',    title:'Super-spreader',desc:'High transmission event.', params:{ N:300, size:0.8, Y0:12} },
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

/* ---- State ---- */
let pop = [];
let history = [];
let timer = null;
let running = false;
let activeDisease = 'custom';
let activeScenario = 'custom';
let currentDiseaseDef = DISEASES.find(d => d.id === 'custom');

// Secondary infection tracking
let secondaryCount = {};  // secondaryCount[personId] = count of people they infected
let peakI = 0, peakDay = 0;

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
    N: Math.round(+els.N.value),
    beta: +els.beta.value,
    alpha: +els.alpha.value,
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
   HOUSEHOLD CLUSTERING
   Generate household centers, place members around each center.
   No transmission multiplier — the spatial kernel handles it.
   ============================================================ */
function generateHouseholdPopulation(N, size){
  const W = 100 * size, H = 58 * size;
  const householdSize = 4;
  const nHouseholds = Math.ceil(N / householdSize);
  const spread = Math.max(1.5, W * 0.025); // noise radius around household center

  const people = [];
  let id = 0;
  for(let h = 0; h < nHouseholds && id < N; h++){
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    const membersInHouse = Math.min(householdSize, N - id);
    for(let m = 0; m < membersInHouse; m++){
      // place member with Gaussian-like noise around household center
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spread;
      people.push({
        id: id,
        x: Math.max(0, Math.min(W, cx + Math.cos(angle) * dist)),
        y: Math.max(0, Math.min(H, cy + Math.sin(angle) * dist)),
        state: ST.S,
        householdId: h,
        daysInE: 0,         // days spent in Exposed state
        daysInI: 0,         // days spent in Infectious state
        seedCase: false,    // true if injected at day 0 (excluded from metric)
        infectedBy: null    // id of infector (null if seed or uninfected)
      });
      id++;
    }
  }
  return people;
}

/* ============================================================
   SEIR SIMULATION
   ============================================================ */

function initPopulation(){
  const { N, Y0, size } = getParams();
  pop = generateHouseholdPopulation(N, size);
  secondaryCount = {};
  peakI = 0; peakDay = 0;

  // Seed initial infections — flag as seed cases, excluded from metric
  const seeds = new Set();
  while(seeds.size < Math.min(Y0, N)) seeds.add(Math.floor(Math.random() * N));
  seeds.forEach(i => {
    pop[i].state = ST.I;
    pop[i].daysInI = 0;
    pop[i].seedCase = true;
    secondaryCount[i] = 0;
  });

  history = [];
  recordHistory(0);
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

function isPresymptomaticInfectious(person){
  // In E state, infectious only during the presymptomatic window
  const d = currentDiseaseDef;
  const silentDays = d.incubationDays - d.presymptomaticDays;
  return person.state === ST.E && person.daysInE >= silentDays;
}

function step(){
  const { beta, alpha } = getParams();
  const N = pop.length;
  const d = currentDiseaseDef;

  // Build infectious set: I individuals + presymptomatic E individuals
  const infectious = pop.filter(p =>
    p.state === ST.I || isPresymptomaticInfectious(p)
  );

  // S → E (exposure)
  const newlyExposed = [];
  for(let i = 0; i < N; i++){
    const p = pop[i];
    if(p.state !== ST.S) continue;
    let force = 0;
    if(currentDiseaseDef.dualKernel){
      for(const inf of infectious){
        const dx = p.x-inf.x, dy = p.y-inf.y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 0.001;
        force += 0.5*Math.pow(dist,-0.8) + 0.5*Math.pow(dist,-2.5);
      }
    } else {
      for(const inf of infectious){
        const dx = p.x-inf.x, dy = p.y-inf.y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 0.001;
        force += Math.pow(dist,-alpha);
      }
    }
    const prob = 1 - Math.exp(-(beta/N)*force);
    if(Math.random() < prob){
      // Pick one infector proportional to their contribution
      let infectorId = null;
      if(infectious.length > 0){
        // weighted random selection
        const contributions = infectious.map(inf => {
          const dx = p.x-inf.x, dy = p.y-inf.y;
          const dist = Math.sqrt(dx*dx+dy*dy) || 0.001;
          return currentDiseaseDef.dualKernel
            ? 0.5*Math.pow(dist,-0.8) + 0.5*Math.pow(dist,-2.5)
            : Math.pow(dist,-alpha);
        });
        const total = contributions.reduce((a,b)=>a+b,0);
        let r = Math.random() * total;
        for(let k=0; k<infectious.length; k++){
          r -= contributions[k];
          if(r <= 0){ infectorId = infectious[k].id; break; }
        }
        if(infectorId === null) infectorId = infectious[infectious.length-1].id;
      }
      newlyExposed.push({ idx: i, infectorId });
    }
  }

  // E → I (after full incubation period)
  const newlyInfectious = [];
  pop.forEach((p, i) => {
    if(p.state === ST.E){
      p.daysInE++;
      if(p.daysInE >= d.incubationDays) newlyInfectious.push(i);
    }
  });

  // I → R (after fixed infectious period — deterministic, not geometric)
  const newlyRecovered = [];
  pop.forEach((p, i) => {
    if(p.state === ST.I){
      p.daysInI++;
      if(p.daysInI >= d.infectiousDays) newlyRecovered.push(i);
    }
  });

  // Apply transitions
  newlyRecovered.forEach(i => { pop[i].state = ST.R; });
  newlyInfectious.forEach(i => {
    pop[i].state = ST.I;
    pop[i].daysInI = 0;
    if(secondaryCount[i] === undefined) secondaryCount[i] = 0;
  });
  newlyExposed.forEach(({ idx, infectorId }) => {
    pop[idx].state = ST.E;
    pop[idx].daysInE = 0;
    pop[idx].infectedBy = infectorId;
    if(infectorId !== null){
      if(secondaryCount[infectorId] === undefined) secondaryCount[infectorId] = 0;
      secondaryCount[infectorId]++;
    }
  });

  recordHistory(history.length);
}

function isFinished(){
  const last = history[history.length-1];
  return (last.I === 0 && last.E === 0) || history.length > 300;
}

/* ============================================================
   TRANSMISSION EFFICIENCY METRIC
   Mean secondary infections per completed non-seed case.
   Denominator: all recovered individuals who were NOT seed cases.
   ============================================================ */
function computeTransmissionEfficiency(){
  const completedNonSeed = pop.filter(p =>
    p.state === ST.R && !p.seedCase
  );
  if(completedNonSeed.length === 0) return null;
  const total = completedNonSeed.reduce((sum, p) => {
    return sum + (secondaryCount[p.id] || 0);
  }, 0);
  return total / completedNonSeed.length;
}

/* ============================================================
   CANVAS — background per scenario
   ============================================================ */
const mapCanvas = document.getElementById('mapCanvas');
const mctx = mapCanvas.getContext('2d');

function drawPerson(ctx, px, py, r, state){
  ctx.fillStyle = COLORS[['S','E','I','R'][state]];
  ctx.globalAlpha = 0.88;
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

function bgResidential(ctx,W,H){
  ctx.fillStyle='#dbe5f0';const bY=H*.82;
  [{x:W*.07,w:90,h:68,rf:38},{x:W*.23,w:70,h:52,rf:28},{x:W*.42,w:100,h:78,rf:44},{x:W*.62,w:75,h:58,rf:32},{x:W*.80,w:92,h:70,rf:40}].forEach(b=>{
    ctx.fillRect(b.x,bY-b.h,b.w,b.h);ctx.beginPath();ctx.moveTo(b.x-8,bY-b.h);ctx.lineTo(b.x+b.w/2,bY-b.h-b.rf);ctx.lineTo(b.x+b.w+8,bY-b.h);ctx.closePath();ctx.fill();
  });ctx.fillRect(0,bY,W,H-bY);
}
function bgDowntown(ctx,W,H){
  ctx.fillStyle='#d3dde8';const bY=H*.88;
  [{x:W*.04,w:60,h:180},{x:W*.13,w:80,h:240},{x:W*.26,w:55,h:148},{x:W*.36,w:95,h:275},{x:W*.50,w:65,h:198},{x:W*.61,w:85,h:255},{x:W*.74,w:60,h:168},{x:W*.85,w:90,h:228}].forEach(b=>{
    const h=Math.min(b.h,bY-10);ctx.fillRect(b.x,bY-h,b.w,h);
  });ctx.fillRect(0,bY,W,H-bY);
  ctx.fillStyle='#bccddc';
  [{x:W*.04,w:60,h:180},{x:W*.13,w:80,h:240},{x:W*.26,w:55,h:148},{x:W*.36,w:95,h:275},{x:W*.50,w:65,h:198},{x:W*.61,w:85,h:255},{x:W*.74,w:60,h:168},{x:W*.85,w:90,h:228}].forEach(b=>{
    const h=Math.min(b.h,bY-10);
    for(let wy=bY-h+14;wy<bY-10;wy+=22) for(let wx=b.x+10;wx<b.x+b.w-8;wx+=18) ctx.fillRect(wx,wy,8,12);
  });
}
function bgAirport(ctx,W,H){
  ctx.fillStyle='#dbe5f0';const bY=H*.78;ctx.fillRect(0,bY,W,H-bY);
  ctx.strokeStyle='#bccddc';ctx.lineWidth=4;ctx.setLineDash([28,22]);
  ctx.beginPath();ctx.moveTo(0,H-(H-bY)/2);ctx.lineTo(W,H-(H-bY)/2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#c7d6e6';ctx.fillRect(W*.30,bY-70,W*.40,70);
  ctx.beginPath();ctx.moveTo(W*.30,bY-70);ctx.lineTo(W*.50,bY-100);ctx.lineTo(W*.70,bY-70);ctx.closePath();ctx.fill();
}
function bgSchool(ctx,W,H){
  ctx.fillStyle='#dbe5f0';const bY=H*.85;ctx.fillRect(0,bY,W,H-bY);
  ctx.fillStyle='#c7d6e6';const bx=W*.28,bw=W*.44,bh=148;
  ctx.fillRect(bx,bY-bh,bw,bh);ctx.beginPath();ctx.moveTo(bx-14,bY-bh);ctx.lineTo(bx+bw/2,bY-bh-46);ctx.lineTo(bx+bw+14,bY-bh);ctx.closePath();ctx.fill();
  ctx.fillRect(bx+bw/2-6,bY-bh-68,12,24);
  ctx.fillStyle='#aec1d4';
  for(let wx=bx+16;wx<bx+bw-16;wx+=34){ctx.fillRect(wx,bY-bh+24,18,26);ctx.fillRect(wx,bY-bh+68,18,26);}
  ctx.fillRect(bx+bw/2-14,bY-48,28,48);
}
function bgSuperspread(ctx,W,H){
  ctx.fillStyle='#f6dada';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#e8bcbc';ctx.lineWidth=2;
  for(let r=40;r<Math.max(W,H);r+=50){ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();}
}
function bgCustom(ctx,W,H){
  ctx.fillStyle='#e6eaee';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#cdd4dc';ctx.lineWidth=1;
  for(let x=0;x<=W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<=H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='#bcc7d2';ctx.lineWidth=2;
  [50,90,130].forEach(r=>{ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();});
}
function bgCovid(ctx,W,H){
  ctx.fillStyle='#faebd0';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#f0d0a0';ctx.lineWidth=1.5;
  for(let r=30;r<Math.max(W,H);r+=40){ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.stroke();}
}
function bgMeasles(ctx,W,H){
  ctx.fillStyle='#f3e8ff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#e8d0f8';
  for(let i=0;i<18;i++){ctx.beginPath();ctx.arc(Math.sin(i*2.8)*W*.38+W/2,Math.cos(i*1.9)*H*.35+H/2,12,0,Math.PI*2);ctx.fill();}
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

const DISEASE_BG  = { covid:bgCovid, flu:bgAirport, measles:bgMeasles, ebola:bgEbola, plague:bgPlague, custom:bgCustom };
const SCENARIO_BG = { residential:bgResidential, downtown:bgDowntown, airport:bgAirport, school:bgSchool, superspr:bgSuperspread, custom:bgCustom };

function drawMap(){
  const { size } = getParams();
  const W=mapCanvas.width, H=mapCanvas.height;
  mctx.clearRect(0,0,W,H);
  const bgFn = DISEASE_BG[activeDisease] || SCENARIO_BG[activeScenario] || bgCustom;
  bgFn(mctx,W,H);
  mctx.strokeStyle='rgba(255,255,255,0.45)';mctx.lineWidth=1;
  for(let gx=0;gx<=W;gx+=40){mctx.beginPath();mctx.moveTo(gx,0);mctx.lineTo(gx,H);mctx.stroke();}
  for(let gy=0;gy<=H;gy+=40){mctx.beginPath();mctx.moveTo(0,gy);mctx.lineTo(W,gy);mctx.stroke();}
  const domainW=100*size, domainH=58*size;
  const sc=Math.min(W/domainW,H/domainH);
  const offX=(W-domainW*sc)/2, offY=(H-domainH*sc)/2;
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
        {label:'Susceptible', data:[],borderColor:COLORS.S,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2},
        {label:'Exposed',     data:[],borderColor:COLORS.E,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2},
        {label:'Infectious',  data:[],borderColor:COLORS.I,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2},
        {label:'Recovered',   data:[],borderColor:COLORS.R,backgroundColor:'transparent',tension:0.25,pointRadius:0,borderWidth:2}
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
  document.getElementById('m-S').textContent = last.S;
  document.getElementById('m-E').textContent = last.E;
  document.getElementById('m-I').textContent = last.I;
  document.getElementById('m-R').textContent = last.R;
  document.getElementById('m-S-pct').textContent = ((last.S/N)*100).toFixed(1)+'% of population';
  document.getElementById('m-E-pct').textContent = ((last.E/N)*100).toFixed(1)+'% incubating';
  document.getElementById('m-R-pct').textContent = ((last.R/N)*100).toFixed(1)+'% immune';
  document.getElementById('m-peak').textContent = peakI>0?'Peak: '+peakI+' on day '+peakDay:'\u2014';

  // Transmission efficiency
  const te = computeTransmissionEfficiency();
  const teEl = document.getElementById('m-te');
  const teSubEl = document.getElementById('m-te-sub');
  if(te !== null){
    teEl.textContent = te.toFixed(2);
    teSubEl.textContent = te > 1 ? 'Epidemic growing' : te > 0.5 ? 'Slowing down' : 'Near extinction';
  } else {
    teEl.textContent = '\u2014';
    teSubEl.textContent = 'No completed cases yet';
  }

  updateAlert(last, N);
}

function updateAlert(last, N){
  const panel=document.getElementById('alertPanel');
  const title=document.getElementById('alertTitle');
  const body=document.getElementById('alertBody');
  const list=document.getElementById('alertInterventions');
  const pctI=last.I/N, pctEI=(last.E+last.I)/N;
  let level,icon,t,b,interventions=[];
  if(!running && history.length<=1){
    level='green';icon='🟢';t='No active outbreak';b='Run the simulation to see real-time recommendations.';
  } else if(pctI===0 && last.day>1){
    level='green';icon='✅';t='Outbreak resolved';
    b=`Epidemic ended on day ${last.day}. ${last.R} individuals recovered (${((last.R/N)*100).toFixed(0)}% of population).`;
  } else if(pctEI<0.05){
    level='green';icon='🟢';t='Containment phase — low activity';
    b='Transmission is limited. Early detection effective at this stage.';
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
    b=`Over ${(pctI*100).toFixed(0)}% currently infectious. Healthcare overload likely.`;
    interventions=['Full lockdown','Field hospital deployment','Emergency supply mobilization','Mandatory quarantine'];
  }
  panel.className='alert-panel level-'+level;
  document.querySelector('.alert-icon').textContent=icon;
  title.textContent=t;body.textContent=b;
  list.innerHTML=interventions.map(i=>`<li>${i}</li>`).join('');
}

function setStatus(state){
  const badge=document.getElementById('statusBadge');
  const statusEl=document.getElementById('m-status');
  const S={ready:{c:'#1d4ed8',bg:'#eaf1fd',t:'Ready',s:'Not started'},running:{c:'#0c7a3a',bg:'#eafaf0',t:'Running',s:'Simulation running\u2026'},done:{c:'#1d4ed8',bg:'#eaf1fd',t:'Complete',s:'Epidemic resolved'}};
  const s=S[state]||S.ready;
  badge.style.color=s.c;badge.style.background=s.bg;
  badge.innerHTML=clockSVG()+' '+s.t;statusEl.textContent=s.s;
}

function clockSVG(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; }
function playSVG(){  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'; }
function pauseSVG(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'; }

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
  btnRun.innerHTML=pauseSVG()+' Pause';
  tick();
}

function pauseRun(){
  running=false; clearInterval(timer);
  btnRun.innerHTML=playSVG()+' Resume';
}

function tick(){
  clearInterval(timer);
  timer=setInterval(()=>{
    if(!running) return;
    step(); drawMap(); updateChart(); updateMetrics();
    if(isFinished()){
      running=false; clearInterval(timer);
      setStatus('done');
      btnRun.innerHTML=playSVG()+' Run again';
      updateMetrics();
    }
  }, speedToMs(els.speed.value));
}

btnRun.addEventListener('click',()=>{ if(running) pauseRun(); else startRun(); });
btnReset.addEventListener('click',()=>{
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML=playSVG()+' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
});

sliderIds.forEach(id=>{
  els[id].addEventListener('input',()=>{
    syncLabels();
    if(id!=='speed'){
      activeDisease='custom'; activeScenario='custom';
      highlightDisease('custom'); highlightScenario('custom');
      document.getElementById('diseaseLabel').textContent='Custom configuration';
      currentDiseaseDef=DISEASES.find(d=>d.id==='custom');
      if(!running){ running=false;clearInterval(timer);initPopulation();drawMap();updateChart();updateMetrics();setStatus('ready');btnRun.innerHTML=playSVG()+' Run simulation'; }
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
    card.className='disease-card';card.dataset.id=d.id;
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
  currentDiseaseDef=d;
  highlightDisease(id); highlightScenario('custom');
  document.getElementById('diseaseLabel').textContent=d.name+(d.dualKernel?' (dual-kernel)':'');
  updateMathPanel(d);
  if(d.params) setSliders(d.params);
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML=playSVG()+' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
}

/* ============================================================
   SCENARIO CARDS
   ============================================================ */
function buildScenarioCards(){
  const grid=document.getElementById('scenarioGrid');
  SCENARIOS.forEach(sc=>{
    const card=document.createElement('div');
    card.className='scenario-card';card.dataset.id=sc.id;
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
    if(sc.params.N    !==undefined) els.N.value   =sc.params.N;
    if(sc.params.size !==undefined) els.size.value=sc.params.size;
    if(sc.params.Y0   !==undefined) els.Y0.value  =sc.params.Y0;
    syncLabels();
  }
  running=false; clearInterval(timer);
  initPopulation(); drawMap(); updateChart(); updateMetrics();
  setStatus('ready'); btnRun.innerHTML=playSVG()+' Run simulation';
}

/* ============================================================
   SHOW MATH PANEL
   ============================================================ */
function updateMathPanel(d){
  const el=document.getElementById('mathDiseaseTimeline');
  if(!el) return;
  el.innerHTML=`
    <tr><td style="padding:6px 12px;">Incubation (silent)</td><td style="padding:6px 12px;font-weight:600;">${d.incubationDays - d.presymptomaticDays} days</td><td style="padding:6px 12px;color:var(--text-tertiary);">In E state, not yet contagious</td></tr>
    <tr><td style="padding:6px 12px;">Presymptomatic spread</td><td style="padding:6px 12px;font-weight:600;">${d.presymptomaticDays} days</td><td style="padding:6px 12px;color:var(--text-tertiary);">In E state, contagious — silent spread window</td></tr>
    <tr><td style="padding:6px 12px;">Infectious period</td><td style="padding:6px 12px;font-weight:600;">${d.infectiousDays} days</td><td style="padding:6px 12px;color:var(--text-tertiary);">In I state, contagious — deterministic duration</td></tr>
    <tr><td style="padding:6px 12px;">Total disease course</td><td style="padding:6px 12px;font-weight:600;">${d.incubationDays + d.infectiousDays} days</td><td style="padding:6px 12px;color:var(--text-tertiary);">E + I before recovery</td></tr>
  `;
}

/* ============================================================
   EXPORT
   ============================================================ */
document.getElementById('btnExportPng').addEventListener('click',()=>{
  const a=document.createElement('a');a.href=chart.toBase64Image();a.download='epidemic-curve.png';a.click();
});
document.getElementById('btnExportCsv').addEventListener('click',()=>{
  let csv='day,susceptible,exposed,infectious,recovered\n';
  history.forEach(h=>{csv+=`${h.day},${h.S},${h.E},${h.I},${h.R}\n`;});
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
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
  initChart();
  initPopulation();
  drawMap();
  updateChart();
  updateMetrics();
  setStatus('ready');
  btnRun.innerHTML=playSVG()+' Run simulation';
  updateAlert({S:pop.length,E:0,I:0,R:0},pop.length);
  updateMathPanel(currentDiseaseDef);
}

init();
