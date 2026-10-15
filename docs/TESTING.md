# Bubsy — Testing & Quality Assurance Plan

**Version:** 1.0  
**Objective:** Verify that Bubsy is safe, reliable, privacy-conscious, and usable before school deployment.

## 1. Quality goals

Testing must cover the complete workflow, not just whether the AI model returns a class label. The product includes credential resolution, gesture recognition, sequence validation, session persistence, scoring, teacher administration, and child-facing feedback.

The AI model must be evaluated independently. Do not assume a previously supplied checkpoint is reliable without fresh measurements.

## 2. Testing layers

| Layer | Focus | Tools |
|---|---|---|
| Unit | Pure business rules and validators | Pytest, Vitest |
| Integration | API + database + session workflow | Pytest, FastAPI TestClient |
| Component | React components and interaction states | React Testing Library |
| End-to-end | Student and teacher workflows | Playwright |
| AI evaluation | Per-class recognition performance | Python evaluation scripts |
| Performance | Inference, memory, startup, UI feedback | Profiling/timing scripts |
| Privacy/security | Access control, prohibited persistence, credential handling | Automated tests and manual review |
| Deployment | Windows startup, webcam, database recovery | Target-device checklist |
| Usability | Child comprehension and teacher workflow | Supervised school-approved evaluation |

## 3. Unit tests

### Student credentials
- Valid active QR credential resolves to the correct internal student ID.
- Revoked credential is rejected.
- Unknown credential is rejected.
- NFC and QR credentials for one student resolve to the same student record.
- Credential collisions are rejected.
- Failed identification never assigns a random student.

### Session state machine
- A new session begins in the expected state.
- Out-of-order gestures do not advance the sequence incorrectly.
- Short-lived predictions do not automatically satisfy a step.
- Low-confidence or ambiguous predictions enter an uncertain/retry state.
- A completed session satisfies all configured qualification rules.
- Cancelled or incomplete sessions do not receive qualifying points.
- Unassigned sessions do not award student-specific points.

### Scoring and rewards
- Points are calculated only on the backend.
- Non-qualifying sessions receive no points.
- Duplicate requests do not duplicate rewards.
- Daily caps are enforced.
- Manual corrections create auditable transactions.
- Badge criteria are applied consistently.
- Monthly totals handle month-end, year-end, and school timezone boundaries.

### Database
- Foreign keys are enforced.
- Unique credentials and idempotency keys are enforced.
- Transactions roll back if reward creation fails.
- Migrations preserve existing records.
- No session path writes image/video data.

## 4. API integration tests

Test all endpoints for:
- Valid request and response schemas.
- Missing, malformed, oversized, and unexpected input.
- Authentication-required behaviour.
- Role-based access control.
- Not-found and conflict responses.
- Database failure and transaction rollback.
- Duplicate session completion.
- Unauthorized export attempts.
- Correct pagination and filtering.
- Sanitized errors that do not leak stack traces or secrets.

At minimum, test that a teacher cannot modify administrator-only settings unless their role grants that permission.

## 5. AI model evaluation

### Dataset protocol
- Document each gesture class and its operational definition.
- Include varied lighting, skin tones, sleeve types, camera distances, backgrounds, and movement speeds where feasible.
- Use a consent and school-approval process for any collection involving people.
- Keep dataset access restricted and define retention.
- Split data by recording session or participant when practical to reduce leakage from near-identical frames.
- Document class balance, exclusions, model version, and preprocessing.

### Required metrics
- Per-class precision, recall, and F1-score.
- Macro F1-score.
- Confusion matrix.
- False accepted transitions.
- Sequence-level agreement with human-labelled reference sessions.
- Uncertain/retry rate.
- Inference latency on the actual target computer.
- CPU and memory use over sustained operation.

Frame-level accuracy is not enough. A model can achieve misleading aggregate results by predicting the majority/background class. Evaluate end-to-end session behaviour.

### Initial proposed release gates
These are engineering targets to validate, not claims of current performance:
- Macro F1-score of at least 0.85 on an independent test set.
- At least 90% sequence-level agreement on the defined evaluation set.
- No more than 5% false accepted transitions on the defined test protocol.
- 95th-percentile inference latency under 200 ms per processed frame on the selected device, if the target hardware can reasonably support it.
- No persistent camera image or video output.

If a target is not met, document the gap and mitigation. Do not weaken the metric after testing simply to claim success.

## 6. Performance tests

Measure on the Windows laptop and later on the selected kiosk device:
- Cold application startup.
- Model load time.
- Average and p95 inference latency.
- End-to-end delay from recognized movement to kiosk feedback.
- CPU and memory use during a sustained session.
- Stability during repeated sessions.
- Behaviour when the webcam is disconnected or occupied by another process.
- Database response times with realistic sample data.
- Recovery after app restart and unexpected termination.

Initial proposed target: kiosk feedback should appear within 500 ms after the backend has validated a recognition event, under the defined test conditions. Measure and report actual results.

## 7. End-to-end scenarios

### Student workflow
1. Start kiosk.
2. Scan a valid QR code.
3. Confirm the student identity according to policy.
4. Begin a session.
5. Complete the configured handwashing sequence.
6. Verify that the session is stored.
7. Verify points and badges are correct.
8. Verify personal progress reflects the transaction.

### Identification failure
1. Scan an invalid or revoked code.
2. Confirm the kiosk displays a clear retry message.
3. Verify no student is guessed or selected automatically.
4. Try optional NFC if configured.
5. If still unsuccessful, use the approved teacher-assisted or unassigned path.
6. Verify no student-specific points are awarded without a valid identity.

### Recognition uncertainty
1. Present an ambiguous or partially obscured movement.
2. Verify the system requests a retry or reports uncertainty.
3. Verify the step is not falsely accepted.
4. Verify the child receives neutral, supportive language.

### Duplicate submission
1. Submit a qualifying completion event.
2. Repeat the same request with the same idempotency key.
3. Verify exactly one reward transaction exists.

### Teacher workflow
1. Sign in with an authorized teacher account.
2. View overview metrics.
3. Search a student and open the profile.
4. Filter sessions and inspect an uncertain outcome.
5. View the monthly leaderboard.
6. Generate an authorized report.
7. Attempt an unauthorized administrative action and verify rejection.

### Device recovery
- Start without a webcam.
- Start without the model file.
- Simulate database unavailability.
- Disconnect the camera during a session.
- Restart after an incomplete session.
- Verify the app shows safe recovery guidance and does not issue incorrect rewards.

## 8. Privacy and security tests

- Search runtime directories for image/video files after test sessions.
- Verify logs do not contain frames, passwords, full QR tokens, or auth tokens.
- Confirm teacher APIs reject unauthenticated access.
- Confirm role restrictions are enforced server-side.
- Test credential revocation.
- Test CSV export authorization and sanitization.
- Verify no facial recognition or face-identity pipeline exists.
- Verify student-facing screens do not expose other students' private histories.
- Test database and backup permissions on Windows.

## 9. Usability tests

Conduct school-approved, supervised usability testing before deployment.

Observe whether students can:
- Understand how to start.
- Identify where to scan their code.
- Follow each instruction without reading dense text.
- Understand retry prompts.
- Finish without keyboard or mouse assistance.
- Understand the reward screen without being shamed.

Observe whether teachers can:
- Find a student's record quickly.
- Identify device failure versus recognition uncertainty.
- Understand leaderboard scoring.
- Export a report without exposing unnecessary data.

Record observations without recording children's faces or sessions. Obtain the required school permissions and use an approved evaluation process.

## 10. Defect severity

- **Critical:** privacy breach, unauthorized student data access, false identity assignment, duplicate/incorrect reward issuance at scale, or camera recording against policy.
- **High:** core workflow unusable, session corruption, teacher authentication bypass, repeated false accepted gestures.
- **Medium:** report inaccuracies, recoverable device errors, confusing kiosk instructions.
- **Low:** cosmetic defects, spacing issues, minor non-blocking inconsistencies.

Critical and high-severity issues must be resolved before pilot deployment.

## 11. Test data

- Use synthetic student records during development.
- Keep test credentials clearly separated from real credentials.
- Never place real school records in public repositories or CI logs.
- Make test data reproducible and disposable.
- Avoid real student imagery unless collection is approved and necessary; do not retain images in production.

## 12. Release checklist

- [ ] Unit and integration tests pass.
- [ ] End-to-end student and teacher workflows pass.
- [ ] Independent AI evaluation is documented.
- [ ] Performance is measured on the target device.
- [ ] Duplicate rewards are prevented.
- [ ] Invalid credentials fail safely.
- [ ] Camera and model failures have recovery paths.
- [ ] No photos or videos are persisted.
- [ ] Authentication and role checks pass.
- [ ] Backup and restore are verified.
- [ ] School privacy, retention, and leaderboard policies are approved.
- [ ] Known limitations are documented and accepted.
