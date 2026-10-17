# Project Engineering & Compliance Rules (`specs/rules.md`)

This document tracks all project-wide rules. Any new rule added during development must be registered here.

---

## Rule 1: Mandatory Initialization & Setup Scripts (Zero-Friction Onboarding)
When implementing any feature (Database, AI models, Backend, Frontend), we **MUST** also create and update initialization/setup scripts in `scripts/` so anyone who clones the repository can set it up and run it effortlessly:
1. **Database Initialization (`scripts/init_db.py` & `scripts/init_db.sql`):**
   - Automatically checks PostgreSQL connection, creates the database if missing, runs `CREATE EXTENSION IF NOT EXISTS vector;`, creates all tables, and seeds the `rk_banking_regulations` knowledge base with embeddings.
2. **Model Weights Initialization (`scripts/download_models.py`):**
   - Downloads all required local weights (`YOLO`, `multilingual-e5-small`, local VLM) into `./models/` and verifies checksums so offline inference works out of the box.
3. **One-Command Environment & Run Scripts (`scripts/setup.ps1`, `scripts/run.ps1`, `.env.example`):**
   - Automates virtual environment setup, dependencies installation, DB initialization, and server startup.

## Rule 2: 100% Local AI Inference (Disqualification Prevention)
- All models (Vision, Temporal, VLM, Text Embeddings, RAG) MUST execute locally.
- Zero external calls to OpenAI, Gemini, Claude, or cloud vision APIs.

## Rule 3: Privacy & Biometric Compliance
- No facial recognition or biometric identity matching is permitted.
- Analysis is strictly visual (no audio analysis).

## Rule 4: Grounded Legal References (`adilet.zan.kz`)
- Every violation must be linked to a real normative act of the Republic of Kazakhstan stored in our `pgvector` knowledge base.
- Never claim invisible/systemic violations (e.g., ABIS ledger errors) that cannot be verified visually on video.

## Rule 5: Camera-Angle Invariance
- Do not hardcode fixed pixel bounding boxes for the table or door that only work on one camera view.
- Always compute spatial relationships **relative to detected objects** (e.g., distance from `person_hand` to `desk_bbox`, `safe_bbox`, `counting_machine_bbox`, `door_zone`).
