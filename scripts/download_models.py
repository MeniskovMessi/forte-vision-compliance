#!/usr/bin/env python3
"""
ForteBank Compliance Service — Offline Model Weights Downloader
Rule 1 & Rule 2 Compliance: Pre-downloads and caches all required open-source
vision (YOLO pose & object detection) and text embedding models into ./models/
so the service runs 100% offline inside the bank's isolated network.
"""

import os
import sys
import shutil
import logging
from pathlib import Path
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("download_models")

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MODELS_DIR = ROOT_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def download_yolo_models():
    """Downloads YOLOv11n-pose, YOLOv11n, and YOLOv8s-worldv2 into ./models/."""
    from ultralytics import YOLO

    yolo_targets = [
        ("yolo11n-pose.pt", "Pose & Person Keypoint Tracker"),
        ("yolo11n.pt", "Fast General Object Detector (person, laptop, cup, handbag, cell phone, chair)"),
        ("yolov8s-worldv2.pt", "Open-Vocabulary Domain Object Detector (safe, cash, bag, counter)"),
    ]

    for filename, desc in yolo_targets:
        target_path = MODELS_DIR / filename
        if target_path.exists() and target_path.stat().st_size > 1_000_000:
            logger.info(f"[OK] {filename} ({desc}) already exists at {target_path} ({target_path.stat().st_size / 1e6:.1f} MB)")
            continue

        logger.info(f"Downloading {filename} ({desc})...")
        try:
            # Initializing YOLO with model name downloads it to current dir or settings dir
            model = YOLO(str(target_path))
            if not target_path.exists() and Path(filename).exists():
                shutil.move(filename, target_path)
            logger.info(f"[SUCCESS] Saved {filename} ({target_path.stat().st_size / 1e6:.1f} MB)")
        except Exception as e:
            logger.error(f"Failed to download {filename}: {e}")
            sys.exit(1)


def verify_embedding_model():
    """Ensures intfloat/multilingual-e5-small is cached for offline RAG."""
    emb_name = os.getenv("EMBEDDING_MODEL_NAME", "intfloat/multilingual-e5-small")
    logger.info(f"Verifying embedding model '{emb_name}' in local cache...")
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(emb_name)
        vec = model.encode("query: проверка кассовой дисциплины", normalize_embeddings=True)
        logger.info(f"[OK] Embedding model '{emb_name}' ready (dim={len(vec)})")
    except Exception as e:
        logger.error(f"Failed to verify embedding model: {e}")
        sys.exit(1)


def main():
    logger.info("=== Starting Local Model Weights Setup (Rule 1 & Rule 2) ===")
    download_yolo_models()
    verify_embedding_model()
    logger.info("=== All Local Model Weights Ready for 100% Offline Inference! ===")


if __name__ == "__main__":
    main()
