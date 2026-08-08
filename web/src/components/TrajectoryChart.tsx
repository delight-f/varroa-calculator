/**
 * Trajectory chart (ApexCharts line chart).
 *
 * ADR-0003: single-hue weight hierarchy — bold deep-blue treatment line,
 * faint grey baseline; x-axis tick/flag treatment markers (product name on
 * hover); crash threshold line; colours from design tokens (light + dark).
 *
 * T9: y-axis toggle between wash count (mites/wash) and total mite
 * population, threshold reference lines (watch + treat), legend, and
 * responsive sizing for tablet.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ScenarioDisplayPeriod } from '../model/scenario'
import type { TreatmentEntry } from '../model/treatmentPlan'
import { treatmentProduct } from '../treatments'
import { ADVISORY } from '../model/banner'

export interface ChartProps {
  periods: ScenarioDisplayPeriod[]
  /** treated line data (bold deep blue) */
  treated: number[]
  /** baseline line data (faint grey) */
  baseline: number[]
  /** treated total-mite line data (bold deep blue) */
  treatedMites: number[]
  /** baseline total-mite line data (faint grey) */
  baselineMites: number[]
  /** treatments placed on model periods, for x-axis tick/flag markers */
  treatmentPeriods: Array<{ period: number; entries: TreatmentEntry[] }>
  /** y-axis unit: wash count (mites/wash) or total mite population */
  yUnit: 'wash' | 'mites'
  /** secondary interaction: click a period to place a treatment */
  onClickPeriod?: (period: number) => void
}

export function TrajectoryChart({
  periods,
  treated,
  baseline,
  treatedMites,
  baselineMites,
  treatmentPeriods,
  yUnit,
  onClickPeriod,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(420)

  // Size the chart to fill its container (the chart-card), so the plot area
  // stretches to match the controls panel height on desktop instead of
  // leaving dead space below a fixed 420px chart.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setHeight(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const css = useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      accent: s.getPropertyValue('--color-accent').trim() || '#2563eb',
      baseline: s.getPropertyValue('--color-baseline').trim() || '#9ca3af',
      text: s.getPropertyValue('--color-text').trim() || '#111827',
      muted: s.getPropertyValue('--color-text-muted').trim() || '#6b7280',
      grid: s.getPropertyValue('--color-border').trim() || '#e5e7eb',
      red: s.getPropertyValue('--color-red').trim() || '#dc2626',
      yellow: s.getPropertyValue('--color-yellow').trim() || '#d97706',
    }
  }, [])

  // the active line is whichever unit is selected; the other is hidden
  const active = yUnit === 'wash' ? treated : treatedMites
  const activeBaseline = yUnit === 'wash' ? baseline : baselineMites

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

    // Threshold reference lines (wash mode only): the "watch" line (3
    // mites/wash) and the treat threshold (9 mites/wash in summer). Both are
    // configurable constants from the banner's advisory thresholds. In total-
    // mite mode these wash-based thresholds don't apply, so they're hidden.
    const yAnnotations =
      yUnit === 'wash'
        ? [
            {
              y: ADVISORY.watchWash,
              borderColor: css.yellow,
              strokeDashArray: 4,
              label: {
                text: `watch (${ADVISORY.watchWash})`,
                style: { color: '#fff', background: css.yellow, fontSize: '10px' },
              },
            },
            {
              y: ADVISORY.dangerousWashHigh,
              borderColor: css.red,
              strokeDashArray: 4,
              label: {
                text: `treat (${ADVISORY.dangerousWashHigh})`,
                style: { color: '#fff', background: css.red, fontSize: '10px' },
              },
            },
            ...(firstCrash >= 0
              ? [
                  {
                    y: ADVISORY.crashWash,
                    borderColor: css.red,
                    strokeDashArray: 4,
                    label: {
                      text: 'model breakdown (wash > 60)',
                      style: { color: '#fff', background: css.red, fontSize: '10px' },
                    },
                  },
                ]
              : []),
          ]
        : []

    return {
      chart: {
        type: 'line',
        toolbar: { show: false },
        animations: { enabled: true, speed: 300 },
        fontFamily: 'inherit',
        background: 'transparent',
        // responsive: fill the card width, fixed height; ApexCharts resizes
        // with the container on window resize
        width: '100%',
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
        categories: periods.map(
          // The model runs 24 half-month periods (two per calendar month).
          // Blank the second period's label so the axis shows one month name
          // per month; the data keeps all 24 points. (Annotations resolve a
          // month label to its first period, which is the intended anchor.)
          (p, i) => (i % 2 === 1 ? '' : p.label),
        ),
        labels: {
          style: { colors: css.muted },
          rotate: -45,
        },
        axisBorder: { color: css.grid },
        axisTicks: { color: css.grid },
        tickPlacement: 'on',
      },
      yaxis: {
        title: { text: yTitle, style: { color: css.muted } },
        labels: {
          style: { colors: css.muted },
          // integer-only ticks: no decimal points (wash counts and mite
          // populations are whole numbers; full float precision inflates the
          // left margin and pushes the title off-screen)
          formatter: (val: number) => Math.round(val).toString(),
        },
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'right',
        labels: { colors: css.muted },
        markers: { size: 6 },
        itemMargin: { horizontal: 8 },
      },
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
                  // ApexCharts resolves x-axis annotation x/x2 against the
                  // category *labels* (getStringX), not indices. Passing the
                  // month label at the crash point and the last period's label
                  // makes the band span from the crash month to the chart end.
                  x: periods[firstCrash]!.label,
                  x2: periods[periods.length - 1]!.label,
                  fillColor: css.red,
                  opacity: 0.18,
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
        yaxis: yAnnotations,
      },
    }
  }, [periods, treated, baseline, treatedMites, baselineMites, treatmentPeriods, yUnit, css, onClickPeriod])

  const seriesData = [
    { name: 'With treatments', data: active },
    { name: 'No treatment (baseline)', data: activeBaseline },
  ]

  return (
    <div ref={containerRef} className="chart-fill">
      <ReactApexChart options={options} series={seriesData} type="line" height={height} />
    </div>
  )
}