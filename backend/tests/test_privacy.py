"""Tests for locality normalization and image validation / privacy."""

import io

import pytest
from PIL import Image

from app.privacy import (
    PrivacyError,
    normalize_locality,
    open_and_validate_image,
    save_sanitized_image,
    strip_exif_and_reencode,
    validate_content_type,
    validate_size,
)
from tests.conftest import make_jpeg_bytes, make_png_bytes


def test_normalize_locality():
    assert normalize_locality("adyar ") == "Adyar"
    assert normalize_locality("Adyar") == "Adyar"
    assert normalize_locality("  t   nagar  ") == "T Nagar"
    assert normalize_locality("") == "Other"
    assert normalize_locality(None) == "Other"
    assert normalize_locality("   ") == "Other"


def test_validate_content_type_rejects_non_image():
    with pytest.raises(PrivacyError) as exc:
        validate_content_type("application/pdf", "file.pdf")
    assert exc.value.status_code == 400


def test_validate_content_type_accepts_jpeg_png():
    validate_content_type("image/jpeg", "photo.jpg")
    validate_content_type("image/png", "photo.png")
    validate_content_type("image/jpg", "photo.jpg")


def test_oversized_upload(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    big = b"x" * (2 * 1024 * 1024)
    with pytest.raises(PrivacyError) as exc:
        validate_size(big)
    assert exc.value.status_code == 413


def test_empty_file_rejected():
    with pytest.raises(PrivacyError):
        validate_size(b"")


def test_corrupted_image_rejected():
    with pytest.raises(PrivacyError) as exc:
        open_and_validate_image(b"not an image at all")
    assert "valid image" in exc.value.message.lower() or "corrupt" in exc.value.message.lower()


def test_valid_jpeg_accepted_and_reencoded(tmp_path):
    data = make_jpeg_bytes()
    img = open_and_validate_image(data)
    clean = strip_exif_and_reencode(img)
    assert len(clean) > 0
    # Re-open to confirm valid JPEG
    reopened = Image.open(io.BytesIO(clean))
    assert reopened.format == "JPEG"


def test_save_uses_uuid_filename(tmp_path):
    data = make_jpeg_bytes()
    image_id, filename = save_sanitized_image(data, upload_dir=tmp_path)
    assert filename == f"{image_id}.jpg"
    assert (tmp_path / filename).is_file()
    # Must not contain original name
    assert "photo" not in filename


def test_png_accepted(tmp_path):
    data = make_png_bytes()
    image_id, filename = save_sanitized_image(data, upload_dir=tmp_path)
    assert (tmp_path / filename).is_file()
