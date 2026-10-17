"""
End-to-End 4-Stage Compliance Pipeline Orchestrator (`orchestrator.py`)
Connects:
- Stage 1 (`SpatialPerceptionEngine`): YOLOv11-pose + YOLOv11n + OpenCV dynamic workspace calibration + interval trimming
- Stage 2 (`TemporalComplianceEngine`): Temporal action & state-machine violation localization
- Stage 3 (`LocalVLMVerifier`): Evidence frame extraction (base64 JPEG) & visual observation synthesis
- Stage 4 (`LegalRAGGroundingEngine`): PostgreSQL `pgvector` semantic legal grounding (`adilet.zan.kz`)
"""

import time
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from backend.app.pipeline.stage1_spatial import SpatialPerceptionEngine
from backend.app.pipeline.stage2_temporal import TemporalComplianceEngine
from backend.app.pipeline.stage3_vlm import LocalVLMVerifier
from backend.app.pipeline.stage4_rag import LegalRAGGroundingEngine

logger = logging.getLogger("pipeline.orchestrator")


class CompliancePipelineOrchestrator:
    """
    Main entry point for analyzing CCTV `.mov` recordings of bank cashier operations.
    Supports both full-video analysis and time-interval trimming `[start_sec, end_sec]`.
    100% local execution, zero cloud dependencies, zero biometric identification.
    """

    def __init__(self, sample_fps: float = 1.0):
        self.stage1 = SpatialPerceptionEngine(sample_fps=sample_fps)
        self.stage2 = TemporalComplianceEngine()
        self.stage3 = LocalVLMVerifier()
        self.stage4 = LegalRAGGroundingEngine()

    def analyze_video(
        self,
        video_path: Path,
        job_id: Optional[str] = None,
        include_evidence_frames: bool = True,
        start_sec: Optional[float] = None,
        end_sec: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Executes the full 4-stage pipeline on `video_path` (or only on the `[start_sec, end_sec]`
        interval if specified) and returns a dictionary conforming to the Jury API specification.
        """
        jid = job_id or str(uuid.uuid4())
        t0 = time.time()

        try:
            # Stage 1: Spatial Perception & Relational Timeline S(t)
            timeline, sampled_frames, meta = self.stage1.extract_video_timeline(
                Path(video_path),
                start_sec=start_sec,
                end_sec=end_sec,
            )
            trim_offset = float(meta.get("trim_start_sec", 0.0))

            # Stage 2: Temporal Action & Anomaly State Machine
            candidates = self.stage2.evaluate_timeline(timeline, sampled_frames, meta)

            # Stage 3 & Stage 4: Evidence Frame Selection + VLM Observation + pgvector Legal RAG Grounding
            grounded_violations = []
            for cand in candidates:
                rel_tc = float(cand.timecode_sec)
                abs_tc = int(round(trim_offset + rel_tc))
                ev_bbox = self.stage3.compute_evidence_bbox(
                    rule_code=cand.rule_code,
                    timeline=timeline,
                    peak_sec=rel_tc,
                    meta=meta,
                )
                ev_frames = (
                    self.stage3.select_evidence_frames(
                        sampled_frames,
                        rel_tc,
                        trim_offset_sec=trim_offset,
                        max_frames=3,
                        evidence_bbox=ev_bbox,
                    )
                    if include_evidence_frames
                    else []
                )
                verified_obs = self.stage3.verify_and_describe(
                    rule_code=cand.rule_code,
                    timecode_sec=abs_tc,
                    base_observation=cand.visual_observation,
                    evidence_frames=ev_frames,
                )
                grounded = self.stage4.format_grounded_violation(
                    rule_code=cand.rule_code,
                    timecode_sec=abs_tc,
                    visual_observation=verified_obs,
                    confidence=cand.confidence,
                    evidence_frames=ev_frames,
                )
                grounded["relative_timecode_sec"] = int(round(rel_tc))
                grounded["evidence_bbox"] = ev_bbox
                grounded["bbox_norm"] = ev_bbox.get("bbox_norm")
                grounded["bbox_label"] = ev_bbox.get("label")
                grounded["replay_window"] = {
                    "pre_roll_sec": round(max(0.0, rel_tc - 5.0), 1),
                    "stop_sec": round(rel_tc, 1),
                    "abs_pre_roll_sec": round(max(0.0, float(abs_tc) - 5.0), 1),
                    "abs_stop_sec": round(float(abs_tc), 1),
                }
                grounded_violations.append(grounded)

            verdict = "violation" if len(grounded_violations) > 0 else "no_violation"
            elapsed = round(time.time() - t0, 2)

            return {
                "job_id": jid,
                "status": "done",
                "verdict": verdict,
                "violations": grounded_violations,
                "error_message": None,
                "processing_time_sec": elapsed,
                "video_metadata": {
                    "filename": Path(video_path).name,
                    "original_duration_sec": meta.get("original_duration_sec", meta.get("duration_sec", 0.0)),
                    "analyzed_duration_sec": meta.get("duration_sec", 0.0),
                    "trim_start_sec": meta.get("trim_start_sec", 0.0),
                    "trim_end_sec": meta.get("trim_end_sec", 0.0),
                    "is_trimmed": meta.get("is_trimmed", False),
                    "fps": meta.get("fps", 30.0),
                    "layout": meta.get("zones", {}).get("layout", "unknown"),
                },
            }

        except Exception as e:
            logger.exception(f"Pipeline failed on {video_path}: {e}")
            return {
                "job_id": jid,
                "status": "failed",
                "verdict": None,
                "violations": [],
                "error_message": str(e),
            }
