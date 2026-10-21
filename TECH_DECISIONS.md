# Hafez — Technical decisions, assumptions and limits

Last updated: 2026-10-21 · Scope: first implemented flow **A2 → C1**.

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

- Unbuilt hall screens are a fixed list declared with `generateStaticParams` + `dynamicParams = false`, so unknown paths are a **real HTTP 404** in production. (A `notFound()` thrown after streaming starts can only produce 200 + `noindex` — see Next.js docs "Streaming › Status codes".)
- In `next dev` those unknown hall paths still render the 404 page but with status 200; production (`next build && next start`) returns 404, which is what the E2E suite verifies.

## 5. Provisional values (not final — central in `src/config/demo.ts`)

| Value                                                  | Current                                                   | Status                                                      |
| ------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- |
| Hall can edit an event while status is                 | `registered`, `available`, `awaiting_charity`             | provisional (blueprint open question Q6)                    |
| "Finished" statuses (sorting)                          | `collected`, `no_surplus`, `not_collectable`, `closed`    | provisional                                                 |
| Time zone                                              | `Asia/Riyadh`                                             | assumption                                                  |
| Points, request limits, forecast assumptions (Q18–Q21) | **not used yet** — no screen in this iteration needs them | to be added to the same config when their screens are built |

Seed records (halls, charities, events E-101…E-108, activity) are fictional demo data matching the Figma screens.

## 6. Verified results (2026-10-21, Windows 11, Node 24.16)

| Check                                 | Result                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                   | ✅ 0 errors                                                                                                                      |
| `npm run lint`                        | ✅ 0 problems                                                                                                                    |
| `npm run format:check`                | ✅ clean                                                                                                                         |
| `npm test` (Vitest)                   | ✅ 34 / 34 passed (4 files)                                                                                                      |
| `npm run build`                       | ✅ success                                                                                                                       |
| `npm run test:e2e` (Playwright, Edge) | ✅ 31 passed, 1 skipped by design (drawer test runs on mobile only) — every test also asserts zero console errors                |
| Manual visual review vs Figma         | A2 (AR 1440, mobile 390), C1 (AR 1440/1280, EN 1440, mobile 390), drawer — compared against frames `19:974`, `19:1219`, `15:650` |

E2E coverage: A2 → C1 (AR & EN, card click and Continue), derived metrics 3/1/0, own-hall events only, Edit vs View by `can()`, session survives reload, language switch keeps the screen, unbuilt role page, storage keys, no session, access denied (both directions), corrupted data + reset, empty hall, under-development screen + back, 404 (AR/EN), skip link, keyboard card selection, account switcher (Esc returns focus, switching role), mobile drawer side + Esc, no horizontal scroll on A2/C1.

## 7. Known limitations

- Only A2 and C1 are functional; other screens/roles show an explicit "under development" page.
- No backend, no real auth, no persistence beyond the current browser.
- The account switcher is a demo convenience, not authentication.
- Event IDs accepted by the placeholder routes are the seed IDs (event creation is not built yet).
- Visual comparison with Figma was manual (screenshots), not pixel-diff automated.
- Not tested on Safari/Firefox or real iOS/Android devices (Edge/Chromium emulation only).

## 8. Next steps for the other roles

1. **Hall (C2–C6):** new-event form (zod schema shared with the repository), event detail/edit gated by `can("event.edit")`, writing `ActivityLogEntry` on every change.
2. **Charity (D1…):** opportunities list = events where `can(charity, "event.view")`; "express interest" transitions `available → awaiting_charity` and logs `coordination.interest`.
3. **Field representative (E1…):** assigned tasks → arrival → inspection result → handover; quantities stay separate from estimates.
4. **Admin (B1) / Judges (F1):** read-everything views reusing the same selectors; judges strictly read-only.
5. **Beneficiary (H1):** separate data model (requests), never sees events.
6. For each role: add its nav to `ROLE_CONFIG`, flip `implemented: true`, add selectors + unit tests, and extend the E2E suite.
7. Before any real deployment: real backend + server-side authorization, real auth, and replacing the local repository.
