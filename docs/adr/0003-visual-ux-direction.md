# Visual and UX direction for the web tool

The web tool is a desk planning app for working beekeepers: used a few times a
year, on desktop/tablet, in daylight. The visual direction is a **clean SaaS
dashboard** — professional, calm, and legible — not a field app and not a
thematic "beekeeping" skin.

## Decisions

- **Direction**: clean SaaS dashboard (light, professional, calm).
- **Accent**: deep blue. Chosen because it never collides with the
  traffic-light banner palette (green/yellow/red); amber/honey was rejected
  because it sits too close to the yellow warning state.
- **Typeface**: Inter (webfont). De-facto SaaS standard, excellent legibility
  at 13–14px, best-supported by the AI tooling the project leans on.
- **Chart style**: single-hue, weight hierarchy — bold blue treatment line,
  faint grey baseline; hierarchy via line weight/opacity, not colour. Crash
  zone and thresholds stay semantic (red dashed/shaded) per the spec.
- **Treatment markers**: x-axis tick/flag at the treatment period, product
  name on hover. Keeps the data line uncluttered; the trajectory bend itself
  carries the cause-effect feedback.
- **Banner**: status pill + plain text (not a full-width colour wash) so the
  chart stays visually dominant. Icon + colour always paired — never colour
  alone — for colour-blind users.
- **Header**: slim header bar with the tool name, above the two-column body.
- **Material**: soft SaaS — 8–12px border radius, hairline borders, faint
  hover shadows (no resting shadows).
- **Density**: middle-ground — all controls visible without scrolling on a
  typical laptop; 16–20px gaps within/between groups.
- **Dark mode**: light + auto dark via `prefers-color-scheme`, implemented as
  CSS variable design tokens. No manual toggle for v1.
- **Treatment placement**: form-based add (product dropdown + month + "Add
  treatment") as the primary path; click-to-place on the chart as a secondary
  path. Both write to the same treatment-plan state; chart markers reflect the
  merged list.

## Consequences

- All downstream frontend work consumes CSS variable design tokens, never
  hardcoded colours — dark variants are part of the token layer.
- The status pill + icon pairing is load-bearing for colour-blind users; the
  banner states must never rely on colour alone.
- The deep-blue accent applies to chrome (links, buttons, focus rings,
  active states); the traffic-light palette is reserved for the banner and the
  chart's semantic zones.
- Tickets T5a–T9 carry these decisions in their acceptance criteria where
  relevant (marker style, banner rendering, chart styling, tokens).
