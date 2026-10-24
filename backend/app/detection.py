
"""SourceScan detection module.

Returns a consistent dictionary for the API:
detections, mode, model_name, banner, and error.

Object detection is a screening aid only. It does not detect mosquito
larvae or diagnose mosquito-borne disease.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

CANONICAL_TYPES = {
    "bucket",
    "tyre",
    "drum",
    "water_tank",
    "plant_pot_or_saucer",
    "bottle",
    "can",
    "other_container",
    "unknown",
}

YOLO_WORLD_PROMPTS = [
    "bucket",
    "plastic bucket",
    "tyre",
    "rubber tire",
    "water drum",
    "water storage tank",
    "plant pot",
    "plant saucer",
    "plastic bottle",
    "can",
    "water-holding container",
]

COCO_SUPPORTED = {
    "bottle",
    "cup",
    "vase",
    "bowl",
    "potted plant",
    "handbag",
    "backpack",
    "suitcase",
}

DEMO_BANNER = (
    "DEMO MODE: prepared sample results, not AI predictions. "
    "Sample mode: this is example data, not a prediction from an AI model."
)

SCREENING_WARNING = (
    "Screening aid only. This result does not confirm mosquito breeding, "
    "detect larvae, diagnose disease, or replace local public-health guidance."
)

YOLO_WORLD_WARNING = (
    "YOLO-World can confuse visually similar objects. Confirm the container "
    "type before relying on a risk estimate."
)

COCO_WARNING = (
    "The general object detector is not specifically trained to identify "
    "mosquito breeding sources. Confirm the container type."
)


class DetectorState:
    """Stores the active detection model and its status."""

    def __init__(self) -> None:
        self._model: Any = None
        self._backend: str = "demo"
        self.model_name: str = "sample"
        self.initialized: bool = False
        self.error: Optional[str] = None

    @property
    def mode(self) -> str:
        """Expose the active mode expected by main.py."""
        return self._backend

    @property
    def loaded(self) -> bool:
        """Report whether an actual detection model is loaded."""
        return self._model is not None

    def to_dict(self) -> Dict[str, Any]:
        """Convert state to a dictionary for API health reporting."""
        return {
            "available": self.loaded,
            "backend": self.mode,
            "mode": self.mode,
            "loaded": self.loaded,
            "model_name": self.model_name,
            "error": self.error,
            "demo_banner": DEMO_BANNER if not self.loaded else None,
        }


state = DetectorState()


def _setting(name: str, default: Any = None) -> Any:
    """Read a configuration setting safely."""
    return getattr(settings, name, default)


def _normalise_label(label: str) -> str:
    """Convert labels to lowercase text with consistent spacing."""
    return " ".join(
        str(label).lower().replace("_", " ").replace("-", " ").split()
    )


def _map_class(raw_name: str) -> str:
    """Map explicitly supported labels to SourceScan container types.

    Unknown or ambiguous labels remain unknown instead of being guessed.
    This function maps model labels; it does not verify the object's
    actual appearance or whether it contains water.
    """
    label = _normalise_label(raw_name)

    exact_mappings = {
        # Buckets
        "bucket": "bucket",
        "plastic bucket": "bucket",
        "pail": "bucket",

        # Tyres / tires
        "tyre": "tyre",
        "tire": "tyre",
        "rubber tyre": "tyre",
        "rubber tire": "tyre",

        # Drums and barrels
        "drum": "drum/barrel",
        "water drum": "drum/barrel",
        "plastic drum": "drum/barrel",
        "barrel": "drum/barrel",
        "water barrel": "drum/barrel",
        "drum/barrel": "drum/barrel",

        # Water storage tanks
        "water tank": "water tank or sump",
        "water storage tank": "water tank or sump",
        "storage tank": "water tank or sump",
        "water tank or sump": "water tank or sump",
        "water_tank": "water tank or sump",

        # Cement tubs
        "cement tub": "cement tub",

        # Plant pots and saucers
        "plant pot": "plant pot or saucer",
        "flower pot": "plant pot or saucer",
        "plant saucer": "plant pot or saucer",
        "flower pot saucer": "plant pot or saucer",
        "potted plant": "plant pot or saucer",
        "plant pot or saucer": "plant pot or saucer",
        "plant_pot_or_saucer": "plant pot or saucer",
        "vase": "plant pot or saucer",

        # Drip / AC trays
        "drip tray": "drip tray or ac tray",
        "ac tray": "drip tray or ac tray",
        "drip tray or ac tray": "drip tray or ac tray",

        # Drain inlets
        "drain inlet": "drain inlet",
        "drain": "drain inlet",

        # Bottles
        "bottle": "bottle",
        "plastic bottle": "bottle",
        "water bottle": "bottle",

        # Coconut shells
        "coconut shell": "coconut shell",

        # Other containers
        "cup": "other",
        "bowl": "other",
        "can": "other",
        "tin can": "other",
        "beverage can": "other",
        "water holding container": "other",
        "water-holding container": "other",
        "other": "other",
    }

    return exact_mappings.get(label, "unknown")


def _warning_for(mapped: str, raw_name: str) -> str:
    """Create a warning explaining the limitations of a model result."""
    warnings: List[str] = []

    if mapped == "unknown":
        warnings.append(
            f"The model label '{raw_name}' is not a supported container type."
        )

    if state.mode == "yolo_world":
        warnings.append(YOLO_WORLD_WARNING)
    elif state.mode == "coco":
        warnings.append(COCO_WARNING)
    elif state.mode == "custom":
        warnings.append(
            "The configured model may not be specifically trained to identify "
            "mosquito breeding containers. Confirm the object manually."
        )

    warnings.append(SCREENING_WARNING)
    return " ".join(warnings)


def _try_load_custom() -> bool:
    """Load an Ultralytics model if MODEL_PATH is configured."""
    model_path = str(_setting("MODEL_PATH", "") or "").strip()

    if not model_path:
        return False

    path = Path(model_path).expanduser()

    if not path.is_file():
        state.error = f"Model file does not exist: {path}"
        logger.warning(state.error)
        return False

    try:
        from ultralytics import YOLO

        model = YOLO(str(path))
        state._model = model
        state.model_name = path.name

        # Detect model capability and configure accordingly
        if "world" in path.name.lower() or hasattr(model, "set_classes"):
            try:
                model.set_classes(YOLO_WORLD_PROMPTS)
                state._backend = "yolo_world"
                logger.info("Configured YOLO-World prompts on %s", path.name)
            except Exception as e:
                logger.warning("Could not set YOLO-World classes: %s", e)
                state._backend = "custom"
        elif "11" in path.name.lower() or "v8" in path.name.lower() or "coco" in path.name.lower():
            state._backend = "coco"
        else:
            state._backend = "custom"

        state.error = None
        logger.info("Loaded model (%s): %s", state._backend, path)
        return True

    except Exception as exc:
        state.error = f"Could not load custom model: {exc}"
        logger.exception(state.error)
        state._model = None
        return False


def _try_load_yolo_world() -> bool:
    """Load YOLO-World only when ENABLE_YOLO_WORLD is true."""
    if not bool(_setting("ENABLE_YOLO_WORLD", False)):
        return False

    try:
        from ultralytics import YOLO

        model_path = str(
            _setting("YOLO_WORLD_MODEL", "yolov8s-world.pt")
        )

        state._model = YOLO(model_path)

        if hasattr(state._model, "set_classes"):
            state._model.set_classes(YOLO_WORLD_PROMPTS)

        state._backend = "yolo_world"
        state.model_name = Path(model_path).name
        state.error = None

        logger.info("Loaded YOLO-World model: %s", model_path)
        return True

    except Exception as exc:
        state.error = f"Could not load YOLO-World: {exc}"
        logger.exception(state.error)
        state._model = None
        return False


def _try_load_coco() -> bool:
    """Load a general COCO model only when ENABLE_COCO is true."""
    if not bool(_setting("ENABLE_COCO", False)):
        return False

    try:
        from ultralytics import YOLO

        model_path = str(_setting("COCO_MODEL", "yolov8n.pt"))

        state._model = YOLO(model_path)
        state._backend = "coco"
        state.model_name = Path(model_path).name
        state.error = None

        logger.info("Loaded COCO model: %s", model_path)
        return True

    except Exception as exc:
        state.error = f"Could not load COCO model: {exc}"
        logger.exception(state.error)
        state._model = None
        return False


def detector_status() -> Dict[str, Any]:
    """Return the current detector status."""
    return {
        "available": state.loaded,
        "backend": state.mode,
        "mode": state.mode,
        "loaded": state.loaded,
        "model_name": state.model_name,
        "error": state.error,
    }


def init_detector(force: bool = False) -> Dict[str, Any]:
    """Initialize the configured detector or use sample mode."""
    if state.initialized and not force:
        return detector_status()

    state._model = None
    state._backend = "demo"
    state.model_name = "sample"
    state.error = None

    loaded = _try_load_custom()

    if not loaded:
        loaded = _try_load_yolo_world()

    if not loaded:
        loaded = _try_load_coco()

    if not loaded:
        state._backend = "demo"
        state.model_name = "sample"

    state.initialized = True

    logger.info(
        "Detector initialized: mode=%s model=%s loaded=%s",
        state.mode,
        state.model_name,
        state.loaded,
    )

    return detector_status()


def _demo_detections() -> List[Dict[str, Any]]:
    """Return labelled sample data, never a claimed AI prediction."""
    return [
        {
            "container_type": "bucket",
            "raw_class": "sample bucket",
            "confidence": None,
            "bbox": None,
            "source": "sample",
            "warning": DEMO_BANNER + " " + SCREENING_WARNING,
        }
    ]


def _run_model(image_path: str) -> List[Dict[str, Any]]:
    """Run the active model and convert detections to API-friendly records."""
    if state._model is None:
        return []

    results = state._model.predict(
        source=image_path,
        conf=float(_setting("CONF_THRESHOLD", 0.25)),
        verbose=False,
    )

    detections: List[Dict[str, Any]] = []
    source_tag = f"model:{state.model_name}"

    for result in results:
        names = result.names or {}
        boxes = result.boxes

        if boxes is None:
            continue

        logger.info("Raw detection count: %s", len(boxes))

        for box in boxes:
            cls_id = int(box.cls.item())
            raw_name = str(names.get(cls_id, "unknown"))

            confidence = (
                float(box.conf.item())
                if box.conf is not None
                else None
            )

            logger.info(
                "Candidate: %s | confidence=%.4f",
                raw_name,
                confidence if confidence is not None else 0.0,
            )

            if (
                state.mode == "coco"
                and _normalise_label(raw_name) not in COCO_SUPPORTED
            ):
                continue

            mapped = _map_class(raw_name)
            bbox = None

            coordinates = getattr(box, "xyxyn", None)

            if coordinates is not None:
                values = coordinates[0].tolist()

                if len(values) == 4:
                    bbox = [
                        round(float(value), 4)
                        for value in values
                    ]

            detections.append(
                {
                    "container_type": mapped,
                    "raw_class": raw_name,
                    "confidence": (
                        round(confidence, 4)
                        if confidence is not None
                        else None
                    ),
                    "bbox": bbox,
                    "source": source_tag,
                    "warning": _warning_for(mapped, raw_name),
                }
            )

    return detections


def detect(image_path: str) -> Dict[str, Any]:
    """Return a consistent dictionary for the image-analysis API."""
    if not state.initialized:
        init_detector()

    if state._model is not None:
        try:
            detections = _run_model(image_path)

            if state.mode == "yolo_world":
                banner = YOLO_WORLD_WARNING
            elif state.mode == "coco":
                banner = COCO_WARNING
            else:
                banner = SCREENING_WARNING

            return {
                "detections": detections,
                "mode": state.mode,
                "model_name": state.model_name,
                "banner": banner,
                "error": None,
            }

        except Exception as exc:
            logger.exception("Image detection failed: %s", exc)
            state.error = str(exc)

            return {
                "detections": [],
                "mode": state.mode,
                "model_name": state.model_name,
                "banner": SCREENING_WARNING,
                "error": state.error,
            }

    return {
        "detections": _demo_detections(),
        "mode": "demo",
        "model_name": "sample",
        "banner": DEMO_BANNER + " " + SCREENING_WARNING,
        "error": state.error,
    }


def manual_detection(container_type: str) -> Dict[str, Any]:
    """Create a user-confirmed detection when manual selection is used."""
    mapped = _map_class(container_type)

    return {
        "container_type": mapped,
        "raw_class": None,
        "confidence": None,
        "bbox": None,
        "source": "user",
        "warning": (
            None
            if mapped != "unknown"
            else "Please choose a supported container type."
        ),
    }
