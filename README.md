# Spatial Epidemic Research Lab

An interactive, browser-based spatial epidemic simulator built on a stochastic SEIR individual-level model (ILM) with household clustering, deterministic disease timelines, and distance-dependent transmission dynamics.

**Live demo:** https://sallyqahl.github.io/Spatial-epidemic-lab/

---

## Overview

The simulator models disease spread through a spatially distributed population of household-clustered individuals. Each person occupies a fixed location; transmission risk decays with distance according to a power-law kernel. Disease progression follows deterministic, disease-specific timelines separating latent, presymptomatic infectious, and symptomatic infectious periods within the SEIR framework.

Five disease presets are included — COVID-19, Influenza, Measles, Ebola, and Bubonic Plague — each parameterised with distinct incubation periods, presymptomatic windows, and infectious durations. A dual-kernel formulation approximates COVID-19's aerosol and droplet transmission routes.

---

## Features

- **Household-clustered population** — individuals placed in groups of 4 around shared household centres; spatial proximity drives intra-household spread without a separate multiplier
- **Deterministic disease timelines** — latent, presymptomatic, and infectious periods tracked via day counters per individual; no geometric recovery assumption
- **Disease presets** — COVID-19, Influenza, Measles, Ebola, Plague with historically-grounded parameters
- **Transmission Efficiency metric** — empirical mean secondary infections over completed non-seed cases; correctly excludes seed infections from the denominator
- **Live SEIR epidemic curve** — exportable as PNG or CSV
- **Intervention alert panel** — rule-based severity levels with public health recommendations
- **Show Math panel** — complete transmission equations, disease progression rules, and metric definitions hidden by default; revealed on demand
- **Setting presets** — residential, downtown, airport, school, super-spreader; adjust population size and area only, never disease biology

---

## Quick start

No build step required.

```bash
git clone https://github.com/SallyQahl/Spatial-epidemic-lab.git
cd Spatial-epidemic-lab
# open index.html in any browser, or:
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Mathematical model

### Transmission

The force of infection on susceptible individual i at each time step:

```
λ_i = (β/N) × Σ_{j ∈ Φ} d_{ij}^(−α)

P(S → E)_i = 1 − exp(−λ_i)
```

where Φ is the set of presymptomatic and symptomatic infectious individuals, β is the baseline transmission intensity, α is the spatial decay parameter, and N is population size.

For COVID-19 (dual-kernel):

```
λ_i = (β/N) × Σ_{j ∈ Φ} [ 0.5 × d_{ij}^(−0.8) + 0.5 × d_{ij}^(−2.5) ]
```

### Disease progression

```
E state, days 0 → (T_inc − T_pre − 1):   latent, NOT infectious
E state, days (T_inc − T_pre) → T_inc:    presymptomatic, INFECTIOUS
E → I: at d_i^E ≥ T_inc  (deterministic)
I → R: at d_i^I ≥ T_inf  (deterministic)
```

| Disease        | T_inc | T_pre | T_inf |
|----------------|-------|-------|-------|
| COVID-19       | 5     | 2     | 8     |
| Influenza      | 2     | 1     | 5     |
| Measles        | 10    | 4     | 8     |
| Ebola          | 10    | 0     | 10    |
| Bubonic Plague | 4     | 0     | 6     |

### Transmission Efficiency

```
TE = Σ_{i ∈ C} c_i / |C|

where C = { i : state_i = R  and  seed_i = false }
```

Mean secondary infections over completed non-seed cases. Not an estimated Rₜ — computed directly from simulated infection chains.

---

## Documentation

| Document | Contents |
|---|---|
| [METHODS.md](METHODS.md) | Complete model formulation, notation, equations, disease parameters |
| [ASSUMPTIONS.md](ASSUMPTIONS.md) | Explicit assumptions, known limitations, relationship to other model classes |

---

## Repository structure

```
index.html       — dashboard UI and layout
app.js           — simulation engine and visualisation
README.md        — project overview (this file)
METHODS.md       — complete mathematical methods
ASSUMPTIONS.md   — assumptions and limitations
```

---

## Citation

If you use or reference this simulator:

```
Qahl, S. (2025). Spatial Epidemic Research Lab (v1.1).
Spatial stochastic SEIR individual-level model with household clustering.
https://github.com/SallyQahl/Spatial-epidemic-lab
```

---

## License

© 2025 Salha Qahl. All rights reserved.

---

*Model class: Spatial Individual-Level Model (ILM). Ref: Deardon et al. (2010), Statistica Sinica, 20(1), 239–261.*
