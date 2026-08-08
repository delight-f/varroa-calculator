/**
 * Tests for the period <-> month mapping used by the chart x-axis and the
 * month selector.
 */

import { describe, expect, it } from 'vitest'
import {
  MONTH_NAMES,
  monthToStartPeriod,
  periodToMonth,
  sourcePeriod,
  displayWindow,
} from './months'

describe('period -> month (northern)', () => {
  it('anchors from the workbook: P1 ~Nov, P11 = Apr, P16 ~Jun, P19 ~Aug', () => {
    expect(periodToMonth(1, false)).toBe('Nov')
    expect(periodToMonth(11, false)).toBe('Apr')
    expect(periodToMonth(16, false)).toBe('Jun')
    expect(periodToMonth(19, false)).toBe('Aug')
  })

  it('labels two periods per month (half-month periods)', () => {
    expect(periodToMonth(1, false)).toBe('Nov')
    expect(periodToMonth(2, false)).toBe('Nov')
    expect(periodToMonth(3, false)).toBe('Dec')
    expect(periodToMonth(4, false)).toBe('Dec')
    expect(periodToMonth(23, false)).toBe('Oct')
    expect(periodToMonth(24, false)).toBe('Oct')
  })

  it('covers all 12 months in order', () => {
    const labels = Array.from({ length: 24 }, (_, i) => periodToMonth(i + 1, false))
    for (const m of MONTH_NAMES) expect(labels).toContain(m)
    const seen = [...new Set(labels)]
    expect(seen).toEqual([...MONTH_NAMES])
  })
})

describe('period -> month (southern)', () => {
  it('rotates 12 periods: southern P1 = northern P13 = May', () => {
    expect(sourcePeriod(1, true)).toBe(13)
    expect(periodToMonth(1, true)).toBe('May')
  })

  it('southern P11 (install) = northern P23 = Oct', () => {
    expect(periodToMonth(11, true)).toBe('Oct')
  })

  it('southern labels are the northern labels shifted by 12 periods', () => {
    for (let p = 1; p <= 24; p++) {
      expect(periodToMonth(p, true)).toBe(periodToMonth(sourcePeriod(p, true), false))
    }
  })
})

describe('month -> start period', () => {
  it('northern: Nov -> 1, Apr -> 11, Jun -> 15, Aug -> 19', () => {
    expect(monthToStartPeriod('Nov', false)).toBe(1)
    expect(monthToStartPeriod('Apr', false)).toBe(11)
    expect(monthToStartPeriod('Jun', false)).toBe(15)
    expect(monthToStartPeriod('Aug', false)).toBe(19)
  })

  it('southern: May -> 1, Oct -> 11', () => {
    expect(monthToStartPeriod('May', true)).toBe(1)
    expect(monthToStartPeriod('Oct', true)).toBe(11)
  })

  it('round-trips with periodToMonth', () => {
    for (const m of MONTH_NAMES) {
      for (const southern of [false, true]) {
        const p = monthToStartPeriod(m, southern)
        expect(periodToMonth(p, southern), `${m} south=${southern}`).toBe(m)
      }
    }
  })
})

describe('displayWindow', () => {
  it('starts at the given period and wraps through the year', () => {
    expect(displayWindow(19)).toEqual([
      19, 20, 21, 22, 23, 24, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ])
    expect(displayWindow(1)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
  })
})
