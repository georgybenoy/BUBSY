# Bubsy — Teacher & Staff Operations Manual

**Product Tagline:** The AI Handwashing Adventure  
**Audience:** Elementary and Junior School Teachers, Health Coordinators, School Administrators

---

## 1. Introduction & Ethical Philosophy

Bubsy is designed to build lifelong, healthy hygiene habits through positive reinforcement, gamified adventures, and real-time guidance.

### Essential Staff Guidelines:
1. **Supportive, Non-Shaming Culture:** Recognition uncertainty is an AI vision limitation, never a student violation. Never reprimand or penalize a child because the camera had difficulty seeing a movement.
2. **Technique vs. Cleanliness:** Bubsy evaluates adherence to the WHO 6-step rubbing technique. It does **not** test for bacteria, viruses, or microbiological cleanliness.
3. **Child Privacy:** No photos or videos are ever stored. Student rankings are controlled by school policy and anonymized where appropriate.

---

## 2. Navigating the Teacher Portal

Access the portal on your school computer or kiosk browser at:
`http://127.0.0.1:5173/teacher/login`

### Portal Sidebar Sections:
1. **Overview:** Executive summary dashboard displaying registered student count, qualifying wash count, protocol completion rate (numerator/denominator), active participants, activity trend chart, and device telemetry.
2. **Students:** Student roster. Add students, edit display handles, view credential status, and print/replace QR badges.
3. **Classes:** Class roster management, teacher assignments, and aggregated class-level hygiene participation metrics.
4. **Wash Sessions:** Complete audit trail of all handwashing sessions. Filter by date, class, outcome, or student. Inspect step durations and uncertainty factors.
5. **Leaderboard:** Monthly Bubsy Champion standings. View class and school rankings, review point transaction histories, and submit audited point adjustments.
6. **Analytics & Reports:** Longitudinal trends, normalized washes per student by class, participation distribution, commonly missed steps, and one-click CSV export.
7. **Kiosk & AI Status:** Live hardware telemetry for the webcam, AI recognition engine, QR reader, optional NFC reader, and SQLite database.
8. **Settings (Admin Only):** School timezone, protocol parameters, minimum qualifying scores, daily reward caps, leaderboard visibility, and kiosk audio settings.

---

## 3. Managing Students & QR Badges

### Issuing a New QR Badge:
1. Navigate to **Students**.
2. Click **Add Student** or click the badge icon next to an existing student.
3. Bubsy automatically generates a high-entropy, random token that contains **zero personal information**.
4. Click **Print Badge** to print the student’s card.
5. If a student loses their card, click **Replace Badge**. The old card is immediately revoked; the student's historical points and badges remain intact.

### Soft Deactivation:
If a student transfers out of the school, mark them inactive in their profile. In accordance with privacy rules, student records are preserved for historical audit trails rather than hard deleted.

---

## 4. Understanding Session Outcomes & Uncertainty

In the **Wash Sessions** view, every session is categorized into one of five distinct outcomes:

| Outcome | Meaning | Points Awarded |
| :--- | :--- | :--- |
| **Completed (Qualifying)** | Student completed all 6 rubbing movements with valid persistence ($\ge 80\%$ score). | Yes (typically +10 pts) |
| **Incomplete** | Student walked away or skipped movements before completing the protocol. | No (0 pts) |
| **Recognition Uncertain** | The camera could not maintain sufficient confidence due to lighting, angle, or rapid movement. | No (0 pts) |
| **Device / Camera Failure** | Hardware fault (e.g. webcam unplugged, read timeout, driver reset). | No (0 pts) |
| **Cancelled** | Student tapped cancel or session timed out during identification. | No (0 pts) |

> [!IMPORTANT]
> **Device Failure vs. Recognition Uncertainty:**
> - *Device Failure* means hardware communication was interrupted. Check USB cables.
> - *Recognition Uncertainty* means the camera saw movement, but could not distinguish the specific WHO step with high confidence. Encourage the child to hold their hands steady in the center of the sink basin.

---

## 5. Leaderboard Audits & Compensating Adjustments

Bubsy enforces a strict, transparent point ledger:
- Points cannot be directly modified on student records.
- To correct a discrepancy (for example, if a child washed thoroughly but the camera was accidentally blocked by a sleeve):
  1. Navigate to **Leaderboard**.
  2. Click **Audit Points & Adjust** on the student's entry.
  3. View the full transaction ledger.
  4. Fill in the adjustment form (+5 pts, -5 pts), select a reason, and enter explanation notes.
  5. Click **Submit Correction**.
  6. An immutable, audited compensating transaction is appended to the ledger.

---

## 6. Exporting Reports & Hygiene Disclaimer

To generate an authorized report for school health records:
1. Navigate to **Analytics & Reports** (or click **Generate Report** in the top navigation bar).
2. Select your desired period (`7d`, `30d`, `90d`, or `all`).
3. Click **Export CSV**.
4. The downloaded file includes sanitized, formula-safe student compliance records.

> [!NOTE]
> Every exported report and UI view includes the following mandatory statement:  
> *"AI gesture recognition analyzes hand rub technique compliance; it does not confirm germ eradication or microbiological cleanliness."*
