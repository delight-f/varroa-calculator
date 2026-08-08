/**
 * TypeScript port of the corrected Varroa model (varroa_model_corrected.py).
 *
 * This is the web tool's authoritative model implementation. It mirrors the
 * Python corrected variant arithmetic-for-arithmetic; the parity test suite
 * (`model.parity.test.ts`) proves equivalence against golden fixtures
 * generated from the Python reference.
 *
 * Corrections A-F from the Python module docstring are carried over:
 *  A. cohort aging uses PERIOD_DAYS (not the workbook's 15)
 *  B. spent-fraction is not capped at 0.99
 *  C. no-bees phoretic edge case handled explicitly (phoreticDays = null)
 *  D. no-brood sentinel removed (broodRatio = 0)
 *  E. southern hemisphere implemented as a 12-period rotation
 *  F. immigration setting bounds-checked
 */

import colonyTypesJson from './colony_types.json'
import immigrationJson from './immigration.json'

/** Period length used by every growth/mortality exponential (365/24). */
export const PERIOD_DAYS = 365.0 / 24.0

export interface ColonyPeriod {
  brood_frames: number | null
  bee_frames: number | null
  drone_frac: number | null
}

export type ColonyTypes = Record<string, ColonyPeriod[]>
export type ImmigrationTable = Record<string, Array<number | null>>

const _CT = colonyTypesJson as ColonyTypes
const _IM = immigrationJson as ImmigrationTable

export interface Params {
  // --- reproduction (worker brood) ---
  worker_daughters: number // mean no. daughters/foundress/cycle
  vsh_reduction: number // fraction of foundresses removed by VSH/uncapping
  frac_mated: number // fraction of daughters viable & mated
  worker_density_adj: number // density adjustment (hardcoded 1 in workbook)
  // --- reproduction (drone brood) ---
  drone_daughters: number
  drone_density_adj: number
  // --- common ---
  pupa_survival: number // survival of pupa to adult (multiplies (1+daughters))
  worker_cell_days: number // divisor for worker r/day (sealed-days equivalent)
  drone_cell_days: number // divisor for drone r/day
  // --- mortality ---
  mort_broodless: number // daily mite mortality, no brood
  mort_broodrearing: number // daily mite mortality during broodrearing
  brood_ratio_threshold: number // brood:bee ratio above which broodrearing mort. applies
  // --- phoretic period (after Boot): days_phoretic = intercept - slope*ln(brood:bee) ---
  phoretic_intercept: number
  phoretic_slope: number // also used as the drone-cell invasion preference factor
  // --- drift / exiting bees ---
  exit_multiplier_low: number // mite multiplier on exiting bees at low infestation
  // --- colony conversions ---
  bees_per_frame: number
  cells_per_brood_frame: number
  // --- crash indicators ---
  crash_cell_invasion: number // worker cell invasion rate that flags collapse
  crash_wash: number // alcohol-wash count that flags collapse
  // --- aging ---
  spent_age_days: number // mites older than this are non-reproductive
  // --- fixed conversion factors in the workbook ---
  drone_cell_frac_convert: number // % drone by area -> % drone by cell count
  wash_bees: number // bees in a 1/2-cup alcohol wash sample
  emergence_frac: number // fraction of capped brood that emerges as adults
}

export const DEFAULT_PARAMS: Params = {
  worker_daughters: 1.45,
  vsh_reduction: 0.05,
  frac_mated: 0.7,
  worker_density_adj: 1.0,
  drone_daughters: 3.5,
  drone_density_adj: 1.0,
  pupa_survival: 0.95,
  worker_cell_days: 12.5,
  drone_cell_days: 14.75,
  mort_broodless: 0.005,
  mort_broodrearing: 0.005,
  brood_ratio_threshold: 0.25,
  phoretic_intercept: 5.0,
  phoretic_slope: 5.0,
  exit_multiplier_low: 0.6,
  bees_per_frame: 2000.0,
  cells_per_brood_frame: 4500.0,
  crash_cell_invasion: 0.5,
  crash_wash: 60.0,
  spent_age_days: 75.0,
  drone_cell_frac_convert: 16.0 / 25.0,
  wash_bees: 315.0,
  emergence_frac: 0.9,
}

/** BQ30: daughters/cycle after the VSH reduction. */
export function workerDaughtersEff(p: Params): number {
  return p.worker_daughters * (1.0 - p.vsh_reduction)
}

export function rMortBroodless(p: Params): number {
  return Math.log(1.0 - p.mort_broodless)
}

export function rMortBroodrearing(p: Params): number {
  return Math.log(1.0 - p.mort_broodrearing)
}

/** Everything the spreadsheet computes for one period. */
export interface PeriodResult {
  period: number
  date: string
  frames_bees: number
  frames_brood: number
  drone_area_frac: number
  adult_bees: number // BR
  brood_cells: number // BT
  brood_ratio: number // BU = brood cells / adult bees
  phoretic_days: number | null // BY; null when no adult bees (corrected C)
  pct_phoretic: number // CA
  pct_in_brood: number // CB
  drone_pref_frac: number // CG: fraction of brood-reproducing mites in drone brood
  pct_mites_drone: number // CH
  pct_mites_worker: number // CQ
  drone_r_day: number // CP
  worker_r_day: number // DA
  r_repro: number // DB
  r_mortality: number // DC
  r_net: number // DD
  mites_start: number // DF
  new_mites: number // DI
  after_repro: number // DJ
  after_mort: number // DL
  immigration: number // DM
  drift_out: number // DN
  drift_net: number // DO
  pre_treatment: number // DP
  kill: number // DQ
  mites_end: number // DS
  r_observed: number // DT
  pct_cells_invaded: number // CU (worker cells invaded)
  wash_count: number // DX
  frac_spent: number // fraction of mites > 75 days old (used next period)
  crashed: boolean
}

export interface Run {
  params: Params
  periods: PeriodResult[]
  mite_trajectory: number[]
  wash_trajectory: number[]
  r_trajectory: number[]
}

export interface ModelConfig {
  colony_type?: string
  initial_mites?: number
  immigration_setting?: number
  treatment_kills?: number[]
  params?: Params
  southern_hemisphere?: boolean
  brood_break_periods?: number[]
}

interface ColonyVars {
  frames_brood: number
  frames_bees: number
  drone_area: number
  adult_bees: number
  brood_cells: number
  brood_ratio: number
  phoretic_days: number | null // null when there are no adult bees (corrected C)
  pct_phoretic: number
  pct_in_brood: number
}

export class VarroaModelCorrected {
  colony_type: string
  initial_mites: number
  immigration_setting: number
  treatment_kills: number[]
  params: Params
  southern: boolean
  /** periods (1-24) on which reproduction is forced to zero ("brood break"). */
  brood_break: Set<number>
  private _n_immigration_columns: number

  constructor(config: ModelConfig = {}) {
    this.colony_type = (config.colony_type ?? 'd').toLowerCase()
    this.initial_mites = config.initial_mites ?? 100.0
    this.immigration_setting = config.immigration_setting ?? 0
    this.treatment_kills = config.treatment_kills
      ? [...config.treatment_kills]
      : Array(24).fill(0.0)
    this.params = config.params ?? { ...DEFAULT_PARAMS }
    this.southern = config.southern_hemisphere ?? false
    this.brood_break = new Set(config.brood_break_periods ?? [])

    // corrected F: validate the immigration setting once at construction.
    if (!Number.isInteger(this.immigration_setting)) {
      throw new TypeError(
        `immigration_setting must be an int in 0..5, got ${this.immigration_setting}`,
      )
    }
    this._n_immigration_columns = _IM['1']!.length
    if (!(0 <= this.immigration_setting && this.immigration_setting < this._n_immigration_columns)) {
      throw new RangeError(
        `immigration_setting ${this.immigration_setting} out of range ` +
          `0..${this._n_immigration_columns - 1} ` +
          `(immigration.json has ${this._n_immigration_columns} columns)`,
      )
    }
  }

  /**
   * Map a simulation period to the source-curve period.
   *
   * In the northern hemisphere the curve is read directly (period 1 = the
   * curve's period 1). In the southern hemisphere every season-anchored input
   * rotates by 12 periods: the southern period p is the northern period
   * ((p + 11) % 24) + 1, i.e. southern spring is northern autumn.
   */
  _source_period(period: number): number {
    if (!this.southern) return period
    return ((period + 11) % 24) + 1
  }

  /** (frames of brood, frames of bees, % drone brood by area) for a period. */
  colony_state(period: number): [number, number, number] {
    const d = _CT[this.colony_type.toUpperCase()]![this._source_period(period) - 1]!
    const z = (v: number | null): number => (v == null ? 0.0 : v)
    return [z(d.brood_frames), z(d.bee_frames), z(d.drone_frac)]
  }

  /** Mites arriving by drift in this period, given the immigration setting. */
  immigration(period: number): number {
    const row = _IM[String(this._source_period(period))]!
    const val = row[this.immigration_setting]!
    return val == null ? 0.0 : val
  }

  private _colony_vars(p: number): ColonyVars {
    const [frames_brood, frames_bees, drone_area] = this.colony_state(p)
    const adult_bees = frames_bees * this.params.bees_per_frame
    // corrected D: no sentinel value; a colony with no brood has zero brood
    // cells and a zero brood:bee ratio (the faithful file uses 1.0 here).
    const brood_cells = this.params.cells_per_brood_frame * frames_brood
    const brood_ratio = adult_bees > 0 && brood_cells > 0 ? brood_cells / adult_bees : 0.0
    // corrected C: the no-bees case is handled explicitly instead of the magic
    // 0.001. With no adult bees there is no host population, so the phoretic
    // fraction is 1.0 and phoretic_days has no meaningful value.
    let phoretic_days: number | null
    let pct_phoretic: number
    if (brood_ratio === 0) {
      phoretic_days = null
      pct_phoretic = 1.0
    } else {
      phoretic_days = -this.params.phoretic_slope * Math.log(brood_ratio) + this.params.phoretic_intercept
      pct_phoretic = frames_brood === 0 ? 1.0 : phoretic_days / (phoretic_days + 12.0)
    }
    const pct_in_brood = 1.0 - pct_phoretic
    return {
      frames_brood,
      frames_bees,
      drone_area,
      adult_bees,
      brood_cells,
      brood_ratio,
      phoretic_days,
      pct_phoretic,
      pct_in_brood,
    }
  }

  static _r_drone(params: Params): number {
    const r_cycle = (1.0 + params.drone_daughters * params.drone_density_adj) * params.pupa_survival
    return Math.log(r_cycle) / params.drone_cell_days
  }

  static _r_worker(params: Params, mites_start: number, worker_sealed_cells: number): number {
    const r_cycle =
      (1.0 + workerDaughtersEff(params) * params.worker_density_adj) * params.pupa_survival
    if (mites_start > 2.0 * worker_sealed_cells) return 0.0
    return Math.log(r_cycle) / params.worker_cell_days
  }

  run(): Run {
    const params = this.params
    const run: Run = { params, periods: [], mite_trajectory: [], wash_trajectory: [], r_trajectory: [] }
    let mites: number = this.initial_mites
    // aging cohort table: list of cohorts; each cohort = list of surviving
    // mites by age class (0 periods old ..), 1 element per period alive.
    // Replicates the workbook's triangular table (rows 34..57, cols EK..FH).
    // corrected A: the aging table advances at PERIOD_DAYS like every other
    // growth term (the faithful file uses the workbook's *15).
    const cohorts: number[][] = []
    const frac_spent_at: Record<number, number> = {} // fraction of mites >75 days old, by time index
    let prev_brood_cells: number | null = null
    let prev_adult_bees: number | null = null
    let crashed = false

    // initial cohort = the starting mite population (EK34 = DF5)
    cohorts.push([mites])

    for (let period = 1; period <= 24; period++) {
      const c = this._colony_vars(period)

      // fraction of the population that is "spent" (>75 days old).
      // The workbook seeds period 2 with an arbitrary 0.5; periods 3..7 read
      // empty cells (=> 0); period p>=8 uses the fraction computed at time p-2
      // from the aging table.
      let frac_spent: number
      const is_nuc_pkg = this.colony_type === 'n' || this.colony_type === 'p'
      if (is_nuc_pkg && period === 11) {
        frac_spent = 0.5
      } else if (is_nuc_pkg && period === 12) {
        frac_spent = 0.25
      } else if (period <= 1) {
        frac_spent = 0.0
      } else if (period === 2) {
        frac_spent = 0.5
      } else {
        frac_spent = frac_spent_at[period - 2] ?? 0.0
      }

      // start-of-period mite population (DF)
      let mites_start: number
      if (this.colony_type === 'n' || this.colony_type === 'p') {
        // corrected E: the install period rotates with the hemisphere
        // (northern period 11 = 1 April -> southern period 23).
        const install_period = this._source_period(11)
        if (period === install_period) mites_start = this.initial_mites
        else if (period === 1) mites_start = 0.0
        else mites_start = mites // 0 until the install period
      } else {
        mites_start = period === 1 ? this.initial_mites : mites
      }

      // distribution of mites into drone / worker brood
      const drone_by_cell = c.drone_area * params.drone_cell_frac_convert
      const drone_repro_frac = Math.min(drone_by_cell * params.phoretic_slope, 1.0)
      const pct_mites_drone = drone_repro_frac * c.pct_in_brood
      const pct_mites_worker = 1.0 - c.pct_phoretic - pct_mites_drone

      const sealed_cells = 0.6 * c.brood_cells
      const worker_sealed = (1.0 - drone_by_cell) * sealed_cells

      // reproduction rates
      const r_drone_day = VarroaModelCorrected._r_drone(params)
      const r_worker_day = VarroaModelCorrected._r_worker(params, mites_start, worker_sealed)
      const r_repro = pct_mites_drone * r_drone_day + pct_mites_worker * r_worker_day
      const r_mort =
        c.brood_ratio > params.brood_ratio_threshold
          ? rMortBroodrearing(params)
          : rMortBroodless(params)
      const r_net = r_repro + r_mort

      // population dynamics
      const mated = mites_start * params.frac_mated
      const reproductive = mated * (1.0 - frac_spent)
      let new_mites = reproductive * (Math.exp(r_repro * PERIOD_DAYS) - 1.0)
      if (this.brood_break.has(period)) new_mites = 0.0
      const after_repro = mites_start + new_mites
      const after_mort = after_repro * Math.exp(r_mort * PERIOD_DAYS)

      // immigration + drift out on non-returning bees
      const immigration = this.immigration(period)
      const phoretic_mites = mites_start * c.pct_phoretic
      const inf_rate = c.adult_bees ? phoretic_mites / c.adult_bees : 0.0
      let drift_out = 0.0
      if (prev_brood_cells !== null && prev_adult_bees) {
        const emerging = (prev_brood_cells * params.emergence_frac) / 20.0 * PERIOD_DAYS
        const bee_change = c.adult_bees - prev_adult_bees
        const bee_deaths = emerging - bee_change
        const exit_mult = inf_rate > 0.15 ? 1.0 : params.exit_multiplier_low
        const mite_loss = bee_deaths * exit_mult * inf_rate
        drift_out = -Math.min(mite_loss, phoretic_mites * exit_mult)
      }
      const drift_net = immigration + drift_out

      const pre_treatment = after_mort + drift_net
      // corrected E: the treatment array rotates with the hemisphere so a
      // southern run applies the same seasonal treatment at the southern date.
      const kill = this.treatment_kills[this._source_period(period) - 1]!
      const mites_end = pre_treatment * (1.0 - kill)

      const r_observed =
        mites_start > 0 && mites_end > 0 ? Math.log(mites_end / mites_start) / PERIOD_DAYS : 0.0

      // crash indicators (arbitrary): worker-cell invasion >50% or wash >60
      const sealed_worker_cells = worker_sealed
      const mites_in_brood = mites_start * c.pct_in_brood
      const mites_in_worker = mites_in_brood * (1.0 - drone_repro_frac)
      const mites_per_worker_cell = sealed_worker_cells ? mites_in_worker / sealed_worker_cells : 0.0
      const cells_invaded = 1.0 - Math.exp(-mites_per_worker_cell)
      const wash_count = c.adult_bees ? (phoretic_mites / c.adult_bees) * params.wash_bees : 0.0
      crashed = crashed || cells_invaded > params.crash_cell_invasion || wash_count > params.crash_wash

      // advance the aging table: add this period's new-mite cohort, record the
      // current spent fraction, then age every cohort (applying this period's
      // kill) into the next time step. Period 1's new mites are not tracked,
      // exactly as in the workbook (row 34 holds only the starting population).
      if (period > 1) cohorts.push([new_mites])
      frac_spent_at[period] = VarroaModelCorrected._frac_spent(cohorts)
      for (const coh of cohorts) {
        coh.push(coh[coh.length - 1]! * (1.0 - kill) * Math.exp(rMortBroodrearing(params) * PERIOD_DAYS))
      }

      run.periods.push({
        period,
        date: `P${period}`,
        frames_bees: c.frames_bees,
        frames_brood: c.frames_brood,
        drone_area_frac: c.drone_area,
        adult_bees: c.adult_bees,
        brood_cells: c.brood_cells,
        brood_ratio: c.brood_ratio,
        phoretic_days: c.phoretic_days,
        pct_phoretic: c.pct_phoretic,
        pct_in_brood: c.pct_in_brood,
        drone_pref_frac: drone_repro_frac,
        pct_mites_drone,
        pct_mites_worker,
        drone_r_day: r_drone_day,
        worker_r_day: r_worker_day,
        r_repro,
        r_mortality: r_mort,
        r_net,
        mites_start,
        new_mites,
        after_repro,
        after_mort,
        immigration,
        drift_out,
        drift_net,
        pre_treatment,
        kill,
        mites_end,
        r_observed,
        pct_cells_invaded: cells_invaded,
        wash_count,
        frac_spent,
        crashed,
      })
      run.mite_trajectory.push(mites_end)
      run.wash_trajectory.push(wash_count)
      run.r_trajectory.push(r_observed)
      mites = mites_end
      prev_brood_cells = c.brood_cells
      prev_adult_bees = c.adult_bees
    }

    return run
  }

  /**
   * Fraction of the population older than `spent_age_days` (5 periods).
   *
   * Replicates the workbook's triangular cohort table. A mite is spent once it
   * has lived >= 5 periods (75 days). At time t the spent fraction = (mites
   * with age >= 5 at time t) / (all mites at time t). `cohorts` is the table
   * state at the current time (cohort i was born at period i; entry j is that
   * cohort's population j periods after birth).
   *
   * corrected B: the faithful file caps this at 0.99; the true fraction can
   * approach 1.0 as the population ages out, so no cap is applied here.
   */
  static _frac_spent(cohorts: number[][]): number {
    let total = 0.0
    let spent = 0.0
    for (let i = 0; i < cohorts.length; i++) {
      const coh = cohorts[i]!
      const age = coh.length - 1
      total += coh[coh.length - 1]!
      if (age >= 5) spent += coh[coh.length - 1]!
    }
    if (total <= 0) return 0.0
    return spent / total
  }
}
