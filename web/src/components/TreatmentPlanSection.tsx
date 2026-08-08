/**
 * Treatment plan section of the controls panel.
 *
 * Primary path (ADR-0003): form-based add — product dropdown + month picker
 * + "Add treatment". Each placed treatment lists as a row (product name,
 * month, remove ×). Advisory timing text is shown, never enforced.
 * Same-month treatments compose multiplicatively in the model.
 */

import { useState } from 'react'
import { TREATMENT_PRODUCTS, treatmentProduct } from '../treatments'
import { MONTH_NAMES } from '../model/months'
import type { MonthName } from '../model/months'
import type { TreatmentEntry } from '../model/treatmentPlan'

export interface TreatmentPlanSectionProps {
  treatments: TreatmentEntry[]
  onAdd: (month: MonthName, productId: string) => void
  onRemove: (id: number) => void
}

export function TreatmentPlanSection({ treatments, onAdd, onRemove }: TreatmentPlanSectionProps) {
  const [month, setMonth] = useState<MonthName>('Sep')
  const [productId, setProductId] = useState<string>(TREATMENT_PRODUCTS[0]!.id)

  const selectedProduct = treatmentProduct(productId)

  return (
    <section className="control-group treatment-plan">
      <h2>Treatment plan</h2>

      <div className="treatment-add">
        <label className="field">
          <span className="field-label">Product</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {TREATMENT_PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({Math.round(p.killFraction * 100)}% kill)
              </option>
            ))}
          </select>
          <span className="field-hint">{selectedProduct.advisory}</span>
        </label>
        <label className="field">
          <span className="field-label">Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value as MonthName)}>
            {MONTH_NAMES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onAdd(month, productId)}
        >
          Add treatment
        </button>
      </div>

      {treatments.length === 0 ? (
        <p className="group-empty">No treatments planned. Add one above, or click a point on the chart.</p>
      ) : (
        <ul className="treatment-list">
          {treatments.map((t) => {
            const p = treatmentProduct(t.productId)
            return (
              <li key={t.id} className="treatment-row">
                <span className="treatment-info">
                  <span className="treatment-name">{p.name}</span>
                  <span className="treatment-meta">
                    {t.month} · {Math.round(p.killFraction * 100)}% kill
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Remove ${p.name}`}
                  title={`Remove ${p.name}`}
                  onClick={() => onRemove(t.id)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
