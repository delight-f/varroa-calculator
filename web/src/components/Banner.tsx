/**
 * Readout banner: a status pill + plain text above the chart.
 *
 * ADR-0003: icon always paired with colour (never colour alone) for
 * colour-blind users; the pill is subtle so the chart stays dominant.
 */

import type { BannerState } from '../model/banner'

const ICONS: Record<BannerState['icon'], string> = {
  'trending-up': '↗',
  'shield-check': '✓',
  'alert-triangle': '▲',
  'alert-octagon': '●',
}

export function Banner({ state }: { state: BannerState }) {
  return (
    <div className={`banner banner-${state.colour}`} role="status">
      <span className="banner-icon" aria-hidden="true">
        {ICONS[state.icon]}
      </span>
      <div className="banner-text">
        <span className="banner-title">{state.title}</span>
        <span className="banner-detail">{state.detail}</span>
      </div>
    </div>
  )
}
