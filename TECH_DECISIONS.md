# Hafez — Technical decisions, assumptions and limits

Last updated: 2026-10-21 · Scope: implemented flow **A2 → C1 → C2** (hall manager).

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

- Unbuilt hall screens (handovers, activity, profile) are a fixed list declared with `generateStaticParams` + `dynamicParams = false`, so unknown paths are a **real HTTP 404** in production. (A `notFound()` thrown after streaming starts can only produce 200 + `noindex` — see Next.js docs "Streaming › Status codes".)
- In `next dev` those unknown hall paths still render the 404 page but with status 200; production (`next build && next start`) returns 404, which is what the E2E suite verifies.
- Event view/edit (`/hall/events/[eventId]` and `/edit`) are **checked on the client**, because events created in C2 exist only in the browser. An unknown id shows the localized not-found state with HTTP 200 (the server cannot see local demo data).

### C2 — register a new event (Figma `19:1462` AR error state, `19:1689` EN valid)

- Rules are pure functions in `src/domain/newEvent.ts` (validation, next id, timestamps, record + activity entry) and are unit-tested; the store only persists the result through the repository and checks `can(user, "event.create")`.
- **Save & make available** → status `available`; **Save as registered** → `registered`; both write an `event.created` activity entry and return to C1 with a one-time confirmation (not in Figma — added so the save is visible; announced with `role="status"`).
- ⚠️ In Figma, "Save & make available" leads to **C3 (surplus forecast)**, which is not built yet. Until it is, the button makes the event available directly and the estimate stays "Not estimated" (`expectedSurplusKg: null` — never guessed). When C3 is built, insert it between save and C1.
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

## 5. Provisional values (not final — central in `src/config/demo.ts`)

| Value                                                                                                             | Current                                                   | Status                                                      |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Hall can edit an event while status is                                                                            | `registered`, `available`, `awaiting_charity`             | provisional (blueprint open question Q6)                    |
| "Finished" statuses (sorting)                                                                                     | `collected`, `no_surplus`, `not_collectable`, `closed`    | provisional                                                 |
| Time zone                                                                                                         | `Asia/Riyadh`                                             | assumption                                                  |
| C2 limits: date window, time slots, title 3–80, guests 1–5000, planned 1–5000 kg, notes ≤ 300, phone `05XXXXXXXX` | `DEMO_CONFIG.newEvent`                                    | provisional (demo choices)                                  |
| Food types list (hot meals, rice dishes, salads & starters, desserts, baked goods, fruit)                         | `FOOD_TYPES` in `src/domain/types.ts`                     | provisional                                                 |
| Points, request limits, forecast assumptions (Q18–Q21)                                                            | **not used yet** — no screen in this iteration needs them | to be added to the same config when their screens are built |

Seed records (halls, charities, events E-101…E-108, activity) are fictional demo data matching the Figma screens.

## 6. Verified results (2026-10-21, Windows 11, Node 24.16)

| Check                                 | Result                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                   | ✅ 0 errors                                                                                                                                                                 |
| `npm run lint`                        | ✅ 0 problems                                                                                                                                                               |
| `npm run format:check`                | ✅ clean                                                                                                                                                                    |
| `npm test` (Vitest)                   | ✅ 48 / 48 passed (5 files)                                                                                                                                                 |
| `npm run build`                       | ✅ success                                                                                                                                                                  |
| `npm run test:e2e` (Playwright, Edge) | ✅ 43 passed, 1 skipped by design (drawer test runs on mobile only) — every test also asserts zero console errors                                                           |
| Manual visual review vs Figma         | A2, C1, C2 (AR error state + EN valid state, food-type picker, C1 after save) at 1440 and 390 — compared against frames `19:974`, `19:1219`, `15:650`, `19:1462`, `19:1689` |

E2E coverage: A2 → C1 (AR & EN, card click and Continue), derived metrics 3/1/0, own-hall events only, Edit vs View by `can()`, session survives reload, language switch keeps the screen, unbuilt role page, storage keys, no session, access denied (both directions), corrupted data + reset, empty hall, under-development screen + back, 404 (AR/EN), skip link, keyboard card selection, account switcher (Esc returns focus, switching role), mobile drawer side + Esc, no horizontal scroll on A2/C1/C2.
C2: Figma error state (summary focused, exact AR text, field errors, nothing stored, live update), Save & make available → E-109 + confirmation + metrics 4 + persisted + one-time banner + working Edit link, Save as registered (stored fields, activity entry), Cancel saves nothing, food-type picker by keyboard, unknown event id → not-found.

## 7. Known limitations

- Only A2, C1 and C2 are functional; other screens/roles show an explicit "under development" page.
- C3 (surplus forecast) is skipped after C2 until it is built (see §4 C2).
- Cancel on C2 discards typed values without asking (no "unsaved changes" prompt in Figma).
- No backend, no real auth, no persistence beyond the current browser.
- The account switcher is a demo convenience, not authentication.
- Visual comparison with Figma was manual (screenshots), not pixel-diff automated.
- Not tested on Safari/Firefox or real iOS/Android devices (Edge/Chromium emulation only).

## 8. Next steps for the other roles

1. **Hall:** C3 forecast between C2 and C1 (rules in config: kg/guest, safety margin — Figma `49:5891`/`49:6078`), then event detail/edit gated by `can("event.edit")` reusing `validateNewEvent`, writing `ActivityLogEntry` on every change.
2. **Charity (D1…):** opportunities list = events where `can(charity, "event.view")`; "express interest" transitions `available → awaiting_charity` and logs `coordination.interest`.
3. **Field representative (E1…):** assigned tasks → arrival → inspection result → handover; quantities stay separate from estimates.
4. **Admin (B1) / Judges (F1):** read-everything views reusing the same selectors; judges strictly read-only.
5. **Beneficiary (H1):** separate data model (requests), never sees events.
6. For each role: add its nav to `ROLE_CONFIG`, flip `implemented: true`, add selectors + unit tests, and extend the E2E suite.
7. Before any real deployment: real backend + server-side authorization, real auth, and replacing the local repository.
