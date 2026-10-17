"""
REST API Routes (`backend/app/api/routes.py`)
Implements:
1. Mandatory Jury API Endpoints (Case Section 10):
   - `POST /api/v1/analyze` (multipart video upload + optional `[start_sec, end_sec]` interval trimming)
   - `GET  /api/v1/jobs/{job_id}` (strict Jury JSON schema with `evidence_frames`)
2. Video Trimming & Inspection Endpoints:
   - `POST /api/v1/videos/inspect` (fast duration/FPS/thumbnail inspection for long CCTV files)
   - `POST /api/v1/videos/trim` (physical clip trimming `[start_sec, end_sec]` + optional immediate analysis)
   - `GET  /api/v1/videos/{job_id}/stream` (video file streaming for interactive player)
3. Audit Dashboard & Legal RAG Knowledge Base Endpoints:
   - `GET  /api/v1/jobs/{job_id}/detailed` (enriched audit report with `adilet.zan.kz` structured citations)
   - `GET  /api/v1/jobs` (job history & compliance statistics)
   - `GET  /api/v1/regulations` (16 RK banking regulations from PostgreSQL `pgvector`)
   - `GET  /api/v1/health` (system & DB health status)
"""

import uuid
import shutil
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, UploadFile, File, Form, Query, Body, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response

from backend.app.config import settings
from backend.app.auth import verify_api_key
from backend.app.db.repository import repository
from backend.app.pipeline.orchestrator import CompliancePipelineOrchestrator
from backend.app.pipeline.stage1_spatial import SpatialPerceptionEngine

logger = logging.getLogger("backend.api.routes")

router = APIRouter(prefix="/api/v1", tags=["ForteBank Compliance API v1"])

# Singleton pipeline orchestrator & background worker pool
orchestrator = CompliancePipelineOrchestrator(sample_fps=settings.VIDEO_SAMPLE_FPS)
worker_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="compliance_worker")


def _run_analysis_task(
    job_id: str,
    video_path: Path,
    start_sec: Optional[float] = None,
    end_sec: Optional[float] = None,
    save_trimmed_only: bool = False,
) -> None:
    """
    Background worker that executes the 4-stage compliance pipeline (with optional physical
    or virtual interval trimming `[start_sec, end_sec]`) and persists results to PostgreSQL.
    """
    try:
        target_path = video_path
        effective_start = start_sec
        effective_end = end_sec

        # If user requested physical file trimming (`save_trimmed_only=True`), cut the clip first
        if save_trimmed_only and (start_sec is not None or end_sec is not None):
            trimmed_path = settings.TRIMMED_DIR / f"{job_id}_trimmed.mp4"
            trim_info = SpatialPerceptionEngine.trim_video_file(
                input_path=video_path,
                output_path=trimmed_path,
                start_sec=float(start_sec or 0.0),
                end_sec=end_sec,
            )
            target_path = trimmed_path
            # Remove the large untrimmed upload to save disk space
            try:
                if video_path.exists() and video_path != trimmed_path:
                    video_path.unlink()
            except OSError:
                pass
            # Since the file itself is now physically trimmed, analyze the trimmed file from 0..end
            # and add `start_sec` offset to reported timestamps
            res = orchestrator.analyze_video(
                video_path=target_path,
                job_id=job_id,
                include_evidence_frames=True,
                start_sec=None,
                end_sec=None,
            )
            offset = float(trim_info["start_sec"])
            if offset > 0 and res.get("violations"):
                for v in res["violations"]:
                    v["relative_timecode_sec"] = v["timecode_sec"]
                    v["timecode_sec"] = int(round(v["timecode_sec"] + offset))
                    for ef in v.get("evidence_frames", []):
                        if isinstance(ef, dict) and "timestamp_sec" in ef:
                            ef["timestamp_sec"] = round(float(ef["timestamp_sec"]) + offset, 1)
            if res.get("video_metadata"):
                res["video_metadata"].update({
                    "original_duration_sec": trim_info["original_duration_sec"],
                    "analyzed_duration_sec": trim_info["trimmed_duration_sec"],
                    "trim_start_sec": trim_info["start_sec"],
                    "trim_end_sec": trim_info["end_sec"],
                    "is_trimmed": True,
                    "physically_trimmed": True,
                })
        else:
            res = orchestrator.analyze_video(
                video_path=target_path,
                job_id=job_id,
                include_evidence_frames=True,
                start_sec=effective_start,
                end_sec=effective_end,
            )

        if res.get("status") == "failed":
            repository.fail_job(job_id, res.get("error_message") or "Unknown pipeline error")
        else:
            repository.complete_job(job_id, res)

    except Exception as e:
        logger.exception(f"Background job {job_id} failed: {e}")
        repository.fail_job(job_id, str(e))


def _save_upload_file(upload: UploadFile, dest_path: Path) -> None:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(upload.file, f)


@router.get("/health", summary="System, Model & PostgreSQL pgvector Healthcheck")
async def health_check() -> Dict[str, Any]:
    db_status = repository.check_db_health()
    pose_ok = (settings.MODELS_DIR / "yolo11n-pose.pt").exists()
    det_ok = (settings.MODELS_DIR / "yolo11n.pt").exists()
    return {
        "status": "ok" if (db_status.get("connected") and pose_ok and det_ok) else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "local_execution_only": True,
        "models": {
            "yolo11n_pose_cached": pose_ok,
            "yolo11n_det_cached": det_ok,
            "embedding_model": settings.EMBEDDING_MODEL_NAME,
        },
        "database": db_status,
    }


@router.post(
    "/analyze",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a CCTV video (.mov/.mp4) for asynchronous compliance analysis (with optional interval trimming)",
)
async def analyze_video_endpoint(
    file: Optional[UploadFile] = File(None, description="Uploaded CCTV video file (`.mov` / `.mp4`)"),
    video: Optional[UploadFile] = File(None, description="Alias for `file` form field"),
    start_sec: Optional[float] = Form(None, description="Optional start timestamp (in seconds) to trim/slice analysis"),
    end_sec: Optional[float] = Form(None, description="Optional end timestamp (in seconds) to trim/slice analysis"),
    save_trimmed_only: bool = Form(
        False,
        description="If true and start_sec/end_sec are provided, physically trims the video file on disk and deletes the raw upload",
    ),
    q_start_sec: Optional[float] = Query(None, alias="start_sec", description="Query param alternative for start_sec"),
    q_end_sec: Optional[float] = Query(None, alias="end_sec", description="Query param alternative for end_sec"),
    _api_key: str = Depends(verify_api_key),
) -> Dict[str, Any]:
    uploaded = file or video
    if uploaded is None or not uploaded.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No video file provided. Upload a `.mov` or `.mp4` file under form field `file` or `video`.",
        )

    eff_start = start_sec if start_sec is not None else q_start_sec
    eff_end = end_sec if end_sec is not None else q_end_sec
    if eff_start is not None and eff_end is not None and eff_end <= eff_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid trim interval: start_sec ({eff_start}) must be strictly less than end_sec ({eff_end}).",
        )

    job_id = uuid.uuid4().hex[:12]
    safe_name = Path(uploaded.filename).name
    saved_path = settings.UPLOAD_DIR / f"{job_id}_{safe_name}"
    _save_upload_file(uploaded, saved_path)

    trim_meta = None
    if eff_start is not None or eff_end is not None:
        trim_meta = {
            "start_sec": eff_start or 0.0,
            "end_sec": eff_end,
            "save_trimmed_only": save_trimmed_only,
        }

    repository.create_job(
        job_id=job_id,
        filename=safe_name,
        file_path=str(saved_path),
        trim_interval=trim_meta,
    )

    worker_pool.submit(
        _run_analysis_task,
        job_id,
        saved_path,
        eff_start,
        eff_end,
        save_trimmed_only,
    )

    response_payload: Dict[str, Any] = {
        "job_id": job_id,
        "status": "processing",
    }
    if trim_meta is not None:
        response_payload["trim_interval"] = trim_meta
    return response_payload


@router.get(
    "/jobs/{job_id}",
    summary="Poll analysis job status and retrieve detected cash discipline violations (Jury API Schema)",
)
async def get_job_status_endpoint(
    job_id: str,
    _api_key: str = Depends(verify_api_key),
) -> Dict[str, Any]:
    job = repository.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job `{job_id}` not found.",
        )

    if job["status"] == "processing":
        return {
            "job_id": job_id,
            "status": "processing",
            "verdict": None,
            "violations": [],
        }

    if job["status"] == "failed":
        return {
            "job_id": job_id,
            "status": "failed",
            "verdict": None,
            "violations": [],
            "error_message": job.get("error_message"),
        }

    # Format strict Jury API violations array
    jury_violations = []
    for v in job.get("violations", []):
        clean_ev = [
            {
                "timestamp_sec": ef.get("timestamp_sec", 0.0),
                "image_base64": ef.get("image_base64", ""),
            }
            for ef in v.get("evidence_frames", [])
            if isinstance(ef, dict)
        ]
        jury_violations.append({
            "type": v.get("type", ""),
            "timecode_sec": v.get("timecode_sec", 0),
            "description": v.get("description", ""),
            "evidence_frames": clean_ev,
        })

    return {
        "job_id": job_id,
        "status": "done",
        "verdict": job.get("verdict", "no_violation"),
        "violations": jury_violations,
    }


@router.get(
    "/jobs/{job_id}/detailed",
    summary="Retrieve enriched audit report with structured RK legal citations, confidence scores, and trim metadata",
)
async def get_job_detailed_endpoint(
    job_id: str,
    _api_key: str = Depends(verify_api_key),
) -> Dict[str, Any]:
    job = repository.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job `{job_id}` not found.",
        )
    return job


@router.get(
    "/jobs",
    summary="List recent video analysis jobs and compliance summary metrics",
)
async def list_jobs_endpoint(
    limit: int = Query(50, ge=1, le=200),
    _api_key: str = Depends(verify_api_key),
) -> Dict[str, Any]:
    jobs = repository.list_jobs(limit=limit)
    total = len(jobs)
    viol_cnt = sum(1 for j in jobs if j.get("verdict") == "violation")
    clean_cnt = sum(1 for j in jobs if j.get("verdict") == "no_violation")
    proc_cnt = sum(1 for j in jobs if j.get("status") == "processing")
    return {
        "summary": {
            "total_jobs": total,
            "violation_videos": viol_cnt,
            "compliant_videos": clean_cnt,
            "processing_jobs": proc_cnt,
        },
        "jobs": jobs,
    }


@router.post(
    "/videos/inspect",
    summary="Inspect a CCTV video's duration, FPS, resolution, and preview thumbnails before trimming",
)
async def inspect_video_endpoint(
    file: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    _api_key: str = Depends(verify_api_key),
) -> Dict[str, Any]:
    uploaded = file or video
    if uploaded is None or not uploaded.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a video file under `file` or `video`.",
        )

    temp_id = uuid.uuid4().hex[:10]
    temp_path = settings.UPLOAD_DIR / f"inspect_{temp_id}_{Path(uploaded.filename).name}"
    try:
        _save_upload_file(uploaded, temp_path)
        info = SpatialPerceptionEngine.inspect_video(temp_path)
        return info
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


@router.post(
    "/videos/trim",
    summary="Physically trim an uploaded CCTV video to [start_sec, end_sec] and optionally launch compliance analysis",
)
async def trim_video_endpoint(
    file: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    start_sec: float = Form(0.0, description="Start time in seconds"),
    end_sec: float = Form(..., description="End time in seconds"),
    analyze_immediately: bool = Form(True, description="Automatically start compliance analysis on the trimmed segment"),
    _api_key: str = Depends(verify_api_key),
) -> Dict[str, Any]:
    uploaded = file or video
    if uploaded is None or not uploaded.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a video file under `file` or `video`.",
        )
    if end_sec <= start_sec:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"end_sec ({end_sec}) must be greater than start_sec ({start_sec}).",
        )

    job_id = uuid.uuid4().hex[:12]
    safe_name = Path(uploaded.filename).name
    raw_path = settings.UPLOAD_DIR / f"raw_{job_id}_{safe_name}"
    trimmed_name = f"trimmed_{job_id}_{Path(safe_name).stem}.mp4"
    trimmed_path = settings.TRIMMED_DIR / trimmed_name

    _save_upload_file(uploaded, raw_path)
    try:
        trim_info = SpatialPerceptionEngine.trim_video_file(
            input_path=raw_path,
            output_path=trimmed_path,
            start_sec=start_sec,
            end_sec=end_sec,
        )
    finally:
        if raw_path.exists():
            try:
                raw_path.unlink()
            except OSError:
                pass

    result: Dict[str, Any] = {
        "trimmed_filename": trimmed_name,
        "original_duration_sec": trim_info["original_duration_sec"],
        "start_sec": trim_info["start_sec"],
        "end_sec": trim_info["end_sec"],
        "trimmed_duration_sec": trim_info["trimmed_duration_sec"],
        "method": trim_info["method"],
    }

    if analyze_immediately:
        trim_meta = {
            "start_sec": trim_info["start_sec"],
            "end_sec": trim_info["end_sec"],
            "physically_trimmed": True,
        }
        repository.create_job(
            job_id=job_id,
            filename=safe_name,
            file_path=str(trimmed_path),
            trim_interval=trim_meta,
        )
        worker_pool.submit(_run_analysis_task, job_id, trimmed_path, None, None, False)
        result["job_id"] = job_id
        result["status"] = "processing"

    return result


def _get_job_and_video_path(job_id: str):
    job = repository.get_job(job_id)
    if not job or not job.get("file_path"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found for job.")
    fpath = Path(job["file_path"])
    if not fpath.exists():
        alt_path = settings.TRIMMED_DIR / f"{job_id}_trimmed.mp4"
        if alt_path.exists():
            fpath = alt_path
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file no longer on disk.")
    return job, fpath


@router.get(
    "/videos/{job_id}/stream",
    summary="Stream the uploaded or trimmed video file for a given job_id",
)
async def stream_job_video_endpoint(job_id: str):
    _, fpath = _get_job_and_video_path(job_id)
    media_type = "video/mp4" if fpath.suffix.lower() == ".mp4" else "video/quicktime"
    return FileResponse(path=str(fpath), media_type=media_type, filename=fpath.name)


@router.get(
    "/jobs/{job_id}/evidence/frame",
    summary="Export an evidence frame at timestamp_sec (or violation_index) as a downloadable JPEG image (with optional bounding box)",
)
async def export_evidence_frame_endpoint(
    job_id: str,
    violation_index: int = Query(0, ge=0, description="Index of the detected violation"),
    timestamp_sec: Optional[float] = Query(None, description="Explicit timestamp (seconds) in video; defaults to violation timecode"),
    draw_bbox: bool = Query(True, description="Draw the evidence bounding rectangle and timestamp tag on the image"),
):
    job, fpath = _get_job_and_video_path(job_id)
    violations = job.get("violations", [])
    bbox_norm = None
    label = None
    target_t = timestamp_sec

    if 0 <= violation_index < len(violations):
        v = violations[violation_index]
        if target_t is None:
            target_t = float(v.get("relative_timecode_sec", v.get("timecode_sec", 0.0)))
        ev_bbox = v.get("evidence_bbox") or {}
        if draw_bbox:
            bbox_norm = ev_bbox.get("bbox_norm")
            label = ev_bbox.get("label")
    elif target_t is None:
        target_t = 0.0

    jpg_bytes = SpatialPerceptionEngine.extract_evidence_frame_jpeg(
        video_path=fpath,
        timestamp_sec=float(target_t),
        bbox_norm=bbox_norm if draw_bbox else None,
        label=label,
    )
    fname = f"evidence_{job_id}_v{violation_index + 1}_{int(round(target_t))}s.jpg"
    return Response(
        content=jpg_bytes,
        media_type="image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get(
    "/jobs/{job_id}/evidence/clip",
    summary="Export a single violation's evidence +- N seconds (or frames) as a standalone .mp4 video clip",
)
async def export_evidence_clip_endpoint(
    job_id: str,
    violation_index: int = Query(0, ge=0, description="Index of the detected violation"),
    pad_sec: float = Query(3.0, ge=0.5, le=30.0, description="Seconds before and after the violation timestamp (+- N sec)"),
    draw_bbox: bool = Query(True, description="Draw the evidence bounding rectangle around the violation peak"),
):
    job, fpath = _get_job_and_video_path(job_id)
    violations = job.get("violations", [])
    if not violations or violation_index >= len(violations):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation index not found on job.")

    v = violations[violation_index]
    peak_t = float(v.get("relative_timecode_sec", v.get("timecode_sec", 0.0)))
    ev_bbox = (v.get("evidence_bbox") or {}).get("bbox_norm")

    out_name = f"evidence_clip_{job_id}_v{violation_index + 1}_pm{int(round(pad_sec))}s.mp4"
    out_path = settings.TRIMMED_DIR / out_name
    SpatialPerceptionEngine.compile_video_cuts(
        input_path=fpath,
        output_path=out_path,
        cuts=[{
            "start_sec": max(0.0, peak_t - pad_sec),
            "end_sec": peak_t + pad_sec,
            "peak_sec": peak_t,
            "bbox_norm": ev_bbox,
        }],
        draw_bbox=draw_bbox,
    )
    return FileResponse(path=str(out_path), media_type="video/mp4", filename=out_name)


@router.post(
    "/jobs/{job_id}/evidence/compile",
    summary="Compile multiple selected violation timelines (or custom [start_sec, end_sec] cuts) into one single .mp4 video of cuts",
)
async def compile_multiple_evidence_cuts_endpoint(
    job_id: str,
    payload: Dict[str, Any] = Body(
        ...,
        description="Provide either `violation_indices: [0, 1, ...]` + `pad_sec: 3.0`, or explicit `cuts: [{'start_sec': 5, 'end_sec': 12}, ...]`",
    ),
):
    job, fpath = _get_job_and_video_path(job_id)
    violations = job.get("violations", [])
    pad_sec = float(payload.get("pad_sec", 3.0))
    draw_bbox = bool(payload.get("draw_bbox", True))

    cuts: List[Dict[str, Any]] = []
    if "cuts" in payload and isinstance(payload["cuts"], list) and len(payload["cuts"]) > 0:
        for c in payload["cuts"]:
            cuts.append({
                "start_sec": float(c.get("start_sec", 0.0)),
                "end_sec": float(c.get("end_sec", 5.0)),
                "peak_sec": c.get("peak_sec"),
                "bbox_norm": c.get("bbox_norm"),
            })
    else:
        indices = payload.get("violation_indices")
        if indices is None:
            indices = list(range(len(violations)))
        for idx in indices:
            if 0 <= int(idx) < len(violations):
                v = violations[int(idx)]
                peak_t = float(v.get("relative_timecode_sec", v.get("timecode_sec", 0.0)))
                ev_bbox = (v.get("evidence_bbox") or {}).get("bbox_norm")
                cuts.append({
                    "start_sec": max(0.0, peak_t - pad_sec),
                    "end_sec": peak_t + pad_sec,
                    "peak_sec": peak_t,
                    "bbox_norm": ev_bbox,
                })

    if not cuts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid evidence cuts selected.")

    out_name = f"compiled_evidence_{job_id}_{len(cuts)}cuts.mp4"
    out_path = settings.TRIMMED_DIR / out_name
    SpatialPerceptionEngine.compile_video_cuts(
        input_path=fpath,
        output_path=out_path,
        cuts=cuts,
        draw_bbox=draw_bbox,
    )
    return FileResponse(path=str(out_path), media_type="video/mp4", filename=out_name)


@router.get(
    "/regulations",
    summary="List all 16 Republic of Kazakhstan banking regulations (adilet.zan.kz) from PostgreSQL pgvector",
)
async def list_regulations_endpoint() -> Dict[str, Any]:
    regs = repository.list_regulations()
    return {
        "count": len(regs),
        "source": "adilet.zan.kz (National Bank of the Republic of Kazakhstan)",
        "regulations": regs,
    }
