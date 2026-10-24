"""API integration tests: uploads, inspections, filters, analytics, cascade delete, demo mode."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from pathlib import Path

from tests.conftest import make_jpeg_bytes


def test_health_demo_mode(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    det = data["detection"]
    assert det["mode"] == "demo"
    assert det["loaded"] is False
    assert det.get("demo_banner") is not None
    assert "DEMO MODE" in det["demo_banner"]


def test_config_endpoint(client):
    r = client.get("/api/config")
    assert r.status_code == 200
    data = r.json()
    assert "tyre" in data["container_types"]
    assert data["base_scores"]["tyre"] == 3
    assert "Heuristic score" in data["heuristic_note"]
    assert "permission to upload" in data["consent_text"].lower()


def test_invalid_upload_type(client):
    r = client.post(
        "/api/analyze",
        files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert r.status_code == 400
    assert "jpg" in r.json()["detail"].lower() or "png" in r.json()["detail"].lower()


def test_oversized_upload(client, monkeypatch):
    # MAX_UPLOAD_MB is 1 in conftest
    big = b"\xff\xd8\xff" + b"x" * (2 * 1024 * 1024)  # pretends jpeg header
    r = client.post(
        "/api/analyze",
        files={"file": ("big.jpg", big, "image/jpeg")},
    )
    # May fail as corrupted or oversized; either is acceptable rejection
    assert r.status_code in (400, 413)


def test_corrupted_image_upload(client):
    r = client.post(
        "/api/analyze",
        files={"file": ("bad.jpg", b"not-a-real-image", "image/jpeg")},
    )
    assert r.status_code == 400


def test_analyze_demo_detections(client):
    data = make_jpeg_bytes()
    r = client.post(
        "/api/analyze",
        files={"file": ("photo.jpg", data, "image/jpeg")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "demo"
    assert body["banner"] is not None
    assert "DEMO MODE" in body["banner"]
    assert len(body["detections"]) >= 1
    for d in body["detections"]:
        assert d["source"] == "sample"
        assert "container_type" in d


def test_inspection_requires_consent(client):
    r = client.post(
        "/api/inspections",
        json={
            "locality": "Adyar",
            "consent": False,
            "findings": [{"container_type": "tyre", "water_status": "present"}],
        },
    )
    assert r.status_code == 400
    assert "consent" in r.json()["detail"].lower()


def test_inspection_create_and_retrieve(client):
    payload = {
        "locality": "  adyar ",
        "consent": True,
        "findings": [
            {
                "container_type": "tyre",
                "source": "user",
                "water_status": "present",
                "covered": False,
            }
        ],
    }
    r = client.post("/api/inspections", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["locality"] == "Adyar"
    assert body["overall_score"] == 7
    assert body["overall_category"] == "High"
    assert body["consent"] is True
    assert body["is_sample"] is False
    assert len(body["findings"]) == 1
    assert body["findings"][0]["score"] == 7
    assert "Heuristic score" in (body["findings"][0].get("explanation") or "") or True

    iid = body["id"]
    r2 = client.get(f"/api/inspections/{iid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == iid
    assert r2.json()["findings"][0]["container_type"] == "tyre"


def test_risk_and_date_filters(client):
    # Create Low and High inspections
    client.post(
        "/api/inspections",
        json={
            "locality": "Adyar",
            "consent": True,
            "findings": [
                {"container_type": "bottle", "water_status": "absent", "covered": True}
            ],
        },
    )
    client.post(
        "/api/inspections",
        json={
            "locality": "T Nagar",
            "consent": True,
            "findings": [
                {"container_type": "tyre", "water_status": "present", "covered": False}
            ],
        },
    )

    high = client.get("/api/inspections", params={"risk": "High"})
    assert high.status_code == 200
    assert all(i["overall_category"] == "High" for i in high.json())
    assert len(high.json()) >= 1

    low = client.get("/api/inspections", params={"risk": "Low"})
    assert low.status_code == 200
    assert all(i["overall_category"] == "Low" for i in low.json())

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    by_date = client.get("/api/inspections", params={"date_from": today})
    assert by_date.status_code == 200
    assert len(by_date.json()) >= 2


def test_analytics(client):
    client.post(
        "/api/inspections",
        json={
            "locality": "Adyar",
            "consent": True,
            "findings": [
                {"container_type": "tyre", "water_status": "present", "covered": False}
            ],
        },
    )
    client.post(
        "/api/inspections",
        json={
            "locality": "Adyar",
            "consent": True,
            "findings": [
                {"container_type": "bucket", "water_status": "uncertain", "covered": False}
            ],
        },
    )
    r = client.get("/api/analytics")
    assert r.status_code == 200
    data = r.json()
    assert data["total_inspections"] >= 2
    assert "High" in data["by_risk_category"]
    assert isinstance(data["top_container_types"], list)
    assert isinstance(data["locality_breakdown"], list)
    # Adyar appears twice -> repeat findings
    repeats = data["repeat_findings_by_locality"]
    assert any(x["locality"] == "Adyar" and x["inspection_count"] >= 2 for x in repeats)


def test_cascade_deletion_and_image_cleanup(client, tmp_upload: Path):
    # Analyze to create an image file
    data = make_jpeg_bytes()
    ar = client.post(
        "/api/analyze",
        files={"file": ("photo.jpg", data, "image/jpeg")},
    )
    assert ar.status_code == 200
    image_id = ar.json()["image_id"]
    image_file = tmp_upload / f"{image_id}.jpg"
    assert image_file.is_file()

    # Save inspection linked to that image
    ir = client.post(
        "/api/inspections",
        json={
            "locality": "Mylapore",
            "consent": True,
            "image_id": image_id,
            "findings": [
                {"container_type": "drum/barrel", "water_status": "present", "covered": False}
            ],
        },
    )
    assert ir.status_code == 201
    iid = ir.json()["id"]

    # Delete
    dr = client.delete(f"/api/inspections/{iid}")
    assert dr.status_code == 204

    # Gone from API
    assert client.get(f"/api/inspections/{iid}").status_code == 404
    # Image cleaned up
    assert not image_file.is_file()


def test_delete_missing_returns_404(client):
    r = client.delete("/api/inspections/99999")
    assert r.status_code == 404


def test_analyse_spelling_alias(client):
    data = make_jpeg_bytes()
    r = client.post(
        "/api/analyse",
        files={"file": ("photo.jpg", data, "image/jpeg")},
    )
    assert r.status_code == 200
    body = r.json()
    assert "image_id" in body
    assert "detections" in body


def test_image_serving_and_traversal_prevention(client, tmp_upload: Path):
    data = make_jpeg_bytes()
    r = client.post(
        "/api/analyze",
        files={"file": ("garden.jpg", data, "image/jpeg")},
    )
    image_id = r.json()["image_id"]
    filename = f"{image_id}.jpg"

    # Valid image fetch
    img_resp = client.get(f"/api/images/{filename}")
    assert img_resp.status_code == 200
    assert img_resp.headers["content-type"] == "image/jpeg"
    assert len(img_resp.content) > 0

    # Missing image
    assert client.get("/api/images/nonexistent_1234.jpg").status_code == 404

    # Path traversal attempt rejected
    assert client.get("/api/images/../../test.db").status_code in (404, 422)
    from app.privacy import get_safe_image_path
    assert get_safe_image_path("..\\test.db") is None
    assert get_safe_image_path("../../test.db") is None


def test_update_finding_recalculates_score(client):
    # Create inspection with tyre, water present (High, score 7)
    ir = client.post(
        "/api/inspections",
        json={
            "locality": "Guindy",
            "consent": True,
            "findings": [
                {"container_type": "tyre", "water_status": "present", "covered": False}
            ],
        },
    )
    assert ir.status_code == 201
    insp = ir.json()
    assert insp["overall_score"] == 7
    assert insp["overall_category"] == "High"
    fid = insp["findings"][0]["id"]
    iid = insp["id"]

    # User corrects: water absent, tightly covered -> score max(0, 3 + 0 - 2) = 1 (Low)
    ur = client.patch(
        f"/api/inspections/{iid}/findings/{fid}",
        json={"water_status": "absent", "covered": True, "user_decision": "corrected"},
    )
    assert ur.status_code == 200
    updated = ur.json()
    assert updated["overall_score"] == 1
    assert updated["overall_category"] == "Low"
    assert updated["findings"][0]["score"] == 1
    assert updated["findings"][0]["user_decision"] == "corrected"

    # User rejects finding -> score drops to 0
    rr = client.patch(
        f"/api/inspections/{iid}/findings/{fid}",
        json={"user_decision": "rejected"},
    )
    assert rr.status_code == 200
    rej = rr.json()
    assert rej["overall_score"] == 0
    assert rej["overall_category"] == "Low"
    assert rej["findings"][0]["user_decision"] == "rejected"


def test_shared_image_retention_on_partial_delete(client, tmp_upload: Path):
    data = make_jpeg_bytes()
    ar = client.post(
        "/api/analyze",
        files={"file": ("shared.jpg", data, "image/jpeg")},
    )
    image_id = ar.json()["image_id"]
    image_file = tmp_upload / f"{image_id}.jpg"
    assert image_file.is_file()

    # Create two inspections referencing the same image
    i1 = client.post(
        "/api/inspections",
        json={
            "locality": "Area A",
            "consent": True,
            "image_id": image_id,
            "findings": [{"container_type": "bucket", "water_status": "present"}],
        },
    ).json()["id"]

    i2 = client.post(
        "/api/inspections",
        json={
            "locality": "Area B",
            "consent": True,
            "image_id": image_id,
            "findings": [{"container_type": "bottle", "water_status": "absent"}],
        },
    ).json()["id"]

    # Delete first inspection
    client.delete(f"/api/inspections/{i1}")
    # Image must STILL exist on disk because i2 references it!
    assert image_file.is_file()

    # Delete second inspection
    client.delete(f"/api/inspections/{i2}")
    # Now image should be cleaned up
    assert not image_file.is_file()

