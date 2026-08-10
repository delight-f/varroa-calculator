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
  /** first crash window index per line (issue #14); the line ends there */
  treatedCrashIndex?: number | null
  baselineCrashIndex?: number | null
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
  treatedCrashIndex,
  baselineCrashIndex,
  onClickPeriod,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ApexCharts | null>(null)
  const [height, setHeight] = useState(420)
  const [gridWidth, setGridWidth] = useState(0)
  const [gridHeight, setGridHeight] = useState(0)

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

  // The crash zone needs the grid's pixel width (gridWidth/24 px per
  // category). Read it from the ApexCharts instance after render and when the
  // container resizes.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const g = (chartRef.current as unknown as { w?: { globals?: { gridWidth?: number; gridHeight?: number } } })
        ?.w?.globals
      if (typeof g?.gridWidth === 'number' && g.gridWidth > 0) setGridWidth(g.gridWidth)
      if (typeof g?.gridHeight === 'number' && g.gridHeight > 0) setGridHeight(g.gridHeight)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])
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

  // Issue #14: a crashed colony's post-crash arithmetic is unreliable, so each
  // line ends at its own first crash (per-line truncation). Nulls past the
  // crash break the ApexCharts line; the crash point itself is kept as the
  // last point and repeated as a subtle end-cap so the line's terminus is
  // visible (ApexCharts draws no marker for a single trailing point).
  const crashCap = (n: number): number | null => (Number.isFinite(n) ? n : null)
  const capped = (arr: number[], idx: number | null | undefined): (number | null)[] => {
    if (idx == null) return arr.map(crashCap)
    return arr.map((v, i) => (i < idx ? crashCap(v) : i === idx ? crashCap(v) : null))
  }
  const seriesActive = capped(active, treatedCrashIndex)
  const seriesBaseline = capped(activeBaseline, baselineCrashIndex)

  const options = useMemo<ApexCharts.ApexOptions>(() => {
    const firstCrash = periods.findIndex((p) => p.crashed)
    const yTitle = yUnit === 'wash' ? 'Mites per wash' : 'Total mites'

    // Treatment markers (issue #15): a small red triangle planted on the
    // x-axis at each treatment period (author resolution, ADR-0003 "tick/flag"
    // overridden to a triangle). The product names are NOT permanent labels —
    // the label text is drawn but hidden (opacity 0) and revealed on marker
    // hover via mouseEnter/mouseLeave, so the chart stays uncluttered. One
    // triangle per period, even when multiple products share it; hover lists
    // them joined with " + " plus the month.
    const treatmentAnnotations = treatmentPeriods
      .map((t) => {
        const idx = periods.findIndex((p) => p.period === t.period)
        if (idx < 0) return null
        const names = t.entries.map((e) => treatmentProduct(e.productId).name).join(' + ')
        const id = `treatmark-${idx}`
        const setLabelVisible = (visible: boolean) => () => {
          const el = document.querySelector(`.apexcharts-point-annotation-label.${id}`)
          if (el instanceof SVGElement) el.style.opacity = visible ? '1' : '0'
        }
        return {
          id,
          // x as the month label string: ApexCharts resolves category
          // annotations by string lookup against the (blanked) axis labels
          // (Helpers.getStringX). A numeric index falls through to raw pixel
          // x and crams every triangle at the left edge (issue #15).
          x: periods[idx]!.label,
          // pixel y pins the marker to the bottom of the grid (the x-axis);
          // the triangle's apex points up, base sits on the axis line.
          // ApexCharts resolves "NNpx" y strings at runtime (Helpers.getY1Y2);
          // the types only allow numbers, so cast.
          y: `${gridHeight}px` as unknown as number,
          marker: {
            size: 6,
            shape: 'triangle' as const,
            fillColor: css.red,
            strokeColor: css.red,
            strokeWidth: 1,
          },
          label: {
            text: `${names} · ${periods[idx]!.label}`,
            style: {
              color: '#fff',
              background: css.red,
              fontSize: '10px',
              cssClass: 'treatmark-label',
            },
          },
          mouseEnter: setLabelVisible(true),
          mouseLeave: setLabelVisible(false),
        }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)

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
        // click-to-place (secondary path, issue #18): the only click path
        // that carries the data-point index. `e` is the DOM event, `cc` the
        // chart context, `opt` = { seriesIndex, dataPointIndex, w }.
        ...(onClickPeriod
          ? {
              events: {
                dataPointSelection: (
                  _e: unknown,
                  _cc: unknown,
                  opt?: { dataPointIndex?: number },
                ) => {
                  const idx = opt?.dataPointIndex
                  if (idx !== undefined && periods[idx]) {
                    onClickPeriod(periods[idx]!.period)
                  }
                },
              },
            }
          : {}),
      },
      colors: [css.accent, css.baseline],
      stroke: {
        width: [3, 1.5],
        curve: 'smooth',
      },
      // markers are enabled when click-to-place is on; the click path is
      // chart.events.dataPointSelection below (issue #18: markers.onClick is
      // a raw DOM listener — the callback never receives dataPointIndex).
      markers: onClickPeriod ? { size: 4, hover: { size: 6 } } : { size: 0 },
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
          // crash zone: shaded/faded region from the crash point to the end
          // (numbers keep plotting past it — never blanked)
          ...(firstCrash >= 0
            ? [
                {
                  // The crash zone starts at the exact period where the model
                  // flags a crash (wash > 60 or cell invasion > 50%), not at
                  // the start of that calendar month. Category-label based x
                  // loses precision (labels repeat per month), so use pixel
                  // positions: category width = gridWidth/24, crash index i is
                  // at i * categoryWidth from the grid origin.
                  x:
                    gridWidth > 0
                      ? `${(firstCrash / periods.length) * gridWidth}px`
                      : periods[firstCrash]!.label,
                  x2:
                    gridWidth > 0
                      ? `${gridWidth}px`
                      : periods[periods.length - 1]!.label,
                  fillColor: css.red,
                  opacity: 0.18,
                  strokeDashArray: 4,
                  label: {
                    text: 'crash zone',
                    orientation: 'horizontal' as const,
                    position: 'top' as const,
                    // anchor at the band's right end so it reads like the
                    // horizontal y-axis annotation labels on the chart's right
                    offsetX:
                      gridWidth > 0
                        ? ((periods.length - firstCrash) / periods.length) * gridWidth - 8
                        : 0,
                    textAnchor: 'end' as const,
                    style: { color: css.red, fontSize: '10px', background: 'transparent' },
                  },
                },
              ]
            : []),
        ],
        yaxis: yAnnotations,
        points: treatmentAnnotations,
      },
    }
  }, [periods, treated, baseline, treatedMites, baselineMites, treatmentPeriods, yUnit, css, onClickPeriod, gridWidth, gridHeight, treatedCrashIndex, baselineCrashIndex])

  const seriesData = [
    { name: 'With treatments', data: seriesActive },
    { name: 'No treatment (baseline)', data: seriesBaseline },
  ]

  return (
    <div ref={containerRef} className="chart-fill">
      <ReactApexChart
        chartRef={chartRef}
        options={options}
        series={seriesData}
        type="line"
        height={height}
      />
    </div>
  )
}