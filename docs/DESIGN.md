Bubsy — UI/UX Design Document
Version 1.0 · Teacher Portal + Student Kiosk · Visual design specification

1. Design vision
Bubsy — The AI Handwashing Adventure will use the uploaded dashboard as its primary visual
reference. The goal is to bring the same polished, premium dashboard aesthetic to the teacher
portal while creating a child-friendly kiosk that feels like part of the same product family.
The reference image establishes the visual direction: a clean light interface, a slim left sidebar,
clear page hierarchy, rounded cards, blue progress indicators, compact information panels, and
a dashboard that presents important information at a glance.
Bubsy should feel like a real, deployable product—not a generic school management dashboard
or a cartoon-only educational game.

Core design principles
●​ One design system, two experiences: the teacher portal is data-focused; the kiosk is
playful and instructional.
●​ Blue-led identity: use blue as the primary brand color, supported by white, soft grey, and
restrained green accents.
●​ Friendly, not childish: use rounded components, simple illustrations, and the Bubsy
mascot without making the interface visually noisy.
●​ Action before decoration: every screen should make the next action obvious.
●​ Privacy by design: no student face recognition, no session photographs, and no
unnecessary personal information displayed.

2. Visual identity

Bubsy
The AI Handwashing Adventure
Clean hands. Happy habits.

Brand colour palette

Primary blue
#2563EB
Soft blue
#DBEAFE
Canvas
#F8FAFC
Dark text
#0F172A
Success green
#16A34A
Attention amber
#F59E0B

Typography and component styling
●​ Font: Inter for the teacher portal; a rounded, highly legible font such as Nunito for the
kiosk.
●​ Headings: bold, dark navy, short and descriptive.
●​ Body text: dark slate on a light background.
●​ Cards: white surfaces, subtle borders, 12–16 px corner radius, restrained shadows.
●​ Buttons: blue primary buttons with white text; secondary actions use a light background
or outline.
●​ Icons: consistent line icons, with the same style throughout both interfaces.
●​ Charts: simple bars, rings, and trend lines; avoid dense or decorative charts.
●​ Mascot: use Bubsy as a guide and feedback character, not as a substitute for clear
instructions.

3. Teacher portal design
The teacher portal should closely follow the information architecture and dashboard composition
of the reference image. Teachers need to understand school-wide activity, identify issues,
manage classes, and review monthly student progress without navigating through multiple
pages.

3.1 Main dashboard — Overview

dribbble.com
The dashboard opens on Overview, with a left sidebar and a central workspace.
Header area
●​ Page title: Overview
●​
●​
●​
●​

Subtitle: Your school's handwashing activity at a glance.
Current reporting period selector
Generate Report button
Teacher profile and account menu

Top-level metric cards
Display four high-value metrics across the top of the dashboard.
Registered students

248
Across all classes
Qualifying washes

1,284
Selected reporting period
Protocol completion

86%
Based on recorded sessions
Active participants

192
At least one qualifying wash
All numbers shown above are illustrative placeholders for the design, not real school data.
Production values must come from stored session records and clearly defined metrics.
Main dashboard content
Arrange the rest of the page in a responsive two-column layout.
●​ Left, wider column: handwashing activity trend chart, class comparison, and recent
activity.
●​ Right, narrower column: monthly Bubsy Champion leaderboard, protocol completion
ring, and kiosk/device status.
The dashboard should prioritize recent activity and problems requiring attention. Teachers
should not need to interpret raw AI confidence scores during normal use.

3.2 Left navigation
Use a fixed, slim sidebar similar to the reference image.

Bubsy
Overview
Students
Classes
Wash Sessions
Leaderboard
Analytics & Reports
Kiosk & AI Status
Settings
The active page should have a soft-blue background and blue icon/text. Navigation labels
should remain visible on desktop; do not make the sidebar icon-only by default.

3.3 Students page
Purpose: manage student records and identification credentials.
Page layout

Heading: Students
Search by student name or school ID
Class filter
Status filter
Add Student and Import Students actions
Student table

●​
●​
●​
●​
●​
●​

Table columns

Column

Content

Student

Name and optional school ID

Class

Assigned class

Monthly points

Points earned in the current month

Qualifying washes

Count for the selected period

Status

Active or inactive

Actions

View, edit, manage credential

Clicking a student opens a detailed profile containing monthly progress, session history, earned
badges, and identification credential status.
Avoid displaying unnecessary student information in the main table.

3.4 Classes page
Teachers should be able to create classes, assign students, and compare aggregate results.
Each class card should contain:

●​
●​
●​
●​
●​

Class name and grade
Number of registered students
Qualifying wash count
Protocol completion rate
Monthly points earned by the class

Selecting a class opens its student list, trends, and participation summary. Comparisons should
use clearly defined measures so that larger classes are not automatically treated as
better-performing classes.

3.5 Wash Sessions page
This page provides a searchable record of sessions.
Filters:
●​
●​
●​
●​
●​

Date range
Class
Student
Session outcome
Kiosk/device

Each row displays the student or school ID, timestamp, outcome, recognized steps, session
duration, points awarded, and any relevant exception.
Teachers should be able to distinguish:
●​
●​
●​
●​
●​

Completed qualifying session
Incomplete session
Recognition uncertain
Session cancelled
Identification or device failure

An uncertain AI prediction must not be presented as a definite hygiene violation.

3.6 Leaderboard page
This is the dedicated monthly competition view.

Bubsy Champion
Monthly leaderboard · Example layout

01

Student A
420 Bubsy Points

🏆
02

Student B
385 Bubsy Points

🥈
03

Student C
360 Bubsy Points

🥉

Illustrative entries only. Actual student names and scores must be loaded from the database and
access-controlled.
Leaderboard requirements
●​
●​
●​
●​
●​
●​
●​
●​

Monthly reset based on the school's configured timezone.
Class-level and school-level views.
A clear explanation of how points are earned.
Only validated, qualifying sessions can award points.
Daily reward caps and duplicate-session protection.
No points for simply scanning a card repeatedly.
Teachers can review point transactions and correct verified errors.
Student-facing screens should not expose other students' private session histories.

A good reward system encourages consistent, correct technique rather than rewarding students
for washing as many times as possible.

3.7 Analytics and reports
Provide simple, useful reports:

●​
●​
●​
●​
●​
●​

Daily and monthly session trends
Protocol completion by class
Participation distribution
Commonly missed or uncertain steps
Kiosk uptime and recognition failures
Monthly points and achievements

Reports should distinguish between recognized technique and actual cleanliness. A
camera-based system can estimate whether movements match a protocol; it cannot prove that
hands are germ-free.

3.8 Kiosk and AI status
Create a separate technical status page for authorized staff.
Display:
●​
●​
●​
●​
●​
●​
●​
●​
●​

Camera connected/disconnected
Recognition service running/stopped
Current model version
Recent recognition errors
QR scanner availability
Optional NFC/RFID reader status
Local database status
Pending synchronization, if synchronization is implemented
Diagnostic logs without captured images or video

This page is important for school deployment. A broken camera or unavailable model should be
clearly distinguished from a student performing a step incorrectly.

3.9 Settings
Group settings into clear sections:
●​
●​
●​
●​
●​
●​
●​
●​
●​

School and academic year
Classes and student records
QR and optional NFC/RFID credentials
Handwashing protocol and timing
Scoring and reward rules
Monthly leaderboard configuration
Kiosk display, audio, and language
Data retention and export
Teacher accounts and permissions

Changes to reward rules, credential assignments, or student records should be auditable.

4. Student kiosk design
The kiosk should feel like the child-facing side of the same premium product: blue and white
surfaces, rounded cards, soft shadows, clear progress rings, and a friendly Bubsy mascot.
Unlike the teacher portal, it should not have sidebars, tables, tiny labels, or dense information.
The interface should be optimized for a child standing in front of a screen near a school sink.

4.1 Kiosk home screen

Screen content
●​ Bubsy mascot and wordmark at the top.
●​ Greeting: Hey there, handwashing hero!
●​ Main message: Ready for your wash adventure?
●​ Large primary button: LET'S WASH!
●​ Secondary instruction: Scan your student QR code to begin.
●​ Optional alternative: Use your student card when NFC/RFID is installed.
●​ Small accessibility controls for audio, language, and text size.
The camera preview should not dominate the home screen. Only show the scanning interface
when the student chooses to identify themselves.

4.2 Student identification screen

dribbble.com
Layout
●​ Title: Who’s ready to wash?
●​ Central QR scanning frame
●​ Instruction: Hold your student QR code inside the box.
●​ Optional NFC prompt: Or tap your student card.
●​ Small Try again and Need help? controls
The scan should not silently assign a student if identification fails. After a configurable number
of unsuccessful attempts, the kiosk should provide teacher-assisted identification or an
unassigned guidance session, according to school policy.
Once a credential resolves, show a simple confirmation such as Ready, Student A? using a
first name only if permitted by school policy. Avoid showing class lists or other students' details.

4.3 Guided handwashing screen

This is the most important screen in the entire kiosk experience.
Screen layout

●​ Top: Your Wash Adventure
●​ Progress: Step 3 of 6
●​ Centre: large illustration or animation showing the current hand movement.
●​ Main instruction: Rub between your fingers!
●​
●​
●​
●​

Supporting text: Get into all the little spaces.
Progress ring or step indicator.
Bubsy mascot giving short encouragement.
Live recognition status presented in child-friendly language.

Example feedback:
●​ Great start!
●​ Try rubbing a little slower.
●​ Move your fingers between each other.
●​ Nice work — keep going!
The system should use neutral, encouraging feedback. If it cannot confidently recognize a
movement, it should ask the child to try again rather than falsely declaring failure.
The exact number and order of steps should follow the selected school protocol. The visual
design may use six main rubbing movements, with preparation and finishing steps represented
separately.

4.4 Session completion screen

When a session meets the configured qualification rules, display:
●​
●​
●​
●​
●​

Heading: You did it!
Bubsy celebrating.
You earned 10 Bubsy Points! as an example.
Newly earned badge, if applicable.
A short reminder: Clean hands, happy days!

●​ Button: DONE
The score is an example only. Actual points must come from the teacher-configured rules and
the validated session record.
For an incomplete or uncertain session, show helpful guidance without shame, public ranking,
or a misleading reward.

4.5 Monthly progress screen

Students should be able to view their own progress after successful identification.
Display:
●​
●​
●​
●​
●​

Their monthly Bubsy Points.
Personal progress toward the next achievement.
Badges earned.
Number of qualifying sessions.
A simple encouragement message.

If students are allowed to view the public monthly leaderboard, use school-approved display
names and only the minimum information necessary. Never display private session history on a
public kiosk.

5. How the two interfaces stay consistent
Design element

Teacher portal

Student kiosk

Main colours

Blue, white, slate

Blue, white, pale blue

Layout

Sidebar and responsive dashboard

Full-screen, single-task layout

Typography

Compact and professional

Large and rounded

Cards

Data and action cards

Instruction and reward cards

Bubsy mascot

Small logo and occasional empty
states

Main guide and feedback
character

Progress
indicators

Charts, rings, tables

Large rings and step indicators

Rewards

Detailed point transactions

Simple earned-points message

Errors

Technical explanation for staff

Gentle retry instructions

Navigation

Persistent sidebar

Large, limited actions

Both interfaces should use shared design tokens for colour, spacing, border radius, icon style,
and button states. Their typography scale and layout can differ where usability requires it.

6. Responsive behaviour and display sizes
Teacher portal
●​ Desktop: full sidebar, four metric cards per row where space permits, two-column
content.
●​ Tablet: collapsible sidebar, two metric cards per row.
●​ Mobile: stacked cards, compact charts, responsive tables, and clear touch targets.
Student kiosk
●​
●​
●​
●​
●​
●​

Primary target: landscape touchscreen.
Design for the actual monitor resolution once the kiosk hardware is selected.
Use large touch targets, generous spacing, high contrast, and short instructions.
Support keyboard-free operation during normal handwashing.
Keep critical controls away from screen edges.
Do not depend on hover effects, small icons, or precise touch gestures.

7. Accessibility and child safety
●​
●​
●​
●​
●​
●​
●​
●​
●​

Use simple, literal language suitable for elementary and junior school students.
Provide visual instructions and optional audio; do not rely on colour alone.
Use captions or icons alongside success and error states.
Make feedback encouraging, never punitive or embarrassing.
Allow teachers to configure language, audio, and accessibility options.
Do not expose student credentials, private scores, or session details to other students.
Avoid facial recognition and persistent camera recordings.
Clearly indicate when the camera is active for gesture recognition.
Do not make claims that the AI has verified hygiene or eliminated germs.

8. Suggested implementation approach
The visual system should be implemented as reusable components rather than individually
styled pages.
Frontend
●​ React, TypeScript, and Vite.
●​ Shared component library for buttons, cards, progress indicators, tables, dialogs, and
feedback messages.
●​ Separate route/layout groups for /teacher/* and /kiosk/*.
●​ CSS variables or design tokens for shared colours, spacing, typography, and radii.
●​ Responsive layouts using CSS Grid and Flexbox.
Backend and AI integration
●​
●​
●​
●​
●​
●​

FastAPI for application and session APIs.
OpenCV for camera acquisition and image preprocessing.
YOLO for gesture recognition.
SQLite for local student, credential, session, score, and configuration records.
A QR decoding library for student identification.
Optional NFC/RFID support through a compatible reader.

The kiosk UI should consume recognition events from the backend or recognition service; it
should not independently award points based on an unvalidated prediction. The backend must
validate session progression and scoring rules before recording a qualifying session.

9. Design acceptance checklist
The design is ready for implementation when the following are true:
●​ The teacher dashboard reflects the reference image's clean, professional visual
hierarchy.
●​ All teacher pages share a consistent sidebar, header, cards, and typography.
●​ Teachers can locate students, classes, sessions, reports, and leaderboard information
easily.
●​ The kiosk uses the same blue-and-white identity and recognizable Bubsy mascot.
●​ The home screen, QR identification, guided washing, completion, and progress screens
are designed.
●​ The kiosk is usable by children without keyboard input or teacher intervention during a
normal session.
●​ Uncertain recognition produces a retry prompt rather than an unsupported failure claim.
●​ Rewards are issued only after the configured session rules are validated.
●​ No session photographs or videos are stored.

●​ The UI works on the initial Windows laptop and can be adapted to the eventual
dedicated kiosk display.
●​ Sample data is clearly separated from live school records.

Final design direction
Bubsy should look like one product with two personalities: a polished, data-driven school
dashboard for teachers and a welcoming, game-inspired handwashing experience for children.
Use the supplied reference as the teacher portal's visual foundation. Extend its blue-and-white
palette, rounded cards, progress rings, and clear information hierarchy into the kiosk, where
Bubsy becomes the guide who turns correct handwashing technique into a simple, rewarding
adventure.

