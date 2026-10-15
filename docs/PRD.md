Bubsy
Product Requirements Document (PRD)
The academic project title can remain AI-Powered Handwashing Guidance and Compliance
System, with Bubsy as its product brand.
Product: Bubsy — AI-Powered School Handwashing Guidance and Compliance System​
Document version: 1.0​
Project type: B.Tech Computer Science and Engineering Final-Year Project​
Target users: Elementary and junior school students, teachers, and school administrators​
Initial deployment: Windows laptop with webcam​
Future deployment: Dedicated kiosk computer installed near a school handwashing station​
Status: Product specification and implementation baseline

1. Executive Summary
SMART WASH is an AI-assisted handwashing guidance and monitoring system designed to
help elementary and junior school students learn and follow an appropriate handwashing
technique.
The system combines a child-friendly kiosk interface, computer vision, QR/NFC-based student
identification, session-level scoring, gamified rewards, and a teacher analytics portal.
When a student approaches the kiosk, they identify themselves using a QR student card or an
NFC/RFID card. The system then guides them through the handwashing process using visual
instructions, animations, and audio prompts. A single camera captures the necessary video
frames, and a YOLO-based computer vision pipeline analyses visible hand movements.
The system evaluates the detected sequence, duration, and confidence of individual actions.
After the session, it calculates a technique-completion score, awards eligible points, updates the
student's progress, and stores a structured session record.
Students receive a simple, encouraging experience. Teachers receive a more comprehensive
portal containing student management, session histories, monthly leaderboards, compliance
trends, recognition diagnostics, and downloadable reports.
SMART WASH is designed to minimise the collection of personal information. It does not require
facial recognition, continuous face tracking, or saved photographs of students during

handwashing sessions. Video frames are processed for recognition without retaining session
video recordings.
The initial implementation will run locally on a Windows laptop. The architecture will be designed
to support migration to a dedicated kiosk computer after functional, recognition, usability, and
reliability testing.

1.1 Product vision
Make correct handwashing easier to learn, practise, and reinforce in schools through an
accessible, interactive, privacy-conscious system.

1.2 Mission
Deliver a complete working application that:
●​
●​
●​
●​
●​
●​

Teaches students an appropriate handwashing procedure.
Recognises visible handwashing movements using computer vision.
Gives understandable feedback about detected actions.
Encourages repeated good practice through fair, age-appropriate rewards.
Helps teachers understand participation and system performance.
Works locally without requiring a permanent internet connection for the core workflow.

1.3 Product positioning
SMART WASH is an educational hygiene assistant, not a medical diagnostic device, a germ
detector, or a definitive measurement of hand cleanliness.
The system can evaluate observable movements and adherence to configured instructions. It
cannot establish that a student's hands are free of pathogens merely because the movements
appear correct.

2. Problem Statement
Handwashing is an important hygiene practice, but children may forget steps, rush through the
process, or struggle to remember the correct technique.
Teachers may find it difficult to supervise every student's handwashing during busy school
routines. Traditional instructional posters provide reminders but cannot give interactive feedback
or automatically maintain participation records.

Existing software prototypes can also fail when AI recognition is unreliable, when interfaces
overwhelm young users, or when collecting student information becomes unnecessarily
complicated.
SMART WASH addresses these problems through a guided, repeatable handwashing
experience combined with an administrative monitoring system.

2.1 Problems to solve
1.​ Children need clear, age-appropriate instructions that are easy to follow independently.
2.​ Handwashing movements need to be assessed more consistently than through
unstructured visual observation alone.
3.​ Schools need a practical way to associate sessions with individual students without
facial recognition.
4.​ Students need an engaging way to understand their progress and earn rewards.
5.​ Teachers need accurate session records, monthly comparisons, and actionable reports.
6.​ The system must handle recognition failures and hardware problems without generating
misleading scores.
7.​ The application must be maintainable, affordable, and suitable for eventual school
deployment.

2.2 Proposed solution
A single-camera kiosk that combines:
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

QR-based student identification through the webcam.
Optional NFC/RFID card identification through a compatible reader.
YOLO-based handwashing movement recognition.
OpenCV-based camera and image-processing operations.
Temporal validation and a deterministic scoring engine.
Local session storage and reward management.
A simplified student kiosk interface.
A detailed teacher portal.
A monthly student leaderboard.
Offline operation and recovery mechanisms.

3. Goals and Success Criteria
3.1 Primary goals

G1. Teach: Provide understandable instructions for the selected handwashing protocol.
G2. Recognise: Detect relevant handwashing movements under the supported camera and
environmental conditions.
G3. Identify: Associate sessions with students through QR or NFC/RFID credentials without
facial recognition.
G4. Evaluate: Produce transparent, reproducible scores based on detected actions and
configured rules.
G5. Motivate: Reward qualifying technique and improvement through a monthly leaderboard
and individual achievements.
G6. Inform: Give teachers access to student histories, class-level statistics, AI diagnostics, and
reports.
G7. Protect: Minimise personal data collection and avoid persistent recording of children.
G8. Deploy: Establish a working Windows prototype that can later run on dedicated kiosk
hardware.

3.2 Proposed measurable acceptance targets
These are initial engineering targets to validate and refine during the feasibility phase, not
claims about current model performance.
Metric

Initial acceptance target

Student
identification

At least 99% correct resolution of valid QR/NFC credentials in the
controlled test suite

AI per-step
recognition

Macro F1 score of at least 0.85 on an independent test set

Sequence
evaluation

At least 90% agreement with human-labelled session outcomes on
the defined test protocol

False step
completion

No more than 5% of eligible test transitions incorrectly accepted

Local inference
latency

95th-percentile processing latency below 200 ms per analysed frame
on the target test laptop

Kiosk response

Visible feedback within 500 ms of receiving an actionable, validated
result under normal local conditions

Session integrity

Every completed session is associated with one valid student ID or
explicitly marked as unassigned

Privacy

No persistent session video or student photograph created by the
handwashing workflow

Offline operation

Identification, guidance, scoring, rewards, and local reporting work
without internet access

Recovery

Camera and reader failures produce clear error states without silently
corrupting sessions

Recognition targets must be evaluated on held-out recordings, ideally with
participant-independent testing. If a target cannot be achieved, the team must document the
limitation, improve the system, or narrow the supported conditions before deployment.
A high score on synthetic data or a randomly split set of adjacent video frames does not satisfy
these acceptance criteria.

4. Target Users and User Personas
4.1 Primary user: Student
Age group: Elementary and junior school students, approximately 5–14 years old, subject to
the school's actual age range.
Needs:
●​
●​
●​
●​
●​
●​
●​
●​

Large and readable instructions.
Minimal text and simple language.
Visual demonstrations of hand movements.
Clear audio prompts where appropriate.
Immediate, encouraging feedback.
A quick identification process.
No confusing administrative controls.
A private and understandable reward experience.

4.2 Secondary user: Teacher
Needs:

●​
●​
●​
●​
●​
●​
●​

Student and class management.
Session history and individual progress.
Monthly leaderboard management.
Participation and technique-completion trends.
Visibility into failed or uncertain AI detections.
Exportable reports.
The ability to correct identity or session-attribution errors with an audit trail.

4.3 Administrative user: School administrator
Needs:
●​
●​
●​
●​
●​
●​

School-wide participation summaries.
Class-level comparisons.
System configuration and deployment status.
Access management.
Data-retention and deletion controls.
Evidence that the application has been tested and operates within its stated limitations.

4.4 Technical operator
During the prototype and deployment stages, a designated operator needs to:
●​
●​
●​
●​
●​
●​

Configure the camera and card reader.
Install or update the application.
Load and validate model versions.
Inspect system logs.
Diagnose failures.
Back up and restore permitted application data.

5. Product Scope
5.1 In scope for the first complete release
1.​ Student identification using QR cards.
2.​ Optional NFC/RFID identification through compatible hardware.
3.​ Single-camera operation.
4.​ YOLO-based handwashing gesture classification.
5.​ OpenCV-based frame processing and camera handling.

6.​ Guided handwashing instructions.
7.​ Six active hand-rubbing movement classes.
8.​ Configurable preparation, rinsing, and finishing instructions.
9.​ Temporal filtering and sequence validation.
10.​Deterministic technique-completion scoring.
11.​Individual student progress and reward history.
12.​Monthly student leaderboard.
13.​Teacher authentication and role-based access.
14.​Student, class, session, and card management.
15.​Teacher analytics and reporting.
16.​Local database persistence and offline operation.
17.​CSV report export.
18.​Error handling, testing, and deployment documentation.

5.2 Explicitly out of scope for the first release
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
●​
●​

Facial recognition or face-embedding storage.
Continuous identity tracking through the camera.
Saving session photographs or video recordings.
Detecting pathogens or measuring actual microbial cleanliness.
Medical diagnosis or health-risk prediction.
Emotion recognition or student behavioural surveillance.
Public display of sensitive individual student histories.
Mandatory cloud infrastructure.
Automated disciplinary decisions based on AI scores.
Multiple simultaneous kiosk cameras.
Complex predictive analytics unrelated to handwashing.
Automatic soap, water, or tap control.
Unverified claims of regulatory compliance or production-grade recognition.

Features outside this scope require a separate justification and should not delay delivery of the
core product.

6. Core User Journey
6.1 Student workflow
1.​ The kiosk displays a welcome screen.
2.​ The student scans their QR card or taps their NFC/RFID card.
3.​ The system resolves the credential to an enrolled student record.

4.​ The kiosk confirms the student's identity using an appropriate display name or avatar.
5.​ The handwashing session begins.
6.​ The kiosk gives the preparation instructions.
7.​ The student follows the guided sequence of hand-rubbing movements.
8.​ The camera provides frames to the recognition pipeline.
9.​ The recognition engine produces predictions and confidence values.
10.​Temporal validation determines whether an action is sufficiently supported.
11.​The session controller tracks duration, sequence, and uncertain detections.
12.​The kiosk provides corrective guidance or advances when the configured conditions are
met.
13.​The student completes the remaining instructions.
14.​The scoring engine calculates the session result.
15.​The system persists the session and qualifying reward points.
16.​The kiosk displays a simple result, earned points, and a brief achievement message.
17.​The kiosk returns to the welcome screen.

6.2 Teacher workflow
1.​ The teacher opens the teacher portal.
2.​ The system verifies the teacher's credentials and permissions.
3.​ The dashboard displays participation, session, and system-health summaries.
4.​ The teacher selects a class, student, date range, or monthly reporting period.
5.​ The portal displays relevant records and trends.
6.​ The teacher can inspect an individual session's recognised steps, durations, score, and
uncertainty indicators.
7.​ The teacher can review the monthly leaderboard and achievement history.
8.​ The teacher can export authorised reports.
9.​ Any manual corrections to student attribution are recorded in the audit history.

6.3 Failed-identification workflow
1.​ A QR scan fails or produces an invalid credential.
2.​ The kiosk requests another attempt with clear positioning instructions.
3.​ If repeated scanning fails, the system offers NFC/RFID identification when supported.
4.​ If both mechanisms are unavailable, an authorised teacher may use a controlled manual
identification process.
5.​ The system must not assign the session to an arbitrary student.
6.​ If no identity can be verified, the session remains unassigned or the student can receive
instructional guidance without an individual reward.

7. Functional Requirements
Requirements use the following identifiers for implementation and testing.

7.1 Student identification
FR-ID-01 — QR scanning
The system shall scan QR student credentials using the kiosk webcam.
FR-ID-02 — NFC/RFID support
The system shall support an optional compatible card reader through a dedicated
credential-reader interface.
FR-ID-03 — Common identity resolution
QR and NFC/RFID credentials shall resolve to the same internal student identifier.
FR-ID-04 — Credential validation
The system shall reject malformed, unknown, disabled, or revoked credentials.
FR-ID-05 — Retry handling
The system shall provide clear instructions when scanning fails and prevent repeated failed
attempts from creating duplicate sessions.
FR-ID-06 — Manual fallback
An authorised teacher shall be able to associate a session with a student through a controlled
manual workflow.
FR-ID-07 — Duplicate prevention
The system shall prevent one identification event from creating multiple active sessions
unintentionally.
FR-ID-08 — Credential replacement
Teachers with appropriate permissions shall be able to revoke and replace a lost or damaged
credential without creating a new student identity.
FR-ID-09 — No biometric identification
The initial release shall not perform facial recognition or create facial biometric templates.

FR-ID-10 — Single-camera coordination
The webcam shall operate in mutually controlled identification and handwashing modes to avoid
unnecessary simultaneous scanning and recognition workloads.

7.2 Handwashing guidance
FR-GUIDE-01 — Welcome screen
The kiosk shall display a clear start and identification prompt.
FR-GUIDE-02 — Sequential guidance
The kiosk shall provide one primary instruction at a time.
FR-GUIDE-03 — Six rubbing movements
The system shall guide students through the configured six hand-rubbing movements:
1.​ Palm-to-palm rubbing.
2.​ Right palm over the left dorsum and vice versa.
3.​ Palm-to-palm rubbing with fingers interlaced.
4.​ Backs of fingers against opposing palms.
5.​ Rotational rubbing of each thumb.
6.​ Rotational rubbing of fingertips against opposing palms.
FR-GUIDE-04 — Preparation and finishing
The kiosk shall provide preparation, rinsing, and drying instructions in addition to the six rubbing
movements.
FR-GUIDE-05 — Audio and visual guidance
The kiosk shall support visual demonstrations and spoken instructions, with a silent or
reduced-audio mode where necessary.
FR-GUIDE-06 — Protocol configuration
Instruction sequence and duration targets shall be configurable through authorised settings
rather than embedded throughout the application.
FR-GUIDE-07 — Child-friendly feedback
Instructions shall use simple wording, consistent visuals, and encouraging feedback without
shaming the student.

FR-GUIDE-08 — Abandoned sessions
The system shall detect inactivity or a student leaving the session and handle the incomplete
session according to configured rules.

7.3 AI handwashing recognition
FR-AI-01 — Frame acquisition
The system shall obtain frames from the active webcam session.
FR-AI-02 — Preprocessing
OpenCV shall support frame acquisition, resizing, colour conversion, and other required
preprocessing operations.
FR-AI-03 — Gesture inference
A validated YOLO-based model shall classify the supported handwashing movements and
relevant non-action or background conditions.
FR-AI-04 — Class normalisation
The system shall map raw model labels to a stable internal set of movement classes.
FR-AI-05 — Confidence thresholds
Recognition confidence thresholds shall be configurable and validated against the independent
test dataset.
FR-AI-06 — Temporal validation
The system shall evaluate a temporal window of predictions to suppress transient errors and
unstable detections.
FR-AI-07 — Sequence validation
The system shall reject unsupported transitions and prevent a noisy prediction from
automatically completing multiple intermediate steps.
FR-AI-08 — Duration tracking
The system shall measure the time for which an action is considered continuously valid under
the configured recognition rules.
FR-AI-09 — Uncertain predictions

When evidence is insufficient, the system shall request a retry, retain the current instruction, or
mark the step as unverified rather than falsely declaring success.
FR-AI-10 — Model versioning
The system shall record the model version used for a session so that changes in recognition
behaviour can be investigated.
FR-AI-11 — Model evaluation
The system shall be tested using held-out recordings and report per-class precision, recall, F1
score, confusion matrices, and sequence-level outcomes.
FR-AI-12 — No persistent recording
The recognition pipeline shall not persist session video frames or student photographs.
FR-AI-13 — Memory management
Frames shall be released from the processing pipeline when no longer needed. Temporary
buffers shall be bounded.
FR-AI-14 — Recognition diagnostics
The teacher portal shall distinguish a model's confidence from the final technique-completion
score.

7.4 Session management
FR-SES-01 — Session creation
A session shall be created only after the student's credential is resolved or a permitted
anonymous/unassigned workflow is selected.
FR-SES-02 — Session identifier
Each session shall have a unique identifier.
FR-SES-03 — Session state
The system shall track states such as in_progress, completed, abandoned, and
interrupted.
FR-SES-04 — Step records

Each scored movement shall have a record of the recognised action, validation result, duration,
confidence summary, and completion status.
FR-SES-05 — Completion timestamp
Completed sessions shall include start and end timestamps.
FR-SES-06 — Recovery
An interrupted session shall not be incorrectly recorded as a fully completed session.
FR-SES-07 — Atomic persistence
Session completion and reward calculation shall be persisted consistently to prevent duplicate
points after retries or application restarts.
FR-SES-08 — No image attachment
Session records shall not contain links to saved photographs or video recordings.

7.5 Scoring engine
FR-SCORE-01 — Deterministic scoring
The scoring engine shall calculate the same result for the same validated session data and
configuration.
FR-SCORE-02 — Bounded scores
The technique-completion score shall remain between 0 and 100.
FR-SCORE-03 — Step completion
The base score shall reflect the number of valid completed steps relative to the expected scored
steps.
FR-SCORE-04 — Sequence violations
The scoring engine shall account for missed or out-of-order steps according to documented
rules.
FR-SCORE-05 — Duration evaluation
The system shall compare validated movement duration with the configured target.
FR-SCORE-06 — Confidence handling

Recognition confidence shall influence validation or be reported separately. It shall not be
presented as a direct measurement of cleanliness.
FR-SCORE-07 — Score explanation
The teacher portal shall display a breakdown of the score and the reasons for deductions.
FR-SCORE-08 — Configuration version
Each score shall retain the scoring configuration version used to calculate it.
FR-SCORE-09 — Incomplete sessions
Abandoned or interrupted sessions shall not be treated as fully compliant sessions.
FR-SCORE-10 — Uncertainty
A session with insufficient recognition evidence shall be marked uncertain or unverified instead
of receiving an unjustified perfect score.

7.6 Rewards and achievements
FR-REW-01 — Point eligibility
Only sessions that satisfy configured validation and eligibility requirements shall earn
leaderboard points.
FR-REW-02 — Daily point cap
The system shall limit the number of sessions eligible to generate leaderboard points per
student per day.
FR-REW-03 — Achievement rules
The system shall support configurable achievements based on validated technique, qualifying
days, or improvement.
FR-REW-04 — No duplicate rewards
A session shall not award points more than once.
FR-REW-05 — Personal progress
Students shall be able to view their own current-month progress and earned achievements
through the kiosk.
FR-REW-06 — Reward transparency

The teacher portal shall show why points were awarded or withheld.
FR-REW-07 — Corrections
Authorised corrections to session results shall trigger appropriate recalculation of rewards and
rankings, with an audit trail.

7.7 Monthly leaderboard
FR-LEAD-01 — Monthly ranking
The system shall rank eligible students based on qualifying points earned during the selected
calendar month.
FR-LEAD-02 — Monthly boundaries
The system shall use the school's configured local timezone to determine the start and end of a
month.
FR-LEAD-03 — Historical periods
Previous months' results shall remain available to authorised teachers after a new month
begins.
FR-LEAD-04 — Tie-breaking
Ties shall be resolved using the higher average qualifying technique score, followed by
qualifying-day count, with unresolved ties sharing the same rank.
FR-LEAD-05 — Class filters
Teachers shall be able to filter the leaderboard by class, section, and month.
FR-LEAD-06 — Ranking visibility
Individual ranking information shall be available only through authorised views. Public displays
shall use approved aliases or aggregate results.
FR-LEAD-07 — Anti-gaming controls
Repeated card scans, duplicate sessions, and invalid or unverified sessions shall not generate
unlimited points.
FR-LEAD-08 — Consistent recalculation
Leaderboard totals shall be reproducible from the underlying qualifying session records and
reward rules.

FR-LEAD-09 — Fair participation
The ranking system shall avoid rewarding raw session volume without limits and shall make its
eligibility rules clear.

7.8 Teacher portal
FR-TEACH-01 — Authentication
The teacher portal shall require authentication.
FR-TEACH-02 — Dashboard overview
The portal shall show total sessions, completed sessions, participation, average technique
score, qualifying-session rate, and system status.
FR-TEACH-03 — Student management
Authorised teachers shall be able to create, view, update, deactivate, and manage student
records.
FR-TEACH-04 — Class management
The system shall support classes and sections.
FR-TEACH-05 — Student history
The portal shall display an individual student's session history, scores, qualifying points, and
achievements.
FR-TEACH-06 — Session inspection
Teachers shall be able to inspect recognised steps, durations, uncertainty indicators, sequence
violations, and score breakdowns.
FR-TEACH-07 — Monthly leaderboard
The portal shall provide monthly rankings, filters, achievement totals, and historical
comparisons.
FR-TEACH-08 — Analytics
The portal shall provide daily, weekly, and monthly participation and technique-score trends.
FR-TEACH-09 — Reports
The system shall export authorised records to CSV.

FR-TEACH-10 — Card management
Teachers with the necessary permissions shall be able to issue, revoke, and replace QR/NFC
credentials.
FR-TEACH-11 — Configuration
Authorised administrators shall be able to configure thresholds, durations, reward rules, and
supported instruction protocols.
FR-TEACH-12 — System diagnostics
The portal shall display camera status, reader status, model version, inference latency, and
recent processing errors.
FR-TEACH-13 — Access control
The system shall restrict sensitive student records and administrative functions to authorised
roles.
FR-TEACH-14 — Audit trail
Important administrative changes shall be recorded with the actor, timestamp, and change
description.
FR-TEACH-15 — Data correction
Authorised teachers shall be able to correct student attribution or resolve duplicate records
without silently altering historical data.

8. Student Kiosk User Interface
Requirements
8.1 Design principles
The student interface shall be:
●​
●​
●​
●​

Simple and distraction-free.
Readable from the expected standing position.
Suitable for children who may have limited reading ability.
Focused on one main action at a time.

●​ Consistent in layout, colours, icons, and feedback.
●​ Usable with minimal or no physical interaction beyond presenting a card.
●​ Free of teacher controls, complex graphs, and administrative tables.

8.2 Required screens
Screen 1: Welcome
Content:
●​
●​
●​
●​
●​

SMART WASH identity.
Short instruction: scan your card or tap your card.
Large QR scanning area.
NFC availability indicator when a reader is connected.
Accessible help prompt.

Screen 2: Identification confirmation
Content:
●​ Student display name or approved avatar.
●​ A short confirmation message.
●​ Start-session feedback.
No student photograph is required.

Screen 3: Preparation
Content:
●​ Instructions to wet hands and apply soap.
●​ A simple visual demonstration.
●​ An audio prompt when enabled.
The system shall not claim that soap application was verified unless the installed sensors and
validated recognition method actually support that claim.

Screen 4: Active handwashing
Content:
●​
●​
●​
●​

One current movement instruction.
A large demonstration illustration or animation.
Current step number.
Overall progress indicator.

●​ Simple status such as “Keep rubbing” or “Try that movement again.”
●​ Optional voice guidance.
The screen shall not expose raw AI confidence percentages or technical diagnostics.

Screen 5: Session result
Content:
●​
●​
●​
●​
●​

Encouraging completion message.
Technique-completion score, presented in child-friendly language.
Points earned.
Badge or achievement, when applicable.
A brief indication of what to practise next, if useful.

If the session was interrupted or could not be evaluated reliably, the system shall communicate
that outcome honestly rather than inventing a successful result.

Screen 6: Monthly progress
Content:
●​
●​
●​
●​

Current month's earned points.
Personal rank, where available.
Achievements and qualifying days.
Previous-month comparison when historical data exists.

This screen shall not display other students' private records.

Screen 7: Error and recovery
Content:
●​
●​
●​
●​

Plain-language explanation.
A clear next action.
Retry or request-help instructions.
No technical stack traces or model internals.

8.3 UI performance
●​ Common navigation actions should respond immediately under normal operating
conditions.
●​ The interface should not freeze while inference or database operations are running.
●​ Recognition updates should not cause excessive flickering.
●​ A failed recognition request should not permanently block the kiosk.

●​ The system shall return to the welcome screen after a configurable idle period, once the
session is safely finalised.

9. Teacher Portal Requirements and
Information Architecture
9.1 Navigation
The teacher portal shall include the following primary sections:
1.​ Overview.
2.​ Students.
3.​ Classes.
4.​ Sessions.
5.​ Monthly leaderboard.
6.​ Analytics and reports.
7.​ AI diagnostics.
8.​ Card management.
9.​ Settings.
10.​Audit and data management.

9.2 Overview dashboard
The dashboard should provide:
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

Total enrolled students.
Active classes.
Sessions completed during the selected period.
Completed versus abandoned sessions.
Average validated technique score.
Qualifying-session percentage.
Daily and weekly participation trends.
Current monthly leaderboard summary.
Camera and model status.
Recent errors requiring attention.

All metrics shall have documented definitions and filters.

9.3 Student profile
Each profile should contain:
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

Internal student identifier.
Display name.
Class and section.
Credential status.
Enrollment date.
Session history.
Average technique-completion score.
Monthly points and rankings.
Achievement history.
Recent validated step results.

Profile images shall be optional and shall not be generated from kiosk camera captures. The
first release can use initials or avatars.

9.4 Session detail page
The session detail page shall display:
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
●​
●​
●​

Session identifier.
Student association or unassigned status.
Start and completion timestamps.
Completion state.
Expected sequence.
Recognised sequence.
Step-level durations.
Recognition confidence summaries.
Missed and out-of-order steps.
Technique score breakdown.
Points awarded.
Model version.
Scoring configuration version.
Any interruption or uncertainty reasons.

The session detail page shall not require saved video or photographs to explain the result.

9.5 Analytics and reports
The teacher portal should support:

●​
●​
●​
●​
●​
●​
●​
●​

Participation by day, week, month, and class.
Average score trends.
Distribution of technique-completion scores.
Step-level failure rates.
Recognition uncertainty and false-transition indicators.
Monthly leaderboard history.
Qualifying-session rates.
Export of permitted session and student summaries.

Reports shall clearly distinguish measured system outputs from inferred conclusions.

10. AI Recognition and Technical Design
10.1 Recognition pipeline
The proposed recognition pipeline is:
1.​ Webcam frame acquisition.
2.​ Image resizing and preprocessing with OpenCV.
3.​ YOLO inference.
4.​ Mapping raw labels to supported handwashing movements.
5.​ Confidence thresholding.
6.​ Temporal filtering.
7.​ Sequence and duration validation.
8.​ Session-state update.
9.​ Structured event generation.
10.​Scoring and persistence.

10.2 Model strategy
The existing SMART WASH documentation reports a severe failure in its previous YOLO
checkpoint, including 0.42% accuracy on its held-out evaluation. Those weights shall not be
assumed to be suitable for the new product.
The implementation team shall:
●​
●​
●​
●​

Establish a baseline using the available model and dataset.
Inspect the dataset labels and class distribution.
Verify that every supported gesture has suitable training examples.
Separate training, validation, and test data by participant or recording session.

●​
●​
●​
●​

Evaluate class imbalance and background-class behaviour.
Investigate camera-angle and lighting differences.
Retrain or replace the baseline model when necessary.
Document the exact model version used in testing.

10.3 Dataset requirements
The training and evaluation dataset should include:
●​
●​
●​
●​
●​
●​
●​
●​
●​

All six target movements.
Idle and non-handwashing activity.
Different hand sizes and orientations.
Different lighting conditions.
Partial occlusion.
Soap foam and wet-hand conditions where safe to collect.
Natural transitions between movements.
Examples of similar-looking movements.
Examples where the correct label is uncertain.

Initial development can use consenting adult volunteers and publicly available datasets with
compatible licences. Testing with schoolchildren shall occur only after the appropriate
institutional permissions and safeguards are established.

10.4 Temporal validation
The recognition engine shall maintain a bounded history of recent predictions.
The validation logic shall:
●​
●​
●​
●​
●​
●​
●​

Ignore isolated transient predictions.
Consider confidence and persistence over time.
Avoid advancing multiple steps from one unstable prediction.
Require the current step to satisfy its completion criteria.
Detect missing or out-of-order movements.
Handle temporary hand occlusion and brief tracking failures.
Allow a retry when the movement cannot be verified.

Thresholds and temporal-window sizes shall be selected through experiments rather than
arbitrary assumptions.

10.5 Recognition limitations
The system must explicitly acknowledge that:

●​
●​
●​
●​
●​
●​

Similar hand movements may be difficult to distinguish.
Soap foam and water can obscure hand details.
Lighting and camera placement affect recognition.
An adult-trained model may not generalise to children.
A recognised gesture does not prove the effectiveness of washing.
Confidence scores do not represent microbiological cleanliness.

11. Scoring and Reward Design
11.1 Technique-completion score
The score shall represent how well the recorded session satisfied the defined, observable
technique requirements.
A preliminary scoring model is:
Base completion score:
S_base = (N_completed / N_expected) × 100
Where:
●​ N_completed is the number of validated completed steps.
●​ N_expected is the number of scored steps in the configured protocol.
The final score may account for missed steps, out-of-order transitions, and duration quality. The
precise deductions shall be determined during validation and documented in a versioned
scoring configuration.
The system shall not use a single arbitrary confidence percentage as a substitute for technique
evaluation.

11.2 Duration rules
Duration targets shall be configurable and consistent with the selected handwashing protocol.
The six rubbing movements shall not be interpreted as the entire handwashing procedure.
Preparation, rinsing, and drying instructions must also be represented in the session workflow.

11.3 Monthly points

The reward engine shall be separate from the technique-scoring engine.
A qualifying session may award:
●​
●​
●​
●​

Points for validated completion.
A technique-quality bonus.
An achievement for consistent qualifying days.
A milestone achievement for improvement.

The initial release shall use transparent, configurable rules rather than a complex
machine-learning reward model.

11.4 Fairness rules
●​ A student cannot earn points repeatedly from duplicate submissions of the same
session.
●​ Daily qualifying-session limits must be enforced.
●​ Incomplete or unverified sessions shall not automatically receive full rewards.
●​ Students should be able to improve without being penalised for earlier mistakes.
●​ A model correction must trigger a controlled recalculation when affected rewards
change.
●​ Leaderboard rankings shall not be used as disciplinary evidence.

12. Data Model
The first release shall use SQLite for local persistence.

12.1 Student
Suggested fields:
●​ student_id: unique internal identifier.
●​ display_name: name shown in authorised interfaces.
●​ class_id: associated class.
●​ section: optional section.
●​ status: active or inactive.
●​ created_at: enrollment timestamp.
●​ updated_at: last update timestamp.

No facial descriptor or required profile photograph shall be stored.

12.2 Class
Suggested fields:
●​ class_id: unique identifier.
●​ class_name: class name or grade.
●​ section: optional section.
●​ academic_year: school year.
●​ status: active or inactive.

12.3 Credential
Suggested fields:
●​ credential_id: unique credential record.
●​ student_id: associated student.
●​ credential_type: QR or NFC/RFID.
●​ credential_reference: securely managed credential identifier.
●​ status: active, revoked, or replaced.
●​ issued_at: issue timestamp.
●​ revoked_at: optional revocation timestamp.
QR and NFC/RFID credentials shall resolve to the same student record.

12.4 Session
Suggested fields:
●​ session_id: unique identifier.
●​ student_id: optional student association.
●​ started_at: start timestamp.
●​ completed_at: optional completion timestamp.
●​ status: in progress, completed, abandoned, or interrupted.
●​ completed_steps: validated completed steps.
●​ missed_steps: missed steps.
●​ out_of_order_steps: detected sequence violations.
●​ technique_score: final validated score.
●​ duration_quality: optional duration summary.

●​ recognition_quality: optional model-confidence summary.
●​ model_version: inference model version.
●​ scoring_version: scoring configuration version.
●​ reward_points: points awarded.
●​ identity_method: QR, NFC/RFID, manual, or unassigned.
No saved photograph or video URL shall be required.

12.5 Session step
Suggested fields:
●​ step_record_id: unique identifier.
●​ session_id: parent session.
●​ step_number: protocol step.
●​ predicted_label: recognised label.
●​ validated_label: accepted action, if any.
●​ started_at: optional step start.
●​ completed_at: optional step completion.
●​ duration_ms: validated active duration.
●​ confidence_summary: aggregated confidence.
●​ completion_status: completed, missed, uncertain, or not attempted.

12.6 Reward transaction
Suggested fields:
●​ reward_id: unique transaction identifier.
●​ student_id: associated student.
●​ session_id: source session, where applicable.
●​ points_delta: points awarded or reversed.
●​ reason: reward rule.
●​ period_key: applicable monthly period.
●​ created_at: transaction timestamp.
Reward transactions should be traceable and protected against duplicate processing.

12.7 Achievement
Suggested fields:

●​ achievement_id: unique identifier.
●​ student_id: associated student.
●​ achievement_type: badge or milestone.
●​ period_key: optional reporting period.
●​ earned_at: timestamp.
●​ source_rule: achievement rule version.

12.8 Teacher account
Suggested fields:
●​ teacher_id: unique identifier.
●​ display_name: teacher display name.
●​ username: account identifier.
●​ password_hash: secure password hash.
●​ role: teacher or administrator.
●​ status: active or disabled.
●​ created_at: account creation timestamp.

12.9 Audit event
Suggested fields:
●​ audit_id: unique identifier.
●​ actor_id: authorised user or system process.
●​ action: operation performed.
●​ target_type: affected entity type.
●​ target_id: affected entity identifier.
●​ timestamp: event timestamp.
●​ details: minimum necessary change metadata.

13. Proposed System Architecture
13.1 Architecture overview
The application shall be divided into independent modules.

Student kiosk frontend
Responsibilities:
●​
●​
●​
●​
●​
●​

Welcome and identification interface.
QR scanning mode.
Handwashing instructions.
Progress feedback.
Result and reward display.
Recovery from hardware and recognition errors.

Local application service
Responsibilities:
●​
●​
●​
●​
●​
●​

Session lifecycle management.
Credential resolution.
Communication between the frontend and AI service.
Scoring and reward orchestration.
Database access.
Configuration management.

Python computer vision service
Responsibilities:
●​
●​
●​
●​
●​
●​

Webcam frame processing.
OpenCV preprocessing.
YOLO inference.
Prediction normalisation.
Temporal validation.
Recognition diagnostics.

Local database
Responsibilities:
●​
●​
●​
●​
●​
●​

Student records.
Credential mappings.
Session records.
Step-level telemetry.
Rewards and achievements.
Teacher accounts and audit events.

Teacher portal

Responsibilities:
●​
●​
●​
●​
●​
●​

Authentication.
Student and class administration.
Session inspection.
Monthly leaderboard.
Analytics and exports.
AI diagnostics and system settings.

13.2 Technology stack
Layer

Proposed technology

Kiosk frontend

React, TypeScript, Vite

Teacher portal

React, TypeScript, Vite

Styling

CSS or Tailwind CSS

Computer vision

Python, OpenCV

Gesture classification

Ultralytics YOLO

Backend service

FastAPI

Local communication

HTTP and/or WebSocket

Database

SQLite

QR decoding

OpenCV-compatible QR decoder or a suitable QR decoding library

NFC/RFID

Compatible USB reader and its supported interface

Testing

Pytest and Vitest

Deployment

Windows initially, followed by a dedicated kiosk computer

The final choice of model architecture and communication pattern shall be confirmed through
the feasibility phase. The application should not depend on unnecessary external services.

14. Privacy, Security, and Child Safety

14.1 Camera privacy
●​
●​
●​
●​
●​
●​

The camera shall operate only for identification and the active handwashing workflow.
Facial recognition shall not be performed.
Session photographs and video recordings shall not be persisted.
Camera frames shall be processed in memory and released when no longer needed.
Diagnostic logging shall not include raw camera frames.
The teacher portal shall not offer a gallery of captured student photographs.

14.2 Student data protection
●​
●​
●​
●​
●​
●​
●​
●​

Collect only information necessary for school operation.
Restrict identifiable records to authorised users.
Use role-based permissions.
Secure teacher authentication.
Protect credentials and session data.
Define data retention and deletion policies before deployment.
Document parental consent, school approval, and applicable legal obligations.
Avoid exposing individual rankings publicly by default.

14.3 Application security
●​
●​
●​
●​
●​
●​
●​
●​

Store password hashes using an appropriate password-hashing algorithm.
Validate inputs and prevent unauthorised access to administrative operations.
Protect credential identifiers against accidental disclosure.
Apply database transactions to session completion and reward updates.
Record important administrative changes.
Provide secure backup and restoration procedures.
Avoid hardcoded production secrets.
Restrict local service access and network exposure.

14.4 Child safety and fairness
●​
●​
●​
●​
●​
●​

The kiosk shall use supportive rather than punitive language.
An uncertain model prediction shall not be treated as evidence of misconduct.
Leaderboard results shall not determine academic grades or disciplinary actions.
Children shall not be shamed for low scores.
A teacher shall be able to correct attribution errors.
The system shall not infer emotions, medical conditions, or personal traits.

15. Non-Functional Requirements
15.1 Performance
The application shall:
●​
●​
●​
●​
●​

Maintain responsive kiosk interactions during AI inference.
Avoid blocking the frontend while processing frames.
Bound image buffers and prediction history.
Persist sessions without unnecessarily delaying feedback.
Handle concurrent teacher dashboard requests without corrupting records.

15.2 Reliability
The system shall:
●​
●​
●​
●​
●​
●​

Recover from camera disconnection.
Handle an unavailable NFC reader without disabling QR identification.
Handle database errors without silently losing completed sessions.
Prevent duplicate reward transactions.
Recover cleanly after an application restart.
Distinguish incomplete sessions from successful sessions.

15.3 Usability
The student workflow shall require minimal instruction from an adult.
Teacher workflows shall provide clear navigation, useful filtering, readable charts, and
understandable score explanations.

15.4 Maintainability
●​
●​
●​
●​
●​
●​

Separate UI, recognition, scoring, persistence, and reward logic.
Keep model thresholds and reward rules configurable.
Use version-controlled configuration.
Provide automated tests for core logic.
Document installation and troubleshooting.
Keep hardware-specific code behind interfaces.

15.5 Portability

The application shall first support the agreed Windows development environment.
Hardware and operating-system assumptions shall be documented so the system can later be
deployed on a dedicated kiosk computer without redesigning the entire application.

15.6 Offline capability
The core student workflow, local session persistence, rewards, and teacher reporting shall
operate without internet access.
Updates, external backups, or remote synchronisation may require connectivity, but they must
not be necessary for ordinary local handwashing sessions.

16. Failure Handling and Edge Cases
Scenario

Required behaviour

QR code cannot be scanned

Prompt for repositioning and allow retry

QR credential is invalid

Display an error and do not start an incorrectly attributed
session

NFC reader is disconnected

Continue offering QR identification

Student has no usable card

Offer authorised manual identification or unassigned
guidance

Camera is unavailable

Pause AI verification and show a clear recovery instruction

Model confidence is too low

Retain the step, request another attempt, or mark it
uncertain

Incorrect step is detected

Do not advance automatically unless the validated protocol
permits it

Student leaves mid-session

Mark the session abandoned or interrupted

Database write fails

Retry safely and avoid awarding duplicate points

Application restarts during
washing

Recover or mark the session interrupted without inventing
completion

Duplicate card scan occurs

Prevent an unintended second active session

Model update changes
predictions

Record the model version and rerun the required validation
suite

Monthly boundary is crossed

Assign points according to the configured school timezone
and period rules

Teacher corrects a session

Recalculate affected rewards and rankings with an audit
trail

Offline operation continues

Persist data locally and keep core guidance available

17. Testing and Validation Strategy
17.1 Unit testing
Test the following independently:
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
●​
●​

Credential resolution.
QR and NFC/RFID mapping.
Session state transitions.
Prediction label normalisation.
Temporal filtering.
Step-duration tracking.
Sequence validation.
Scoring calculations.
Reward eligibility.
Duplicate prevention.
Monthly leaderboard calculations.
Period boundaries and tie-breaking.
Database persistence.

17.2 AI testing
The AI test report shall include:
●​
●​
●​
●​
●​
●​

Overall accuracy.
Per-class precision and recall.
Macro F1 score.
Confusion matrix.
False-positive and false-negative analysis.
Sequence-level correctness.

●​
●​
●​
●​

Incorrect step-transition rate.
Inference latency.
Results by lighting and camera condition.
Differences between training and independent test performance.

Testing shall be based on a documented dataset and fixed evaluation procedure.

17.3 Integration testing
Validate complete workflows:
1.​ QR scan to completed session.
2.​ NFC scan to completed session.
3.​ Session completion to reward allocation.
4.​ Reward allocation to monthly leaderboard.
5.​ Session persistence to teacher portal.
6.​ Student correction to leaderboard recalculation.
7.​ Camera failure and recovery.
8.​ Database interruption and recovery.
9.​ Offline use and restart.
10.​CSV export and report consistency.

17.4 Usability testing
Initially test with adult volunteers.
Evaluate:
●​
●​
●​
●​
●​

Whether instructions are understandable.
Whether the camera sees the hands clearly.
Whether feedback arrives quickly enough.
Whether the interface is easy to follow.
Whether the kiosk handles repeated or failed scans gracefully.

Before any school-child pilot, obtain appropriate permissions and implement suitable
safeguards. Test with children only after the core product is stable and the necessary approvals
are in place.

17.5 Release acceptance
The product shall not be considered complete merely because it builds successfully.
The release must demonstrate:

●​
●​
●​
●​
●​
●​
●​
●​
●​

A complete student session.
Validated recognition performance against documented targets.
Correct score calculations.
Correct reward and leaderboard behaviour.
Teacher management and reporting.
Camera and reader failure handling.
Privacy controls.
Successful operation without internet.
Documented installation and recovery procedures.

18. Development Roadmap
Phase 1 — Requirements and feasibility
Deliverables:
●​
●​
●​
●​
●​
●​

Finalised protocol and step definitions.
Dataset review.
Model baseline evaluation.
Initial camera placement and lighting tests.
Recognition acceptance criteria.
Hardware compatibility plan.

Exit condition: A documented, repeatable recognition experiment and an agreed
implementation approach.

Phase 2 — Recognition engine
Deliverables:
●​
●​
●​
●​
●​
●​
●​

Webcam frame acquisition.
OpenCV preprocessing.
YOLO inference.
Prediction normalisation.
Temporal filtering.
Sequence validation.
Model evaluation report.

Exit condition: The recognition engine meets the agreed test targets or has a documented
remediation plan.

Phase 3 — Kiosk application
Deliverables:
●​
●​
●​
●​
●​
●​
●​

Welcome screen.
QR identification.
Optional NFC/RFID integration.
Guided handwashing workflow.
Session lifecycle.
Score and reward integration.
Failure and recovery screens.

Exit condition: A complete student session runs reliably on the Windows laptop.

Phase 4 — Persistence and teacher portal
Deliverables:
●​
●​
●​
●​
●​
●​
●​
●​

SQLite database.
Student and class management.
Session history.
Score explanations.
Monthly leaderboard.
Rewards and achievements.
Analytics and CSV exports.
Teacher authentication and access controls.

Exit condition: Teachers can manage students, inspect sessions, and verify monthly totals.

Phase 5 — Integration and reliability
Deliverables:
●​
●​
●​
●​
●​
●​

End-to-end tests.
Offline-operation tests.
Restart and recovery tests.
Duplicate-session prevention.
Security and privacy checks.
Performance measurements.

Exit condition: The complete application passes the release acceptance suite.

Phase 6 — School deployment preparation

Deliverables:
●​
●​
●​
●​
●​
●​
●​
●​

Installation guide.
Hardware requirements.
Camera positioning guide.
Reader configuration instructions.
Teacher operating manual.
Backup and recovery procedures.
Known limitations and troubleshooting guide.
Supervised pilot plan.

Exit condition: The system can be installed and operated by an authorised school
representative following the documentation.

19. Risks and Mitigation
Risk

Impact

Mitigation

Poor gesture
recognition

Incorrect guidance and
scores

Improve dataset quality, retrain, and
validate on independent recordings

Camera-angle
mismatch

Reduced recognition
accuracy

Standardise camera placement and test
alternative conditions

Soap and water
occlusion

Missing or incorrect
detections

Include representative training examples
and support uncertain outcomes

QR scanning failures

Delayed student
check-in

Improve card presentation guidance and
provide NFC/manual fallback

Borrowed cards

Incorrect individual
attribution

Use clear school procedures and
authorised correction workflows

Unfair leaderboard

Reduced trust and
student frustration

Cap eligible sessions, validate rewards,
and provide transparent rules

Overcollection of
child data

Privacy and compliance
risk

Avoid face recognition and saved images;
minimise and control records

Hardware variability

Deployment failures

Maintain a supported hardware profile and
run pre-deployment checks

Offline data loss

Missing reports or
sessions

Use reliable local transactions and
documented backups

Scope expansion

Delayed project
completion

Require a clear justification for changes to
the agreed scope

20. Project Deliverables
The final B.Tech project shall include:
1.​ Working student kiosk application.
2.​ YOLO/OpenCV recognition pipeline.
3.​ QR identification workflow.
4.​ Optional NFC/RFID reader integration.
5.​ Session management and scoring engine.
6.​ Student rewards and monthly leaderboard.
7.​ Teacher portal.
8.​ Local database and migration scripts.
9.​ Automated unit and integration tests.
10.​AI evaluation report.
11.​Software architecture documentation.
12.​Installation and configuration guide.
13.​Teacher user manual.
14.​Privacy and security documentation.
15.​Final project report and demonstration plan.
The trained model, dataset usage permissions, model configuration, and evaluation results shall
be documented so that the AI component can be reproduced and assessed.

21. Definition of Done
SMART WASH will be considered ready for its first complete prototype release when all of the
following are satisfied:
●​ A student can identify themselves using a QR credential.
●​ An optional compatible NFC/RFID reader can identify students through the same internal
identity system.
●​ The system guides a student through the configured handwashing procedure.

●​ The YOLO recognition pipeline evaluates visible handwashing movements using the
agreed validation logic.
●​ The system reports uncertainty honestly and does not silently invent successful steps.
●​ Session results are saved without persistent session photographs or video.
●​ Scores and reward points are calculated consistently.
●​ The monthly leaderboard reflects qualifying sessions and correct period boundaries.
●​ Students receive simple feedback and can view their own progress.
●​ Teachers can manage students, inspect sessions, review analytics, and export permitted
reports.
●​ Duplicate rewards and incorrect identity assignments are handled safely.
●​ The application operates locally without a permanent internet connection.
●​ The documented tests, installation procedures, and known limitations are available.
●​ The recognition model has been evaluated against the agreed acceptance criteria.
●​ Privacy and school deployment requirements have been reviewed before any real-world
child pilot.

22. Final Product Principle
SMART WASH must prioritise correct guidance, reliable recognition, privacy, and
maintainability over feature count.
The student kiosk should remain deliberately simple. The teacher portal should provide the
detailed information necessary to understand system performance, review session outcomes,
and manage school participation.
The monthly leaderboard should motivate students without encouraging unnecessary washing
sessions, rewarding unreliable predictions, or publicly exposing individual performance.
The initial Windows prototype must use the same fundamental architecture and data contracts
intended for the future dedicated kiosk, so that deployment becomes a controlled hardware
transition rather than a complete rewrite.
The final objective is a complete, testable, maintainable school hygiene product whose
claims are supported by evidence and whose core workflow remains usable when
recognition, hardware, or network conditions are imperfect.

