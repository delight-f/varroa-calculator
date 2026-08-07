# Varroa Model — Description for Author Confirmation

**Source workbook:** `Randys-Varroa-Model-V2026 Web(1).xlsx` (© Randy Oliver)
**Sheet described:** "Current version"
**Date of this document:** 2026-08-07

This document describes, in detail, the model as extracted from the workbook and
reimplemented in Python (`varroa_model.py`).  It is written so that the original
author can confirm that the description is a faithful account of his work.

The Python implementation reproduces every cached value of the workbook's
"Current version" sheet to within ~1e-12 (see `validate.py`), so this document
is what the code actually does.

---

## 1. Purpose of the model

A discrete-time simulation of the mite population (*Varroa destructor*) of a
single honey-bee colony over **24 half-month periods** (one year).  It computes
how the mite population grows under given colony conditions (frames of bees,
frames of brood, % drone brood), with or without mite treatments.  The headline
output is the **r value** — the net daily rate of mite population increase —
per period, and the season total between 15 Apr and 15 Sep.

## 2. Time step and units

| Quantity | Value | Notes |
|---|---|---|
| Periods per year | 24 | half-month periods |
| Days per period (growth) | 15.2083 (= 365/24) | cell BQ37 |
| Days between period dates | 15 | period dates are exactly 15 days apart |
| Unit of every rate | per day | |

> **Note for confirmation:** the workbook uses 15.2083 days for exponential
> growth but advances period dates by exactly 15 days.  This is internally
> inconsistent (15.21 vs 15).  The Python keeps the spreadsheet's 15.2083.

## 3. User inputs

| Input | Cell | Default |
|---|---|---|
| Colony type (d, n, p, a, b, c, r, s, f) | D22 | d |
| Starting mite population | D23 | 100 |
| Immigration setting (0–4, or "x" custom) | D24 | 0 |
| Southern hemisphere flag | AC21 (enter "x") | Northern |
| Custom resistance mode | AH39 (enter "custom") | off |
| Treatment kills per period | row 21 (D21:AA21) | 0.8 at S21 (period 16) |

### Mite biology parameters

Defaults in column AH; custom values in column AI (used when AH39 = "custom").

| Symbol | Meaning | Default | Custom |
|---|---|---|---|
| n_d | daughters per foundress per cycle, worker cells | 1.45 | 0.725 |
| m_d | fraction of daughters viable & mated, worker | 0.7 | 0.7 |
| n_D | daughters per foundress per cycle, drone cells | 3.5 | 3.5 |
| m_D | fraction viable & mated, drone | 0.7 | 0.7 |
| v | VSH/uncapping reduction on worker daughters | 0.05 | 0.05 |
| μ₀ | daily mite mortality, broodless | 0.005 | 0.005 |
| μ₁ | daily mite mortality, during broodrearing | 0.005 | 0.005 |
| e | mite multiplier on non-returning bees | 0.6 | 0.6 |
| a | phoretic-period intercept (days) | 5 | 5 |
| b | phoretic-period slope (days/ln-unit) | 5 | 4.5 |
| s_p | survival of pupa to adult | 0.95 | 0.95 |
| f_m | fraction of mites mated | 0.7 | 0.7 |

### Fixed conversions

| Symbol | Value | Meaning |
|---|---|---|
| B | 2000 | adult bees per fully-covered frame (BQ45) |
| C | 4500 | brood cells per frame at 65% cover (BQ44) |
| T | 15.2083 | days per period (BQ37) |
| κ | 16/25 | drone % by area → drone % by cell count |
| — | 315 | bees in the ½-cup alcohol-wash sample |
| — | 0.9 | fraction of capped brood that emerges as adults |

## 4. Colony-state derivation (per period *i*)

From the colony-type curve: `F_brd` = frames of brood (col G of "Colony Type"),
`F_bee` = frames of bees (col I), `d_a` = % drone brood by **area** (col K).

```
adult_bees  = F_bee * B                                     (BR)
brood_cells = C * F_brd,   or 1 if F_brd == 0               (BT)
brood_ratio = brood_cells / adult_bees                      (BU)
```

**Phoretic period** (BY) — after Boot (1995), fit by Oliver to a log curve:

```
days_phoretic = a - b * ln(brood_ratio)
```

- `brood_ratio → 0` is clipped to 0.001 before the log;
- when there are no brood frames, 100% of mites are phoretic.

**Distribution of mites** (CA = % phoretic, CB = % in brood):

```
CA = days_phoretic / (days_phoretic + 12)   (12 d = worker sealed duration)
CB = 1 - CA
```

**Brood-cell structure:**

```
sealed_cells     = 0.6 * brood_cells         (CD)  (12 of 20 days sealed)
d_c              = d_a * 16/25               (CF)  % drone cells by count
r_pref           = d_c * b                   (CG)  % of brood mites in drone brood
% mites in drone brood   CH = r_pref * CB
% mites in worker brood  CQ = 1 - CA - CH
```

> **Note for confirmation:** the same parameter `b` (the phoretic slope) is
> *also* used as the drone-cell invasion preference factor.  In custom mode the
> spreadsheet changes only the preference (to 4.5) and leaves the phoretic
> slope at 5 — the two uses share one cell (BQ43).  Please confirm this is
> intended.

## 5. Reproduction rates (per day)

A foundress entering a brood cell produces daughters over one reproductive
cycle; the per-day rate is `ln(daughters_per_cycle)/days_in_cell` with
**fixed** cell durations 12.5 d (worker) and 14.75 d (drone).

```
drone:   R_D = (1 + n_D) * s_p ;      r_D = ln(R_D) / 14.75      (CP)
worker:  R_w = (1 + n_d*(1-v)) * s_p ; r_w = ln(R_w) / 12.5      (DA)
         r_w = 0  when  mites_start > 2 * worker_sealed_cells
```

**Potential daily r from reproduction** (DB):

```
r_repro = CH * r_D + CQ * r_w
```

**Mortality r** (DC):

```
r_mort = ln(1 - μ₁)  if brood_ratio > 0.25,  else ln(1 - μ₀)
        (both defaults 0.005, so r_mort = -0.0050125 all year)
```

**Net intrinsic r** (DD):  `r_net = r_repro + r_mort`

> **Note for confirmation:** the "custom" mode's halved worker reproduction
> (n_d 1.45 → 0.725) is the only biology that changes; everything else in
> custom mode is cosmetic.

## 6. Population dynamics (per period)

Let `M` = mites at start of period (DF), `φ` = fraction of the population
reproductively "spent" (>75 days old, §7).

```
mated       = M * f_m                                  (DG)
reproducing = mated * (1 - φ)                          (DH)
new_mites   = reproducing * (exp(r_repro * T) - 1)     (DI)
after_repro = M + new_mites                            (DJ)
after_mort  = after_repro * exp(r_mort * T)            (DL)
```

**Drift** (immigration in `DM`, loss on non-returning bees in `DN`):

```
immigration  = look-up table by setting and period
phoretic     = M * CA                                  (DV)
infest_rate  = phoretic / adult_bees                   (DW)
exit_mult    = 1       if infest_rate > 0.15           (EG)
               e (=0.6) otherwise
emerging     = brood_cells_{i-1} * 0.9 / 20 * T        (EC)
bee_deaths   = emerging - (adult_bees_i - adult_bees_{i-1})   (EE)
mite_loss    = bee_deaths * exit_mult * infest_rate    (EH)
drift_out    = -min(mite_loss, phoretic * exit_mult)   (DN)
```

**Treatment and end-of-period state:**

```
pre_treatment = after_mort + immigration + drift_out   (DP)
k             = treatment kill for this period         (DQ)
end           = pre_treatment * (1 - k)                (DS)
r_observed    = ln(end / M) / T                        (DT)
```

The treatment is a single instantaneous kill of a fraction of **all** mites
(total, not just phoretic) at the end of the period.  The author's own note
says real treatments act over days; this is a simplification.

**Special cases for nuc (n) and package (p) colonies:** the mite population is
zero until period 11 (1 April, colony installed), then set to the starting
population.

## 7. Aging adjustment (fraction of "spent" mites)

Mites older than **75 days** (5 periods) are assumed reproductively spent and
removed from the reproducing pool.  The workbook implements this as a
*triangular cohort table* (rows 34–57, columns EK…FH):

- first cell of the first row = the starting population;
- first cell of row *j* = the **new mites** produced in period *j*;
- each cell = previous cell × (1 − kill of that period) × exp(μ₁ × 15).

The spent fraction is

```
φ(t) = (mites in cohorts aged ≥ 5 periods at t) / (all mites at t)
```

and period *p* uses `φ(p−2)` (a two-period lag), except:

- period 1: no adjustment (φ = 0);
- period 2: arbitrary seed φ = 0.5 (cell EL5);
- periods 3–7: φ = 0 (workbook output cells empty);
- nuc/package types: period 11 uses 0.5, period 12 uses 0.15.

φ is capped at 0.99.  Only the fraction matters; the table totals need not
equal the simulated population.

> **Notes for confirmation:**
> - The aging adjustment reads the age structure from **two periods earlier**
>   and has an arbitrary 0.5 seed in period 2.  Please confirm the two-period
>   lag and the seed are intended.
> - Periods 3–7 have empty φ cells in the workbook (treated as zero here).

## 8. Treatments and immigration

**Treatments:** the user types the fractional kill (0–1) for each of the 24
periods into row 21.  The "Current version" sheet ships with a single 0.8 in
S21 (period 16, mid-June oxalic).  Column BH carries annotated reference
efficacies (amitraz 0.95, Apiguard 0.90, formic 0.90, oxalic broodless
0.80–0.95, sugar dust 0.25, drone-brood removal 0.15–0.20, swarm ≈ 0.35).

**Immigration:** per-period mite influx from drift (sheet "Mite Immigration"):

| Periods | Setting 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 11–20 | 0 | 1–25 | 2–50 | 5–125 | 10–210 |
| all others | 0 | 0 | 0 | 0 | 0 |

(Maximum at periods 16–18; the column gives drift-season inflow.)

## 9. Colony types

Nine curves in the "Colony Type" sheet, each giving 24 values of frames of
bees, frames of brood, and % drone brood by area:

- **d** Default colony, temperate climate, managed to prevent swarming
- **n** Nucleus
- **p** Package
- **a** Subtropical, no brood break
- **b** High latitude, brood break
- **c** Almond pollinator
- **r** Small swarm survivor/feral
- **s** Small swarm feral, re-queened
- **f** Feral with swarm reductions

## 10. Known quirks / bugs (flagged for the author)

1. **Period length**: growth uses 15.2083 d but dates advance by exactly 15 d.
2. **Fixed cell-duration constants** (12.5 / 14.75) ignore the model's own
   seasonally varying cycle lengths (`days_phoretic + 12` / `+ 15`); the
   phoretic day-count only affects the phoretic/brood split, not the per-day
   reproductive rate.
3. **`b` overloaded**: phoretic slope = drone-cell invasion preference (one
   cell, BQ43); custom mode changes only the latter (to 4.5).
4. **Aging seed** (period 2 = 0.5) and **aging lag** (period *p* uses age
   structure of *p−2*; periods 3–7 φ = 0).
5. **Reproduction/mortality order**: new mites suffer the same natural
   mortality as the existing population; foundress mortality is counted both in
   s_p (0.95) and in r_mort.
6. **`DK = DJ − DL` is circular** (references DL, which references DJ); unused.
7. **Density dependence is weak**: the only density terms are the
   `mites > 2 × worker sealed cells → r_w = 0` cutoff and the brood:bee-ratio
   effect on phoretic time; the "density adjustment" columns (CN, CY) are
   hard-coded to 1.
8. **Crash indicators** (DY/DZ/EA) blank the displayed table once worker-cell
   invasion > 50% or the wash > 60 — an arbitrary display convention, not a
   population mechanism.
9. Several cells use `#REF!` named ranges; the "About this model" and "Notes
   for this version" sheets are empty.

## 11. Validation status

- Python implementation: `varroa_model.py`
- Validation: `validate.py` compares all 24 periods of the "Current version"
  run (colony d, 100 mites, 0.8 treatment at period 16) against the workbook's
  cached values.
- Result: **all periods match to max abs error 5.457e-12.**

---

## Appendix — the other sheets (variants)

The workbook also contains two variant sheets, described for completeness.  An
implementation of these is **not** included in `varroa_model.py`.

### "Density adjusted" sheet

A copy of the model with the density-adjustment machinery present but **not
active**: it computes per-cell invasion statistics (mean mites per sealed
worker/drone cell, % cells invaded via a Poisson, mean mites per invaded
cell) but the actual density adjustment factors (columns CP "Density adj for
no. of daughters" for drone, DA for worker) are hard-coded to **1**.  So the
sheet currently behaves like the base model; the density adjustment is
scaffolding for a planned effect (daughters per foundress reduced as cells
become crowded).

### "Brood break" sheet

A copy of the model that lets the user force a brood break by entering **"B"**
in column AD for the desired periods; this zeroes reproduction for those
periods.  It also uses the high-latitude colony type **b** by default, which
itself contains a natural broodless winter period.  The sheet additionally
reports separate crash indicators for "with brood" and "broodless" periods.
The base Python model already handles broodless periods naturally via the
colony-type curve (no brood frames → 100% phoretic, no reproduction); the
manual "B" toggle is the only added mechanism.

**Implemented as:** `VarroaModel(..., brood_break_periods=[10, 11])` forces
`new_mites = 0` for the listed periods, so the population declines by natural
mortality alone through the break and resumes growth afterwards.
