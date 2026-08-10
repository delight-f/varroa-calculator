import { useMemo, useState } from 'react'
import { ControlsPanel } from './components/ControlsPanel'
import type { ControlsState } from './components/ControlsPanel'
import { TreatmentPlanSection } from './components/TreatmentPlanSection'
import { TrajectoryChart } from './components/TrajectoryChart'
import { Banner } from './components/Banner'
import { MonthlyTable } from './components/MonthlyTable'
import { runScenario } from './model/scenario'
import { groupTreatmentsByPeriod } from './model/treatmentPlan'
import type { TreatmentEntry } from './model/treatmentPlan'
import { bannerState } from './model/banner'
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
    yUnit: 'wash',
  }
}

let nextTreatmentId = 1

function App() {
  const [controls, setControls] = useState<ControlsState>(initialControls)
  const [treatments, setTreatments] = useState<TreatmentEntry[]>([])
  const [plotGeometry, setPlotGeometry] = useState<{ firstCenter: number; catWidth: number } | null>(null)

  const scenario = useMemo(
    () =>
      runScenario({
        colonyType: controls.colonyType,
        washCount: controls.washCount,
        startMonth: controls.month,
        immigrationSetting: controls.immigrationSetting,
        southern: controls.southern,
        treatments,
      }),
    [controls, treatments],
  )

  const addTreatment = (month: MonthName, productId: string) => {
    setTreatments((ts) => [...ts, { id: nextTreatmentId++, month, productId }])
  }
  const removeTreatment = (id: number) => {
    setTreatments((ts) => ts.filter((t) => t.id !== id))
  }

  // x-axis tick/flag markers: group treatments by display period. The period
  // must be the *display* period (southern-aware) so markers land at the
  // month the user sees on the x-axis, not 6 months off (issue: southern
  // offset). The model kill array stays northern-indexed separately.
  const markers = useMemo(
    () => groupTreatmentsByPeriod(treatments, controls.southern),
    [treatments, controls.southern],
  )

  const update = (patch: Partial<ControlsState>) => setControls((c) => ({ ...c, ...patch }))

  const banner = useMemo(
    () =>
      bannerState({
        startWash: controls.washCount,
        washTrajectory: scenario.treatedWash,
        labels: scenario.periods.map((p) => p.label),
        hasTreatments: treatments.length > 0,
        crashed: scenario.periods.some((p) => p.crashed),
        crashIndex: scenario.treatedCrashIndex,
        southern: controls.southern,
      }),
    [scenario, treatments.length, controls.washCount, controls.southern],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Varroa Mite Calculator</h1>
        <p className="app-subtitle">Project your hive's mite population over the coming year</p>
      </header>
      <main className="app-body">
        <ControlsPanel state={controls} onChange={update}>
          <TreatmentPlanSection
            treatments={treatments}
            onAdd={addTreatment}
            onRemove={removeTreatment}
          />
        </ControlsPanel>
        <section className="chart-area">
          <Banner state={banner} />
          <div className="chart-card">
            <TrajectoryChart
              periods={scenario.periods}
              treated={scenario.treatedWash}
              baseline={scenario.baselineWash}
              treatedMites={scenario.treatedMites}
              baselineMites={scenario.baselineMites}
              treatmentPeriods={markers}
              yUnit={controls.yUnit}
              treatedCrashIndex={scenario.treatedCrashIndex}
              baselineCrashIndex={scenario.baselineCrashIndex}
              onClickPeriod={(period) => {
                // secondary path: click a point -> place the currently selected
                // product on that month (default Apivar). The form remains primary.
                const label = scenario.periods.find((p) => p.period === period)?.label
                if (label) addTreatment(label as MonthName, 'apivar')
              }}
              onPlotGeometry={setPlotGeometry}
            />
          </div>
          <div className="chart-card table-card">
            <MonthlyTable
              periods={scenario.periods}
              firstCenter={plotGeometry?.firstCenter ?? null}
              catWidth={plotGeometry?.catWidth ?? null}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
