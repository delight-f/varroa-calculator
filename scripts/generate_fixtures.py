#!/usr/bin/env python3
"""Generate golden-output JSON fixtures from the corrected Varroa model.

The TypeScript port's parity test suite (`web/src/model/model.parity.test.ts`)
loads these fixtures and asserts field-by-field equality within a tight
tolerance. This script is the bridge between the validated Python reference
and the web tool's TypeScript implementation.

Scenario battery (mirrors the spec's parity section):
  - all 9 colony types
  - with and without a treatment (80% kill at period 16)
  - both hemispheres
  - each immigration setting 0-4

The Python reference stays frozen and authoritative; the TS port proves
equivalence against it.

Usage:
    python3 scripts/generate_fixtures.py [--out PATH]
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from varroa import VarroaModelCorrected  # noqa: E402

COLONY_TYPES = "dnpabcrsf"
IMMIGRATION_SETTINGS = [0, 1, 2, 3, 4]


def _period_to_dict(pr) -> dict:
    """Serialize a PeriodResult to JSON.

    Python's json.dump round-trips IEEE doubles exactly (shortest repr), so
    no rounding is applied — the TS port must reproduce the reference within
    the 1e-9 parity tolerance, and any rounding here would be lossy.
    """
    d = {}
    for k, v in pr.__dict__.items():
        if isinstance(v, bool):
            d[k] = v
        elif v is None:
            d[k] = None
        else:
            d[k] = v
    return d


def _scenarios() -> list[dict]:
    scenarios = []
    for colony in COLONY_TYPES:
        for southern in (False, True):
            for imm in IMMIGRATION_SETTINGS:
                for treatment in (False, True):
                    kills = [0.0] * 24
                    if treatment:
                        kills[15] = 0.8  # northern period 16 (mid-June)
                    scenario_name = (
                        f"{colony}-{'south' if southern else 'north'}"
                        f"-imm{imm}-{'trt' if treatment else 'notrt'}"
                    )
                    scenarios.append({
                        "name": scenario_name,
                        "config": {
                            "colony_type": colony,
                            "initial_mites": 100.0,
                            "immigration_setting": imm,
                            "southern_hemisphere": southern,
                            "treatment_kills": kills,
                        },
                    })
    return scenarios


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--out",
        default=os.path.join("web", "src", "model", "__fixtures__", "golden.json"),
        help="output JSON path",
    )
    args = ap.parse_args()

    fixtures = []
    for sc in _scenarios():
        run = VarroaModelCorrected(**sc["config"]).run()
        fixtures.append({
            "name": sc["name"],
            "config": sc["config"],
            "params": dict(run.params.__dict__),
            "periods": [_period_to_dict(pr) for pr in run.periods],
            "mite_trajectory": list(run.mite_trajectory),
            "wash_trajectory": list(run.wash_trajectory),
            "r_trajectory": list(run.r_trajectory),
        })

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(fixtures, f, indent=1)
    print(f"wrote {len(fixtures)} fixtures to {args.out}")


if __name__ == "__main__":
    main()
