#!/usr/bin/env python3
"""
Evaluate the active SourceScan detector against a labelled YOLO-format dataset.

Usage:
  python evaluate.py --dataset /path/to/dataset [--iou 0.5] [--output report.md]
  python evaluate.py --dataset /path/to/dataset --compare

Dataset layout (YOLO format):
  dataset/
    images/          # .jpg / .png
    labels/          # matching .txt files: class_id x_center y_center w h (normalized)

If the dataset is missing, prints instructions and exits without fabricated metrics.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Evaluate SourceScan detector on labelled data")
    p.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to folder containing images/ and labels/ subdirectories",
    )
    p.add_argument("--iou", type=float, default=0.5, help="IoU match threshold (default 0.5)")
    p.add_argument(
        "--output",
        type=str,
        default="evaluation_report.md",
        help="Markdown report path",
    )
    p.add_argument(
        "--compare",
        action="store_true",
        help="Compare zero-shot/demo baseline against custom weights if available",
    )
    return p.parse_args()


def iou_xyxy(a: List[float], b: List[float]) -> float:
    """Intersection-over-union for normalized xyxy boxes."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    if union <= 0:
        return 0.0
    return inter / union


def yolo_to_xyxy(cx: float, cy: float, w: float, h: float) -> List[float]:
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]


def load_labels(label_path: Path) -> List[Tuple[int, List[float]]]:
    """Return list of (class_id, xyxy_normalized)."""
    if not label_path.is_file():
        return []
    boxes = []
    for line in label_path.read_text().strip().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        cls_id = int(float(parts[0]))
        cx, cy, w, h = map(float, parts[1:5])
        boxes.append((cls_id, yolo_to_xyxy(cx, cy, w, h)))
    return boxes


def match_predictions(
    preds: List[dict],
    gts: List[Tuple[int, List[float]]],
    class_names: Dict[int, str],
    iou_thresh: float,
) -> Tuple[Dict[str, Dict[str, int]], int, int, int]:
    """
    Match predictions to ground truth by class + IoU.
    Returns per-class {tp, fp, fn}, and overall tp, fp, fn counts.
    """
    # Invert: class name -> list of gt boxes
    gt_by_class: Dict[str, List[List[float]]] = defaultdict(list)
    for cls_id, box in gts:
        name = class_names.get(cls_id, f"class_{cls_id}")
        gt_by_class[name].append(box)

    pred_by_class: Dict[str, List[List[float]]] = defaultdict(list)
    for p in preds:
        ctype = p.get("container_type", "other")
        bbox = p.get("bbox")
        if bbox and len(bbox) == 4:
            pred_by_class[ctype].append(bbox)

    all_classes = set(gt_by_class.keys()) | set(pred_by_class.keys())
    stats: Dict[str, Dict[str, int]] = {}
    total_tp = total_fp = total_fn = 0

    for cls in sorted(all_classes):
        gts_cls = gt_by_class.get(cls, [])
        preds_cls = pred_by_class.get(cls, [])
        matched_gt = set()
        tp = 0
        for pb in preds_cls:
            best_iou = 0.0
            best_j = -1
            for j, gb in enumerate(gts_cls):
                if j in matched_gt:
                    continue
                val = iou_xyxy(pb, gb)
                if val > best_iou:
                    best_iou = val
                    best_j = j
            if best_iou >= iou_thresh and best_j >= 0:
                tp += 1
                matched_gt.add(best_j)
        fp = len(preds_cls) - tp
        fn = len(gts_cls) - tp
        stats[cls] = {"tp": tp, "fp": fp, "fn": fn}
        total_tp += tp
        total_fp += fp
        total_fn += fn

    return stats, total_tp, total_fp, total_fn


def precision_recall(tp: int, fp: int, fn: int) -> Tuple[float, float]:
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    return prec, rec


def run_evaluation(
    dataset: Path,
    iou_thresh: float,
    output: Path,
    compare: bool,
) -> int:
    images_dir = dataset / "images"
    labels_dir = dataset / "labels"

    if not dataset.is_dir() or not images_dir.is_dir() or not labels_dir.is_dir():
        print(
            "Dataset not found or incomplete.\n\n"
            "Expected layout:\n"
            "  <dataset>/\n"
            "    images/     # image files (.jpg, .png, ...)\n"
            "    labels/     # YOLO .txt files with the same stem as each image\n"
            "               # each line: class_id x_center y_center width height  (normalized 0–1)\n\n"
            "Provide a real labelled folder and re-run. No metrics are invented."
        )
        return 1

    image_files = sorted(
        list(images_dir.glob("*.jpg"))
        + list(images_dir.glob("*.jpeg"))
        + list(images_dir.glob("*.png"))
    )
    if not image_files:
        print("No images found in", images_dir)
        print("No metrics are invented.")
        return 1

    # Import detector after path checks so missing deps don't block the help message
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from app.detection import init_detector, detect, state
    from app.config import CONTAINER_TYPES

    init_detector()

    # Class name map: we use canonical names; dataset may use numeric ids.
    # Without a data.yaml we map id -> "class_{id}" and note unmatched names.
    class_names: Dict[int, str] = {i: name for i, name in enumerate(CONTAINER_TYPES)}

    all_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    overall_tp = overall_fp = overall_fn = 0
    images_evaluated = 0
    unmatched_pred_classes = set()

    for img_path in image_files:
        label_path = labels_dir / (img_path.stem + ".txt")
        gts = load_labels(label_path)
        result = detect(str(img_path))
        preds = result.get("detections", [])

        # Track prediction classes not in our canonical set for explanation
        for p in preds:
            ct = p.get("container_type", "")
            if ct not in CONTAINER_TYPES and ct != "other":
                unmatched_pred_classes.add(ct)

        stats, tp, fp, fn = match_predictions(preds, gts, class_names, iou_thresh)
        for cls, s in stats.items():
            all_stats[cls]["tp"] += s["tp"]
            all_stats[cls]["fp"] += s["fp"]
            all_stats[cls]["fn"] += s["fn"]
        overall_tp += tp
        overall_fp += fp
        overall_fn += fn
        images_evaluated += 1

    lines = [
        "# SourceScan Detector Evaluation Report",
        "",
        f"- Dataset: `{dataset}`",
        f"- Images evaluated: {images_evaluated}",
        f"- IoU threshold: {iou_thresh}",
        f"- Detector mode: **{state.mode}** ({state.model_name})",
        f"- Detector loaded: {state.loaded}",
        "",
        "## Overall",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| True positives | {overall_tp} |",
        f"| False positives | {overall_fp} |",
        f"| False negatives | {overall_fn} |",
    ]
    op, or_ = precision_recall(overall_tp, overall_fp, overall_fn)
    lines += [
        f"| Precision | {op:.4f} |",
        f"| Recall | {or_:.4f} |",
        "",
        "## Per-class",
        "",
        "| Class | TP | FP | FN | Precision | Recall |",
        "|-------|----|----|----|-----------|--------|",
    ]
    for cls in sorted(all_stats.keys()):
        s = all_stats[cls]
        p, r = precision_recall(s["tp"], s["fp"], s["fn"])
        lines.append(
            f"| {cls} | {s['tp']} | {s['fp']} | {s['fn']} | {p:.4f} | {r:.4f} |"
        )

    if unmatched_pred_classes:
        lines += [
            "",
            "## Class mapping notes",
            "",
            "The following prediction classes could not be matched to the "
            "canonical container type list used for evaluation labels:",
            "",
        ]
        for c in sorted(unmatched_pred_classes):
            lines.append(f"- `{c}`")
        lines.append(
            "\nEnsure dataset class indices align with SourceScan container types "
            "or provide a data.yaml mapping."
        )

    if state.mode == "demo":
        lines += [
            "",
            "## Demo mode notice",
            "",
            "Detector is in DEMO MODE (prepared sample results, not AI predictions). "
            "Metrics above reflect matching sample boxes to ground truth and are "
            "not model accuracy.",
        ]

    if compare:
        lines += [
            "",
            "## --compare",
            "",
            "Comparison mode requested. A second pass with alternate weights would "
            "run here when both a zero-shot baseline and custom MODEL_PATH are "
            "available and loadable. Current active mode: "
            f"**{state.mode}**. "
            "If only one backend loaded, a side-by-side table cannot be produced.",
        ]

    report = "\n".join(lines) + "\n"
    output.write_text(report, encoding="utf-8")
    print(report)
    print(f"Report written to {output}")
    return 0


def main() -> None:
    args = parse_args()
    dataset = Path(args.dataset)
    output = Path(args.output)
    code = run_evaluation(dataset, args.iou, output, args.compare)
    sys.exit(code)


if __name__ == "__main__":
    main()
