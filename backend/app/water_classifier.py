"""Swappable water-presence classifier.

Default implementation returns unavailable because no trained classifier
is supplied. If WATER_MODEL_PATH loads successfully, predictions are
exposed only as unverified AI suggestions; users must confirm manually.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class WaterClassifierState:
    def __init__(self) -> None:
        self.loaded: bool = False
        self.model_name: str = "none"
        self.error: Optional[str] = None
        self._model: Any = None


water_state = WaterClassifierState()


def init_water_classifier() -> None:
    """Attempt to load water model; fail gracefully."""
    water_state.loaded = False
    water_state.model_name = "none"
    water_state.error = None
    water_state._model = None

    path = settings.WATER_MODEL_PATH
    if not path:
        water_state.error = "WATER_MODEL_PATH not configured"
        return

    p = Path(path)
    if not p.is_file():
        water_state.error = f"WATER_MODEL_PATH does not exist: {path}"
        return

    try:
        # Placeholder for a real classifier load.
        # We do not assume a specific format; if import/load fails we stay unavailable.
        # Example: torch.load or ultralytics — left intentionally minimal.
        water_state._model = {"path": str(p)}  # stub handle
        water_state.loaded = True
        water_state.model_name = p.name
        water_state.error = None
        logger.info("Water classifier path accepted: %s", p.name)
    except Exception as exc:  # noqa: BLE001
        water_state.error = f"Failed to load water model: {exc}"
        logger.warning(water_state.error)


def predict(image_crop: Any = None) -> Dict[str, Any]:
    """
    Predict water presence for an image crop.

    Returns:
        status: present | absent | uncertain | unavailable
        confidence: float or None
        source: model name or "unavailable"
    """
    if not water_state.loaded or water_state._model is None:
        return {
            "status": "unavailable",
            "confidence": None,
            "source": "unavailable",
            "note": (
                "No trained water classifier is available. "
                "User must confirm water presence manually."
            ),
        }

    # When a real model exists this would run inference.
    # Until then we still return unavailable to avoid false claims.
    return {
        "status": "unavailable",
        "confidence": None,
        "source": water_state.model_name,
        "note": (
            "Water model path is set but inference is not implemented. "
            "Treat any future output as an unverified AI suggestion only."
        ),
    }
