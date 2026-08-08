# Repository Guidelines

A clean Python re-implementation of **Randy Oliver's Varroa mite population model** (V2026), extracted from the spreadsheet `Randys-Varroa-Model-V2026 Web(1).xlsx` (sheet `Current version`). The model simulates a honey-bee colony's mite population across **24 half-month periods** (one year) and computes the net daily rate of mite increase (`r`) plus mite/wash-count trajectories. The implementation mirrors the source workbook's arithmetic *exactly* so its output can be validated cell-by-cell against the spreadsheet.

## Project Overview

The headline output is the **r value** (net daily rate of mite increase) and the mite/wash-count trajectory. Each period the model: reads colony state (frames of bees, frames of brood, % drone brood) from a colony-type curve; derives phoretic days from the brood:adult-bee ratio (after Boot, 1995) — the "heart of the model"; splits mites into phoretic vs in-brood and drone vs worker; computes a daily intrinsic growth rate; applies reproduction, natural mortality, immigration/drift, and an optional treatment kill; and tracks mite age structure so mites older than 75 days are non-reproductive.

- **Units**: population counts (mites, bees, cells); time in days; all growth/mortality rates are **per day**. Immigration/drift are counts per period.
- **Period length**: `PERIOD_DAYS = 365.0 / 24.0 ≈ 15.2083` days. (The workbook's dates are 15 days apart — a known internal inconsistency of the original; see Code Conventions.)

### Two model variants

The project is **bifurcated**:

- **`varroa_model.py`** — the *faithful* baseline. Reproduces the workbook's arithmetic cell-by-cell; validated to ~5e-12 by `validate.py`. **Do not change its numerics** — it is the reference.
- **`varroa_model_corrected.py`** — a standalone copy with six deliberate corrections (A–F, documented in its module docstring): cohort aging uses `PERIOD_DAYS` not `15`; the spent-fraction 0.99 cap is removed; the no-bees/no-brood sentinel hacks (`0.001`, `1.0`) are replaced with explicit guards; the inert `southern_hemisphere` flag is implemented as a 12-period rotation; and the `immigration_setting` index is bounds-checked. Its scientific character (reproduction, mortality, density, aging approximation, nuc/package cases) is unchanged.

## Architecture & Data Flow

Single-file pure-Python model per variant, **stdlib-only** (`math`, `json`, `os`, `dataclasses`, `typing`). The only third-party dependency (`openpyxl`) is used solely by `scripts/validate.py`. The package lives in `src/varroa/` (src layout); data files are co-located with the modules and loaded via `__file__`.

```
colony_types.json ─┐
                   ├─→ (loaded at import into module globals _CT, _IM)
immigration.json ──┘            │
                                ▼
              VarroaModel / VarroaModelCorrected(config)
                                │
                                ▼  run() loops periods 1..24
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
   colony_state/immigration (read curve)    _colony_vars (Boot phoretic split)
            │                                       │
            └──────────────► growth rates ◄─────────┘
                                │  r_drone_day / r_worker_day → r_repro → r_net
                                ▼
                   population dynamics: new_mites → after_repro → after_mort
                                │
                                ▼
                   immigration + drift-out (on dead bees)
                                │
                                ▼
                   treatment kill → mites_end, r_observed, crash indicators
                                │
                                ▼
                   aging cohort table update (_frac_spent: >75-day mites)
                                │
                                ▼
                          Run (24 × PeriodResult + 3 trajectories)
```

**Core classes** (per variant): `Params` (23 tunable params + 3 computed `@property` log-rates), `PeriodResult` (every quantity the spreadsheet computes for one period; each field's `#` comment inlines the **spreadsheet cell reference**, e.g. `# DF`, `# CA` — the tie between code and workbook), `Run` (params + periods + 3 trajectories), and the model class (`VarroaModel` / `VarroaModelCorrected`).

**Per-period loop (`run()`)** in order: spent-fraction seeding → start-of-period mites → drone/worker mite distribution → sealed cells & reproduction rates (`r_net`) → population dynamics → immigration + drift-out → treatment kill & observed rate → crash indicators → aging cohort table update.

## Key Directories

| Path | Purpose |
|---|---|
| `src/varroa/varroa_model.py` | Faithful model — the validated reference (do not change numerics) |
| `src/varroa/varroa_model_corrected.py` | Corrected variant (fixes A–F; standalone copy) |
| `src/varroa/colony_types.json` | 9 colony-type curves (24 periods each): `brood_frames`, `bee_frames`, `drone_frac` |
| `src/varroa/immigration.json` | Per-period mite immigration/drift tables (6 columns per period) |
| `scripts/validate.py` | Validation against the source `.xlsx` workbook (only user of `openpyxl`) |
| `tests/` | Stdlib-`unittest` tests for the corrected variant |
| `docs/MODEL.md` | Extracted cell-level model specification (9 sections) |
| `docs/MODEL_CONFIRMATION.md` | Author-facing prose description for Randy to confirm (327 lines) |
| `docs/KNOWN_ISSUES.md` | Documented-but-unfixed discrepancies and unvalidated paths |
| `pyproject.toml` | Packaging + ruff config |
| `README.md` | Project overview, usage, files |

## Development Commands

Python 3.14. Packaging via `pyproject.toml` (setuptools, src layout). Install editable for development:

```bash
pip install -e ".[dev]"        # ruff + basedpyright + openpyxl
```

```bash
# Run the default model (colony "d", 100 mites, no treatment) — prints a 24-row table
python3 src/varroa/varroa_model.py
python3 src/varroa/varroa_model_corrected.py   # corrected variant

# Validate the faithful model against the source workbook (requires openpyxl)
python3 scripts/validate.py "/path/to/Randys-Varroa-Model-V2026 Web(1).xlsx"
#   Default workbook path if arg omitted:
#   /home/faraaz/Downloads/Randys-Varroa-Model-V2026 Web(1).xlsx

# Run the test suite (stdlib unittest, no dependencies)
python3 -m unittest discover -s tests -v

# Lint / format (ruff) and type-check (basedpyright, strict mode)
ruff check .
ruff format .
basedpyright
```

Library usage (identical for both variants, differing class names):

```python
from varroa import VarroaModelCorrected

run = VarroaModelCorrected(
    colony_type="d",            # one of: d, n, p, a, b, c, r, s, f
    initial_mites=100.0,
    immigration_setting=0,      # column index into immigration.json rows (0-4 documented)
    treatment_kills=[0.0]*24,   # per-period kill fraction; e.g. 0.8 at period 16
    brood_break_periods=[],     # periods (1-24) forced to zero reproduction
    southern_hemisphere=False,  # corrected variant: 12-period rotation
).run()

for p in run.periods:
    print(p.period, round(p.mites_end, 1), round(p.r_observed, 4))
```

## Code Conventions & Common Patterns

- **Mirrors the workbook exactly (faithful variant).** By design: every cell reference, special seed value, and edge case reproduces a specific workbook cell so `validate.py` can compare cell-by-cell. Do not "clean up" workbook-faithful quirks in `varroa_model.py` without understanding the validation contract. The corrected variant is where such cleanups live.
- **Cell references inlined as comments.** Spreadsheet column letters appear on `PeriodResult` fields (e.g. `mites_start # DF`, `wash_count # DX`) and in docstrings (`BQ30`, `EK34 = DF5`). Preserve these — they are the traceability mechanism.
- **Growth via `math.exp`/`math.log`.** Per-day intrinsic rates: `math.log((1 + daughters·adj) · survival) / cell_days`. Discrete-period compounding: `math.exp(r · PERIOD_DAYS)`. Mortality stored as log-rates: `math.log(1 - p)`. Observed rate back-solves: `math.log(end/start) / PERIOD_DAYS`.
- **None→0.0 convention.** Workbook empty cells behave as zero. Encoded by `z = lambda v: 0.0 if v is None else float(v)` (in `colony_state`) and inlined `0.0 if val is None else float(val)` (in `immigration`).
- **`@dataclass`** for all three data shapes (`Params`, `PeriodResult`, `Run`); `Run` uses `field(default_factory=list)` for trajectory lists.
- **Typing**: builtin generics (`list[...]`, `dict[...]`, `tuple[...]`, `X | None`) and `TypedDict` for the JSON data shapes. No `from __future__ import annotations`; no `typing.List`/`typing.Dict` (deprecated).
- **Eager import-time JSON load**: `_CT` and `_IM` are loaded at module import (no error handling if files are missing). Importing either model requires the two JSON files beside it.
- **No logging, no exceptions (faithful), no async, no CLI parsing.** Output is plain `print` in `__main__`. Division-by-zero is guarded inline with `if x else` ternaries throughout. All config flows through constructor parameters.

### Workbook-faithful quirks (faithful variant — preserve)

- **Period-length mismatch**: `PERIOD_DAYS = 365/24 ≈ 15.2083`, but the workbook dates are 15 days apart. The cohort survival step hardcodes `15.0` (`math.exp(r_mort_broodrearing * 15.0)`), while the rest of `run()` uses `PERIOD_DAYS` — an intentional mirror of the spreadsheet's own inconsistency. (The corrected variant fixes this.)
- **Special-case seeding**: colony types `n`/`p` start mites at period 11 (0 until then) and seed `frac_spent` as 0.5/0.25 at periods 11/12; other colonies seed `frac_spent = 0.5` at period 2.
- **`southern_hemisphere` flag is inert in the faithful variant** (accepted, never read). The corrected variant implements it.

## Important Files

### Entry points & config
- `src/varroa/varroa_model.py` / `src/varroa/varroa_model_corrected.py` — `if __name__ == "__main__"` runs `default_d_run()` (colony `d`, 100 mites) and prints a 24-row table.
- `class VarroaModel` / `class VarroaModelCorrected` — constructor accepts `colony_type`, `initial_mites`, `immigration_setting`, `treatment_kills`, `params`, `southern_hemisphere`, `brood_break_periods`.
- `run()` — the simulation entry point; returns a `Run`.

### Key modules
- `Params` — `worker_daughters=1.45`, `drone_daughters=3.5`, `pupa_survival=0.95`, `worker_cell_days=12.5`, `drone_cell_days=14.75`, `mort_broodless=0.005`, `mort_broodrearing=0.005`, `brood_ratio_threshold=0.25`, `phoretic_intercept=5.0`, `phoretic_slope=5.0` (also the drone-cell invasion preference factor), `exit_multiplier_low=0.6`, `bees_per_frame=2000.0`, `cells_per_brood_frame=4500.0`, `crash_cell_invasion=0.5`, `crash_wash=60.0`, `spent_age_days=75.0`, `drone_cell_frac_convert=16/25`, `wash_bees=315.0`, `emergence_frac=0.9`.
- `_colony_vars` — Boot phoretic derivation: `phoretic_days = intercept − slope·ln(brood_ratio)`; `pct_phoretic = phoretic_days / (phoretic_days + 12)`.
- `_r_drone`/`_r_worker` — per-day growth rates; worker rate forced to 0 when `mites > 2 · worker_sealed_cells`.
- `_frac_spent` — >75-day (≥5-period) rule; faithful variant caps at 0.99, corrected variant does not.

### Data files
- `src/varroa/colony_types.json` — top-level object with 9 **uppercase** keys (`D`, `N`, `P`, `A`, `B`, `C`, `R`, `S`, `F`); each maps to a 24-element array of `{brood_frames, bee_frames, drone_frac}` (values may be `null` = blank cell → coerced to `0.0`). Indexed as `_CT[colony_type.upper()][period-1]`.
- `src/varroa/immigration.json` — 24 string keys `"1"`..`"24"`; each value is an array of **6** entries (indices 0–5). Columns 0–4 are documented settings; column 5 is undocumented. Non-null values occur only for periods 11–20 (drift season). **Setting 0 = column 0 = all 0.0 = no neighbours / no immigration.** Indexed as `_IM[str(period)][immigration_setting]` (faithful: no bounds check; corrected: validated 0..5).

### Docs
- `docs/MODEL.md` — extracted cell-level specification (9 sections): the authoritative mapping from workbook cells to formulas.
- `docs/MODEL_CONFIRMATION.md` — author-facing prose twin with semantic colony-type names and an appendix on two unimplemented variant sheets.
- `docs/KNOWN_ISSUES.md` — documented-but-unresolved discrepancies (n/p period-12 seed 0.25 vs 0.15; undocumented 6th immigration column; unvalidated southern path; validation covers only colony `d`).

## Runtime / Tooling Preferences

- **Runtime**: Python 3.14 (per `pyproject.toml` `requires-python`; local dev venv may be 3.12).
- **Packaging**: setuptools via `pyproject.toml` (src layout). Install editable for development: `pip install -e ".[dev]"`.
- **Lint/format**: ruff, configured in `pyproject.toml` (`ruff check .`, `ruff format .`).
- **Type checking**: basedpyright in strict mode (`typeCheckingMode = "all"`), configured in `pyproject.toml` (`basedpyright`). The project is clean: 0 errors, 0 warnings.
- **Tests use stdlib `unittest` only** — no pytest dependency.

## Testing & QA

There is no test suite for the faithful model (it is validated against the workbook instead). The corrected variant has a stdlib-`unittest` suite in `tests/`:

```bash
python3 -m unittest discover -s tests -v
```

- **`scripts/validate.py`** compares the faithful model against cached values in the workbook's `Current version` sheet.
  - **Reference scenario**: colony `d`, 100 starting mites, immigration setting 0, one treatment of 80% kill at period 16 (workbook cell `S21`).
  - **Cells read** from rows 5–28 (periods 1–24): `DF` (start), `DS` (end), `DT` (observed r), `DX` (wash), `CU` (% worker cells invaded), `CA` (% phoretic).
  - **Tolerance**: `TOL = 1e-6` (absolute). Observed max error ~5e-12.
  - **Output**: per-period comparison table, max absolute error, verdict (`ALL PERIODS MATCH` / `MISMATCHES FOUND`).
- **Corrected-variant tests** assert: parity with the faithful baseline where no correction applies; each fix changes exactly the intended quantity; the southern rotation is internally coherent; edge cases (no brood, no bees, OOB immigration) are handled without sentinel hacks.

When changing the faithful model, the proof is: `python3 scripts/validate.py <workbook>` and confirm all 24 periods still match within tolerance. Any edit that breaks this contract (unless explicitly intended) is a regression. When changing the corrected variant, run the unittest suite.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `delight-f/varroa-calculator`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.