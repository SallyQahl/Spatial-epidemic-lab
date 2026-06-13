# Spatial Epidemic Research Lab

An interactive, browser-based simulator of disease spread across a spatial population, built to make individual-level epidemic models (ILMs) tangible and explorable.

**Live demo:** https://sallyqahl.github.io/Spatial-epidemic-lab/

---

## What this is

This dashboard simulates an outbreak spreading through a population of individuals placed at random locations in space. Each day, infectious individuals can pass the disease to nearby susceptible individuals, with transmission risk decreasing with distance. People pass through a silent incubation period before becoming contagious, and eventually recover.

It uses a **spatial SEIR model** (Susceptible → Exposed → Infectious → Recovered) with five disease presets (COVID-19, Influenza, Measles, Ebola, Bubonic Plague), each with historically-grounded latency periods and transmission parameters.

---

## The model (the math)

### States

$N$ individuals are placed uniformly at random in a 2D rectangular region. Each individual $i$ has a position $(x_i, y_i)$ and a health state:

| State | Colour | Meaning |
|---|---|---|
| **S** — Susceptible | 🟢 Green | Healthy, can catch the disease |
| **E** — Exposed | 🟡 Amber | Infected but not yet contagious (incubating) |
| **I** — Infectious | 🔴 Red | Contagious, actively spreading |
| **R** — Recovered | 🟣 Purple | Immune |

### Transmission: S → E

On each simulated day, every susceptible individual $i$ faces a probability of becoming exposed based on their distance to every currently infectious individual $j$:

$$
\text{force}_i = \sum_{j \in \text{infectious}} d(i,j)^{-\alpha}
$$

$$
P(i \text{ becomes exposed}) = 1 - \exp\left(-\frac{\beta}{N} \cdot \text{force}_i\right)
$$

where $d(i,j)$ is the Euclidean distance between individuals $i$ and $j$, $\alpha$ controls spatial decay of transmission risk, $\beta$ is the baseline transmission intensity, and the $1/N$ normalization keeps $\beta$ comparable across different population sizes.

**COVID-19 uses a dual-kernel** combining aerosol (long-range, $\alpha_1 = 0.8$) and droplet/contact (short-range, $\alpha_2 = 2.5$) routes:

$$
\text{force}_i^{\text{COVID}} = \sum_{j \in I} \left[ 0.5 \cdot d_{ij}^{-0.8} + 0.5 \cdot d_{ij}^{-2.5} \right]
$$

### Latency: E → I

Each exposed individual progresses to infectious with daily probability $\sigma = 1/L$ where $L$ is a working approximation of the disease's pre-symptomatic spread window. For Ebola ($L=0$), individuals become infectious immediately upon exposure (since Ebola is generally not contagious before symptoms):

$$
P(i \text{ becomes infectious}) = \begin{cases} 1/L & \text{if } L > 0 \\ 1 & \text{if } L = 0 \text{ (Ebola)} \end{cases}
$$

Latency periods are fixed from historical epidemiological data:

| Disease | Silent spread window | Infectious period (mean) | Transmission | Notes |
|---|---|---|---|---|
| COVID-19 | 1–3 days | ~10 days | Dual-kernel: aerosol + droplet | Varies by variant; Omicron shorter than original strain |
| Influenza | 1–2 days | ~5 days | Droplet, medium range | Commonly ~1 day pre-symptomatic spread |
| Measles | ~4 days | ~8 days | Airborne, long range | Infectious ~4 days before rash onset; R₀ 12–18 |
| Ebola | ~0 days | ~15 days | Close contact only | Generally not contagious before symptom onset |
| Bubonic Plague | unclear | ~6 days | Close contact / vector | Limited evidence on pre-symptomatic spread |

> **Note on uncertainty:** These are approximate working values for educational simulation. The pre-symptomatic infectious window varies by strain, individual viral load, symptom definition, and the specific outbreak studied. Values are not universally agreed constants and should not be cited as authoritative epidemiological estimates.

### Recovery: I → R

$$
P(i \text{ recovers}) = \gamma \quad \text{per day}
$$

giving an exponentially-distributed infectious period with mean $1/\gamma$ days.

### Parameters

| Dashboard label | Symbol | Meaning |
|---|---|---|
| Community size | $N$ | Total population |
| How contagious is it? | $\beta$ | Baseline transmission intensity (10–300) |
| How far does it spread? | $\alpha$ | Spatial decay of transmission risk |
| How fast do people recover? | $\gamma$ | Daily recovery probability |
| Starting cases | $Y_0$ | Individuals infectious at day 0 |
| Geographic area | size | Scales the spatial domain |

---

## The code

Everything runs **client-side** — no server, no data collection, no dependencies beyond Chart.js (loaded from CDN).

### `index.html`
- Page structure and styling
- Layout: disease preset cards, parameter sliders, population map, setting presets, live alert panel, SEIR metric cards, epidemic curve chart, expandable "how it works" accordion

### `app.js`

1. **Constants** — colors, health-state codes, the six scenario presets (residential, downtown, airport, school, super-spreader, custom), and inline SVG icon paths for the scenario cards.

2. **Population initialization** (`initPopulation`) — places $N$ individuals at random $(x,y)$ coordinates within a domain whose size scales with the "geographic area" slider, then seeds $Y_0$ random initial infections.

3. **Simulation step** (`step`) — implements the transmission and recovery equations above, once per simulated day:
   - For each susceptible individual, sums the distance-weighted contribution from every infectious individual and converts it to an infection probability.
   - For each infectious individual, rolls for recovery.
   - Applies all updates simultaneously (so transmission this step is based on yesterday's infectious set).

4. **Rendering**:
   - `drawMap()` — draws each individual as a small person-shaped icon on a `<canvas>`, colored by current health state.
   - `updateChart()` — pushes the day's S/I/R counts into a Chart.js line chart.
   - `updateMetrics()` — updates the metric cards (current day, counts, percentages, peak infected and the day it occurred).

5. **Run controls** — play/pause/reset, with a speed slider controlling how fast days advance (implemented via `setInterval`).

6. **Scenario presets** — clicking a scenario card sets all sliders to a preconfigured parameter combination representing a different setting (e.g. "Airport" = high mixing, long-range contacts; "School" = tight clusters, fast recovery).

7. **Export** — download the epidemic curve as a PNG image or the underlying day-by-day data as a CSV.

### Design notes
- The simulation is **stochastic** — re-running with identical parameters gives different outbreak trajectories, by design, since real epidemics are random processes.
- The model is intentionally simplified — no recovery-period structure beyond a geometric distribution, no household/network structure — the goal here is intuition-building and visualization, not publication-grade inference.

---

## Running locally

No build step required.

```bash
git clone https://github.com/SallyQahl/Spatial-epidemic-lab.git
cd Spatial-epidemic-lab
# open index.html in any browser, or:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## License

[Add your preferred license — MIT is a common choice for portfolio projects]
