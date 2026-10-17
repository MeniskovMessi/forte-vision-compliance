"""
Stage 1: Spatial Perception & Relational State Extractor (`stage1_spatial.py`)
Rule 2, 3, 5, 6 Compliance:
- 100% local execution using cached YOLOv11-pose & YOLOv11n object detectors + OpenCV ROI analyzers.
- Zero facial recognition or biometric identification.
- Dynamic desk/workspace calibration (camera-angle & layout adaptive).
- Safe UTF-8 / Cyrillic file handling on Windows.
"""

import os
import math
import base64
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
import cv2
import numpy as np

logger = logging.getLogger("pipeline.stage1_spatial")


@dataclass
class PersonState:
    bbox: List[float]          # [x1, y1, x2, y2] normalized 0..1
    center: Tuple[float, float]
    conf: float
    left_wrist: Optional[Tuple[float, float]] = None
    right_wrist: Optional[Tuple[float, float]] = None
    role: str = "unknown"      # "cashier" | "client" | "third_party"


@dataclass
class FrameSpatialState:
    frame_idx: int
    timestamp_sec: float
    num_persons: int
    cashier_present: bool
    cashier_at_door: bool
    client_present: bool
    client_leaving_door: bool
    person_in_doorway: bool
    third_party_present: bool
    # Object / equipment states
    safe_open: bool
    safe_open_score: float
    safe_delta_score: float
    cash_on_desk: bool
    cash_score: float
    desk_non_wood_score: float
    inkassator_bag_on_desk: bool
    bag_score: float
    cup_on_desk: bool
    cup_score: float
    personal_bag_on_desk: bool
    personal_bag_score: float
    left_desk_clutter_score: float
    phone_detected: bool
    laptop_screen_on: bool
    laptop_white_score: float
    laptop_p95_brightness: float
    room_dark: bool
    room_brightness: float
    # Interaction signals
    hand_near_counter: bool
    hand_near_detector: bool
    hand_near_safe: bool
    hand_to_client_transfer: bool
    counter_motion_score: float
    detector_motion_score: float
    safe_motion_score: float
    door_motion_score: float
    desk_foreign_object_score: float
    persons: List[PersonState] = field(default_factory=list)


class SpatialPerceptionEngine:
    """
    Extracts structured spatial-relational state timelines S(t) from .mov CCTV videos.
    Uses YOLOv11n-pose + YOLOv11n object detector (full frame + zoomed desk crop) + adaptive ROI analysis.
    """

    def __init__(self, models_dir: Optional[Path] = None, sample_fps: float = 1.0):
        root = Path(__file__).resolve().parent.parent.parent.parent
        self.models_dir = models_dir or (root / "models")
        self.sample_fps = sample_fps
        self._pose_model = None
        self._det_model = None

    def _load_models(self):
        if self._pose_model is None or self._det_model is None:
            from ultralytics import YOLO
            pose_path = self.models_dir / "yolo11n-pose.pt"
            det_path = self.models_dir / "yolo11n.pt"
            logger.info(f"Loading local YOLO models from {self.models_dir}...")
            self._pose_model = YOLO(str(pose_path))
            self._det_model = YOLO(str(det_path))

    @staticmethod
    def _open_video_safe(video_path: Path) -> Tuple[cv2.VideoCapture, Optional[Path]]:
        """
        Rule 6: Safe video opening on Windows even when filenames contain Cyrillic characters.
        """
        cap = cv2.VideoCapture(str(video_path))
        if cap.isOpened() and int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) > 0:
            return cap, None
        cap.release()
        import tempfile, shutil
        tmp_dir = Path(tempfile.gettempdir()) / "fortebank_video_cache"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / f"vid_{abs(hash(str(video_path)))}.mov"
        if not tmp_path.exists():
            shutil.copy2(video_path, tmp_path)
        cap = cv2.VideoCapture(str(tmp_path))
        return cap, tmp_path

    @staticmethod
    def encode_frame_base64(frame_bgr: np.ndarray, quality: int = 85) -> str:
        """Encodes an OpenCV BGR frame into a base64 JPEG string for the Jury API."""
        ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not ok:
            return ""
        return base64.b64encode(buf.tobytes()).decode("ascii")

    def calibrate_workspace(
        self, frames: List[np.ndarray], det_boxes_per_frame: List[List[Tuple]]
    ) -> Dict[str, object]:
        """
        Rule 5: Dynamically calibrates workspace zones (desk, door, safe, counter, laptop)
        relative to detected furniture/equipment, with fallback to standard overhead camera geometry.
        Auto-detects Desk Layout:
        - Layout A_right_laptop: Counter on Left, Laptop on Right, Safe on Right
        - Layout B_left_laptop: Laptop/Phone on Left, Counter/Detector on Right, Safe on Right
        """
        desk_zone = (0.06, 0.41, 0.86, 0.59)
        door_zone = (0.08, 0.08, 0.45, 0.37)
        safe_zone = (0.48, 0.31, 0.88, 0.55)

        laptop_xs = []
        for dets in det_boxes_per_frame:
            for cls_name, conf, box in dets:
                if cls_name in ("laptop", "tv") and conf > 0.25:
                    cx = 0.5 * (box[0] + box[2])
                    cy = 0.5 * (box[1] + box[3])
                    if 0.35 <= cy <= 0.60 and (cx < 0.30 or cx > 0.48):
                        laptop_xs.append(cx)

        if len(laptop_xs) >= 3:
            avg_lx = float(np.median(laptop_xs))
            layout = "B_left_laptop" if avg_lx < 0.35 else "A_right_laptop"
        else:
            # Check dark/bright equipment signature on left vs right desk corners
            h, w = frames[0].shape[:2]
            # In Layout A, the bulky black bill-counter sits at left [x:0.06..0.18, y:0.40..0.52]
            # In Layout B, the bulky bill-counter sits at right [x:0.60..0.75, y:0.39..0.51]
            left_patch = np.mean([frames[i][int(0.41*h):int(0.51*h), int(0.56*w):int(0.70*w)] for i in range(min(5, len(frames)))])
            layout = "A_right_laptop" if left_patch > 105.0 else "B_left_laptop"

        if layout == "A_right_laptop":
            counter_zone = (0.04, 0.38, 0.27, 0.53)
            detector_zone = (0.16, 0.43, 0.33, 0.53)
            laptop_zone = (0.55, 0.38, 0.70, 0.48)
            desk_surface_zone = (0.28, 0.43, 0.52, 0.51)
        else:
            counter_zone = (0.50, 0.37, 0.78, 0.51)
            detector_zone = (0.48, 0.42, 0.65, 0.52)
            laptop_zone = (0.05, 0.40, 0.26, 0.52)
            desk_surface_zone = (0.24, 0.43, 0.52, 0.51)

        return {
            "layout": layout,
            "desk": desk_zone,
            "door": door_zone,
            "safe": safe_zone,
            "counter": counter_zone,
            "detector": detector_zone,
            "laptop": laptop_zone,
            "desk_surface": desk_surface_zone,
        }

    @staticmethod
    def _crop_norm(img: np.ndarray, box: Tuple[float, float, float, float]) -> np.ndarray:
        h, w = img.shape[:2]
        x1 = max(0, min(w - 1, int(box[0] * w)))
        y1 = max(0, min(h - 1, int(box[1] * h)))
        x2 = max(x1 + 1, min(w, int(box[2] * w)))
        y2 = max(y1 + 1, min(h, int(box[3] * h)))
        return img[y1:y2, x1:x2]

    @staticmethod
    def _deduplicate_persons(raw_persons: List[PersonState]) -> List[PersonState]:
        """
        Deduplicates overlapping pose detections (e.g. upper-body vs full-body box on the same person)
        and filters out reflections in the upper-left glass partition.
        """
        sorted_p = sorted(raw_persons, key=lambda p: p.conf, reverse=True)
        kept: List[PersonState] = []
        for cand in sorted_p:
            cx, cy = cand.center
            is_dup = False
            for existing in kept:
                ex, ey = existing.center
                dist = math.hypot(cx - ex, cy - ey)
                # Also compute horizontal overlap if vertically close
                if dist < 0.13:
                    is_dup = True
                    # Merge wrist keypoints if existing lacked them
                    if existing.left_wrist is None and cand.left_wrist is not None:
                        existing.left_wrist = cand.left_wrist
                    if existing.right_wrist is None and cand.right_wrist is not None:
                        existing.right_wrist = cand.right_wrist
                    break
            if not is_dup:
                kept.append(cand)
        return kept

    @staticmethod
    def inspect_video(video_path: Path) -> Dict[str, Any]:
        """
        Quickly inspects a CCTV video file and returns duration, FPS, resolution,
        and 3 preview thumbnails (start, mid, end) encoded as base64 JPEGs for UI trimming.
        """
        cap, tmp_path = SpatialPerceptionEngine._open_video_safe(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_sec = round(total_frames / fps, 2) if fps > 0 else 0.0

        preview_indices = sorted(set([0, max(0, total_frames // 2), max(0, total_frames - 5)]))
        thumbnails = []
        cur_idx = 0
        for target_idx in preview_indices:
            while cur_idx < target_idx:
                if not cap.grab():
                    break
                cur_idx += 1
            ret, frm = cap.read()
            cur_idx += 1
            if ret and frm is not None:
                thumb = cv2.resize(frm, (480, 270))
                thumbnails.append({
                    "timestamp_sec": round(target_idx / fps, 2),
                    "frame_base64": SpatialPerceptionEngine.encode_frame_base64(thumb, quality=80),
                })

        cap.release()
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

        return {
            "filename": Path(video_path).name,
            "duration_sec": duration_sec,
            "fps": round(fps, 2),
            "total_frames": total_frames,
            "width": width,
            "height": height,
            "preview_thumbnails": thumbnails,
        }

    @staticmethod
    def trim_video_file(
        input_path: Path,
        output_path: Path,
        start_sec: float = 0.0,
        end_sec: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Trims a CCTV video to [start_sec, end_sec] and writes the trimmed clip to `output_path`.
        Uses lossless ffmpeg stream copy when available on PATH, with automatic OpenCV VideoWriter fallback.
        """
        import shutil
        import subprocess

        cap, tmp_path = SpatialPerceptionEngine._open_video_safe(input_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video file for trimming: {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        orig_duration = total_frames / fps if fps > 0 else 0.0

        s_sec = max(0.0, float(start_sec or 0.0))
        e_sec = min(orig_duration, float(end_sec)) if end_sec is not None and end_sec > 0 else orig_duration
        if e_sec <= s_sec:
            cap.release()
            raise ValueError(f"Invalid trim interval: start_sec ({s_sec}) must be less than end_sec ({e_sec}).")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        ffmpeg_bin = shutil.which("ffmpeg")
        if ffmpeg_bin:
            cap.release()
            if tmp_path and tmp_path.exists():
                try:
                    tmp_path.unlink()
                except OSError:
                    pass
            cmd = [
                ffmpeg_bin, "-y",
                "-ss", f"{s_sec:.2f}",
                "-to", f"{e_sec:.2f}",
                "-i", str(input_path),
                "-c", "copy",
                str(output_path),
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
                return {
                    "output_path": str(output_path),
                    "original_duration_sec": round(orig_duration, 2),
                    "start_sec": round(s_sec, 2),
                    "end_sec": round(e_sec, 2),
                    "trimmed_duration_sec": round(e_sec - s_sec, 2),
                    "method": "ffmpeg_stream_copy",
                }
            # Re-open for OpenCV fallback if ffmpeg failed
            cap, tmp_path = SpatialPerceptionEngine._open_video_safe(input_path)

        # OpenCV frame-accurate writer fallback
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))
        start_f = max(0, int(round(s_sec * fps)))
        end_f = min(total_frames, int(round(e_sec * fps)))

        cur_f = 0
        written = 0
        while cur_f < end_f:
            if cur_f < start_f:
                if not cap.grab():
                    break
                cur_f += 1
                continue
            ret, frame = cap.read()
            if not ret:
                break
            writer.write(frame)
            written += 1
            cur_f += 1

        writer.release()
        cap.release()
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

        return {
            "output_path": str(output_path),
            "original_duration_sec": round(orig_duration, 2),
            "start_sec": round(s_sec, 2),
            "end_sec": round(e_sec, 2),
            "trimmed_duration_sec": round(written / fps, 2) if fps > 0 else round(e_sec - s_sec, 2),
            "method": "opencv_videowriter",
        }

    def extract_video_timeline(
        self,
        video_path: Path,
        start_sec: Optional[float] = None,
        end_sec: Optional[float] = None,
    ) -> Tuple[List[FrameSpatialState], Dict[float, np.ndarray], Dict]:
        """
        Processes a video (or a trimmed interval `[start_sec, end_sec]`) at `self.sample_fps` and returns:
        1. `timeline`: List of `FrameSpatialState` (timestamps relative to interval start `0..interval_dur`)
        2. `sampled_frames`: Dict mapping `round(timestamp_sec, 1)` -> BGR frame
        3. `meta`: Video metadata, trim offsets, & calibrated workspace zones
        """
        self._load_models()
        cap, tmp_path = self._open_video_safe(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        orig_duration_sec = total_frames / fps if fps > 0 else 0.0

        trim_start = max(0.0, float(start_sec)) if start_sec is not None and start_sec > 0 else 0.0
        trim_end = (
            min(orig_duration_sec, float(end_sec))
            if end_sec is not None and end_sec > 0
            else orig_duration_sec
        )
        if trim_end <= trim_start:
            trim_start, trim_end = 0.0, orig_duration_sec

        start_frame = max(0, int(round(trim_start * fps)))
        end_frame = min(total_frames, int(round(trim_end * fps))) if total_frames > 0 else 10**9
        is_trimmed = (trim_start > 0.0) or (end_sec is not None and trim_end < orig_duration_sec - 0.1)

        step = max(1, int(round(fps / self.sample_fps)))
        raw_frames: List[Tuple[int, float, np.ndarray]] = []
        frame_idx = 0

        while frame_idx < end_frame:
            if frame_idx < start_frame:
                if not cap.grab():
                    break
                frame_idx += 1
                continue
            if (frame_idx - start_frame) % step == 0:
                ret, frame = cap.read()
                if not ret:
                    break
                rel_t_sec = round((frame_idx - start_frame) / fps, 2)
                raw_frames.append((frame_idx, rel_t_sec, frame))
            else:
                if not cap.grab():
                    break
            frame_idx += 1

        cap.release()
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

        if not raw_frames:
            raise RuntimeError(f"No frames decoded from {video_path}")

        frame_list = [f for _, _, f in raw_frames]
        # Zoomed desk ROI crops [x:0.12..0.78, y:0.32..0.58] for high-recall small object detection (cups, bags, phones)
        zoom_box = (0.12, 0.32, 0.78, 0.58)
        desk_zoom_crops = [self._crop_norm(f, zoom_box) for f in frame_list]

        pose_results = self._pose_model(frame_list, imgsz=480, conf=0.25, batch=16, verbose=False)
        det_results = self._det_model(frame_list, imgsz=480, conf=0.18, batch=16, verbose=False)
        zoom_det_results = self._det_model(desk_zoom_crops, imgsz=480, conf=0.15, batch=16, verbose=False)

        det_boxes_summary = []
        for idx_d, r_d in enumerate(det_results):
            f_dets = []
            for cls_id, conf, xyxy in zip(r_d.boxes.cls, r_d.boxes.conf, r_d.boxes.xyxyn):
                c_name = self._det_model.names[int(cls_id)]
                f_dets.append((c_name, float(conf), xyxy.cpu().numpy().tolist()))
            # Map zoomed desk detections back to normalized full-frame coordinates
            r_z = zoom_det_results[idx_d]
            zx1, zy1, zx2, zy2 = zoom_box
            zw, zh = zx2 - zx1, zy2 - zy1
            for cls_id, conf, xyxy in zip(r_z.boxes.cls, r_z.boxes.conf, r_z.boxes.xyxyn):
                c_name = self._det_model.names[int(cls_id)]
                bx = xyxy.cpu().numpy().tolist()
                mapped_bx = [zx1 + bx[0] * zw, zy1 + bx[1] * zh, zx1 + bx[2] * zw, zy1 + bx[3] * zh]
                f_dets.append((c_name, float(conf), mapped_bx))
            det_boxes_summary.append(f_dets)

        zones = self.calibrate_workspace(frame_list, det_boxes_summary)

        # Baseline safe door patch from t=0 to detect safe opening transitions
        gray_0 = cv2.cvtColor(frame_list[0], cv2.COLOR_BGR2GRAY)
        safe_door_box = (0.54, 0.35, 0.63, 0.42)
        safe_patch_0 = self._crop_norm(gray_0, safe_door_box).astype(np.float32)

        timeline: List[FrameSpatialState] = []
        sampled_frames: Dict[float, np.ndarray] = {}

        prev_gray = None
        for idx, (f_num, t_sec, frame) in enumerate(raw_frames):
            sampled_frames[round(t_sec, 1)] = frame
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

            if prev_gray is not None:
                diff = cv2.absdiff(gray, prev_gray)
            else:
                diff = np.zeros_like(gray)
            prev_gray = gray

            # 1. Room illumination check (for X-11 / X-12 light turn-off)
            room_brightness = float(np.mean(gray))
            room_dark = room_brightness < 95.0

            # 2. Extract and deduplicate persons from Pose model (filtering glass reflections)
            r_p = pose_results[idx]
            raw_persons: List[PersonState] = []
            if r_p.boxes is not None and len(r_p.boxes) > 0:
                boxes_norm = r_p.boxes.xyxyn.cpu().numpy()
                confs = r_p.boxes.conf.cpu().numpy()
                kpts_norm = r_p.keypoints.xyn.cpu().numpy() if r_p.keypoints is not None else None

                for p_i in range(len(boxes_norm)):
                    bx = boxes_norm[p_i].tolist()
                    conf = float(confs[p_i])
                    cx = 0.5 * (bx[0] + bx[2])
                    cy = 0.5 * (bx[1] + bx[3])
                    bw = bx[2] - bx[0]
                    bh = bx[3] - bx[1]

                    # Filter out reflection in upper-left glass panel (x < 0.25, y < 0.30)
                    if cx < 0.25 and cy < 0.30:
                        continue
                    if cx < 0.16 and cy < 0.38 and bh < 0.22:
                        continue
                    if cy < 0.22 and bh < 0.18:
                        continue
                    if conf < 0.30:
                        continue

                    lw, rw = None, None
                    if kpts_norm is not None and len(kpts_norm[p_i]) >= 11:
                        if kpts_norm[p_i][9][0] > 0 and kpts_norm[p_i][9][1] > 0:
                            lw = (float(kpts_norm[p_i][9][0]), float(kpts_norm[p_i][9][1]))
                        if kpts_norm[p_i][10][0] > 0 and kpts_norm[p_i][10][1] > 0:
                            rw = (float(kpts_norm[p_i][10][0]), float(kpts_norm[p_i][10][1]))

                    raw_persons.append(PersonState(bbox=bx, center=(cx, cy), conf=conf, left_wrist=lw, right_wrist=rw))

            persons = self._deduplicate_persons(raw_persons)

            # Assign spatial roles
            cashier_present = False
            cashier_at_door = False
            client_present = False
            client_leaving_door = False
            person_in_doorway = False
            third_party_present = len(persons) >= 3

            for p in persons:
                cx, cy = p.center
                in_doorway = (cy < 0.36 and 0.08 <= cx <= 0.44)
                if in_doorway:
                    person_in_doorway = True
                if len(persons) == 1:
                    p.role = "cashier"
                    if not in_doorway:
                        cashier_present = True
                    else:
                        cashier_at_door = True
                else:
                    if zones["layout"] == "A_right_laptop":
                        if cy >= 0.43:
                            p.role = "cashier"
                            cashier_present = True
                        else:
                            p.role = "client"
                            client_present = True
                            if in_doorway:
                                client_leaving_door = True
                    else:
                        # Layout B: cashier is near counter/chair (cy >= 0.37), client is across or at door
                        if cy >= 0.38 and not in_doorway:
                            if not cashier_present:
                                p.role = "cashier"
                                cashier_present = True
                            else:
                                p.role = "client"
                                client_present = True
                        else:
                            p.role = "client"
                            client_present = True
                            if in_doorway:
                                client_leaving_door = True

            # 3. Object Detection signals on/near desk
            cup_score = 0.0
            personal_bag_score = 0.0
            phone_detected = False

            for c_name, conf, bx in det_boxes_summary[idx]:
                cx = 0.5 * (bx[0] + bx[2])
                cy = 0.5 * (bx[1] + bx[3])
                bw = bx[2] - bx[0]
                bh = bx[3] - bx[1]
                on_or_near_desk = (0.14 <= cx <= 0.76 and 0.36 <= cy <= 0.56)
                if not on_or_near_desk:
                    continue
                if c_name in ("cup", "wine glass", "bottle", "bowl") and bw < 0.15:
                    cup_score = max(cup_score, conf)
                elif c_name in ("handbag", "backpack", "suitcase", "umbrella") and (0.16 <= cx <= 0.52 and 0.40 <= cy <= 0.54):
                    personal_bag_score = max(personal_bag_score, conf)
                elif c_name == "cell phone" and conf > 0.32:
                    phone_detected = True

            # 4. Precise Visual ROI Sensors
            # 4a. Center desk surface [x:0.32..0.49, y:0.44..0.50] for cash, inkassator bag, or unattended items
            center_desk_box = (0.32, 0.44, 0.49, 0.50)
            desk_hsv = self._crop_norm(hsv, center_desk_box)
            desk_gray = self._crop_norm(gray, center_desk_box)

            # Light/bright banknotes or paper on desk: low saturation S < 68, high value V > 180
            light_mask = ((desk_hsv[:, :, 1] < 68) & (desk_hsv[:, :, 2] > 180)).astype(np.uint8)
            cash_ratio = float(np.mean(light_mask))

            # Warm wooden desk surface is H in [8..24], S in [45..175], V in [95..205]
            wood_mask = (
                (desk_hsv[:, :, 0] >= 8) & (desk_hsv[:, :, 0] <= 24) &
                (desk_hsv[:, :, 1] >= 45) & (desk_hsv[:, :, 1] <= 175) &
                (desk_hsv[:, :, 2] >= 95) & (desk_hsv[:, :, 2] <= 205)
            ).astype(np.uint8)
            desk_non_wood_score = float(1.0 - np.mean(wood_mask))

            # Green Inkassator Bag mask: sage/olive green (H in [32..88], S in [22..150], V in [70..205])
            bag_desk_hsv = self._crop_norm(hsv, (0.28, 0.42, 0.52, 0.52))
            green_mask = (
                (bag_desk_hsv[:, :, 0] >= 32) & (bag_desk_hsv[:, :, 0] <= 88) &
                (bag_desk_hsv[:, :, 1] >= 22) & (bag_desk_hsv[:, :, 2] >= 70)
            ).astype(np.uint8)
            bag_ratio = float(np.mean(green_mask))

            # Left-center desk clutter score (for X-40 jacket + plaid handbag placed on desk in Layout B)
            left_desk_hsv = self._crop_norm(hsv, (0.20, 0.43, 0.42, 0.51))
            left_wood_mask = (
                (left_desk_hsv[:, :, 0] >= 8) & (left_desk_hsv[:, :, 0] <= 24) &
                (left_desk_hsv[:, :, 1] >= 45) & (left_desk_hsv[:, :, 1] <= 175)
            ).astype(np.uint8)
            left_desk_clutter_score = float(1.0 - np.mean(left_wood_mask))

            # 4b. Safe Door Open sensor at [x:0.54..0.63, y:0.35..0.42]
            sf_crop = self._crop_norm(gray, safe_door_box).astype(np.float32)
            # When the grey safe door swings open, the inner door panel at [0.54..0.63, 0.35..0.42] has mean brightness > 145
            safe_open_score = float(np.mean(sf_crop)) / 255.0
            safe_delta_score = float(np.mean(np.abs(sf_crop - safe_patch_0))) / 255.0

            # 4c. Laptop screen brightness & unlocked white window sensor
            # Right laptop screen in Layout A is at [x:0.56..0.66, y:0.38..0.45]
            lap_crop = self._crop_norm(gray, zones["laptop"])
            laptop_p95 = float(np.percentile(lap_crop, 95))
            laptop_white_score = float(np.mean(lap_crop > 200))
            laptop_on = (laptop_p95 > 195.0) or (laptop_white_score > 0.08)

            # 5. Motion energy & Hand proximity to equipment
            counter_motion = float(np.mean(self._crop_norm(diff, zones["counter"])))
            detector_motion = float(np.mean(self._crop_norm(diff, zones["detector"])))
            safe_motion = float(np.mean(self._crop_norm(diff, zones["safe"])))
            door_motion = float(np.mean(self._crop_norm(diff, zones["door"])))

            hand_near_counter = False
            hand_near_detector = False
            hand_near_safe = False
            hand_to_client = False

            for p in persons:
                for w_pt in (p.left_wrist, p.right_wrist):
                    if w_pt is None:
                        continue
                    wx, wy = w_pt
                    c_box = zones["counter"]
                    d_box = zones["detector"]
                    s_box = zones["safe"]
                    if (c_box[0] - 0.04 <= wx <= c_box[2] + 0.04) and (c_box[1] - 0.04 <= wy <= c_box[3] + 0.04):
                        hand_near_counter = True
                    if (d_box[0] - 0.04 <= wx <= d_box[2] + 0.04) and (d_box[1] - 0.04 <= wy <= d_box[3] + 0.04):
                        hand_near_detector = True
                    if (s_box[0] - 0.04 <= wx <= s_box[2] + 0.04) and (s_box[1] - 0.04 <= wy <= s_box[3] + 0.04):
                        hand_near_safe = True
                    if 0.25 <= wx <= 0.55 and 0.40 <= wy <= 0.50 and len(persons) >= 2:
                        hand_to_client = True

            timeline.append(
                FrameSpatialState(
                    frame_idx=f_num,
                    timestamp_sec=t_sec,
                    num_persons=len(persons),
                    cashier_present=cashier_present,
                    cashier_at_door=cashier_at_door,
                    client_present=client_present,
                    client_leaving_door=client_leaving_door,
                    person_in_doorway=person_in_doorway,
                    third_party_present=third_party_present,
                    safe_open=safe_open_score > 0.56,
                    safe_open_score=round(safe_open_score, 4),
                    safe_delta_score=round(safe_delta_score, 4),
                    cash_on_desk=cash_ratio > 0.015,
                    cash_score=round(cash_ratio, 4),
                    desk_non_wood_score=round(desk_non_wood_score, 4),
                    inkassator_bag_on_desk=bag_ratio > 0.055,
                    bag_score=round(bag_ratio, 4),
                    cup_on_desk=cup_score > 0.22,
                    cup_score=round(cup_score, 4),
                    personal_bag_on_desk=personal_bag_score > 0.22,
                    personal_bag_score=round(personal_bag_score, 4),
                    left_desk_clutter_score=round(left_desk_clutter_score, 4),
                    phone_detected=phone_detected,
                    laptop_screen_on=laptop_on,
                    laptop_white_score=round(laptop_white_score, 4),
                    laptop_p95_brightness=round(laptop_p95, 2),
                    room_dark=room_dark,
                    room_brightness=round(room_brightness, 2),
                    hand_near_counter=hand_near_counter,
                    hand_near_detector=hand_near_detector,
                    hand_near_safe=hand_near_safe,
                    hand_to_client_transfer=hand_to_client,
                    counter_motion_score=round(counter_motion, 3),
                    detector_motion_score=round(detector_motion, 3),
                    safe_motion_score=round(safe_motion, 3),
                    door_motion_score=round(door_motion, 3),
                    desk_foreign_object_score=round(max(cup_score, personal_bag_score), 4),
                    persons=persons,
                )
            )

        meta = {
            "fps": fps,
            "total_frames": total_frames,
            "width": width,
            "height": height,
            "original_duration_sec": round(orig_duration_sec, 2),
            "duration_sec": round(trim_end - trim_start, 2),
            "trim_start_sec": round(trim_start, 2),
            "trim_end_sec": round(trim_end, 2),
            "is_trimmed": is_trimmed,
            "zones": zones,
        }
        return timeline, sampled_frames, meta
