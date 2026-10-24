"""FastAPI route handlers for SourceScan."""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response

from app.config import (
    ACTIONS,
    BASE_SCORES,
    CONTAINER_TYPES,
    DEFAULT_LOCALITIES,
    settings,
)
from app import detection
from app import water_classifier
from app.db import (
    analytics,
    create_inspection,
    delete_inspection,
    get_inspection,
    list_inspections,
    update_finding,
)
from app.privacy import (
    CONSENT_TEXT,
    PrivacyError,
    delete_image_file,
    get_safe_image_path,
    normalize_locality,
    save_sanitized_image,
    validate_content_type,
)
from app.risk import HEURISTIC_NOTE, overall_risk, score_finding
from app.schemas import (
    AnalyticsResponse,
    AnalyzeResponse,
    ConfigResponse,
    DetectionOut,
    FindingUpdate,
    HealthResponse,
    InspectionCreate,
    InspectionOut,
    InspectionSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Active detection mode, model name, loading status, and any failure reason."""
    det = detection.state.to_dict()
    water = {
        "loaded": water_classifier.water_state.loaded,
        "model_name": water_classifier.water_state.model_name,
        "error": water_classifier.water_state.error,
    }
    return HealthResponse(status="ok", detection=det, water_classifier=water)


@router.get("/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    """Container types, scoring rules, and configured localities."""
    return ConfigResponse(
        container_types=CONTAINER_TYPES,
        base_scores=BASE_SCORES,
        actions=ACTIONS,
        localities=DEFAULT_LOCALITIES,
        heuristic_note=HEURISTIC_NOTE,
        consent_text=CONSENT_TEXT,
        max_upload_mb=settings.MAX_UPLOAD_MB,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
@router.post("/analyse", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...)) -> AnalyzeResponse:
    """
    Accept an image, validate/sanitize it, run detector (or demo),
    return image_id and detections.
    """
    validate_content_type(file.content_type, file.filename)
    data = await file.read()

    try:
        image_id, filename = save_sanitized_image(data)
    except PrivacyError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    image_path = str(settings.upload_path / filename)
    result = detection.detect(image_path)

    detections = [DetectionOut(**d) for d in result["detections"]]
    return AnalyzeResponse(
        image_id=image_id,
        detections=detections,
        mode=result["mode"],
        model_name=result["model_name"],
        banner=result.get("banner"),
        error=result.get("error"),
    )


@router.get("/images/{filename}")
def get_image(filename: str):
    """Retrieve an uploaded inspection image safely."""
    path = get_safe_image_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type="image/jpeg")


@router.post("/inspections", response_model=InspectionOut, status_code=201)
def create_inspection_endpoint(body: InspectionCreate) -> InspectionOut:
    """Save an inspection and its findings. Requires explicit consent."""
    if not body.consent:
        raise HTTPException(
            status_code=400,
            detail=f"Explicit consent is required: {CONSENT_TEXT}",
        )

    locality = normalize_locality(body.locality)

    image_ref = None
    if body.image_id:
        candidate = f"{body.image_id}.jpg"
        if (settings.upload_path / candidate).is_file():
            image_ref = candidate
        else:
            image_ref = candidate

    scored: List[dict] = []
    for f in body.findings:
        result = score_finding(f.container_type, f.water_status, f.covered)
        ctype = (f.container_type or "other").strip().lower()
        scored.append(
            {
                "container_type": ctype,
                "source": f.source,
                "confidence": f.confidence,
                "bbox": f.bbox,
                "water_status": f.water_status,
                "water_source": f.water_source,
                "covered": f.covered,
                "raw_class": f.raw_class,
                "user_decision": f.user_decision,
                **result,
            }
        )

    overall_score, overall_category, _ = overall_risk(scored)

    inspection_id = create_inspection(
        locality=locality,
        image_ref=image_ref,
        overall_score=overall_score,
        overall_category=overall_category,
        consent=True,
        is_sample=body.is_sample,
        findings=scored,
    )

    saved = get_inspection(inspection_id)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to retrieve saved inspection")
    return InspectionOut(**saved)


@router.get("/inspections", response_model=List[InspectionSummary])
def list_inspections_endpoint(
    risk: Optional[str] = Query(
        None, description="Filter by overall_category: Low, Medium, High"
    ),
    date_from: Optional[str] = Query(
        None, description="ISO date or datetime lower bound"
    ),
    date_to: Optional[str] = Query(
        None, description="ISO date or datetime upper bound"
    ),
) -> List[InspectionSummary]:
    rows = list_inspections(risk=risk, date_from=date_from, date_to=date_to)
    return [InspectionSummary(**r) for r in rows]


@router.get("/inspections/{inspection_id}", response_model=InspectionOut)
def get_inspection_endpoint(inspection_id: int) -> InspectionOut:
    saved = get_inspection(inspection_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return InspectionOut(**saved)


@router.patch("/inspections/{inspection_id}/findings/{finding_id}", response_model=InspectionOut)
@router.put("/inspections/{inspection_id}/findings/{finding_id}", response_model=InspectionOut)
def update_finding_endpoint(
    inspection_id: int,
    finding_id: int,
    body: FindingUpdate,
) -> InspectionOut:
    """Update a finding, recalculate its heuristic score, and update the parent inspection."""
    updated = update_finding(
        inspection_id=inspection_id,
        finding_id=finding_id,
        container_type=body.container_type,
        water_status=body.water_status,
        covered=body.covered,
        user_decision=body.user_decision,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Inspection or finding not found")
    return InspectionOut(**updated)


@router.delete("/inspections/{inspection_id}", status_code=204)
def delete_inspection_endpoint(inspection_id: int) -> Response:
    """Delete inspection, cascade findings, and remove associated image file if not shared."""
    existing = get_inspection(inspection_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Inspection not found")
    image_ref = delete_inspection(inspection_id)
    if image_ref:
        delete_image_file(image_ref)
    return Response(status_code=204)


@router.get("/analytics", response_model=AnalyticsResponse)
def analytics_endpoint() -> AnalyticsResponse:
    data = analytics()
    return AnalyticsResponse(**data)
