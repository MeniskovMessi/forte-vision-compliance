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
    def _extract_ts(s) -> float:
        if hasattr(s, "timestamp_sec"):
            return float(s.timestamp_sec)
        if isinstance(s, dict) and "timestamp_sec" in s:
            return float(s["timestamp_sec"])
        return 0.0

    @classmethod
    def compute_evidence_bbox(
        cls,
        rule_code: str,
        timeline: Any,
        peak_sec: float,
        meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Computes a normalized bounding box `[x1, y1, x2, y2]` (in [0.0..1.0] video coordinates)
        and a short Russian label pinpointing the spatial region of the violation at `peak_sec`.
        Used by the Web UI video player to draw an interactive rectangle overlay when playback
        pauses at the violation timestamp (`T` after playing from `T - 5s`).
        """
        zones = meta.get("zones", {}) if isinstance(meta, dict) else {}
        layout = zones.get("layout", "A_right_laptop") if isinstance(zones, dict) else "A_right_laptop"

        # Find the closest spatial frame state S(t) to peak_sec
        frame_state = None
        if timeline:
            frame_state = min(timeline, key=lambda s: abs(cls._extract_ts(s) - peak_sec))

        persons = getattr(frame_state, "persons", []) if frame_state else []
        if isinstance(frame_state, dict):
            persons = frame_state.get("persons", [])

        # Filter out glass reflection false positives when inspecting person boxes
        real_persons = []
        for p in persons or []:
            center = getattr(p, "center", None) or (p.get("center") if isinstance(p, dict) else None)
            if center and len(center) == 2 and center[0] < 0.145 and center[1] < 0.40:
                continue
            real_persons.append(p)

        # 1. Laptop left unlocked / open
        if rule_code in ("NBRK_SECURITY_UNLOCKED_TERMINAL_UNATTENDED", "UNATTENDED_LAPTOP_OPEN"):
            box = zones.get("laptop", [0.54, 0.36, 0.72, 0.50] if "A" in layout else [0.05, 0.38, 0.28, 0.53])
            return {"bbox_norm": [round(float(v), 3) for v in box], "label": "Незаблокированный ноутбук (АРМ)"}

        # 2. Safe door left open / keys in safe
        if rule_code in (
            "NBRK_CASH_LEAVING_SAFE_OPEN_UNATTENDED",
            "NBRK_SECURITY_KEYS_LEFT_IN_SAFE_LOCK",
            "UNATTENDED_SAFE_OPEN",
            "OPEN_SAFE_DURING_OPERATIONS",
        ):
            box = zones.get("safe", [0.48, 0.31, 0.88, 0.55])
            return {"bbox_norm": [round(float(v), 3) for v in box], "label": "Открытая дверца сейфа"}

        # 3. Inkassator bag left unattended or improper handover
        if rule_code in (
            "NBRK_CASH_LEAVING_BAG_UNATTENDED",
            "NBRK_CASH_INKASSATION_BAG_HANDOVER_PROTOCOL",
            "UNATTENDED_CASH_BAG",
            "INKASSATOR_HANDOVER_VIOLATION",
        ):
            lbl = (
                "Инкассаторская сумка без присмотра"
                if "LEAVING_BAG" in rule_code
                else "Зона передачи инкассаторской сумки"
            )
            return {"bbox_norm": [0.26, 0.39, 0.55, 0.55], "label": lbl}

        # 4. Foreign objects / cups / personal bags on desk
        if rule_code in (
            "NBRK_CASH_FORBIDDEN_ITEMS_FOOD_DRINKS",
            "NBRK_CASH_FORBIDDEN_ITEMS_PERSONAL_BAGS",
            "FOREIGN_OBJECTS_PERSONAL_ITEMS",
            "PERSONAL_ITEMS_WORKSPACE",
        ):
            lbl = (
                "Личные вещи на кассовом столе"
                if "PERSONAL_BAGS" in rule_code
                else "Посторонние предметы (напитки) в рабочей зоне"
            )
            return {"bbox_norm": [0.22, 0.33, 0.58, 0.54], "label": lbl}

        # 5. Unauthorized 3rd party present in cash room
        if rule_code in ("NBRK_SECURITY_UNAUTHORIZED_THIRD_PERSON", "UNAUTHORIZED_THIRD_PARTY_PRESENT"):
            if real_persons:
                # Pick person closest to doorway / upper zone or last entered person
                target_p = min(
                    real_persons,
                    key=lambda p: (getattr(p, "center", None) or (p.get("center") if isinstance(p, dict) else (0.5, 0.5)))[1],
                )
                bbox = getattr(target_p, "bbox", None) or (target_p.get("bbox") if isinstance(target_p, dict) else None)
                if bbox and len(bbox) == 4:
                    return {"bbox_norm": [round(float(v), 3) for v in bbox], "label": "Постороннее лицо в кассе"}
            return {"bbox_norm": [0.12, 0.10, 0.58, 0.72], "label": "Постороннее лицо в кассе"}

        # 6. Door left unlocked on entry
        if rule_code in ("NBRK_SECURITY_CASH_ROOM_DOOR_UNLOCKED", "DOOR_LEFT_UNLOCKED_ON_ENTRY"):
            box = zones.get("door", [0.08, 0.08, 0.45, 0.37])
            return {"bbox_norm": [round(float(v), 3) for v in box], "label": "Входная дверь кассы (не заперта)"}

        # 7. Omission of bill counter / UV detector
        if rule_code in (
            "NBRK_CASH_OMISSION_BILL_COUNTER_DETECTOR",
            "CASH_HANDOVER_WITHOUT_RECOUNT",
            "MANUAL_COUNT_WITHOUT_DETECTOR",
        ):
            box = [0.12, 0.38, 0.52, 0.54] if "A" in layout else [0.24, 0.37, 0.74, 0.53]
            return {
                "bbox_norm": [round(float(v), 3) for v in box],
                "label": "Пересчет наличных мимо счетчика / детектора",
            }

        # 8. Unattended cash or client cash zone violations on desk surface
        box = zones.get("desk_surface", [0.24, 0.40, 0.54, 0.53])
        label_map = {
            "NBRK_CASH_LEAVING_UNATTENDED_MONEY": "Наличные деньги без присмотра на столе",
            "NBRK_CASH_UNATTENDED_CLIENT_ZONE": "Неубранная наличность в зоне клиента",
            "NBRK_CASH_MIXING_DIFFERENT_CLIENT_VALUABLES": "Смешивание наличности разных клиентов",
            "UNATTENDED_CASH_ON_DESK": "Наличные деньги без присмотра на столе",
            "CASH_LEFT_AFTER_CLIENT_EXIT": "Неубранная наличность после ухода клиента",
            "CONCURRENT_CLIENTS_UNCLEARED_DESK": "Обслуживание нового клиента при неубранной наличности",
        }
        return {
            "bbox_norm": [round(float(v), 3) for v in box],
            "label": label_map.get(rule_code, "Зона фиксации нарушения кассовой дисциплины"),
        }

    @staticmethod
    def select_evidence_frames(
        sampled_frames: Dict[float, np.ndarray],
        peak_sec: float,
        trim_offset_sec: float = 0.0,
        max_frames: int = 3,
        evidence_bbox: Dict[str, Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extracts up to `max_frames` (1-3) base64-encoded JPEG frames centered on `peak_sec`
        (e.g. peak_sec - 1s, peak_sec, peak_sec + 1s), returning objects:
        `[{"timestamp_sec": 18.0, "image_base64": "/9j/4AAQ...", "bbox_norm": [...]}]`.
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
                item: Dict[str, Any] = {
                    "timestamp_sec": round(float(trim_offset_sec + t), 1),
                    "image_base64": b64,
                }
                if evidence_bbox:
                    item["bbox_norm"] = evidence_bbox.get("bbox_norm")
                    item["bbox_label"] = evidence_bbox.get("label")
                ev_list.append(item)
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
