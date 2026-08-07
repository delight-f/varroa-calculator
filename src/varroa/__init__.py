"""Varroa mite population model (Randy Oliver V2026).

Two variants are provided:

- :class:`VarroaModel` -- the workbook-faithful reference, validated cell-by-cell
  against the source spreadsheet to ~5e-12 by ``scripts/validate.py``.
- :class:`VarroaModelCorrected` -- a standalone copy with six deliberate
  corrections (A-F) documented in its module docstring.
"""

from .varroa_model import VarroaModel
from .varroa_model_corrected import VarroaModelCorrected

__all__ = ["VarroaModel", "VarroaModelCorrected"]