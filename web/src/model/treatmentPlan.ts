/**
 * Treatment-plan logic: user entries -> per-period kill fractions.
 *
 * A plan is a list of (month, productId) entries. The model needs a 24-element
 * per-period kill array. The array is **northern-indexed**: a treatment placed
 * on a calendar month lands on the northern period for that month, and the
 * model's `_source_period` applies the southern rotation (issue #16 — the
 * month must NOT be mapped through the southern rotation here, or southern
 * runs would double-rotate and land treatments 12 periods late).
 * Same-month treatments compose multiplicatively via composeKills.
 */

import { TREATMENT_PRODUCTS, treatmentProduct } from '../treatments'
import { monthToStartPeriod } from './months'
import type { MonthName } from './months'
import { composeKills } from './backSolve'
import type { ScenarioInput } from './scenario'

export interface TreatmentEntry {
  /** stable id for React keys / removal */
  id: number
  /** calendar month the treatment is placed on */
  month: MonthName
  /** product id from TREATMENT_PRODUCTS */
  productId: string
}

export interface TreatmentInput extends ScenarioInput {
  treatments: TreatmentEntry[]
}

/**
 * Map a treatment plan onto the model's 24-element per-period kill array.
 * A treatment placed on a calendar month applies to the first period whose
 * label is that month. The array is northern-indexed: the month maps to its
 * northern period (southern flag NOT applied — the model's `_source_period`
 * handles rotation, issue #16). Same-period kills compose multiplicatively.
 * Returns 24 entries, one per model period (1..24).
 */
export function planToKills(treatments: readonly TreatmentEntry[]): number[] {
  const kills = Array(24).fill(0) as number[]
  for (const t of treatments) {
    const period = monthToStartPeriod(t.month, false) // northern period; model rotates
    kills[period - 1] = composeKills([kills[period - 1]!, treatmentProduct(t.productId).killFraction])
  }
  return kills
}

/**
 * Period numbers (1..24, model-absolute) on which the plan applies a treatment,
 * for the chart's x-axis markers. `southern` selects the *display* period for
 * the month: the chart x-axis shows southern-rotated labels, so the marker
 * must sit at the display period of the chosen month. This is display-only —
 * the model's kill array stays northern-indexed (`planToKills`) and the model
 * applies the southern rotation itself.
 */
export function treatmentPeriods(
  treatments: readonly TreatmentEntry[],
  southern: boolean,
): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const t of treatments) {
    const period = monthToStartPeriod(t.month, southern)
    if (!seen.has(period)) {
      seen.add(period)
      out.push(period)
    }
  }
  return out
}

/** Treatments grouped by their display period (for chart markers). */
export function groupTreatmentsByPeriod(
  treatments: readonly TreatmentEntry[],
  southern: boolean,
): Array<{ period: number; entries: TreatmentEntry[] }> {
  return treatmentPeriods(treatments, southern).map((period) => ({
    period,
    entries: treatments.filter((t) => monthToStartPeriod(t.month, southern) === period),
  }))
}

/** Total kill fraction across the whole plan (informational). */
export function planKillFraction(treatments: readonly TreatmentEntry[]): number {
  return composeKills(
    treatments.map((t) => treatmentProduct(t.productId).killFraction),
  )
}

export { TREATMENT_PRODUCTS, treatmentProduct }
