# Product Requirements Document

**Restaurant IT & Maintenance Ticketing System**

**CONFIDENTIAL**

| Field | Value |
| --- | --- |
| Author | [Your Name] |
| Team / Org | IT Department |
| Status | Draft |
| Version | 1.0 |
| Created | May 30, 2026 |
| Last Updated | May 30, 2026 |
| Stakeholders | Head of IT (Super-Admin), Owner A, Owner B, IT Lead, Maintenance Lead |

---

## 1. Overview

### 1.1 Problem Statement

Restaurant staff across 25 locations currently use QSRSoft to submit IT and maintenance tickets. The system is slow to load and presents a significant usability barrier: staff must navigate multiple login screens and windows before they can open a ticket. This friction discourages timely reporting of issues, leading to delays in resolution and compounding operational problems on the floor.

The problem is especially acute because the primary users — store-level staff — are not technically oriented and are often working in high-pressure, time-sensitive environments. Any multi-step process that requires credentials is a barrier they frequently abandon.

### 1.2 Proposed Solution

A mobile-first web application that allows store-level staff to submit IT or maintenance tickets instantly by scanning a QR code posted at their location — no login required. The QR code pre-populates the location context, and staff simply fill out a short form (category, description, optional deadline, and a required photo or video).

IT and maintenance technicians receive notifications via Discord and/or email based on their preferences, and manage tickets through their own authenticated interface. Owners and owner-designated staff have access to a scoped dashboard showing ticket status, history, and resolution metrics for their locations. A super-admin (Head of IT) manages the full system including users, locations, and QR code configuration.

### 1.3 Background & Context

The system spans 25 restaurant locations split between two ownership groups (Owner A: 12 locations, Owner B: 13 locations). IT and maintenance staff currently serve both ownership groups, though the system should support dedicated staff assignments per owner if that structure changes.

The primary driver is reducing friction in ticket submission to ensure issues are reported quickly and routed to the right team without delay. Secondary drivers include providing ownership groups with visibility into operational issues at their locations and enabling the IT team to track resolution performance over time.

---

## 2. Goals & Success Metrics

### 2.1 Goals

- Reduce the time and effort required for store staff to submit a ticket to under 60 seconds
- Eliminate login barriers for store-level ticket submission
- Ensure IT and maintenance teams are notified of new tickets in real time via their preferred channel
- Give owners visibility into open, in-progress, and resolved tickets across their locations
- Enable the Head of IT to manage all locations, users, and QR codes from a single admin interface

### 2.2 Success Metrics (KPIs)

| Metric | Baseline | Target | Measurement Method |
| --- | --- | --- | --- |
| Ticket submission time | ~5 min (QSRSoft) | < 60 seconds | In-app timing |
| Ticket submission rate | TBD | Increase vs. baseline | Ticket volume tracking |
| Technician response time | TBD | < 30 min for P0 issues | Ticket timestamps |
| Mean time to resolution (MTTR) | TBD | Decrease vs. baseline | Ticket lifecycle data |
| System adoption rate | N/A | > 80% of locations active in 30 days | QR scan & submission logs |

### 2.3 Non-Goals

- This system will not replace QSRSoft for any functions outside of IT and maintenance ticketing
- This release will not include customer-facing functionality
- Automated ticket routing or AI triage is out of scope for v1
- Integration with third-party ITSM platforms (e.g., ServiceNow, Jira) is not included
- Store staff will not receive ticket status notifications in v1

---

## 3. Users & Personas

### 3.1 Target Users

| User Type | Role | Description |
| --- | --- | --- |
| Store Staff | Ticket Submitter (unauthenticated) | Any employee at a restaurant location. Submits tickets via QR code. No account required. |
| IT / Maintenance Tech | Ticket Resolver (authenticated) | Manages and resolves tickets. Receives notifications, updates status, adds notes. Serves all 25 locations. |
| Owner / Owner Staff | Approver & Viewer (authenticated) | Scoped to their own locations. Can view dashboards, approve budget-related tickets in Awaiting Approval state. |
| Super-Admin (Head of IT) | System Administrator (authenticated) | Full access. Manages users, locations, QR code configuration, and system settings. |

### 3.2 User Stories

| User Story | Priority | Notes |
| --- | --- | --- |
| As a store staff member, I want to scan a QR code and submit a ticket in under a minute so that I can report an issue without leaving my workstation for long. | P0 | No login required |
| As a store staff member, I want to attach a photo or video to my ticket so that the technician understands the issue before arriving. | P0 | Required field |
| As a technician, I want to receive a Discord ping or email when a new ticket is submitted so that I can respond quickly. | P0 | Per-user notification settings |
| As a technician, I want to update ticket status and add notes so that owners and admins can track progress. | P0 | |
| As an owner, I want to view all tickets for my locations so that I can monitor operational issues. | P0 | Scoped to owned locations |
| As an owner or owner staff, I want to approve tickets in Awaiting Approval state so that budget-sensitive work can proceed. | P0 | |
| As the super-admin, I want to add locations, manage users, and configure QR codes so that the system stays up to date. | P0 | Full system access |
| As a technician, I want to place a ticket On Hold / Awaiting Approval when work requires budget sign-off so that owners are prompted to review. | P1 | |
| As an owner, I want to see ticket volume and resolution time metrics for my locations so that I can track operational health. | P1 | Reporting dashboard |
| As the super-admin, I want to assign a technician exclusively to one owner's locations so that dedicated staffing models are supported. | P2 | Optional config |
| As a store staff member, I want to flag that an issue is stopping service right now so that urgent problems are prioritized. | P0 | Urgency drives the P0 SLA |
| As a store staff member, I want a confirmation with a reference code after submitting so that I know the ticket went through and don't resubmit. | P1 | Reduces duplicates |
| As a technician, I want to claim a ticket so that two technicians don't work the same issue. | P1 | Assignment / ownership |

---

## 4. Requirements

### 4.1 Functional Requirements

| # | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| FR-01 | Each restaurant location shall have a unique QR code that, when scanned, opens a ticket submission form pre-populated with the location. | P0 | |
| FR-02 | The ticket submission form shall not require any login or authentication from store staff. | P0 | |
| FR-03 | The ticket form shall include: Category (IT or Maintenance), Urgency (Normal or Service-impacting), Description (free text), Completion Deadline (optional), and Photo/Video (required). | P0 | |
| FR-04 | The system shall notify relevant IT or Maintenance staff upon ticket submission via Discord ping and/or email based on user notification preferences. | P0 | |
| FR-05 | Tickets shall support the following lifecycle states: Open, In Progress, On Hold (e.g., awaiting parts or a vendor), Awaiting Approval, Resolved, and Cancelled/Invalid (for duplicate or non-actionable tickets). | P0 | On Hold and Awaiting Approval are distinct states; Awaiting Approval may be skipped. A declined approval returns the ticket to In Progress. |
| FR-06 | Technicians shall be able to add timestamped notes to tickets at any lifecycle stage. | P0 | Visible to admins and owners |
| FR-07 | Tickets in Awaiting Approval state shall notify the relevant owner or owner staff for approval before work can proceed. | P0 | Budget sign-off workflow |
| FR-08 | Owner and owner staff accounts shall only display tickets for their associated locations. | P0 | Enforced at data layer |
| FR-09 | The owner dashboard shall display ticket status breakdown (Open, In Progress, Awaiting Approval, Resolved), ticket volume by location, and mean time to resolution. | P1 | |
| FR-10 | The super-admin shall be able to create, edit, and deactivate locations, users, and QR codes. | P0 | |
| FR-11 | The system shall support optionally scoping a technician's account to one owner's locations. | P2 | Dedicated staffing model |
| FR-12 | The interface shall be optimized for mobile browsers as the primary use case. | P0 | Staff use on phone |
| FR-13 | Each ticket shall carry a priority. Store staff set a simple urgency (Normal / Service-impacting) at submission; technicians may adjust priority. Service-impacting (P0) tickets are visually flagged and drive response-time SLAs. | P0 | Enables triage and KPIs |
| FR-14 | On successful submission, store staff shall see an on-screen confirmation including a short ticket reference code. No account is required. | P1 | Reduces duplicate reports |
| FR-15 | The system shall detect and flag likely duplicate submissions for the same location and category within a short time window for technician review. | P2 | |
| FR-16 | A technician account may cover IT, Maintenance, or both, and shall receive notifications for every category it covers. | P1 | Multi-skill staff |
| FR-17 | Technicians shall be able to claim/assign a ticket. The system shall record the assignee and prevent conflicting concurrent ownership. | P1 | Assignment workflow |
| FR-18 | Uploaded media shall be viewable only by authorized technicians, owners (their own locations), and admins, and media access shall be logged. | P1 | Media may contain PII |
| FR-19 | When a ticket is moved to Resolved, the system shall notify the relevant owner and owner staff for that location. | P0 | Resolved-event notification |
| FR-20 | Notifications shall be sent only on these events: ticket Opened (to relevant technicians), Awaiting Approval (to owner/owner staff), and Resolved (to owner/owner staff); plus a notification to the requesting technician when an approval is approved or declined. No notifications are sent on In Progress or On Hold transitions. This applies to both Discord and email channels. | P0 | Defines the full notification model |

### 4.2 Non-Functional Requirements

- **Performance:** QR code landing page and ticket form must load in under 2 seconds on a standard mobile connection
- **Usability:** Ticket submission must be completable in under 60 seconds by an untrained user
- **Accessibility:** UI must meet WCAG 2.1 AA standards
- **Security:** Unauthenticated submission endpoints must be rate-limited and scoped to valid location tokens only; authenticated routes require session-based auth
- **Media:** Photo/video uploads must support common mobile formats (JPEG, PNG, HEIC, MP4, MOV); maximum file size TBD with engineering
- **Scalability:** Must support all 25 locations with potential to expand
- **Availability:** Target 99.5% uptime. v1 runs on a single host, so the submission UI must retry transient failures client-side and surface a clear retry/queued state; full device-side offline queuing is deferred (see Open Questions)
- **Privacy:** Uploaded photos/videos may capture staff or customers; media access must be restricted to authorized technicians, owners (their own locations), and admins, and all media access must be logged. Retention policy TBD.

---

## 5. Design & UX

### 5.1 User Flows

**Happy Path — Store Staff Ticket Submission:**

- Staff scans QR code posted at their location
- Mobile browser opens ticket form — location is pre-populated, no login required
- Staff selects Category (IT or Maintenance)
- Staff enters a description of the issue
- Staff attaches a photo or video (required)
- Staff optionally sets a Completion Deadline
- Staff submits — ticket is created in Open state, and staff see an on-screen confirmation with a short ticket reference code
- Relevant technician(s) receive a Discord ping and/or email notification

**Ticket Lifecycle — Technician View:**

- Technician receives notification and opens ticket in their authenticated interface
- Technician moves ticket to In Progress and begins work
- If work is blocked (e.g., awaiting a part or vendor), technician moves to On Hold; if budget approval is needed, technician moves to Awaiting Approval and owner/owner staff are notified
- Owner approves or declines; technician is notified — a decline returns the ticket to In Progress
- Technician resolves ticket and marks Resolved; the relevant owner and owner staff are notified; notes are logged throughout

### 5.2 Wireframes & Mockups

Design files to be linked here upon completion.

- Figma: [URL — TBD]
- Key screens: QR landing / ticket form, technician ticket list, ticket detail view, owner dashboard, super-admin panel

---

## 6. Technical Considerations

### 6.1 Architecture Notes

The system requires two distinct access modes: an unauthenticated public-facing ticket submission flow (accessed via QR code) and an authenticated management interface for technicians, owners, and the super-admin. Location context should be encoded in the QR code URL as a secure, non-guessable token to prevent spoofed submissions.

Media uploads (photo/video) should be stored in object storage (e.g., S3 or equivalent). A full technical design document should be drafted by the engineering lead prior to kickoff.

### 6.2 Dependencies

- Discord API — for ping notifications to technicians and owner staff
- Gmail SMTP (via Nodemailer) — for email notifications
- Object storage (e.g., AWS S3) — for photo and video attachments
- QR code generation library — for location-specific code generation and management
- Authentication provider — for technician, owner, and admin accounts (session-based)

### 6.3 Risks & Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| QR code abuse — bad actors submitting fake tickets | Medium | Encode a signed, location-specific token in QR URL; rate-limit submissions per token |
| Large media uploads slowing submission on poor mobile connections | Medium | Compress media client-side before upload; set reasonable file size limits |
| Discord API outage causing missed notifications | Medium | Fall back to email; log all notification failures for retry |
| Owner data leakage across ownership groups | High | Enforce location scoping at the data layer, not just UI; audit in code review |
| Low adoption by store staff due to unclear QR code placement | Medium | Provide physical placement guidance; track QR scan rates per location post-launch |
| Submission flooding / notification spam via the unauthenticated endpoint | High | Per-location submission throttle, duplicate detection, and a lightweight anti-bot challenge; cap and queue outbound notifications so a burst cannot exhaust email or Discord limits |
| Single-host outage blocks all ticket submission | High | Automated database and object-storage backups with tested restore; client-side submission retry; a documented recovery runbook; evaluate high availability after v1 |
| Loss of required media evidence on disk failure | High | Back up object storage off-host alongside the database; never keep attachments only on the application host |

---

## 7. Timeline & Milestones

| Milestone | Owner | Target Date | Status |
| --- | --- | --- | --- |
| PRD Sign-off | Head of IT (PM) | TBD | In Progress |
| Technical Design Doc | Eng Lead | TBD | Not Started |
| Design Complete | Designer | TBD | Not Started |
| Engineering Kickoff | Eng Lead | TBD | Not Started |
| Alpha / Internal Testing | QA Lead | TBD | Not Started |
| Beta / Limited Rollout (pilot locations) | Head of IT | TBD | Not Started |
| GA Launch (all 25 locations) | Head of IT | TBD | Not Started |

---

## 8. Open Questions & Decisions

| # | Question | Owner | Resolution / Notes |
| --- | --- | --- | --- |
| Q1 | What is the maximum file size for photo/video attachments? | Eng Lead | TBD — dependent on storage budget and mobile UX testing |
| Q2 | Should the system support offline queuing if staff have no internet at time of submission? | Head of IT | TBD |
| Q3 | Which authentication provider will be used for technician and owner accounts? | Eng Lead | Resolved: Auth.js v5 (Credentials) with server-side sessions for instant revocation — see Technical Architecture §6.3 |
| Q4 | What is the approval workflow if the designated approver is unavailable? Is there a backup approver? | Owner A / Owner B | TBD |
| Q5 | Should ticket history be retained indefinitely or archived after a set period? | Head of IT | TBD |
| Q6 | Will any locations have dedicated IT or maintenance staff at launch, or is the shared model assumed for v1? | Head of IT | TBD |
| Q7 | What is the media retention period, and who may view attachments, given photos/videos may capture staff or customers (PII)? | Head of IT | TBD — see Technical Architecture security section |

---

## 9. Appendix & References

- User Research / Discovery Notes: [URL — TBD]
- Technical Design Document: [URL — TBD]
- Figma Design File: [URL — TBD]
- Discord API Documentation: https://discord.com/developers/docs
- QSRSoft (current system reference): [URL — TBD]
- WCAG 2.1 AA Guidelines: https://www.w3.org/TR/WCAG21/

*End of Document*
