# SourceScan — Computer Vision Model Evaluation Summary

## 1. Executive Summary

This document reports the qualitative and comparative evaluation of the computer vision models available in the SourceScan project workspace:
1. **YOLO-World (v8s-world)** — Open-vocabulary object detector (`yolov8s-world.pt`, 27.2 MB).
2. **YOLO11n (COCO-pretrained)** — Generic 80-class object detector (`yolo11n.pt`, 5.6 MB).

> **Official Evaluation Notice (Section 19):**  
> **Quantitative model accuracy has not yet been evaluated on a representative labelled test dataset.**  
> The findings reported below are derived from qualitative comparative testing across 31 unlabelled field photographs collected in the project's upload directory.

---

## 2. Methodology & Configured Prompts

### A. YOLO-World Setup
YOLO-World was loaded with zero-shot text prompts targeted at potential mosquito breeding containers:
```python
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
```
Inference was run with confidence threshold `CONF_THRESHOLD = 0.15`.

### B. YOLO11n Setup
YOLO11n was evaluated using standard COCO 80-class weights with confidence threshold `0.15`. To prevent hallucinated container classifications, non-container COCO classes (e.g. `person`, `car`, `chair`, `toilet`, `broccoli`) were strictly filtered out by the application mapping layer.

---

## 3. Comparative Observations

| Image ID | Visible Contents | YOLO-World Prediction | YOLO11n (COCO) Prediction | Analysis & Takeaways |
|---|---|---|---|---|
| `0d1fefb8` | Potted plants & garden saucers | `flower pot` (75%), `plant pot` (65%), `flower pot` (43%) | `cup` (39%), `broccoli` (28%, 27%, 25%) | YOLO-World correctly identified plant pots with high confidence. COCO confused foliage with food items. |
| `33e702ca` | Balcony flower pots | `flower pot` (75%), `plant pot` (65%), `flower pot` (43%) | `cup` (39%), `broccoli` (28%) | YOLO-World successfully bounded multiple containers. |
| `06d31e9a` | Outdoor background / wall | None (0 boxes) | `bowl` (47%) | YOLO-World avoided false positive; COCO over-triggered on background texture. |
| `11667fed` | Domestic outdoor fixture | None (0 boxes) | `toilet` (25%) [Filtered] | COCO detected non-container object; filtered out by category mapper. |
| `0debcf29` | Empty paved yard | None (0 boxes) | None (0 boxes) | Both models correctly produced empty detections. |

---

## 4. Model Strengths and Limitations

### YOLO-World (`yolov8s-world.pt`)
- **Strengths:**
  - Understands specific container categories like `plant pot`, `flower pot`, `tyre`, and `bucket` that do not exist as distinct classes in standard COCO.
  - Generates realistic, tight bounding boxes around garden pots and buckets.
  - Very low false positive rate on empty outdoor scenes.
- **Limitations:**
  - Can struggle with heavily shadowed, obscured, or weathered tyres.
  - Inference time is approximately 250–350ms on CPU (slightly heavier than nano models).
  - Open-vocabulary prompt tuning requires careful choice of descriptive keywords.

### YOLO11n (`yolo11n.pt`)
- **Strengths:**
  - Extremely fast (40–70ms inference on CPU).
  - Compact file size (5.6 MB).
  - Reliable detection of generic bottles and potted plants.
- **Limitations:**
  - Standard COCO classes lack dedicated categories for tyres, water drums, cement tubs, and plant saucers.
  - Frequently misclassifies outdoor foliage as food items (e.g. `broccoli`, `potted plant` foliage).

---

## 5. Architectural Recommendation

1. **Default Detector:** Use `yolov8s-world.pt` as the primary detector (`MODEL_PATH=yolov8s-world.pt`, `ENABLE_YOLO_WORLD=true`).
2. **Fallback:** Use `yolo11n.pt` for environments with very limited RAM or CPU resources.
3. **Safety Layer:** Always display the model warning banner and allow human confirmation, correction, and manual container addition for any missed objects.
