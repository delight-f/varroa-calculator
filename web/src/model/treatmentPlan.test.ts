/**
 * Tests for the treatment catalog and plan -> kills mapping.
 */

import { describe, expect, it } from 'vitest'
import { TREATMENT_PRODUCTS, treatmentProduct } from '../treatments'
import { planToKills, treatmentPeriods, planKillFraction } from './treatmentPlan'
import { composeKills } from './backSolve'
import type { MonthName } from './months'
import type { TreatmentEntry } from './treatmentPlan'

function entry(id: number, month: MonthName, productId: string): TreatmentEntry {
  return { id, month, productId }
}

describe('treatment catalog', () => {
  it('has exactly the 8 spec products with correct kill fractions', () => {
    const expected: Record<string, number> = {
      apivar: 0.95,
      'formic-pro': 0.9,
      apiguard: 0.9,
      'oav-broodless': 0.95,
      'oav-with-brood': 0.33,
      'oa-trickle': 0.8,
      'drone-brood-removal': 0.15,
      'sugar-dusting': 0.25,
    }
    expect(TREATMENT_PRODUCTS).toHaveLength(8)
    for (const p of TREATMENT_PRODUCTS) {
      expect(p.killFraction, p.name).toBe(expected[p.id])
      expect(p.advisory.length).toBeGreaterThan(10)
    }
  })

  it('looks up by id and rejects unknown ids', () => {
    expect(treatmentProduct('apivar').name).toBe('Apivar')
    expect(() => treatmentProduct('nope')).toThrow(RangeError)
  })
})

describe('planToKills', () => {
  it('maps a month placement to the first period of that month (north)', () => {
    // Nov -> period 1, Jun -> period 15 (first half-month labeled Jun)
    const plan = [entry(1, 'Jun', 'apivar')]
    const kills = planToKills(plan, false)
    expect(kills[14]).toBeCloseTo(0.95, 12) // period 15
    expect(kills.reduce((a, b) => a + b, 0)).toBeCloseTo(0.95, 12)
  })

  it('applies hemisphere rotation: Jun south -> northern period 3 (Dec)', () => {
    const plan = [entry(1, 'Jun', 'apivar')]
    const kills = planToKills(plan, true)
    // southern monthToStartPeriod('Jun', true) = period 3 (southern Jun = northern Dec)
    expect(kills[2]).toBeCloseTo(0.95, 12)
    expect(kills.reduce((a, b) => a + b, 0)).toBeCloseTo(0.95, 12)
  })

  it('same-period treatments compose multiplicatively via composeKills', () => {
    // two treatments on Jun: 0.95 and 0.5 -> combined 1 - (0.05)(0.5) = 0.975
    const plan = [entry(1, 'Jun', 'apivar'), entry(2, 'Jun', 'sugar-dusting')]
    const kills = planToKills(plan, false)
    expect(kills[14]).toBeCloseTo(composeKills([0.95, 0.25]), 12)
    expect(kills[14]).toBeCloseTo(0.9625, 12) // 1 - 0.05*0.75
  })

  it('different-period treatments stay on their own periods', () => {
    const plan = [entry(1, 'Apr', 'oav-broodless'), entry(2, 'Sep', 'apivar')]
    const kills = planToKills(plan, false)
    // Apr -> period 11, Sep -> period 21
    expect(kills[10]).toBeCloseTo(0.95, 12)
    expect(kills[20]).toBeCloseTo(0.95, 12)
    expect(kills[14]).toBe(0) // Jun untouched
  })

  it('empty plan -> all zeros', () => {
    const kills = planToKills([], false)
    expect(kills).toEqual(Array(24).fill(0))
  })

  it('southern rotation moves the same plan to different periods', () => {
    const plan = [entry(1, 'Aug', 'apivar')]
    const north = planToKills(plan, false)
    const south = planToKills(plan, true)
    const nIdx = north.indexOf(0.95)
    const sIdx = south.indexOf(0.95)
    expect(nIdx).toBe(18) // Aug -> period 19
    expect(sIdx).toBe(6) // southern Aug -> period 7
    expect(nIdx).not.toBe(sIdx)
  })
})

describe('treatmentPeriods', () => {
  it('lists unique model periods with treatments, in order placed', () => {
    const plan = [entry(1, 'Jun', 'apivar'), entry(2, 'Jun', 'sugar-dusting'), entry(3, 'Sep', 'apiguard')]
    expect(treatmentPeriods(plan, false)).toEqual([15, 21])
  })

  it('empty plan -> no markers', () => {
    expect(treatmentPeriods([], false)).toEqual([])
  })
})

describe('planKillFraction', () => {
  it('composes the whole plan multiplicatively', () => {
    const plan = [entry(1, 'Jun', 'apivar'), entry(2, 'Sep', 'apiguard')]
    expect(planKillFraction(plan)).toBeCloseTo(composeKills([0.95, 0.9]), 12)
  })

  it('empty plan -> 0', () => {
    expect(planKillFraction([])).toBe(0)
  })
})
