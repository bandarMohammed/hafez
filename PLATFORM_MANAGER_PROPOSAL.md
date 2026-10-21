# Proposal — merge B (Admin) + F (Judges) into «مدير المنصة — Platform Manager»

> **Status: proposal pending approval.** Nothing below has been applied. B and F still show the "under development" page, and no Figma frame has been changed.

## 1. What exists today

### Figma screens

| Frame                         | Node                  | Content                                                                                                                                                                                                                                    | Actions on the frame                                                          |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **B1** Dashboard (AR / EN)    | `16:474` / `16:847`   | Metrics (registered events, open coordination requests, completed pickups, kg actually received), events table with All / Needs action / In progress / Finished + search, "Needs admin action" panel, inspection outcomes, recent activity | Reset demo data, Assign a rep, Follow up, Review, View                        |
| **B2** Event detail (AR / EN) | `26:3315` / `26:3562` | 8-step stepper, event data from the hall, coordination & assignment, inspection state, full activity log with before → after                                                                                                               | Admin correction; Close event (disabled until handover or inspection outcome) |
| **B3** Organizations & users  | `27:3568` (AR)        | Tabs: halls (3), charities (3), demo users (5); status active / suspended; "limits of this screen" panel (no passwords, suspend = reversible archive, logged)                                                                              | Add demo organization, Suspend / Activate                                     |
| **B4** Reports & activity     | `27:3785` (AR)        | Filters (organization, period); kg received, inspections, completed handovers, events; events by status; full activity log (time, actor, action, record, before → after)                                                                   | Reset demo data                                                               |
| **B5** Impact close-out       | `49:6265` / `49:6460` | Scenario 180 → 150 consumed → 30 left = 20 saved + 10 spoiled; 8 kg distributed (beneficiary-confirmed); hypothetical baseline comparison, clearly labelled as not proven                                                                  | —                                                                             |
| **G4** Reset confirmation     | (G section)           | Confirmation dialog before resetting demo data (admin)                                                                                                                                                                                     | Confirm / Cancel                                                              |
| **F1** Judges overview        | `25:2675` / `25:2891` | Read-only banner; same metrics as B1; sample events (E-104, E-101, E-102); condensed activity summary                                                                                                                                      | **None** — "no action buttons are shown"                                      |
| **F2** Permission denied      | `25:3102` (mobile AR) | "You don't have permission to edit this record — the judges account is view-only"                                                                                                                                                          | Back to view                                                                  |

Figma navigation — B: Dashboard · Events · Assignments & tasks · Handovers · Organizations & users · Reports & activity. F: Overview · Events (view) · Activity summary.
(B "Events", "Assignments & tasks" and "Handovers" lists have no frames of their own; B2 is the only event screen.)

### Code

- Roles `admin` and `judge_viewer`, accounts `demo-admin` and `demo-judge`, workspaces `/admin` and `/judge` → both show the "under development" page (`implemented: false`, empty nav).
- `can()` already: both see every event; admin may create/edit any event, assign a rep and reset demo data; the judge has no write action (unit test "judge is read-only").
- The reset command and `WorkspaceGate` exist; the G4 dialog does not.
- E2E `a2-c1` uses `demo-admin` as the "unbuilt role" example — it must change when this is built.

### Blueprint rules that must hold

- Judges: «لا يستطيع حساب الحكّام إنشاء أو تعديل أو إغلاق سجلات» (acceptance criterion); events = "sample view only"; activity = "summary only"; **no** access to organizations & users.
- Admin: all events, assign, status changes / close, demo management of organizations, full activity log, reset demo data with confirmation; never shows passwords or secrets.
- B5: the baseline comparison stays labelled hypothetical.

## 2. Duplicates and what must not be lost

| Overlap                               | Proposal                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| B1 Dashboard ≈ F1 Overview            | **One** dashboard. Read-only access: F1 banner, no action buttons, "needs action" shown without buttons |
| B2 Event detail ≈ F "Events (view)"   | **One** event list + B2 detail. Read-only access: no "Admin correction" / "Close event"                 |
| B4 activity log ≈ F1 activity summary | **One** screen. Manager: full log with before → after. Read-only: condensed summary (as F1)             |
| B3 Organizations & users              | Manager only — hidden from the read-only account; a direct URL shows **F2**                             |
| B5 Impact                             | Shared, read-only content for both                                                                      |

Must not be lost: the judges' read-only guarantee (no buttons, F2 on direct URLs to actions), admin-only reset with the G4 confirmation, admin-only organizations screen, full vs summary activity, the hypothetical label on B5, no passwords anywhere.

## 3. Proposed structure

**One workspace `/platform`, one navigation, two demo accounts with two access levels.** Internally the two roles stay (`admin`, `judge_viewer`), so every `can()` rule and test keeps working; both just open the same workspace.

| Account      | Label (AR / EN)                                                                    | Access    |
| ------------ | ---------------------------------------------------------------------------------- | --------- |
| `demo-admin` | مدير المنصة / Platform Manager                                                     | manage    |
| `demo-judge` | مدير المنصة — عرض للحكّام (قراءة فقط) / Platform Manager — judges view (read-only) | read-only |

### Navigation and destinations

| Nav item (AR / EN)                         | Route                                       | Built from    | Manager                                                             | Read-only (judges)    |
| ------------------------------------------ | ------------------------------------------- | ------------- | ------------------------------------------------------------------- | --------------------- |
| لوحة المتابعة / Dashboard                  | `/platform`                                 | B1 + F1       | full, with Reset demo data (G4) and Assign                          | F1 banner, no buttons |
| المناسبات / Events                         | `/platform/events`, `/platform/events/[id]` | B1 table + B2 | Admin correction, Close event (after handover / inspection outcome) | view only             |
| الإسناد والمهام / Assignments & tasks      | `/platform/assignments`                     | no frame      | list + assign (existing command)                                    | view only             |
| التسليمات / Handovers                      | `/platform/handovers`                       | no frame      | list of every handover record                                       | view only             |
| الجهات والمستخدمون / Organizations & users | `/platform/organizations`                   | B3            | demo management                                                     | **hidden**; URL → F2  |
| التقارير وسجل النشاط / Reports & activity  | `/platform/reports`                         | B4            | full log, before → after                                            | condensed summary     |
| مؤشرات الأثر / Impact                      | `/platform/impact`                          | B5            | view                                                                | view                  |

Redirects: `/admin…` and `/judge…` → `/platform` (old links keep working). The account picker keeps two cards; only their labels change.

### Permissions (new `can()` actions)

| Action                                                   | Manager                                 | Read-only          |
| -------------------------------------------------------- | --------------------------------------- | ------------------ |
| `platform.view` (all screens above except organizations) | ✅                                      | ✅                 |
| `demo.reset` (exists)                                    | ✅                                      | ❌                 |
| `assignment.create` (exists)                             | ✅                                      | ❌                 |
| `event.correct`                                          | ✅                                      | ❌                 |
| `event.close`                                            | ✅ after handover or inspection outcome | ❌                 |
| `org.manage`                                             | ✅                                      | ❌ (screen hidden) |
| `activity.full`                                          | ✅                                      | ❌ (summary only)  |

Every write still goes through a workflow command with `can()`, an activity entry (before → after) and a flash message, like the other roles. Metrics are computed from the shared records — the same ones C, D, E and H write.

## 4. Decisions I need from you

1. **Names:** OK to label the role «مدير المنصة» and the second account «… — عرض للحكّام (قراءة فقط)»? (Figma calls them «مشرف المنصة» and «حساب الحكّام»; only code labels would change, not the Figma frames.)
2. **Judges' event scope:** all demo events (recommended — all are fictional and the metrics use all of them) or only F1's curated sample (E-104, E-101, E-102)?
3. **Screens without frames** (Assignments, Handovers): build them from the existing list patterns (recommended), or leave them out of the nav for now?
4. **B3 write actions:** implement Suspend / Activate (reversible, logged; needs an organization `status` field) and "Add demo organization", or keep B3 view-only?
5. **"Admin correction" in B2:** limit it to correcting a recorded inspection/handover quantity with a required reason (logged before → after), or leave it out of this iteration?

After approval I would change: `src/domain/roles.ts`, `src/domain/permissions.ts`, the seed (only if decision 4 adds a status), new `src/features/platform/*` and `src/app/[locale]/platform/*`, the `/admin` and `/judge` redirects, `platform.*` messages, the `a2-c1` "unbuilt role" test, and a new `platform` E2E spec (including "the judges account can't reach any action").
