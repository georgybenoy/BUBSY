# Bubsy — System Architecture & Technical Specifications

**Academic / Formal Title:** AI-Powered Handwashing Guidance and Compliance System  
**Product Name:** Bubsy — The AI Handwashing Adventure  
**Document Version:** 1.0 (Release-Ready Final Specification)

---

## 1. System Overview & Technology Stack

Bubsy is an offline-capable, privacy-first handwashing guidance and compliance kiosk built for deployment in elementary and junior schools. It operates on a Windows 10/11 laptop or all-in-one touch kiosk connected to a local webcam near a school sink.

```mermaid
graph TD
    subgraph Kiosk_Device ["Local Windows Kiosk Device (127.0.0.1)"]
        subgraph Hardware ["Hardware Layer"]
            CAM[Webcam Sensor]
            NFC[Optional NFC Reader]
            TOUCH[Touchscreen Display]
        end

        subgraph Backend_App ["FastAPI Backend (Port 8000)"]
            VR[Vision Runner]
            YOLO[YOLOv8 Gesture Model]
            TW[Temporal Sliding Window]
            SE[Session State Machine Engine]
            API[REST & WebSocket APIs]
            SVC[Business Logic Services]
            REPO[SQLite Repositories]
            DB[(SQLite DB / WAL Mode)]
        end

        subgraph Frontend_App ["React + Vite SPA (Port 5173)"]
            KIOSK_UI[Student Kiosk Experience]
            PORTAL_UI[Teacher & Staff Portal]
        end
    end

    CAM -->|Volatile Frames| VR
    VR -->|In-Memory Frame| YOLO
    YOLO -->|Predictions| TW
    TW -->|Validated Status| SE
    SE -->|State Events| API
    API -->|Real-Time WS Events| KIOSK_UI
    PORTAL_UI -->|REST / RBAC| API
    API --> SVC
    SVC --> REPO
    REPO --> DB
    TOUCH <--> KIOSK_UI
```

---

## 2. Core Architectural Subsystems

### 2.1 The Vision & Inference Pipeline
1. **Camera Abstraction (`WebcamCapture`):**
   - OpenCV wrapper managing device acquisition, frame retrieval, and robust release.
   - Enforces the **Zero-Persistence Privacy Invariant**: frames reside exclusively in volatile memory buffers and are never written to disk or transmitted over external networks.
2. **Gesture Recognition (`YoloGestureModel` / `StubGestureModel`):**
   - Ultralytics YOLOv8 architecture optimized for hand bounding and 6-class gesture classification.
   - Decoupled from application state; returns strongly typed `PredictionResult`.
3. **Temporal Sliding Window (`TemporalSlidingWindow`):**
   - Bounded FIFO queue evaluating gesture persistence, agreement ratio ($\ge 65\%$), and confidence thresholds.
   - Suppresses single-frame optical spikes, sensor noise, and hand transit flicker. Returns `SUPPORTED`, `UNCERTAIN`, or `NOT_PRESENT`.

---

## 3. Session State Machine & Event Sequence

```mermaid
stateDiagram-v2
    [*] --> Idle: Kiosk Ready
    Idle --> Identify: LET'S WASH Clicked
    Identify --> ConfirmIdentity: QR / NFC Resolved
    Identify --> Assistance: Retries Exhausted (>= 3)
    Assistance --> Identify: Teacher Manual ID
    Assistance --> ActiveWash: Choose Unassigned
    ConfirmIdentity --> Preparation: Student Confirms
    Preparation --> ActiveWash: Water & Soap Ready
    
    state ActiveWash {
        [*] --> PalmToPalm
        PalmToPalm --> PalmOverDorsum: Validated Rubbing (>= 5s)
        PalmOverDorsum --> InterlacedFingers: Validated Rubbing
        InterlacedFingers --> BacksOfFingers: Validated Rubbing
        BacksOfFingers --> Thumbs: Validated Rubbing
        Thumbs --> Fingertips: Validated Rubbing
        Fingertips --> [*]: Complete Rubbing Protocol
    }

    ActiveWash --> ActiveWash: Uncertain Evidence (Show Retry Hint)
    ActiveWash --> RinseDry: Six Steps Validated
    RinseDry --> Result: Rinse & Dry Instructed
    Result --> Idle: Timeout / Finish
    
    ActiveWash --> Interrupted: Camera Disconnect / Hardware Fault
    ActiveWash --> Abandoned: 30s Inactivity Timeout
```

---

## 4. Real-Time Kiosk Interaction Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Child as Student
    participant Kiosk as Kiosk Frontend (React)
    participant WS as WebSocket Endpoint
    participant SM as Session Engine
    participant VR as Vision Runner
    participant DB as SQLite Database

    Child->>Kiosk: Taps "LET'S WASH!"
    Kiosk->>Kiosk: Switch to IDENTIFY screen
    Kiosk->>VR: Set mode IDENTIFY (QR scanning active)
    Child->>VR: Presents QR badge
    VR-->>Kiosk: QR token detected
    Kiosk->>SM: POST /kiosk/identify (HMAC lookup)
    SM-->>Kiosk: Returns student display name (Liam)
    Child->>Kiosk: Confirms "Yes, that's me!"
    Kiosk->>SM: POST /kiosk/sessions (Initialize session)
    SM-->>Kiosk: session_id created
    Kiosk->>WS: Connect ws://127.0.0.1:8000/kiosk/sessions/{id}/ws
    Kiosk->>VR: Switch to WASH mode (Gesture inference active)
    loop Active Hand Rubbing
        VR->>SM: In-memory frame prediction & temporal validation
        SM->>WS: Broadcast step progress (confidence, duration)
        WS-->>Kiosk: Real-time UI animation & audio prompt
    end
    SM->>DB: Atomic transaction (session record, reward points)
    WS-->>Kiosk: FINAL_RESULT (Bubsy Champion, +10 pts)
    Kiosk->>Child: Confetti animation & cheerful audio celebration
```

---

## 5. Security & Privacy Boundaries

| Boundary | Enforcement Mechanism | Purpose |
| :--- | :--- | :--- |
| **No Facial Recognition** | Architecture strictly restricts models to hand gestures. Prohibited imports tested via static AST inspection. | Complete child biometric privacy. |
| **Zero Image Persistence** | Camera frames processed in RAM only; no `cv2.imwrite` in codebase. Tested via automated disk scanner. | Compliance with COPPA, FERPA, and school privacy standards. |
| **Opaque Credentials** | Badges encode random high-entropy strings; lookup uses HMAC-SHA256 with server-side secret. | Stolen or photographed badge reveals zero student personal data. |
| **Staff Authentication** | Passwords hashed using Argon2id (`argon2-cffi`). Session tokens signed with HMAC-SHA256. | Protection of student rosters and historical logs. |
| **Role-Based Authorization** | Enforced server-side via `require_role("admin")` dependency on all settings/write endpoints. | Teachers can review and correct; only admins alter school rules. |
| **Immutable Points Ledger** | Direct edits forbidden. Manual point corrections create audited compensating transactions. | Complete transparency and auditability for school competitions. |

---

## 6. Database Entity-Relationship Architecture

```mermaid
erDiagram
    CLASSES ||--o{ STUDENTS : contains
    STUDENTS ||--o{ CREDENTIALS : owns
    STUDENTS ||--o{ SESSIONS : performs
    STUDENTS ||--o{ REWARD_TRANSACTIONS : earns
    STUDENTS ||--o{ STUDENT_ACHIEVEMENTS : unlocks
    ACHIEVEMENTS ||--o{ STUDENT_ACHIEVEMENTS : defines
    SESSIONS ||--o{ SESSION_STEPS : logs
    SESSIONS ||--o| REWARD_TRANSACTIONS : awards
    TEACHERS ||--o{ AUDIT_EVENTS : triggers

    CLASSES {
        string class_id PK
        string name
        string grade
        string academic_year
        int is_active
    }

    STUDENTS {
        string student_id PK
        string class_id FK
        string school_student_code
        string display_name
        int is_active
    }

    CREDENTIALS {
        string credential_id PK
        string student_id FK
        string credential_type
        string credential_hash UK
        int is_revoked
    }

    SESSIONS {
        string session_id PK
        string student_id FK
        string kiosk_id
        string outcome
        float total_score
        int qualifies_for_points
        string model_version
        string protocol_version
    }

    SESSION_STEPS {
        string step_id PK
        string session_id FK
        string step_code
        int sequence_index
        string result
        int duration_ms
        float confidence_summary
        int is_verified
    }

    REWARD_TRANSACTIONS {
        string transaction_id PK
        string student_id FK
        string session_id FK
        string idempotency_key UK
        int points_delta
        string transaction_type
        string month_bucket
    }

    TEACHERS {
        string teacher_id PK
        string username UK
        string password_hash
        string role
        int is_active
    }

    AUDIT_EVENTS {
        string event_id PK
        string actor_teacher_id FK
        string action
        string target_entity
        string ip_address
    }
```
