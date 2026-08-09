/**
 * Tests for the banner state function — all four states with known
 * trajectory shapes, plus the season-dependent treat thresholds
 * (Honey Bee Health Coalition: 5 in autumn/winter/spring, 9 in summer).
 */

import { describe, expect, it } from 'vitest'
import { bannerState, peakWash, treatThresholdForMonth, ADVISORY } from './banner'
import type { BannerInput } from './banner'
import type { MonthName } from './months'

const labels: MonthName[] = [
  'Jun', 'Jun', 'Jul', 'Jul', 'Aug', 'Aug', 'Sep', 'Sep', 'Oct', 'Oct',
  'Nov', 'Nov', 'Dec', 'Dec', 'Jan', 'Jan', 'Feb', 'Feb', 'Mar', 'Mar',
  'Apr', 'Apr', 'May', 'May',
]

function input(over: Partial<BannerInput>): BannerInput {
  return {
    startWash: 5,
    washTrajectory: Array(24).fill(5),
    labels,
    hasTreatments: false,
    crashed: false,
    ...over,
  }
}

describe('treatThresholdForMonth', () => {
  it('low season (Nov–May) -> 5', () => {
    for (const m of ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'] as MonthName[]) {
      expect(treatThresholdForMonth(m, false)).toBe(ADVISORY.dangerousWashLow)
    }
  })

  it('summer (Jun–Oct) -> 9', () => {
    for (const m of ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'] as MonthName[]) {
      expect(treatThresholdForMonth(m, false)).toBe(ADVISORY.dangerousWashHigh)
    }
  })

  it('southern hemisphere rotates the seasons by 6 months', () => {
    // southern Dec = northern Jun (summer -> 9)
    expect(treatThresholdForMonth('Dec', true)).toBe(ADVISORY.dangerousWashHigh)
    // southern Jun = northern Dec (low season -> 5)
    expect(treatThresholdForMonth('Jun', true)).toBe(ADVISORY.dangerousWashLow)
    // southern May = northern Nov (low season -> 5)
    expect(treatThresholdForMonth('May', true)).toBe(ADVISORY.dangerousWashLow)
  })
})

describe('peakWash', () => {
  it('finds the peak and its month (first occurrence)', () => {
    const w = [1, 2, 3, 2, 1, 0]
    const l: MonthName[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    expect(peakWash(w, l)).toEqual({ peak: 3, month: 'Mar' })
  })

  it('empty trajectory -> peak 0, null month', () => {
    expect(peakWash([], [])).toEqual({ peak: 0, month: null })
  })
})

describe('bannerState', () => {
  it('yellow: rising, no treatments, under thresholds', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 6, 5], hasTreatments: false }))
    expect(s.colour).toBe('yellow')
    expect(s.icon).toBe('trending-up')
    expect(s.title).toBe('Needs watching')
  })

  it('green: treatments keep the peak under the treat threshold', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 6, 5], hasTreatments: true }))
    expect(s.colour).toBe('green')
    expect(s.icon).toBe('shield-check')
    expect(s.title).toBe('Under control')
  })

  it('red: trajectory crashes (peak >= crash threshold)', () => {
    const s = bannerState(input({ washTrajectory: [2, 10, 70, 90] }))
    expect(s.colour).toBe('red')
    expect(s.icon).toBe('alert-triangle')
    expect(s.title).toBe('Trajectory crashes')
  })

  it('red: crashed flag alone triggers the crash state', () => {
    const s = bannerState(input({ washTrajectory: [2, 3, 4], crashed: true }))
    expect(s.colour).toBe('red')
    expect(s.title).toBe('Trajectory crashes')
  })

  it('red: already dangerous at/above the summer threshold (9)', () => {
    // labels start Jun (summer) -> threshold 9
    const s = bannerState(input({ startWash: 9 }))
    expect(s.colour).toBe('red')
    expect(s.icon).toBe('alert-octagon')
    expect(s.title).toBe('Already dangerous')
  })

  it('red: already dangerous at/above the low-season threshold (5)', () => {
    // labels start Nov -> low season -> threshold 5
    const winterLabels: MonthName[] = [
      'Nov', 'Nov', 'Dec', 'Dec', 'Jan', 'Jan', 'Feb', 'Feb', 'Mar', 'Mar',
      'Apr', 'Apr', 'May', 'May', 'Jun', 'Jun', 'Jul', 'Jul', 'Aug', 'Aug',
      'Sep', 'Sep', 'Oct', 'Oct',
    ]
    const s = bannerState(input({ startWash: 5, labels: winterLabels }))
    expect(s.colour).toBe('red')
    expect(s.title).toBe('Already dangerous')
  })

  it('a wash of 6 in winter is dangerous but 6 in summer is not', () => {
    const winterLabels: MonthName[] = [
      'Nov', 'Nov', 'Dec', 'Dec', 'Jan', 'Jan', 'Feb', 'Feb', 'Mar', 'Mar',
      'Apr', 'Apr', 'May', 'May', 'Jun', 'Jun', 'Jul', 'Jul', 'Aug', 'Aug',
      'Sep', 'Sep', 'Oct', 'Oct',
    ]
    const winter = bannerState(input({ startWash: 6, labels: winterLabels }))
    expect(winter.colour).toBe('red')
    const summer = bannerState(input({ startWash: 6, labels })) // starts Jun
    expect(summer.colour).not.toBe('red')
  })

  it('already-dangerous takes precedence over crash', () => {
    const s = bannerState(input({ startWash: 50, washTrajectory: [50, 80, 90], crashed: true }))
    expect(s.title).toBe('Already dangerous')
  })

  it('crash takes precedence over green', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 70], hasTreatments: true }))
    expect(s.title).toBe('Trajectory crashes')
  })

  it('peak is computed over the truncated (pre-crash) window (issue #14)', () => {
    // crash at index 2; the post-crash values (90, 100) must not count
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 70, 90, 100], crashIndex: 2, crashed: true }))
    expect(s.colour).toBe('red')
    expect(s.title).toBe('Trajectory crashes')
    expect(s.detail).toContain('4') // pre-crash peak
    expect(s.detail).not.toContain('90')
    expect(s.detail).not.toContain('100')
  })

  it('computes the peak month from the trajectory (not hardcoded)', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 8, 6], hasTreatments: false }))
    expect(s.detail).toContain('Jul') // peak 8 at index 2 -> 'Jul' (labels start Jun)
  })

  it('green detail reports the peak, month, and season threshold', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 6, 5], hasTreatments: true }))
    expect(s.detail).toContain('6')
    expect(s.detail).toContain('Jul') // peak 6 at index 2 -> 'Jul'
    expect(s.detail).toContain('9') // Jul is summer -> threshold 9
  })
})