# Varroa Model

A web tool that lets working beekeepers project their hive's Varroa mite
population over a year, grounded in Randy Oliver's V2026 mite-population model.

## Language

**Period**:
One of 24 half-month segments the simulation divides the year into. Period 1 is the biological start of the beekeeping year (start of brood-rearing ramp-up).
_Avoid_: month, timestep

**Wash count**:
The number of mites found in a standard ~315-bee alcohol-wash (or sugar-shake) sample — the observable infestation rate a beekeeper measures directly.
_Avoid_: mites, count, infestation level

**Mite population**:
The total estimated Varroa mites in the colony (phoretic + in-brood). The model's internal unit; related to but not equal to a wash count.
_Avoid_: mites, mite count, infestation

**Colony type**:
A named annual curve of frames-of-bees, frames-of-brood, and drone-brood fraction over 24 periods, describing a colony's establishment scenario. Nine types: Default, Nucleus, Package, Subtropical, High-latitude, Almond pollinator, Swarm survivor/feral, Small swarm re-queened, Feral.
_Avoid_: scenario, curve

**Treatment**:
A one-time kill of a fraction of all mites (phoretic and in-brood) at the end of a period. Each treatment product maps to an efficacy (kill fraction) and a recommended timing; the beekeeper places one or more on the period timeline. OAV with brood requires repeated weekly applications.
_Avoid_: kill, application, intervention

**Immigration/drift setting**:
A 0–4 index selecting a per-period mite-influx table representing drift from neighbouring colonies. Setting 0 = no neighbours; higher settings add mites during the drift season (periods 11–20).
_Avoid_: reinfection, drift level

**r value**:
The net daily rate of mite population change for a period — the model's headline growth metric.
_Avoid_: growth rate, increase rate


## Design decisions

Visual and UX direction for the web tool, decided 2026-08-08 (recorded in
ADR-0003). Tickets in the issue tracker assume these decisions.

- **Direction**: clean SaaS dashboard (light, professional, calm).
- **Accent**: deep blue — deliberately distinct from the traffic-light banner
  colours (green/yellow/red).
- **Typeface**: Inter (webfont).
- **Chart style**: single-hue, weight hierarchy — bold blue treatment line,
  faint grey baseline; hierarchy via line weight and opacity, not colour.
- **Treatment markers**: x-axis tick/flag at the treatment period, product
  name shown on hover. Keeps the data line uncluttered.
- **Banner**: status pill + plain text (not a full-width colour wash); the
  chart stays visually dominant. Icon + colour paired, never colour alone
  (colour-blind safe).
- **Header**: slim header bar with the tool name.
- **Material**: soft SaaS — 8–12px border radius, hairline borders, faint
  hover shadows.
- **Density**: middle-ground — all controls visible without scrolling on a
  typical laptop; 16–20px group gaps.
- **Dark mode**: light + auto dark via `prefers-color-scheme` (CSS variable
  design tokens; follows the OS, no manual toggle for v1).
- **Treatment placement**: form-based add (dropdown + month + button) as the
  primary path; click-to-place on the chart as a secondary path. Both write
  to the same treatment-plan state.

## Open questions

- **Treatment-advisory thresholds.** The banner uses "watch closely" (~3 mites/wash) and "treat now" (~9 mites/wash) as extension-service conventions. These are NOT confirmed — user to verify the correct threshold values for the target audience and region. The model-breakdown thresholds (wash > 60, cell invasion > 50%) are confirmed from the workbook.