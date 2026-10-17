# ForteBank Datathon 2026 — Master Implementation Plan & Proposals (`plan.md`)

---

## Part I: Proposal — Suggested Models, Architectures & Ways to Solve the Problem

Before jumping into code, here is a comprehensive analysis of the **candidate ways and model stacks** we can use to solve this problem under our constraints (**100% local execution**, **NVIDIA RTX 3050 4GB VRAM**, **42 training videos**, **open-set test violations**, and **camera-angle invariance**).

### 1. Comparing the 3 Architectural Ways

| Approach | How It Works | Pros | Cons / Risks on This Case | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Way 1: Pretrained Vision Backbone + Trainable Temporal Layer** *(e.g., ResNet50 / ViT / VideoMAE + LSTM / Temporal Transformer)* | Extract frame embeddings with a frozen/fine-tuned CNN/ViT, pass sequence into a newly trained LSTM/Transformer head to predict `violation(t)`. | Standard academic approach; fast inference once trained. | **High risk of overfitting** on 40 unique videos (~2–3 videos per violation type). Memorizes actor clothes & camera angle. **Cannot explain *why* in Russian** or detect unseen violation types (FAQ #9). | ❌ Do not use as standalone |
| **Way 2: Pure Local Video-LLM Scanning** *(e.g., Qwen2.5-VL-3B/7B or MiniCPM-V scanning frame grids)* | Sample frames every $N$ seconds, feed multi-image grids directly into a local VLM with a prompt listing bank rules. | Great zero-shot reasoning, handles unseen violations, camera-angle invariant, writes natural Russian descriptions. | **Slow if run densely** across 142s videos on 4GB VRAM; **poor timestamp precision** (`timecode_sec` can be off by $\pm 5\text{–}10\text{s}$); can hallucinate small objects like banknotes. | ⚠️ Great for reasoning, weak on exact `timecode_sec` alone |
| **Way 3 (Recommended Winner): Hybrid 4-Stage Pipeline** *(Spatial Object/Pose Tracker + Relational Temporal Layer + Keyframe Local VLM + `pgvector` Legal RAG)* | **Stage 1:** Fast object/pose tracking (`YOLO`). **Stage 2:** Temporal layer on structured state signals pinpoints exact `timecode_sec`. **Stage 3:** Local VLM (`Qwen2.5-VL-3B`) inspects the exact event frames. **Stage 4:** `pgvector` RAG attaches exact RK legal clauses. | **Pinpoint timestamps** ($\pm 0.5\text{s}$), **camera-angle invariant** (uses relative object distances), handles **open-set rules**, **zero legal hallucinations**, fits comfortably in **4GB VRAM** ($< 25\text{s}$ per video). | Slightly more modular pipeline to wire together (handled cleanly in `backend/app/pipeline/`). | 🏆 **Selected Architecture** |

---

### 2. Proposed Model Stack (All Open-Source, Commercial-Permissive Licenses, 4GB VRAM Friendly)

#### Layer A: Spatial Perception (Object, Person, Pose & Zone Tracking)
1. **Person & Hand Keypoint Tracking:** **`YOLOv11n-pose` (or `YOLOv8n-pose`) + `ByteTrack`** (Apache/AGPL/Ultralytics or `RTMPose-s` Apache 2.0)
   - *Why:* Tracks every person in the room (`person_count`), distinguishes the **Cashier** (person seated/standing at the desk with laptop/counter) from the **Client** and any **3rd Unauthorized Person**, and gives exact **left/right wrist coordinates** `(x, y)` to detect hand interactions with the safe, counting machine, cash, or client.
   - *VRAM & Speed:* ~300 MB VRAM, >100 FPS.
2. **Domain Object Detector:** **`YOLOv8s-worldv2` (Open-Vocabulary) + Lightweight Fine-Tuned `YOLOv11s`**
   - *Target Objects:*
     - `desk` (рабочий стол кассира)
     - `safe` / `safe_door_open` (сейф / открытая дверца сейфа)
     - `bill_counter` (счетно-сортировальная машинка / детектор)
     - `cash_banknotes` (наличные деньги / пачка купюр)
     - `inkassator_bag` (инкассаторская сумка / баул)
     - `laptop` (ноутбук / терминал кассира)
     - `forbidden_item`: `cup / coffee` (стакан/кружка), `handbag / backpack` (личная сумка/одежда на столе), `phone` (телефон)
   - *Pro-Tip:* Because all 42 training videos contain these exact objects, we can auto-label ~150 keyframes using `YOLO-World` / `Florence-2` + quick bounding-box refinement and fine-tune a tiny `YOLOv11n/s` detector in 5 minutes on your RTX 3050! That gives >95% precision on cash bundles, safe doors, green inkassator bags, and coffee cups, while remaining camera-angle invariant.

#### Layer B: The Temporal Layer (How We Model Time Without Overfitting)
Instead of feeding raw pixels into an LSTM, our **Temporal Layer** processes a per-frame **Relational State Vector $\mathbf{s}_t \in \mathbb{R}^d$** sampled at 3–5 FPS:
$$\mathbf{s}_t = \big[\text{cashier\_present}, \text{num\_persons}, \text{safe\_open}, \text{cash\_on\_desk}, \text{bag\_on\_desk}, \text{forbidden\_item\_on\_desk}, d(\text{hand}, \text{counter}), d(\text{hand}, \text{safe}), d(\text{hand}, \text{client}), \text{motion\_energy}\big]$$

On top of $\mathbf{s}_{1:T}$, we run a **Dual Temporal Engine**:
1. **Temporal Finite-State & Event Trigger Engine (Rule-Driven):**
   - **Trigger T1 (Unattended Cash Desk / Safe / Values):** `cashier_present` transitions `True → False` (or cashier exits door zone) while `cash_on_desk == True` OR `safe_open == True` OR `bag_on_desk == True` OR `laptop_unlocked == True`. *(Timecode = exact second cashier leaves desk/door).*
   - **Trigger T2 (Third-Party / Unauthorized Access):** `num_persons >= 3` inside the cash room (Cashier + Client + 3rd person entering). *(Timecode = exact second 3rd person crosses door threshold).*
   - **Trigger T3 (Forbidden Personal/Foreign Items on Desk):** `cup`, `handbag`, `food`, or `personal_clothing` detected on `desk` surface for $> 1.5\text{s}$. *(Timecode = exact second item is placed or used by cashier).*
   - **Trigger T4 (Cash Handling / Counting / Safe Procedure Violation):**
     - Cash transferred between Cashier and Client (`cash_on_desk` or hand-to-hand transfer) **without** prior activation/interaction with `bill_counter` (`d(hand, counter) < threshold`).
     - Safe left open (`safe_open == True`) for extended duration while client is at the desk or without active cash placement.
     - Client walks out (`num_persons` drops `2 → 1`) while uncollected cash/documents remain on the desk (`Х-4` at 57s).
2. **Learned Temporal Anomaly Scorer (1D-TCN / Gradient Boosted Sequence Classifier):**
   - Trained using **Leave-One-Video-Out Cross-Validation (LOVO-CV)** on sliding 5-second windows of $\mathbf{s}_t$ across the 42 videos.
   - Outputs a continuous temporal anomaly curve $P(\text{violation} \mid t)$ over the video timeline so the UI can plot a live **Violation Risk Timeline Graph** and catch subtle timing patterns.

#### Layer C: Local Vision-Language Model (VLM) for Semantic Verification & Open-Set Catching
- **Suggested Model:** **`Qwen2.5-VL-3B-Instruct` (4-bit quantized GGUF / AWQ via Ollama or `llama-cpp-python`)** or **`MiniCPM-V-2.6-int4`**.
- **Why `Qwen2.5-VL-3B`:**
  - Currently the strongest small VLM for document/object/action understanding and Russian text generation.
  - In `Q4_K_M` quantization, it takes only **~2.2 GB VRAM**, running comfortably on your 4GB RTX 3050.
- **How It Is Used:**
  1. **Candidate Verification:** For any timestamp $t^*$ flagged by Layer B, we crop a 3-frame strip $(t^*-2\text{s}, t^*, t^*+2\text{s})$ and ask `Qwen2.5-VL-3B` to verify what the cashier and client are doing and generate a concise, factual visual description.
  2. **Global Storyboard Fallback (for Unseen Violations — FAQ #9):** If Layer B finds no triggers, we pass a single composite $3\times 3$ keyframe grid of the video to `Qwen2.5-VL-3B` to check if any other banking anomaly occurred.

#### Layer D: Local `pgvector` Regulatory RAG
- **Suggested Embedding Model:** **`intfloat/multilingual-e5-small`** (118M params, 384 dimensions, MIT License).
  - Runs on CPU in **~12 ms** per query (0 MB GPU VRAM impact!), has top-tier Russian semantic retrieval accuracy.
- **Suggested Database:** **PostgreSQL + `pgvector`** (`rk_banking_regulations` table).
  - Hybrid retrieval combining **Cosine Similarity** (`1 - (embedding <=> query_vec)`) + **Violation Category Metadata Filter**.

---

## Part II: Step-by-Step Implementation Plan

### Phase 1: Project Foundation, Specs & Automated Setup Scripts (Rule 1)
- [x] **1.1.** Extract `open.zip` into `dataset/` and inspect `Кейс_ForteBank.docx`.
- [x] **1.2.** Create folder structure (`specs/`, `backend/`, `frontend/`, `scripts/`) and write `specs.md`, `specs/rules.md`, and `plan.md`.
- [ ] **1.3.** Create `.env.example` and initialization scripts (`scripts/init_db.sql`, `scripts/init_db.py`, `scripts/download_models.py`, `scripts/setup.ps1`) so anyone cloning the repo can initialize PostgreSQL + `pgvector` and models in one command.

### Phase 2: Complete Dataset Audit & RK Legal Knowledge Base (`adilet.zan.kz`)
- [ ] **2.1.** Run an automated visual inspection script across **all 42 videos** (`22 violations` + `20 normal`) to log the exact visual event happening at every labeled timestamp and verify normal baselines.
- [ ] **2.2.** Curate `backend/app/data/rk_regulations.json` with authentic clauses from Republic of Kazakhstan banking regulations (`adilet.zan.kz` — Постановление Правления НБ РК «Правила ведения кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня...», Требования к охране и устройству помещений банков и др.).
- [ ] **2.3.** Execute `scripts/init_db.py` to create the PostgreSQL database, enable `pgvector`, and seed `rk_banking_regulations` with 384-d embeddings.

### Phase 3: Vision + Temporal + VLM + RAG Pipeline (`backend/app/pipeline/`)
- [ ] **3.1. Stage 1 (Spatial Extractor):** Implement `stage1_spatial.py` using OpenCV (UTF-8/Cyrillic safe) + `YOLO` pose/object detection to extract per-second structured state timelines (persons, hands, desk, safe state, cash, bag, counter, forbidden objects).
- [ ] **3.2. Stage 2 (Temporal Engine):** Implement `stage2_temporal.py` with the Temporal State Machine + Sliding-Window Classifier to detect violation events, compute exact `timecode_sec`, and extract the best 1–3 `evidence_frames` (base64 JPEG).
- [ ] **3.3. Stage 3 & 4 (Local VLM + `pgvector` RAG):** Implement `stage3_vlm.py` and `stage4_rag.py` to generate factual Russian descriptions and attach the highest-scoring legal clause from `pgvector`.
- [ ] **3.4. Benchmark on all 42 Videos:** Run cross-validation across all 42 videos in `dataset/open/videos/`, measuring binary accuracy (Criterion 1: 25 pts), timestamp error (Criterion 2: 15 pts), and classification quality (Criterion 3: 15 pts).

### Phase 4: FastAPI Backend & Jury API Compliance (`backend/app/`)
- [ ] **4.1.** Implement `POST /api/v1/analyze` and `GET /api/v1/jobs/{job_id}` in FastAPI with `X-API-Key` authentication, background worker execution, PostgreSQL job persistence, and strict JSON schema validation.
- [ ] **4.2.** Add extra UI-support endpoints (`GET /api/v1/jobs`, `GET /api/v1/regulations`) so the frontend can display job history, timeline anomaly curves, and clickable `adilet.zan.kz` regulation cards.
- [ ] **4.3.** Test the API with `curl` commands matching Case Section 10.

### Phase 5: Frontend Web Interface (`frontend/`)
- [ ] **5.1.** Build a high-aesthetic, responsive Web UI for ForteBank compliance auditors (React + Vite + Tailwind + Framer Motion):
  - **Cinematic Screensaver / Splash Intro:** 2–3 second logo reveal with neural scanline animation, smoothly fading out into the executive dark workspace.
  - **CCTV Interval Range Trimmer:** Drag-and-drop `.mov`/`.mp4` upload with duration/FPS/thumbnail inspection and dual-handle `[start_sec, end_sec]` slider for slicing hours-long CCTV exports.
  - **Interactive Cinema Player & Smart Timeline:** Clickable violation markers on the seekbar.
  - **Pre-Roll Replay (`T - 5s → T`) & Auto-Stop:** Clicking any violation card seeks to `T - 5s`, plays the 5-second lead-up, and automatically pauses at `T`.
  - **Dynamic Evidence Bounding-Box Overlay:** High-contrast rectangle (`evidence_bbox`) and label rendered on top of the paused video frame at `T`.
  - **Evidence Media Export & Multi-Cut Video Compilation:**
    - Export single evidence keyframe as `.jpg` image (with/without bounding box).
    - Export single evidence $\pm N$ seconds/frames as a standalone `.mp4` video clip.
    - Select multiple violation timelines via checkboxes and compile them into a single consolidated `.mp4` video of cuts (`POST /api/v1/jobs/{job_id}/evidence/compile`).
  - **Legal Grounding Panel:** Cites exact RK National Bank Document, Clause, normative text, and direct clickable `adilet.zan.kz` link retrieved via `pgvector`.
  - **Audit History & Regulations Knowledge Base:** Modal/drawer to inspect past jobs and browse all 16 NBRK regulations.

### Phase 6: Public URL Deployment, Documentation & Final Verification
- [ ] **6.1.** Set up a public HTTPS tunnel (`cloudflared` / `ngrok`) and verify external `curl` access with `X-API-Key`.
- [ ] **6.2.** Write `README.md` covering all deliverables required by Case Section 8 (Architecture, Legal Sources & Mapping Principle, Supported Violation Types catalog, Known Limitations, and 1-command Setup Guide).
