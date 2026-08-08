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

export interface ScenarioInput {
  colonyType: string // single-letter code (d, n, p, a, b, c, r, s, f)
  washCount: number // the beekeeper's alcohol-wash reading
  startMonth: MonthName // calendar month label ('Nov', ..., 'Oct')
  immigrationSetting: number // 0-4
  southern: boolean
  treatmentKills?: number[] // 24-element per-period kill array (default none)
}

export interface ScenarioDisplayPeriod {
  period: number
  label: string // calendar month label
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
}

/**
 * Compute the display window for a scenario. `washCount` is back-solved into
 * the model's initial population, the model runs from period 1, and the
 * output is sliced to the 24 periods starting at `startMonth`.
 */
export function runScenario(input: ScenarioInput): ScenarioResult {
  const startPeriod = monthToStartPeriod(input.startMonth, input.southern)

  const modelConfig: Record<string, unknown> = {
    colony_type: input.colonyType,
    immigration_setting: input.immigrationSetting,
    southern_hemisphere: input.southern,
    treatment_kills: input.treatmentKills ?? Array(24).fill(0),
  }
  const initialMites = backSolve(input.washCount, startPeriod, modelConfig)
  const run = new VarroaModelCorrected({
    initial_mites: initialMites,
    ...modelConfig,
  } as never).run()

  const byPeriod = new Map<number, PeriodResult>()
  for (const pr of run.periods) byPeriod.set(pr.period, pr)

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

  return { startPeriod, initialMites, periods, byPeriod }
}
