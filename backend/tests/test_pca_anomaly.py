"""Checks for PCA scoring, explanation consistency, and input boundaries."""

import unittest

import numpy as np
import pandas as pd

from app.api.schemas import RunRequest
from app.services import get_feature_contributions, run_pca_anomaly


class PCAAnomalyTests(unittest.TestCase):
    def setUp(self):
        self.df = pd.DataFrame({
            "a": [1, 2, 3, 4, 10],
            "b": [2, 3, 5, 7, 50],
            "c": [3, 5, 8, 13, 80],
            "label": [0, 0, 0, 0, 1],
        })
        self.features = ["a", "b", "c"]

    def test_explanations_use_the_detection_residuals(self):
        result = run_pca_anomaly(self.df, self.features, "label", n_components=2)
        details = get_feature_contributions(result, top_k=3)

        self.assertEqual(result.n_components_used, 2)
        for i, detail in enumerate(details):
            self.assertEqual(detail["is_anomaly"], bool(result.labels[i]))
            self.assertEqual(detail["reconstruction_error"], result.reconstruction_errors[i])
            self.assertAlmostEqual(
                sum(feature["contribution"] for feature in detail["top_features"]) / 3,
                result.reconstruction_errors[i],
            )
        self.assertEqual(result.labels[-1], 1)

    def test_auto_keeps_a_residual_dimension_for_three_features(self):
        result = run_pca_anomaly(self.df, self.features, "label", n_components=None)
        self.assertEqual(result.n_components_used, 2)
        self.assertEqual(len(result.points_3d[0]), 3)
        self.assertEqual(result.points_3d[0][2], 0.0)

    def test_invalid_component_count_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "n_components must be between 1 and 2"):
            run_pca_anomaly(self.df, self.features, "label", n_components=3)
        with self.assertRaises(ValueError):
            RunRequest(n_components=0)

    def test_insufficient_normal_rows_is_rejected(self):
        self.df["label"] = [0, 1, 1, 1, 1]
        with self.assertRaisesRegex(ValueError, "at least 2 normal rows"):
            run_pca_anomaly(self.df, self.features, "label", n_components=None)

    def test_labels_must_follow_documented_binary_values(self):
        self.df.loc[0, "label"] = 2
        with self.assertRaisesRegex(ValueError, "only 0 .* and 1"):
            run_pca_anomaly(self.df, self.features, "label")

    def test_constant_normal_rows_are_rejected(self):
        self.df.loc[:3, self.features] = [1, 2, 3]
        with self.assertRaisesRegex(ValueError, "need variation"):
            run_pca_anomaly(self.df, self.features, "label")

    def test_non_finite_and_single_feature_inputs_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "at least 2 numeric features"):
            run_pca_anomaly(self.df, ["a"], "label", n_components=None)
        self.df["a"] = self.df["a"].astype(float)
        self.df.loc[0, "a"] = np.inf
        with self.assertRaisesRegex(ValueError, "finite values"):
            run_pca_anomaly(self.df, self.features, "label", n_components=None)


if __name__ == "__main__":
    unittest.main()
