# Bubsy — Agent & AI Coding Instructions

This file provides repository-wide instructions for AI coding agents and human contributors. Follow it before changing code.

## 1. Product context

Bubsy is an AI-powered handwashing guidance and compliance system for elementary and junior school deployment.

- Product name: **Bubsy**
- Product tagline: **The AI Handwashing Adventure**
- Academic title: **AI-Powered Handwashing Guidance and Compliance System**
- Student reward terminology: **Bubsy Points**, **Bubsy Badges**, **Bubsy Champion**
- First development target: Windows laptop with a webcam.
- Intended deployment: dedicated local kiosk computer near a school sink.
- Primary interfaces: student kiosk and teacher portal.
- Core technologies: React, TypeScript, Vite, Python, FastAPI, OpenCV, Ultralytics YOLO, SQLite.
- Identification: QR code and optional compatible NFC/RFID reader.
- Privacy: no facial recognition, no persistent session photographs, and no session videos.

Treat the existing `PRD.md`, `DESIGN.md` (or `DESIGN_SYSTEM.md`), and `TECH_STACK.md` as project source documents. If their actual filenames differ, inspect the repository and use the files that exist. Do not overwrite or silently contradict them.

## 2. Highest-priority rules

1. Inspect the existing repository and relevant documentation before editing.
2. Do not replace working code or restructure the project without a clear reason.
3. Do not invent product requirements. If a requirement is ambiguous, choose the smallest reversible implementation and document the assumption.
4. Never claim that a feature is complete unless it is implemented and tested.
5. Do not use mock data in production paths. Clearly label demo fixtures.
6. Never store session images or videos, raw camera frames, facial embeddings, or facial identity data.
7. Do not add facial recognition or continuous face tracking.
8. Never assign a student identity based on guesswork when QR/NFC resolution fails.
9. Do not award points directly from frontend state or raw YOLO predictions. Use the backend's validated session and scoring rules.
10. Do not claim that gesture recognition proves hands are germ-free or confirms microbiological cleanliness.
11. Keep the application usable offline for its core kiosk workflow.
12. Do not commit secrets, real student data, local databases, private credentials, or unlicensed model weights.

## 3. Required workflow for each task

### Step 1 — Inspect
- Read relevant documentation and existing implementation.
- Check current folder structure, package scripts, dependencies, and tests.
- Identify the smallest set of files needed for the task.

### Step 2 — Plan
- State the intended change briefly.
- Identify API, database, UI, privacy, and compatibility implications.
- Preserve existing conventions unless there is a reason to change them.

### Step 3 — Implement
- Make focused, incremental changes.
- Keep routes thin and business logic in services.
- Keep AI inference separate from session validation and scoring.
- Use typed API contracts and validated inputs.
- Add loading, empty, error, and uncertainty states.
- Use the shared design system rather than one-off styles.

### Step 4 — Verify
- Run relevant tests, lint, and type checks.
- Add tests for new business rules and failure paths.
- Inspect the diff for unintended edits and secrets.
- Report commands run and their actual outcomes.
- If a command could not be run, state that explicitly.

### Step 5 — Document
- Update documentation when endpoints, schemas, configuration, or user workflows change.
- Record unresolved limitations and assumptions.
- Never report a passing test that was not executed.

## 4. Architecture boundaries

### Frontend
- React + TypeScript + Vite.
- Keep kiosk and teacher experiences separate in routing and layouts.
- Reuse components and design tokens.
- The frontend presents state; it is not authoritative for identity, session qualification, or rewards.
- Do not place secrets in `VITE_*` variables.

### Backend
- Python + FastAPI.
- Use Pydantic validation at API boundaries.
- Keep business rules in service modules.
- Use transactions for session completion and reward issuance.
- Enforce authentication and authorization server-side.
- Use stable error codes and sanitized messages.

### Vision service
- OpenCV handles camera capture and preprocessing.
- YOLO provides gesture predictions.
- Temporal and sequence validation determine whether events can advance the session.
- An uncertain prediction must remain uncertain or trigger a retry.
- Release the camera reliably on shutdown and failure.
- Do not write camera frames to disk.

### Database
- SQLite for the initial local deployment.
- Enable foreign keys.
- Use parameterized queries.
- Use migrations or versioned schema scripts.
- Preserve transaction history; reverse incorrect rewards with compensating transactions.
- Do not delete or recreate a production database to apply an update.

## 5. UI and accessibility rules

- Follow the existing blue-and-white Bubsy design system.
- Teacher portal: professional dashboard, clear sidebar, readable data cards, charts, tables, and accessible forms.
- Kiosk: full-screen, child-friendly instructions, large touch targets, minimal text, clear progress, and encouraging feedback.
- Support keyboard accessibility in the teacher portal.
- Do not rely on colour alone to convey status.
- Keep student feedback neutral and supportive; never shame a child.
- Clearly distinguish recognition uncertainty from a student error.
- Do not expose student histories or private scores on public kiosk screens.

## 6. Testing requirements

For relevant changes:
- Backend business rules: Pytest.
- API and persistence: integration tests.
- Frontend components: Vitest and React Testing Library.
- User workflows: Playwright where configured.
- AI changes: evaluate per-class precision, recall, F1, confusion matrix, sequence-level agreement, false accepted transitions, latency, and memory.
- Privacy changes: verify no prohibited image/video persistence.
- Reward changes: test duplicate requests, caps, reversals, and month boundaries.

Do not treat model output or aggregate frame accuracy as proof of reliable end-to-end session recognition.

## 7. Dependency and configuration rules

- Prefer maintained, compatible dependencies.
- Pin or lock versions after testing.
- Do not add large libraries for functionality already supported by the stack.
- Update dependency documentation when packages change.
- Keep `.env.example` to placeholders only.
- Validate required configuration at startup.
- Keep generated data, logs, caches, local SQLite databases, and model files out of Git unless a documented exception is approved.

## 8. Data and API rules

- Use internal student IDs in session and reward records.
- Store opaque, revocable QR/NFC credential mappings.
- Keep timestamps consistent and make school timezone explicit for monthly reports.
- Make reward issuance idempotent.
- Ensure all admin endpoints enforce permissions.
- Use pagination for potentially large lists.
- Sanitize logs and exported data.
- Do not include personal data in error messages or request IDs.

## 9. Definition of done

A task is done only when:
- The requested behaviour is implemented.
- Relevant tests have been run, or unrun tests are clearly disclosed.
- Existing functionality is not knowingly broken.
- Privacy and authorization implications are addressed.
- UI states and failure cases are handled.
- Documentation is updated where necessary.
- The final response lists what changed, what was tested, and any remaining limitations.

## 10. Do not do these things

- Do not redesign the whole app when asked to fix one component.
- Do not substitute fake analytics for real database queries without clearly labelling demo mode.
- Do not add cloud dependencies to core kiosk operation without explicit approval.
- Do not add facial recognition.
- Do not save or upload session images or videos.
- Do not silently assign unknown students.
- Do not let the browser calculate authoritative rewards.
- Do not hardcode passwords, secret keys, or school credentials.
- Do not claim AI accuracy, privacy compliance, or deployment readiness without evidence.
