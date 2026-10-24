"""Seed sample inspections when the database is empty."""

from __future__ import annotations

import logging
from typing import Optional

from app.config import settings
from app.db import count_inspections, create_inspection
from app.privacy import normalize_locality
from app.risk import score_finding, overall_risk

logger = logging.getLogger(__name__)


def seed_if_empty(db_path: Optional[str] = None) -> int:
    """
    Insert sample inspections only when SEED_DEMO_DATA is true and DB is empty.
    All seeded rows have is_sample=True.
    Returns number of inspections inserted.
    """
    if not getattr(settings, "SEED_DEMO_DATA", False):
        return 0

    if count_inspections(db_path) > 0:
        return 0

    samples = [
        {
            "locality": "Adyar",
            "findings": [
                {
                    "container_type": "tyre",
                    "source": "sample",
                    "water_status": "present",
                    "covered": False,
                },
                {
                    "container_type": "bucket",
                    "source": "sample",
                    "water_status": "uncertain",
                    "covered": False,
                },
            ],
        },
        {
            "locality": "T Nagar",
            "findings": [
                {
                    "container_type": "plant pot or saucer",
                    "source": "sample",
                    "water_status": "absent",
                    "covered": True,
                },
            ],
        },
        {
            "locality": "Velachery",
            "findings": [
                {
                    "container_type": "drain inlet",
                    "source": "sample",
                    "water_status": "present",
                    "covered": False,
                },
                {
                    "container_type": "bottle",
                    "source": "sample",
                    "water_status": "absent",
                    "covered": False,
                },
            ],
        },
    ]

    inserted = 0
    for sample in samples:
        scored_findings = []
        for f in sample["findings"]:
            result = score_finding(
                f["container_type"],
                f.get("water_status", "uncertain"),
                f.get("covered"),
            )
            scored_findings.append(
                {
                    **f,
                    "confidence": None,
                    "bbox": None,
                    "water_source": "sample",
                    **result,
                }
            )
        overall_score, overall_category, _ = overall_risk(scored_findings)
        create_inspection(
            locality=normalize_locality(sample["locality"]),
            image_ref=None,
            overall_score=overall_score,
            overall_category=overall_category,
            consent=True,
            is_sample=True,
            findings=scored_findings,
            db_path=db_path,
        )
        inserted += 1

    logger.info("Seeded %d sample inspections", inserted)
    return inserted
