"""Optional real-model integration tests using actual weights on disk.

These tests run real Ultralytics inference against files in backend/
and are marked with @pytest.mark.real_model so standard CI / unit test runs
remain fast and deterministic.
"""

from pathlib import Path
import pytest
from PIL import Image

from app.config import settings
from app.detection import detect, init_detector, state

BACKEND_DIR = Path(__file__).resolve().parent.parent
YOLO_WORLD_FILE = BACKEND_DIR / "yolov8s-world.pt"
YOLO11N_FILE = BACKEND_DIR / "yolo11n.pt"


def _make_test_image(path: Path):
    img = Image.new("RGB", (320, 320), color=(120, 150, 180))
    img.save(path, format="JPEG")


@pytest.mark.real_model
def test_yolov8_world_real_loading_and_prompts(tmp_path: Path):
    if not YOLO_WORLD_FILE.is_file():
        pytest.skip(f"YOLO-World weights not found at {YOLO_WORLD_FILE}")

    test_img = tmp_path / "test_eval.jpg"
    _make_test_image(test_img)

    settings.MODEL_PATH = str(YOLO_WORLD_FILE)
    init_detector(force=True)

    assert state.loaded is True
    assert state.mode == "yolo_world"
    assert "world" in state.model_name.lower()

    res = detect(str(test_img))
    assert res["mode"] == "yolo_world"
    assert isinstance(res["detections"], list)
    assert res["error"] is None


@pytest.mark.real_model
def test_yolo11n_real_loading_and_coco_filtering(tmp_path: Path):
    if not YOLO11N_FILE.is_file():
        pytest.skip(f"YOLO11n weights not found at {YOLO11N_FILE}")

    test_img = tmp_path / "test_coco.jpg"
    _make_test_image(test_img)

    settings.MODEL_PATH = str(YOLO11N_FILE)
    init_detector(force=True)

    assert state.loaded is True
    assert state.mode == "coco"
    assert "11" in state.model_name.lower()

    res = detect(str(test_img))
    assert res["mode"] == "coco"
    assert isinstance(res["detections"], list)
    assert res["error"] is None
