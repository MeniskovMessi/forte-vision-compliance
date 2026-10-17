# ForteBank Vision Compliance — Backend & Pipeline Features (`features.md`)

This document details all features implemented in the **Backend (`backend/`)**, **AI Compliance Pipeline (`backend/app/pipeline/`)**, **PostgreSQL + `pgvector` Database (`backend/app/db/`)**, and **Automation Scripts (`scripts/`)**.

---

## 1. Core AI Compliance Pipeline Features (`backend/app/pipeline/`)

### 1.1. 100% Local, Offline-Capable Execution (Rule 2 Compliance)
- Runs completely locally using cached weights in `./models/` (`yolo11n-pose.pt`, `yolo11n.pt`, and `intfloat/multilingual-e5-small`).
- Zero calls to external cloud APIs (`OpenAI`, `Gemini`, `Claude`, or cloud vision services).

### 1.2. Privacy-Preserving Visual Analysis (Rule 3 Compliance)
- Zero facial recognition or biometric person identification.
- Tracks participants strictly by bounding box trajectories, body pose keypoints (`left_wrist`, `right_wrist`), and spatial workspace roles (`cashier`, `client`, `third_party`).

### 1.3. Dynamic Camera & Desk Layout Auto-Calibration (`stage1_spatial.py`)
- Automatically calibrates workspace zones (`desk`, `door`, `safe`, `counter`, `detector`, `laptop`, `desk_surface`).
- Automatically distinguishes **Layout A** (bill counter on left, laptop on right) and **Layout B** (laptop on left, bill counter & UV detector on right).
- Eliminates upper-left glass partition reflections and deduplicates overlapping torso/full-body pose detections.
- Runs 3x zoomed desk-crop object detection (`[x:0.12..0.78, y:0.32..0.58]`) to catch small desk objects (`cup`, `handbag`, `suitcase`, `cell phone`) with high recall.

### 1.4. Six-Branch Temporal Compliance State Machine (`stage2_temporal.py`)
Evaluates the per-second `FrameSpatialState` timeline $S(t)$ across 6 behavioral categories:
1. **Unattended Cash Room Exit:** Detects leaving an unlocked/open laptop (`Х-11`, `Х-28`), an open safe door (`Х-13`, `Х-22`), an inkassator cash bag (`Х-15`), foreign objects/cups (`Х-24`), or cash banknotes (`Х-26`) when the cashier exits the room (`num_persons == 0`), while ignoring normal exits where all valuables are locked in the safe (`Х-12`, `Х-23`, `Х-25`, `Х-27`, `Х-29`).
2. **Unauthorized Third-Party Intrusion:** Detects a 3rd person entering the cash room during active client service (`Х-18`).
3. **Inkassator Bag Handover Protocol:** Detects an inkassator dropping a cash bag and leaving without joint seal verification (`Х-17` vs `Х-16`).
4. **Unattended Cash Room Entry & Door Locking Discipline:** Detects entering an unattended cash room without locking the door (`Х-30`, `Х-32`, `Х-33` vs `Х-31`) or placing outerwear and personal handbags on the desk (`Х-40`).
5. **Single-Cashier Workspace & Equipment Discipline:** Detects drinking from cups/mugs over cash (`Х-46`), leaving the safe door open while seated at the desk (`Х-20` vs `Х-21`), and counting cash manually without using the UV detector or bill counter (`Х-44` vs `Х-43`).
6. **Two-Person Client Cash Operations:** Detects client walk-out while cash remains on the desk (`Х-4`, `Х-34`, `Х-47`), manual cash handover bypassing the bill counter (`X-1`, `X-2`, `Х-47` vs `Х-3`, `Х-5`), and a second client entering before the previous client's cash is cleared (`Х-38` vs `Х-39`).

### 1.5. Evidence Frame Extraction & Optional Local VLM Verification (`stage3_vlm.py`)
- Automatically extracts 1–3 crisp base64-encoded JPEG evidence frames (`t - 1s`, `t`, `t + 1s`) around each detected violation (`[{"timestamp_sec": ..., "image_base64": "..."}]`).
- Supports optional local Ollama VLM (`qwen2.5vl:3b` on `localhost:11434`) with instant deterministic fallback.

### 1.6. Hybrid PostgreSQL + `pgvector` Legal RAG Grounding (`stage4_rag.py`)
- Queries the `rk_banking_regulations` table in PostgreSQL (`fortebank_compliance`) using `intfloat/multilingual-e5-small` (384-d cosine similarity `1 - (embedding <=> query_vec)`) + `rule_code` anchor boost.
- Grounds every violation in official **National Bank of the Republic of Kazakhstan (NBRK)** regulations with the exact document title, `Глава/Раздел, пункт`, normative text quote, and direct `adilet.zan.kz` URL.

---

## 2. CCTV Video Trimming & Time-Interval Slicing Feature

Because real-world bank CCTV systems often export multi-hour recordings while an auditor only wants to inspect a specific $N$-second window, we implemented **3 flexible modes of Video Trimming & Interval Analysis**:

1. **Pre-Upload Video Inspection (`POST /api/v1/videos/inspect`):**
   - Quickly reads a video's `duration_sec`, `fps`, `total_frames`, `width`, `height`, and extracts **3 preview thumbnails** (`start`, `middle`, `end` as base64 JPEGs) in $<0.2\text{s}$ using `cap.grab()` so the frontend UI can display a timeline scrubber before running heavy AI inference.
2. **Inline Interval Analysis (`POST /api/v1/analyze` with `start_sec` & `end_sec`):**
   - Accepts optional form/query parameters `start_sec`, `end_sec`, and `save_trimmed_only` (`bool`).
   - **Virtual Slicing (`save_trimmed_only=false`):** Fast-seeks directly to `start_sec` and stops at `end_sec` without decoding frames outside `[start_sec, end_sec]`.
   - **Physical File Trimming (`save_trimmed_only=true`):** Physically cuts the video file on disk to `[start_sec, end_sec]` (using lossless `ffmpeg -ss ... -to ... -c copy` or OpenCV `VideoWriter` fallback) into `storage/trimmed/` and deletes the large untrimmed upload to save disk space.
   - Preserves **both** the absolute CCTV timestamp (`timecode_sec = trim_start_sec + relative_timecode_sec`) and `relative_timecode_sec` inside the trimmed clip.
3. **Standalone Video Trimmer Endpoint (`POST /api/v1/videos/trim`):**
   - Physically cuts an uploaded video to `[start_sec, end_sec]`, returns trim metadata (`original_duration_sec`, `trimmed_duration_sec`, `method`), and optionally launches an asynchronous analysis job (`analyze_immediately=true`).

---

## 3. Interactive Violation Pre-Roll Replay (`T - 5s → T`) & Evidence Bounding-Box Overlay

To give bank auditors immediate visual context when reviewing detected violations on the Web UI, we implemented backend and frontend support for **Smart Pre-Roll Replay with Evidence Rectangle Highlighting**:

1. **Violation Card Selection & Legal Explanation:**
   - After video analysis completes, all detected violations are displayed as interactive cards showing the violation type, timestamp (`MM:SS` / `timecode_sec`), factual visual explanation, and grounded Republic of Kazakhstan regulation (`doc_title`, `clause_ref`, normative quote, and clickable `adilet.zan.kz` link).
2. **Automatic 5-Second Pre-Roll Playback & Auto-Pause at Violation Point (`replay_window`):**
   - When the user clicks a violation card:
     - The video player automatically seeks to **`max(0, timecode_sec - 5.0)` seconds** (`replay_window.pre_roll_sec`, i.e., `T - 5s`) and starts playing (`video.play()`).
     - The auditor watches the 5-second lead-up to the incident.
     - Once playback reaches the exact violation timestamp **`timecode_sec` (`T`, `replay_window.stop_sec`)**, the video player **automatically pauses/stops** (`video.pause()`) on the exact violation frame.
3. **Evidence Rectangle / Bounding-Box Overlay (`evidence_bbox`):**
   - When the video stops at the violation timestamp `T` (and on extracted keyframe previews), an HTML5 overlay draws a **highlighted bounding rectangle** (`bbox_norm: [x1, y1, x2, y2]` in normalized `[0.0..1.0]` coordinates) with a Russian evidence tag (`label`) directly on top of the video player over the offending object, person, or workspace zone:
     - *Unattended laptop (`Х-11`, `Х-28`):* Rectangle around the open laptop (`"Незаблокированный ноутбук (АРМ)"`).
     - *Open safe door (`Х-13`, `Х-20`, `Х-22`):* Rectangle around the safe door (`"Открытая дверца сейфа"`).
     - *Inkassator bag (`Х-15`, `Х-17`):* Rectangle around the cash bag / handover area (`"Инкассаторская сумка / баул"`).
     - *Foreign objects / personal items (`Х-24`, `Х-40`, `Х-46`):* Rectangle around the detected cup, mug, handbag, or coat (`"Посторонний предмет в рабочей зоне кассы"`).
     - *Unauthorized 3rd person (`Х-18`):* Rectangle around the 3rd person's bounding box (`"Постороннее (третье) лицо в кассе"`).
     - *Unlocked entry door (`Х-30`, `Х-32`, `Х-33`):* Rectangle around the cash room door & lock zone (`"Входная дверь кассы (не заперта)"`).
     - *Cash handover / recount / unattended cash (`X-1`, `X-2`, `Х-4`, `Х-26`, `Х-34`, `Х-38`, `Х-44`, `Х-47`):* Rectangle around the active desk cash surface & handover zone.

---

## 4. Evidence Media Export & Multi-Cut Video Compilation (`evidence ± N` Clip, Annotated Frame Image & Combined Video of Cuts)

To allow bank auditors and security officers to package visual proof directly from the Web UI without external video editors, we implemented **3 Evidence Export & Compilation modes**:

1. **Export Evidence Frame as High-Resolution Image (`GET /api/v1/jobs/{job_id}/evidence/frame`):**
   - Downloads the exact violation frame (or any selected keyframe `T-1s`, `T`, `T+1s`) as a standalone `.jpg` image (`evidence_{job_id}_v1_{T}s.jpg`).
   - Supports optional burned-in **`evidence_bbox` targeting rectangle** + timestamp header (`draw_bbox=true` or clean raw frame `draw_bbox=false`).
2. **Export Single Evidence $\pm N$ Seconds/Frames as Video Clip (`GET /api/v1/jobs/{job_id}/evidence/clip`):**
   - Extracts a configurable window **`[timecode_sec - N, timecode_sec + N]`** (e.g., $\pm 3\text{s}$, $\pm 5\text{s}$, or custom `pad_sec`) around a single violation and exports it as a downloadable `.mp4` video clip with the optional bounding rectangle highlighted around the violation peak.
3. **Multi-Evidence Selection & Single Combined Video of Cuts (`POST /api/v1/jobs/{job_id}/evidence/compile`):**
   - In the Web UI, the user can select **multiple violation timelines / evidence intervals** (via checkboxes on violation cards or custom `[start_sec, end_sec]` cuts) and click **"Compile Selected Cuts into One Video"**.
   - The backend slices each selected interval `[T_i - N, T_i + N]`, stamps a clean top-left cut badge (`CUT #1 | 12.0s`, `CUT #2 | 22.0s`), draws the optional evidence bounding rectangle (`bbox_norm`), and **concatenates all selected segments into a single `.mp4` video of cuts** (`compiled_evidence_{job_id}_{K}cuts.mp4`).

---

## 5. FastAPI REST API Endpoints (`backend/app/api/routes.py`)

### Authentication
All protected endpoints require the `X-API-Key` header (configured via `API_KEY` in `.env`). Missing or invalid keys return `401 Unauthorized`.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/analyze` | `X-API-Key` | **Jury Endpoint 1:** Upload `.mov`/`.mp4` under `file` (or `video`) + optional `start_sec`, `end_sec`, `save_trimmed_only`. Returns `202 Accepted` with `{"job_id": "...", "status": "processing"}`. |
| `GET` | `/api/v1/jobs/{job_id}` | `X-API-Key` | **Jury Endpoint 2:** Poll job status (`processing`, `done`, `failed`) and get strict Jury JSON (`verdict`, `violations` with `type`, `timecode_sec`, `description`, `evidence_frames`). |
| `GET` | `/api/v1/jobs/{job_id}/detailed` | `X-API-Key` | **Enriched Audit Endpoint:** Returns full job metadata (`video_metadata`, `trim_interval`, `processing_time_sec`) + `replay_window` (`pre_roll_sec`, `stop_sec`), `evidence_bbox` (`bbox_norm`, `label`), and `regulation_reference` (`doc_title`, `clause_ref`, `adilet_url`, `normative_text`, `rag_similarity`). |
| `GET` | `/api/v1/jobs` | `X-API-Key` | **Audit History & Dashboard Metrics:** Lists recent jobs from PostgreSQL `analysis_jobs` + summary counts (`total_jobs`, `violation_videos`, `compliant_videos`, `processing_jobs`). |
| `POST` | `/api/v1/videos/inspect` | `X-API-Key` | **Video Inspector:** Returns `duration_sec`, `fps`, `width`, `height`, and 3 base64 preview thumbnails for UI timeline trimming. |
| `POST` | `/api/v1/videos/trim` | `X-API-Key` | **Standalone Video Trimmer:** Physically trims an uploaded video to `[start_sec, end_sec]` and optionally starts an analysis job. |
| `GET` | `/api/v1/videos/{job_id}/stream` | Public | **Video Streamer:** Streams the `.mov`/`.mp4` video file for a job so the Web UI video player can play `T - 5s → T` and render the evidence rectangle. |
| `GET` | `/api/v1/jobs/{job_id}/evidence/frame` | Public | **Evidence Frame Image Export:** Downloads the violation frame at `timestamp_sec` as a `.jpg` image (with optional burned-in `evidence_bbox` rectangle). |
| `GET` | `/api/v1/jobs/{job_id}/evidence/clip` | Public | **Evidence $\pm N$ Sec Video Clip Export:** Exports `[timecode_sec - pad_sec, timecode_sec + pad_sec]` as a standalone `.mp4` clip. |
| `POST` | `/api/v1/jobs/{job_id}/evidence/compile` | Public | **Multi-Evidence Combined Video of Cuts:** Stitches multiple selected violation timelines (`violation_indices` or custom `[start_sec, end_sec]` cuts) into one consolidated `.mp4` video. |
| `GET` | `/api/v1/regulations` | Public | **Legal Knowledge Base:** Lists all 16 seeded RK banking regulations (`adilet.zan.kz`) from PostgreSQL `rk_banking_regulations`. |
| `GET` | `/api/v1/health` | Public | **Healthcheck:** Verifies local YOLO models, embedding model, and PostgreSQL + `pgvector` database connectivity. |

---

## 6. Database & Persistence Features (`backend/app/db/repository.py`)

- **`rk_banking_regulations` (`pgvector` `vector(384)`):** Stores 16 curated National Bank of RK clauses with IVFFlat cosine similarity index.
- **`analysis_jobs` (`JSONB`):** Persists every job's lifecycle (`processing` $\rightarrow$ `done` / `failed`), `verdict`, `processing_time_sec`, and full `result_json` (including `evidence_bbox` and `replay_window`).
- **`detected_violations`:** Stores granular violation rows linked via foreign key to `analysis_jobs(job_id)` for SQL analytics and audit filtering.
- **Dual-Layer Resilience:** Combines PostgreSQL persistence with an in-memory mirror so job polling is instantaneous and resilient.

---

## 7. One-Command Setup & Utility Scripts (`scripts/`)

| Script | Purpose |
| :--- | :--- |
| `scripts/init_db.py` & `scripts/init_db.sql` | Creates PostgreSQL database `fortebank_compliance`, enables `pgvector`, creates tables, and seeds all 16 RK regulations with 384-d embeddings. |
| `scripts/download_models.py` | Downloads and verifies local `yolo11n-pose.pt` and `yolo11n.pt` weights in `./models/`. |
| `scripts/evaluate_dataset.py` | Runs the 42-video benchmark evaluation (`100.0%` binary accuracy, `0.05s` mean timecode error). |
| `scripts/test_api.py` | End-to-end automated integration test for FastAPI endpoints, `X-API-Key` auth, video inspection, full analysis, and interval trimming. |
| `scripts/start_backend.ps1` | One-command PowerShell launcher for the FastAPI backend server on port `8000`. |
