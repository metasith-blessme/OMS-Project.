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
