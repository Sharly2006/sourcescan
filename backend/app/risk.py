"""Pure risk-scoring functions for mosquito breeding container findings.

These are project heuristics for screening only, not official public-health scores.
"""

from typing import Any, Dict, List, Optional, Tuple

from app.config import ACTIONS, BASE_SCORES


HEURISTIC_NOTE = (
    "Heuristic score for screening only; see local health authority guidance."
)


def get_base_score(container_type: str) -> int:
    """Return base score for a container type (case-insensitive, trimmed)."""
    key = (container_type or "other").strip().lower()
    return BASE_SCORES.get(key, BASE_SCORES["other"])


def water_modifier(water_status: str) -> int:
    """Return water presence modifier."""
    status = (water_status or "uncertain").strip().lower()
    if status == "present":
        return 4
    if status == "absent":
        return 0
    # uncertain or anything else
    return 2


def cover_modifier(covered: Optional[bool]) -> int:
    """Return cover modifier. True = tightly covered, False/None = not covered."""
    if covered is True:
        return -2
    return 0


def score_category(score: int) -> str:
    """Map numeric score to Low / Medium / High."""
    if score <= 3:
        return "Low"
    if score <= 6:
        return "Medium"
    return "High"


def compute_score(
    container_type: str,
    water_status: str = "uncertain",
    covered: Optional[bool] = None,
) -> int:
    """
    Final score = base + water modifier + cover modifier, clamped to >= 0.
    """
    base = get_base_score(container_type)
    water = water_modifier(water_status)
    cover = cover_modifier(covered)
    return max(0, base + water + cover)


def build_explanation(
    container_type: str,
    water_status: str,
    covered: Optional[bool],
    score: int,
    category: str,
) -> str:
    """Generate a plain-language explanation of the score."""
    base = get_base_score(container_type)
    water = water_modifier(water_status)
    cover = cover_modifier(covered)

    parts: List[str] = []
    label = (container_type or "other").strip() or "other"

    if covered is True:
        parts.append(f"Tightly covered {label} (+{base})")
    else:
        parts.append(f"Uncovered {label} (+{base})")

    status = (water_status or "uncertain").strip().lower()
    if status == "present":
        parts.append(f"with standing water present (+{water})")
    elif status == "absent":
        parts.append(f"with water absent (+{water})")
    else:
        parts.append(f"with water uncertain (+{water})")

    if cover != 0:
        parts.append(f"cover adjustment ({cover:+d})")

    body = " ".join(parts)
    return f"{body} = {score}, {category}."


def recommended_action(container_type: str) -> str:
    """Look up recommended action for container type."""
    key = (container_type or "other").strip().lower()
    return ACTIONS.get(key, ACTIONS["other"])


def score_finding(
    container_type: str,
    water_status: str = "uncertain",
    covered: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Compute full scoring result for one finding.

    Returns dict with score, category, explanation, action, and heuristic note.
    """
    score = compute_score(container_type, water_status, covered)
    category = score_category(score)
    explanation = build_explanation(
        container_type, water_status, covered, score, category
    )
    action = recommended_action(container_type)
    return {
        "score": score,
        "category": category,
        "explanation": explanation,
        "action": action,
        "heuristic_note": HEURISTIC_NOTE,
    }


def overall_risk(findings: List[Dict[str, Any]]) -> Tuple[int, str, Dict[str, int]]:
    """
    Inspection overall risk is the highest container score.
    Also return counts per category.
    """
    if not findings:
        return 0, "Low", {"Low": 0, "Medium": 0, "High": 0}

    scores = [f.get("score", 0) for f in findings]
    overall = max(scores) if scores else 0
    category = score_category(overall)

    counts = {"Low": 0, "Medium": 0, "High": 0}
    for f in findings:
        cat = f.get("category") or score_category(f.get("score", 0))
        if cat in counts:
            counts[cat] += 1
        else:
            counts["Low"] += 1

    return overall, category, counts
