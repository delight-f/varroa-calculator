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

  it('reports the per-line first crash index (issue #14)', () => {
    // colony f, wash 40, Jun, no treatment: both lines crash (same run).
    const f = runScenario({ colonyType: 'f', washCount: 40, startMonth: 'Jun', immigrationSetting: 0, southern: false })
    expect(f.baselineCrashIndex).not.toBeNull()
    expect(f.treatedCrashIndex).not.toBeNull()
    // the crash index points at a crashed period
    expect(f.periods[f.baselineCrashIndex!]!.crashed).toBe(true)
    // a heavy treatment that keeps the colony below a crash leaves the treated
    // line un-truncated while the baseline still crashes (issue #14: per-line)
    const treated = runScenario({
      colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false,
      treatments: [
        { id: 1, month: 'Jun', productId: 'apivar' },
        { id: 2, month: 'Jul', productId: 'apivar' },
        { id: 3, month: 'Aug', productId: 'apivar' },
      ],
    })
    expect(treated.baselineCrashIndex).not.toBeNull()
    expect(treated.treatedCrashIndex).toBeNull()
  })

  it('with no treatments the treated line equals the baseline', () => {
    const r = runScenario({ colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false })
    for (let i = 0; i < 24; i++) {
      expect(r.treatedWash[i]!).toBeCloseTo(r.baselineWash[i]!, 9)
    }
  })

  it('a treatment bends the treated line below the baseline from its period on', () => {
    const r = runScenario({
      colonyType: 'd',
      washCount: 10,
      startMonth: 'Jun',
      immigrationSetting: 0,
      southern: false,
      treatments: [{ id: 1, month: 'Sep', productId: 'apivar' }],
    })
    // window starts at Jun (period 15); Sep is period 21 -> index 6
    expect(r.periods[6]!.label).toBe('Sep')
    // before the treatment (window Jun..Aug) the lines match
    for (let i = 0; i < 6; i++) {
      expect(r.treatedWash[i]!).toBeCloseTo(r.baselineWash[i]!, 6)
    }
    // the treatment period itself: wash is computed from start-of-period mites,
    // so it equals the baseline; the bend shows from the next period on
    expect(r.treatedWash[6]!).toBeCloseTo(r.baselineWash[6]!, 6)
    // strictly below during the active divergence window (Sep..Oct)
    for (let i = 7; i < 10; i++) {
      expect(r.treatedWash[i]!).toBeLessThan(r.baselineWash[i]!)
    }
    // at or below for the rest of the year (colony can crash both lines to
    // near-zero in winter, where the wash counts coincide)
    for (let i = 10; i < 24; i++) {
      expect(r.treatedWash[i]!).toBeLessThanOrEqual(r.baselineWash[i]!)
    }
  })

it('same-period treatments compose: one vs two treatments differ', () => {
    const one = runScenario({
      colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false,
      treatments: [{ id: 1, month: 'Sep', productId: 'apivar' }],
    })
    const two = runScenario({
      colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false,
      treatments: [
        { id: 1, month: 'Sep', productId: 'apivar' },
        { id: 2, month: 'Sep', productId: 'oav-broodless' },
      ],
    })
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(two.treatedWash)).toBeLessThan(sum(one.treatedWash))
  })

  it('exposes total-mite trajectories alongside wash', () => {
    const r = runScenario({
      colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false,
    })
    expect(r.treatedMites).toHaveLength(24)
    expect(r.baselineMites).toHaveLength(24)
    // total mites are always >= the wash count (wash is a ~315-bee sample)
    for (let i = 0; i < 24; i++) {
      expect(r.treatedMites[i]!).toBeGreaterThanOrEqual(r.periods[i]!.wash)
      expect(r.baselineMites[i]!).toBeGreaterThanOrEqual(r.periods[i]!.wash)
    }
    // with no treatments the mite lines coincide
    for (let i = 0; i < 24; i++) {
      expect(r.treatedMites[i]!).toBeCloseTo(r.baselineMites[i]!, 9)
    }
  })

  it('a treatment bends the mite line below its baseline from the treatment period on', () => {
    const r = runScenario({
      colonyType: 'd', washCount: 10, startMonth: 'Jun', immigrationSetting: 0, southern: false,
      treatments: [{ id: 1, month: 'Sep', productId: 'apivar' }],
    })
    // window starts at Jun (period 15); Sep is period 21 -> index 6
    expect(r.periods[6]!.label).toBe('Sep')
    // before the treatment the mite lines match
    for (let i = 0; i < 6; i++) {
      expect(r.treatedMites[i]!).toBeCloseTo(r.baselineMites[i]!, 6)
    }
    // the treatment period itself: mites_end reflects the kill, so the treated
    // line drops below the baseline from this period on
    for (let i = 6; i < 24; i++) {
      expect(r.treatedMites[i]!).toBeLessThanOrEqual(r.baselineMites[i]!)
    }
    expect(r.treatedMites[6]!).toBeLessThan(r.baselineMites[6]!)
  })
})
