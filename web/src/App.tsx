import { useMemo, useState } from 'react'
import { ControlsPanel } from './components/ControlsPanel'
import type { ControlsState } from './components/ControlsPanel'
import { TrajectoryChart, buildSeries } from './components/TrajectoryChart'
import { runScenario } from './model/scenario'
import { MONTH_NAMES, isMonthName } from './model/months'
import type { MonthName } from './model/months'

function detectMonth(): MonthName {
  // Period 1 = Nov; today's month maps through the same calendar (model year
  // starts Nov). Northern detection only; southern users override.
  const now = new Date()
  const idx = (now.getMonth() + 2) % 12 // Nov=0, Dec=1, ..., Oct=11
  return MONTH_NAMES[idx]!
}

function initialControls(): ControlsState {
  const m = detectMonth()
  return {
    colonyType: 'd',
    southern: false,
    month: isMonthName(m) ? m : 'Nov',
    washCount: 10,
    immigrationSetting: 0,
  }
}

function App() {
  const [controls, setControls] = useState<ControlsState>(initialControls)

  const scenario = useMemo(
    () =>
      runScenario({
        colonyType: controls.colonyType,
        washCount: controls.washCount,
        startMonth: controls.month,
        immigrationSetting: controls.immigrationSetting,
        southern: controls.southern,
      }),
    [controls],
  )

  // Phase 3: no treatments yet (T7). The treatment series mirrors the baseline
  // (bold blue) so both lines are visible; T7 will make it diverge.
  const series = useMemo(() => buildSeries(scenario.periods, 'wash', 0), [scenario])

  const update = (patch: Partial<ControlsState>) => setControls((c) => ({ ...c, ...patch }))

  return (
    <div className="app">
      <header className="app-header">
        <h1>Varroa Mite Calculator</h1>
        <p className="app-subtitle">Project your hive's mite population over the coming year</p>
      </header>
      <main className="app-body">
        <ControlsPanel state={controls} onChange={update} />
        <section className="chart-area">
          <div className="banner-slot" />
          <div className="chart-card">
            <TrajectoryChart periods={scenario.periods} series={series} yUnit="wash" />
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
