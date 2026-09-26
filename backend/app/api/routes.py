"""Upload, analyze, and export datasets through short-lived IDs."""

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response

from app.api.schemas import (
    AnomalyRowDetail,
    RunRequest,
    RunResponse,
    TopFeature,
    UploadResponse,
)
from app.config import settings
from app.services import (
    get_feature_contributions,
    load_and_validate_csv,
    run_pca_anomaly,
)
from app.services.dataset_store import DatasetSession, DatasetStore

router = APIRouter(prefix="/api", tags=["pca-anomaly"])
dataset_store = DatasetStore(
    max_sessions=settings.max_datasets_in_memory,
    ttl_seconds=settings.dataset_ttl_seconds,
)


def get_dataset(dataset_id: str) -> DatasetSession:
    session = dataset_store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset not found or expired. Upload it again.")
    return session


@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    label_column: str | None = Form(None),
    encoding: str = Form("utf-8"),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV.")

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.max_upload_size_mb} MB.",
        )

    result = load_and_validate_csv(
        content,
        file.filename,
        label_column=label_column,
        encoding=encoding,
    )
    if result.error:
        return UploadResponse(
            success=False,
            error=result.error,
            n_rows=result.n_rows,
            n_features=result.n_features,
            feature_columns=result.feature_columns,
            label_column=result.label_column,
        )

    dataset_id = dataset_store.create(
        result.df, result.feature_columns, result.label_column
    )
    return UploadResponse(
        success=True,
        n_rows=result.n_rows,
        n_features=result.n_features,
        feature_columns=result.feature_columns,
        label_column=result.label_column,
        dataset_id=dataset_id,
    )


@router.post("/run", response_model=RunResponse)
async def run_anomaly_detection(
    body: RunRequest | None = None,
    dataset_id: str = Header(..., alias="X-Dataset-ID"),
):
    session = get_dataset(dataset_id)
    session.labels = None  # A failed rerun must not leave an old export available.

    opts = body or RunRequest()
    try:
        result = run_pca_anomaly(
            df=session.df,
            feature_columns=session.feature_columns,
            label_column=session.label_column,
            n_components=opts.n_components,
            threshold_percentile=opts.threshold_percentile,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    details = get_feature_contributions(result, top_k=5)
    anomaly_details = [
        AnomalyRowDetail(
            row_index=detail["row_index"],
            is_anomaly=detail["is_anomaly"],
            reconstruction_error=detail["reconstruction_error"],
            top_features=[
                TopFeature(name=feature["name"], contribution=feature["contribution"])
                for feature in detail["top_features"]
            ],
        )
        for detail in details
    ]

    session.labels = result.labels
    return RunResponse(
        points_3d=result.points_3d,
        reconstruction_errors=result.reconstruction_errors,
        labels=result.labels,
        row_indices=result.row_indices,
        threshold=result.threshold,
        feature_names=result.feature_names,
        explained_variance_ratio=result.explained_variance_ratio,
        ground_truth=result.ground_truth,
        n_components_used=result.n_components_used,
        anomaly_details=anomaly_details,
    )


def csv_response(session: DatasetSession, label: int, filename: str) -> Response:
    if session.labels is None:
        raise HTTPException(status_code=400, detail="Run PCA before downloading results.")

    rows = session.df.loc[[value == label for value in session.labels]]
    return Response(
        content=rows.to_csv(index=False),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/download/cleaned")
async def download_cleaned_csv(dataset_id: str = Header(..., alias="X-Dataset-ID")):
    return csv_response(get_dataset(dataset_id), 0, "cleaned_normal_only.csv")


@router.get("/download/anomalies")
async def download_anomalies_csv(dataset_id: str = Header(..., alias="X-Dataset-ID")):
    return csv_response(get_dataset(dataset_id), 1, "anomalies_only.csv")
