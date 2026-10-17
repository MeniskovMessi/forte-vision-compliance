"""
Pydantic Schemas (`backend/app/schemas.py`)
Strictly conforms to Case Section 10 Jury API specification and supports
extended metadata for video trimming, interval inspection, and legal RAG citations.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class AnalyzeSubmitResponse(BaseModel):
    job_id: str = Field(..., description="Unique identifier of the video analysis job")
    status: str = Field("processing", description="Initial job status (`processing`)")
    trim_interval: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional trim interval metadata if start_sec / end_sec were specified",
    )


class EvidenceFrameSchema(BaseModel):
    timestamp_sec: float = Field(..., description="Timestamp (in seconds) of the extracted frame")
    image_base64: str = Field(..., description="Base64-encoded JPEG image string")


class ViolationItemJurySchema(BaseModel):
    type: str = Field(..., description="Standardized Russian title of the cash discipline violation")
    timecode_sec: float = Field(..., description="Timestamp (in seconds) when the violation occurred")
    description: str = Field(
        ...,
        description="Factual visual observation grounded in official RK banking regulations (adilet.zan.kz)",
    )
    evidence_frames: List[EvidenceFrameSchema] = Field(
        default_factory=list,
        description="1-3 base64-encoded JPEG evidence frames around the violation timestamp",
    )


class JobStatusJuryResponse(BaseModel):
    job_id: str
    status: str = Field(..., description="`processing` | `done` | `failed`")
    verdict: Optional[str] = Field(None, description="`violation` | `no_violation` | null while processing")
    violations: List[ViolationItemJurySchema] = Field(default_factory=list)
    error_message: Optional[str] = None


class PreviewThumbnailSchema(BaseModel):
    timestamp_sec: float
    frame_base64: str


class VideoInspectResponse(BaseModel):
    filename: str
    duration_sec: float
    fps: float
    total_frames: int
    width: int
    height: int
    preview_thumbnails: List[PreviewThumbnailSchema] = Field(default_factory=list)


class VideoTrimResponse(BaseModel):
    trimmed_filename: str
    original_duration_sec: float
    start_sec: float
    end_sec: float
    trimmed_duration_sec: float
    method: str
    job_id: Optional[str] = None
    status: Optional[str] = None
