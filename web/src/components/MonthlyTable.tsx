/**
 * Monthly table under the chart: numerical model output for each displayed
 * period. Mirrors the chart's 24 half-month periods — one column per period,
 * month labels repeating (second half-month blanked, like the x-axis).
 *
 * Two rows, both from the *treated* run (the trajectory the user's treatment
 * plan produces): total mite population at period end, and the % of mites in
 * (capped) brood. When no treatment is planned the treated run equals the
 * baseline, so the table shows the uncontrolled trajectory.
 *
 * Alignment: the table's data columns are positioned to match the chart's
 * data points. `firstCenter` is the first data point's center within the
 * chart container and `catWidth` the category width — the row-label column
 * ends where the first category starts (firstCenter - catWidth/2) and each
 * data column is catWidth wide, so column i's center sits exactly under
 * chart data point i.
 */

import type { ScenarioDisplayPeriod } from '../model/scenario'
import type { CSSProperties } from 'react'

export interface MonthlyTableProps {
  periods: ScenarioDisplayPeriod[]
  /** first data point's center relative to the chart container, or null */
  firstCenter?: number | null
  /** chart category width (pixel distance between adjacent points), or null */
  catWidth?: number | null
}

export function MonthlyTable({ periods, firstCenter = null, catWidth = null }: MonthlyTableProps) {
  const labelStyle: CSSProperties | undefined =
    firstCenter != null && catWidth != null
      ? { width: `${firstCenter - catWidth / 2}px`, minWidth: `${firstCenter - catWidth / 2}px` }
      : undefined
  const dataColStyle: CSSProperties | undefined =
    catWidth != null ? { width: `${catWidth}px` } : undefined
  return (
    <div className="monthly-table">
      <table>
        <thead>
          <tr>
            <th className="table-row-label" style={labelStyle}>Month</th>
            {periods.map((p, i) => (
              <th
                key={p.period}
                className={i % 2 === 1 ? 'month-cell blank' : 'month-cell'}
                style={dataColStyle}
              >
                {i % 2 === 1 ? '' : p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="table-row-label" style={labelStyle}>Mites</th>
            {periods.map((p) => (
              <td key={p.period} className="num-cell" style={dataColStyle}>
                {Math.round(p.mites).toLocaleString()}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="table-row-label" style={labelStyle}>% in brood</th>
            {periods.map((p) => (
              <td key={p.period} className="num-cell" style={dataColStyle}>
                {Math.round(p.pctInBrood * 100)}%
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
