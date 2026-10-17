"""
Database Repository Layer (`backend/app/db/repository.py`)
Persists video analysis jobs, granular detected violations, and RK banking regulations
in PostgreSQL (`fortebank_compliance`) with an in-memory mirror for ultra-low-latency polling.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor, Json

from backend.app.config import settings

logger = logging.getLogger("backend.db.repository")


class ComplianceRepository:
    """
    Manages PostgreSQL persistence for `analysis_jobs`, `detected_violations`,
    and `rk_banking_regulations`.
    """

    def __init__(self):
        self._memory_jobs: Dict[str, Dict[str, Any]] = {}

    def _get_conn(self):
        return psycopg2.connect(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            dbname=settings.POSTGRES_DB,
            connect_timeout=3,
        )

    def create_job(
        self,
        job_id: str,
        filename: str,
        file_path: str,
        trim_interval: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        initial_record = {
            "job_id": job_id,
            "filename": filename,
            "file_path": file_path,
            "status": "processing",
            "verdict": None,
            "violations": [],
            "error_message": None,
            "processing_time_sec": None,
            "trim_interval": trim_interval,
            "created_at": now_iso,
            "completed_at": None,
        }
        self._memory_jobs[job_id] = initial_record

        try:
            conn = self._get_conn()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO analysis_jobs (job_id, filename, file_path, status, result_json)
                        VALUES (%s, %s, %s, 'processing', %s)
                        ON CONFLICT (job_id) DO UPDATE
                        SET status = 'processing', filename = EXCLUDED.filename, file_path = EXCLUDED.file_path;
                        """,
                        (job_id, filename, file_path, Json(initial_record)),
                    )
            conn.close()
        except Exception as e:
            logger.warning(f"PostgreSQL create_job warning ({e}); job {job_id} tracked in memory.")

        return initial_record

    def complete_job(self, job_id: str, pipeline_result: Dict[str, Any]) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = self._memory_jobs.get(job_id, {})
        record = {
            **existing,
            **pipeline_result,
            "job_id": job_id,
            "status": pipeline_result.get("status", "done"),
            "completed_at": now_iso,
        }
        self._memory_jobs[job_id] = record

        try:
            conn = self._get_conn()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE analysis_jobs
                        SET status = %s,
                            verdict = %s,
                            processing_time_sec = %s,
                            error_message = %s,
                            result_json = %s,
                            completed_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s;
                        """,
                        (
                            record["status"],
                            record.get("verdict"),
                            record.get("processing_time_sec"),
                            record.get("error_message"),
                            Json(record),
                            job_id,
                        ),
                    )
                    # Insert granular violations into detected_violations table
                    for v in record.get("violations", []):
                        ev_list = v.get("evidence_frames") or []
                        first_b64 = None
                        if ev_list:
                            first_item = ev_list[0]
                            first_b64 = first_item.get("image_base64") if isinstance(first_item, dict) else str(first_item)
                        cur.execute(
                            """
                            INSERT INTO detected_violations (
                                job_id, violation_type, timecode_sec, description, rule_code, evidence_frame_base64
                            ) VALUES (%s, %s, %s, %s, %s, %s);
                            """,
                            (
                                job_id,
                                v.get("type", ""),
                                float(v.get("timecode_sec", 0.0)),
                                v.get("description", ""),
                                v.get("rule_code"),
                                first_b64,
                            ),
                        )
            conn.close()
        except Exception as e:
            logger.warning(f"PostgreSQL complete_job warning ({e}); job {job_id} stored in memory.")

    def fail_job(self, job_id: str, error_message: str) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = self._memory_jobs.get(job_id, {"job_id": job_id})
        existing.update({
            "status": "failed",
            "verdict": None,
            "violations": [],
            "error_message": error_message,
            "completed_at": now_iso,
        })
        self._memory_jobs[job_id] = existing

        try:
            conn = self._get_conn()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE analysis_jobs
                        SET status = 'failed',
                            error_message = %s,
                            result_json = %s,
                            completed_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s;
                        """,
                        (error_message, Json(existing), job_id),
                    )
            conn.close()
        except Exception as e:
            logger.warning(f"PostgreSQL fail_job warning ({e}).")

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        if job_id in self._memory_jobs:
            return self._memory_jobs[job_id]

        try:
            conn = self._get_conn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT job_id, filename, file_path, status, verdict, processing_time_sec, error_message, result_json, created_at, completed_at FROM analysis_jobs WHERE job_id = %s;",
                    (job_id,),
                )
                row = cur.fetchone()
            conn.close()
            if row:
                res_json = row.get("result_json") or {}
                if isinstance(res_json, str):
                    res_json = json.loads(res_json)
                merged = {
                    "job_id": row["job_id"],
                    "filename": row["filename"],
                    "file_path": row["file_path"],
                    "status": row["status"],
                    "verdict": row["verdict"],
                    "processing_time_sec": row["processing_time_sec"],
                    "error_message": row["error_message"],
                    "violations": res_json.get("violations", []),
                    "video_metadata": res_json.get("video_metadata"),
                    "trim_interval": res_json.get("trim_interval"),
                    "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                    "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
                }
                self._memory_jobs[job_id] = merged
                return merged
        except Exception as e:
            logger.warning(f"PostgreSQL get_job warning ({e}).")
        return None

    def list_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            conn = self._get_conn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT job_id, filename, status, verdict, processing_time_sec, error_message, result_json, created_at, completed_at
                    FROM analysis_jobs
                    ORDER BY created_at DESC
                    LIMIT %s;
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
            conn.close()
            items = []
            for r in rows:
                rj = r.get("result_json") or {}
                if isinstance(rj, str):
                    rj = json.loads(rj)
                viols = rj.get("violations", [])
                items.append({
                    "job_id": r["job_id"],
                    "filename": r["filename"],
                    "status": r["status"],
                    "verdict": r["verdict"],
                    "violations_count": len(viols),
                    "processing_time_sec": r["processing_time_sec"],
                    "video_metadata": rj.get("video_metadata"),
                    "trim_interval": rj.get("trim_interval"),
                    "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                    "completed_at": r["completed_at"].isoformat() if r.get("completed_at") else None,
                })
            return items
        except Exception as e:
            logger.warning(f"PostgreSQL list_jobs warning ({e}); returning memory jobs.")
            return [
                {
                    "job_id": j["job_id"],
                    "filename": j.get("filename"),
                    "status": j.get("status"),
                    "verdict": j.get("verdict"),
                    "violations_count": len(j.get("violations", [])),
                    "processing_time_sec": j.get("processing_time_sec"),
                    "video_metadata": j.get("video_metadata"),
                    "trim_interval": j.get("trim_interval"),
                    "created_at": j.get("created_at"),
                    "completed_at": j.get("completed_at"),
                }
                for j in list(self._memory_jobs.values())[-limit:]
            ]

    def list_regulations(self) -> List[Dict[str, Any]]:
        try:
            conn = self._get_conn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, rule_code, violation_type, doc_title, clause_ref, adilet_url, normative_text, visual_pattern
                    FROM rk_banking_regulations
                    ORDER BY id ASC;
                    """
                )
                rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            if rows:
                return rows
        except Exception as e:
            logger.warning(f"PostgreSQL list_regulations warning ({e}); using local JSON.")

        json_path = settings.MODELS_DIR.parent / "backend" / "app" / "data" / "rk_regulations.json"
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def check_db_health(self) -> Dict[str, Any]:
        try:
            conn = self._get_conn()
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM rk_banking_regulations;")
                reg_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM analysis_jobs;")
                job_count = cur.fetchone()[0]
            conn.close()
            return {"connected": True, "regulations_seeded": reg_count, "jobs_recorded": job_count}
        except Exception as e:
            return {"connected": False, "error": str(e)}


repository = ComplianceRepository()
