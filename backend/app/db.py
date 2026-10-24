"""SQLite database helpers with foreign keys and cascade deletion."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

from app.config import settings


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    target = Path(db_path or settings.DB_PATH)
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session(db_path: Optional[str] = None) -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Optional[str] = None) -> None:
    """Create tables if they do not exist and ensure columns exist."""
    with db_session(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS inspections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                locality TEXT NOT NULL,
                image_ref TEXT,
                overall_score INTEGER NOT NULL DEFAULT 0,
                overall_category TEXT NOT NULL DEFAULT 'Low',
                consent INTEGER NOT NULL DEFAULT 0,
                is_sample INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_id INTEGER NOT NULL,
                container_type TEXT NOT NULL,
                source TEXT,
                confidence REAL,
                bbox_json TEXT,
                water_status TEXT,
                water_source TEXT,
                covered INTEGER,
                score INTEGER NOT NULL DEFAULT 0,
                category TEXT NOT NULL DEFAULT 'Low',
                explanation TEXT,
                action TEXT,
                raw_class TEXT,
                user_decision TEXT,
                FOREIGN KEY (inspection_id)
                    REFERENCES inspections(id) ON DELETE CASCADE
            );
            """
        )
        cur = conn.execute("PRAGMA table_info(findings)")
        existing_cols = {row["name"] for row in cur.fetchall()}
        if "raw_class" not in existing_cols:
            conn.execute("ALTER TABLE findings ADD COLUMN raw_class TEXT")
        if "user_decision" not in existing_cols:
            conn.execute("ALTER TABLE findings ADD COLUMN user_decision TEXT")


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return dict(row) if row is not None else {}


def create_inspection(
    locality: str,
    image_ref: Optional[str],
    overall_score: int,
    overall_category: str,
    consent: bool,
    is_sample: bool,
    findings: List[Dict[str, Any]],
    db_path: Optional[str] = None,
) -> int:
    """Insert inspection and its findings. Returns inspection id."""
    with db_session(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO inspections
                (created_at, locality, image_ref, overall_score, overall_category, consent, is_sample)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _utc_now(),
                locality,
                image_ref,
                overall_score,
                overall_category,
                1 if consent else 0,
                1 if is_sample else 0,
            ),
        )
        inspection_id = cur.lastrowid

        for f in findings:
            bbox = f.get("bbox")
            bbox_json = json.dumps(bbox) if bbox is not None else None
            covered = f.get("covered")
            covered_int = None if covered is None else (1 if covered else 0)
            conn.execute(
                """
                INSERT INTO findings
                    (inspection_id, container_type, source, confidence, bbox_json,
                     water_status, water_source, covered, score, category, explanation, action,
                     raw_class, user_decision)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    inspection_id,
                    f.get("container_type", "other"),
                    f.get("source"),
                    f.get("confidence"),
                    bbox_json,
                    f.get("water_status"),
                    f.get("water_source"),
                    covered_int,
                    f.get("score", 0),
                    f.get("category", "Low"),
                    f.get("explanation"),
                    f.get("action"),
                    f.get("raw_class"),
                    f.get("user_decision"),
                ),
            )
        return int(inspection_id)


def get_inspection(inspection_id: int, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with db_session(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM inspections WHERE id = ?", (inspection_id,)
        ).fetchone()
        if not row:
            return None
        insp = row_to_dict(row)
        insp["consent"] = bool(insp.get("consent"))
        insp["is_sample"] = bool(insp.get("is_sample"))
        findings_rows = conn.execute(
            "SELECT * FROM findings WHERE inspection_id = ? ORDER BY id",
            (inspection_id,),
        ).fetchall()
        findings = []
        for fr in findings_rows:
            fd = row_to_dict(fr)
            fd["covered"] = None if fd.get("covered") is None else bool(fd["covered"])
            if fd.get("bbox_json"):
                try:
                    fd["bbox"] = json.loads(fd["bbox_json"])
                except json.JSONDecodeError:
                    fd["bbox"] = None
            else:
                fd["bbox"] = None
            del fd["bbox_json"]
            findings.append(fd)
        insp["findings"] = findings
        return insp


def list_inspections(
    risk: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM inspections WHERE 1=1"
    params: List[Any] = []

    if risk:
        query += " AND overall_category = ?"
        params.append(risk)
    if date_from:
        query += " AND created_at >= ?"
        params.append(date_from)
    if date_to:
        # inclusive end of day if date only
        if len(date_to) == 10:
            date_to = date_to + "T23:59:59.999999+00:00"
        query += " AND created_at <= ?"
        params.append(date_to)

    query += " ORDER BY created_at DESC"

    with db_session(db_path) as conn:
        rows = conn.execute(query, params).fetchall()
        results = []
        for row in rows:
            d = row_to_dict(row)
            d["consent"] = bool(d.get("consent"))
            d["is_sample"] = bool(d.get("is_sample"))
            results.append(d)
        return results


def update_finding(
    inspection_id: int,
    finding_id: int,
    container_type: Optional[str] = None,
    water_status: Optional[str] = None,
    covered: Optional[bool] = None,
    user_decision: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update a finding, recalculate its heuristic score, and update the parent inspection."""
    from app.risk import score_finding, overall_risk

    with db_session(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM findings WHERE id = ? AND inspection_id = ?",
            (finding_id, inspection_id),
        ).fetchone()
        if not row:
            return None
        existing = dict(row)

        new_type = container_type if container_type is not None else existing["container_type"]
        new_water = water_status if water_status is not None else (existing.get("water_status") or "uncertain")
        new_covered = covered if covered is not None else (bool(existing["covered"]) if existing.get("covered") is not None else None)
        new_decision = user_decision if user_decision is not None else existing.get("user_decision")

        if new_decision == "rejected":
            score = 0
            category = "Low"
            explanation = f"Finding rejected by user ({new_type})."
            action = "No action required."
        else:
            scored = score_finding(new_type, new_water, new_covered)
            score = scored["score"]
            category = scored["category"]
            explanation = scored["explanation"]
            action = scored["action"]

        covered_int = None if new_covered is None else (1 if new_covered else 0)

        conn.execute(
            """
            UPDATE findings
            SET container_type = ?, water_status = ?, covered = ?,
                score = ?, category = ?, explanation = ?, action = ?, user_decision = ?
            WHERE id = ? AND inspection_id = ?
            """,
            (
                new_type,
                new_water,
                covered_int,
                score,
                category,
                explanation,
                action,
                new_decision,
                finding_id,
                inspection_id,
            ),
        )

        # Recalculate parent inspection overall score from all non-rejected findings
        all_findings_rows = conn.execute(
            "SELECT score, category, user_decision FROM findings WHERE inspection_id = ?",
            (inspection_id,),
        ).fetchall()
        active_findings = [
            {"score": r["score"], "category": r["category"]}
            for r in all_findings_rows
            if r["user_decision"] != "rejected"
        ]
        overall_score, overall_cat, _ = overall_risk(active_findings)
        conn.execute(
            "UPDATE inspections SET overall_score = ?, overall_category = ? WHERE id = ?",
            (overall_score, overall_cat, inspection_id),
        )

    return get_inspection(inspection_id, db_path=db_path)


def delete_inspection(inspection_id: int, db_path: Optional[str] = None) -> Optional[str]:
    """
    Delete inspection (cascade findings). Returns image_ref for file cleanup only
    if no other inspection references it.
    """
    with db_session(db_path) as conn:
        row = conn.execute(
            "SELECT image_ref FROM inspections WHERE id = ?", (inspection_id,)
        ).fetchone()
        if not row:
            return None
        image_ref = row["image_ref"]
        conn.execute("DELETE FROM inspections WHERE id = ?", (inspection_id,))
        if image_ref:
            remaining = conn.execute(
                "SELECT COUNT(*) AS c FROM inspections WHERE image_ref = ?", (image_ref,)
            ).fetchone()["c"]
            if remaining > 0:
                return None
        return image_ref


def analytics(db_path: Optional[str] = None) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM inspections").fetchone()["c"]

        by_risk = {"Low": 0, "Medium": 0, "High": 0}
        for row in conn.execute(
            "SELECT overall_category, COUNT(*) AS c FROM inspections GROUP BY overall_category"
        ):
            cat = row["overall_category"]
            if cat in by_risk:
                by_risk[cat] = row["c"]

        top_containers = [
            {"container_type": r["container_type"], "count": r["c"]}
            for r in conn.execute(
                """
                SELECT container_type, COUNT(*) AS c
                FROM findings
                GROUP BY container_type
                ORDER BY c DESC
                LIMIT 10
                """
            )
        ]

        locality_breakdown = [
            {
                "locality": r["locality"],
                "count": r["c"],
                "avg_score": round(r["avg_score"] or 0, 2),
            }
            for r in conn.execute(
                """
                SELECT locality, COUNT(*) AS c, AVG(overall_score) AS avg_score
                FROM inspections
                GROUP BY locality
                ORDER BY c DESC
                """
            )
        ]

        # Repeat findings by locality: localities with more than one inspection
        repeat_findings = [
            {"locality": r["locality"], "inspection_count": r["c"]}
            for r in conn.execute(
                """
                SELECT locality, COUNT(*) AS c
                FROM inspections
                GROUP BY locality
                HAVING c > 1
                ORDER BY c DESC
                """
            )
        ]

        total_findings = conn.execute(
            "SELECT COUNT(*) AS c FROM findings WHERE user_decision != 'rejected' OR user_decision IS NULL"
        ).fetchone()["c"]
        confirmed_findings = conn.execute(
            "SELECT COUNT(*) AS c FROM findings WHERE user_decision = 'confirmed' OR (source = 'user' AND (user_decision IS NULL OR user_decision != 'rejected'))"
        ).fetchone()["c"]

        return {
            "total_inspections": total,
            "by_risk_category": by_risk,
            "top_container_types": top_containers,
            "repeat_findings_by_locality": repeat_findings,
            "locality_breakdown": locality_breakdown,
            "total_confirmed_findings": confirmed_findings,
            "total_findings": total_findings,
        }


def count_inspections(db_path: Optional[str] = None) -> int:
    with db_session(db_path) as conn:
        return int(conn.execute("SELECT COUNT(*) AS c FROM inspections").fetchone()["c"])
