"""SourceScan FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import init_db
from app.detection import init_detector
from app.privacy import PrivacyError
from app.routes.api import router
from app.seed import seed_if_empty
from app.water_classifier import init_water_classifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialise DB, detector, water classifier, and optional seed data."""
    logger.info("Starting SourceScan backend")
    init_db()
    init_detector()
    init_water_classifier()
    seeded = seed_if_empty()
    if seeded:
        logger.info("Inserted %d sample inspections", seeded)
    from app.detection import state as det_state

    logger.info(
        "Detector mode=%s model=%s loaded=%s",
        det_state.mode,
        det_state.model_name,
        det_state.loaded,
    )
    yield


app = FastAPI(
    title="SourceScan API",
    description=(
        "Beginner-friendly API for identification and risk prioritisation "
        "of potential mosquito breeding sources. "
        "Risk scores are project heuristics for screening only."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.exception_handler(PrivacyError)
async def privacy_error_handler(_request: Request, exc: PrivacyError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.mount("/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")

# Frontend SPA support when built
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        target = frontend_dist / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        if Path(full_path).suffix:
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def root() -> dict:
        return {
            "name": "SourceScan",
            "version": "0.1.0",
            "docs": "/docs",
            "health": "/api/health",
        }

