# SourceScan: AI-Assisted Mosquito Breeding Source Screening

**AI-Assisted Detection and Prioritisation of Potential Mosquito Breeding Sources**

---

## 1. Project Overview

SourceScan is an independent, full-stack environmental monitoring web application designed to help users, public health workers, and homeowners document, review, and prioritise potential mosquito breeding sources from photographs.

It combines local computer vision object detection (open-vocabulary YOLO-World and generic COCO YOLO) with a transparent, rule-based screening heuristic scoring system and a human-in-the-loop review workflow.

> [!IMPORTANT]
> **Scientific & Medical Limitation**  
> SourceScan is an **AI-assisted screening and documentation tool**, not an epidemiological prediction model or a medical diagnostic system. An image alone does not confirm mosquito breeding, detect larvae or eggs, diagnose vector-borne disease, or prove that an area is safe. The application maintains an explicit separation between AI model detections, application logic heuristics, and confirmed user observations.

---

## 2. Problem Statement

Mosquitoes breed in standing water accumulated in artificial and natural containers around households, balconies, terraces, gardens, construction sites, and shared public areas. Identifying these potential sources and maintaining consistent records is difficult when observations are conducted informally or without standardized tools.

---

## 3. Proposed Solution

SourceScan provides a structured workflow:
1. **Photograph or Upload:** Capture an image of an outdoor or indoor area.
2. **AI-Assisted Detection:** Run local computer vision to identify potential water-holding containers (tyres, buckets, drums, plant pots, saucers, bottles).
3. **Visual Evidence:** View interactive bounding boxes, confidence ratings, and category mappings.
4. **Human Review:** Confirm, reject, or correct detections, and manually document containers missed by the detector.
5. **Observation Recording:** Log whether water is visibly present, uncertain, or absent, and whether the container is tightly covered.
6. **Transparent Heuristic Prioritisation:** Calculate a deterministic screening score indicating which observations warrant closer physical inspection.
7. **History & Analytics:** Persist inspection records in SQLite, view past inspections, and manage records with safe cascade deletion.

---

## 4. Key Features

- **Interactive Welcome Flow:** Introduces application capabilities with a 5-second auto-advance or immediate skip option.
- **Real-Time Bounding Box Visualization:** SVG overlay over uploaded images displaying detected containers with confidence percentages and toggleable visibility.
- **Traceable Human-in-the-Loop Review:** Preserves original model predictions while storing user corrections and confirmations.
- **Rule-Based Heuristic Scoring:** Transparent calculation of screening priority bands (Low, Medium, High) with step-by-step scoring factors.
- **Privacy By Design:** Strips EXIF metadata (including GPS coordinates), re-encodes images to JPEG, assigns UUID filenames, and never collects user location.
- **Inspection Detail & In-Place Editing:** Detailed view with editable observations that recalculate priority dynamically.
- **Live Database Dashboard:** Displays statistics directly from real database records (never fabricated metrics or mock charts).
- **Dual-Mode Deployment:** Runs as a standard separate React + FastAPI dev environment or as a single-port unified application with FastAPI serving the built React SPA.

---

## 5. Technology Stack

### Frontend
- **Framework:** React 19 + Vite
- **Icons:** Lucide React
- **Design System:** Custom CSS (Forest Green `#1e3a2f` accents, Charcoal text, Warm White `#fcfbfa` surface)
- **HTTP Client:** Native Fetch API with centralized error handling

### Backend
- **Framework:** Python 3.11, FastAPI, Uvicorn
- **Validation:** Pydantic v2
- **Image Processing & Privacy:** Pillow (PIL)
- **Database:** SQLite3 with foreign keys and cascade deletions
- **Computer Vision:** Ultralytics (YOLO-World `yolov8s-world.pt` and YOLO11n `yolo11n.pt`)
- **Testing:** Pytest

---

## 6. System Architecture

```
                    ┌─────────────────────────────────┐
                    │       User Web Browser          │
                    │   React SPA (Vite / Port 5173)  │
                    └────────────────┬────────────────┘
                                     │ HTTP / REST
                                     ▼
                    ┌─────────────────────────────────┐
                    │        FastAPI Backend          │
                    │         Port 8000               │
                    └────┬───────────┬───────────┬────┘
                         │           │           │
           Image Sanitization        │     Rule-Based Scoring
           (Pillow, EXIF strip)      │     (Deterministic Heuristic)
                         │           │           │
                         ▼           ▼           ▼
                   ┌──────────┐ ┌─────────┐ ┌──────────┐
                   │ Uploads  │ │ YOLO CV │ │  SQLite  │
                   │ Storage  │ │ Models  │ │ Database │
                   └──────────┘ └─────────┘ └──────────┘
```

---

## 7. Project Directory Structure

```
sourcescan/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py              # Environment configuration & container schemas
│   │   ├── db.py                  # SQLite database helpers, migrations & cascade delete
│   │   ├── detection.py           # YOLO-World & COCO detector logic and category mapper
│   │   ├── main.py                # FastAPI app, CORS, uploads mount, SPA serving
│   │   ├── privacy.py             # EXIF stripping, Pillow validation, path safety
│   │   ├── risk.py                # Pure heuristic scoring functions & explanation builder
│   │   ├── schemas.py             # Pydantic request and response schemas
│   │   ├── seed.py                # Optional opt-in demo data seeding
│   │   ├── water_classifier.py    # Graceful fallback water classifier stub
│   │   └── routes/
│   │       └── api.py             # API endpoints (/health, /analyze, /inspections, etc.)
│   ├── tests/
│   │   ├── conftest.py            # Isolated fixtures with temporary DB and upload dirs
│   │   ├── test_api.py            # API integration tests, filters, cascade delete
│   │   ├── test_privacy.py        # Image validation, EXIF stripping, size limits
│   │   ├── test_risk.py           # Unit tests for scoring rules and boundaries
│   │   └── test_real_models.py    # Real YOLO model loading and inference tests
│   ├── uploads/                   # Sanitized image storage (UUID filenames)
│   ├── .env                       # Local environment settings
│   ├── .env.example               # Configuration template
│   ├── evaluate.py                # Model evaluation CLI
│   ├── evaluation_summary.md      # Real model evaluation findings
│   ├── pytest.ini                 # Test runner configuration
│   ├── requirements.txt           # Python backend dependencies
│   ├── sourcescan.db              # Local SQLite database
│   ├── yolo11n.pt                 # COCO pretrained weights (5.6 MB)
│   └── yolov8s-world.pt           # Open-vocabulary YOLO-World weights (27.2 MB)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BoundingBoxOverlay.jsx # Interactive detection overlay
│   │   │   ├── Footer.jsx             # Scientific disclaimer and footer
│   │   │   ├── IntroScreen.jsx        # 5-second welcome experience
│   │   │   ├── Navbar.jsx             # Brand navigation and model status
│   │   │   ├── PriorityBadge.jsx      # Low / Medium / High badges
│   │   │   └── ScoreCalculator.jsx    # Live heuristic score breakdown
│   │   ├── pages/
│   │   │   ├── About.jsx              # Documentation and system architecture
│   │   │   ├── Dashboard.jsx          # Live database statistics and recent logs
│   │   │   ├── History.jsx            # Filterable inspection history and delete modal
│   │   │   ├── InspectionDetail.jsx   # Deep-dive with editable findings
│   │   │   └── NewInspection.jsx      # Upload, detection, review & save workflow
│   │   ├── api.js                     # Unified API client
│   │   ├── App.jsx                    # Top-level routing & layout
│   │   ├── index.css                  # Global design system
│   │   └── main.jsx                   # React DOM root
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## 8. Installation & Setup (Windows)

### Prerequisites
- **Python 3.11** installed on your system.
- **Node.js** (v18 or higher) and **npm**.

### Step 1: Backend Setup

Open Windows Command Prompt or PowerShell:

```powershell
# Navigate to backend directory
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\backend

# Activate the existing virtual environment (or create one with: python -m venv .venv)
.\.venv\Scripts\activate

# Install required dependencies
pip install -r requirements.txt

# Verify environment configuration
copy .env.example .env   # (if .env does not already exist)
```

### Step 2: Frontend Setup

Open a second terminal window:

```powershell
# Navigate to frontend directory
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\frontend

# Install node dependencies
npm.cmd install
```

---

## 9. Starting the Application

You can run SourceScan in either **Development Mode** (dual servers with hot-reload) or **Unified Production Mode** (single port).

### Option A: Development Mode (Recommended for testing)

**Terminal 1 — Backend (Port 8000):**
```powershell
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend (Port 5173):**
```powershell
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\frontend
npm.cmd run dev
```

Open your browser to: **`http://localhost:5173`**  
The Vite dev server automatically proxies `/api` and `/uploads` requests to the FastAPI backend.

### Option B: Unified Single-Port Mode

FastAPI can directly serve the compiled React SPA:

```powershell
# 1. Build the frontend
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\frontend
npm.cmd run build

# 2. Start the backend
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\backend
.\.venv\Scripts\activate
uvicorn app.main:app --port 8000
```

Open your browser to: **`http://127.0.0.1:8000`**  
Both the React web app and the FastAPI REST endpoints will be served from port 8000.

---

## 10. Automated Testing

The backend includes a comprehensive pytest suite covering API routes, privacy sanitization, risk scoring boundaries, image serving, and model inference.

### Run Deterministic Unit Tests
Fast, deterministic tests that do not depend on loading heavy neural network weights:
```powershell
cd C:\Users\sharl\Downloads\sourcescan\sourcescan\backend
.\.venv\Scripts\activate
pytest -v -m "not real_model"
```
*Expected: 35 passed in ~1.3 seconds.*

### Run Real Model Integration Tests
Verifies real inference using `yolov8s-world.pt` and `yolo11n.pt` on disk:
```powershell
pytest -v -m "real_model"
```
*Expected: 2 passed.*

### Run All Tests Together
```powershell
pytest -v
```
*Expected: 37 passed.*

---

## 11. Environment Variables Configuration

Settings in `backend/.env`:

| Variable | Default Value | Description |
|---|---|---|
| `MODEL_PATH` | `yolov8s-world.pt` | Path to weights file (`yolov8s-world.pt`, `yolo11n.pt`, or empty for demo mode). |
| `ENABLE_YOLO_WORLD` | `true` | Enables zero-shot open-vocabulary prompts on YOLO-World. |
| `CONF_THRESHOLD` | `0.15` | Minimum model confidence score (0.0 to 1.0). |
| `MAX_UPLOAD_MB` | `5` | Maximum allowed image upload size in megabytes. |
| `FACE_BLUR` | `false` | Optional best-effort face blur (clearly documented as non-guaranteed). |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | Comma-separated CORS allowed origins. |
| `DB_PATH` | `sourcescan.db` | Path to local SQLite database file. |
| `SEED_DEMO_DATA` | `false` | Set to `true` only if you explicitly want sample records seeded in an empty database. |
| `PORT` | `8000` | HTTP port for Uvicorn server. |

---

## 12. API Endpoint Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, model readiness, active mode, and limitation banners. |
| `GET` | `/api/config` | Supported container types, scoring rules, actions, and limits. |
| `POST` | `/api/analyze` or `/api/analyse` | Accepts image upload, strips EXIF, runs detector, returns detections and `image_id`. |
| `GET` | `/api/images/{filename}` | Securely retrieves an uploaded image (with strict path-traversal prevention). |
| `POST` | `/api/inspections` | Saves an inspection and findings (requires user consent). |
| `GET` | `/api/inspections` | Lists inspections with optional `risk`, `date_from`, `date_to` filters. |
| `GET` | `/api/inspections/{id}` | Retrieves an inspection with complete findings, bounding boxes, and scores. |
| `PATCH` | `/api/inspections/{id}/findings/{fid}` | Updates finding observation (category, water status, cover) and recomputes priority. |
| `DELETE` | `/api/inspections/{id}` | Deletes inspection record, cascades findings, and unlinks image if unshared. |
| `GET` | `/api/analytics` | Returns real database metrics (totals, priority breakdown, top containers). |

---

## 13. Rule-Based Scoring Formula (Heuristics)

The screening score is calculated as:
$$\text{Final Score} = \max(0, \text{Base Points} + \text{Water Adjustment} + \text{Cover Adjustment})$$

### 1. Base Container Points
- **Tyre, Bucket, Drum/Barrel, Water Tank, Cement Tub:** 3 points
- **Plant Pot / Saucer, Drip/AC Tray, Drain Inlet:** 2 points
- **Bottle, Coconut Shell, Other Containers:** 1 point

### 2. Water Status Adjustment
- **Present (User Confirmed):** +4 points
- **Uncertain:** +2 points
- **Absent (User Confirmed):** +0 points
- **Unknown / Not Assessed:** 0 points

### 3. Covering Adjustment
- **Uncovered:** 0 points
- **Tightly Covered (User Confirmed):** -2 points
- **Unknown:** 0 points

### Priority Bands
- **0–3 points:** Low Priority
- **4–6 points:** Medium Priority
- **7+ points:** High Priority (e.g. Uncovered Tyre with Standing Water: $3 + 4 + 0 = 7$)

---

## 14. Model Evaluation & Limitations

Comparative testing was conducted against sample photographs in the repository (see `backend/evaluation_summary.md`):
- **YOLO-World (`yolov8s-world.pt`):** Effectively identifies domain-specific items (`flower pot`, `plant pot`, `bucket`, `tyre`) using tailored text prompts. Recommended as the primary detector.
- **YOLO11n (`yolo11n.pt`):** Fast, compact COCO model. Handles generic bottles and plants, but lacks native categories for tyres and water drums and tends to misclassify garden foliage as food (`broccoli`).
- **Safety Safeguard:** If an object is not a supported container category, it is never arbitrarily forced into a container label. Users can always manually document containers that the AI misses.

---

## 15. Privacy & Security Safeguards

1. **Strict File Validation:** Validates file magic bytes via Pillow to reject corrupted files and non-image extensions.
2. **Metadata Removal:** All EXIF tags (including GPS coordinates, timestamp, camera serial numbers) are stripped before saving.
3. **Random UUID Filenames:** Files are saved under random UUIDs (e.g., `4416ad5f-1faf-4e51-9d30-bd8372f05db1.jpg`) to prevent directory traversal and overwrite attacks.
4. **Path Traversal Protection:** Image retrieval endpoints reject paths containing separators or relative segments (`..`).
5. **Shared File Preservation:** Deleting an inspection record verifies that no other inspection references the image before unlinking from disk.
6. **No GPS / Location Tracking:** Geographic coordinates are never collected. Locality names are optional user-entered text labels.

---

## 16. Troubleshooting

| Symptom | Root Cause | Solution |
|---|---|---|
| Health reports `mode: "demo"` | Model file not found or failed to load. | Ensure `yolov8s-world.pt` is present in `backend/` and `MODEL_PATH=yolov8s-world.pt` is in `.env`. |
| PowerShell Execution Policy error on `npm` | Windows policy blocks `.ps1` script execution. | Use `npm.cmd run dev` or `npm.cmd install` instead of `npm`. |
| HTTP 413 Upload Error | Uploaded image exceeds max size limit. | Reduce image size or increase `MAX_UPLOAD_MB` in `backend/.env`. |
| HTTP 400 Consent Error on save | Inspection payload has `consent: false`. | Check the consent checkbox in the UI before clicking Save Inspection. |
| CORS Error in browser | Frontend origin not permitted. | Verify `ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:5173`. |

---

## 17. Acknowledgements

- **Ultralytics:** YOLO-World and YOLO11 computer vision architectures.
- **FastAPI & Pydantic:** Python API framework and data validation.
- **React & Vite:** Frontend user interface and tooling.
