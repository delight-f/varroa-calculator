/**
 * Curated colony-type catalog: the 9 single-letter codes with human-readable
 * names and one-line descriptions (from the spec's "Colony types" section).
 */

export interface ColonyTypeInfo {
  code: string
  name: string
  description: string
}

export const COLONY_TYPES: readonly ColonyTypeInfo[] = [
  { code: 'd', name: 'Default colony', description: 'Temperate, managed to prevent swarming' },
  { code: 'n', name: 'Nucleus', description: 'Small starter hive from a split' },
  { code: 'p', name: 'Package', description: 'Bought package of bees, new installation' },
  { code: 'a', name: 'Subtropical', description: 'No brood break, continuous rearing' },
  { code: 'b', name: 'High latitude', description: 'Long brood break in winter' },
  { code: 'c', name: 'Almond pollinator', description: 'Managed for almond pollination' },
  { code: 'r', name: 'Swarm survivor / feral', description: 'Small swarm that survived' },
  { code: 's', name: 'Small swarm, re-queened', description: 'Small swarm with a new queen' },
  { code: 'f', name: 'Feral', description: 'Feral colony with swarm reductions' },
] as const

export function colonyTypeInfo(code: string): ColonyTypeInfo {
  const found = COLONY_TYPES.find((c) => c.code === code)
  if (!found) throw new RangeError(`unknown colony type code: ${code}`)
  return found
}
