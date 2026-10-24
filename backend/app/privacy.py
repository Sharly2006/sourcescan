"""Image validation, EXIF stripping, and privacy helpers."""

import io
import re
import uuid
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, UnidentifiedImageError

from app.config import settings

# Allowed MIME types / extensions
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

CONSENT_TEXT = (
    "I have permission to upload this image; avoid photographing people"
)


class PrivacyError(Exception):
    """Raised when an upload fails privacy or validation checks."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def normalize_locality(name: Optional[str]) -> str:
    """
    Trim whitespace, collapse repeated spaces, and title-case the locality.
    Ensures 'adyar ' and 'Adyar' match.
    """
    if not name or not str(name).strip():
        return "Other"
    cleaned = re.sub(r"\s+", " ", str(name).strip())
    return cleaned.title()


def validate_content_type(content_type: Optional[str], filename: Optional[str]) -> None:
    """Reject uploads that are not JPG/JPEG/PNG."""
    ct = (content_type or "").lower().split(";")[0].strip()
    ext = Path(filename or "").suffix.lower()

    type_ok = ct in ALLOWED_CONTENT_TYPES or ct == "image/jpg"
    ext_ok = ext in ALLOWED_EXTENSIONS

    if not type_ok and not ext_ok:
        raise PrivacyError(
            "Only JPG, JPEG, and PNG images are accepted.",
            status_code=400,
        )


def validate_size(data: bytes) -> None:
    """Enforce MAX_UPLOAD_MB."""
    if len(data) > settings.max_upload_bytes:
        raise PrivacyError(
            f"File exceeds maximum size of {settings.MAX_UPLOAD_MB} MB.",
            status_code=413,
        )
    if len(data) == 0:
        raise PrivacyError("Empty file is not allowed.", status_code=400)


def open_and_validate_image(data: bytes) -> Image.Image:
    """
    Open image with Pillow. Reject corrupted or invalid images.
    Do not trust the extension alone.
    """
    try:
        img = Image.open(io.BytesIO(data))
        img.load()  # force decode to catch truncated files
    except UnidentifiedImageError as exc:
        raise PrivacyError(
            "File is not a valid image or is corrupted.",
            status_code=400,
        ) from exc
    except OSError as exc:
        raise PrivacyError(
            "File is not a valid image or is corrupted.",
            status_code=400,
        ) from exc

    if img.format not in ("JPEG", "PNG"):
        raise PrivacyError(
            "Only JPG, JPEG, and PNG images are accepted.",
            status_code=400,
        )
    return img


def strip_exif_and_reencode(img: Image.Image) -> bytes:
    """
    Re-encode the image and strip EXIF/GPS metadata.
    Converts to RGB for JPEG safety.
    """
    # Remove EXIF by creating a new image without metadata
    if img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        clean = background
    else:
        clean = img.convert("RGB")

    # Optional best-effort face blur (not a guarantee of privacy)
    if settings.FACE_BLUR:
        clean = _best_effort_face_blur(clean)

    buf = io.BytesIO()
    clean.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


def _best_effort_face_blur(img: Image.Image) -> Image.Image:
    """
    Best-effort face blur when FACE_BLUR is enabled.
    This is NOT a guarantee of privacy — clearly documented as such.
    Uses a simple downscale/upscale blur as a placeholder when no face
    detector is available, so the feature is non-destructive and optional.
    """
    # Without a dedicated face detector we apply a mild whole-image
    # privacy-preserving downsample only when the flag is on.
    # Callers must treat this as non-guaranteed.
    w, h = img.size
    small = img.resize((max(1, w // 8), max(1, h // 8)), Image.BILINEAR)
    return small.resize((w, h), Image.BILINEAR)


def save_sanitized_image(data: bytes, upload_dir: Optional[Path] = None) -> Tuple[str, str]:
    """
    Validate, re-encode, strip metadata, and save under a random UUID filename.
    Never uses the user-supplied filename in filesystem paths.

    Returns (image_id, relative_path_or_filename).
    """
    validate_size(data)
    img = open_and_validate_image(data)
    clean_bytes = strip_exif_and_reencode(img)

    image_id = str(uuid.uuid4())
    filename = f"{image_id}.jpg"
    directory = upload_dir or settings.upload_path
    directory.mkdir(parents=True, exist_ok=True)
    dest = directory / filename
    dest.write_bytes(clean_bytes)
    return image_id, filename


def get_safe_image_path(image_ref: Optional[str], upload_dir: Optional[Path] = None) -> Optional[Path]:
    """
    Safely resolve an image reference within upload_dir.
    Rejects filenames containing path separators or parent directory traversal.
    Returns None if missing or outside upload_dir.
    """
    if not image_ref:
        return None
    name = Path(image_ref).name
    if name != image_ref or ".." in image_ref:
        return None
    directory = (upload_dir or settings.upload_path).resolve()
    target = (directory / name).resolve()
    if not target.is_relative_to(directory):
        return None
    if not target.is_file():
        return None
    return target


def delete_image_file(image_ref: Optional[str], upload_dir: Optional[Path] = None) -> None:
    """Delete an associated image file if it exists. Ignores missing files."""
    if not image_ref:
        return
    name = Path(image_ref).name
    if name != image_ref or ".." in image_ref:
        return
    directory = (upload_dir or settings.upload_path).resolve()
    target = (directory / name).resolve()
    if target.is_relative_to(directory) and target.is_file():
        target.unlink(missing_ok=True)

