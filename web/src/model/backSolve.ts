/**
 * Back-solve bridge and treatment composition.
 *
 * `backSolve`: the beekeeper enters a wash count + starting period; the tool
 * derives the model's `initial_mites` input. 1-D root-find: find
 * `initialMites` such that the simulated wash count at the user's starting
 * period equals the entered value. The relationship is near-linear (wash
 * count scales with starting population), so bisection on a log-scaled
 * bracket converges fast and is robust.
 *
 * `composeKills`: multiple treatments on the same period compose
 * multiplicatively — combined_survival = product(1 - kill_i), so
 * combined_kill = 1 - combined_survival.
 */

import { VarroaModelCorrected } from './varroaModel'

/** How close the simulated wash count must be to the target (spec: 1e-6). */
export const BACKSOLVE_TOL = 1e-6

/** Maximum bisection iterations before giving up. */
const MAX_ITER = 200

/**
 * Compose per-period kill fractions into a single combined kill fraction.
 *
 * survival_i = (1 - kill_i); combined_survival = product of survival_i;
 * combined_kill = 1 - combined_survival. Empty plan -> 0 (no kill).
 * The result is always in [0, 1].
 */
export function composeKills(kills: readonly number[]): number {
  let survival = 1.0
  for (const k of kills) survival *= 1.0 - k
  return 1.0 - survival
}

/** Simulated wash count at `startPeriod` for a given initial population. */
function washAt(initialMites: number, startPeriod: number, config: Record<string, unknown>): number {
  const run = new VarroaModelCorrected({
    initial_mites: initialMites,
    ...config,
  } as never).run()
  return run.periods[startPeriod - 1]!.wash_count
}

/**
 * Root-find `initialMites` so the simulated wash count at `startPeriod`
 * equals `targetWashCount`. `config` is passed through to the model
 * unchanged (colony type, hemisphere, immigration setting, ...).
 */
export function backSolve(
  targetWashCount: number,
  startPeriod: number,
  config: Record<string, unknown> = {},
): number {
  if (!(startPeriod >= 1 && startPeriod <= 24)) {
    throw new RangeError(`startPeriod must be in 1..24, got ${startPeriod}`)
  }
  if (!Number.isFinite(targetWashCount) || targetWashCount < 0) {
    throw new RangeError(`targetWashCount must be a non-negative number, got ${targetWashCount}`)
  }

  // Wash count scales ~linearly with initial population: use a log-scaled
  // bracket so the bisection spans orders of magnitude cheaply.
  let lo = 0.0
  let hi = 1.0
  // widen the bracket until the target is bracketed (wash at hi >= target)
  while (washAt(hi, startPeriod, config) < targetWashCount) {
    lo = hi
    hi *= 10.0
    if (hi > 1e12) throw new RangeError(`targetWashCount ${targetWashCount} too large to back-solve`)
  }

  // handle the degenerate case: even the smallest population washes above target
  if (targetWashCount === 0) return 0.0

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const mid = (lo + hi) / 2.0
    const w = washAt(mid, startPeriod, config)
    if (Math.abs(w - targetWashCount) <= BACKSOLVE_TOL) return mid
    if (w < targetWashCount) lo = mid
    else hi = mid
  }
  // fall back to the midpoint of the final bracket
  return (lo + hi) / 2.0
}
