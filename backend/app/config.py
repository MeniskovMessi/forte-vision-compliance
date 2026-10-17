"""
Application Configuration (`backend/app/config.py`)
Loads environment variables from `.env` with sensible local defaults.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    PROJECT_NAME: str = "ForteBank AI Vision Compliance Service"
    VERSION: str = "1.0.0"

    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    API_KEY: str = os.getenv("API_KEY", "fortebank-secret-2026-key")
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500"))

    STORAGE_DIR: Path = ROOT_DIR / "storage"
    UPLOAD_DIR: Path = ROOT_DIR / os.getenv("UPLOAD_DIR", "storage/uploads")
    TRIMMED_DIR: Path = ROOT_DIR / os.getenv("TRIMMED_DIR", "storage/trimmed")
    MODELS_DIR: Path = ROOT_DIR / "models"

    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "1234")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "fortebank_compliance")

    VIDEO_SAMPLE_FPS: float = float(os.getenv("VIDEO_SAMPLE_FPS", "1.0"))
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "intfloat/multilingual-e5-small")

    def ensure_dirs(self):
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.TRIMMED_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
