# Randy Oliver's Varroa Model — extracted specification

This document is a clean, faithful description of the mathematical model inside
`Randys-Varroa-Model-V2026 Web(1).xlsx` (sheet **"Current version"**, © Randy
Oliver).  It is a discrete-time simulation of the mite population of a honey-bee
colony over **24 half-month periods** (the year).  It predicts the rate of rise
of *Varroa destructor*, with or without treatments.

The reference implementation is `varroa_model.py` (validated against the
workbook to ~1e-12 in `validate.py`).  Cell addresses below refer to the
"Current version" sheet so the original can be checked.

---

## 1. Overview

Each period the model:

1. reads the colony state (frames of adult bees, frames of brood, % drone brood
   by area) for that date from a *colony-type curve*;
2. derives the **days a mite spends phoretic** (waiting on adult bees before
   invading a brood cell) from the **brood : adult-bee ratio** — the "heart of
   the model";
3. splits the mite population into *phoretic* vs *in brood*, and within brood
   into *drone* vs *worker* cells;
4. converts daughters-per-reproductive-cycle and cell duration into a **daily
   intrinsic growth rate r** (separately for drone and worker brood);
5. applies reproduction, natural (phoretic) mortality, immigration/drift and any
   **treatment kill** to update the mite population;
6. tracks the *age structure* so that old (>75 day) mites are treated as
   non-reproductive.

The headline output is the **r value** — the net daily rate of mite increase per
period — and its integral over the growing season (the workbook quotes
`ln(N_end/N_start)/days` between Apr 15 and Sep 15; e.g. AX25).

**Note on units:** every rate is *per day*.  The period length used in the
exponential growth terms is `365/24 = 15.2083` days (cell BQ37) — while the
period *dates* are exactly 15 days apart.  The workbook is internally
inconsistent here (15.21 vs 15); the extraction keeps the spreadsheet's 15.2083.

---

## 2. User inputs

| Input | Cell | Default |
|---|---|---|
| Colony type (d,n,p,a,b,c,r,s,f) | D22 | d |
| Starting mite population | D23 | 100 |
| Immigration setting (0–4, x=custom) | D24 | 0 |
| Hemisphere ("x" in AC21 = Southern) | AC21 | — |
| Custom resistance mode ("custom") | AH39 | — |

### Mite-resistance / reproduction parameters

Defaults are in column AH; custom values in column AI (used when AH39="custom").

| Symbol | Meaning | Default | Custom |
|---|---|---|---|
| n_d | daughters/foundress/cycle, worker cells | 1.45 | 0.725 |
| m_d | fraction of daughters viable & mated (worker) | 0.7 | 0.7 |
| n_D | daughters/foundress/cycle, drone cells | 3.5 | 3.5 |
| m_D | fraction viable & mated (drone) | 0.7 | 0.7 |
| v | VSH/uncapping reduction on worker daughters | 0.05 | 0.05 |
| μ₀ | daily mite mortality, broodless | 0.005 | 0.005 |
| μ₁ | daily mite mortality, during broodrearing | 0.005 | 0.005 |
| e | mite multiplier on non-returning bees (low infest.) | 0.6 | 0.6 |
| a | phoretic-period intercept (days) | 5 | 5 |
| b | phoretic-period slope (days/ln-unit) **also drone-invasion preference** | 5 | 4.5 |
| s_p | survival of pupa to adult | 0.95 | 0.95 |
| f_m | fraction of mites mated | 0.7 | 0.7 |

### Fixed conversions

| Symbol | Value | Meaning |
|---|---|---|
| B | 2000 | adult bees per fully-covered frame (BQ45) |
| C | 4500 | brood cells per frame at 65% cover (BQ44) |
| T | 15.2083 | days per period (BQ37 = 365/24) |
| κ | 16/25 | drone % by area → drone % by cell count |
| 315 | 315 | bees in the ½-cup alcohol-wash sample |
| 0.9 | 0.9 | fraction of capped brood that emerges as adults |

---

## 3. Colony-state derivation (per period *i*)

Let the colony-type curve supply: `F_brd` (frames of brood, col G of "Colony
Type"), `F_bee` (frames of bees, col I), `d_a` (% drone brood by **area**, col K).

```
adult_bees  = F_bee * B                          (BR)
brood_cells = C * F_brd,  or 1 if F_brd == 0     (BT)
brood_ratio = brood_cells / adult_bees           (BU)   "brood:bee ratio"
```

**Phoretic period** (BY) — after Boot (1995), fit by Oliver to a log curve:

```
days_phoretic = a - b * ln(brood_ratio)
```

- with `brood_ratio → 0` (no bees) this is taken as 0.001;
- when there are no brood frames, 100% of mites are phoretic.

**Distribution of mites** (CA = % phoretic, CB = % in brood):

```
CA = days_phoretic / (days_phoretic + 12)     (12 d = worker sealed duration)
CB = 1 - CA
```

**Brood-cell structure:**

```
sealed_cells     = 0.6 * brood_cells          (CD)  (12 of 20 days sealed)
d_c              = d_a * 16/25                (CF)  % drone cells
r_pref           = d_c * b                    (CG)  % of brood mites in drone brood
                                                (b doubles as the drone preference factor)
% mites in drone brood   CH = r_pref * CB
% mites in worker brood  CQ = 1 - CA - CH
```

---

## 4. Reproduction rates (per day)

A mite's reproductive cycle is a foundress entering a brood cell; the daily rate
is `ln(R_cycle)/days_in_cell`, with cell-duration constants 12.5 d (worker) and
14.75 d (drone) — *not* the seasonally varying cycle length (see §8).

```
drone:
  R_D = (1 + n_D) * s_p
  r_D = ln(R_D) / 14.75                         (CP)

worker:
  R_w = (1 + n_d*(1-v)) * s_p
  r_w = ln(R_w) / 12.5                          (DA)
        but r_w = 0 when  mites_start > 2 * worker_sealed_cells
```

**Potential daily r from reproduction** (DB):

```
r_repro = CH * r_D + CQ * r_w
```

**Mortality r** (DC):   `r_mort = ln(1 - μ₁)` if brood_ratio > 0.25, else
`ln(1 - μ₀)`.  (Both defaults are 0.005, so `r_mort = -0.0050125` all year.)

**Net intrinsic r** (DD):  `r_net = r_repro + r_mort`

---

## 5. Population dynamics (per period)

Let `M` = mites at start of period (DF), `φ` = fraction of the population that
is "spent" (>75 d old, §6).

```
mated       = M * f_m                                 (DG)
reproducing = mated * (1 - φ)                         (DH)
new_mites   = reproducing * (exp(r_repro * T) - 1)    (DI)
after_repro = M + new_mites                           (DJ)
after_mort  = after_repro * exp(r_mort * T)           (DL)
```

**Drift** (immigration in `DM`, loss on non-returning bees in `DN`):

```
immigration  = look-up table by setting and period
phoretic     = M * CA                                 (DV)
infest_rate  = phoretic / adult_bees                  (DW)
exit_mult    = 1        if infest_rate > 0.15          (EG)
               e (=0.6) otherwise
emerging     = brood_cells_{i-1} * 0.9 / 20 * T       (EC)  adults emerging
bee_deaths   = emerging - (adult_bees_i - adult_bees_{i-1})   (EE)
mite_loss    = bee_deaths * exit_mult * infest_rate   (EH)
drift_out    = -min(mite_loss, phoretic * exit_mult)  (DN)
```

**Treatment and end-of-period state:**

```
pre_treatment = after_mort + immigration + drift_out   (DP)
k             = treatment kill for this period         (DQ)  user entry, row 21
end           = pre_treatment * (1 - k)                (DS)
r_observed    = ln(end / M) / T                        (DT)
```

The treatment is a single instantaneous kill of a fraction of **all** mites
(total, not just phoretic) applied at the end of the period — a simplification
the author notes (real treatments act over days).

**Special cases for nuc (n) and package (p) colonies:** the mite population is
zero until period 11 (1 April, when the colony is installed), at which point it
is set to the starting population.

---

## 6. Aging adjustment (fraction of "spent" mites)

Mites older than **75 days** (5 periods) are assumed reproductively spent, and
are removed from the reproducing pool.  The workbook implements this as a
*triangular cohort table* (rows 34–57, columns EK…FH):

- row 34, first cell = the starting population;
- the first cell of row *j* = the **new mites** produced in period *j*;
- each cell = previous cell × `(1 - kill of that period)` × `exp(r_mort_broodrearing * 15)`.

At time *t*, the spent fraction is

```
φ(t) = (mites in cohorts aged ≥ 5 periods at t) / (all mites at t)
```

and period *p* uses `φ(p-2)` (a two-period lag built into the sheet), except:

- period 1: no adjustment (`φ = 0`);
- period 2: arbitrary seed `φ = 0.5` (cell EL5);
- periods 3–7: `φ = 0` (the workbook's output cells are empty);
- nuc/package types: period 11 uses 0.5, period 12 uses 0.15.

`φ` is capped at 0.99.  Only the fraction matters — the table itself is an
approximation and its totals need not equal the simulated population.

---

## 7. Treatments and immigration

**Treatments:** the user types the fractional kill (0–1) for each of the 24
periods into row 21 (D21:AA21).  The "Current version" sheet ships with a
single 0.8 in S21 (period 16, mid-June oxalic).  The BH column holds annotated
reference efficacies (amitraz 0.95, Apiguard 0.90, formic 0.90, oxalic
broodless 0.80–0.95, sugar dust 0.25, drone-brood removal 0.15–0.20, swarm
≈0.35).

**Immigration:** per-period mite influx from drift, chosen by the setting
(sheet "Mite Immigration"):

| Periods | Setting 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 11–20 | 0 | 1–25 | 2–50 | 5–125 | 10–210 |
| all others | 0 | 0 | 0 | 0 | 0 |

(Maximum values at periods 16–18; the column gives drift-season inflow.)

---

## 8. Known quirks / bugs in the spreadsheet

These are the "messy" parts; the clean implementation keeps them so it matches,
but they are worth flagging:

1. **Period length**: growth uses 15.2083 d but dates advance by exactly 15 d.
2. **Cell-duration constants** (12.5 / 14.75) are fixed even though the model
   itself computes seasonally varying cycle lengths (`BY+12`, `BY+15`); the
   phoretic day-count therefore only influences the phoretic/brood split, not
   the per-day reproductive rate.
3. **`b` is overloaded**: the phoretic slope (default 5) is *also* the
   drone-cell invasion preference factor (default 5), and in custom mode the
   drone preference becomes 4.5 while the phoretic slope stays 5 — the sheet
   silently uses the same cell (BQ43) for both.
4. **Aging seed**: period 2 arbitrarily assumes 50% of mites are spent.
5. **Aging lag**: period *p* uses the age structure from time *p−2*, and
   periods 3–7 use φ=0 because the output cells are missing.
6. **Reproduction/mortality order**: new mites are subjected to the same
   natural mortality as the existing population; foundress mortality is counted
   both in `s_p` (0.95) and in `r_mort`.
7. **`DK = DJ - DL` is circular** (references DL which references DJ); unused.
8. **Treatment timing**: one instantaneous total-population kill per period;
   no knock-down/re-invasion dynamics.
9. **Density dependence is weak**: the only density terms are the
   `mites > 2 × worker sealed cells → r_w = 0` cutoff and the
   brood:bee-ratio effect on phoretic time; the "density adjustment" columns
   (CN, CY) are hard-coded to 1.
10. **Crash indicators** (DY/DZ/EA) blank the displayed table once worker-cell
    invasion >50% or the wash >60 — an arbitrary display convention, not a
    population mechanism.
11. Several cells use `#REF!` named ranges; the "About this model" and "Notes
    for this version" sheets are empty of content.

---

## 9. Files

- `varroa_model.py` — clean Python implementation (validated).
- `colony_types.json` — the 9 colony-type curves (24 periods each).
- `immigration.json` — the immigration tables.
- `validate.py` — compares the model against the workbook's cached values.
