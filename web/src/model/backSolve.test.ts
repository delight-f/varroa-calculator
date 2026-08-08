/**
 * Tests for the back-solve bridge and treatment composition.
 *
 * Seams agreed in the spec (issue #1, "Pure-function seams"):
 *  - backSolve: feeding the result back into run() produces the target wash
 *    count at the target period (within 1e-6).
 *  - composeKills: multiplicative stacking, combined_survival = product(1-k_i).
 */

import { describe, expect, it } from 'vitest'
import { backSolve, composeKills } from './backSolve'
import { VarroaModelCorrected } from './varroaModel'

function washAtPeriod(initialMites: number, startPeriod: number, config?: Record<string, unknown>): number {
  const run = new VarroaModelCorrected({
    initial_mites: initialMites,
    ...(config ?? {}),
  } as never).run()
  return run.periods[startPeriod - 1]!.wash_count
}

describe('composeKills', () => {
  it('composes multiplicatively: [0.9, 0.5] -> 0.95', () => {
    expect(composeKills([0.9, 0.5])).toBeCloseTo(0.95, 12)
  })

  it('single element is identity', () => {
    expect(composeKills([0.8])).toBeCloseTo(0.8, 12)
  })

  it('empty array composes to 0 (no kill)', () => {
    expect(composeKills([])).toBe(0)
  })

  it('never exceeds 1.0, even with stacked high kills', () => {
    expect(composeKills([0.95, 0.9, 0.9])).toBeLessThanOrEqual(1.0)
    expect(composeKills([1.0, 0.5])).toBeCloseTo(1.0, 12)
  })

  it('matches the spec\'s survival formula: combined = 1 - product(1 - k_i)', () => {
    const kills = [0.9, 0.5, 0.25]
    const expected = 1 - (1 - 0.9) * (1 - 0.5) * (1 - 0.25)
    expect(composeKills(kills)).toBeCloseTo(expected, 12)
  })
})

describe('backSolve', () => {
  it('round-trips: wash 10 at period 19 -> run -> wash ~10', () => {
    const startPeriod = 19
    const target = 10
    const initialMites = backSolve(target, startPeriod, {})
    const got = washAtPeriod(initialMites, startPeriod)
    expect(Math.abs(got - target)).toBeLessThan(1e-6)
  })

  it('round-trips across the year for several start periods', () => {
    for (const startPeriod of [1, 5, 11, 16, 19, 24]) {
      const target = 8
      const initialMites = backSolve(target, startPeriod, {})
      const got = washAtPeriod(initialMites, startPeriod)
      expect(Math.abs(got - target), `startPeriod ${startPeriod}`).toBeLessThan(1e-6)
    }
  })

  it('handles a higher target (wash 40) at period 11', () => {
    const startPeriod = 11
    const target = 40
    const initialMites = backSolve(target, startPeriod, {})
    const got = washAtPeriod(initialMites, startPeriod)
    expect(Math.abs(got - target)).toBeLessThan(1e-6)
  })

  it('respects the config (colony type, hemisphere) passed through', () => {
    const startPeriod = 19
    const target = 12
    const config = { colony_type: 'f', southern_hemisphere: true, immigration_setting: 2 }
    const initialMites = backSolve(target, startPeriod, config)
    const got = washAtPeriod(initialMites, startPeriod, config)
    expect(Math.abs(got - target)).toBeLessThan(1e-6)
  })

  it('returns a finite, positive initial population', () => {
    const initialMites = backSolve(10, 19, {})
    expect(Number.isFinite(initialMites)).toBe(true)
    expect(initialMites).toBeGreaterThan(0)
  })
})
