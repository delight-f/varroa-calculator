/**
 * Trajectory chart (ApexCharts line chart).
 *
 * ADR-0003: single-hue weight hierarchy — bold deep-blue treatment line,
 * faint grey baseline; x-axis tick/flag treatment markers (product name on
 * hover); crash threshold line; colours from design tokens (light + dark).
 */

import { useMemo } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ScenarioDisplayPeriod } from '../model/scenario'
import type { TreatmentEntry } from '../model/treatmentPlan'
import { treatmentProduct } from '../treatments'

export interface ChartProps {
  periods: ScenarioDisplayPeriod[]
  /** treated line data (bold deep blue) */
  treated: number[]
  /** baseline line data (faint grey) */
  baseline: number[]
  /** treatments placed on model periods, for x-axis tick/flag markers */
  treatmentPeriods: Array<{ period: number; entries: TreatmentEntry[] }>
  /** y-axis unit: wash count (mites/wash) or total mite population */
  yUnit: 'wash' | 'mites'
  /** secondary interaction: click a period to place a treatment */
  onClickPeriod?: (period: number) => void
}

export function TrajectoryChart({ periods, treated, baseline, treatmentPeriods, yUnit, onClickPeriod }: ChartProps) {
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

    // x-axis tick/flag markers (ADR-0003): a short vertical tick at the
    // treatment's category, with the product name as the annotation label.
    const xAnnotations = treatmentPeriods.map((t) => {
      const idx = periods.findIndex((p) => p.period === t.period)
      if (idx < 0) return null
      const label = t.entries.map((e) => treatmentProduct(e.productId).name).join(' + ')
      return {
        x: idx, // category index
        borderColor: css.accent,
        strokeDashArray: 0,
        strokeWidth: 2,
        label: {
          text: label,
          position: 'top' as const,
          style: { color: '#fff', background: css.accent, fontSize: '10px' },
        },
      }
    }).filter((a): a is NonNullable<typeof a> => a !== null)

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
        curve: 'smooth',
      },
      // markers are the click targets for click-to-place (secondary path);
      // onClick receives (event, chartContext, {dataPointIndex, seriesIndex})
      // at runtime; the type only declares the first arg, so narrow the rest.
      markers: onClickPeriod
        ? {
            size: 4,
            hover: { size: 6 },
            onClick: (e?: unknown) => {
              if (e && typeof e === 'object' && 'dataPointIndex' in e) {
                const idx = (e as { dataPointIndex?: number }).dataPointIndex
                if (idx !== undefined) onClickPeriod(periods[idx]!.period)
              }
            },
          }
        : { size: 0 },
      grid: { borderColor: css.grid },
      xaxis: {
        type: 'category',
        categories: periods.map((p) => p.label),
        labels: { style: { colors: css.muted }, rotate: -45 },
        axisBorder: { color: css.grid },
        axisTicks: { color: css.grid },
        tickPlacement: 'on',
      },
      yaxis: {
        title: { text: yTitle, style: { color: css.muted } },
        labels: { style: { colors: css.muted } },
      },
      legend: { show: false },
      // intersect:true makes markers interactive (removes no-pointer-events),
      // required for click-to-place via dataPointSelection. shared must be
      // false with intersect (ApexCharts constraint).
      tooltip: { theme: 'dark', shared: false, intersect: true },
      dataLabels: { enabled: false },
      fill: { opacity: [1, 1] },
      annotations: {
        xaxis: [
          ...xAnnotations,
          // crash zone: shaded/faded region from the crash point to the end
          // (numbers keep plotting past it — never blanked)
          ...(firstCrash >= 0
            ? [
                {
                  x: firstCrash,
                  x2: periods.length - 1,
                  fillColor: css.red,
                  opacity: 0.08,
                  strokeDashArray: 4,
                  label: {
                    text: 'crash zone',
                    position: 'top' as const,
                    style: { color: css.red, fontSize: '10px' },
                  },
                },
              ]
            : []),
        ],
        yaxis:
          firstCrash >= 0
            ? [
                {
                  y: 60,
                  borderColor: css.red,
                  strokeDashArray: 4,
                  label: { text: 'model breakdown (wash > 60)', style: { color: '#fff', background: css.red } },
                },
              ]
            : [],
      },
    }
  }, [periods, treated, baseline, treatmentPeriods, yUnit, css, onClickPeriod])

  const seriesData = [
    { name: 'With treatments', data: treated },
    { name: 'No treatment (baseline)', data: baseline },
  ]

  return <ReactApexChart options={options} series={seriesData} type="line" height={420} />
}
