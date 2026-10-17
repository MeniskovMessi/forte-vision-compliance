"""
FastAPI Application Entrypoint (`backend/app/main.py`)
ForteBank AI Service for Detecting Cash Discipline Violations from Video Recordings.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.api.routes import router as v1_router, orchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} (100% Local Execution Mode)...")
    settings.ensure_dirs()
    try:
        orchestrator.stage1._load_models()
        orchestrator.stage4._get_embedder()
        logger.info("Local YOLOv11-pose, YOLOv11n, and multilingual-e5-small models pre-warmed and ready.")
    except Exception as e:
        logger.warning(f"Deferred model loading until first request: {e}")
    yield
    logger.info("Shutting down ForteBank Compliance API server.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "100% local AI compliance service for detecting bank cash discipline violations "
        "from CCTV recordings, supporting interval trimming `[start_sec, end_sec]` and "
        "PostgreSQL `pgvector` legal grounding in Republic of Kazakhstan regulations (`adilet.zan.kz`)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)

# Mount test_front/dist static files if built so http://localhost:8000 serves the Prism Web UI
test_front_dist = Path(__file__).resolve().parent.parent.parent / "test_front" / "dist"
if test_front_dist.exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(test_front_dist), html=True), name="test_front")
else:
    @app.get("/", tags=["Root"])
    async def root():
        return {
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs_url": "/docs",
            "health_url": "/api/v1/health",
            "analyze_endpoint": "POST /api/v1/analyze",
            "job_status_endpoint": "GET /api/v1/jobs/{job_id}",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=False)
