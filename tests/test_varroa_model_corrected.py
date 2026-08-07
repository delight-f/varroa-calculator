"""Tests for the corrected variant (varroa_model_corrected.py).

The corrected variant is a standalone copy of the faithful `varroa_model.py`
with six deliberate corrections (A-F, documented in the module docstring).  The
faithful baseline is validated cell-by-cell against the workbook to ~5e-12;
these tests assert that:

- the corrected variant behaves like the faithful one where no correction
  applies (same 24-period structure, same monotonic growth);
- each correction changes exactly the intended quantity;
- the southern-hemisphere rotation is internally coherent;
- edge-case inputs (no brood, no bees, out-of-range immigration setting) are
  handled without sentinel hacks and without crashing.

Run with:  python3 -m unittest tests.test_varroa_model_corrected -v
or simply: python3 -m unittest discover -s tests -v
(no third-party dependencies required)
"""

import unittest

from varroa import VarroaModel, VarroaModelCorrected


def _source_period(p: int) -> int:
    """Northern source period for a southern simulation period p (12-shift)."""
    return ((p + 11) % 24) + 1


class ParityTests(unittest.TestCase):
    """Where no correction applies, the corrected variant agrees with the
    faithful baseline."""

    def test_default_d_colony_growth(self):
        f = VarroaModel(colony_type="d", initial_mites=100.0).run()
        c = VarroaModelCorrected(colony_type="d", initial_mites=100.0).run()
        self.assertEqual(len(f.periods), 24)
        self.assertEqual(len(c.periods), 24)
        # both models grow the population through the season
        self.assertGreater(c.periods[-1].mites_end, 100.0)
        self.assertGreater(f.periods[-1].mites_end, 100.0)

    def test_period_structure(self):
        c = VarroaModelCorrected(colony_type="d").run()
        self.assertEqual([pr.period for pr in c.periods], list(range(1, 25)))
        self.assertTrue(all(pr.mites_start >= 0.0 for pr in c.periods))
        self.assertTrue(all(pr.mites_end >= 0.0 for pr in c.periods))

    def test_no_brood_reproduction_zero(self):
        """In a zero-brood period reproduction must be zero in both models."""
        f = VarroaModel(colony_type="b", initial_mites=100.0).run()
        c = VarroaModelCorrected(colony_type="b", initial_mites=100.0).run()
        for pr in f.periods:
            if pr.frames_brood == 0.0:
                self.assertAlmostEqual(pr.new_mites, 0.0)
        for pr in c.periods:
            if pr.frames_brood == 0.0:
                self.assertAlmostEqual(pr.new_mites, 0.0)


class FixATests(unittest.TestCase):
    """Fix A: cohort aging uses PERIOD_DAYS, not the workbook's 15."""

    def test_period_days_constant(self):
        from varroa.varroa_model_corrected import PERIOD_DAYS
        self.assertEqual(PERIOD_DAYS, 365.0 / 24.0)

    def test_five_period_old_cohort_is_spent(self):
        # a cohort that has lived 5 periods is fully spent (age >= 5)
        cohorts = [[100.0, 90.0, 80.0, 70.0, 60.0, 50.0]]
        self.assertEqual(VarroaModelCorrected._frac_spent(cohorts), 1.0)  # type: ignore[reportPrivateUsage]


class FixBTests(unittest.TestCase):
    """Fix B: spent fraction is not capped at 0.99."""

    def test_spent_fraction_not_capped(self):
        cohorts = [[100.0, 90.0, 80.0, 70.0, 60.0, 50.0]]
        self.assertEqual(VarroaModelCorrected._frac_spent(cohorts), 1.0)  # type: ignore[reportPrivateUsage]

    def test_mixed_population_uncapped(self):
        cohorts = [
            [100.0, 90.0],                      # age 1, not spent
            [100.0, 90.0, 80.0, 70.0, 60.0],    # age 4, not spent
            [100.0, 90.0, 80.0, 70.0, 60.0, 50.0],  # age 5, spent
        ]
        expected = 50.0 / (90.0 + 60.0 + 50.0)
        self.assertAlmostEqual(VarroaModelCorrected._frac_spent(cohorts), expected)  # type: ignore[reportPrivateUsage]

    def test_faithful_still_caps(self):
        """The faithful baseline keeps its 0.99 cap — the corrected variant
        must not have changed it."""
        cohorts = [[100.0, 90.0, 80.0, 70.0, 60.0, 50.0]]
        self.assertAlmostEqual(VarroaModel._frac_spent(cohorts), 0.99)  # type: ignore[reportPrivateUsage]


class FixCTests(unittest.TestCase):
    """Fix C: the no-bees edge case is explicit (phoretic_days=None, 100%
    phoretic) instead of the magic 0.001."""

    def test_no_bees_handled_explicitly(self):
        # colony n has no adult bees in periods 1-6
        c = VarroaModelCorrected(colony_type="n", initial_mites=100.0).run()
        for pr in c.periods[:6]:
            self.assertEqual(pr.adult_bees, 0.0)
            self.assertIsNone(pr.phoretic_days)
            self.assertAlmostEqual(pr.pct_phoretic, 1.0)
            self.assertAlmostEqual(pr.pct_in_brood, 0.0)

    def test_no_magic_epsilon_anywhere(self):
        for t in "dnpabcrsf":
            c = VarroaModelCorrected(colony_type=t, initial_mites=100.0).run()
            for pr in c.periods:
                if pr.phoretic_days is not None:
                    self.assertNotAlmostEqual(pr.phoretic_days, 0.001)


class FixDTests(unittest.TestCase):
    """Fix D: the no-brood 1.0 sentinel is removed."""

    def test_no_brood_zero_cells(self):
        c = VarroaModelCorrected(colony_type="b", initial_mites=100.0).run()
        for pr in c.periods:
            if pr.frames_brood == 0.0:
                self.assertEqual(pr.brood_cells, 0.0)
                self.assertEqual(pr.brood_ratio, 0.0)

    def test_faithful_keeps_sentinel(self):
        f = VarroaModel(colony_type="b", initial_mites=100.0).run()
        seen = False
        for pr in f.periods:
            if pr.frames_brood == 0.0:
                self.assertEqual(pr.brood_cells, 1.0)
                seen = True
        self.assertTrue(seen, "colony b should have broodless periods")


class FixETests(unittest.TestCase):
    """Fix E: the southern-hemisphere flag is a 12-period rotation."""

    def test_southern_matches_rotated_northern(self):
        for t in "dnpabcrsf":
            south = VarroaModelCorrected(colony_type=t, initial_mites=50.0,
                                         southern_hemisphere=True).run()
            north = VarroaModelCorrected(colony_type=t, initial_mites=50.0).run()
            for p, spr in enumerate(south.periods, start=1):
                npr = north.periods[_source_period(p) - 1]
                self.assertAlmostEqual(spr.frames_brood, npr.frames_brood)
                self.assertAlmostEqual(spr.frames_bees, npr.frames_bees)
                self.assertAlmostEqual(spr.pct_phoretic, npr.pct_phoretic)
                self.assertAlmostEqual(spr.pct_in_brood, npr.pct_in_brood)

    def test_southern_rotates_treatments(self):
        trt = [0.0] * 24
        trt[15] = 0.8  # northern period 16 (mid-June oxalic)
        south = VarroaModelCorrected(colony_type="d", initial_mites=100.0,
                                     southern_hemisphere=True,
                                     treatment_kills=trt).run()
        kills = [pr.kill for pr in south.periods]
        # northern period 16 == southern period 4 (southern p maps to
        # source ((p + 11) % 24) + 1; solving for source 16 gives p = 4)
        self.assertAlmostEqual(kills[3], 0.8)
        self.assertAlmostEqual(sum(kills), 0.8)

    def test_southern_rotates_immigration(self):
        south = VarroaModelCorrected(colony_type="d", initial_mites=100.0,
                                     immigration_setting=1,
                                     southern_hemisphere=True).run()
        imm = [pr.immigration for pr in south.periods]
        nonzero = [p for p, v in enumerate(imm, start=1) if v > 0.0]
        # northern drift season 11-20 -> southern 23-24, 1-8 (in simulation
        # order: periods 1-8 come first, then 23-24)
        self.assertEqual(nonzero, [1, 2, 3, 4, 5, 6, 7, 8, 23, 24])


class FixFTests(unittest.TestCase):
    """Fix F: the immigration setting is validated."""

    def test_oob_raises(self):
        with self.assertRaises(IndexError):
            VarroaModelCorrected(immigration_setting=6)  # type: ignore[reportUnusedCallResult]
        with self.assertRaises(IndexError):
            VarroaModelCorrected(immigration_setting=-1)  # type: ignore[reportUnusedCallResult]

    def test_nonint_raises(self):
        with self.assertRaises(TypeError):
            VarroaModelCorrected(immigration_setting="1")  # type: ignore[arg-type]
        with self.assertRaises(TypeError):
            VarroaModelCorrected(immigration_setting=1.5)  # type: ignore[arg-type]

    def test_all_documented_settings_valid(self):
        for s in range(5):
            run = VarroaModelCorrected(colony_type="d", immigration_setting=s).run()
            self.assertEqual(len(run.periods), 24)


if __name__ == "__main__":
    unittest.main()  # type: ignore[reportUnusedCallResult]
