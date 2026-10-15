Bubsy — Technology Stack Document
Project: Bubsy — The AI Handwashing Adventure
Document type: Technical Stack & Architecture Specification · Version 1.0

1. Technology overview
Bubsy is an AI-powered handwashing guidance and compliance system designed for
elementary and junior school students. It consists of two interfaces—a child-friendly kiosk and a
teacher administration portal—supported by a local backend, computer-vision recognition, and a
database.
The system will first be developed and tested on a Windows laptop with a webcam. Once
validated, it will be deployed on a dedicated kiosk computer near the school sink.
The technology stack prioritizes local processing, low hardware requirements, privacy,
maintainability, and offline operation.

2. Selected technology stack
Layer

Technology

Purpose

Teacher portal

React + TypeScript

Administrative dashboard and
management interface

Kiosk interface

React + TypeScript

Child-friendly handwashing
guidance and rewards

Frontend tooling

Vite

Development server and production
build

UI styling

CSS / CSS variables

Shared design system and
responsive layouts

Icons

Lucide React

Consistent interface icons

Charts

Recharts

Teacher analytics and progress
charts

Backend API

Python + FastAPI

Application logic and REST API

Computer vision

OpenCV

Camera access, frame processing,
and image preprocessing

Gesture
recognition

Ultralytics YOLO

Recognize handwashing
movements from camera frames

Numerical
processing

NumPy

Efficient image and
coordinate-related calculations

QR identification

OpenCV QR detector or a
compatible QR decoding library

Resolve student QR credentials

Optional
NFC/RFID

Compatible USB reader and its
supported Python interface

Read student card credentials

Database

SQLite

Local student, session, reward, and
configuration records

Data validation

Pydantic

Validate API requests and
responses

Backend testing

Pytest

API, scoring, and session validation
tests

Frontend testing

Vitest + React Testing Library

UI component and interaction tests

Version control

Git + GitHub

Source control and collaboration

Deployment

Local Windows computer

Initial development and first
deployment target

These are the proposed project choices. The final YOLO model, QR decoder, and NFC/RFID
reader implementation must be confirmed through compatibility and performance testing.

3. System architecture
#chatgpt-mermaid-_r_1da_{font-family:-apple-system-body,ui-sans-serif,-apple-system,systemui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI
Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes
edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes
dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_1da_
.edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s
linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_1da_
.edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s
linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_1da_ .error-icon{fill:rgb(48, 48,
48);}#chatgpt-mermaid-_r_1da_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237,
237);}#chatgpt-mermaid-_r_1da_
.edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_1da_
.edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_1da_
.edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_1da_
.edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_1da_
.edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_1da_
.edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_1da_ .marker{fill:rgb(175, 175,
175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1da_ .marker.cross{stroke:rgb(175, 175,

175);}#chatgpt-mermaid-_r_1da_
svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe
UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI
Symbol";font-size:16px;}#chatgpt-mermaid-_r_1da_ p{margin:0;}#chatgpt-mermaid-_r_1da_
.label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe
UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI
Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_1da_ .cluster-label text{fill:rgb(237,
237, 237);}#chatgpt-mermaid-_r_1da_ .cluster-label span{color:rgb(237, 237,
237);}#chatgpt-mermaid-_r_1da_ .cluster-label span
p{background-color:transparent;}#chatgpt-mermaid-_r_1da_ .label
text,#chatgpt-mermaid-_r_1da_ span{fill:rgb(237, 237, 237);color:rgb(237, 237,
237);}#chatgpt-mermaid-_r_1da_ .node rect,#chatgpt-mermaid-_r_1da_ .node
circle,#chatgpt-mermaid-_r_1da_ .node ellipse,#chatgpt-mermaid-_r_1da_ .node
polygon,#chatgpt-mermaid-_r_1da_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78,
148);stroke-width:1px;}#chatgpt-mermaid-_r_1da_ .rough-node .label
text,#chatgpt-mermaid-_r_1da_ .node .label text,#chatgpt-mermaid-_r_1da_ .image-shape
.label,#chatgpt-mermaid-_r_1da_ .icon-shape
.label{text-anchor:middle;}#chatgpt-mermaid-_r_1da_ .node .katex
path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_1da_ .rough-node
.label,#chatgpt-mermaid-_r_1da_ .node .label,#chatgpt-mermaid-_r_1da_ .image-shape
.label,#chatgpt-mermaid-_r_1da_ .icon-shape
.label{text-align:center;}#chatgpt-mermaid-_r_1da_
.node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_1da_ .root .anchor path{fill:rgb(175, 175,
175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1da_
.arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1da_ .edgePath
.path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_1da_
.flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_1da_
.edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_1da_
.edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_1da_ .edgeLabel
rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_1da_
.labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_1da_ .cluster
rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255,
0.15);stroke-width:1px;}#chatgpt-mermaid-_r_1da_ .cluster text{fill:rgb(237, 237,
237);}#chatgpt-mermaid-_r_1da_ .cluster span{color:rgb(237, 237,
237);}#chatgpt-mermaid-_r_1da_
div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color
Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48,
48, 48);border:1px solid rgba(255, 255, 255,
0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_1da_
.flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237,
237);}#chatgpt-mermaid-_r_1da_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_1da_
.icon-shape,#chatgpt-mermaid-_r_1da_ .image-shape{background-color:rgb(0, 0,
0);text-align:center;}#chatgpt-mermaid-_r_1da_ .icon-shape p,#chatgpt-mermaid-_r_1da_

.image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_1da_
.icon-shape .label rect,#chatgpt-mermaid-_r_1da_ .image-shape .label
rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_1da_
.label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mer
maid-_r_1da_ .node .label-icon
path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_1da_ .node
.neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_1da_ [data-look="neo"].node
rect,#chatgpt-mermaid-_r_1da_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_1da_
[data-look="neo"].node
polygon{stroke:url(#chatgpt-mermaid-_r_1da_-gradient);filter:drop-shadow( 1px 2px 2px
rgba(185,185,185,1));}#chatgpt-mermaid-_r_1da_ [data-look="neo"].swimlane.cluster
rect{filter:none;}#chatgpt-mermaid-_r_1da_ [data-look="neo"].node
path{stroke:url(#chatgpt-mermaid-_r_1da_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_1d
a_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px
rgba(185,185,185,1));}#chatgpt-mermaid-_r_1da_ [data-look="neo"].node .neo-line
path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_1da_ [data-look="neo"].node
circle{stroke:url(#chatgpt-mermaid-_r_1da_-gradient);filter:drop-shadow( 1px 2px 2px
rgba(185,185,185,1));}#chatgpt-mermaid-_r_1da_ [data-look="neo"].node circle
.state-start{fill:#000000;}#chatgpt-mermaid-_r_1da_ [data-look="neo"].icon-shape
.icon{fill:url(#chatgpt-mermaid-_r_1da_-gradient);filter:drop-shadow( 1px 2px 2px
rgba(185,185,185,1));}#chatgpt-mermaid-_r_1da_ [data-look="neo"].icon-shape .icon-neo
path{stroke:url(#chatgpt-mermaid-_r_1da_-gradient);filter:drop-shadow( 1px 2px 2px
rgba(185,185,185,1));}#chatgpt-mermaid-_r_1da_ .node
text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206,
255);}#chatgpt-mermaid-_r_1da_ .edgeLabels
text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206,
255);}#chatgpt-mermaid-_r_1da_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_1da_
.edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_1da_
.edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62,
95);stroke-width:1px;}#chatgpt-mermaid-_r_1da_ .node rect,#chatgpt-mermaid-_r_1da_ .node
circle,#chatgpt-mermaid-_r_1da_ .node ellipse,#chatgpt-mermaid-_r_1da_ .node
polygon,#chatgpt-mermaid-_r_1da_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255,
0.1);stroke-width:1px;}#chatgpt-mermaid-_r_1da_ .node
rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_1da_ .node.mermaid-decision
.label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62,
95);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_1da_ .edgePaths .flowchart-link{stroke:rgb(175,
175,
175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_1da_
.marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_1da_
:root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe
UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI
Symbol";}StudentBubsy KioskReact + TypeScriptQR Scanner / Optional NFCPython Vision
ServiceOpenCV Camera PipelineYOLO Gesture RecognitionTemporal & Sequence

ValidationSession and Scoring EngineStudent Credential ResolverSQLite
DatabaseFastAPITeacher PortalReact + TypeScriptAnalytics, Reports &Leaderboard

Component responsibilities
●​ Kiosk frontend: displays instructions, progress, recognition feedback, session results,
and rewards.
●​ Vision service: accesses the camera, processes frames, runs YOLO inference, and
emits recognized gesture events.
●​ Session engine: validates gesture order, timing, confidence, and completion criteria.
●​ Credential resolver: maps QR and optional NFC/RFID credentials to the same internal
student ID.
●​ FastAPI backend: exposes authorized endpoints for students, classes, sessions,
rewards, reports, and settings.
●​ SQLite: stores application records locally.
●​ Teacher portal: provides management, monitoring, analytics, and monthly leaderboard
views.
The React interface must not award points directly from raw model predictions. The backend
session engine should validate the session and calculate rewards before saving the result.

4. Computer vision and AI stack
Component

Selected
technology

Implementation

Camera access

OpenCV

Capture frames from the single webcam

Preprocessing

OpenCV + NumPy

Resize, convert, and prepare frames for inference

Gesture model

Ultralytics YOLO

Classify the supported handwashing movements

Temporal
validation

Python

Confirm that recognized movements persist long
enough and follow the required sequence

Confidence
handling

Python rules

Reject uncertain predictions or request another
attempt

Model evaluation Scikit-learn and
evaluation scripts

Calculate precision, recall, F1-score, and
confusion matrices

Model storage

Keep the deployed model identifiable and
reproducible

Versioned model
weights

AI implementation requirements
1.​ Start with a small, appropriately trained YOLO model suitable for CPU inference.
2.​ Benchmark inference speed on the development laptop before selecting the final model.
3.​ Collect or prepare a representative dataset covering the selected gestures, camera
angles, lighting conditions, and backgrounds.
4.​ Split training and evaluation data by recording session or participant where practical,
rather than randomly splitting near-identical frames.
5.​ Evaluate each gesture class independently; overall accuracy alone is insufficient.
6.​ Add temporal smoothing and sequence validation to reduce false detections.
7.​ Provide an uncertainty state when the model cannot confidently recognize a movement.
8.​ Do not assume that an existing checkpoint is production-ready without independent
evaluation.
Privacy rule: camera frames are processed in memory and discarded. No persistent
photographs, session videos, facial recognition, or facial identity tracking are required.

5. Frontend stack and design system
React + TypeScript + Vite
Use one frontend codebase with two distinct application areas:
●​ /kiosk — child-facing handwashing experience.
●​ /teacher — teacher portal and administration dashboard.
Shared components should include buttons, cards, progress rings, dialogs, tables, status
indicators, and form controls.
Recommended supporting libraries:

●​
●​
●​
●​
●​

React Router — page navigation and route protection.
Lucide React — consistent icons.
Recharts — teacher dashboard charts.
CSS variables — shared blue-and-white visual design tokens.
Vitest + React Testing Library — frontend testing.

The teacher portal should follow the supplied reference image: a clean dashboard, compact
sidebar, KPI cards, progress rings, and information-rich panels. The kiosk should use the same
colour palette with larger typography, simple animations, and Bubsy mascot illustrations.

6. Backend and API stack
Use Python + FastAPI as the backend framework.
The backend is responsible for:
●​
●​
●​
●​
●​
●​
●​
●​
●​

Student and class management.
QR and NFC/RFID credential resolution.
Session creation and completion.
Gesture-sequence validation.
Scoring and reward rules.
Monthly leaderboard calculations.
Teacher authentication and authorization.
Report generation and data export.
Device health and diagnostic information.

Use Pydantic models for request validation and separate application logic from API routes.
For communication between the vision service and the kiosk, begin with a local HTTP API or
WebSocket connection, depending on whether continuous recognition feedback is required.
Keep inference separate from business logic so that the recognition model can be changed
without rewriting the reward system.

7. Database stack
Database: SQLite
SQLite is suitable for the initial single-kiosk deployment because it is lightweight, local, and does
not require a separate database server.
Recommended entities:

Table

Purpose

students

Student records and internal IDs

classes

Class and grade information

credentials

QR/NFC credential mappings

teachers

Teacher accounts and roles

sessions

Session timestamps, outcomes, duration, and model version

session_steps

Recognized movements and validation outcomes

reward_transacti

Auditable points earned or adjusted

ons

achievements

Available badges and achievement definitions

student_achievem

Badges earned by each student

ents

settings

Protocol, scoring, and kiosk configuration

audit_events

Important administrative changes

Store only the data needed to operate and evaluate the system. Use internal student IDs for
session records instead of duplicating personal details in every table.
Monthly scores should be derived from validated reward transactions for the relevant month. Do
not reset or delete historical transactions when a new month begins.

8. Student identification
Bubsy will support two identification methods.
Primary: QR code
●​
●​
●​
●​

Decode the student's QR code using the webcam.
Resolve the credential to an internal student ID.
Validate that the credential is active.
Reject invalid or unrecognized credentials.

Optional: NFC/RFID
●​ Use a compatible USB reader.
●​ Read the card identifier through the reader's supported interface.
●​ Resolve it through the same credential service used for QR codes.
Both methods should use the same underlying student record and session logic. Do not infer
identity from a person's face or assign an arbitrary student when identification fails.

9. Rewards and leaderboard technology
Implement scoring as a deterministic Python rules engine, not as part of the AI model.
The scoring engine should:
●​
●​
●​
●​
●​
●​
●​

Award points only for qualifying sessions.
Apply configurable protocol-completion criteria.
Prevent duplicate submissions from awarding duplicate points.
Enforce per-day reward limits.
Record every point award in reward_transactions.
Support monthly leaderboards and personal progress views.
Allow authorized teachers to correct verified errors with an audit trail.

The UI can call these features Bubsy Points, Bubsy Badges, and Bubsy Champion.

10. Security, privacy, and offline operation

●​
●​
●​
●​
●​
●​
●​
●​
●​
●​
●​

Run camera processing locally on the kiosk computer.
Store session records in the local database.
Do not persist raw images or videos.
Do not implement facial recognition.
Protect teacher routes and backend endpoints with authentication and role-based
authorization.
Store passwords using a suitable password-hashing algorithm; never store plaintext
passwords.
Validate inputs and enforce authorization on the backend.
Use transactions for session completion and reward issuance.
Keep audit records for sensitive administrative actions.
Define a school-approved data retention policy.
Avoid relying on internet connectivity for normal kiosk operation.

If multi-kiosk synchronization is introduced later, it should transmit only the necessary records
and use authenticated communication. Cloud hosting is not required for the initial version.

11. Testing stack
Testing area

Technology

What to validate

Backend unit tests

Pytest

Scoring, credential resolution, sequence
validation

API integration
tests

Pytest + FastAPI
TestClient

Endpoint responses, authorization,
persistence

Frontend tests

Vitest + React Testing
Library

Screen states, form validation, rewards
display

AI evaluation

Python evaluation scripts

Per-class precision, recall, F1, confusion
matrix

Performance tests

Timing and profiling
utilities

Inference latency, memory usage, CPU load

End-to-end tests

Playwright

Teacher workflows and kiosk interaction

Deployment tests

Windows test
environment

Startup, camera access, database
persistence, recovery

Before school deployment, verify the model with real-world lighting and camera placements.
The system should never claim that hands are clean merely because a gesture sequence was
detected.

12. Development and deployment plan
1.​ Phase 1 — Environment and feasibility​
Set up Python, Node.js, React, FastAPI, SQLite, Git, and the webcam. Test YOLO
inference speed and gesture recognition quality on the Windows laptop.
2.​ Phase 2 — AI recognition pipeline​
Implement frame acquisition, gesture inference, confidence handling, temporal
validation, and evaluation.
3.​ Phase 3 — Backend and database​
Build student records, credentials, sessions, scoring, rewards, and APIs.
4.​ Phase 4 — Student kiosk​
Build QR identification, guided handwashing screens, feedback, session completion, and
personal progress.
5.​ Phase 5 — Teacher portal​
Build the overview dashboard, student and class management, sessions, analytics,
reports, and monthly leaderboard.
6.​ Phase 6 — Integration and validation​
Test complete sessions, failure cases, duplicate prevention, privacy, performance, and
usability.
7.​ Phase 7 — School deployment​
Package the application for the dedicated kiosk computer, configure the camera and
optional reader, and validate the installation in the target environment.

13. Recommended project structure
bubsy/
├── frontend/
│ ├── src/
│ │ ├── components/
│ │ ├── features/
│ │ │ ├── kiosk/

│ │ │ ├── students/
│ │ │ ├── classes/
│ │ │ ├── sessions/
│ │ │ ├── rewards/
│ │ │ ├── leaderboard/
│ │ │ └── analytics/
│ │ ├── layouts/
│ │ ├── pages/
│ │ ├── services/
│ │ ├── styles/
│ │ └── types/
│ └── package.json
├── backend/
│ ├── app/
│ │ ├── api/
│ │ ├── core/
│ │ ├── database/
│ │ ├── models/
│ │ ├── schemas/
│ │ ├── services/
│ │ ├── vision/
│ │ └── main.py
│ ├── tests/
│ └── requirements.txt
├── models/
│ └── README.md
├── data/
│ └── .gitkeep
├── docs/
│ ├── PRD.md
│ ├── DESIGN.md
│ └── TECH_STACK.md
├── .gitignore
└── README.md
The actual database, student records, credentials, and model weights should not be committed
to the public GitHub repository.

14. Final technology decisions
Decision

Selected approach

Frontend

React + TypeScript + Vite

UI design

Shared blue-and-white design
system

AI framework

Ultralytics YOLO

Image processing

OpenCV + NumPy

Backend

Python + FastAPI

Database

SQLite

Student identification

QR, with optional NFC/RFID

Rewards

Python rules engine

Charts

Recharts

Testing

Pytest, Vitest, Playwright

Initial deployment

Windows laptop and webcam

Target deployment

Dedicated local kiosk computer

Cloud dependency

None required for core operation

Persistent camera
recordings

Not permitted

Implementation priority: prove that the gesture-recognition pipeline performs reliably on the
target hardware before building the entire application around it. Then integrate the recognition
output with the session engine, scoring rules, database, kiosk, and teacher portal.
This gives Bubsy a practical, privacy-conscious architecture that can be developed and tested
incrementally while still delivering the complete school-ready product.

