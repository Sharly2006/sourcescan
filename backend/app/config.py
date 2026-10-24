"""Application configuration loaded from environment variables."""

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for SourceScan backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Optional model paths — empty means not configured
    MODEL_PATH: str = ""
    WATER_MODEL_PATH: str = ""

    # Detection
    CONF_THRESHOLD: float = 0.10

    # Upload limits
    MAX_UPLOAD_MB: int = 5

    # Privacy
    FACE_BLUR: bool = False

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Database
    DB_PATH: str = "sourcescan.db"

    # Server
    PORT: int = 8000

    # Model toggles
    ENABLE_YOLO_WORLD: bool = False
    ENABLE_COCO: bool = False
    SEED_DEMO_DATA: bool = False

    # Paths (resolved relative to backend package parent)
    UPLOAD_DIR: str = "uploads"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path


# Canonical container types used across the app
CONTAINER_TYPES = [
    "tyre",
    "bucket",
    "drum/barrel",
    "water tank or sump",
    "cement tub",
    "plant pot or saucer",
    "drip tray or ac tray",
    "drain inlet",
    "bottle",
    "coconut shell",
    "other",
]

# Editable risk base scores (project heuristics)
BASE_SCORES = {
    "tyre": 3,
    "bucket": 3,
    "drum/barrel": 3,
    "water tank or sump": 3,
    "cement tub": 3,
    "plant pot or saucer": 2,
    "drip tray or ac tray": 2,
    "drain inlet": 2,
    "bottle": 1,
    "coconut shell": 1,
    "other": 1,
}

# Recommended actions lookup
ACTIONS = {
    "tyre": "Remove or dispose of discarded tyres",
    "bucket": "Empty and scrub; turn upside down when dry",
    "drum/barrel": "Cover or lid stored water; empty and scrub if unused",
    "water tank or sump": "Cover or lid stored water",
    "cement tub": "Empty and scrub; cover when not in use",
    "plant pot or saucer": "Empty and scrub; turn containers upside down when dry",
    "drip tray or ac tray": "Empty and scrub regularly",
    "drain inlet": "Clear drains",
    "bottle": "Empty and dispose or turn upside down",
    "coconut shell": "Remove or dispose of discarded coconut shells",
    "other": "Arrange an inspection",
}

# Sample localities for config endpoint
DEFAULT_LOCALITIES = [
    "Adyar",
    "Anna Nagar",
    "T Nagar",
    "Mylapore",
    "Velachery",
    "Other",
]

settings = Settings()
