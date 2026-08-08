/**
 * Banner state: a pure function of the model output that turns the trajectory
 * into a plain-language status pill.
 *
 * Four states (T8 ticket):
 *  - yellow: trajectory rising, no treatments planned
 *  - green:  the plan keeps the colony controlled (peak stays under threshold)
 *  - red:    the trajectory crashes (wash > crash threshold or cell invasion)
 *  - red:    already dangerous (current wash >= treat threshold)
 *
 * Treat thresholds follow the Honey Bee Health Coalition guidance (confirmed
 * by the author, 2026-08-08): treat at a wash count of 5 in autumn, winter
 * and spring, and 9 in summer. "Summer" is defined as the Jun–Oct window
 * (the model's active season); Nov–May is the low season. The threshold
 * rotates with the southern hemisphere so a southern run uses southern
 * seasons. All numbers and months are computed from the trajectory, nothing
 * hardcoded.
 */

import type { MonthName } from './months'

/** Advisory thresholds (Honey Bee Health Coalition, confirmed). */
export const ADVISORY = {
  /** treat threshold during the low season (autumn/winter/spring) */
  dangerousWashLow: 5,
  /** treat threshold during the active season (summer) */
  dangerousWashHigh: 9,
  /** wash count above which the trajectory "needs watching" (kept low-key) */
  watchWash: 3,
  /** model-breakdown wash count (from the workbook, confirmed) */
  crashWash: 60,
} as const

/** Months treated as "summer" (active season) in the northern hemisphere. */
const SUMMER_MONTHS: readonly MonthName[] = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct']

export type BannerColour = 'yellow' | 'green' | 'red'

export interface BannerState {
  colour: BannerColour
  /** headline text */
  title: string
  /** supporting line with computed numbers/months */
  detail: string
  /** icon name (paired with colour, never colour alone) */
  icon: 'trending-up' | 'shield-check' | 'alert-triangle' | 'alert-octagon'
}

export interface BannerInput {
  /** wash count at the start period (the beekeeper's measurement) */
  startWash: number
  /** wash trajectory across the 24-period display window, in order */
  washTrajectory: number[]
  /** calendar month labels for each window position */
  labels: MonthName[]
  /** true if any treatment is planned */
  hasTreatments: boolean
  /** true if any period in the window crashed (wash > crash or cell invasion) */
  crashed: boolean
  /** true if the run uses southern-hemisphere seasons */
  southern?: boolean
}

/**
 * Treat threshold for a calendar month (Honey Bee Health Coalition):
 * 5 in autumn/winter/spring, 9 in summer. The summer window (Jun–Oct)
 * rotates 6 months in the southern hemisphere, so a southern May is
 * northern Nov (low season) and a southern Dec is northern Jun (summer).
 */
export function treatThresholdForMonth(month: MonthName, southern: boolean): number {
  const effective = southern ? rotateMonth(month, 6) : month
  return SUMMER_MONTHS.includes(effective) ? ADVISORY.dangerousWashHigh : ADVISORY.dangerousWashLow
}

/** Rotate a month label by n positions (southern = +6). */
function rotateMonth(month: MonthName, n: number): MonthName {
  const order: MonthName[] = [
    'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct',
  ]
  const idx = order.indexOf(month)
  return order[(idx + n) % 12]!
}

/** Peak wash count and the month it occurs in (first occurrence). */
export function peakWash(
  washTrajectory: number[],
  labels: MonthName[],
): { peak: number; month: MonthName | null } {
  let peak = -Infinity
  let month: MonthName | null = null
  for (let i = 0; i < washTrajectory.length; i++) {
    const w = washTrajectory[i]!
    if (w > peak) {
      peak = w
      month = labels[i] ?? null
    }
  }
  return { peak: peak === -Infinity ? 0 : peak, month }
}

/**
 * Decide the banner state from the trajectory and plan.
 *
 * Precedence (highest first): already-dangerous > crash > green > yellow.
 */
export function bannerState(input: BannerInput): BannerState {
  const { startWash, washTrajectory, labels, hasTreatments, crashed, southern } = input
  const { peak, month } = peakWash(washTrajectory, labels)
  const isSouthern = southern ?? false

  // already dangerous: the current measurement is at/above the treat
  // threshold for the season of the start month
  const startThreshold = treatThresholdForMonth(labels[0] ?? 'Nov', isSouthern)
  if (startWash >= startThreshold) {
    return {
      colour: 'red',
      title: 'Already dangerous',
      detail: `Your wash of ${fmt(startWash)} mites is above the ${fmt(startThreshold)}-mite treat threshold for this season — act now.`,
      icon: 'alert-octagon',
    }
  }

  // trajectory crashes (model breakdown)
  if (crashed || peak >= ADVISORY.crashWash) {
    return {
      colour: 'red',
      title: 'Trajectory crashes',
      detail: `Peak ${fmt(peak)} mites/wash${month ? ` in ${month}` : ''} — the colony is projected to collapse.`,
      icon: 'alert-triangle',
    }
  }

  // plan keeps it controlled: the peak stays under the treat threshold
  // appropriate to the season in which the peak occurs
  const peakThreshold = treatThresholdForMonth(month ?? 'Nov', isSouthern)
  if (hasTreatments && peak < peakThreshold) {
    return {
      colour: 'green',
      title: 'Under control',
      detail: `Your plan keeps the peak at ${fmt(peak)} mites/wash${month ? ` in ${month}` : ''}, under the ${fmt(peakThreshold)}-mite treat threshold.`,
      icon: 'shield-check',
    }
  }

  // rising, no treatments (or treatments insufficient)
  return {
    colour: 'yellow',
    title: 'Needs watching',
    detail: `Peak ${fmt(peak)} mites/wash${month ? ` in ${month}` : ''} — consider a treatment plan.`,
    icon: 'trending-up',
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
