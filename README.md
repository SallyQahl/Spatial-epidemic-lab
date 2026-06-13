# Spatial Epidemic Research Lab

An interactive, browser-based simulator of disease spread across a spatial population, built to make individual-level epidemic models (ILMs) tangible and explorable.

**Live demo:** https://sallyqahl.github.io/Spatial-epidemic-lab/
**Status:** unpublished personal research/teaching tool — not a peer-reviewed model

---

## What this is

This dashboard simulates an outbreak spreading through a population of individuals placed at random locations in space. Each day, infected individuals can pass the disease to nearby susceptible individuals, with the chance of transmission decreasing the farther apart two people are. Infected individuals eventually recover.

It's a simplified, visual version of the kind of **spatial individual-level model (ILM)** used in epidemiological research to study how geography and population density affect outbreak dynamics.

---

## The model (the math)

### Population

$N$ individuals are placed uniformly at random in a 2D rectangular region. Each individual $i$ has:
- a position $(x_i, y_i)$
- a health state: **Susceptible (S)**, **Infected (I)**, or **Recovered (R)**

### Transmission

On each simulated day, every susceptible individual $i$ faces a probability of becoming infected based on their distance to every currently infectious individual $j$:

$$
\text{force}_i = \sum_{j \in \text{infectious}} d(i,j)^{-\alpha}
$$

$$
P(i \text{ becomes infected}) = 1 - \exp\left(-\frac{\beta}{N} \cdot \text{force}_i\right)
$$

where:
- $d(i,j)$ is the Euclidean distance between individuals $i$ and $j$
- $\alpha$ ("distance effect") controls how quickly transmission risk decays with distance — a higher $\alpha$ means disease spreads almost only to immediate neighbors
- $\beta$ ("infection strength") is the baseline transmission intensity — a higher $\beta$ means each nearby infectious person poses a greater risk
- the $1/N$ term normalizes the force of infection by population size, so $\beta$'s meaning stays roughly comparable across different population sizes and domain sizes (without it, the summed contribution from many infectious individuals can grow large enough that the infection probability saturates to ~1 for nearly everyone within a single day)

This is a **distance-weighted, population-normalized force of infection**: an individual's total risk is the sum of contributions from every infectious person, each discounted by distance, averaged over the population. The $1 - e^{-x}$ transformation converts that hazard into a probability between 0 and 1.

### Recovery

Each infectious individual recovers independently each day with fixed probability $\gamma$ ("recovery speed"):

$$
P(i \text{ recovers}) = \gamma
$$

This gives an exponentially-distributed infectious period with mean $1/\gamma$ days.

### Initial conditions

- $Y_0$ individuals are chosen at random to start the simulation already infected (day 0).
- The simulation runs day-by-day until either no one is infected, or 200 days have passed (safety cap).

### Parameters at a glance

| Dashboard label | Symbol | Meaning |
|---|---|---|
| Community size | $N$ | Total population |
| Infection strength | $\beta$ | Baseline transmission intensity (range 10–300) |
| Distance effect | $\alpha$ | Spatial decay of transmission risk |
| Recovery speed | $\gamma$ | Daily probability of recovery |
| Starting cases | $Y_0$ | Number infected at day 0 |
| Geographic area | size multiplier | Scales the spatial domain (spreads people out / packs them in) |

---

## The code

Everything runs **client-side** — no server, no data collection, no dependencies beyond Chart.js (loaded from a CDN for the epidemic curve chart).

### `index.html`
- Page structure and styling (CSS variables for a clean, dashboard-like look)
- Layout: parameter panel, population map, scenario presets, metric cards, epidemic curve chart

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
