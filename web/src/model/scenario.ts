/**
 * Scenario computation: turns front-door inputs into a chart-ready display
 * window. This is the pure seam between the React UI and the model.
 *
 * The model always runs from biological period 1; the chart shows 24 periods
 * forward from the user's start period (wrapping through the year).
 */

import { VarroaModelCorrected } from './varroaModel'
import { backSolve } from './backSolve'
import { displayWindow, monthToStartPeriod, periodToMonth } from './months'
import type { MonthName } from './months'
import type { PeriodResult } from './varroaModel'
import { planToKills } from './treatmentPlan'
import type { TreatmentEntry } from './treatmentPlan'
import { ADVISORY } from './banner'

export interface ScenarioInput {
  colonyType: string // single-letter code (d, n, p, a, b, c, r, s, f)
  washCount: number // the beekeeper's alcohol-wash reading
  startMonth: MonthName // calendar month label ('Nov', ..., 'Oct')
  immigrationSetting: number // 0-4
  southern: boolean
  treatmentKills?: number[] // 24-element per-period kill array (default none)
  /** treatment plan (T7): placed treatments drive the bold line */
  treatments?: TreatmentEntry[]
}

export interface ScenarioDisplayPeriod {
  period: number
  label: MonthName // calendar month label
  wash: number
  mites: number
  crashed: boolean
}

export interface ScenarioResult {
  startPeriod: number
  initialMites: number
  periods: ScenarioDisplayPeriod[]
  /** model periods indexed by period number (1..24), for treatment markers etc. */
  byPeriod: Map<number, PeriodResult>
  /** per-period wash count with treatments applied (bold line) */
  treatedWash: number[]
  /** per-period wash count with no treatments (faint baseline) */
  baselineWash: number[]
  /** per-period total mite population with treatments applied (bold line) */
  treatedMites: number[]
  /** per-period total mite population with no treatments (faint baseline) */
  baselineMites: number[]
  /**
   * Window index of the first crash per trajectory, or null when it never
   * crashes (issue #14). The chart ends each line at its own crash point and
   * the banner peak covers only the truncated window.
   */
  treatedCrashIndex: number | null
  baselineCrashIndex: number | null
}

/**
 * Compute the display window for a scenario. `washCount` is back-solved into
 * the model's initial population, the model runs from period 1, and the
 * output is sliced to the 24 periods starting at `startMonth`.
 *
 * Two trajectories are computed: the treatment-applied line (from the plan /
 * treatmentKills) and the baseline no-treatment line. Both share the same
 * initial population (the wash count anchors the treated run).
 */
export function runScenario(input: ScenarioInput): ScenarioResult {
  const startPeriod = monthToStartPeriod(input.startMonth, input.southern)

  const treatedKills =
    input.treatmentKills ??
    planToKills(input.treatments ?? [])

  const modelConfig: Record<string, unknown> = {
    colony_type: input.colonyType,
    immigration_setting: input.immigrationSetting,
    southern_hemisphere: input.southern,
    treatment_kills: treatedKills,
  }
  const initialMites = backSolve(input.washCount, startPeriod, modelConfig)
  const treatedRun = new VarroaModelCorrected({
    initial_mites: initialMites,
    ...modelConfig,
  } as never).run()
  const baselineRun = new VarroaModelCorrected({
    initial_mites: initialMites,
    colony_type: input.colonyType,
    immigration_setting: input.immigrationSetting,
    southern_hemisphere: input.southern,
    treatment_kills: Array(24).fill(0),
  } as never).run()

  const byPeriod = new Map<number, PeriodResult>()
  for (const pr of treatedRun.periods) byPeriod.set(pr.period, pr)

  const window = displayWindow(startPeriod)
  const periods: ScenarioDisplayPeriod[] = window.map((p) => {
    const pr = byPeriod.get(p)!
    return {
      period: p,
      label: periodToMonth(p, input.southern),
      wash: pr.wash_count,
      mites: pr.mites_end,
      crashed: pr.crashed,
    }
  })

  const treatedWash = window.map((p) => byPeriod.get(p)!.wash_count)
  const baselineWash = window.map((p) => baselineRun.periods[p - 1]!.wash_count)
  const treatedMites = window.map((p) => byPeriod.get(p)!.mites_end)
  const baselineMites = window.map((p) => baselineRun.periods[p - 1]!.mites_end)

  // First window index of a *sustained* wash breakdown (issue #14). The
  // model's `crashed` flag is sticky (once set it stays on) and fires on cell
  // invasion even at moderate wash counts, so it truncates far too early — a
  // wash-40 start in Aug is flagged from the very first period. A single
  // period above the crash threshold is also not a breakdown (a transient
  // peak that then recovers is a healthy colony). So the line ends only at
  // the start of a *sustained* run of wash > crashWash (>=3 consecutive
  // periods), which is the genuine collapse. Each trajectory has its own wash
  // array (the shared `periods` array is the treated run's).
  const sustainedCrashAt = (washArr: number[]) => {
    let run = 0
    for (let i = 0; i < washArr.length; i++) {
      run = washArr[i]! > ADVISORY.crashWash ? run + 1 : 0
      if (run >= 3) return i - 2 // start of the sustained run
    }
    return -1
  }
  const treatedCrashIndex = sustainedCrashAt(treatedWash)
  const baselineCrashIndex = sustainedCrashAt(baselineWash)
  return {
    startPeriod,
    initialMites,
    periods,
    byPeriod,
    treatedWash,
    baselineWash,
    treatedMites,
    baselineMites,
    treatedCrashIndex: treatedCrashIndex >= 0 ? treatedCrashIndex : null,
    baselineCrashIndex: baselineCrashIndex >= 0 ? baselineCrashIndex : null,
  }
}
