# Varroa Calculator

A clean Python re-implementation of Randy Oliver's honey-bee varroa mite
population model, extracted from
`Randys-Varroa-Model-V2026 Web(1).xlsx` (sheet "Current version").

## What it does

Simulates the mite population of a honey-bee colony over **24 half-month
periods** (one year).  Each period it:

1. reads the colony state (frames of bees, frames of brood, % drone brood)
   from a colony-type curve;
2. derives the **days a mite spends phoretic** from the brood : adult-bee
   ratio (after Boot, 1995) — the "heart of the model";
3. splits mites into phoretic vs in-brood, and into drone vs worker brood;
4. computes a daily intrinsic growth rate **r** from daughters-per-cycle and
   cell duration;
5. applies reproduction, natural mortality, immigration/drift, and an optional
   **treatment kill** per period;
6. tracks mite age structure so old (>75 day) mites are non-reproductive.

The headline output is the **r value** (net daily rate of mite increase) and
the mite/wash-count trajectory.

## Usage

```python
from varroa import VarroaModel

run = VarroaModel(
    colony_type="d",        # d, n, p, a, b, c, r, s, f
    initial_mites=100.0,
    immigration_setting=0,  # 0-4
    treatment_kills=[0.0]*24,  # e.g. 0.8 at period 16
    brood_break_periods=[],    # force no reproduction on these periods
).run()

for p in run.periods:
    print(p.period, round(p.mites_end, 1), round(p.r_observed, 4))
```

A standalone run:

```bash
python3 src/varroa/varroa_model.py
```

## Corrected variant

`varroa_model.py` is the *faithful* baseline: it reproduces the workbook's
arithmetic cell-by-cell so it can be validated.  `varroa_model_corrected.py`
is a standalone copy with six deliberate corrections (documented in its module
docstring): consistent period length in the aging table, no arbitrary 0.99
spent-fraction cap, explicit no-brood/no-bees edge handling, an implemented
`southern_hemisphere` 12-period rotation, and bounds-checked immigration
settings.  Its scientific character is unchanged.

```python
from varroa import VarroaModelCorrected

run = VarroaModelCorrected(colony_type="d", initial_mites=100.0,
                           southern_hemisphere=True).run()
```

Tests (stdlib `unittest`, no dependencies):

```bash
python3 -m unittest discover -s tests -v
```

## Validation

`scripts/validate.py` compares the Python model against the workbook's cached
values for the "Current version" run (colony `d`, 100 mites, 0.8 treatment at
period 16).  **All 24 periods match to within ~5e-12.**

```bash
python3 scripts/validate.py /path/to/Randys-Varroa-Model-V2026\ Web\(1\).xlsx
```

## Files

| Path | Purpose |
|---|---|
| `src/varroa/varroa_model.py` | Faithful model implementation (validated reference) |
| `src/varroa/varroa_model_corrected.py` | Corrected variant (fixes A-F) |
| `src/varroa/colony_types.json` | 9 colony-type curves (24 periods each) |
| `src/varroa/immigration.json` | Per-period mite immigration tables (settings 0-4) |
| `scripts/validate.py` | Validation against the source workbook |
| `tests/` | Stdlib-unittest tests for the corrected variant |
| `docs/MODEL.md` | Extracted model specification (cell-level) |
| `docs/MODEL_CONFIRMATION.md` | Author-facing description for confirmation |
| `docs/KNOWN_ISSUES.md` | Documented-but-unfixed discrepancies |
| `pyproject.toml` | Packaging + ruff config |
| `AGENTS.md` | Repository guidelines for AI assistants |

## Credits

Model: © Randy Oliver, "Randy's Varroa Model".  This repository is an
independent re-implementation of the spreadsheet's published logic.
