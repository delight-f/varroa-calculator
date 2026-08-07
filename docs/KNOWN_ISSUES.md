# Known Issues

Known, deliberately-untouched discrepancies and unvalidated paths in the Varroa
model project.  These are **not** fixed: the faithful model
(`varroa_model.py`) must keep matching the workbook cell-by-cell, and the
corrected variant (`varroa_model_corrected.py`) fixes only the documented
corrections A-F in its module docstring.

## 1. nuc/package period-12 spent-fraction seed: 0.25 vs 0.15

- `varroa_model.py:237` (and the corrected copy) seed the spent fraction for
  colony types `n` and `p` at period 12 with **0.25**.
- Both `MODEL.md` section 6 and `MODEL_CONFIRMATION.md` section 7 state the
  workbook uses **0.15**.
- The workbook cell itself is not checked by `validate.py` (which only
  exercises colony type `d`), so neither value is pinned to a validated
  reference.  Whether the workbook actually holds 0.15 or 0.25 is
  unconfirmed.

## 2. Undocumented 6th immigration column

- `immigration.json` has **6** columns per period (indices 0-5); the
  documented settings are 0-4 (`MODEL.md` section 7 documents five).
- Column 5 is present in the data with no documentation.  It is read if
  `immigration_setting=5` is passed.
- The corrected variant bounds-checks the setting (0..5) but does not remove
  column 5; the faithful variant does not bounds-check at all.

## 3. Southern-hemisphere path is unvalidated

- The faithful `VarroaModel` accepts `southern_hemisphere` but never reads it.
- The corrected variant implements it as a 12-period (half-year) rotation of
  the colony curve, immigration table, treatment array and nuc/package install
  period.  **No workbook cell exercises this path** — the rotation's
  correctness is asserted only by internal coherence tests
  (`tests/test_varroa_model_corrected.py`), not against an external reference.

## 4. Validation covers only colony type `d`

- `validate.py` compares the workbook's cached "Current version" run: colony
  `d`, 100 starting mites, immigration setting 0, one 80% treatment at period
  16.  The other eight colony types and the nuc/package special cases are
  never checked against the workbook.
