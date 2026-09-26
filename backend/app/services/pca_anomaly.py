"""PCA-based anomaly detection: fit on normal (or all) data, score by reconstruction error."""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler


@dataclass
class PCAAnomalyResult:
    """Result of PCA anomaly detection."""

    # 3D coordinates (first 3 PCs) for each row
    points_3d: list[list[float]]  # [[x,y,z], ...]
    # Per-row reconstruction error (MSE)
    reconstruction_errors: list[float]
    # 0 = normal, 1 = anomaly (by threshold)
    labels: list[int]
    # Row index in original CSV (0-based)
    row_indices: list[int]
    # Threshold used
    threshold: float
    # Feature names (for explainer)
    feature_names: list[str]
    # Explained variance ratio of first 3 components
    explained_variance_ratio: list[float]
    # Optional: ground truth if label column was provided
    ground_truth: list[int] | None
    # Number of components actually used (e.g. when auto-selected)
    n_components_used: int
    # Internal data reused by the feature explainer; not part of the API response.
    squared_residuals: np.ndarray


def _choose_n_components_by_variance(
    explained_variance_ratio: np.ndarray,
    variance_threshold: float = 0.95,
    min_components: int = 3,
) -> int:
    """Select k from an already fitted PCA, keeping the available upper bound."""
    cumulative = np.cumsum(explained_variance_ratio)
    reached = np.searchsorted(cumulative, variance_threshold, side="left") + 1
    return min(max(min_components, reached), len(explained_variance_ratio))


def run_pca_anomaly(
    df: pd.DataFrame,
    feature_columns: list[str],
    label_column: str | None,
    n_components: int | None = None,
    threshold_percentile: float = 95.0,
    variance_threshold_auto: float = 0.95,
) -> PCAAnomalyResult:
    """
    Run PCA on normal data (if labels exist) or all data; compute reconstruction
    error; label as anomaly if error > threshold (percentile of normal/all).
    """
    if len(feature_columns) < 2:
        raise ValueError("PCA anomaly detection requires at least 2 numeric features.")
    X = df[feature_columns].to_numpy(dtype=float)
    n_rows = X.shape[0]
    if not np.isfinite(X).all():
        raise ValueError("Numeric features must contain only finite values.")

    # Fit PCA on normal only if we have labels, else on all data
    fit_mask = np.ones(n_rows, dtype=bool)
    if label_column is not None and label_column in df.columns:
        labels = pd.to_numeric(df[label_column], errors="coerce")
        if labels.isna().any() or not labels.isin([0, 1]).all():
            raise ValueError("Label column must contain only 0 (normal) and 1 (anomaly).")
        ground_truth = labels.astype(int).tolist()
        fit_mask = labels.to_numpy() == 0
    else:
        ground_truth = None

    n_fit = int(fit_mask.sum())
    if n_fit < 2:
        raise ValueError("PCA requires at least 2 normal rows for fitting.")

    # Fit preprocessing on the same rows as PCA to avoid leaking anomalies.
    scaler = StandardScaler().fit(X[fit_mask])
    X_scaled = scaler.transform(X)
    X_fit = X_scaled[fit_mask]
    if not np.any(np.var(X_fit, axis=0) > 0):
        raise ValueError("Normal rows need variation in at least one numeric feature.")
    max_components = min(len(feature_columns) - 1, n_fit - 1)

    # Auto-select n_components by variance explained
    if n_components is not None and not 1 <= n_components <= max_components:
        raise ValueError(f"n_components must be between 1 and {max_components} for this dataset.")
    fit_components = min(max_components, 20) if n_components is None else n_components
    pca = PCA(n_components=fit_components, svd_solver="full")
    pca.fit(X_fit)
    if n_components is None:
        n_components_used = _choose_n_components_by_variance(
            pca.explained_variance_ratio_,
            variance_threshold=variance_threshold_auto,
            min_components=3,
        )
    else:
        n_components_used = n_components

    # Project all data and reconstruct
    components = pca.components_[:n_components_used]
    X_proj = (X_scaled - pca.mean_) @ components.T
    X_reconstructed = X_proj @ components + pca.mean_
    squared_residuals = (X_scaled - X_reconstructed) ** 2
    reconstruction_error = squared_residuals.mean(axis=1)

    # Threshold: percentile of the distribution we fitted on (normal or all)
    thresh = np.percentile(reconstruction_error[fit_mask], threshold_percentile)

    labels = (reconstruction_error > thresh).astype(int).tolist()

    # 3D points: use first 3 components (pad with 0 if n_components was 1 or 2)
    points_3d = []
    for i in range(X_proj.shape[0]):
        row = X_proj[i].tolist()
        while len(row) < 3:
            row.append(0.0)
        points_3d.append(row[:3])

    explained = list(pca.explained_variance_ratio_[:n_components_used])
    while len(explained) < 3:
        explained.append(0.0)

    return PCAAnomalyResult(
        points_3d=points_3d,
        reconstruction_errors=reconstruction_error.tolist(),
        labels=labels,
        row_indices=list(range(n_rows)),
        threshold=float(thresh),
        feature_names=feature_columns,
        explained_variance_ratio=explained[:3],
        ground_truth=ground_truth,
        n_components_used=n_components_used,
        squared_residuals=squared_residuals,
    )
