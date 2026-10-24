"""Pytest fixtures: temporary database and upload directory."""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest
from PIL import Image
from fastapi.testclient import TestClient

# Ensure backend package is importable
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Point settings at temp paths before importing app modules that read settings
os.environ.setdefault("DB_PATH", ":memory:")  # overridden per-test with file
os.environ.setdefault("MAX_UPLOAD_MB", "1")
os.environ.setdefault("MODEL_PATH", "")
os.environ.setdefault("WATER_MODEL_PATH", "")
os.environ.setdefault("FACE_BLUR", "false")
os.environ.setdefault("ALLOWED_ORIGINS", "http://testserver")


@pytest.fixture()
def tmp_db(tmp_path: Path):
    db_file = tmp_path / "test.db"
    return str(db_file)


@pytest.fixture()
def tmp_upload(tmp_path: Path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    return upload_dir


@pytest.fixture()
def client(tmp_db: str, tmp_upload: Path, monkeypatch: pytest.MonkeyPatch):
    """FastAPI TestClient with isolated DB and upload dir; no seed data."""
    monkeypatch.setenv("DB_PATH", tmp_db)
    monkeypatch.setenv("MAX_UPLOAD_MB", "1")

    # Re-import / reconfigure settings and modules that cache paths
    from app.config import settings

    monkeypatch.setattr(settings, "DB_PATH", tmp_db)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_upload))
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    monkeypatch.setattr(settings, "MODEL_PATH", "")
    monkeypatch.setattr(settings, "ENABLE_YOLO_WORLD", False)
    monkeypatch.setattr(settings, "ENABLE_COCO", False)

    from app.db import init_db
    from app.detection import init_detector
    from app.water_classifier import init_water_classifier

    init_db(tmp_db)
    init_detector(force=True)
    init_water_classifier()

    # Patch db helpers used by routes to use tmp_db
    import app.db as db_mod
    import app.routes.api as api_mod
    import app.privacy as privacy_mod

    def _with_db(fn):
        def wrapper(*args, **kwargs):
            kwargs.setdefault("db_path", tmp_db)
            return fn(*args, **kwargs)

        return wrapper

    monkeypatch.setattr(api_mod, "create_inspection", _with_db(db_mod.create_inspection))
    monkeypatch.setattr(api_mod, "get_inspection", _with_db(db_mod.get_inspection))
    monkeypatch.setattr(api_mod, "list_inspections", _with_db(db_mod.list_inspections))
    monkeypatch.setattr(api_mod, "delete_inspection", _with_db(db_mod.delete_inspection))
    monkeypatch.setattr(api_mod, "update_finding", _with_db(db_mod.update_finding))
    monkeypatch.setattr(api_mod, "analytics", _with_db(db_mod.analytics))

    monkeypatch.setattr(privacy_mod.settings, "UPLOAD_DIR", str(tmp_upload))
    monkeypatch.setattr(privacy_mod.settings, "MAX_UPLOAD_MB", 1)

    # Ensure save uses tmp upload
    original_save = privacy_mod.save_sanitized_image

    def save_to_tmp(data, upload_dir=None):
        return original_save(data, upload_dir=tmp_upload)

    monkeypatch.setattr(privacy_mod, "save_sanitized_image", save_to_tmp)
    monkeypatch.setattr(api_mod, "save_sanitized_image", save_to_tmp)

    original_delete = privacy_mod.delete_image_file

    def delete_from_tmp(image_ref, upload_dir=None):
        return original_delete(image_ref, upload_dir=tmp_upload)

    monkeypatch.setattr(privacy_mod, "delete_image_file", delete_from_tmp)
    monkeypatch.setattr(api_mod, "delete_image_file", delete_from_tmp)

    def get_safe_from_tmp(image_ref, upload_dir=None):
        return privacy_mod.get_safe_image_path(image_ref, upload_dir=tmp_upload)

    monkeypatch.setattr(api_mod, "get_safe_image_path", get_safe_from_tmp)

    from app.main import app

    with TestClient(app) as c:
        yield c


def make_jpeg_bytes(width: int = 64, height: int = 64, color=(100, 150, 200)) -> bytes:
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_png_bytes(width: int = 64, height: int = 64) -> bytes:
    img = Image.new("RGB", (width, height), (50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
