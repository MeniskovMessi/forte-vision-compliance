#!/usr/bin/env python3
"""
ForteBank Compliance Service — Database Initializer & Knowledge Base Seeder
Rule 1 Compliance: Automates PostgreSQL database creation, pgvector extension,
table schemas, and embedding computation for the RK banking legal knowledge base.
"""

import os
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from pgvector.psycopg2 import register_vector

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("init_db")

# Load environment configuration
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "1234")
PG_DB = os.getenv("POSTGRES_DB", "fortebank_compliance")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "intfloat/multilingual-e5-small")

SQL_SCHEMA_FILE = ROOT_DIR / "scripts" / "init_db.sql"
REGULATIONS_DATA_FILE = ROOT_DIR / "backend" / "app" / "data" / "rk_regulations.json"


def ensure_database_exists():
    """Connects to default postgres DB and creates target DB if missing."""
    logger.info(f"Connecting to PostgreSQL at {PG_HOST}:{PG_PORT} as {PG_USER}...")
    try:
        conn = psycopg2.connect(
            host=PG_HOST, port=PG_PORT, user=PG_USER, password=PG_PASSWORD, dbname="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (PG_DB,))
        if not cur.fetchone():
            logger.info(f"Database '{PG_DB}' does not exist. Creating...")
            cur.execute(f'CREATE DATABASE "{PG_DB}";')
            logger.info(f"Database '{PG_DB}' created successfully.")
        else:
            logger.info(f"Database '{PG_DB}' already exists.")
            
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error checking/creating database '{PG_DB}': {e}")
        sys.exit(1)


def execute_schema_migrations():
    """Applies schema from scripts/init_db.sql to target database."""
    logger.info(f"Connecting to database '{PG_DB}' to apply schema...")
    try:
        conn = psycopg2.connect(
            host=PG_HOST, port=PG_PORT, user=PG_USER, password=PG_PASSWORD, dbname=PG_DB
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        # Read SQL file
        schema_sql = SQL_SCHEMA_FILE.read_text(encoding="utf-8")
        cur.execute(schema_sql)
        logger.info("Schema migrations (vector extension, tables, indexes) applied successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error executing schema migrations: {e}")
        sys.exit(1)


def seed_rk_regulations():
    """Computes embeddings and seeds/upserts RK regulations into pgvector table."""
    if not REGULATIONS_DATA_FILE.exists():
        logger.error(f"Regulations data file not found: {REGULATIONS_DATA_FILE}")
        return

    logger.info(f"Loading regulations from {REGULATIONS_DATA_FILE.name}...")
    with open(REGULATIONS_DATA_FILE, "r", encoding="utf-8") as f:
        regulations = json.load(f)

    logger.info(f"Found {len(regulations)} regulations. Initializing embedding model '{EMBEDDING_MODEL_NAME}'...")
    try:
        from sentence_transformers import SentenceTransformer
        # e5 models require 'passage: ' prefix for document texts
        model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    except Exception as e:
        logger.error(f"Failed to load SentenceTransformer model '{EMBEDDING_MODEL_NAME}': {e}")
        sys.exit(1)

    conn = psycopg2.connect(
        host=PG_HOST, port=PG_PORT, user=PG_USER, password=PG_PASSWORD, dbname=PG_DB
    )
    register_vector(conn)
    cur = conn.cursor()

    upsert_query = """
    INSERT INTO rk_banking_regulations 
        (rule_code, violation_type, doc_title, clause_ref, adilet_url, normative_text, visual_pattern, embedding)
    VALUES 
        (%s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (rule_code) DO UPDATE SET
        violation_type = EXCLUDED.violation_type,
        doc_title = EXCLUDED.doc_title,
        clause_ref = EXCLUDED.clause_ref,
        adilet_url = EXCLUDED.adilet_url,
        normative_text = EXCLUDED.normative_text,
        visual_pattern = EXCLUDED.visual_pattern,
        embedding = EXCLUDED.embedding;
    """

    logger.info("Computing embeddings and upserting into PostgreSQL pgvector...")
    for item in regulations:
        # Combine visual pattern and normative requirement for maximum semantic match
        combined_text = f"passage: {item['violation_type']}. {item['visual_pattern']} {item['normative_text']}"
        embedding = model.encode(combined_text, normalize_embeddings=True).tolist()

        cur.execute(
            upsert_query,
            (
                item["rule_code"],
                item["violation_type"],
                item["doc_title"],
                item["clause_ref"],
                item["adilet_url"],
                item["normative_text"],
                item["visual_pattern"],
                embedding,
            ),
        )

    conn.commit()
    logger.info(f"Successfully seeded {len(regulations)} regulations into 'rk_banking_regulations' table!")

    # Verify retrieval with a test query
    test_query = "query: кассир встал и вышел, оставив деньги на столе"
    q_vec = model.encode(test_query, normalize_embeddings=True).tolist()
    cur.execute(
        """
        SELECT rule_code, violation_type, clause_ref, 1 - (embedding <=> %s::vector) AS similarity
        FROM rk_banking_regulations
        ORDER BY embedding <=> %s::vector
        LIMIT 2;
        """,
        (q_vec, q_vec),
    )
    results = cur.fetchall()
    logger.info("--- RAG Retrieval Test on Seeded pgvector Data ---")
    logger.info(f"Query: '{test_query}'")
    for r in results:
        logger.info(f"Match: [{r[0]}] {r[1]} ({r[2]}) - Cosine Similarity: {r[3]:.4f}")

    cur.close()
    conn.close()


def main():
    logger.info("=== Starting ForteBank DB & Knowledge Base Setup (Rule 1) ===")
    ensure_database_exists()
    execute_schema_migrations()
    seed_rk_regulations()
    logger.info("=== Database & pgvector Knowledge Base Initialization Complete! ===")


if __name__ == "__main__":
    main()
