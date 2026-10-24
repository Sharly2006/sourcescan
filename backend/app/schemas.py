"""Pydantic request/response schemas."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DetectionOut(BaseModel):
    container_type: str
    confidence: Optional[float] = None
    bbox: Optional[List[float]] = None
    source: str
    raw_class: Optional[str] = None
    warning: Optional[str] = None


class AnalyzeResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    image_id: str
    detections: List[DetectionOut]
    mode: str
    model_name: str
    banner: Optional[str] = None
    error: Optional[str] = None


class FindingIn(BaseModel):
    container_type: str
    source: str = "user"
    confidence: Optional[float] = None
    bbox: Optional[List[float]] = None
    water_status: str = "uncertain"  # present | absent | uncertain
    water_source: Optional[str] = None
    covered: Optional[bool] = None
    raw_class: Optional[str] = None
    user_decision: Optional[str] = None


class FindingUpdate(BaseModel):
    container_type: Optional[str] = None
    water_status: Optional[str] = None
    covered: Optional[bool] = None
    user_decision: Optional[str] = None  # confirmed | corrected | rejected


class InspectionCreate(BaseModel):
    locality: Optional[str] = "Unspecified"
    image_id: Optional[str] = None
    consent: bool = False
    findings: List[FindingIn] = Field(default_factory=list)
    is_sample: bool = False


class FindingOut(BaseModel):
    id: int
    inspection_id: int
    container_type: str
    source: Optional[str] = None
    confidence: Optional[float] = None
    bbox: Optional[List[float]] = None
    water_status: Optional[str] = None
    water_source: Optional[str] = None
    covered: Optional[bool] = None
    score: int
    category: str
    explanation: Optional[str] = None
    action: Optional[str] = None
    raw_class: Optional[str] = None
    user_decision: Optional[str] = None


class InspectionOut(BaseModel):
    id: int
    created_at: str
    locality: str
    image_ref: Optional[str] = None
    overall_score: int
    overall_category: str
    consent: bool
    is_sample: bool
    findings: List[FindingOut] = Field(default_factory=list)


class InspectionSummary(BaseModel):
    id: int
    created_at: str
    locality: str
    image_ref: Optional[str] = None
    overall_score: int
    overall_category: str
    consent: bool
    is_sample: bool


class HealthResponse(BaseModel):
    status: str = "ok"
    detection: Dict[str, Any]
    water_classifier: Dict[str, Any]


class ConfigResponse(BaseModel):
    container_types: List[str]
    base_scores: Dict[str, int]
    actions: Dict[str, str]
    localities: List[str]
    heuristic_note: str
    consent_text: str
    max_upload_mb: int


class ErrorResponse(BaseModel):
    detail: str


class AnalyticsResponse(BaseModel):
    total_inspections: int
    by_risk_category: Dict[str, int]
    top_container_types: List[Dict[str, Any]]
    repeat_findings_by_locality: List[Dict[str, Any]]
    locality_breakdown: List[Dict[str, Any]]
