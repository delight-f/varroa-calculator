/**
 * Tests for the banner state function — all four states with known
 * trajectory shapes.
 */

import { describe, expect, it } from 'vitest'
import { bannerState, peakWash, ADVISORY } from './banner'
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

  it('red: already dangerous when start wash is at/above the treat threshold', () => {
    const s = bannerState(input({ startWash: ADVISORY.dangerousWash }))
    expect(s.colour).toBe('red')
    expect(s.icon).toBe('alert-octagon')
    expect(s.title).toBe('Already dangerous')
  })

  it('already-dangerous takes precedence over crash', () => {
    const s = bannerState(input({ startWash: 50, washTrajectory: [50, 80, 90], crashed: true }))
    expect(s.title).toBe('Already dangerous')
  })

  it('crash takes precedence over green', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 70], hasTreatments: true }))
    expect(s.title).toBe('Trajectory crashes')
  })

  it('computes the peak month from the trajectory (not hardcoded)', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 8, 6], hasTreatments: false }))
    expect(s.detail).toContain('Jul') // peak 8 at index 2 -> 'Jul' (labels start Jun)
  })

  it('green detail reports the peak and month', () => {
    const s = bannerState(input({ startWash: 2, washTrajectory: [2, 4, 6, 5], hasTreatments: true }))
    expect(s.detail).toContain('6')
    expect(s.detail).toContain('Jul') // peak 6 at index 2 -> 'Jul'
  })
})