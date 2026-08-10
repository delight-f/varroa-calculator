/**
 * Left controls panel: My hive (colony type, southern hemisphere), My
 * measurement (month, wash count, immigration/drift setting), Treatment plan
 * (placeholder until T7).
 */

import { COLONY_TYPES } from '../catalog'
import { MONTH_NAMES } from '../model/months'
import type { MonthName } from '../model/months'

export interface ControlsState {
  colonyType: string
  southern: boolean
  month: MonthName
  washCount: number
  immigrationSetting: number
  /** chart y-axis: wash count (mites/wash) or total mite population */
  yUnit: 'wash' | 'mites'
}

export interface ControlsProps {
  state: ControlsState
  onChange: (next: Partial<ControlsState>) => void
  children?: React.ReactNode
}

const IMMIGRATION_OPTIONS = [
  { value: 0, label: 'No neighbours', hint: 'No drift from other colonies' },
  { value: 1, label: 'Few neighbours', hint: 'Light drift' },
  { value: 2, label: 'Some neighbours', hint: 'Moderate drift' },
  { value: 3, label: 'Many neighbours', hint: 'Heavy drift' },
  { value: 4, label: 'Apiary', hint: 'Extreme drift (many hives nearby)' },
] as const

export function ControlsPanel({ state, onChange, children }: ControlsProps) {
  return (
    <aside className="controls-panel">
      <section className="control-group">
        <h2>My hive</h2>
        <label className="field">
          <span className="field-label">Colony type</span>
          <select
            value={state.colonyType}
            onChange={(e) => onChange({ colonyType: e.target.value })}
          >
            {COLONY_TYPES.map((c) => (
              <option key={c.code} value={c.code} title={c.description}>
                {c.name} — {c.description}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-toggle">
          <span>
            <span className="field-label">Southern hemisphere</span>
            <span className="field-hint">Rotates the season by half a year</span>
          </span>
          <input
            type="checkbox"
            checked={state.southern}
            onChange={(e) => onChange({ southern: e.target.checked })}
          />
        </label>
      </section>

      <section className="control-group">
        <h2>My measurement</h2>
        <label className="field">
          <span className="field-label">Current month</span>
          <select
            value={state.month}
            onChange={(e) => onChange({ month: e.target.value as MonthName })}
          >
            {MONTH_NAMES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Wash count</span>
          <span className="field-hint">Mites in a ~315-bee alcohol wash</span>
          <input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(state.washCount) ? state.washCount : ''}
            onChange={(e) => {
              const v = e.target.valueAsNumber
              onChange({ washCount: Number.isNaN(v) ? 0 : v })
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">Immigration / drift</span>
          <select
            value={state.immigrationSetting}
            onChange={(e) => onChange({ immigrationSetting: Number(e.target.value) })}
          >
            {IMMIGRATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} title={o.hint}>
                {o.label} ({o.hint})
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Chart y-axis</span>
          <span className="field-hint">Wash count or the underlying total mite population</span>
          <div className="seg-toggle" role="group" aria-label="Chart y-axis unit">
            <button
              type="button"
              className={state.yUnit === 'wash' ? 'seg-toggle-btn active' : 'seg-toggle-btn'}
              aria-pressed={state.yUnit === 'wash'}
              onClick={() => onChange({ yUnit: 'wash' })}
            >
              Wash count
            </button>
            <button
              type="button"
              className={state.yUnit === 'mites' ? 'seg-toggle-btn active' : 'seg-toggle-btn'}
              aria-pressed={state.yUnit === 'mites'}
              onClick={() => onChange({ yUnit: 'mites' })}
            >
              Total mites
            </button>
          </div>
        </div>
      </section>

      {children}
    </aside>
  )
}
