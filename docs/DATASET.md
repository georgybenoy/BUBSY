# Bubsy Handwashing Gesture Dataset Specification & Protocol

**Document Version:** 1.0.0  
**Status:** Active Feasibility Specification  
**Governing Documents:** [PRD.md](file:///c:/Users/georg/Bubsy/docs/PRD.md) (Sections 7.3, 10.3), [TESTING.md](file:///c:/Users/georg/Bubsy/docs/TESTING.md) (Section 5), [SECURITY.md](file:///c:/Users/georg/Bubsy/docs/SECURITY.md) (Section 7)

---

## 1. Operational Definitions of Gesture Classes

In accordance with WHO Hand Hygiene Guidelines, CDC guidance, and PRD requirement **FR-GUIDE-03**, Bubsy classifies exactly six active rubbing movements, plus idle/background and unknown states.

| Internal Enum | Canonical Movement Name | Operational Definition & Movement Boundaries |
| :--- | :--- | :--- |
| `PALM_TO_PALM` | **Palm-to-Palm Rubbing** | Both palms facing each other in direct contact, moving forward and backward or in circular motions. Fingers extended or slightly curled, but not interlaced. |
| `PALM_OVER_DORSUM` | **Palm over Dorsum** | The palm of one hand placed flat over the dorsal surface (back) of the opposite hand, sliding back and forth from wrist to knuckles. Covers both left-over-right and right-over-left configurations. |
| `FINGERS_INTERLACED` | **Fingers Interlaced** | Palms facing each other with fingers interlaced into opposing webbing spaces, rubbing back and forth to clean interdigital spaces. |
| `BACKS_OF_FINGERS` | **Backs of Fingers** | Fingers of opposing hands curled and interlocked with knuckles nestled against opposing palms. Movement is a side-to-side or rotating scrubbing action against the palm surface. |
| `THUMB_RUBBING` | **Rotational Thumb Rubbing** | One thumb firmly clasped inside the closed fist/palm of the opposite hand, rotated back and forth. Covers both right and left thumbs. |
| `FINGERTIPS` | **Fingertips in Palm** | The fingertips of one hand gathered together into a point, pressed into the cupped palm of the opposing hand, and rotated in circular scrub motions. Covers both hands. |
| `IDLE_BACKGROUND` | **Idle / Non-action** | Hands motionless under tap, hands entering or exiting the frame, reaching for soap or towel, static sink background, running water without hand movement. |
| `UNKNOWN` | **Uncertain / Out-of-Distribution** | Movement ambiguous, hands severely occluded, movement not matching any of the 6 core techniques, or AI confidence below threshold. |

---

## 2. Collection Protocol for Consenting Adult Volunteers

### 2.1 Ethical & Privacy Safeguards
- **Adult Volunteers Only:** In accordance with PRD Section 10.3, all development and feasibility data is collected exclusively from consenting adult volunteers (18+). No data collection involving schoolchildren will occur prior to formal institutional ethics approvals and parental consent frameworks.
- **Informed Consent:** Participants must sign written consent explaining that data will be used strictly for training and benchmarking hand movement models.
- **Strict Facial Privacy:**
  - The camera must be angled downward toward the sink basin (30°–45° tilt).
  - The framing cutoff must remain strictly **below collarbone level**.
  - Any recording showing a participant's face is disqualified and must be deleted immediately.
- **Zero Raw Persistence in Production:** In production kiosk deployment, camera frames stay in RAM only and are discarded immediately after inference.

### 2.2 Recording Apparatus & Geometry
- **Sensor:** Standard 720p or 1080p USB webcam (matching deployment kiosk hardware).
- **Distance:** 30 cm to 60 cm from the camera lens to the center of the hand-rubbing volume.
- **Lighting Setup:** Natural overhead room lighting (300–500 lux).

---

## 3. Dataset Variation Checklist

To prevent bias and overfitting, recording sessions must systematically sample across the following variation axes:

### A. Lighting Conditions
- [ ] Direct fluorescent overhead lighting (standard institutional classroom/restroom).
- [ ] Diffuse natural daylight from side window.
- [ ] Warm/low lighting (sub-optimal restroom condition, ~150 lux).
- [ ] Backlit condition (window or light source behind the sink).

### B. Clothing & Sleeves
- [ ] Bare forearms and wrists.
- [ ] Short sleeves with bare wrists.
- [ ] Rolled-up long sleeves.
- [ ] Long sleeves down to wrists with dark cuff fabrics.
- [ ] Long sleeves down to wrists with light/patterned cuff fabrics.

### C. Skin Tones & Demographic Representation
- [ ] Fitzpatrick Scale Type I & II (Fair / Pale).
- [ ] Fitzpatrick Scale Type III & IV (Medium / Olive).
- [ ] Fitzpatrick Scale Type V & VI (Dark brown / Deeply pigmented).
- [ ] Diverse hand anatomies, finger lengths, and palm sizes.

### D. Distance and Spatial Framing
- [ ] Close framing (30 cm distance, hands occupy ~60% of frame).
- [ ] Standard framing (45 cm distance, hands occupy ~35% of frame).
- [ ] Distant framing (60 cm distance, hands occupy ~20% of frame).
- [ ] Camera angles: 15° shallow tilt, 30° nominal tilt, 45° steep overhead tilt.

### E. Environment & Surface Materials
- [ ] White porcelain sink basin.
- [ ] Brushed stainless steel sink basin.
- [ ] Tiled backsplash with grout lines.
- [ ] Running tap water active in background.

### F. Moisture & Soap State
- [ ] Completely dry hands (baseline movement collection).
- [ ] Wet hands (water glistening, surface reflections).
- [ ] Light soap lather (white bubbles visible).
- [ ] Heavy soap foam covering fingers and palms.

---

## 4. Labelling and Annotation Guidelines

### 4.1 Temporal Boundary Rules
1. **Initiation:** Label the gesture starting from the first frame where both hands make physical contact in the intended posture.
2. **Execution:** Maintain the active gesture label through continuous cyclic rubbing cycles.
3. **Termination:** Mark the end of the gesture at the frame where hand contact breaks or changes orientation.
4. **Transitions:** Ambiguous frames between two gestures (e.g., separating hands to switch thumbs) must be labeled as `IDLE_BACKGROUND`. Never assign a transition frame to an active gesture class.

### 4.2 File Naming and Partitioning Schema
To eliminate data leakage between training, validation, and test sets, file names must encode participant ID and session ID:

```
p<participant_id>_s<session_id>_<gesture_class>_<frame_id>.png
```

**Examples:**
- `p03_s01_PALM_TO_PALM_0042.png`
- `p08_s02_THUMB_RUBBING_0119.png`

### 4.3 Participant-Independent Data Splits
- **Strict Rule:** Participants appearing in the test set must **NEVER** appear in the training or validation sets.
- Random frame-level shuffling across video sequences is strictly prohibited (causes near-100% synthetic accuracy while failing in production).
- Minimum partition:
  - **Train:** 65% of unique participants.
  - **Validation:** 15% of unique participants.
  - **Test (Held-Out):** 20% of unique participants.
