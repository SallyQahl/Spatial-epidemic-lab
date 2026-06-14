# Methods

## Spatial SEIR Individual-Level Model — Version 1.1

---

## 3.1 Model Overview

The simulator implements a spatial individual-level model (ILM) within a stochastic SEIR framework. Individuals are represented as discrete agents with known spatial locations and household membership. Transmission occurs probabilistically through a distance-dependent force of infection. Disease progression after infection follows deterministic, disease-specific timelines.

This framework combines stochastic transmission dynamics with deterministic disease progression. Transmission events occur through repeated Bernoulli trials derived from the spatial force of infection, so identical parameter settings may produce substantially different outbreak trajectories across simulation runs. Once infected, individuals progress through disease states according to fixed timelines defined by disease-specific incubation, presymptomatic infectious, and infectious periods. This design separates uncertainty associated with transmission from uncertainty associated with disease progression, improving interpretability while preserving stochastic outbreak behaviour.

---

## 3.2 Population Generation

A population of N individuals is generated within a rectangular spatial domain of dimensions:

```
W = 100 × size
H = 58  × size
```

where `size` is a user-specified area multiplier.

### 3.2.1 Household Clustering

Individuals are organised into households of fixed size H_s = 4. Household centres are placed uniformly at random within the domain. Each individual is then positioned at a small random displacement from their household centre:

```
x_i = x_{h_i} + U(−δ, δ)
y_i = y_{h_i} + U(−δ, δ)
```

where δ = 3.5 domain units and h_i denotes the household of individual i.

No household-specific transmission multiplier is applied. Intra-household transmission is driven entirely by spatial proximity through the distance kernel. This avoids the double-counting problem that arises when both a distance kernel and a household multiplier are active simultaneously.

---

## 3.3 Individual-Level Disease Representation

Each individual agent i is characterised by a disease state, spatial location, household membership, and transmission history. The following attributes are maintained throughout the simulation:

- Household identifier (h_i)
- Exposure duration counter (d_i^E)
- Infectious duration counter (d_i^I)
- Seed case flag (seed_i ∈ {true, false})
- Infector identifier (p_i)
- Secondary infection count (c_i)

The infector identifier records the source of infection for each transmission-generated case and is undefined for seed infections introduced at initialisation. Secondary infection counts are updated dynamically whenever an infected agent successfully transmits infection to a susceptible individual.

---

## 3.4 Disease Progression

The simulation employs a stochastic spatial SEIR framework with deterministic disease progression. Each disease profile is parameterised by:

- Incubation period (T_inc)
- Presymptomatic infectious period (T_pre)
- Infectious period (T_inf)

where T_pre ≤ T_inc.

Individuals progress through disease states according to the following rules:

### S → E
Transmission occurs probabilistically through the spatial force of infection (see Section 3.5).

### E → E  (while d_i^E < T_inc)
An exposed individual becomes infectious before symptom onset when:

```
d_i^E ≥ (T_inc − T_pre)
```

During this presymptomatic interval the agent remains in the Exposed compartment but contributes to the force of infection experienced by susceptible individuals.

### E → I  (when d_i^E ≥ T_inc)
The individual transitions to the symptomatic infectious state.

### I → I  (while d_i^I < T_inf)
The infectious state is governed by a deterministic infectious duration.

### I → R  (when d_i^I ≥ T_inf)
Recovery is deterministic upon completion of the infectious period.

Unlike classical compartmental SEIR models that assume exponentially distributed recovery through a constant transition probability, the present framework employs explicit duration tracking. This permits disease-specific latent, presymptomatic, and infectious timelines while maintaining a parsimonious SEIR structure.

### Disease-specific parameter values

| Disease       | T_inc (days) | T_pre (days) | T_inf (days) | Silent spread window        |
|---------------|-------------|-------------|-------------|----------------------------|
| COVID-19      | 5           | 2           | 8           | 1–3 days (variant-dependent)|
| Influenza     | 2           | 1           | 5           | ~1 day before symptoms      |
| Measles       | 10          | 4           | 8           | ~4 days before rash onset   |
| Ebola         | 10          | 0           | 10          | Not contagious before symptoms |
| Bubonic Plague| 4           | 0           | 6           | Limited evidence            |

> **Note on uncertainty:** The presymptomatic infectious window varies by strain, individual viral load, symptom definition, and the specific outbreak studied. Values represent working approximations for educational simulation and should not be interpreted as calibrated epidemiological estimates.

---

## 3.5 Transmission Kernel

On each simulated day, the force of infection experienced by susceptible individual i is:

```
λ_i = (β/N) × Σ_{j ∈ Φ} d_{ij}^(−α)
```

where:
- Φ = set of currently infectious agents (presymptomatic E + symptomatic I)
- d_{ij} = Euclidean distance between individuals i and j
- β = baseline transmission intensity parameter
- α = spatial decay parameter
- N = population size (normalisation factor)

The probability of transmission to individual i on a given day is:

```
P(S → E)_i = 1 − exp(−λ_i)
```

The 1/N normalisation ensures that β retains comparable meaning across populations of different sizes. Without this normalisation, the summed kernel over large infectious populations can cause transmission probabilities to saturate to unity within a single time step.

### 3.5.1 Dual-Kernel Formulation (COVID-19)

COVID-19 transmission is approximated using a dual-kernel formulation combining aerosol (long-range) and droplet/contact (short-range) routes:

```
λ_i^COVID = (β/N) × Σ_{j ∈ Φ} [ 0.5 × d_{ij}^(−0.8) + 0.5 × d_{ij}^(−2.5) ]
```

The aerosol component (α = 0.8) decays slowly with distance, representing airborne spread across a room. The droplet component (α = 2.5) decays sharply, representing close-contact transmission. Equal weighting is an approximation; true route-specific contributions are not separately identifiable in this framework.

---

## 3.6 Transmission History

Each transmission event records the identifier of the infecting agent. For an individual j infected by individual i:

```
p_j = i
c_i = c_i + 1
```

The simulation maintains a complete transmission network throughout execution and allows estimation of realised secondary infections generated by recovered, non-seed cases.

---

## 3.7 Transmission Efficiency Metric

The Transmission Efficiency (TE) metric is computed as the mean number of secondary infections generated by completed, non-seed cases:

```
TE = Σ_{i ∈ C} c_i  /  |C|

where C = { i : state_i = R  and  seed_i = false }
```

Seed cases (the Y_0 individuals infected at initialisation) are excluded from the denominator because they were not generated by the model's transmission process. Including them would cause the metric to depend on the user's choice of Y_0 rather than reflecting disease transmission dynamics.

> **Important distinction:** TE is the empirical mean secondary infections computed directly from simulated infection chains. It is not an estimated R_t. No generation interval assumption, renewal equation, or statistical estimator is applied. The metric reflects the specific stochastic realisation of a single simulation run and should be interpreted accordingly.

---

## 3.8 Initialisation

Y_0 individuals are selected uniformly at random and assigned to the Exposed state at day 0 with seed_i = true. The simulation advances in discrete daily time steps until either:

1. No individuals remain in states E or I (epidemic resolved), or
2. 300 days have elapsed (safety termination condition).

---

*Ref: Deardon, R., Brooks, S.P., Grenfell, B.T., et al. (2010). Inference for individual-level models of infectious diseases in large populations. Statistica Sinica, 20(1), 239–261.*
