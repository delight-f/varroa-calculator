/**
 * Period <-> calendar-month mapping for the chart's x-axis.
 *
 * The model's periods are 24 half-month segments starting at biological
 * period 1 (~Nov 1). Each period's calendar month is the month of its start
 * date, which the workbook anchors pin down:
 *   - period 1  ~ Nov 1    (start of brood-rearing ramp-up)
 *   - period 11 = Apr 1    (nuc/package install date)
 *   - period 16 ~ mid-June (default treatment)
 *   - period 19 ~ Aug 1
 * That yields: period p -> months[floor((p-1)/2)] with
 * months = [Nov, Dec, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct].
 *
 * Southern hemisphere: every season-anchored input rotates 12 periods (fix E:
 * southern p reads northern ((p+11)%24)+1), so month labels follow the same
 * rotation — southern period 1 is May (southern start of the beekeeping year).
 */

export const MONTH_NAMES = [
  'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct',
] as const

export type MonthName = (typeof MONTH_NAMES)[number]

export function isMonthName(s: string): s is MonthName {
  return (MONTH_NAMES as readonly string[]).includes(s)
}

/** Northern source period for a simulation period (southern 12-rotation). */
export function sourcePeriod(period: number, southern: boolean): number {
  if (!southern) return period
  return ((period + 11) % 24) + 1
}

/** Calendar month label for a simulation period, hemisphere-aware. */
export function periodToMonth(period: number, southern: boolean): MonthName {
  const src = sourcePeriod(period, southern)
  return MONTH_NAMES[Math.floor((src - 1) / 2)]!
}

/**
 * First simulation period whose label is the given calendar month.
 * In the north: Nov -> 1, Dec -> 3, ..., Oct -> 23.
 * In the south the labels rotate: May -> 1, Jun -> 3, ..., Apr -> 23.
 */
export function monthToStartPeriod(month: MonthName, southern: boolean): number {
  for (let p = 1; p <= 24; p++) {
    if (periodToMonth(p, southern) === month) return p
  }
  throw new RangeError(`no period labels month ${month}`)
}

/** 24 consecutive period numbers starting at `startPeriod`, wrapping through the year. */
export function displayWindow(startPeriod: number): number[] {
  const out: number[] = []
  for (let i = 0; i < 24; i++) {
    out.push(((startPeriod - 1 + i) % 24) + 1)
  }
  return out
}
