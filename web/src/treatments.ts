/**
 * Curated treatment catalog: product -> kill fraction + advisory timing text.
 * From the T7 ticket: Apivar 0.95, Formic Pro 0.90, Apiguard 0.90,
 * OAV broodless 0.95, OAV with brood 0.33 (repeat weekly), OA trickle 0.80,
 * drone brood removal 0.15, sugar dusting 0.25.
 */

export interface TreatmentProduct {
  id: string
  name: string
  /** fraction of mites killed by one application */
  killFraction: number
  /** advisory timing text — shown to the beekeeper, never enforced */
  advisory: string
}

export const TREATMENT_PRODUCTS: readonly TreatmentProduct[] = [
  {
    id: 'apivar',
    name: 'Apivar',
    killFraction: 0.95,
    advisory: 'Amitraz strip, 6–10 weeks. Best in late summer after honey harvest.',
  },
  {
    id: 'formic-pro',
    name: 'Formic Pro',
    killFraction: 0.9,
    advisory: 'Formic acid gel, penetrates capped brood. Apply when temps 10–30°C.',
  },
  {
    id: 'apiguard',
    name: 'Apiguard',
    killFraction: 0.9,
    advisory: 'Thymol gel, 4–6 weeks. Best in warm weather (15°C+), after honey harvest.',
  },
  {
    id: 'oav-broodless',
    name: 'OAV broodless',
    killFraction: 0.95,
    advisory: 'Oxalic acid vapor, 3× at 5-day intervals. Only broodless — winter.',
  },
  {
    id: 'oav-with-brood',
    name: 'OAV with brood',
    killFraction: 0.33,
    advisory: 'Oxalic acid vapor, poor brood penetration — repeat weekly, up to 4×.',
  },
  {
    id: 'oa-trickle',
    name: 'OA trickle',
    killFraction: 0.8,
    advisory: 'Oxalic acid sugar syrup trickle, broodless colonies only.',
  },
  {
    id: 'drone-brood-removal',
    name: 'Drone brood removal',
    killFraction: 0.15,
    advisory: 'Cut out capped drone brood, 2–3× over spring. Reduces mites gradually.',
  },
  {
    id: 'sugar-dusting',
    name: 'Sugar dusting',
    killFraction: 0.25,
    advisory: 'Icing sugar dusting, weekly. Low efficacy — removes phoretic mites.',
  },
] as const

export function treatmentProduct(id: string): TreatmentProduct {
  const found = TREATMENT_PRODUCTS.find((p) => p.id === id)
  if (!found) throw new RangeError(`unknown treatment product: ${id}`)
  return found
}
