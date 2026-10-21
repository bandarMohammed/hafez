# Hafez — Technical decisions, assumptions and limits

Last updated: 2026-10-21 · Scope: implemented flow **A2 → C1 → C2 → C3** (hall manager).

## 1. Stack (exact versions, pinned)

| Area       | Choice                                                    | Why                                                                                                                                                            |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js **16.4.2** (App Router, Turbopack)                | Stable current major; file-based routing fits `[locale]` + role workspaces. `src/proxy.ts` replaces `middleware.ts` in v16.                                    |
| UI         | React **19.3.1**                                          | Required by Next 16.                                                                                                                                           |
| Language   | TypeScript **5.9.3** (strict, `noUncheckedIndexedAccess`) | TS 7 is not yet supported by `typescript-eslint` (needs < 6.1).                                                                                                |
| Styling    | Tailwind CSS **4.3.3**                                    | Tokens defined once in `globals.css` (`@theme inline`) mirroring the Figma variables; logical properties (`ms/me/ps/pe/start/end`) give RTL/LTR for free.      |
| i18n       | next-intl **4.14.9**                                      | Locale-prefixed routes (`/ar`, `/en`), server + client translations.                                                                                           |
| State      | Zustand **5.0.15**                                        | Tiny client store over the repository.                                                                                                                         |
| Validation | zod **4.6.7**                                             | Local data is untrusted input — validated on every load.                                                                                                       |
| Lint       | ESLint **9.39.5** + `eslint-config-next` 16.4.2           | ESLint 10 is not supported by `eslint-plugin-react` yet (peer ≤ 9.7). npm prints a deprecation notice for 9.x — expected; revisit when the plugin supports 10. |
| Format     | Prettier 3.9.10 (`printWidth` 120)                        |                                                                                                                                                                |
| Unit tests | Vitest 5.0.5 (node env)                                   | Pure logic only: permissions, selectors, repository, presenters, i18n catalogs, formatting.                                                                    |
| E2E        | Playwright 1.64.1 on installed **Microsoft Edge**         | No browser download needed. Laptop 1440×900 + mobile 390×844 projects, against the production build.                                                           |

### `next-intl/plugin` is not used (deliberate workaround)

`next-intl/plugin` eagerly `require`s `@swc/core` for its _experimental_ message extraction. On this Windows machine the SWC native binary fails to load (`LoadLibraryExW failed`), so `next build` could not even read `next.config.ts`. Without the experimental features the plugin only adds one Turbopack alias, so `next.config.ts` declares it directly:

```ts
turbopack: { resolveAlias: { "next-intl/config": "./src/i18n/request.ts" } }
```

If a future machine loads SWC fine, switching back to `createNextIntlPlugin("./src/i18n/request.ts")` is a one-line change.

## 2. Design → code

- **Tokens:** colours, radii, shadows and text styles are copied from the Figma variables/styles into `src/app/globals.css`. Components use semantic names (`bg-surface`, `text-heading`, `bg-action` …), never raw hex.
- **Typography:** Tajawal (AR) and Inter (EN) are self-hosted via `next/font/local` (copied from `brand/`; originals untouched). Arabic and English have separate line-heights/weights through CSS variables selected by `:lang()`; Arabic never gets letter-spacing.
- **Icons:** brand icons from `brand/assets/icons` + a few Lucide outlines, inlined in `components/ui/Icon.tsx`. Directional chevrons flip in RTL.
- **Status badges:** one mapping `status → tone` in `StatusBadge.tsx` (same as the Figma badge variants).

### Documented adaptations (where Figma had no spec or code needed a deterministic choice)

| Topic                       | Figma               | Code                                                                             | Reason                                                   |
| --------------------------- | ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| C1 below 1280px             | desktop table only  | events become cards below `xl` (1280px); table from 1280px                       | avoid clipping/horizontal scroll on laptops & tablets    |
| Workspace below 1024px      | no mobile C1 frame  | top app bar + the same sidebar in a native `<dialog>` drawer from the start side | focus trap + Esc for free; matches RTL/LTR               |
| Mobile metric cards         | —                   | horizontal compact cards (icon beside value)                                     | 3 tall tiles were ~1,300px of scrolling                  |
| "Last update" column        | relative ("2h ago") | absolute date/time ("21 Oct · 21:40 — …")                                        | deterministic output (no clock dependence in demo/tests) |
| "Date" column               | —                   | shows `foodReadyAt`                                                              | matches the Figma values (23:30 etc.)                    |
| Sidebar items not built yet | plain items         | gold dot + one-line legend + screen-reader text "(Under development)"            | honest state without the wide tag wrapping the labels    |
| "New event" button          | no icon             | no icon                                                                          | matched Figma during visual review                       |

## 3. Internationalisation

- `/` always redirects to **`/ar`** (`localeDetection: false`). The browser language is not used, so the product default (Arabic) is stable; the language switch keeps the current screen.
- `<html lang dir>` is set per locale; layout mirrors fully (sidebar side, drawer side, chevrons, table alignment).
- Dates: Gregorian calendar, **Latin digits**, `Asia/Riyadh` time zone, 24-hour clock (`ar-u-ca-gregory-nu-latn`).
- Message keys may not contain dots (next-intl uses dots for nesting). Activity actions such as `event.created` are mapped to `event_created` by `activityMessageKey()`. A unit test fails if a dotted key is added, if AR/EN key sets differ, or if their placeholders differ.

## 4. Data, permissions and states

- **Repository pattern** (`src/data/repository.ts`): UI depends only on `DemoRepository`. Today it is backed by `localStorage` (falls back to memory if storage is blocked). Swapping in a real API later does not touch components.
- Loaded data is validated with zod. Invalid JSON/shape → explicit **error state with a reset button**; a different `dataVersion` → reseed. Reset touches only the app's own keys.
- **`can(user, action, resource)`** in `src/domain/permissions.ts` is the single place for role rules; components never re-implement them.
  > ⚠️ Client-side checks are for **demo explanation only — not security**. A production backend must enforce every rule server-side.
- Every workspace route goes through `WorkspaceGate`: loading skeleton → data error → no account → access denied → content.
- No secrets, keys, passwords or real personal data exist anywhere in the frontend or storage.

### Routing & 404

- Every hall/charity/field/beneficiary screen is a real route; unknown paths fall through to the localized 404 page (real HTTP 404 in production).
- In `next dev` some unknown workspace paths render the 404 page with status 200; production (`next build && next start`) returns 404, which is what the E2E suite verifies.
- Record pages (`/charity/.../[id]`, `/field/tasks/[id]`, `/beneficiary/food/[id]` ...) are checked on the client against `can()` like the hall event pages below: an unknown or not-permitted id shows the localized not-found / not-assigned state.
- Event view/edit (`/hall/events/[eventId]` and `/edit`) are **checked on the client**, because events created in C2 exist only in the browser. An unknown id shows the localized not-found state with HTTP 200 (the server cannot see local demo data).

### C3 — surplus forecast & recommendation (Figma `49:5891` AR, `49:6078` EN)

- A transparent rule, **not an AI model** (`src/domain/forecast.ts`, unit-tested):
  1. consumption = guests × 0.5 kg
  2. recommended = consumption × 1.2, rounded **up** to a whole kg and never above the planned quantity
  3. reduction = planned − recommended
  4. surplus = recommended − consumption, also shown as full 2 kg boxes; baseline (no recommendation) = planned − consumption

  Figma scenario: 300 guests, 210 kg → 150 / 180 / 30 / 30 kg = 15 boxes; baseline 60 kg.

- Floating-point noise is removed before rounding (150 × 1.2 must give 180, not 181).
- **Use recommended** → status `available`, planned = recommended, estimate = surplus after recommendation. **Keep planned** → `available`, planned unchanged, estimate = baseline. Both store the assumptions and decision on the event (`forecast`) and log `event.updated` (registered → available). C1 then shows e.g. "30 kg (estimate)" — still an estimate, never a received quantity.
- **Adjust assumptions** (a button in Figma without a target frame) opens an inline panel for kg/guest (0.1–2) and safety margin (0–50%) for this event only. Numbers update live; invalid values disable the decision buttons; "Restore defaults" resets. Defaults and bounds live in `DEMO_CONFIG.forecast`.
- C3 is available only for the hall's own `registered` events created in C2 (they carry a planned quantity). Otherwise an explicit state explains why: already decided, not allowed (e.g. the read-only judge), no planned quantity (older seed events), or not found.
- When planned ≤ recommended there is no reduction: the "Keep" button is hidden and a note says so.
- Pure-number calculation lines use `dir="auto"` so "210 − 180" reads left-to-right exactly as in Figma, while Arabic lines stay RTL.
- The sidebar keeps "New event" as the current item on C3, as in Figma (`activePattern` in `ROLE_CONFIG`).

### C2 — register a new event (Figma `19:1462` AR error state, `19:1689` EN valid)

- Rules are pure functions in `src/domain/newEvent.ts` (validation, next id, timestamps, record + activity entry) and are unit-tested; the store only persists the result through the repository and checks `can(user, "event.create")`.
- New events always start as `registered` (`event.created`). **Save & make available** continues to **C3** (Figma prototype); the event is published only when the hall decides there. **Save as registered** returns to C1 with a one-time confirmation (not in Figma — added so the save is visible; `role="status"`).
- Leaving C3 without deciding keeps the event `registered`, so charities never see an event the hall didn't confirm.
- Ids continue the sequence (`E-109`, `E-110` …), matching the Figma scenario.
- Event date and times are **dropdowns** (as in Figma): dates from today (Asia/Riyadh) up to 90 days ahead, times every 30 minutes. This keeps Latin digits and the Gregorian calendar regardless of the browser locale (native date pickers follow the OS locale).
- End time and food-ready time are stored separately (`endsAt`, `foodReadyAt`). A ready time earlier than the end time is read as **after midnight** (e.g. ends 23:00, ready 00:30 → next day) — provisional rule, stated in the field hint.
- The form has no start time (not in Figma), so `eventDate` of C2 events is the calendar day at 00:00 Riyadh.
- City & district come from the hall profile (one option; shown as text to charities).
- Numbers accept Arabic-Indic digits (٣٠٠ → 300). The phone is an illustrative demo value (format `05` + 8 digits) and is never called.
- User-entered text (event name, notes) is stored as typed and shown in both languages — it is not translated.
- Errors appear only after the first save attempt, then update live. The error summary receives focus (`role="group"` + label/description) and lists the fields using the language's list format and plural rules ("أكمل حقلين مطلوبين: … و…").
- Timestamps from the seed use `+03:00` while new ones use UTC (`Z`); all sorting compares instants (`Date.parse`), never strings.
- Note on the demo clock: some seed activity is dated later today/tomorrow (fixed Figma scenario), so an event created now can appear _below_ those entries in "Latest activity".

## 4b. Role flows C → D → E → H on one shared record

All roles read and write the same `DemoDataset` through pure workflow commands in `src/domain/workflow/` (`hall`, `charity`, `field`, `beneficiary`, `notices`). Each command checks `can()`, writes an activity entry and in-app notices, and returns a flash message; screens never change records directly. Totals on every screen are computed by selectors from those records — none are hardcoded.

| Hand-off                 | What happens                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| C3 → D1                  | a published event (`available`) appears in the charity's opportunities                                                  |
| D2 → D4 → E1             | interest → `awaiting_charity`; assignment → `assigned`, task + notice for that representative only                      |
| E2 → E3                  | check-in → `representative_arrived`; final inspection → `inspected` / `no_surplus` / `not_collectable`                  |
| E4 → D5 → C              | provisional handover (actual kg) → charity confirms → `collected` (hall confirmation optional; a dispute sends it back) |
| D5 → D6 → H1             | a listing can be published only from a confirmed handover, never for more kg than remains unlisted                      |
| H2 → D6 → H3             | request `pending` → accepted (`ready`, units deducted) or rejected with a reason                                        |
| H7 → H5 / D6 impact      | full pickup → `completed`, +10 points once, counts as distributed; partial / not received → no points                   |
| H4 → D7 → E → D7 → H8/H5 | report → review / info request → inspection by a rep → charity documents the rescue → +25 points once                   |

### Deviations and decisions (no Figma frame, or data had to stay consistent)

| Topic                         | Decision                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing names / sizes         | All seed listings come from the one documented handover HO-101 (32 kg = 20 + 4 + 8), so titles say "أرز ولحم" (as recorded) instead of Figma's "أرز ودجاج", L-08 has 4 bags instead of 15, and all three are from Al Ataa. R-06 is not seeded.                                                                                               |
| One open request per listing  | Not stated in the blueprint; kept from the shared data layer so the per-request limit can't be bypassed with repeat requests. The seeded beneficiary (#17) already has open requests on both open listings, so the H2 form appears after D accepts and H confirms R-07, or on a new listing (as in the journey test). **Open for decision.** |
| Partial pickup                | No points — only a full confirmed pickup earns them (blueprint: points only after a verifiable event). **Open question.**                                                                                                                                                                                                                    |
| Reports                       | Always routed to Al Ataa (`reportsCharityId`). Photos are never read or stored — only "attached: yes/no". The food type is picked from a fixed list and stored as text in the reporter's language.                                                                                                                                           |
| Pickup point after acceptance | The model has only a general area, so H3 shows "charity office — {area}"; no exact address is stored anywhere.                                                                                                                                                                                                                               |
| H5 history                    | Ledger entries plus 0-point rows for the user's own reports not yet documented. Figma's "duplicate report" row isn't shown because no duplicate record exists. Newest first, so the sum reads "10 + 10 + 25".                                                                                                                                |
| H6                            | One fixed demo tip; the pledge is stored once and earns nothing.                                                                                                                                                                                                                                                                             |
| H7 "Report a problem"         | Opens H7 with "not received" preselected (no separate Figma frame).                                                                                                                                                                                                                                                                          |
| Screens without Figma frames  | Hall event detail/list/handovers/activity/profile, charity tasks/activity, the publish-listing form and the rep's report inspection — built from the existing components and patterns.                                                                                                                                                       |
| Navigation                    | Every role has an in-app Notices page; D's extra items sit in a mobile menu drawer; D4 confirm returns to D1 (as in Figma).                                                                                                                                                                                                                  |
| Seed text                     | Seed food types and reasons are Arabic text and show as typed in English too (user-entered data is not translated).                                                                                                                                                                                                                          |
| Demo clock                    | Seed dates are fixed (e.g. L-08 pickup 21 Oct 12:00–20:00); after that time the listing shows "Availability ended".                                                                                                                                                                                                                          |

## 5. Provisional values (not final — central in `src/config/demo.ts`)

| Value                                                                                                             | Current                                                | Status                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Hall can edit an event while status is                                                                            | `registered`, `available`, `awaiting_charity`          | provisional (blueprint open question Q6)                          |
| "Finished" statuses (sorting)                                                                                     | `collected`, `no_surplus`, `not_collectable`, `closed` | provisional                                                       |
| Time zone                                                                                                         | `Asia/Riyadh`                                          | assumption                                                        |
| C2 limits: date window, time slots, title 3–80, guests 1–5000, planned 1–5000 kg, notes ≤ 300, phone `05XXXXXXXX` | `DEMO_CONFIG.newEvent`                                 | provisional (demo choices)                                        |
| Food types list (hot meals, rice dishes, salads & starters, desserts, baked goods, fruit)                         | `FOOD_TYPES` in `src/domain/types.ts`                  | provisional                                                       |
| C3 forecast: 0.5 kg/guest, 20% safety margin, 2 kg per box; adjustable 0.1–2 kg and 0–50%                         | `DEMO_CONFIG.forecast`                                 | illustrative (Figma scenario) — must be calibrated with real data |
| Points: +10 confirmed pickup, +25 documented rescue; Silver at 50, Gold at 150; badge target 5 pickups            | `DEMO_CONFIG.points`                                   | provisional (blueprint Q18–Q21) — adjustable, not a final policy  |
| Beneficiary: 3 units per request, 2 kg per unit (default), "few left" at ≤ 2 units                                | `DEMO_CONFIG.beneficiary`                              | provisional                                                       |
| Surplus reports go to                                                                                             | `charity-ataa` (`DEMO_CONFIG.reportsCharityId`)        | demo assumption                                                   |

Seed records (halls, charities, events E-101…E-108, coordination, handovers, listings, requests, reports, points, notices, activity) are fictional demo data matching the Figma screens.

## 6. Verified results (2026-10-21, Windows 11, Node 24.16)

| Check                                 | Result                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                   | ✅ 0 errors                                                                                                               |
| `npm run lint`                        | ✅ 0 problems                                                                                                             |
| `npm run format:check`                | ✅ clean                                                                                                                  |
| `npm test` (Vitest)                   | ✅ 73 / 73 passed (7 files)                                                                                               |
| `npm run build`                       | ✅ success (run by the Playwright web server)                                                                             |
| `npm run test:e2e` (Playwright, Edge) | ✅ 105 passed, 3 skipped by design (tests that exist for one viewport only) — every test also asserts zero console errors |
| Manual visual review vs Figma         | C, D, E and H screens in AR and EN at 390 and 1440, compared with the Figma frames; no horizontal scroll on any of them   |

E2E coverage by role: `a2-c1`, `states`, `keyboard`, `c2-new-event`, `c3-forecast` (hall); `d-charity` (D1–D7, permissions, team availability, publish rules); `e-field` (own tasks only, check-in, no-surplus reason, handover validation, D5 confirmation, report inspection → rescue → points once); `h-beneficiary` (H1 availability and filters, duplicate and over-quantity request, own requests only, H7 validation and points once, H4 validation and review-only, H8 answer, H6 pledge, mobile tabs); `journey` (one event from C2 to H7 across every role).

## 7. Known limitations

- B (admin) and F (judges) still show the "under development" page — the Platform Manager merge is a proposal awaiting approval.
- No backend, no real auth, no persistence beyond the current browser; the account switcher is a demo convenience, not authentication.
- Forecast, points and limits are illustrative, not calibrated (see §5).
- Seed food types/reasons are Arabic-only text; seed dates are fixed, so some listings and events change state as the real clock passes them.
- Cancel on forms discards typed values without asking (no "unsaved changes" prompt in Figma).
- Visual comparison with Figma was manual (screenshots), not pixel-diff automated.
- Not tested on Safari/Firefox or real iOS/Android devices (Edge/Chromium emulation only).

## 8. Next steps

1. **B + F → Platform Manager (مدير المنصة):** proposal prepared and waiting for approval; nothing applied yet.
2. Decide the open questions: one open request per listing, points for partial pickup, final point values.
3. Before any real deployment: real backend + server-side authorization, real auth, and replacing the local repository.
