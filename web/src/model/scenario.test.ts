/**
 * Tests for the scenario computation seam: front-door inputs -> display window.
 */

import { describe, expect, it } from 'vitest'
import { runScenario } from './scenario'

describe('runScenario', () => {
  it('produces 24 display periods starting at the selected month', () => {
    const r = runScenario({
      colonyType: 'd',
      washCount: 10,
      startMonth: 'Aug',
      immigrationSetting: 0,
      southern: false,
    })
    expect(r.periods).toHaveLength(24)
    expect(r.periods[0]!.label).toBe('Aug')
    // wraps through the year: Aug -> Sep -> ... -> Jul
    expect(r.periods[23]!.label).toBe('Jul')
  })

  it('the wash count at the start period equals the entered value (round-trip)', () => {
    for (const wash of [3, 10, 40]) {
      const r = runScenario({
        colonyType: 'd',
        washCount: wash,
        startMonth: 'Jun',
        immigrationSetting: 0,
        southern: false,
      })
      expect(Math.abs(r.periods[0]!.wash - wash), `wash ${wash}`).toBeLessThan(1e-6)
    }
  })

  it('changes colony type (re-runs the model)', () => {
    const d = runScenario({ colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false })
    const f = runScenario({ colonyType: 'f', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false })
    // both anchored at wash 10 at the start period but diverge later
    expect(Math.abs(d.periods[0]!.wash - 10)).toBeLessThan(1e-6)
    expect(Math.abs(f.periods[0]!.wash - 10)).toBeLessThan(1e-6)
    expect(d.periods[12]!.wash).not.toBeCloseTo(f.periods[12]!.wash, 6)
  })

  it('southern hemisphere rotates labels: May start', () => {
    const r = runScenario({
      colonyType: 'd',
      washCount: 10,
      startMonth: 'May',
      immigrationSetting: 0,
      southern: true,
    })
    expect(r.periods[0]!.label).toBe('May')
    expect(r.periods[23]!.label).toBe('Apr')
    expect(r.startPeriod).toBe(1) // southern P1 = May
  })

  it('immigration setting feeds through (drift season adds mites)', () => {
    const none = runScenario({ colonyType: 'd', washCount: 5, startMonth: 'Jun', immigrationSetting: 0, southern: false })
    const high = runScenario({ colonyType: 'd', washCount: 5, startMonth: 'Jun', immigrationSetting: 4, southern: false })
    // immigration setting 0 has no neighbours; setting 4 adds drift mites in
    // periods 11-20, so the mid-year trajectory must exceed the no-immigration one
    const sum = (rs: typeof none) => rs.periods.reduce((a, p) => a + p.wash, 0)
    expect(sum(high)).toBeGreaterThan(sum(none))
  })

  it('exposes crashed periods', () => {
    // colony f (feral) at high starting wash crashes
    const r = runScenario({ colonyType: 'f', washCount: 40, startMonth: 'Jun', immigrationSetting: 0, southern: false })
    expect(r.periods.some((p) => p.crashed)).toBe(true)
  })
})
