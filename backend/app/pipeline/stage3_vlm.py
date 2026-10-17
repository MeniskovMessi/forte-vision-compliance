"""
Stage 3: Local VLM Verifier & Visual Observation Synthesizer (`stage3_vlm.py`)
Rule 2 & 3 Compliance:
- 100% local execution (optional local Ollama VLM endpoint on localhost:11434 with instant deterministic fallback).
- Zero external cloud APIs; zero biometric/facial recognition.
- Extracts 1-3 key evidence frames around the violation peak and synthesizes a precise Russian visual observation.
"""

import os
import json
import logging
import urllib.request
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
from dotenv import load_dotenv

from backend.app.pipeline.stage1_spatial import SpatialPerceptionEngine

logger = logging.getLogger("pipeline.stage3_vlm")


class LocalVLMVerifier:
    """
    Synthesizes factual visual observations from evidence frames and optionally enriches
    with a local Ollama Vision-Language Model (`qwen2.5vl:3b` / `moondream`) if running locally.
    """

    def __init__(self):
        root = Path(__file__).resolve().parent.parent.parent.parent
        load_dotenv(root / ".env")
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.vlm_model = os.getenv("VLM_MODEL_NAME", "qwen2.5vl:3b")
        self.enable_ollama = os.getenv("ENABLE_LOCAL_VLM", "false").lower() in ("true", "1", "yes")

    @staticmethod
    def select_evidence_frames(
        sampled_frames: Dict[float, np.ndarray],
        peak_sec: float,
        trim_offset_sec: float = 0.0,
        max_frames: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Extracts up to `max_frames` (1-3) base64-encoded JPEG frames centered on `peak_sec`
        (e.g. peak_sec - 1s, peak_sec, peak_sec + 1s), returning objects:
        `[{"timestamp_sec": 18.0, "image_base64": "/9j/4AAQ..."}]`.
        """
        if not sampled_frames:
            return []

        available_ts = sorted(sampled_frames.keys())
        target_offsets = [-1.0, 0.0, 1.0] if max_frames >= 3 else [0.0]
        chosen_ts = []

        for offset in target_offsets:
            target = peak_sec + offset
            closest = min(available_ts, key=lambda t: abs(t - target))
            if closest not in chosen_ts:
                chosen_ts.append(closest)

        if not chosen_ts:
            closest = min(available_ts, key=lambda t: abs(t - peak_sec))
            chosen_ts = [closest]

        ev_list: List[Dict[str, Any]] = []
        for t in chosen_ts[:max_frames]:
            b64 = SpatialPerceptionEngine.encode_frame_base64(sampled_frames[t], quality=85)
            if b64:
                ev_list.append({
                    "timestamp_sec": round(float(trim_offset_sec + t), 1),
                    "image_base64": b64,
                })
        return ev_list

    def verify_and_describe(
        self,
        rule_code: str,
        timecode_sec: int,
        base_observation: str,
        evidence_frames: List[Dict[str, Any]],
    ) -> str:
        """
        Returns a factual Russian visual description of the violation at `timecode_sec`.
        If local Ollama VLM is explicitly enabled and reachable on localhost, enriches the observation.
        """
        if not self.enable_ollama or not evidence_frames:
            return base_observation

        try:
            prompt = (
                "Ты эксперт аудита кассовой дисциплины банка РК. Опиши строго в одном предложении "
                "визуальный факт нарушения на кадре без упоминания личностей или биометрии. "
                f"Контекст детектора (таймкод {timecode_sec} сек.): {base_observation}"
            )
            mid_item = evidence_frames[len(evidence_frames) // 2]
            mid_b64 = mid_item["image_base64"] if isinstance(mid_item, dict) else str(mid_item)
            payload = json.dumps({
                "model": self.vlm_model,
                "prompt": prompt,
                "images": [mid_b64],
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 90},
            }).encode("utf-8")

            req = urllib.request.Request(
                f"{self.ollama_url.rstrip('/')}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                vlm_text = (data.get("response") or "").strip()
                if len(vlm_text) > 25:
                    return f"{base_observation} (Визуальное подтверждение VLM: {vlm_text})"
        except Exception as e:
            logger.debug(f"Local Ollama VLM not active ({e}); using deterministic spatial-temporal observation.")

        return base_observation
