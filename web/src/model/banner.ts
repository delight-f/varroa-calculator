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
 * The advisory thresholds (~3 mites/wash "watch", ~9 mites/wash "treat") are
 * configurable constants — pending user verification (see CONTEXT.md open
 * question). All numbers and months are computed from the trajectory, nothing
 * hardcoded.
 */

import type { MonthName } from './months'

/** Advisory thresholds — configurable, pending user verification. */
export const ADVISORY = {
  /** wash count at/above which the colony is "already dangerous" (treat now) */
  dangerousWash: 9,
  /** wash count above which the trajectory "needs watching" */
  watchWash: 3,
  /** model-breakdown wash count (from the workbook, confirmed) */
  crashWash: 60,
} as const

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
  const { startWash, washTrajectory, labels, hasTreatments, crashed } = input
  const { peak, month } = peakWash(washTrajectory, labels)

  // already dangerous: the current measurement is at/above the treat threshold
  if (startWash >= ADVISORY.dangerousWash) {
    return {
      colour: 'red',
      title: 'Already dangerous',
      detail: `Your wash of ${fmt(startWash)} mites is above the treat threshold — act now.`,
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

  // plan keeps it controlled
  if (hasTreatments && peak < ADVISORY.dangerousWash) {
    return {
      colour: 'green',
      title: 'Under control',
      detail: `Your plan keeps the peak at ${fmt(peak)} mites/wash${month ? ` in ${month}` : ''}.`,
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