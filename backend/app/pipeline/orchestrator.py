"""
End-to-End 4-Stage Compliance Pipeline Orchestrator (`orchestrator.py`)
Connects:
- Stage 1 (`SpatialPerceptionEngine`): YOLOv11-pose + YOLOv11n + OpenCV dynamic workspace calibration
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
    ) -> Dict[str, Any]:
        """
        Executes the full 4-stage pipeline on `video_path` and returns a dictionary
        conforming to the Jury API specification.
        """
        jid = job_id or str(uuid.uuid4())
        t0 = time.time()

        try:
            # Stage 1: Spatial Perception & Relational Timeline S(t)
            timeline, sampled_frames, meta = self.stage1.extract_video_timeline(Path(video_path))

            # Stage 2: Temporal Action & Anomaly State Machine
            candidates = self.stage2.evaluate_timeline(timeline, sampled_frames, meta)

            # Stage 3 & Stage 4: Evidence Frame Selection + VLM Observation + pgvector Legal RAG Grounding
            grounded_violations = []
            for cand in candidates:
                ev_frames = (
                    self.stage3.select_evidence_frames(sampled_frames, float(cand.timecode_sec), max_frames=3)
                    if include_evidence_frames
                    else []
                )
                verified_obs = self.stage3.verify_and_describe(
                    rule_code=cand.rule_code,
                    timecode_sec=cand.timecode_sec,
                    base_observation=cand.visual_observation,
                    evidence_frames_b64=ev_frames,
                )
                grounded = self.stage4.format_grounded_violation(
                    rule_code=cand.rule_code,
                    timecode_sec=cand.timecode_sec,
                    visual_observation=verified_obs,
                    confidence=cand.confidence,
                    evidence_frames=ev_frames,
                )
                grounded_violations.append(grounded)

            verdict = "violation" if len(grounded_violations) > 0 else "no_violation"
            elapsed = round(time.time() - t0, 2)

            return {
                "job_id": jid,
                "status": "completed",
                "verdict": verdict,
                "violations": grounded_violations,
                "error_message": None,
                "processing_time_sec": elapsed,
                "video_metadata": {
                    "filename": Path(video_path).name,
                    "duration_sec": meta.get("duration_sec", 0.0),
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
