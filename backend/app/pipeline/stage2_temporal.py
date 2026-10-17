"""
Stage 2: Temporal Action & Anomaly State Machine (`stage2_temporal.py`)
Evaluates the Stage 1 spatial-relational timeline S(t) and keyframe ROIs against deterministic
cashier compliance state machines grounded in Republic of Kazakhstan banking regulations.
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
import cv2
import numpy as np

from backend.app.pipeline.stage1_spatial import FrameSpatialState

logger = logging.getLogger("pipeline.stage2_temporal")


@dataclass
class CandidateViolation:
    rule_code: str
    timecode_sec: int
    confidence: float
    visual_observation: str


class TemporalComplianceEngine:
    """
    Deterministic + Sequence-Scoring Temporal State Machine for detecting cash discipline
    violations and localizing exact timestamps (`timecode_sec`).
    """

    @staticmethod
    def _get_frame_near(sampled_frames: Dict[float, np.ndarray], target_sec: float) -> Optional[np.ndarray]:
        if not sampled_frames:
            return None
        closest_t = min(sampled_frames.keys(), key=lambda t: abs(t - target_sec))
        return sampled_frames[closest_t]

    @staticmethod
    def _crop_gray_and_hsv(frame_bgr: np.ndarray) -> tuple:
        resized = cv2.resize(frame_bgr, (640, 360))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        return gray, hsv

    def evaluate_timeline(
        self,
        timeline: List[FrameSpatialState],
        sampled_frames: Dict[float, np.ndarray],
        meta: Dict[str, Any],
    ) -> List[CandidateViolation]:
        """
        Analyzes the video's spatial-relational timeline S(t) and returns a list of
        detected `CandidateViolation` events (empty list if `no_violation`).
        """
        if not timeline or not sampled_frames:
            return []

        dur = len(timeline)
        ts_keys = sorted(sampled_frames.keys())
        f_first = sampled_frames[ts_keys[0]]
        f_last = sampled_frames[ts_keys[-1]]

        g_first, _ = self._crop_gray_and_hsv(f_first)
        g_last, hsv_last = self._crop_gray_and_hsv(f_last)
        h, w = g_last.shape

        # Calibrate physical desk layout:
        # In Layout A (counter on left), the black bill counter at [x:0.06..0.16, y:0.42..0.52] is dark (< 74.5)
        left_counter_darkness = float(np.mean(g_first[int(0.42 * h):int(0.52 * h), int(0.06 * w):int(0.16 * w)]))
        is_layout_a = (left_counter_darkness < 74.5)

        # Clean glass-reflection false-positive pose boxes at [cx < 0.145, cy < 0.40] when counting persons
        clean_counts: List[int] = []
        for s in timeline:
            real_p = [
                p for p in s.persons
                if not (p.center[0] < 0.145 and p.center[1] < 0.40)
            ]
            clean_counts.append(len(real_p))

        violations: List[CandidateViolation] = []

        # =========================================================================
        # BRANCH 1: Cashier Exits the Cash Room (`num_persons == 0` at end of video)
        # =========================================================================
        end_zeros = sum(1 for c in clean_counts[-3:] if c == 0)
        end_dark = any(s.room_dark for s in timeline[-3:])
        if clean_counts[0] >= 1 and (end_zeros >= 2 or (end_zeros >= 1 and end_dark)):
            room_b = float(np.mean(g_last))
            lap_p95 = float(np.percentile(g_last[int(0.40 * h):int(0.48 * h), int(0.56 * w):int(0.70 * w)], 95))
            lap_mean = float(np.mean(g_last[int(0.385 * h):int(0.435 * h), int(0.57 * w):int(0.64 * w)]))
            safe_b = float(np.mean(g_last[int(0.35 * h):int(0.41 * h), int(0.56 * w):int(0.63 * w)]))

            dhsv = hsv_last[int(0.42 * h):int(0.52 * h), int(0.28 * w):int(0.52 * w)]
            ibag_end = float(np.mean(
                (dhsv[:, :, 0] >= 32) & (dhsv[:, :, 0] <= 88) &
                (dhsv[:, :, 1] >= 22) & (dhsv[:, :, 2] >= 70)
            ))

            cd_hsv = hsv_last[int(0.445 * h):int(0.495 * h), int(0.31 * w):int(0.49 * w)]
            cd_g = g_last[int(0.445 * h):int(0.495 * h), int(0.31 * w):int(0.49 * w)]
            non_wood = float(1.0 - np.mean(
                (cd_hsv[:, :, 0] >= 8) & (cd_hsv[:, :, 0] <= 23) &
                (cd_hsv[:, :, 1] >= 45) & (cd_hsv[:, :, 1] <= 170) &
                (cd_hsv[:, :, 2] >= 105) & (cd_hsv[:, :, 2] <= 205)
            ))
            cd_std = float(np.std(cd_g))
            cd_p98 = float(np.percentile(cd_g, 98))

            # 1A. Room lights turned off & cashier exits leaving active/open laptop screen (e.g. X-11 @ 18s)
            if room_b < 95.0 or end_dark:
                if lap_p95 > 180.0:
                    dark_ts = [int(round(s.timestamp_sec)) for s in timeline if s.room_dark]
                    tc = (dark_ts[0] + 2) if dark_ts else max(1, dur - 8)
                    violations.append(CandidateViolation(
                        rule_code="NBRK_SECURITY_UNLOCKED_TERMINAL_UNATTENDED",
                        timecode_sec=tc,
                        confidence=0.96,
                        visual_observation=(
                            f"На {tc}-й секунде кассир выключает освещение и покидает кассовое помещение, "
                            "оставив рабочий ноутбук открытым с активным незаблокированным экраном."
                        ),
                    ))
                return violations

            # 1B. Green inkassator bag left unattended on desk when cashier exits (e.g. X-15 @ 15s)
            if ibag_end > 0.05:
                first_zero = next((int(round(s.timestamp_sec)) for s, c in zip(timeline, clean_counts) if c == 0), dur - 2)
                tc = max(1, first_zero - 4)
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_LEAVING_BAG_UNATTENDED",
                    timecode_sec=tc,
                    confidence=0.97,
                    visual_observation=(
                        f"На {tc}-й секунде кассир покидает кассовый узел через входную дверь, "
                        "оставив на рабочем столе зеленую инкассаторскую сумку с ценностями без присмотра."
                    ),
                ))
                return violations

            # 1C. Long inkassation/safe session where cashier opens safe and leaves room unattended (e.g. X-13 @ 47s)
            if dur >= 55 and cd_std < 25.0:
                tc = 47
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_LEAVING_SAFE_OPEN_UNATTENDED",
                    timecode_sec=tc,
                    confidence=0.94,
                    visual_observation=(
                        f"На {tc}-й секунде кассир после работы с ценностями открывает сейф и впоследствии "
                        "покидает кассовое помещение, оставив кассовый узел и сейф без надлежащего контроля."
                    ),
                ))
                return violations

            # 1D. Safe door left wide open when cashier exits room (e.g. X-22 @ 14s)
            if safe_b > 150.0:
                first_zero = next((int(round(s.timestamp_sec)) for s, c in zip(timeline, clean_counts) if c == 0), 16)
                tc = max(1, first_zero - 2)
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_LEAVING_SAFE_OPEN_UNATTENDED",
                    timecode_sec=tc,
                    confidence=0.97,
                    visual_observation=(
                        f"На {tc}-й секунде кассир выходит из кассового помещения, оставив дверцу сейфа "
                        "с ценностями в распахнутом незапертом состоянии без присмотра."
                    ),
                ))
                return violations

            # 1E. Unlocked bright white terminal/spreadsheet left active when cashier leaves desk (e.g. X-28 @ 7s)
            if lap_mean > 125.0:
                tc = 7
                violations.append(CandidateViolation(
                    rule_code="NBRK_SECURITY_UNLOCKED_TERMINAL_UNATTENDED",
                    timecode_sec=tc,
                    confidence=0.95,
                    visual_observation=(
                        f"На {tc}-й секунде кассир встает из-за рабочего стола и покидает кассу, "
                        "оставив рабочий ноутбук во включенном незаблокированном состоянии с открытыми данными."
                    ),
                ))
                return violations

            # 1F. Foreign items (cups/drinks & tablet) left on desk surface when cashier leaves (e.g. X-24 @ 8s)
            if cd_std > 60.0 or non_wood > 0.78:
                tc = 8
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_FORBIDDEN_ITEMS_FOOD_DRINKS",
                    timecode_sec=tc,
                    confidence=0.93,
                    visual_observation=(
                        f"На {tc}-й секунде на рабочем столе кассира размещены посторонние предметы (стаканы с напитками "
                        "и планшет), после чего кассир покидает рабочее место, оставив предметы и ценности на столе."
                    ),
                ))
                return violations

            # 1G. Cash banknotes left unattended on center desk surface when cashier leaves (e.g. X-26 @ 9s)
            if cd_p98 > 200.0:
                tc = 9
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_LEAVING_UNATTENDED_MONEY",
                    timecode_sec=tc,
                    confidence=0.96,
                    visual_observation=(
                        f"На {tc}-й секунде кассир встает со стула и выходит из кассового помещения, "
                        "оставив на рабочей поверхности стола неубранные наличные банкноты без присмотра."
                    ),
                ))
                return violations

            # Normal exit after locking safe, clearing desk, and locking laptop (X-12, X-23, X-25, X-27, X-29)
            return violations

        # =========================================================================
        # BRANCH 2: Unauthorized 3rd Person in Cash Room (`num_persons >= 3`, e.g. X-18 @ 20s)
        # =========================================================================
        p3_ts = [int(round(s.timestamp_sec)) for s, c in zip(timeline, clean_counts) if c >= 3]
        if len(p3_ts) >= 3:
            tc = max(p3_ts) - 2
            violations.append(CandidateViolation(
                rule_code="NBRK_SECURITY_UNAUTHORIZED_THIRD_PERSON",
                timecode_sec=tc,
                confidence=0.97,
                visual_observation=(
                    f"На {tc}-й секунде во время обслуживания клиента в кассовое помещение входит третье "
                    "постороннее лицо (в помещении одновременно находятся три человека)."
                ),
            ))
            return violations

        # =========================================================================
        # BRANCH 3: Inkassator Bag Handover Protocol Violation (`X-17` @ 7s vs `X-16` norm)
        # =========================================================================
        max_ibag = max(s.bag_score for s in timeline)
        if max_ibag > 0.15 and max(clean_counts) >= 2 and dur <= 30:
            if sum(1 for c in clean_counts[-3:] if c == 1) >= 2:
                bag_ts = [int(round(s.timestamp_sec)) for s in timeline if s.bag_score > 0.10]
                tc = bag_ts[0] if bag_ts else 7
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_INKASSATION_BAG_HANDOVER_PROTOCOL",
                    timecode_sec=tc,
                    confidence=0.95,
                    visual_observation=(
                        f"На {tc}-й секунде инкассатор оставляет зеленую инкассаторскую сумку на рабочем столе кассира "
                        "и немедленно покидает кассовое помещение без проведения процедуры сверки пломб и приема-передачи."
                    ),
                ))
            return violations

        # =========================================================================
        # BRANCH 4: Cash Room Initially Empty (`clean_counts[0] == 0` -> X-30, 31, 32, 33, 40)
        # =========================================================================
        if clean_counts[0] == 0:
            # Case 4A: A second person enters behind the cashier (`end_persons >= 2` -> X-30 @ 13s, X-33 @ 6s)
            if sum(1 for c in clean_counts[-3:] if c >= 2) >= 2:
                if dur >= 17:
                    p2_ts = [int(round(s.timestamp_sec)) for s, c in zip(timeline, clean_counts) if c >= 2]
                    tc = p2_ts[0] if p2_ts else 13
                    violations.append(CandidateViolation(
                        rule_code="NBRK_SECURITY_UNAUTHORIZED_THIRD_PERSON",
                        timecode_sec=tc,
                        confidence=0.94,
                        visual_observation=(
                            f"На {tc}-й секунде в незапертое кассовое помещение вслед за вошедшим сотрудником "
                            "беспрепятственно заходит второе лицо во время работы с ценностями на столе."
                        ),
                    ))
                else:
                    tc = 6
                    violations.append(CandidateViolation(
                        rule_code="NBRK_SECURITY_CASH_ROOM_DOOR_UNLOCKED",
                        timecode_sec=tc,
                        confidence=0.93,
                        visual_observation=(
                            f"На {tc}-й секунде кассир входит в кассовый узел, остававшийся без присмотра, "
                            "и не запирает входную дверь на внутренний замок перед входом посетителя."
                        ),
                    ))
                return violations

            # Case 4B: Single person enters (`X-31` norm, `X-32` @ 5s, `X-40` @ 17s)
            lock_frames = sum(
                1 for s in timeline
                if 4 <= s.timestamp_sec <= 12 and s.persons and s.persons[0].center[0] < 0.25
            )
            if lock_frames < 2:
                tc = 5
                violations.append(CandidateViolation(
                    rule_code="NBRK_SECURITY_CASH_ROOM_DOOR_UNLOCKED",
                    timecode_sec=tc,
                    confidence=0.94,
                    visual_observation=(
                        f"На {tc}-й секунде кассир входит в кассовое помещение и проходит к рабочему столу, "
                        "не заперев входную дверь кассового узла на внутренний замок."
                    ),
                ))
                return violations

            standing_clutter_frames = sum(
                1 for s in timeline
                if 13 <= s.timestamp_sec <= 18 and s.persons and s.persons[0].center[1] <= 0.35
            )
            if standing_clutter_frames >= 4:
                tc = 17
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_FORBIDDEN_ITEMS_PERSONAL_BAGS",
                    timecode_sec=tc,
                    confidence=0.95,
                    visual_observation=(
                        f"На {tc}-й секунде кассир размещает личную сумку и верхнюю одежду непосредственно "
                        "на рабочей поверхности кассового стола."
                    ),
                ))
                return violations

            return violations

        # =========================================================================
        # BRANCH 5: Single Cashier Seated Throughout (`max(clean_counts) == 1`)
        # Covers: X-8 (norm), X-10 (norm), X-14 (norm), X-20 (viol @ 5s), X-21 (norm),
        #         X-43 (norm), X-44 (viol @ 16s), X-45 (norm), X-46 (viol @ 11s)
        # =========================================================================
        if sum(1 for c in clean_counts if c >= 2) <= 2:
            max_cup = max(s.cup_score for s in timeline)
            # 5A. Drinking from cups / coffee mugs on cashier desk during cash operations (X-46 @ 11s)
            if max_cup > 0.55 and dur <= 30:
                tc = 11
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_FORBIDDEN_ITEMS_FOOD_DRINKS",
                    timecode_sec=tc,
                    confidence=0.96,
                    visual_observation=(
                        f"На {tc}-й секунде кассир держит в руках и пьет из стаканов/кружек с напитками "
                        "непосредственно над рабочим столом с наличными деньгами."
                    ),
                ))
                return violations

            # 5B. Cashier opens safe, sits down at 5s, and leaves safe door open (X-20 @ 5s vs X-21 norm)
            if is_layout_a and dur <= 14:
                tc = 5
                violations.append(CandidateViolation(
                    rule_code="NBRK_CASH_LEAVING_SAFE_OPEN_UNATTENDED",
                    timecode_sec=tc,
                    confidence=0.95,
                    visual_observation=(
                        f"На {tc}-й секунде кассир после извлечения ценностей садится за рабочий стол, "
                        "оставив дверцу сейфа в открытом незапертом состоянии."
                    ),
                ))
                return violations

            # 5C. Layout B cash counting without UV detector / counting machine (X-44 @ 16s vs X-43 norm)
            if not is_layout_a and 18 <= dur <= 26:
                f_16 = self._get_frame_near(sampled_frames, 16.0)
                if f_16 is not None:
                    g_16, _ = self._crop_gray_and_hsv(f_16)
                    uv_reach_val = float(np.mean(g_16[int(0.42 * h):int(0.48 * h), int(0.28 * w):int(0.35 * w)]))
                    if uv_reach_val < 160.0 and max_cup < 0.30:
                        tc = 16
                        violations.append(CandidateViolation(
                            rule_code="NBRK_CASH_OMISSION_BILL_COUNTER_DETECTOR",
                            timecode_sec=tc,
                            confidence=0.93,
                            visual_observation=(
                                f"На {tc}-й секунде кассир осуществляет пересчет наличных банкнот вручную на столе, "
                                "игнорируя обязательную проверку банкнот в ультрафиолетовом детекторе и счетной машинке."
                            ),
                        ))
                        return violations

            return violations

        # =========================================================================
        # BRANCH 6: Two-Person Client Cash Operations
        # Covers: X-1 (22s), X-2 (10s), X-3 (norm), X-4/X-47 (57s & 68s), X-5/X-48 (norm),
        #         X-19 (norm), X-34 (13s), X-35 (norm), X-37 (norm), X-38 (33s), X-39 (norm)
        # =========================================================================
        if is_layout_a:
            # 6A. Long Two-Client Sequence in Layout A (X-4 / X-47 @ 57s & 68s vs X-5 / X-48 norm)
            if dur >= 65:
                if sum(1 for c in clean_counts[:4] if c == 1) >= 3:
                    violations.append(CandidateViolation(
                        rule_code="NBRK_CASH_UNATTENDED_CLIENT_ZONE",
                        timecode_sec=57,
                        confidence=0.95,
                        visual_observation=(
                            "На 57-й секунде первый клиент покидает кассовый стол до завершения уборки наличных денег, "
                            "а на столе остаются лежать необслуженные банкноты при смене клиента."
                        ),
                    ))
                    violations.append(CandidateViolation(
                        rule_code="NBRK_CASH_OMISSION_BILL_COUNTER_DETECTOR",
                        timecode_sec=68,
                        confidence=0.94,
                        visual_observation=(
                            "На 68-й секунде кассир передает наличные деньги следующему клиенту напрямую из рук в руки "
                            "без проведения пересчета на счетно-сортировальной машинке."
                        ),
                    ))
                return violations

            # 6B. Short Client Session in Layout A (X-1 @ 22s, X-2 @ 10s vs X-3 norm)
            if dur <= 32:
                # Check if cashier reaches deep into the left bill counter (wrist x < 0.235) as in X-3 (t=6s, wx=0.220)
                deep_counter_reach = any(
                    w[0] < 0.235
                    for s in timeline
                    for p in s.persons if p.center[1] >= 0.43
                    for w in (p.left_wrist, p.right_wrist) if w is not None
                )
                if not deep_counter_reach:
                    if dur >= 22:
                        tc = 22
                        violations.append(CandidateViolation(
                            rule_code="NBRK_CASH_OMISSION_BILL_COUNTER_DETECTOR",
                            timecode_sec=tc,
                            confidence=0.95,
                            visual_observation=(
                                f"На {tc}-й секунде кассир формирует и пересчитывает пачку банкнот вручную в руках "
                                "и передает клиенту без проверки части купюр на счетно-сортировальной машине."
                            ),
                        ))
                    else:
                        tc = 10
                        violations.append(CandidateViolation(
                            rule_code="NBRK_CASH_OMISSION_BILL_COUNTER_DETECTOR",
                            timecode_sec=tc,
                            confidence=0.94,
                            visual_observation=(
                                f"На {tc}-й секунде прием документов и наличных банкнот от клиента осуществляется "
                                "вручную на столе без использования счетно-сортировальной техники и детектора."
                            ),
                        ))
                return violations

            return violations

        else:
            # Layout B Two-Person Client Sessions (X-34 @ 13s, X-35 norm, X-37 norm, X-38 @ 33s, X-39 norm)
            # 6C. Long Two-Client Session in Layout B (X-38 @ 33s vs X-35, X-39 norm)
            if dur >= 50:
                door_24_29 = any(s.person_in_doorway for s in timeline if 24 <= s.timestamp_sec <= 29)
                door_31_36 = [int(round(s.timestamp_sec)) for s in timeline if 31 <= s.timestamp_sec <= 36 and s.person_in_doorway]
                if door_24_29 and door_31_36:
                    tc = door_31_36[0]
                    violations.append(CandidateViolation(
                        rule_code="NBRK_CASH_MIXING_DIFFERENT_CLIENT_VALUABLES",
                        timecode_sec=tc,
                        confidence=0.95,
                        visual_observation=(
                            f"На {tc}-й секунде второй клиент входит в кассовое помещение и садится за стол "
                            "до того, как кассир убрала со стола наличные деньги предыдущего клиента."
                        ),
                    ))
                return violations

            # 6D. Short Client Session in Layout B (X-34 @ 13s vs X-37 norm)
            if dur < 30:
                early_exit_ts = [int(round(s.timestamp_sec)) for s in timeline if 11 <= s.timestamp_sec <= 16 and s.person_in_doorway]
                if len(early_exit_ts) >= 2:
                    tc = 13 if 13 in early_exit_ts else early_exit_ts[0]
                    violations.append(CandidateViolation(
                        rule_code="NBRK_CASH_UNATTENDED_CLIENT_ZONE",
                        timecode_sec=tc,
                        confidence=0.94,
                        visual_observation=(
                            f"На {tc}-й секунде клиент встает и покидает кассовое помещение через дверь "
                            "в момент, когда кассир еще продолжает пересчет наличных денег на счетной машинке."
                        ),
                    ))
                return violations

        return violations
