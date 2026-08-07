"""Clean re-implementation of Randy Oliver's Varroa Model (V2026).

Extracted from "Randys-Varroa-Model-V2026 Web(1).xlsx", sheet "Current version".

The model simulates the mite population of a honey-bee colony over 24 half-month
periods.  Each period the colony's brood/bee state is read from a colony-type
curve, the fraction of mites in brood vs phoretic is derived from a phoretic
period that depends on the brood:adult-bee ratio (after Boot), reproduction of
the in-brood mites is computed from daughters-per-cycle and cycle lengths, then
mortality, immigration/drift and treatment kills are applied.

Units: population counts (mites, bees, cells); time in days.  All rates are
*per day*; the period length is 365/24 = 15.2083 days (the spreadsheet dates
are 15 days apart -- one of the internal inconsistencies of the original).

The implementation follows the spreadsheet's arithmetic exactly so that its
output can be validated cell-by-cell against the workbook.
"""

import math
import json
import os
from dataclasses import dataclass, field
from typing import List

HERE = os.path.dirname(os.path.abspath(__file__))
_CT = json.load(open(os.path.join(HERE, "colony_types.json")))
_IM = json.load(open(os.path.join(HERE, "immigration.json")))

# Period length used by every growth/mortality exponential (365/24).
PERIOD_DAYS = 365.0 / 24.0


@dataclass
class Params:
    """All adjustable parameters, with the spreadsheet defaults."""

    # --- reproduction (worker brood) ---
    worker_daughters: float = 1.45          # mean no. daughters/foundress/cycle
    vsh_reduction: float = 0.05             # fraction of foundresses removed by VSH/uncapping
    frac_mated: float = 0.7                 # fraction of daughters viable & mated
    worker_density_adj: float = 1.0         # density adjustment (hardcoded 1 in workbook)
    # --- reproduction (drone brood) ---
    drone_daughters: float = 3.5
    drone_density_adj: float = 1.0
    # --- common ---
    pupa_survival: float = 0.95             # survival of pupa to adult (multiplies (1+daughters))
    worker_cell_days: float = 12.5          # divisor for worker r/day (sealed-days equivalent)
    drone_cell_days: float = 14.75          # divisor for drone r/day
    # --- mortality ---
    mort_broodless: float = 0.005           # daily mite mortality, no brood
    mort_broodrearing: float = 0.005        # daily mite mortality during broodrearing
    brood_ratio_threshold: float = 0.25     # brood:bee ratio above which broodrearing mort. applies
    # --- phoretic period (after Boot): days_phoretic = intercept - slope*ln(brood:bee) ---
    phoretic_intercept: float = 5.0
    phoretic_slope: float = 5.0             # also used as the drone-cell invasion preference factor
    # --- drift / exiting bees ---
    exit_multiplier_low: float = 0.6        # mite multiplier on exiting bees at low infestation
    # --- colony conversions ---
    bees_per_frame: float = 2000.0
    cells_per_brood_frame: float = 4500.0
    # --- crash indicators ---
    crash_cell_invasion: float = 0.5        # worker cell invasion rate that flags collapse
    crash_wash: float = 60.0                # alcohol-wash count that flags collapse
    # --- aging ---
    spent_age_days: float = 75.0            # mites older than this are non-reproductive
    # --- fixed conversion factors in the workbook ---
    drone_cell_frac_convert: float = 16.0 / 25.0   # % drone by area -> % drone by cell count
    wash_bees: float = 315.0                # bees in a 1/2-cup alcohol wash sample
    emergence_frac: float = 0.9             # fraction of capped brood that emerges as adults

    @property
    def worker_daughters_eff(self) -> float:
        """BQ30: daughters/cycle after the VSH reduction."""
        return self.worker_daughters * (1.0 - self.vsh_reduction)

    @property
    def r_mort_broodless(self) -> float:
        return math.log(1.0 - self.mort_broodless)

    @property
    def r_mort_broodrearing(self) -> float:
        return math.log(1.0 - self.mort_broodrearing)


@dataclass
class PeriodResult:
    """Everything the spreadsheet computes for one period."""

    period: int
    date: str
    frames_bees: float
    frames_brood: float
    drone_area_frac: float
    adult_bees: float            # BR
    brood_cells: float           # BT
    brood_ratio: float           # BU = brood cells / adult bees
    phoretic_days: float         # BY
    pct_phoretic: float          # CA
    pct_in_brood: float          # CB
    drone_pref_frac: float       # CG: fraction of brood-reproducing mites in drone brood
    pct_mites_drone: float       # CH
    pct_mites_worker: float      # CQ
    drone_r_day: float           # CP
    worker_r_day: float          # DA
    r_repro: float               # DB
    r_mortality: float           # DC
    r_net: float                 # DD
    mites_start: float           # DF
    new_mites: float             # DI
    after_repro: float           # DJ
    after_mort: float            # DL
    immigration: float           # DM
    drift_out: float             # DN
    drift_net: float             # DO
    pre_treatment: float         # DP
    kill: float                  # DQ
    mites_end: float             # DS
    r_observed: float            # DT
    pct_cells_invaded: float     # CU (worker cells invaded)
    wash_count: float            # DX
    frac_spent: float            # fraction of mites > 75 days old (used next period)
    crashed: bool


@dataclass
class Run:
    params: Params
    periods: List[PeriodResult] = field(default_factory=list)
    mite_trajectory: List[float] = field(default_factory=list)
    wash_trajectory: List[float] = field(default_factory=list)
    r_trajectory: List[float] = field(default_factory=list)


class VarroaModel:
    def __init__(
        self,
        colony_type: str = "d",
        initial_mites: float = 100.0,
        immigration_setting: int = 0,
        treatment_kills: List[float] = None,
        params: Params = None,
        southern_hemisphere: bool = False,
        brood_break_periods: List[int] = None,
    ):
        self.colony_type = colony_type.lower()
        self.initial_mites = initial_mites
        self.immigration_setting = immigration_setting
        self.treatment_kills = list(treatment_kills or [0.0] * 24)
        self.params = params or Params()
        self.southern = southern_hemisphere
        # periods (1-24) on which reproduction is forced to zero ("brood break"
        # toggle, as in the workbook's "Brood break" sheet, column AD).
        self.brood_break = set(brood_break_periods or [])

    # ------------------------------------------------------------------
    # inputs
    # ------------------------------------------------------------------
    def colony_state(self, period: int):
        """(frames of brood, frames of bees, % drone brood by area) for a period.

        Empty cells in the workbook's colony-type curves behave as zero in
        arithmetic, so None is returned as 0.0.
        """
        d = _CT[self.colony_type.upper()][period - 1]
        z = lambda v: 0.0 if v is None else float(v)
        return z(d["brood_frames"]), z(d["bee_frames"]), z(d["drone_frac"])

    def immigration(self, period: int) -> float:
        """Mites arriving by drift in this period, given the immigration setting."""
        row = _IM[str(period)]
        val = row[self.immigration_setting]
        return 0.0 if val is None else float(val)

    # ------------------------------------------------------------------
    # colony / mite-state derivation for a period
    # ------------------------------------------------------------------
    def _colony_vars(self, p: int):
        frames_brood, frames_bees, drone_area = self.colony_state(p)
        adult_bees = frames_bees * self.params.bees_per_frame
        brood_cells = self.params.cells_per_brood_frame * frames_brood if frames_brood else 1.0
        brood_ratio = brood_cells / adult_bees if adult_bees else 0.0
        phoretic_days = 0.001 if brood_ratio == 0 else (
            -self.params.phoretic_slope * math.log(brood_ratio) + self.params.phoretic_intercept
        )
        pct_phoretic = 1.0 if frames_brood == 0 else phoretic_days / (phoretic_days + 12.0)
        pct_in_brood = 1.0 - pct_phoretic
        return dict(
            frames_brood=frames_brood, frames_bees=frames_bees, drone_area=drone_area,
            adult_bees=adult_bees, brood_cells=brood_cells, brood_ratio=brood_ratio,
            phoretic_days=phoretic_days, pct_phoretic=pct_phoretic, pct_in_brood=pct_in_brood,
        )

    @staticmethod
    def _r_drone(params: Params) -> float:
        r_cycle = (1.0 + params.drone_daughters * params.drone_density_adj) * params.pupa_survival
        return math.log(r_cycle) / params.drone_cell_days

    def _r_worker(self, params: Params, mites_start: float, worker_sealed_cells: float) -> float:
        r_cycle = (1.0 + params.worker_daughters_eff * params.worker_density_adj) * params.pupa_survival
        if mites_start > 2.0 * worker_sealed_cells:
            return 0.0
        return math.log(r_cycle) / params.worker_cell_days

    # ------------------------------------------------------------------
    # simulation
    # ------------------------------------------------------------------
    def run(self) -> Run:
        params = self.params
        run = Run(params)
        mites = self.initial_mites
        # aging cohort table: list of cohorts; each cohort = list of surviving mites
        # by age class (0 periods old ..), 1 element per period alive.
        # Replicates the workbook's triangular table (rows 34..57, cols EK..FH):
        #   cohort 1 = the starting population (EK34 = DF5);
        #   cohort born at period j>=2 = the new mites of that period (DIj);
        #   each period every cohort survives: x (1-kill) x exp(r_mort_broodrearing*15).
        cohorts = []
        frac_spent_at = {}   # fraction of mites >75 days old, by time index
        prev_brood_cells = None
        prev_adult_bees = None
        crashed = False

        # initial cohort = the starting mite population (EK34 = DF5)
        cohorts.append([mites])

        for period in range(1, 25):
            c = self._colony_vars(period)

            # fraction of the population that is "spent" (>75 days old).
            # The workbook seeds period 2 with an arbitrary 0.5; periods 3..7
            # read empty cells (=> 0); period p>=8 uses the fraction computed
            # at time p-2 from the aging table.
            if self.colony_type in ("n", "p") and period == 11:
                frac_spent = 0.5
            elif self.colony_type in ("n", "p") and period == 12:
                frac_spent = 0.25
            elif period <= 1:
                frac_spent = 0.0
            elif period == 2:
                frac_spent = 0.5
            else:
                frac_spent = frac_spent_at.get(period - 2, 0.0)

            # start-of-period mite population (DF)
            if self.colony_type in ("n", "p"):
                if period == 11:
                    mites_start = self.initial_mites
                elif period == 1:
                    mites_start = 0.0
                else:
                    mites_start = mites  # 0 until period 11
            else:
                mites_start = self.initial_mites if period == 1 else mites

            # distribution of mites into drone / worker brood
            drone_by_cell = c["drone_area"] * params.drone_cell_frac_convert
            drone_repro_frac = min(drone_by_cell * params.phoretic_slope, 1.0)
            pct_mites_drone = drone_repro_frac * c["pct_in_brood"]
            pct_mites_worker = 1.0 - c["pct_phoretic"] - pct_mites_drone

            sealed_cells = 0.6 * c["brood_cells"]
            worker_sealed = (1.0 - drone_by_cell) * sealed_cells

            # reproduction rates
            r_drone_day = self._r_drone(params)
            r_worker_day = self._r_worker(params, mites_start, worker_sealed)
            r_repro = pct_mites_drone * r_drone_day + pct_mites_worker * r_worker_day
            r_mort = (params.r_mort_broodrearing if c["brood_ratio"] > params.brood_ratio_threshold
                      else params.r_mort_broodless)
            r_net = r_repro + r_mort

            # population dynamics
            mated = mites_start * params.frac_mated
            reproductive = mated * (1.0 - frac_spent)
            new_mites = reproductive * (math.exp(r_repro * PERIOD_DAYS) - 1.0)
            if period in self.brood_break:
                new_mites = 0.0
            after_repro = mites_start + new_mites
            after_mort = after_repro * math.exp(r_mort * PERIOD_DAYS)

            # immigration + drift out on non-returning bees
            immigration = self.immigration(period)
            phoretic_mites = mites_start * c["pct_phoretic"]
            inf_rate = phoretic_mites / c["adult_bees"] if c["adult_bees"] else 0.0
            drift_out = 0.0
            if prev_brood_cells is not None and prev_adult_bees:
                emerging = prev_brood_cells * params.emergence_frac / 20.0 * PERIOD_DAYS
                bee_change = c["adult_bees"] - prev_adult_bees
                bee_deaths = emerging - bee_change
                exit_mult = 1.0 if inf_rate > 0.15 else params.exit_multiplier_low
                mite_loss = bee_deaths * exit_mult * inf_rate
                drift_out = -min(mite_loss, phoretic_mites * exit_mult)
            drift_net = immigration + drift_out

            pre_treatment = after_mort + drift_net
            kill = self.treatment_kills[period - 1]
            mites_end = pre_treatment * (1.0 - kill)

            r_observed = (math.log(mites_end / mites_start) / PERIOD_DAYS
                          if mites_start > 0 and mites_end > 0 else 0.0)

            # crash indicators (arbitrary): worker-cell invasion >50% or wash >60
            sealed_worker_cells = worker_sealed
            mites_in_brood = mites_start * c["pct_in_brood"]
            mites_in_worker = mites_in_brood * (1.0 - drone_repro_frac)
            mites_per_worker_cell = mites_in_worker / sealed_worker_cells if sealed_worker_cells else 0.0
            cells_invaded = 1.0 - math.exp(-mites_per_worker_cell)
            wash_count = (phoretic_mites / c["adult_bees"]) * params.wash_bees if c["adult_bees"] else 0.0
            crashed = crashed or cells_invaded > params.crash_cell_invasion \
                      or wash_count > params.crash_wash

            # advance the aging table: add this period's new-mite cohort, record
            # the current spent fraction, then age every cohort (applying this
            # period's kill) into the next time step.  Period 1's new mites are
            # not tracked, exactly as in the workbook (row 34 holds only the
            # starting population).
            if period > 1:
                cohorts.append([new_mites])
            frac_spent_at[period] = self._frac_spent(cohorts)
            cohorts = [coh + [coh[-1] * (1.0 - kill) * math.exp(params.r_mort_broodrearing * 15.0)]
                       for coh in cohorts]

            run.periods.append(PeriodResult(
                period=period, date=f"P{period}", frames_bees=c["frames_bees"],
                frames_brood=c["frames_brood"], drone_area_frac=c["drone_area"],
                adult_bees=c["adult_bees"], brood_cells=c["brood_cells"],
                brood_ratio=c["brood_ratio"], phoretic_days=c["phoretic_days"],
                pct_phoretic=c["pct_phoretic"], pct_in_brood=c["pct_in_brood"],
                drone_pref_frac=drone_repro_frac, pct_mites_drone=pct_mites_drone,
                pct_mites_worker=pct_mites_worker, drone_r_day=r_drone_day,
                worker_r_day=r_worker_day, r_repro=r_repro, r_mortality=r_mort, r_net=r_net,
                mites_start=mites_start, new_mites=new_mites, after_repro=after_repro,
                after_mort=after_mort, immigration=immigration, drift_out=drift_out,
                drift_net=drift_net, pre_treatment=pre_treatment, kill=kill,
                mites_end=mites_end, r_observed=r_observed,
                pct_cells_invaded=cells_invaded, wash_count=wash_count,
                frac_spent=frac_spent, crashed=crashed,
            ))
            run.mite_trajectory.append(mites_end)
            run.wash_trajectory.append(wash_count)
            run.r_trajectory.append(r_observed)
            mites = mites_end
            prev_brood_cells = c["brood_cells"]
            prev_adult_bees = c["adult_bees"]

        return run

    # ------------------------------------------------------------------
    # aging table (fraction of mites > 75 days old, i.e. "spent")
    # ------------------------------------------------------------------
    @staticmethod
    def _frac_spent(cohorts) -> float:
        """Fraction of the population older than `spent_age_days` (5 periods).

        Replicates the workbook's triangular cohort table.  A mite is spent
        once it has lived >= 5 periods (75 days).  At time t the spent
        fraction = (mites with age >= 5 at time t) / (all mites at time t).
        `cohorts` is the table state at the current time (cohort i was born at
        period i; entry j is that cohort's population j periods after birth).
        """
        total = 0.0
        spent = 0.0
        for birth, coh in enumerate(cohorts, start=1):
            age = len(coh) - 1
            total += coh[-1]
            if age >= 5:
                spent += coh[-1]
        if total <= 0:
            return 0.0
        return min(spent / total, 0.99)


def default_d_run():
    return VarroaModel(colony_type="d", initial_mites=100.0).run()


if __name__ == "__main__":
    import sys
    run = default_d_run()
    print(f"{'period':>6} {'start':>10} {'end':>10} {'r_net':>9} {'wash':>8}")
    for pr in run.periods:
        print(f"{pr.period:>6} {pr.mites_start:>10.1f} {pr.mites_end:>10.1f} "
              f"{pr.r_observed:>9.4f} {pr.wash_count:>8.2f}")
