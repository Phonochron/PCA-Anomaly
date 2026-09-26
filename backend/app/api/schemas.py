from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    """Response after CSV upload and validation."""

    success: bool
    n_rows: int = 0
    n_features: int = 0
    feature_columns: list[str] = Field(default_factory=list)
    label_column: str | None = None
    dataset_id: str | None = None
    error: str | None = None


class RunRequest(BaseModel):
    """Request to run PCA anomaly detection (after upload)."""

    n_components: int | None = Field(default=None, ge=1, description="Number of components; null = auto (95% variance)")
    threshold_percentile: float = Field(default=95.0, ge=1.0, le=99.99)


class TopFeature(BaseModel):
    name: str
    contribution: float


class AnomalyRowDetail(BaseModel):
    row_index: int
    is_anomaly: bool
    reconstruction_error: float
    top_features: list[TopFeature]


class RunResponse(BaseModel):
    """Response with 3D points, labels, and per-row explainer."""

    points_3d: list[list[float]] = Field(description="[x,y,z] per row for 3D plot")
    reconstruction_errors: list[float]
    labels: list[int] = Field(description="0=normal, 1=anomaly")
    row_indices: list[int]
    threshold: float
    feature_names: list[str]
    explained_variance_ratio: list[float]
    ground_truth: list[int] | None = None
    n_components_used: int = Field(description="Number of PCA components used (e.g. when auto-selected)")
    anomaly_details: list[AnomalyRowDetail] = Field(
        description="Per-row: row_index, is_anomaly, error, top contributing features"
    )
