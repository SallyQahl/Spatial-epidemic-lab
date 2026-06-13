/* =========================================================================
   Spatial Epidemic Research Lab
   Stochastic spatial individual-level model (ILM):
     P(infection) = 1 - exp( -(beta/N) * sum_j kernel(d_ij) )  where kernel = d^-alpha
     P(recovery)  = gamma   per infectious individual per day

   Note: the force of infection is normalized by population size N. Without
   this, the sum over all infectious individuals grows with N and with low
   alpha (slow spatial decay), causing the infection probability to saturate
   to ~1 for nearly everyone within one or two days. Normalizing keeps beta's
   meaning ("average transmission intensity") roughly comparable across
   different population sizes and domain sizes.
   ========================================================================= */

const COLORS = {
  healthy:   '#16a34a',
  infected:  '#dc2626',
  recovered: '#7c3aed'
};

const STATE = { S: 0, I: 1, R: 2 };

const SCENARIOS = [
  {
    id: 'residential',
    icon: 'home',
    title: 'Residential area',
    desc: 'Spread-out households, moderate contact.',
    params: { N: 300, beta: 85, alpha: 1.8, gamma: 0.12, Y0: 2, size: 1.2 }
  },
  {
    id: 'downtown',
    icon: 'building',
    title: 'Downtown core',
    desc: 'Dense population, frequent close contact.',
    params: { N: 450, beta: 110, alpha: 1.2, gamma: 0.10, Y0: 3, size: 0.7 }
  },
  {
    id: 'airport',
    icon: 'plane',
    title: 'Airport',
    desc: 'High mixing across long distances.',
    params: { N: 350, beta: 60, alpha: 1.4, gamma: 0.15, Y0: 4, size: 1.4 }
  },
  {
    id: 'school',
    icon: 'school',
    title: 'School',
    desc: 'Tight clusters of contact, fast recovery.',
    params: { N: 250, beta: 100, alpha: 1.6, gamma: 0.18, Y0: 2, size: 0.6 }
  },
  {
    id: 'superspread',
    icon: 'flame',
    title: 'Super-spreader event',
    desc: 'Many initial cases, very high transmission.',
    params: { N: 300, beta: 160, alpha: 1.3, gamma: 0.10, Y0: 12, size: 0.8 }
  },
  {
    id: 'custom',
    icon: 'target',
    title: 'Custom placement',
    desc: 'Use the sliders to define your own scenario.',
    params: null
  }
];

const ICONS = {
  home:     '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>',
  building: '<rect x="4" y="2" width="16" height="20" rx="1"></rect><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="15" y2="18"></line>',
  plane:    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.6 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
  school:   '<path d="M22 10 12 5 2 10l10 5 10-5z"></path><path d="M6 12v5c3 1.5 9 1.5 12 0v-5"></path><path d="M22 10v6"></path>',
  flame:    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.4-1.5-2-1.5-3.5 0 0 3 1 3 5a4.5 4.5 0 0 1-9 0c0-2 1-3 1-3s.5 2 1.5 2z"></path><path d="M12 2c0 4-4 4-4 8a4 4 0 0 0 8 0c0-2-1-4-2-5z"></path>',
  target:   '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>'
};

let pop = [];          // {x,y,state,daysInfected}
let history = [];      // [{day, S, I, R}]
let timer = null;
let running = false;
let activeScenario = 'custom';

const els = {};
['N','beta','alpha','gamma','Y0','size','speed'].forEach(id => {
  els[id] = document.getElementById(id);
});

const valEls = {
  N: document.getElementById('val-N'),
  beta: document.getElementById('val-beta'),
  alpha: document.getElementById('val-alpha'),
  gamma: document.getElementById('val-gamma'),
  Y0: document.getElementById('val-Y0'),
  size: document.getElementById('val-size'),
  speed: document.getElementById('val-speed')
};

function fmtVal(id, v){
  switch(id){
    case 'N': return String(Math.round(v));
    case 'beta': return String(Math.round(v));
    case 'alpha': return Number(v).toFixed(2);
    case 'gamma': return Number(v).toFixed(2);
    case 'Y0': return String(Math.round(v));
    case 'size': return Number(v).toFixed(1) + '\u00d7';
    case 'speed': return Math.round(v) + '\u00d7';
    default: return String(v);
  }
}

function syncLabels(){
  Object.keys(els).forEach(id => {
    valEls[id].textContent = fmtVal(id, els[id].value);
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

function setParams(p){
  els.N.value = p.N;
  els.beta.value = p.beta;
  els.alpha.value = p.alpha;
  els.gamma.value = p.gamma;
  els.Y0.value = p.Y0;
  els.size.value = p.size;
  syncLabels();
}

/* ---------------------------- Initialization ---------------------------- */

function initPopulation(){
  const { N, Y0, size } = getParams();
  pop = [];
  const W = 100 * size, H = 58 * size; // domain units
  for(let i = 0; i < N; i++){
    pop.push({
      x: Math.random() * W,
      y: Math.random() * H,
      state: STATE.S,
      daysInfected: 0
    });
  }
  // seed initial infections
  const seeds = new Set();
  while(seeds.size < Math.min(Y0, N)){
    seeds.add(Math.floor(Math.random() * N));
  }
  seeds.forEach(i => { pop[i].state = STATE.I; pop[i].daysInfected = 0; });

  history = [];
  recordHistory(0);
}

function recordHistory(day){
  let S=0, I=0, R=0;
  for(const p of pop){
    if(p.state === STATE.S) S++;
    else if(p.state === STATE.I) I++;
    else R++;
  }
  history.push({ day, S, I, R });
}

/* ------------------------------ Simulation step --------------------------- */

function step(){
  const { beta, alpha, gamma } = getParams();
  const infectious = pop.filter(p => p.state === STATE.I);

  // compute infection probabilities for susceptibles
  const newlyInfected = [];
  for(let i = 0; i < pop.length; i++){
    const p = pop[i];
    if(p.state !== STATE.S) continue;
    let force = 0;
    for(const inf of infectious){
      const dx = p.x - inf.x, dy = p.y - inf.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 0.001;
      force += Math.pow(d, -alpha);
    }
    const prob = 1 - Math.exp(-(beta / pop.length) * force);
    if(Math.random() < prob) newlyInfected.push(i);
  }

  // recoveries
  for(const p of infectious){
    if(Math.random() < gamma) p.state = STATE.R;
    else p.daysInfected++;
  }

  for(const idx of newlyInfected){
    pop[idx].state = STATE.I;
    pop[idx].daysInfected = 0;
  }

  recordHistory(history.length);
}

function isFinished(){
  return !pop.some(p => p.state === STATE.I) || history.length > 200;
}

/* --------------------------------- Canvas --------------------------------- */

const mapCanvas = document.getElementById('mapCanvas');
const mctx = mapCanvas.getContext('2d');

function drawPerson(ctx, px, py, r, state){
  let color;
  if(state === STATE.S) color = COLORS.healthy;
  else if(state === STATE.I) color = COLORS.infected;
  else color = COLORS.recovered;

  // simple person silhouette: head + body
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
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

/* ----------------------------- Scenario backgrounds ----------------------------- */
/* Light SVG-style illustrations drawn behind the population, per scenario.
   Kept subtle (light fill, low contrast) so person icons stay readable. */

function bgResidential(ctx, W, H){
  ctx.fillStyle = '#eef3f8';
  const baseY = H * 0.82;
  const houses = [
    {x: W*0.08, w: 90, h: 70, roof: 38},
    {x: W*0.24, w: 70, h: 55, roof: 30},
    {x: W*0.42, w: 100, h: 80, roof: 44},
    {x: W*0.62, w: 75, h: 60, roof: 32},
    {x: W*0.80, w: 95, h: 72, roof: 40}
  ];
  houses.forEach(h => {
    ctx.fillRect(h.x, baseY - h.h, h.w, h.h);
    ctx.beginPath();
    ctx.moveTo(h.x - 8, baseY - h.h);
    ctx.lineTo(h.x + h.w/2, baseY - h.h - h.roof);
    ctx.lineTo(h.x + h.w + 8, baseY - h.h);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillRect(0, baseY, W, H - baseY);
}

function bgDowntown(ctx, W, H){
  ctx.fillStyle = '#eaeff5';
  const baseY = H * 0.88;
  const buildings = [
    {x: W*0.04, w: 60, h: 180},
    {x: W*0.13, w: 80, h: 240},
    {x: W*0.26, w: 55, h: 150},
    {x: W*0.36, w: 95, h: 280},
    {x: W*0.50, w: 65, h: 200},
    {x: W*0.61, w: 85, h: 260},
    {x: W*0.74, w: 60, h: 170},
    {x: W*0.85, w: 90, h: 230}
  ];
  buildings.forEach(b => {
    const h = Math.min(b.h, baseY - 10);
    ctx.fillRect(b.x, baseY - h, b.w, h);
  });
  ctx.fillRect(0, baseY, W, H - baseY);

  // window dots
  ctx.fillStyle = '#dbe3ec';
  buildings.forEach(b => {
    const h = Math.min(b.h, baseY - 10);
    for(let wy = baseY - h + 14; wy < baseY - 10; wy += 22){
      for(let wx = b.x + 10; wx < b.x + b.w - 8; wx += 18){
        ctx.fillRect(wx, wy, 8, 12);
      }
    }
  });
}

function bgAirport(ctx, W, H){
  ctx.fillStyle = '#eef3f8';
  const baseY = H * 0.78;
  ctx.fillRect(0, baseY, W, H - baseY);
  // runway center line
  ctx.strokeStyle = '#dbe3ec';
  ctx.lineWidth = 4;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  ctx.moveTo(0, H - (H - baseY)/2);
  ctx.lineTo(W, H - (H - baseY)/2);
  ctx.stroke();
  ctx.setLineDash([]);

  // terminal building
  ctx.fillStyle = '#e3eaf2';
  ctx.fillRect(W*0.30, baseY - 70, W*0.40, 70);
  ctx.beginPath();
  ctx.moveTo(W*0.30, baseY - 70);
  ctx.lineTo(W*0.50, baseY - 100);
  ctx.lineTo(W*0.70, baseY - 70);
  ctx.closePath();
  ctx.fill();

  // simple plane silhouette top-right
  ctx.save();
  ctx.translate(W*0.78, H*0.18);
  ctx.rotate(-0.25);
  ctx.fillStyle = '#dbe3ec';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(70, 6);
  ctx.lineTo(74, 12);
  ctx.lineTo(40, 14);
  ctx.lineTo(34, 32);
  ctx.lineTo(22, 32);
  ctx.lineTo(22, 16);
  ctx.lineTo(0, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function bgSchool(ctx, W, H){
  ctx.fillStyle = '#eef3f8';
  const baseY = H * 0.85;
  ctx.fillRect(0, baseY, W, H - baseY);

  // main building block
  ctx.fillStyle = '#e6ecf3';
  const bx = W*0.28, bw = W*0.44, bh = 150;
  ctx.fillRect(bx, baseY - bh, bw, bh);
  // roof
  ctx.beginPath();
  ctx.moveTo(bx - 14, baseY - bh);
  ctx.lineTo(bx + bw/2, baseY - bh - 46);
  ctx.lineTo(bx + bw + 14, baseY - bh);
  ctx.closePath();
  ctx.fill();
  // little cupola
  ctx.fillRect(bx + bw/2 - 6, baseY - bh - 70, 12, 24);

  // windows
  ctx.fillStyle = '#dbe3ec';
  for(let wx = bx + 16; wx < bx + bw - 16; wx += 34){
    ctx.fillRect(wx, baseY - bh + 24, 18, 26);
    ctx.fillRect(wx, baseY - bh + 70, 18, 26);
  }
  // door
  ctx.fillRect(bx + bw/2 - 14, baseY - 46, 28, 46);
}

function bgSuperspread(ctx, W, H){
  ctx.fillStyle = '#fbeeee';
  ctx.fillRect(0, 0, W, H);
  // radiating rings from center
  const cx = W/2, cy = H/2;
  ctx.strokeStyle = '#f3dcdc';
  ctx.lineWidth = 2;
  for(let r = 40; r < Math.max(W,H); r += 50){
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  }
}

function bgCustom(ctx, W, H){
  ctx.fillStyle = '#f3f5f7';
  ctx.fillRect(0, 0, W, H);
  // crosshair / target grid
  ctx.strokeStyle = '#e6e9ed';
  ctx.lineWidth = 1;
  for(let gx = 0; gx <= W; gx += 80){
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
  }
  for(let gy = 0; gy <= H; gy += 80){
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
  }
  const cx = W/2, cy = H/2;
  ctx.strokeStyle = '#dde2e8';
  ctx.lineWidth = 2;
  [50, 90, 130].forEach(r => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  });
}

const SCENARIO_BG = {
  residential: bgResidential,
  downtown: bgDowntown,
  airport: bgAirport,
  school: bgSchool,
  superspread: bgSuperspread,
  custom: bgCustom
};

function drawScenarioBackground(ctx, W, H){
  const fn = SCENARIO_BG[activeScenario] || bgCustom;
  fn(ctx, W, H);
}

function drawMap(){
  const { size } = getParams();
  const W = mapCanvas.width, H = mapCanvas.height;
  mctx.clearRect(0,0,W,H);

  // scenario-specific illustration
  drawScenarioBackground(mctx, W, H);

  // subtle overlay grid for spatial reference
  mctx.strokeStyle = 'rgba(255,255,255,0.5)';
  mctx.lineWidth = 1;
  for(let gx = 0; gx <= W; gx += 40){
    mctx.beginPath(); mctx.moveTo(gx,0); mctx.lineTo(gx,H); mctx.stroke();
  }
  for(let gy = 0; gy <= H; gy += 40){
    mctx.beginPath(); mctx.moveTo(0,gy); mctx.lineTo(W,gy); mctx.stroke();
  }

  const domainW = 100 * size, domainH = 58 * size;
  const sx = W / domainW, sy = H / domainH;
  const scale = Math.min(sx, sy);
  const offX = (W - domainW*scale) / 2;
  const offY = (H - domainH*scale) / 2;

  const r = Math.max(3, Math.min(7, 700 / pop.length));

  for(const p of pop){
    const px = offX + p.x * scale;
    const py = offY + p.y * scale;
    drawPerson(mctx, px, py, r, p.state);
  }
}

/* ---------------------------------- Chart ---------------------------------- */

let chart = null;

function initChart(){
  const ctx = document.getElementById('curveChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Healthy', data: [], borderColor: COLORS.healthy, backgroundColor: 'transparent', tension: 0.25, pointRadius: 0, borderWidth: 2 },
        { label: 'Infected', data: [], borderColor: COLORS.infected, backgroundColor: 'transparent', tension: 0.25, pointRadius: 0, borderWidth: 2 },
        { label: 'Recovered', data: [], borderColor: COLORS.recovered, backgroundColor: 'transparent', tension: 0.25, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'Day', font: { size: 12 } }, grid: { color: '#f1f3f6' }, ticks: { font: { size: 11 } } },
        y: { title: { display: true, text: 'Individuals', font: { size: 12 } }, beginAtZero: true, grid: { color: '#f1f3f6' }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } }
        },
        tooltip: { titleFont: { size: 12 }, bodyFont: { size: 12 } }
      }
    }
  });
}

function updateChart(){
  chart.data.labels = history.map(h => h.day);
  chart.data.datasets[0].data = history.map(h => h.S);
  chart.data.datasets[1].data = history.map(h => h.I);
  chart.data.datasets[2].data = history.map(h => h.R);
  chart.update();
}

/* ---------------------------------- Metrics --------------------------------- */

function updateMetrics(){
  const last = history[history.length - 1];
  const N = pop.length;
  document.getElementById('m-day').textContent = last.day;
  document.getElementById('m-healthy').textContent = last.S;
  document.getElementById('m-infected').textContent = last.I;
  document.getElementById('m-recovered').textContent = last.R;
  document.getElementById('m-healthy-pct').textContent = ((last.S/N)*100).toFixed(1) + '% of population';
  document.getElementById('m-infected-pct').textContent = ((last.I/N)*100).toFixed(1) + '% of population';
  document.getElementById('m-recovered-pct').textContent = ((last.R/N)*100).toFixed(1) + '% of population';

  let peak = 0, peakDay = 0;
  for(const h of history){ if(h.I > peak){ peak = h.I; peakDay = h.day; } }
  document.getElementById('m-peak').textContent = peak;
  document.getElementById('m-peak-day').textContent = peak > 0 ? peakDay : '\u2014';
}

function setStatus(state){
  const badge = document.getElementById('statusBadge');
  const statusEl = document.getElementById('m-status');
  if(state === 'ready'){
    badge.className = 'badge';
    badge.innerHTML = iconClock() + ' Ready';
    statusEl.textContent = 'Not started';
  } else if(state === 'running'){
    badge.className = 'badge';
    badge.style.color = '#0c7a3a';
    badge.style.background = '#eafaf0';
    badge.innerHTML = iconPlay() + ' Running';
    statusEl.textContent = 'Simulation running\u2026';
  } else if(state === 'done'){
    badge.className = 'badge';
    badge.style.color = '#1d4ed8';
    badge.style.background = '#eaf1fd';
    badge.innerHTML = iconCheck() + ' Complete';
    statusEl.textContent = 'Epidemic resolved';
  }
}

function iconClock(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; }
function iconPlay(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>'; }
function iconCheck(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'; }

/* ------------------------------- Run controls --------------------------------- */

const btnRun = document.getElementById('btnRun');
const btnReset = document.getElementById('btnReset');

function speedToMs(speedVal){
  // 1x -> 600ms, 10x -> ~60ms
  const s = Math.round(speedVal);
  return Math.max(50, 650 - s * 60);
}

function startRun(){
  if(running) return;
  if(history.length === 0 || history.length === 1){
    initPopulation();
    drawMap();
    updateChart();
    updateMetrics();
  } else if(isFinished()){
    initPopulation();
    drawMap();
    updateChart();
    updateMetrics();
  }
  running = true;
  setStatus('running');
  btnRun.innerHTML = pauseIcon() + ' Pause';
  tick();
}

function pauseRun(){
  running = false;
  clearInterval(timer);
  btnRun.innerHTML = playIcon() + ' Resume';
}

function tick(){
  clearInterval(timer);
  timer = setInterval(() => {
    if(!running) return;
    step();
    drawMap();
    updateChart();
    updateMetrics();
    if(isFinished()){
      running = false;
      clearInterval(timer);
      setStatus('done');
      btnRun.innerHTML = playIcon() + ' Run again';
    }
  }, speedToMs(els.speed.value));
}

function playIcon(){ return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'; }
function pauseIcon(){ return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'; }

btnRun.addEventListener('click', () => {
  if(running) pauseRun();
  else startRun();
});

btnReset.addEventListener('click', () => {
  running = false;
  clearInterval(timer);
  initPopulation();
  drawMap();
  updateChart();
  updateMetrics();
  setStatus('ready');
  btnRun.innerHTML = playIcon() + ' Run simulation';
});

/* ------------------------------- Slider wiring --------------------------------- */

Object.keys(els).forEach(id => {
  els[id].addEventListener('input', () => {
    valEls[id].textContent = fmtVal(id, els[id].value);
    if(id !== 'speed'){
      activeScenario = 'custom';
      highlightScenario('custom');
      if(!running){
        running = false;
        clearInterval(timer);
        initPopulation();
        drawMap();
        updateChart();
        updateMetrics();
        setStatus('ready');
        btnRun.innerHTML = playIcon() + ' Run simulation';
      }
    } else if(running){
      tick();
    }
  });
});

/* -------------------------------- Scenarios ------------------------------------ */

const scenarioGrid = document.getElementById('scenarioGrid');

function buildScenarioCards(){
  SCENARIOS.forEach(sc => {
    const card = document.createElement('div');
    card.className = 'scenario-card';
    card.dataset.id = sc.id;
    card.innerHTML = `
      <div class="sc-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[sc.icon]}</svg>
      </div>
      <p class="sc-title">${sc.title}</p>
      <p class="sc-desc">${sc.desc}</p>
    `;
    card.addEventListener('click', () => applyScenario(sc.id));
    scenarioGrid.appendChild(card);
  });
}

function highlightScenario(id){
  document.querySelectorAll('.scenario-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });
}

function applyScenario(id){
  const sc = SCENARIOS.find(s => s.id === id);
  activeScenario = id;
  highlightScenario(id);
  if(sc.params){
    setParams(sc.params);
  }
  running = false;
  clearInterval(timer);
  initPopulation();
  drawMap();
  updateChart();
  updateMetrics();
  setStatus('ready');
  btnRun.innerHTML = playIcon() + ' Run simulation';
}

/* ---------------------------------- Export -------------------------------------- */

document.getElementById('btnExportPng').addEventListener('click', () => {
  const url = chart.toBase64Image();
  const a = document.createElement('a');
  a.href = url;
  a.download = 'epidemic-curve.png';
  a.click();
});

document.getElementById('btnExportCsv').addEventListener('click', () => {
  let csv = 'day,healthy,infected,recovered\n';
  history.forEach(h => { csv += `${h.day},${h.S},${h.I},${h.R}\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'epidemic-data.csv';
  a.click();
  URL.revokeObjectURL(url);
});

/* ----------------------------------- Init ---------------------------------------- */

function init(){
  syncLabels();
  buildScenarioCards();
  highlightScenario('custom');
  initChart();
  initPopulation();
  drawMap();
  updateChart();
  updateMetrics();
  setStatus('ready');
  btnRun.innerHTML = playIcon() + ' Run simulation';
}

init();
