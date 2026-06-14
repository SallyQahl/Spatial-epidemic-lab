# Model Assumptions and Limitations

This document records the explicit assumptions and known limitations of the Spatial Epidemic Research Lab simulator (v1.1). Scientific honesty about model scope is as important as the model itself.

---

## What the model assumes

**Population structure**
- Fixed population of N individuals; no births, deaths, or migration
- Individuals are placed at fixed spatial locations throughout the simulation (no mobility)
- Household clustering with fixed household size of 4; no age structure within households
- Susceptibility is homogeneous — all susceptible individuals are equally at risk given the same force of infection

**Transmission**
- Transmission depends only on Euclidean distance between individuals; no barriers, rooms, or building structure
- The spatial kernel (power-law distance decay) is the same for all pairs of individuals
- No environmental transmission (no fomites, no shared air volume modelling)
- Transmission probability is stationary — no time-varying contact rates, no seasonality

**Disease progression**
- Deterministic progression timelines after infection (no individual variation in latency or infectious period)
- All exposed individuals eventually become infectious; no immune non-progressors
- All infectious individuals eventually recover; no disease-induced mortality
- Recovered individuals are permanently immune; no waning immunity, no reinfection

**Model scope**
- Single pathogen, single strain; no co-circulation, no variant emergence
- No interventions are modelled mechanistically (no vaccination, isolation, or quarantine built into the transmission process; the alert panel provides qualitative recommendations only)
- One simulation run per execution; outcomes reflect a single stochastic realisation

---

## What the model does not capture

The following factors are absent from the current framework. Their omission is intentional for parsimony and clarity; their inclusion would constitute a substantially more complex agent-based model.

| Absent feature | Consequence for simulation output |
|---|---|
| Contact networks | Transmission treats all nearby individuals as equally contactable; in reality people have structured contact patterns |
| Workplace and school structure | No activity-based mixing; individuals do not move between locations |
| Mobility patterns | Individuals cannot travel; no importation of cases from outside the domain |
| Viral load variation | All infectious individuals contribute equally to the force of infection |
| Age-stratified susceptibility | Children and elderly are not at differential risk |
| Indoor vs outdoor transmission | Aerosol accumulation in enclosed spaces is not modelled |
| Vaccination and prior immunity | No proportion of the population starts immune |
| Behavioral adaptation | Individuals do not change behaviour in response to rising case counts |
| Quarantine and isolation | Infectious individuals are not removed from the transmission process |
| Asymptomatic cases | All exposed individuals become symptomatic; no fully asymptomatic pathway |
| Multiple strains | No variant emergence, immune escape, or co-circulation |
| Waning immunity | Recovered individuals do not return to susceptibility |
| Stochastic disease progression | Latent and infectious periods are fixed per disease; no individual variation |

---

## On disease parameter values

The disease-specific parameter values (incubation periods, presymptomatic windows, infectious periods, transmission intensity) are working approximations chosen to produce qualitatively plausible epidemic dynamics for educational purposes.

They are **not** calibrated to specific outbreak data. The presymptomatic infectious window in particular carries substantial empirical uncertainty and varies by strain, viral load, individual biology, and how "contagious" is operationally defined in any given study.

These values should not be cited as authoritative epidemiological estimates.

---

## On the Transmission Efficiency metric

The Transmission Efficiency (TE) displayed during simulation is the empirical mean secondary infections from a single stochastic run, computed over recovered non-seed cases. It is not:

- An estimate of R_t (no generation interval or renewal equation is used)
- A population-level reproduction number
- A statistic with known sampling uncertainty

Repeated runs with identical parameters will produce different TE values due to stochasticity. TE should be interpreted as a descriptive summary of one simulation run, not as an epidemiological parameter estimate.

---

## Relationship to established model classes

This simulator is a **spatial individual-level model (ILM)** in the tradition of Deardon et al. (2010). It is not:

- A compartmental ODE/SDE model (no differential equations; discrete time)
- A full agent-based model (no contact networks, activity schedules, or mobility)
- A network model (no explicit contact graph)
- A calibrated inference framework (no likelihood, no parameter estimation from data)

It occupies the space between a simple compartmental model and a full agent-based simulation: more spatially realistic than ODE models, less behaviourally detailed than full ABMs.

---

*Ref: Deardon, R., Brooks, S.P., Grenfell, B.T., et al. (2010). Inference for individual-level models of infectious diseases in large populations. Statistica Sinica, 20(1), 239–261.*
