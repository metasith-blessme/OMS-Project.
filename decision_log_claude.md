# Decision Log — Claude Code Session
**Date:** 2026-03-30
**Session performed by:** Claude Code (claude-sonnet-4-6)

This document records every architectural and code decision made during the Claude Code review and hardening session, as a continuation of Gemini's original `decision_log.md`.

---

## 8. PrismaClient Singleton Pattern
**Decision:** Created `backend/src/lib/prisma.ts` as the single shared `PrismaClient` instance. Removed the duplicate `new PrismaClient()` that existed in both `index.ts` and `order-service.ts`.
**Rationale:** Each `new PrismaClient()` opens its own connection pool. Having two instances meant double the connections and eventual pool exhaustion under load. All files must now import from `src/lib/prisma.ts`.
**Files changed:** `backend/src/lib/prisma.ts` (new), `backend/src/index.ts`, `backend/src/services/order-service.ts`

---

## 9. Frontend API URL via Environment Variable
**Decision:** Replaced both hardcoded `http://localhost:3001` URLs in `packing/page.tsx` with `process.env.NEXT_PUBLIC_API_URL`. Created `frontend/.env.local` (value: `http://localhost:3001`) and `frontend/.env.example` as a template.
**Rationale:** Hardcoded localhost breaks the app in any non-local environment (staging, production, Docker networking). The env var approach allows deployment without code changes.
**Files changed:** `frontend/src/app/packing/page.tsx`, `frontend/.env.local` (new), `frontend/.env.example` (new)

---

## 10. Order Status Enum Validation
**Decision:** Added server-side validation in `PATCH /api/orders/:id/status` that rejects any status string not in `['PENDING', 'PACKING', 'FINISHED', 'CANCELLED']`. Also added a guard that requires `packedBy` to be present when transitioning to `PACKING`.
**Rationale:** The Prisma schema stored `status` as a plain `String` with no constraints. Any value — including typos or invalid strings — could be persisted silently. This caused potential data corruption and broke frontend filtering logic which expects exact string values.
**Files changed:** `backend/src/index.ts`

---

## 11. Concurrency Lock — Ownership Enforcement
**Decision:** Added a second guard in `OrderService.updateOrderStatus`: when transitioning `PACKING → FINISHED`, the backend now checks that `packedBy` in the request matches `order.packedBy` stored in the DB. If they don't match, it throws an error.
**Rationale:** The original code only prevented two employees from both starting to pack the same order (PENDING → PACKING check). But it did not prevent Employee B from "finishing" an order that Employee A was packing. This is a real warehouse floor scenario.
**Error message returned:** `"Order is being packed by [name]. Only they can finish it."`
**Files changed:** `backend/src/services/order-service.ts`

---

## 12. Cascading Deletes in Prisma Schema
**Decision:** Added `onDelete` behaviors to all foreign key relations:
- `ProductVariant → Product`: `onDelete: Cascade` — deleting a Product removes all its variants
- `ChannelProduct → ProductVariant`: `onDelete: Cascade` — deleting a variant removes its channel mappings
- `OrderItem → Order`: `onDelete: Cascade` — deleting an order removes its line items
- `OrderItem → ProductVariant`: `onDelete: Restrict` — cannot delete a variant that has order history (data integrity)
- `InventoryLog → Product`: `onDelete: Cascade` — deleting a product clears its audit log

**Rationale:** Without these, deleting parent records left orphaned child rows with no FK reference — silent data corruption that would cause query errors later.
**Note:** Requires `npx prisma db push` to apply to the live database.
**Files changed:** `backend/prisma/schema.prisma`

---

## 13. Fix Wrong Category Default in Order Model
**Decision:** Changed `Order.category` default from `"PENDING"` (wrong — that's a status value) to `"1_ITEM"` (the most common valid category value).
**Rationale:** `"PENDING"` is an order *status* value, not an order *category* value. Valid categories are `1_ITEM`, `2_ITEMS`, `3_ITEMS_PLUS`, `MIXED`. Having the wrong default would cause new orders created without explicit category to fail `getCategoryLabel()` in the frontend and render incorrectly.
**Files changed:** `backend/prisma/schema.prisma`

---

## 14. Timezone Hardcoded to Asia/Bangkok
**Decision:** Rewrote `getShipByDate()` in `order-utils.ts` to use `Intl.DateTimeFormat` with `timeZone: 'Asia/Bangkok'` to determine the current hour, instead of `Date.setHours()` which uses server local time.
**Rationale:** The noon cutoff (12:00 PM) is a business rule tied to Bangkok time (UTC+7). If the server ever runs in a different timezone (cloud VM, Docker with different TZ), the cutoff would silently shift, causing wrong `shipByDate` assignments and SLA violations with Shopee/TikTok/Line.
**Files changed:** `backend/src/utils/order-utils.ts`

---

## 15. CLAUDE.md Created
**Decision:** Created `CLAUDE.md` at the project root with: run commands, architecture overview, data model explanation, request flow, order lifecycle, key file index, and important constraints.
**Rationale:** Provides fast context ramp-up for any future Claude Code session without needing to re-read all source files.
**Files changed:** `CLAUDE.md` (new)

---

# Session 2 — Phase 1.5: Backend Hardening + Batch Packing Feature
**Date:** 2026-03-31
**Session performed by:** Claude Code (claude-sonnet-4-6)

---

## 16. Prisma Enums for All Categorical Fields
**Decision:** Converted `Order.status`, `Order.channel`, `Order.category`, and `Order.syncStatus` from `String` to proper Prisma enums (`OrderStatus`, `OrderChannel`, `OrderCategory`, `SyncStatus`). Added 4 `@@index` directives on `Order` (status, channel, shipByDate, createdAt).
**Rationale:** String fields have no DB-level constraint — any value can be persisted silently. Enums enforce valid values at the DB layer and give TypeScript full type safety across the codebase.
**Critical caveat discovered:** PostgreSQL cannot cast existing varchar data to an enum column. Migration required `npx prisma db push --force-reset` (drops and recreates the DB). Do NOT use this on production with real data — write a proper migration instead.
**Also discovered:** Prisma serializes the TypeScript enum *key name* in JSON responses (e.g. `ONE_ITEM`), NOT the `@map` value (e.g. `1_ITEM`). Removed `@map` from `OrderCategory` to avoid a disconnect between what DB stores and what the frontend receives.
**Files changed:** `backend/prisma/schema.prisma`, `backend/prisma/seed.ts` (updated category references to `ONE_ITEM` etc.)

---

## 17. Route Extraction into Separate Files
**Decision:** Extracted all Express routes from `backend/src/index.ts` into `backend/src/routes/order-routes.ts` and `backend/src/routes/product-routes.ts`. Added middleware files: `src/middleware/validate.ts` (Zod), `src/middleware/error-handler.ts` (centralized AppError), `src/lib/logger.ts` (pino).
**Rationale:** `index.ts` was a 200+ line file mixing app config, middleware setup, and all route handlers. Extracting routes makes each file single-purpose and easier to test/extend.
**Zod validation middleware:** Uses `schema.safeParse(req.body)` (not `.parse`) to avoid throwing — returns 400 with `{error, details}` on failure.
**Files changed:** `backend/src/index.ts`, `backend/src/routes/order-routes.ts` (new), `backend/src/routes/product-routes.ts` (new), `backend/src/middleware/validate.ts` (new), `backend/src/middleware/error-handler.ts` (new), `backend/src/lib/logger.ts` (new)

---

## 18. Express Route Ordering — `/batch/status` Before `/:id/status`
**Decision:** The batch route `PATCH /orders/batch/status` must be declared BEFORE `PATCH /orders/:id/status` in the router file.
**Rationale:** Express matches routes top-to-bottom. If `/:id/status` is declared first, Express treats the literal string `"batch"` as the `:id` parameter and the batch endpoint is never reached. This is a silent routing bug — requests would appear to succeed but act on a non-existent order ID.
**Files changed:** `backend/src/routes/order-routes.ts` (route order)

---

## 19. Valid State Transition Map
**Decision:** Added a `VALID_TRANSITIONS` map in `OrderService.updateOrderStatus`:
```
PENDING    → ['PACKING', 'CANCELLED']
PACKING    → ['FINISHED', 'PENDING', 'CANCELLED']
FINISHED   → ['PACKING', 'PENDING']
CANCELLED  → ['PENDING']
```
Returns HTTP 409 if the requested transition is not in the allowed list.
**Rationale:** Previously any status string could be written to any order regardless of current state. A FINISHED order could jump directly to CANCELLED, or a PENDING order could jump to FINISHED — both of which bypass inventory deduction logic and break the packing workflow.
**Files changed:** `backend/src/services/order-service.ts`

---

## 20. Negative Stock Guard
**Decision:** Added a pre-check before inventory deduction: if `product.baseStock < totalDeduction`, the service throws `"Insufficient stock for [SKU]"` (HTTP 422), rejecting the PACKING transition.
**Rationale:** The original code would deduct stock below zero, resulting in negative inventory numbers in the DB with no error. This would silently indicate the team is committing to ship orders they cannot fulfill.
**Files changed:** `backend/src/services/order-service.ts`

---

## 21. CANCELLED Status Inventory Restore
**Decision:** When an order transitions to `CANCELLED` from `PACKING` or `FINISHED`, inventory is restored: `baseStock += quantity × packSize` for each order item.
**Rationale:** Inventory is deducted at `PACKING`. If the order is cancelled after packing has started, the stock should be returned. Without this, cancellations permanently reduce stock even though the items were never actually shipped.
**Files changed:** `backend/src/services/order-service.ts`

---

## 22. Batch Status Endpoint
**Decision:** Added `PATCH /api/orders/batch/status` accepting `{ orderIds: string[], status: OrderStatus, packedBy?: string }`. The handler loops through each orderId, calls `OrderService.updateOrderStatus()` individually, and collects results and errors. Returns `{ results: [{orderId, success, order}], errors: [{orderId, error}] }`.
**Rationale:** The packing team wanted to select multiple orders at once and start packing all of them simultaneously. Processing each order through the existing single-update service ensures all existing business logic (stock deduction, state machine, concurrency lock) applies to each order in the batch.
**Partial success:** If 3 of 5 orders succeed and 2 fail (e.g. insufficient stock), the API returns both results and errors. The frontend shows a toast for each failure.
**Files changed:** `backend/src/routes/order-routes.ts`

---

## 23. Category Sections on All Status Tabs
**Decision:** Orders are grouped by category (`ONE_ITEM`, `TWO_ITEMS`, `THREE_PLUS`, `MIXED`) and displayed under labeled section dividers on ALL three tabs (TO PACK, PACKING, DONE) — not just TO PACK.
**Rationale:** The user initially asked for grouping on the TO PACK tab to prevent mispacking. After implementation, they also wanted the same grouping on PACKING and DONE tabs, as it helps track which orders in each category are in which state.
**Section display order:** `ONE_ITEM → TWO_ITEMS → THREE_PLUS → MIXED`. Empty sections are skipped.
**Files changed:** `frontend/src/app/packing/page.tsx` (`CATEGORY_SECTIONS` constant, `groupedOrders` useMemo, render logic)

---

## 24. Long-Press Multi-Select Mode
**Decision:** Holding any order card for 500ms in the TO PACK tab enters "select mode". Cards in select mode: hide action buttons, show "TAP TO SELECT" / "✓ SELECTED" hint, green border + checkmark overlay when selected. Tap the card body to toggle selection. Tapping a different status tab cancels select mode.
**Rationale:** The packing team needs to group multiple orders before starting packing, so they can see the total quantities they need to prepare. A long-press (hold) gesture is the established mobile pattern for entering multi-select (same as iOS/Android file managers).
**Implementation detail:** Long-press uses `onPointerDown` + `setTimeout(500ms)` ref + `onPointerUp`/`onPointerLeave` to cancel. `useRef<ReturnType<typeof setTimeout>>` avoids Node.js vs browser timer type conflicts.
**Files changed:** `frontend/src/components/packing/OrderCard.tsx`, `frontend/src/app/packing/page.tsx`

---

## 25. Packing Summary Modal
**Decision:** Before confirming batch packing, a modal shows aggregated quantities across all selected orders. The modal computes `Map<variantId, totalQty>` internally from `selectedOrders`, sorted descending by quantity. Shows "N orders · M items total" header. START ALL button shows a loading spinner during the API call.
**Rationale:** The core user goal: the team needs to know "how many of each item do I need to prepare?" before starting to pack a batch. Without this summary, they would have to manually count across all selected cards — error-prone for 5+ orders.
**Files changed:** `frontend/src/components/packing/PackingSummaryModal.tsx` (new)

---

## 26. React Rules of Hooks Violation Fix
**Decision:** Moved all `useMemo` calls (`filteredOrders`, `groupedOrders`, `selectedOrders`) and converted plain `const` assignments to `useMemo`, placing all of them ABOVE the `if (!isLoggedIn) return <LoginScreen />` early return.
**Rationale:** React requires hooks to be called in the same order on every render. An early return before a hook call means on some renders the hook is skipped entirely — React throws "change in the order of Hooks". All hooks (including `useMemo`) must be unconditionally called before any conditional return.
**Files changed:** `frontend/src/app/packing/page.tsx`

---

## 27. CLAUDE.md Fully Rewritten
**Decision:** Replaced the original `CLAUDE.md` (Session 1) with a comprehensive updated version covering: all 4 Prisma enums, updated file structure (routes/, middleware/, lib/), full API endpoint table, Phase 1.5 status, batch route ordering warning, and updated Phase 2 readiness notes.
**Files changed:** `CLAUDE.md`

---

# Session 3 — Phase 2: Shopee CSV Import + Line OA Slip Confirmation
**Date:** 2026-04-07
**Session performed by:** Claude Code (claude-sonnet-4-6)

---

## 28. Shopee API → CSV Upload (Strategic Pivot)
**Decision:** Abandoned the Shopee Messaging API integration (built in Session 2 by Gemini). Replaced with a multipart CSV upload endpoint that accepts Packing List exports from Shopee Seller Center.
**Rationale:** Parn could not obtain `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY` — Shopee API access requires business verification that is unavailable for this shop tier. CSV export from Seller Center is always accessible with no API credentials. The `ShopeeService` class in `integrations/shopee.ts` is kept but unused.
**New endpoint:** `POST /api/integrations/shopee/upload` — multer memoryStorage, 5 MB limit, CSV MIME + extension filter.
**Files changed:** `integration-routes.ts` (rewritten), `integrations/shopee-csv.ts` (new), `FilterBar.tsx`, `ImportCsvModal.tsx` (new), `useOrders.ts`

---

## 29. CSV Column Normalization for Thai + English Headers
**Decision:** `ShopeeCSVParser` normalizes all column headers via a `COLUMN_MAP` dictionary (33 entries) before processing rows. Shopee Thai locale exports Thai headers; English locale exports English headers. Both are mapped to the same canonical keys: `orderId`, `sku`, `quantity`, `price`, `shipByDate`.
**Also handled:** UTF-8 BOM (common in Shopee CSV exports) — csv-parse `bom: true` option strips it automatically.
**Files changed:** `backend/src/integrations/shopee-csv.ts`

---

## 30. Multi-Row CSV Grouping by Order ID
**Decision:** Shopee Packing List CSVs emit one row per item variant (a 2-item order = 2 rows with same Order ID). The parser groups rows into `ParsedShopeeOrder[]` by `orderId` before returning. Each order has an `items[]` array.
**Rationale:** `OrderService.createOrder` expects one call per order with an items array. Without grouping, each CSV row would try to create a separate single-item order, breaking multi-item orders entirely.
**Files changed:** `backend/src/integrations/shopee-csv.ts`

---

## 31. CSV Import Returns HTTP 200 with Partial Results
**Decision:** `POST /api/integrations/shopee/upload` always returns HTTP 200 with `{ created: N, skipped: N, errors: [{orderId, reason}] }`. Errors per row do not abort the whole upload.
**Rationale:** Returning 4xx on any row failure would force staff to manually fix the CSV and re-upload. Partial success lets good rows through and surfaces only the bad rows for manual handling. Matches Shopee's own batch API behavior.
**Files changed:** `backend/src/routes/integration-routes.ts`

---

## 32. Line OA: Slip-First Flow (Admin Creates Order, Customer Confirms)
**Decision:** Line OA integration does NOT auto-create orders from customer messages. The workflow is: (1) admin creates a LINE order manually via `NewOrderModal`, (2) customer sends slip image to Line OA, (3) webhook marks the order as `slipReceived=true`.
**Rationale:** Shopee/TikTok orders are structured (SKU + qty in the platform). Line messages are freeform Thai text. Parsing order details from chat messages reliably requires NLP — overkill for a small internal tool. Admin-creates + customer-confirms-via-slip is lower friction and more reliable.
**Alternative considered:** LIFF form (customer fills structured form) — rejected as requiring more Line Developers setup and customer education.
**Files changed:** `NewOrderModal.tsx` (new), `useOrders.ts`, `packing/page.tsx`

---

## 33. Line Webhook: Raw Body Required, express.json() Bypassed
**Decision:** Added a conditional in `index.ts` that skips `express.json()` for `/api/integrations/line/webhook`. The route itself applies `express.raw({ type: 'application/json' })`.
**Rationale:** Line's HMAC-SHA256 signature (`X-Line-Signature` header) is computed over the raw request body bytes. `express.json()` parses and discards the raw buffer before the route handler runs — signature validation would always fail. This is a well-known Line webhook gotcha.
**Files changed:** `backend/src/index.ts`, `backend/src/routes/integration-routes.ts`

---

## 34. Line Slip Matching Strategy
**Decision:** When a slip image arrives on the Line webhook, the backend uses this matching priority:
1. Find PENDING LINE order where `lineUserId` matches (repeat customer already linked)
2. Fallback: find most recent PENDING LINE order where `lineUserId IS NULL` (new customer, first slip)
3. If no match: still reply to customer with acknowledgement; admin resolves manually
**Rationale:** Admin creates orders before the customer's `lineUserId` is known. The fallback covers the first-time case. The "most recent" heuristic works reliably when orders come in sequentially (the common case). Ambiguity when multiple PENDING LINE orders exist simultaneously is flagged by the SLIP badge for admin to resolve.
**Files changed:** `backend/src/integrations/line.ts`

---

## 35. `slipReceived` / `lineUserId` Added to `Order` Model (Not a Separate Table)
**Decision:** Added `lineUserId String?`, `slipReceived Boolean @default(false)`, `slipReceivedAt DateTime?` directly to the `Order` Prisma model.
**Rationale:** Slip confirmation is a 1:1 event per order. A separate `LineSlip` table adds join complexity with no benefit at this scale. Nullable fields are zero-cost for non-LINE orders. Applied via `npx prisma db push` (no force-reset needed — adding nullable fields is non-destructive).
**Files changed:** `backend/prisma/schema.prisma`

---

## 36. AWAITING SLIP / SLIP ✓ Badges on OrderCard
**Decision:** LINE orders show `AWAITING SLIP` (yellow, pulsing) when `slipReceived=false` and status is PENDING. They show `SLIP ✓` (green, static) once `slipReceived=true`.
**Rationale:** Admin needs to know at a glance which LINE orders are waiting for payment confirmation before starting to pack. The pulse animation draws attention without being disruptive. The badge disappears from non-LINE orders (SHOPEE/TIKTOK don't use this flow).
**Files changed:** `frontend/src/components/packing/OrderCard.tsx`

---

## 37. NewOrderModal — Manual LINE/TikTok Order Entry
**Decision:** Added a "NEW ORDER" button (green, `+` icon) next to the CSV import button in FilterBar. Opens `NewOrderModal.tsx` — a form with channel selector (LINE/TIKTOK), order reference/customer name, dynamic item rows (variant dropdown + qty + price), auto-computed total.
**Rationale:** LINE and TikTok orders originate from chat — there is no CSV export and no API. Staff must be able to create these orders manually in the dashboard. The form calls the existing `POST /api/orders` endpoint, which already exists with full Zod validation.
**Files changed:** `NewOrderModal.tsx` (new), `FilterBar.tsx`, `packing/page.tsx`, `useOrders.ts`

---

# Deployment Session — 2026-04-08

## 38. Production Hosting: Neon + Render + Vercel (all free tiers)
**Decision:** Deployed the stack across three free-tier providers instead of a single all-in-one host:
- **Neon** for Postgres (Singapore region, 0.5 GB, always-on free tier)
- **Render** for the Express backend (Singapore, free tier — sleeps after 15 min idle)
- **Vercel** for the Next.js frontend (free hobby plan)
**Rationale:** The user needed a team-accessible deployment at zero cost with no credit card. Fly.io would have been always-on but now requires a card at signup. Render's 15-minute sleep is acceptable for this workload (warehouse staff use it in bursts, not 24/7). Neon was chosen over Supabase because the existing schema is pure Prisma and we didn't need auth/storage. Vercel is the obvious choice for Next.js. Splitting across providers keeps each within its free ceiling rather than hitting one provider's limits.
**Files changed:** none (infrastructure only)

---

## 39. Render Blueprint (`render.yaml`) Instead of UI-Driven Config
**Decision:** Added `render.yaml` at project root describing the backend service. Env vars marked `sync: false` are still set in the Render dashboard, but region, root directory, build/start commands, and plan all live in code.
**Rationale:** The user landed in Render's Blueprint flow by accident, but this ended up being the right call — the config is now reproducible and committed, not trapped in a dashboard. Future redeploys or a new Render account can rebuild from the yaml.
**Files changed:** `render.yaml` (new)

---

## 40. `postinstall: prisma generate` in `backend/package.json`
**Decision:** Added a `postinstall` script that runs `prisma generate` after `npm install`. The `build` script also starts with `prisma generate` defensively.
**Rationale:** Render (and Vercel) run `npm install` fresh on every deploy. Without `postinstall`, `@prisma/client` is installed as an empty stub and `tsc` fails because types are missing. `postinstall` ensures the client is generated before anything else touches it. Running generate twice (postinstall + build) is cheap and idempotent.
**Files changed:** `backend/package.json`

---

## 41. Fixed `tsconfig.json` `rootDir` to `./src`
**Decision:** Changed `rootDir` from `"."` to `"./src"` and removed `prisma/**/*` from `include`. Also added `dist`, `test`, `prisma` to `exclude`.
**Rationale:** The original config had `rootDir: "."` and included both `src/**/*` and `prisma/**/*` (for `seed.ts`). TypeScript then preserved the common-ancestor directory structure, emitting `dist/src/index.js` and `dist/prisma/seed.js` instead of `dist/index.js`. This broke `npm start` in production (Render) where the start command was `node dist/index.js`. Fix: scope the build to `src/` only — `seed.ts` is still run via `ts-node` at dev time and doesn't need to be compiled into the production bundle.
**Files changed:** `backend/tsconfig.json`

---

## 42. Static Bearer Token (`API_TOKEN`) Instead of Full Auth
**Decision:** Kept the pre-existing static bearer token scheme (`API_TOKEN` env var, checked by `backend/src/middleware/auth.ts`, passed by frontend via `NEXT_PUBLIC_API_TOKEN` in `frontend/src/lib/api.ts`). Did NOT introduce user accounts, sessions, or JWT.
**Rationale:** The user is non-technical and wanted the team using this immediately. Real auth (user accounts, password hashing, sessions) adds a week of work for no functional benefit at this team size. The bearer token is a meaningful upgrade from no auth at all — it stops random internet traffic from hitting the API. When the team grows or the app becomes customer-facing, revisit.
**Follow-up:** The token is currently committed in chat history and should be rotated in both Render and Vercel env vars before sharing the URL broadly.
**Files changed:** none (existing code)

---

## 43. GitHub Repo Name Has a Trailing Dot (`OMS-Project.`)
**Decision:** Left the repo name as-is rather than creating a new one.
**Rationale:** The repo was created with `OMS-Project.` (trailing period) by accident. Renaming it would break the existing remote, Render's GitHub integration, and Vercel's GitHub integration — all three would need to be reconnected. The trailing dot is cosmetic only; git and both platforms handle it fine. Leave it alone.
**Files changed:** none

---

## 44. Neon Connection String Uses `?sslmode=require`
**Decision:** Kept `sslmode=require` in the `DATABASE_URL`. Did not switch to the Neon pooler URL.
**Rationale:** Neon requires SSL. The direct (non-pooler) connection string is sufficient for this workload — concurrent connections from Render free tier are capped at 1 worker anyway (`WEB_CONCURRENCY=1`). If we later move to a paid Render plan with multiple workers, switch to the pooler URL to avoid exhausting Neon's connection limit.
**Files changed:** none (env var only)
