# Bubsy — Manual Hardware, Usability & Governance Test Plan

**Version:** 1.0  
**Target Deployment:** School Sink Kiosk Computer (Windows 11 Laptop with External/Integrated Webcam)

---

## 1. Overview & Scope

While automated unit, integration, performance, and Playwright end-to-end tests cover backend logic, state machines, and web interfaces, specific quality and safety requirements mandate verification with physical hardware, environmental sink conditions, and human evaluation.

This document details the exact, step-by-step procedures, expected outcomes, and sign-off criteria for physical tests.

---

## 2. Test Procedures

### Test Case M-01: Physical Camera Disconnect Mid-Session
- **Goal:** Verify system safety when the physical USB cable is unplugged during an active wash session.
- **Hardware:** USB webcam connected to laptop.
- **Procedure:**
  1. Launch kiosk (`start_bubsy.bat`).
  2. Start a session and advance to the `ACTIVE_WASH` screen.
  3. While hands are actively moving in front of the lens, unplug the USB webcam cable.
  4. Observe kiosk display and listen for audio cues.
  5. Check `Kiosk & AI Status` page in the Teacher Portal.
  6. Reconnect the USB webcam cable.
- **Expected Outcome:**
  - Kiosk does not crash or display an unhandled JavaScript/Python error screen.
  - Kiosk displays a neutral, non-shaming notification: *"Camera resting. Please ask your teacher for help."*
  - Active session transitions safely to `interrupted`. Zero student reward points are awarded.
  - Teacher portal records diagnostic event: `CAMERA_READ_FAILED` / `CAMERA_DISCONNECTED`.
  - Upon reconnection, status recovers to connected on next session attempt.
- **Sign-Off:** Tester signature and date.

---

### Test Case M-02: Sink Environment Lighting & Optical Interference
- **Goal:** Assess gesture recognition robustness across variable school restroom lighting conditions.
- **Conditions to Test:**
  - Daylight (direct window sunlight onto sink surface)
  - Dim lighting (fluorescent bank partially turned off)
  - Glare on stainless steel sink basin
  - Water droplets on camera protective casing
- **Procedure:**
  1. Position kiosk at sink per [CAMERA_SETUP.md](file:///c:/Users/georg/Bubsy/docs/CAMERA_SETUP.md).
  2. For each lighting condition, perform the standard 6 rubbing movements.
  3. Observe whether the temporal window indicates `SUPPORTED` or prompts `UNCERTAIN` retry.
  4. Deliberately spray clean water droplets on the lens protector glass.
- **Expected Outcome:**
  - System reliably detects palm-to-palm and interlaced fingers under daylight and normal artificial light.
  - If glare or water droplets cause ambiguity, the system emits an encouraging retry prompt (*"Show Bubsy your palms again!"*) and never marks the session as a failure.
  - Water droplets must not produce false step advancement.
- **Sign-Off:** Tester signature and date.

---

### Test Case M-03: Physical Student QR Badge Scanning & Wear
- **Goal:** Test scanning speed, child handling, and damaged/smudged badge behavior.
- **Materials:** 10 printed PVC student QR cards (5 pristine, 3 laminated with scuffs, 2 crumpled/bent).
- **Procedure:**
  1. Open kiosk to `IDENTIFY` screen.
  2. Present pristine QR card at distances of 15 cm, 30 cm, and 50 cm.
  3. Present scuffed and bent QR cards.
  4. Test child hand tremor (slight shaking movement).
- **Expected Outcome:**
  - Pristine badge scans within 500 ms at 20–35 cm.
  - Audible chime and friendly greeting: *"Hello Liam! Ready to wash?"*
  - Damaged cards fail gracefully: after 3 attempts, kiosk presents *"Need help?"* dialog and teacher-assisted or unassigned wash option.
  - Never guesses or assigns an incorrect student ID.
- **Sign-Off:** Tester signature and date.

---

### Test Case M-04: Optional NFC/RFID Reader Card Tap (If Configured)
- **Goal:** Verify contactless card reader integration and collision rejection.
- **Hardware:** Compatible USB NFC reader (e.g., ACR122U or RC522).
- **Procedure:**
  1. Tap registered student NFC wristband/card against reader.
  2. Tap an unregistered / foreign MIFARE card.
  3. Tap two cards simultaneously (collision).
- **Expected Outcome:**
  - Registered card immediately identifies student to matching record as QR.
  - Foreign card displays polite rejection without error crash.
  - Collision does not freeze background reader service.
- **Sign-Off:** Tester signature and date.

---

### Test Case M-05: Supervised Child Usability & Emotional Safety Evaluation
- **Goal:** Verify that elementary/junior school students can independently operate the kiosk without confusion, fear, or shaming.
- **Participants:** 5–10 students under teacher supervision with school consent.
- **Observations:**
  1. Do students understand where to stand and how to tap "LET'S WASH!"?
  2. Can students locate the camera frame to show their card?
  3. Do students follow the illustrated rubbing animations without reading dense text?
  4. When an ambiguous gesture triggers a retry prompt, is the child encouraged rather than discouraged?
  5. Does the reward screen elicit positive reinforcement?
- **Expected Outcome:**
  - Over 90% of students complete the wash adventure without manual adult intervention.
  - Zero negative or anxious reactions to retry hints.
- **Sign-Off:** School observer / teacher lead signature.

---

### Test Case M-06: Teacher Administrative Workflow & Report Export
- **Goal:** Confirm school staff can audit sessions, review leaderboard, and export CSVs on Windows.
- **Procedure:**
  1. Teacher logs into portal (`/teacher/login`).
  2. Search for student by name or code.
  3. Inspect a session marked `recognition_uncertain`.
  4. Verify the ethics note is prominently displayed.
  5. Download CSV export and open in Microsoft Excel.
- **Expected Outcome:**
  - Search returns correct student within 1 second.
  - Inspection modal displays expected vs recognized sequence and duration breakdown.
  - Excel opens CSV cleanly without formatting corruption or Excel formula injection. Header includes hygiene disclaimer.
- **Sign-Off:** Teacher representative signature.

---

### Test Case M-07: School Governance & Policy Approvals
- **Goal:** Ensure regulatory, ethical, and privacy adherence before pilot launch.
- **Checklist:**
  - [ ] School board / principal consent for local QR badge distribution.
  - [ ] Approval of data retention period (default 365 days).
  - [ ] Approval of leaderboard visibility setting (`school`, `class`, or `disabled`).
  - [ ] Confirmation that no facial recognition is active and no session images/videos are saved.
- **Sign-Off:** School administrator / privacy officer.
