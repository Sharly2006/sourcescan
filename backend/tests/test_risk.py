"""Unit tests for risk scoring and category boundaries."""

from app.risk import (
    build_explanation,
    compute_score,
    get_base_score,
    overall_risk,
    recommended_action,
    score_category,
    score_finding,
    water_modifier,
    cover_modifier,
)


def test_base_scores():
    assert get_base_score("tyre") == 3
    assert get_base_score("Tyre") == 3
    assert get_base_score("bucket") == 3
    assert get_base_score("drum/barrel") == 3
    assert get_base_score("water tank or sump") == 3
    assert get_base_score("cement tub") == 3
    assert get_base_score("plant pot or saucer") == 2
    assert get_base_score("drip tray or ac tray") == 2
    assert get_base_score("drain inlet") == 2
    assert get_base_score("bottle") == 1
    assert get_base_score("coconut shell") == 1
    assert get_base_score("other") == 1
    assert get_base_score("unknown_thing") == 1


def test_water_and_cover_modifiers():
    assert water_modifier("present") == 4
    assert water_modifier("uncertain") == 2
    assert water_modifier("absent") == 0
    assert water_modifier("weird") == 2
    assert cover_modifier(True) == -2
    assert cover_modifier(False) == 0
    assert cover_modifier(None) == 0


def test_score_clamped_to_zero():
    # base 1 + water 0 + cover -2 = -1 -> 0
    assert compute_score("bottle", "absent", covered=True) == 0


def test_category_boundaries():
    assert score_category(0) == "Low"
    assert score_category(3) == "Low"
    assert score_category(4) == "Medium"
    assert score_category(6) == "Medium"
    assert score_category(7) == "High"
    assert score_category(10) == "High"


def test_uncovered_tyre_with_water_high():
    # base 3 + water 4 + cover 0 = 7 High
    score = compute_score("tyre", "present", covered=False)
    assert score == 7
    assert score_category(score) == "High"
    result = score_finding("tyre", "present", False)
    assert result["score"] == 7
    assert result["category"] == "High"
    assert "tyre" in result["explanation"].lower()
    assert "present" in result["explanation"].lower()
    assert "High" in result["explanation"]
    assert "Heuristic score" in result["heuristic_note"]


def test_covered_bottle_absent_low():
    score = compute_score("bottle", "absent", covered=True)
    assert score == 0
    assert score_category(score) == "Low"


def test_explanation_format():
    expl = build_explanation("tyre", "present", False, 7, "High")
    assert "Uncovered tyre (+3)" in expl
    assert "standing water present (+4)" in expl
    assert "= 7, High." in expl


def test_recommended_actions():
    assert "tyre" in recommended_action("tyre").lower() or "dispose" in recommended_action("tyre").lower()
    assert recommended_action("drain inlet")
    assert recommended_action("unknown") == recommended_action("other")


def test_overall_risk_highest_and_counts():
    findings = [
        score_finding("bottle", "absent", False),   # 1 Low
        score_finding("tyre", "present", False),    # 7 High
        score_finding("bucket", "uncertain", False),  # 5 Medium
    ]
    overall, cat, counts = overall_risk(findings)
    assert overall == 7
    assert cat == "High"
    assert counts["High"] == 1
    assert counts["Medium"] == 1
    assert counts["Low"] == 1


def test_overall_risk_empty():
    overall, cat, counts = overall_risk([])
    assert overall == 0
    assert cat == "Low"
    assert counts == {"Low": 0, "Medium": 0, "High": 0}
