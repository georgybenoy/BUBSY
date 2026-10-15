# Bubsy — The AI Handwashing Adventure

**Academic Title:** AI-Powered Handwashing Guidance and Compliance System  
**Target Environment:** Local Windows laptop with webcam (development) & dedicated local kiosk (deployment).

---

## 1. Project Overview

Bubsy is an AI-powered handwashing guidance and compliance system tailored for elementary and junior school environments. The application provides two coordinated experiences:
- **Student Kiosk (`/kiosk`)**: A child-friendly, interactive guidance interface featuring large visual demonstrations, audio cues, supportive feedback, and gamified achievements (Bubsy Points and Badges).
- **Teacher Portal (`/teacher`)**: An administrative dashboard for student roster management, session inspection, class compliance analytics, and monthly leaderboard tracking.

### Core Non-Negotiable Rules
- **No Facial Recognition:** Biometric scanning, continuous face tracking, or facial embeddings are strictly prohibited.
- **No Camera Frame Storage:** Live camera frames are processed in volatile memory only and immediately discarded. No session photos or videos are ever written to disk or transmitted.
- **Backend Scoring Authority:** All session qualification, technique scoring, and reward allocations are calculated deterministically by the backend rules engine.
- **Offline First:** The core kiosk guidance, credential resolution, and persistence operate completely offline without external cloud dependencies.

---

## 2. Repository Structure

```
Bubsy/
├── AGENTS.md                  # Binding engineering rules and instructions
├── README.md                  # Project overview and Windows setup instructions
├── .gitignore                 # Enforces exclusion of models, images, DBs, and secrets
├── .env.example               # Configuration template with placeholders only
├── docs/                      # Authoritative architecture and product specifications
│   ├── PRD.md                 # Product Requirements Document
│   ├── DESIGN.md              # UI/UX design specifications and color tokens
│   ├── TECH_STACK.md          # Technical stack and architectural boundaries
│   ├── CODE_STYLE.md          # Engineering conventions and response envelope standard
│   ├── DATABASE.md            # SQLite schema and migration integrity rules
│   ├── SECURITY.md            # Privacy commitments, threat models, and access control
│   └── TESTING.md             # Multi-layer testing and AI evaluation protocol
├── frontend/                  # React 19 + TypeScript + Vite single-page application
│   ├── src/
│   │   ├── components/        # Shared primitives (HealthStatus, dialogs, buttons)
│   │   ├── features/
│   │   │   ├── kiosk/         # Kiosk guidance workflow and layout
│   │   │   └── teacher/       # Teacher dashboard layout and analytics
│   │   ├── services/          # API client for backend communication
│   │   └── styles/
│   │       └── tokens.css     # Design tokens (colors, corner radii, spacing)
│   ├── package.json
│   └── vite.config.ts         # Vitest and local Vite server configuration
├── backend/                   # Python 3.11+ / FastAPI application
│   ├── app/
│   │   ├── api/v1/            # API endpoints (e.g. GET /api/v1/health)
│   │   ├── core/              # Config (pydantic-settings) and logging
│   │   ├── database/          # SQLite connection and migrations
│   │   ├── models/            # Domain entities
│   │   ├── schemas/           # Pydantic schemas and standard response envelope
│   │   ├── services/          # Session validation and scoring rules
│   │   ├── vision/            # OpenCV camera capture and YOLO inference
│   │   └── main.py            # FastAPI entrypoint and CORS configuration
│   ├── tests/                 # Pytest test suite
│   └── requirements.txt       # Tested, pinned Windows dependencies
├── models/
│   └── README.md              # Instructions for obtaining approved model weights
└── data/
    └── .gitkeep               # Local database placeholder (excluded by .gitignore)
```

---

## 3. Windows Setup & Quickstart Guide

### Prerequisites
- **Operating System:** Windows 10 or 11 (64-bit)
- **Python:** Python 3.11 or higher (Python 3.13 supported)
- **Node.js:** Node.js v20+ with npm (v22+ recommended)
- **Webcam:** Built-in or external USB webcam

---

### Step 1: Clone and Configure Environment

```powershell
# Navigate to the project root
cd C:\Users\georg\Bubsy

# Create local environment file from example template
Copy-Item .env.example .env
```

---

### Step 2: Backend Setup

```powershell
# Create a Python virtual environment in backend/.venv
py -3.13 -m venv backend\.venv

# Activate virtual environment
.\backend\.venv\Scripts\Activate.ps1

# Install pinned dependencies
pip install -r backend\requirements.txt
```

---

### Step 3: Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

cd ..
```

---

### Step 4: Running the Applications

Open two separate PowerShell terminal tabs:

**Terminal 1 — Backend API Server:**
```powershell
cd C:\Users\georg\Bubsy
.\backend\.venv\Scripts\Activate.ps1
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- API Health Check: `http://127.0.0.1:8000/api/v1/health`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`

**Terminal 2 — Frontend Dev Server:**
```powershell
cd C:\Users\georg\Bubsy\frontend
npm run dev
```
- Student Kiosk: `http://127.0.0.1:5173/kiosk`
- Teacher Portal: `http://127.0.0.1:5173/teacher`

---

## 4. Verification & Testing

### Backend Verification
From the root directory:
```powershell
# Run Ruff linting and formatting checks
.\backend\.venv\Scripts\ruff.exe check backend/
.\backend\.venv\Scripts\ruff.exe format --check backend/

# Run Pytest suite
.\backend\.venv\Scripts\pytest.exe backend/tests -v
```

### Frontend Verification
From `frontend/`:
```powershell
# Type checking
npx tsc --noEmit

# ESLint
npm run lint

# Prettier format check
npx prettier --check .

# Vitest unit test suite
npm run test
```
