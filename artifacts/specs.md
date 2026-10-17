# ForteBank Datathon 2026 — Project Specifications (`specs.md`)

**Case Title:** AI-сервис для выявления нарушений кассовой дисциплины по видеозаписям (AI Service for Detecting Cash Discipline Violations from Video Recordings)

---

## 1. Project Rules (`Rules`)

> [!IMPORTANT]
> All team members and AI agents working on this repository MUST follow these engineering and compliance rules.

### Rule 1: Reproducible Initialization & Setup Scripts
- **Every component MUST include automated initialization and setup scripts** so anyone who clones the repository can set up and run the entire system with zero manual hassle.
- Specifically, we must maintain:
  - `scripts/init_db.py` / `scripts/init_db.sql`: Automatically creates the PostgreSQL database/schema, enables the `vector` (`pgvector`) extension, creates all required tables (`rk_banking_regulations`, `analysis_jobs`, `detected_violations`), and seeds the normative legal clauses from `adilet.zan.kz` along with their precomputed or locally computed embeddings.
  - `scripts/download_models.py`: Downloads and caches all open-source local model weights (`YOLO`, `multilingual-e5-small`, `Qwen2.5-VL` GGUF/weights) so the system runs 100% offline afterward.
  - `scripts/setup_env.ps1` / `scripts/setup_env.sh` & `.env.example`: One-command environment setup and configuration template.
  - `scripts/run_all.ps1` / `docker-compose.yml`: One-command startup for Backend, Frontend, and Public Tunnel.

### Rule 2: 100% Local Execution & Zero Cloud AI Dependency
- **Strict Disqualification Rule (Case Section 7 & FAQ #21, #35):** Never call external/cloud AI APIs (`OpenAI`, `Gemini`, `Claude`, cloud OCR, or cloud vision APIs) during video processing.
- Neither video files, extracted frames, nor text descriptions of frames may be sent over the internet to third-party AI services.
- Once weights are downloaded via `scripts/download_models.py`, the entire inference and RAG pipeline must work even with the internet cable unplugged.

### Rule 3: No Biometrics / No Facial Recognition / Visual Only
- **Strict Prohibition (FAQ #28, #29):** Do NOT use face recognition or biometric person identification (`InsightFace`, `FaceNet`, etc.). Person tracking must rely strictly on bounding boxes, body pose keypoints, clothing/spatial role (e.g., behind cashier desk vs. client side).
- Do NOT rely on audio tracks (videos have no audio; analysis is strictly visual).

### Rule 4: Zero Hallucinated Legal Citations
- Every normative rule cited in `description` or the UI must originate from the seeded `rk_banking_regulations` table in PostgreSQL (`pgvector`), backed by real Republic of Kazakhstan regulations (`adilet.zan.kz` / National Bank of RK).
- Never invent clause numbers or claim non-visible system violations (such as accounting ledger discrepancies in ABIS).

### Rule 5: Hardware Budget & Latency Target
- Target hardware baseline: **NVIDIA RTX 3050 Laptop GPU (4 GB VRAM)** + **Intel Core i5-11300H** (or higher).
- Peak GPU VRAM usage must stay **$\le 3.6\text{ GB}$** (using quantized local models or sequential model loading if needed).
- Maximum processing time per video (`10s–145s`, `~29 MB`, `.mov`): **target $< 35$ seconds**, strictly **$< 300$ seconds (5 minutes)** hard jury timeout.

### Rule 6: Cross-Platform & Cyrillic Filename Safety
- The dataset contains mixed Latin (`X-1.mov`, `X-2.mov`) and Cyrillic (`Х-3.mov` ... `Х-48.mov`) filenames.
- All file I/O, OpenCV video readers/writers, and temp file handlers in Python must use UTF-8-safe paths (`pathlib.Path`, `np.fromfile` / `cv2.imencode` where necessary on Windows).

---

## 2. Repository & Folder Structure

We use a clean **3-pillar monorepo layout** (`backend/`, `frontend/`, `scripts/` + `specs/`):

```text
Datathon_2026-Policy violation detection/
├── specs.md                      # Main specification & configuration reference
├── plan.md                       # Master implementation plan & model proposals
├── specs/                        # Detailed rules, legal KB JSONs, API schemas
│   └── rules.md                  # Dedicated project rules & conventions
├── scripts/                      # Rule 1: One-click setup & initialization scripts
│   ├── init_db.sql               # PostgreSQL + pgvector schema creation
│   ├── init_db.py                # DB initializer & RK law RAG seeder
│   ├── download_models.py        # Pre-downloads YOLO, Embedding & VLM weights
│   ├── setup.ps1                 # Environment setup script (Windows)
│   └── start_service.ps1         # Launches Backend + Frontend + Tunnel
├── backend/                      # FastAPI Server + AI Vision/Temporal/RAG Pipeline
│   ├── app/
│   │   ├── main.py               # FastAPI entrypoint & CORS
│   │   ├── config.py             # Pydantic Settings (.env loader)
│   │   ├── auth.py               # X-API-Key header validation
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── endpoints.py  # POST /api/v1/analyze, GET /api/v1/jobs/{job_id}
│   │   ├── db/
│   │   │   ├── session.py        # PostgreSQL connection pool
│   │   │   └── models.py         # SQLAlchemy / pgvector models
│   │   ├── pipeline/             # AI Core Pipeline inside backend
│   │   │   ├── orchestrator.py   # End-to-end video analysis coordinator
│   │   │   ├── stage1_spatial.py # YOLO object + pose + ByteTrack tracking
│   │   │   ├── stage2_temporal.py# Temporal state machine + sliding-window scorer
│   │   │   ├── stage3_vlm.py     # Local VLM keyframe verification
│   │   │   └── stage4_rag.py     # pgvector normative rule retrieval & formatting
│   │   └── data/
│   │       └── rk_regulations.json # Curated Adilet.zan.kz clauses for seeding
│   └── requirements.txt
├── frontend/                     # Web UI for Bank Auditors / Jury Demo
│   ├── index.html / package.json
│   └── src/                      # Video uploader, timeline markers, evidence cards
├── dataset/                      # Extracted training/validation videos & labels
│   └── open/
│       ├── open_labels.xlsx
│       └── videos/               # 42 .mov videos (464x848, ~30 FPS)
└── .env.example                  # Template configuration file
```

---

## 3. System Configurations (`.env.example` Specification)

All runtime parameters must be configurable via `.env` (loaded by `backend/app/config.py`):

```ini
# --- API & Server Config ---
APP_HOST=0.0.0.0
APP_PORT=8000
API_KEY=fortebank-datathon-2026-secret-key
MAX_UPLOAD_SIZE_MB=100
JOB_TIMEOUT_SEC=280
UPLOAD_DIR=./storage/uploads
EVIDENCE_DIR=./storage/evidence

# --- PostgreSQL + pgvector Config ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=fortebank_compliance
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/fortebank_compliance

# --- Vision & Temporal Pipeline Config ---
VIDEO_SAMPLE_FPS=3.0
POSE_MODEL_PATH=./models/yolo11n-pose.pt
OBJECT_MODEL_PATH=./models/yolov8s-worldv2.pt
CONFIDENCE_THRESHOLD=0.35
EVIDENCE_JPEG_QUALITY=85
MAX_EVIDENCE_FRAMES=3

# --- Local VLM & Embedding Config (Offline) ---
EMBEDDING_MODEL_NAME=./models/multilingual-e5-small
VLM_PROVIDER=ollama_or_llamacpp
VLM_MODEL_NAME=qwen2.5vl:3b
VLM_ENABLED=true
```

---

## 4. Database & `pgvector` Schema Specification

 initialized automatically via `scripts/init_db.py`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Knowledge Base of Republic of Kazakhstan Banking Regulations (adilet.zan.kz)
CREATE TABLE IF NOT EXISTS rk_banking_regulations (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(64) UNIQUE NOT NULL,   -- e.g., "NBRK_204_P34_UNATTENDED"
    violation_type TEXT NOT NULL,            -- Standardized Russian title for API `type`
    doc_title TEXT NOT NULL,                 -- Official title of the RK normative act
    clause_ref TEXT NOT NULL,                -- Exact section/paragraph (Пункт / Глава)
    adilet_url TEXT NOT NULL,                -- Direct link to adilet.zan.kz
    normative_Summary TEXT NOT NULL,         -- Official requirement summary
    visual_pattern TEXT NOT NULL,            -- Description of visual indicators on CCTV
    embedding vector(384)                    -- multilingual-e5-small embedding (384 dims)
);

-- 2. Asynchronous Video Analysis Jobs
CREATE TABLE IF NOT EXISTS analysis_jobs (
    job_id VARCHAR(32) PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing', -- processing | done | failed
    verdict VARCHAR(20),                              -- violation | no_violation
    processing_time_sec FLOAT,
    error_message TEXT,
    result_json JSONB,                                -- Cached exact Jury API response
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
```

---

## 5. Mandatory Jury API Specification (Case Section 10)

### Authentication
- Header: `X-API-Key: <API_KEY>`
- Requests without a valid `X-API-Key` MUST return `401 Unauthorized` or `403 Forbidden`.

### Endpoint 1: Submit Video for Analysis
- **Method & Path:** `POST /api/v1/analyze`
- **Content-Type:** `multipart/form-data`
- **Form Field:** `file` (`.mov` video file, ~29 MB)
- **Response (`200 OK` / `202 Accepted`):**
```json
{
  "job_id": "3f2a9c1e",
  "status": "processing"
}
```

### Endpoint 2: Poll Job Status & Result
- **Method & Path:** `GET /api/v1/jobs/{job_id}`
- **Response when completed (`200 OK`):**
```json
{
  "job_id": "3f2a9c1e",
  "status": "done",
  "verdict": "violation",
  "violations": [
    {
      "type": "Оставление кассового помещения и наличных денег без присмотра",
      "timecode_sec": 44.2,
      "description": "На 44.2 сек кассир покидает кассовое помещение при наличии необеспеченных наличных банкнот на рабочем столе и незапертом сейфе. Нарушение требований Постановления Правления НБ РК «Правила ведения кассовых операций и операций по инкассации...» (adilet.zan.kz): запрещается оставлять ценности и кассовый узел без присмотра.",
      "evidence_frames": [
        {
          "timestamp_sec": 44.2,
          "image_base64": "/9j/4AAQSkZJRgABAQAAAQABAAD..."
        }
      ]
    }
  ]
}
```
- **When `verdict == "no_violation"`:** `violations` MUST be an empty list `[]`.
- **Note for Web UI Enrichment:** While the Jury API strictly returns the schema above, our `description` will concisely include both (a) what is visually observed and (b) the exact RK regulation title & clause so both automated API graders and human reviewers see the legal grounding. We can also expose `/api/v1/jobs/{job_id}/detailed` for the frontend UI to render dedicated badges for the `adilet.zan.kz` link and clause number.

---

## 6. Dataset Specifications & Known Quirks

- **Total Videos in `dataset/open/videos/`:** 42 files (`464x848` vertical portrait, `29.8–30.0 FPS`, `H.264/MOV`, no audio).
- **Labels (`dataset/open/open_labels.xlsx`):** 22 labeled `нарушение` (with timestamp in seconds), 20 labeled `без нарушения`.
- **Known Dataset Quirks to Handle in Code:**
  1. **Latin vs. Cyrillic `X`:** `X-1.mov` and `X-2.mov` start with ASCII `X` (`0x58`), while `Х-3.mov`..`Х-48.mov` start with Cyrillic `Х` (`0x0425`).
  2. **Multi-Violation Duplicate Pair:** `Х-4.mov` and `Х-47.mov` are identical files (`md5: fdd5aa51`), labeled at `57s` and `68s` respectively — confirming a single video can have multiple violations at different timestamps.
  3. **Normal Duplicate Pair:** `Х-5.mov` and `Х-48.mov` are identical files (`md5: 304e8be8`), both labeled `без нарушения`.
