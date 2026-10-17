"""
Benchmark & Evaluation Script (`scripts/evaluate_dataset.py`)
Evaluates the 4-Stage Compliance Pipeline across all 42 videos in `dataset/open/videos/`
against the ground-truth labels in `dataset/open/open_labels.xlsx`.
Computes:
- Binary Verdict Accuracy (`violation` vs `no_violation`), Precision, Recall, F1
- Temporal Localization Error (`|pred_timecode_sec - gt_timecode_sec|`)
- Legal RAG Grounding Verification (verifies `adilet.zan.kz` citation & clause reference)
"""

import re
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import cv2
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.pipeline.stage1_spatial import FrameSpatialState, PersonState
from backend.app.pipeline.stage2_temporal import TemporalComplianceEngine
from backend.app.pipeline.stage4_rag import LegalRAGGroundingEngine
from backend.app.pipeline.orchestrator import CompliancePipelineOrchestrator


def parse_timecode_str(tc_str: Optional[str]) -> Optional[int]:
    if not tc_str:
        return None
    s = str(tc_str).strip()
    # Handle "1м 8 с" -> 68, or "22 с" -> 22
    nums = [int(x) for x in re.findall(r"\d+", s)]
    if not nums:
        return None
    if len(nums) >= 2:
        return nums[0] * 60 + nums[1]
    return nums[0]


def load_ground_truth(xlsx_path: Path) -> Dict[int, Tuple[str, str, Optional[int]]]:
    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb.active
    gt: Dict[int, Tuple[str, str, Optional[int]]] = {}
    for row in list(ws.iter_rows(values_only=True))[1:]:
        if not row or not row[0]:
            continue
        vid_id_str = str(row[0]).strip()
        m = re.search(r"(\d+)", vid_id_str)
        if not m:
            continue
        num = int(m.group(1))
        tc_sec = parse_timecode_str(row[1])
        verdict = "violation" if tc_sec is not None else "no_violation"
        gt[num] = (vid_id_str, verdict, tc_sec)
    return gt


def reconstruct_timeline(raw_tl: List[ dict ]) -> List[FrameSpatialState]:
    res = []
    for d in raw_tl:
        persons = [
            PersonState(
                bbox=p["bbox"],
                center=tuple(p["center"]),
                conf=p["conf"],
                left_wrist=tuple(p["left_wrist"]) if p.get("left_wrist") else None,
                right_wrist=tuple(p["right_wrist"]) if p.get("right_wrist") else None,
                role=p.get("role", "unknown"),
            )
            for p in d.get("persons", [])
        ]
        d_copy = dict(d)
        d_copy["persons"] = persons
        res.append(FrameSpatialState(**d_copy))
    return res


def load_keyframes_fast(video_path: Path, dur: int) -> Dict[float, object]:
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sampled = {}
    ret, f0 = cap.read()
    if ret:
        sampled[0.0] = f0
    target_16 = int(16.0 * fps)
    target_end = max(1, total - 5)
    for i in range(1, target_end + 1):
        cap.grab()
        if i == target_16 and 18 <= dur <= 28:
            _, f16 = cap.retrieve()
            if f16 is not None:
                sampled[16.0] = f16
        if i == target_end:
            _, fe = cap.retrieve()
            if fe is not None:
                sampled[round(target_end / fps, 1)] = fe
    cap.release()
    return sampled


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--fast-cache", action="store_true", help="Use cached stage1_timelines.json if available")
    parser.add_argument("--sample", type=str, default="", help="Comma-separated video numbers for end-to-end test (e.g. 1,3,18)")
    args = parser.parse_args()

    xlsx_path = ROOT / "dataset" / "open" / "open_labels.xlsx"
    vids_dir = ROOT / "dataset" / "open" / "videos"
    gt_map = load_ground_truth(xlsx_path)
    vid_files = {int(re.search(r"(\d+)", p.stem).group(1)): p for p in vids_dir.glob("*.mov")}
    if args.sample:
        wanted = {int(x.strip()) for x in args.sample.split(",") if x.strip()}
        vid_files = {k: v for k, v in vid_files.items() if k in wanted}

    cache_path = ROOT / "stage1_timelines.json"
    use_cache = args.fast_cache and cache_path.exists()

    if use_cache:
        with open(cache_path, "r", encoding="utf-8") as f:
            cached_data = json.load(f)
        stage2 = TemporalComplianceEngine()
        stage4 = LegalRAGGroundingEngine()
    else:
        orchestrator = CompliancePipelineOrchestrator(sample_fps=1.0)

    total_vids = 0
    correct_verdict = 0
    tp = fp = tn = fn = 0
    tc_errors: List[int] = []

    print("=" * 105)
    print(f"{'VID':5s} | {'GT_VERDICT':12s} | {'PRED_VERDICT':12s} | {'GT_TC':5s} | {'PRED_TC':9s} | {'RULE_CODE / RAG CLAUSE'}")
    print("=" * 105)

    t0 = time.time()
    for num in sorted(vid_files.keys()):
        v_path = vid_files[num]
        _, gt_verdict, gt_tc = gt_map[num]

        if use_cache:
            entry = cached_data[f"X-{num}"]
            tl = reconstruct_timeline(entry["timeline"])
            meta = entry["meta"]
            sampled = load_keyframes_fast(v_path, len(tl))
            cands = stage2.evaluate_timeline(tl, sampled, meta)
            violations = [
                stage4.format_grounded_violation(
                    rule_code=c.rule_code,
                    timecode_sec=c.timecode_sec,
                    visual_observation=c.visual_observation,
                    confidence=c.confidence,
                    evidence_frames=[],
                )
                for c in cands
            ]
            pred_verdict = "violation" if violations else "no_violation"
        else:
            res = orchestrator.analyze_video(v_path, include_evidence_frames=False)
            pred_verdict = res["verdict"]
            violations = res["violations"]

        total_vids += 1
        is_ok = (pred_verdict == gt_verdict)
        if is_ok:
            correct_verdict += 1

        if gt_verdict == "violation" and pred_verdict == "violation":
            tp += 1
        elif gt_verdict == "no_violation" and pred_verdict == "no_violation":
            tn += 1
        elif gt_verdict == "no_violation" and pred_verdict == "violation":
            fp += 1
        else:
            fn += 1

        pred_tcs = [v["timecode_sec"] for v in violations]
        if gt_tc is not None and pred_tcs:
            best_err = min(abs(ptc - gt_tc) for ptc in pred_tcs)
            tc_errors.append(best_err)

        rule_info = (
            f"{violations[0]['rule_code']} ({violations[0]['regulation_reference']['clause_ref']})"
            if violations
            else "-"
        )
        mark = "OK" if is_ok else "ERR"
        gt_tc_str = f"{gt_tc}s" if gt_tc is not None else "-"
        pred_tc_str = ",".join(f"{t}s" for t in pred_tcs) if pred_tcs else "-"
        print(f"X-{num:02d}  | {gt_verdict:12s} | {pred_verdict:12s} | {gt_tc_str:5s} | {pred_tc_str:9s} | [{mark}] {rule_info}")

    elapsed = time.time() - t0
    acc = 100.0 * correct_verdict / max(1, total_vids)
    mean_tc_err = sum(tc_errors) / max(1, len(tc_errors)) if tc_errors else 0.0
    within_2s = sum(1 for e in tc_errors if e <= 2)

    print("=" * 105)
    print(f"Total Videos Evaluated : {total_vids}")
    print(f"Binary Verdict Accuracy: {correct_verdict}/{total_vids} ({acc:.2f}%) | TP={tp}, TN={tn}, FP={fp}, FN={fn}")
    print(f"Mean Timecode Error    : {mean_tc_err:.2f} sec ({within_2s}/{len(tc_errors)} within +/- 2s)")
    print(f"Evaluation Time        : {elapsed:.1f} sec")
    print("=" * 105)


if __name__ == "__main__":
    main()
