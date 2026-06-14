# Spatial Epidemic Research Lab

An interactive, browser-based spatial epidemic simulator built on a stochastic SEIR individual-level model (ILM) with household clustering, deterministic disease timelines, and distance dependent transmission dynamics.

**Live demo:** https://sallyqahl.github.io/Spatial-epidemic-lab/

---

## Overview

The simulator models disease spread through a spatially distributed population of household-clustered individuals. Each person occupies a fixed location; transmission risk decays with distance according to a power-law kernel. Disease progression follows deterministic, disease-specific timelines separating latent, presymptomatic infectious, and symptomatic infectious periods within the SEIR framework.

Five disease presets are included — COVID-19, Influenza, Measles, Ebola, and Bubonic Plague — each parameterised with distinct incubation periods, presymptomatic windows, and infectious durations. A dual-kernel formulation approximates COVID-19's aerosol and droplet transmission routes.

---

## Features

- **Household-clustered population**  individuals placed in groups of 4 around shared household centres; spatial proximity drives intra-household spread without a separate multiplier
- **Deterministic disease timelines**  latent, presymptomatic, and infectious periods tracked via day counters per individual; no geometric recovery assumption
- **Disease presets** — COVID-19, Influenza, Measles, Ebola, Plague with historically-grounded parameters
- **Transmission Efficiency metric** — empirical mean secondary infections over completed non-seed cases; correctly excludes seed infections from the denominator
- **Live SEIR epidemic curve** — exportable as PNG or CSV
- **Intervention alert panel** — rule-based severity levels with public health recommendations
- **Show Math panel** — complete transmission equations and metric definitions, hidden by default
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

The force of infection on susceptible individual $i$ at each time step:

$$\lambda_i = \frac{\beta}{N} \sum_{j \in \Phi} d_{ij}^{-\alpha}$$

$$P(S \to E)_i = 1 - \exp(-\lambda_i)$$

where $\Phi$ is the set of presymptomatic and symptomatic infectious individuals, $\beta$ is the baseline transmission intensity, $\alpha$ is the spatial decay parameter, and $N$ is population size.

For COVID-19 (dual-kernel — aerosol + droplet):

$$\lambda_i^{\text{COVID}} = \frac{\beta}{N} \sum_{j \in \Phi} \left[ 0.5 \cdot d_{ij}^{-0.8} + 0.5 \cdot d_{ij}^{-2.5} \right]$$

### Disease progression

Each disease is parameterised by incubation period $T_{\text{inc}}$, presymptomatic infectious period $T_{\text{pre}}$, and infectious period $T_{\text{inf}}$, where $T_{\text{pre}} \leq T_{\text{inc}}$.

$$E \text{ infectious when } d_i^E \geq T_{\text{inc}} - T_{\text{pre}}$$

$$E \to I \text{ when } d_i^E \geq T_{\text{inc}} \quad \text{(deterministic)}$$

$$I \to R \text{ when } d_i^I \geq T_{\text{inf}} \quad \text{(deterministic)}$$

| Disease        | $T_{\text{inc}}$ | $T_{\text{pre}}$ | $T_{\text{inf}}$ |
|----------------|-----------------|-----------------|-----------------|
| COVID-19       | 5               | 2               | 8               |
| Influenza      | 2               | 1               | 5               |
| Measles        | 10              | 4               | 8               |
| Ebola          | 10              | 0               | 10              |
| Bubonic Plague | 4               | 0               | 6               |

### Transmission Efficiency

$$\text{TE} = \frac{\sum_{i \in C} c_i}{|C|}, \quad C = \{i : \text{state}_i = R \text{ and } \text{seed}_i = \text{false}\}$$

where $c_i$ is the number of secondary infections caused by individual $i$. Seed cases (initial $Y_0$ infections) are excluded from the denominator. This is **not** an estimated $R_t$ — it is computed directly from simulated infection chains with no generation interval assumption.

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
