# Bubsy — Security, Privacy & Child Safety

**Version:** 1.0  
**Scope:** Kiosk, teacher portal, backend API, local database, and AI processing.

## 1. Security objectives

Bubsy handles records relating to schoolchildren. The design must minimize data collection, prevent unauthorized access, avoid unnecessary exposure of student performance, and keep camera processing local.

Security is part of the product requirements, not a final deployment task.

## 2. Privacy commitments

- No facial recognition or face-based identity matching.
- No persistent recording of session photos or videos.
- No storage of raw frames, image paths, or video files.
- No facial templates or biometric identity profiles.
- Use QR and optional NFC/RFID credentials for identification.
- Keep only the minimum student information approved by the school.
- Do not expose a student's session history to other students.
- Clearly indicate when the camera is active.
- Do not describe AI gesture recognition as proof of cleanliness or germ removal.

Frames may exist temporarily in memory for inference and must be discarded after processing. Debug mode must not introduce image recording.

## 3. Threat model

| Threat | Example | Mitigation |
|---|---|---|
| Unauthorized teacher access | A user opens the admin portal | Authentication, role-based authorization, session expiry |
| Credential disclosure | QR code contains a student's name | Use opaque random tokens, not personal details |
| QR/card cloning | A copied credential is used | Use revocable tokens, monitor duplicate/overlapping sessions, apply school-approved card controls |
| Reward manipulation | Repeated API request awards points repeatedly | Server-side qualification and idempotency keys |
| Local database theft | Device or database file is copied | OS account permissions, disk protection where available, restricted backups |
| Malicious input | Invalid strings or oversized payloads | Pydantic validation, limits, safe SQL parameterization |
| Excessive data exposure | Student list or leaderboard leaks records | Role checks, minimum fields, school-approved display policy |
| Model failure | Wrong movement is recognized | Uncertainty state, temporal validation, measured model performance |
| Debug-data leakage | Frames are written to logs | Redacted logs and tests that detect prohibited persistence |
| Unsafe configuration change | Reward rules are modified without authorization | Admin-only changes and audit events |

## 4. Authentication and authorization

- Teacher and administrator routes must require authentication.
- Enforce authorization on the backend, not only by hiding frontend navigation.
- Use explicit roles such as `admin`, `teacher`, and `operator`; grant each role only the permissions needed.
- Hash passwords using a maintained password-hashing implementation such as Argon2id or bcrypt.
- Never store plaintext passwords or place secrets in frontend environment variables.
- Use secure session handling. If cookie-based sessions are used, configure HttpOnly, SameSite, and Secure flags when served over HTTPS, plus CSRF protection where applicable.
- Rate-limit login attempts where feasible and record security-relevant events without logging passwords or tokens.
- Provide a documented process to disable a compromised teacher account.

The local kiosk may have a restricted kiosk mode, but administrative capabilities must not be available through the student interface.

## 5. Credential protection

- QR codes should contain opaque, random identifiers or signed tokens, not names, class, or other personal information.
- Store credential mappings in the database with revocation support.
- Consider storing a keyed hash of the token for lookup instead of the raw token.
- Never log complete QR payloads or NFC identifiers unnecessarily.
- A failed scan must not result in guessed identity assignment.
- If identification fails, offer retry, optional NFC if configured, teacher-assisted identification, or an unassigned guidance session that earns no student-specific points.
- Support credential replacement and immediate revocation.

## 6. API and application security

- Validate every request and response schema.
- Use parameterized database queries or a safe ORM/data-access layer.
- Restrict CORS to the actual local application origins; do not allow all origins in production without a documented reason.
- Set request size limits and reasonable timeouts.
- Return generic errors to users; keep technical details in access-controlled logs.
- Do not expose stack traces, local paths, secrets, or model file locations through public API responses.
- Validate file imports and exports, including CSV content and size.
- Protect report downloads with authorization checks.
- Keep dependencies patched and pin tested versions.
- Avoid executing shell commands or dynamic code from user-provided input.

## 7. Camera and AI privacy

- The camera is used only for live gesture recognition and QR scanning as needed.
- Do not store frames or video.
- Avoid face detection or face tracking unless a separately approved requirement is introduced; the current product does not require it.
- Do not log frame pixels, image arrays, or base64-encoded images.
- Keep AI diagnostics to model version, aggregate timing, result codes, and appropriately minimized confidence summaries.
- Make it possible to disable debug logging in production.
- Test the entire codebase for image/video writes before release.
- Model confidence is not a clinical or microbiological measure of cleanliness.

## 8. Child safety and fairness

- Feedback must be supportive and non-shaming.
- Do not publicly display private student records or detailed failure histories.
- Make leaderboard visibility a school-controlled setting.
- Use approved display names or anonymized labels for public rankings when appropriate.
- Reward validated technique and consistent healthy habits, not raw session volume.
- Apply daily reward caps and duplicate prevention.
- Do not penalize a student because the camera cannot see a movement reliably.
- Provide teacher-assisted recovery when technology fails.
- Obtain school approval for data collection, retention, student-facing language, and leaderboard policy before deployment.

## 9. Local/offline deployment

- Run the application under a dedicated, non-administrator operating-system account where practical.
- Restrict database, configuration, and log file permissions.
- Bind backend services to localhost unless remote access is explicitly required.
- If the teacher portal must be accessed from another machine, use authenticated network access and encrypted transport; do not expose an unauthenticated API to the school network.
- Disable unnecessary Windows sharing and services on the kiosk device.
- Provide a safe startup/recovery process after reboot.
- Keep secrets outside the repository and protect backup files.

## 10. Logging and audit

Allowed diagnostic data may include timestamp, component, error code, kiosk ID, model version, duration, and sanitized session ID.

Never log passwords, authentication tokens, full credential values, camera frames, photos, videos, or unnecessary student personal information.

Audit at least:
- Teacher login and relevant account changes.
- Student and credential changes.
- Reward-rule changes.
- Manual score corrections.
- Exports and sensitive report access.
- Retention and deletion actions.

## 11. Incident response

1. Stop the affected kiosk or disable the affected feature if student data may be exposed.
2. Preserve relevant sanitized logs without copying camera recordings.
3. Restrict access and change compromised credentials.
4. Notify the designated school contact according to the agreed incident procedure.
5. Assess affected records and document the response.
6. Fix the cause, test the correction, and record approval before restoring service.

## 12. Security release checklist

- [ ] Teacher authentication and backend role checks work.
- [ ] Passwords are securely hashed.
- [ ] QR/NFC credentials can be revoked.
- [ ] Duplicate reward submissions are rejected.
- [ ] No camera images or videos are persisted.
- [ ] Logs contain no passwords, tokens, or raw images.
- [ ] Database and backups have restricted access.
- [ ] Student and report endpoints enforce authorization.
- [ ] Leaderboard visibility follows school policy.
- [ ] Offline startup and recovery are tested.
- [ ] Dependency and secret scans are completed.
- [ ] School retention and consent/approval procedures are documented.
