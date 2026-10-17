-- ForteBank Compliance Service — Database Initialization Schema
-- Automatically executed by scripts/init_db.py

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Knowledge Base of Republic of Kazakhstan Banking Regulations (adilet.zan.kz)
CREATE TABLE IF NOT EXISTS rk_banking_regulations (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(64) UNIQUE NOT NULL,
    violation_type TEXT NOT NULL,
    doc_title TEXT NOT NULL,
    clause_ref TEXT NOT NULL,
    adilet_url TEXT NOT NULL,
    normative_text TEXT NOT NULL,
    visual_pattern TEXT NOT NULL,
    embedding vector(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast cosine similarity search on regulations
CREATE INDEX IF NOT EXISTS rk_regulations_embedding_idx 
ON rk_banking_regulations 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- 2. Analysis Jobs Queue & Results (Strictly matching Case Section 10 API schema)
CREATE TABLE IF NOT EXISTS analysis_jobs (
    job_id VARCHAR(32) PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing', -- processing | done | failed
    verdict VARCHAR(20),                              -- violation | no_violation
    processing_time_sec FLOAT,
    error_message TEXT,
    result_json JSONB,                                -- Cached full JSON response for GET /api/v1/jobs/{job_id}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);

-- 3. Granular Detected Violations Table (for analytics, filtering, and UI display)
CREATE TABLE IF NOT EXISTS detected_violations (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(32) NOT NULL REFERENCES analysis_jobs(job_id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL,
    timecode_sec FLOAT NOT NULL,
    description TEXT NOT NULL,
    rule_code VARCHAR(64),
    evidence_frame_base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_detected_violations_job_id ON detected_violations(job_id);
CREATE INDEX IF NOT EXISTS idx_detected_violations_rule_code ON detected_violations(rule_code);
