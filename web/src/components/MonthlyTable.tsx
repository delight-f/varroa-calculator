/**
 * Monthly table under the chart: numerical model output for each displayed
 * period. Mirrors the chart's 24 half-month periods — one column per period,
 * month labels repeating (second half-month blanked, like the x-axis).
 *
 * Two rows, both from the *treated* run (the trajectory the user's treatment
 * plan produces): total mite population at period end, and the % of mites in
 * (capped) brood. When no treatment is planned the treated run equals the
 * baseline, so the table shows the uncontrolled trajectory.
 */

import type { ScenarioDisplayPeriod } from '../model/scenario'

export interface MonthlyTableProps {
  periods: ScenarioDisplayPeriod[]
}

export function MonthlyTable({ periods }: MonthlyTableProps) {
  return (
    <div className="monthly-table">
      <table>
        <thead>
          <tr>
            <th className="table-row-label">Month</th>
            {periods.map((p, i) => (
              <th key={p.period} className={i % 2 === 1 ? 'month-cell blank' : 'month-cell'}>
                {i % 2 === 1 ? '' : p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="table-row-label">Mites</th>
            {periods.map((p) => (
              <td key={p.period} className="num-cell">
                {Math.round(p.mites).toLocaleString()}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="table-row-label">% in brood</th>
            {periods.map((p) => (
              <td key={p.period} className="num-cell">
                {Math.round(p.pctInBrood * 100)}%
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
