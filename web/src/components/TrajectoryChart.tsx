/**
 * Trajectory chart (ApexCharts line chart).
 *
 * ADR-0003: single-hue weight hierarchy — bold deep-blue treatment line,
 * faint grey baseline; x-axis tick/flag treatment markers; crash zone
 * dashed/faded; colours from design tokens (light + dark).
 */

import { useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ScenarioDisplayPeriod } from '../model/scenario'

export interface ChartSeries {
  /** treatment-applied trajectory (bold blue) */
  treatment: Array<number | null>
  /** baseline no-treatment trajectory (faint grey) */
  baseline: number[]
  /** index into the window where the treatment line diverges (or -1) */
  firstTreatmentIndex: number
}

export interface ChartProps {
  periods: ScenarioDisplayPeriod[]
  series: ChartSeries
  /** y-axis unit: wash count (mites/wash) or total mite population */
  yUnit: 'wash' | 'mites'
}

export function buildSeries(
  periods: ScenarioDisplayPeriod[],
  yUnit: 'wash' | 'mites',
  firstTreatmentIndex: number,
): ChartSeries {
  const baseline = periods.map((p) => (yUnit === 'wash' ? p.wash : p.mites))
  const treatment = periods.map((p, i) =>
    i < firstTreatmentIndex ? null : yUnit === 'wash' ? p.wash : p.mites,
  )
  return { treatment, baseline, firstTreatmentIndex }
}

export function TrajectoryChart({ periods, series, yUnit }: ChartProps) {
  const css = useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      accent: s.getPropertyValue('--color-accent').trim() || '#2563eb',
      baseline: s.getPropertyValue('--color-baseline').trim() || '#9ca3af',
      text: s.getPropertyValue('--color-text').trim() || '#111827',
      muted: s.getPropertyValue('--color-text-muted').trim() || '#6b7280',
      grid: s.getPropertyValue('--color-border').trim() || '#e5e7eb',
      red: s.getPropertyValue('--color-red').trim() || '#dc2626',
    }
  }, [])

  const options = useMemo<ApexCharts.ApexOptions>(() => {
    const firstCrash = periods.findIndex((p) => p.crashed)
    const yTitle = yUnit === 'wash' ? 'Mites per wash' : 'Total mites'
    return {
      chart: {
        type: 'line',
        toolbar: { show: false },
        animations: { enabled: true, speed: 300 },
        fontFamily: 'inherit',
        background: 'transparent',
      },
      colors: [css.accent, css.baseline],
      stroke: {
        width: [3, 1.5],
        dashArray: firstCrash >= 0 ? [0, 0] : [0, 0],
        curve: 'smooth',
      },
      grid: { borderColor: css.grid },
      xaxis: {
        type: 'category',
        categories: periods.map((p) => p.label),
        labels: { style: { colors: css.muted } },
        axisBorder: { color: css.grid },
        axisTicks: { color: css.grid },
      },
      yaxis: {
        title: { text: yTitle, style: { color: css.muted } },
        labels: { style: { colors: css.muted } },
      },
      legend: { show: false },
      tooltip: { theme: 'dark' },
      dataLabels: { enabled: false },
      markers: { size: 0 },
      fill: { opacity: [1, 1] },
      // crash zone: dashed/faded beyond the first crashed period
      annotations: firstCrash >= 0 ? {
        yaxis: [
          {
            y: 60,
            borderColor: css.red,
            strokeDashArray: 4,
            label: { text: 'model breakdown (wash > 60)', style: { color: '#fff', background: css.red } },
          },
        ],
      } : {},
    }
  }, [periods, yUnit, css])

  const seriesData = [
    { name: 'With treatments', data: series.treatment },
    { name: 'No treatment (baseline)', data: series.baseline },
  ]

  return <ReactApexChart options={options} series={seriesData} type="line" height={420} />
}
