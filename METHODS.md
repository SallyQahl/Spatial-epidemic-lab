# Methods

## Spatial SEIR Individual-Level Model — Version 1.1

---

## 3.1 Model Overview

The simulator implements a spatial individual-level model (ILM) within a stochastic SEIR framework. Individuals are represented as discrete agents with known spatial locations and household membership. Transmission occurs probabilistically through a distance-dependent force of infection. Disease progression after infection follows deterministic, disease-specific timelines.

### Model stochasticity

The proposed framework combines stochastic transmission dynamics with deterministic disease progression. Transmission events are probabilistic and occur through repeated Bernoulli trials derived from the spatial force of infection. Consequently, identical parameter settings may produce substantially different outbreak trajectories across simulation runs.

Once an individual becomes infected, progression through disease states follows deterministic disease-specific timelines defined by the incubation, presymptomatic infectious, and infectious periods. This design separates uncertainty associated with transmission from uncertainty associated with disease progression, improving interpretability while preserving stochastic outbreak behaviour.

---

## 3.2 Population Generation

A population of $N$ individuals is generated within a rectangular spatial domain of dimensions $W = 100 \times \text{size}$ and $H = 58 \times \text{size}$, where `size` is a user-specified area multiplier.

### 3.2.1 Household Clustering

Individuals are organised into households of fixed size $H_s = 4$. Household centres $(\bar{x}_h, \bar{y}_h)$ are placed uniformly at random within the domain. Each individual is positioned at a small random displacement from their household centre:

$$x_i = \bar{x}_{h_i} + U(-\delta, \delta), \quad y_i = \bar{y}_{h_i} + U(-\delta, \delta)$$

where $\delta = 3.5$ domain units and $h_i$ denotes the household of individual $i$.

No household-specific transmission multiplier is applied. Intra-household transmission is driven entirely by spatial proximity through the distance kernel. This avoids the double-counting problem that arises when both a distance kernel and a household multiplier are simultaneously active.

---

## 3.3 Individual-Level Disease Representation

Each individual agent $i$ is characterised by a disease state, spatial location, household membership, and transmission history. The following attributes are maintained throughout the simulation:

- Household identifier $h_i$
- Exposure duration counter $d_i^E$
- Infectious duration counter $d_i^I$
- Seed case flag $\text{seed}_i \in \{\text{true}, \text{false}\}$
- Infector identifier $p_i$
- Secondary infection count $c_i$

The infector identifier records the source of infection for each transmission-generated case and is undefined for seed infections introduced at initialisation. Secondary infection counts are updated dynamically whenever an infected agent successfully transmits infection to a susceptible individual.

---

## 3.4 Disease Progression

Each disease profile is parameterised by:

- Incubation period $T_{\text{inc}}$
- Presymptomatic infectious period $T_{\text{pre}}$
- Infectious period $T_{\text{inf}}$

where $T_{\text{pre}} \leq T_{\text{inc}}$.

### $S \to E$

Transmission occurs probabilistically through the spatial force of infection (Section 3.5).

### $E \to E$ while $d_i^E < T_{\text{inc}}$

An exposed individual becomes infectious before symptom onset when:

$$d_i^E \geq T_{\text{inc}} - T_{\text{pre}}$$

During this presymptomatic interval the agent remains in the Exposed compartment but contributes to the force of infection experienced by susceptible individuals.

### $E \to I$ when $d_i^E \geq T_{\text{inc}}$ (deterministic)

### $I \to I$ while $d_i^I < T_{\text{inf}}$

### $I \to R$ when $d_i^I \geq T_{\text{inf}}$ (deterministic)

Unlike classical compartmental SEIR models that assume exponentially distributed recovery through a constant transition probability $\gamma$, the present framework employs explicit duration tracking. This permits disease-specific latent, presymptomatic, and infectious timelines while maintaining a parsimonious SEIR structure.

### Disease-specific parameter values

| Disease        | $T_{\text{inc}}$ | $T_{\text{pre}}$ | $T_{\text{inf}}$ | Silent spread window            |
|----------------|-----------------|-----------------|-----------------|--------------------------------|
| COVID-19       | 5               | 2               | 8               | 1–3 days (variant-dependent)   |
| Influenza      | 2               | 1               | 5               | ~1 day before symptoms         |
| Measles        | 10              | 4               | 8               | ~4 days before rash onset      |
| Ebola          | 10              | 0               | 10              | Not contagious before symptoms |
| Bubonic Plague | 4               | 0               | 6               | Limited evidence               |

> **Note on uncertainty:** The presymptomatic infectious window varies by strain, individual viral load, symptom definition, and the specific outbreak studied. Values represent working approximations for educational simulation and should not be interpreted as calibrated epidemiological estimates.

---

## 3.5 Transmission Kernel

On each simulated day, the force of infection experienced by susceptible individual $i$ is:

$$\lambda_i = \frac{\beta}{N} \sum_{j \in \Phi} d_{ij}^{-\alpha}$$

where:
- $\Phi$ = set of currently infectious agents (presymptomatic $E$ + symptomatic $I$)
- $d_{ij}$ = Euclidean distance between individuals $i$ and $j$
- $\beta$ = baseline transmission intensity parameter
- $\alpha$ = spatial decay parameter
- $N$ = population size (normalisation factor)

The probability of transmission to individual $i$ on a given day is:

$$P(S \to E)_i = 1 - \exp(-\lambda_i)$$

The $1/N$ normalisation ensures that $\beta$ retains comparable meaning across populations of different sizes. Without this normalisation, the summed kernel over large infectious populations can cause transmission probabilities to saturate to unity within a single time step.

### 3.5.1 Dual-Kernel Formulation (COVID-19)

COVID-19 transmission is approximated using a dual-kernel formulation combining aerosol (long-range) and droplet/contact (short-range) routes:

$$\lambda_i^{\text{COVID}} = \frac{\beta}{N} \sum_{j \in \Phi} \left[ 0.5 \cdot d_{ij}^{-0.8} + 0.5 \cdot d_{ij}^{-2.5} \right]$$

The aerosol component ($\alpha = 0.8$) decays slowly with distance, representing airborne spread across a room. The droplet component ($\alpha = 2.5$) decays sharply, representing close-contact transmission. Equal weighting is an approximation; true route-specific contributions are not separately identifiable in this framework.

---

## 3.6 Transmission History

Each transmission event records the identifier of the infecting agent. For an individual $j$ infected by individual $i$:

$$p_j = i, \quad c_i = c_i + 1$$

The simulation maintains a complete transmission network throughout execution and allows estimation of realised secondary infections generated by recovered, non-seed cases.

---

## 3.7 Transmission Efficiency Metric

The Transmission Efficiency (TE) metric is computed as the mean number of secondary infections generated by completed, non-seed cases:

$$\text{TE} = \frac{\sum_{i \in C} c_i}{|C|}, \quad C = \{i : \text{state}_i = R \text{ and } \text{seed}_i = \text{false}\}$$

Seed cases (the $Y_0$ individuals infected at initialisation) are excluded from the denominator because they were not generated by the model's transmission process. Including them would cause the metric to depend on the user's choice of $Y_0$ rather than reflecting disease transmission dynamics.

> **Important distinction:** TE is the empirical mean secondary infections computed directly from simulated infection chains. It is not an estimated $R_t$. No generation interval assumption, renewal equation, or statistical estimator is applied. The metric reflects the specific stochastic realisation of a single simulation run and should be interpreted accordingly.

---

## 3.8 Initialisation

$Y_0$ individuals are selected uniformly at random and assigned to the Exposed state at day 0 with $\text{seed}_i = \text{true}$. The simulation advances in discrete daily time steps until either:

1. No individuals remain in states $E$ or $I$ (epidemic resolved), or
2. 300 days have elapsed (safety termination condition).

---

*Ref: Deardon, R., Brooks, S.P., Grenfell, B.T., et al. (2010). Inference for individual-level models of infectious diseases in large populations. Statistica Sinica, 20(1), 239–261.*
