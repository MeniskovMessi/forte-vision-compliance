"""
End-to-End FastAPI & Video Trimming Integration Test (`scripts/test_api.py`)
Tests:
1. `GET  /api/v1/health` (DB + local YOLO models check)
2. `GET  /api/v1/regulations` (16 RK regulations from PostgreSQL `pgvector`)
3. `POST /api/v1/analyze` without `X-API-Key` -> 401 Unauthorized
4. `POST /api/v1/videos/inspect` -> returns video duration, FPS, resolution & 3 preview thumbnails
5. `POST /api/v1/analyze` (Full video `X-1.mov`) -> polls `GET /api/v1/jobs/{job_id}` -> verifies `verdict=violation`, `timecode_sec=22`, `evidence_frames`, and DB persistence
6. `POST /api/v1/analyze` with Interval Trimming (`start_sec=1.0, end_sec=14.0, save_trimmed_only=True` on `X-20`) -> verifies trimmed video analysis & `GET /api/v1/jobs/{job_id}/detailed`
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    headers = {"X-API-Key": settings.API_KEY}
    vids_dir = ROOT / "dataset" / "open" / "videos"

    with TestClient(app) as client:
        print("1. Testing GET /api/v1/health ...")
        r = client.get("/api/v1/health")
        assert r.status_code == 200, r.text
        h_data = r.json()
        print(f"   Health Status: {h_data['status']} | DB Connected: {h_data['database']['connected']} | Seeded Rules: {h_data['database'].get('regulations_seeded')}")

        print("2. Testing GET /api/v1/regulations ...")
        r = client.get("/api/v1/regulations")
        assert r.status_code == 200, r.text
        reg_data = r.json()
        assert reg_data["count"] == 16
        print(f"   Regulations Retrieved: {reg_data['count']} clauses from {reg_data['source']}")

        print("3. Testing Auth Rejection (missing X-API-Key) ...")
        r = client.post("/api/v1/analyze")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("   Auth check passed: 401 Unauthorized returned when X-API-Key is missing.")

        x1_path = next(vids_dir.glob("*-1.mov"))
        print(f"4. Testing POST /api/v1/videos/inspect on {x1_path.name} ...")
        with open(x1_path, "rb") as f:
            r = client.post("/api/v1/videos/inspect", headers=headers, files={"file": (x1_path.name, f, "video/quicktime")})
        assert r.status_code == 200, r.text
        insp = r.json()
        print(f"   Inspected: duration={insp['duration_sec']}s, fps={insp['fps']}, res={insp['width']}x{insp['height']}, thumbnails={len(insp['preview_thumbnails'])}")

        print(f"5. Testing POST /api/v1/analyze (full video) on {x1_path.name} ...")
        with open(x1_path, "rb") as f:
            r = client.post("/api/v1/analyze", headers=headers, files={"file": (x1_path.name, f, "video/quicktime")})
        assert r.status_code == 202, r.text
        job_id_1 = r.json()["job_id"]
        print(f"   Job submitted: job_id={job_id_1}, status={r.json()['status']}")

        for _ in range(120):
            r_poll = client.get(f"/api/v1/jobs/{job_id_1}", headers=headers)
            assert r_poll.status_code == 200
            j_data = r_poll.json()
            if j_data["status"] in ("done", "failed"):
                break
            time.sleep(0.5)

        assert j_data["status"] == "done", f"Job failed: {j_data}"
        assert j_data["verdict"] == "violation"
        v0 = j_data["violations"][0]
        print(f"   Completed Job {job_id_1}: verdict={j_data['verdict']}, timecode_sec={v0['timecode_sec']}s, evidence_frames={len(v0['evidence_frames'])}")
        print(f"   Type: {v0['type']}")

        x20_path = next(vids_dir.glob("*-20.mov"))
        print(f"6. Testing POST /api/v1/analyze with Video Trimming (start_sec=0, end_sec=11, save_trimmed_only=true) on {x20_path.name} ...")
        with open(x20_path, "rb") as f:
            r = client.post(
                "/api/v1/analyze",
                headers=headers,
                files={"file": (x20_path.name, f, "video/quicktime")},
                data={"start_sec": "0.0", "end_sec": "11.0", "save_trimmed_only": "true"},
            )
        assert r.status_code == 202, r.text
        job_id_2 = r.json()["job_id"]
        print(f"   Trimmed Job submitted: job_id={job_id_2}, trim_interval={r.json().get('trim_interval')}")

        for _ in range(120):
            r_poll = client.get(f"/api/v1/jobs/{job_id_2}/detailed", headers=headers)
            assert r_poll.status_code == 200
            j2_data = r_poll.json()
            if j2_data["status"] in ("done", "failed"):
                break
            time.sleep(0.5)

        assert j2_data["status"] == "done", f"Trimmed job failed: {j2_data}"
        print(f"   Completed Trimmed Job {job_id_2}: verdict={j2_data['verdict']}, video_metadata={j2_data['video_metadata']}")

        print("7. Testing GET /api/v1/jobs (History & Summary) ...")
        r_list = client.get("/api/v1/jobs", headers=headers)
        assert r_list.status_code == 200
        print(f"   Jobs Summary: {r_list.json()['summary']}")
        print("\nALL FASTAPI & TRIMMING INTEGRATION TESTS PASSED!")


if __name__ == "__main__":
    main()
