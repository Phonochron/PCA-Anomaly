"""Per-row feature contributions from the PCA run used for detection."""

import numpy as np

from .pca_anomaly import PCAAnomalyResult


def get_feature_contributions(result: PCAAnomalyResult, top_k: int = 5) -> list[dict]:
    """Rank squared residuals without refitting the scaler or PCA model."""
    details = []
    for i, contributions in enumerate(result.squared_residuals):
        order = np.argsort(contributions)[::-1][:top_k]
        details.append({
            "row_index": result.row_indices[i],
            "is_anomaly": bool(result.labels[i]),
            "reconstruction_error": result.reconstruction_errors[i],
            "top_features": [
                {"name": result.feature_names[j], "contribution": float(contributions[j])}
                for j in order
            ],
        })
    return details
