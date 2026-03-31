# OMS Project Review & Handoff — For Gemini

This document is written by Claude Code to brief Gemini on what has been reviewed, fixed, and what work remains. Read this alongside `decision_log.md` (Gemini's original) and `decision_log_claude.md` (Claude's additions).

---

## 1. What Claude Did in This Session

### Session 1 (2026-03-30) — Codebase Review & Hardening

Claude performed a full codebase review and implemented all critical fixes:

| # | Fix | Status |
|---|---|---|
| 8 | PrismaClient singleton (`src/lib/prisma.ts`) | ✅ Done |
| 9 | Frontend API URL via `NEXT_PUBLIC_API_URL` env var | ✅ Done |
| 10 | Status enum validation in `PATCH /api/orders/:id/status` | ✅ Done |
| 11 | Concurrency lock — only the packer who started can finish | ✅ Done |
| 12 | Cascading deletes in Prisma schema | ✅ Done |
| 13 | Fixed wrong `Order.category` default (`"PENDING"` → `"1_ITEM"`) | ✅ Done |
| 14 | Timezone hardcoded to `Asia/Bangkok` in `getShipByDate()` | ✅ Done |
| 15 | `CLAUDE.md` created for future AI context | ✅ Done |

### Session 2 (2026-03-31) — Phase 1.5: Backend Hardening + Batch Packing

| # | Feature / Fix | Status |
|---|---|---|
| 16 | Prisma enums for status/channel/category/syncStatus + DB indexes | ✅ Done |
| 17 | Route extraction: `order-routes.ts`, `product-routes.ts`, Zod middleware, pino logger, AppError handler | ✅ Done |
| 18 | Express route ordering fix: `/batch/status` before `/:id/status` | ✅ Done |
| 19 | Valid state transition map (PENDING→PACKING→FINISHED, etc.) | ✅ Done |
| 20 | Negative stock guard (HTTP 422 on insufficient stock) | ✅ Done |
| 21 | CANCELLED status restores inventory | ✅ Done |
| 22 | `PATCH /api/orders/batch/status` endpoint with partial success support | ✅ Done |
| 23 | Category sections (1 ITEM / 2 ITEMS / 3+ ITEMS / MIXED) on all tabs | ✅ Done |
| 24 | Long-press multi-select mode on order cards | ✅ Done |
| 25 | Packing summary modal with aggregated quantities | ✅ Done |
| 26 | React Rules of Hooks violation fix (useMemo above early return) | ✅ Done |
| 27 | CLAUDE.md fully rewritten with current architecture | ✅ Done |

### Session 3 (2026-03-31) — Pre-Phase 2 Hardening (Gemini)

| # | Feature / Fix | Status |
|---|---|---|
| A | Pagination on `GET /api/orders` (Backend + Frontend) | ✅ Done |
| B | `POST /api/orders` route for manual entry and testing | ✅ Done |
| C | Backend `.env.example` created | ✅ Done |
| D | Fix `seed.ts` to use PrismaClient singleton | ✅ Done |

---

## 2. Current Project State (as of 2026-03-31)

### What Works Right Now
- Packing dashboard at `http://localhost:3000/packing`
- Order status transitions with state machine validation: PENDING → PACKING → FINISHED
- CANCELLED status with inventory restore
- Inventory deduction on PACKING (atomic Prisma transaction) with negative stock guard
- Order categorization with proper enums: `ONE_ITEM`, `TWO_ITEMS`, `THREE_PLUS`, `MIXED`
- Category section grouping on all three tabs (TO PACK / PACKING / DONE)
- Ship Today / Ship Tomorrow logic (noon cutoff, Bangkok timezone)
- Concurrency protection (employee locking on orders)
- **Batch packing:** Long-press to enter select mode → select multiple orders → summary modal → batch update
- Packing summary modal showing aggregated quantities per SKU before confirming
- 5-second polling for real-time updates
- Seeded data: 6 toppings × 2 variants + 4 sample orders

### Backend Structure (current)
```
backend/src/
├── index.ts                    ← App bootstrap, middleware setup, route mounting
├── lib/
│   ├── prisma.ts               ← Singleton PrismaClient (always import from here)
│   └── logger.ts               ← pino + pino-http logger
├── routes/
│   ├── order-routes.ts         ← All /api/orders/* routes (batch BEFORE /:id!)
│   └── product-routes.ts       ← All /api/products/* routes
├── middleware/
│   ├── validate.ts             ← Zod validation middleware
│   └── error-handler.ts        ← AppError class + centralized error handler
├── services/
│   └── order-service.ts        ← All business logic
└── utils/
    └── order-utils.ts          ← getShipByDate (Bangkok TZ), getOrderCategory
```

### Frontend Structure (current)
```
frontend/src/
├── app/packing/page.tsx        ← Main dashboard (category sections + select mode)
├── components/packing/
│   ├── OrderCard.tsx           ← Long-press, select, status buttons
│   ├── SelectionBar.tsx        ← Sticky bottom bar when orders selected
│   ├── PackingSummaryModal.tsx ← Aggregated quantity summary before batch pack
│   ├── FilterBar.tsx           ← Status/search/urgency filters
│   ├── StockTicker.tsx         ← Scrolling stock level display
│   ├── LoginScreen.tsx         ← Employee name entry
│   └── ToastContainer.tsx      ← Toast notifications
├── hooks/
│   ├── useOrders.ts            ← Orders + products + batchUpdateStatus
│   └── useAuth.ts              ← Employee name state
└── types/index.ts              ← Shared TypeScript types
```

### API Endpoints (current)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders?page=1&limit=50` | **Paginated orders** with metadata |
| GET | `/api/orders/:id` | Single order |
| POST | `/api/orders` | **Create order** (manual entry/integration) |
| PATCH | `/api/orders/batch/status` | Batch status update |
| PATCH | `/api/orders/:id/status` | Single order status update |
| GET | `/api/products` | All products with variants and stock |
| GET | `/api/health` | Health check |

### What Does NOT Exist Yet
- No Shopee, TikTok Shop, or Line OA API integration (Phase 2)
- No frontend pages beyond the packing dashboard (home page is Next.js boilerplate)
- No authentication or authorization (just name-based employee tracking)
- No tests (unit or integration)
- No webhook receivers for platform order push notifications

---

## 3. Remaining Issues for Gemini to Address

### HIGH PRIORITY

**A. Add pagination to `GET /api/orders`**
Currently fetches ALL orders in a single query. Will degrade as orders accumulate.
```
File: backend/src/routes/order-routes.ts
Suggested: ?page=1&limit=20 with {data, total, page, totalPages} response
```

**B. Fix `seed.ts` still uses `new PrismaClient()` directly**
Should import from `src/lib/prisma.ts` for consistency.
```
File: backend/prisma/seed.ts
```

**C. CORS whitelist**
Currently `app.use(cors())` allows ALL origins. Restrict to frontend origin in production.
```
File: backend/src/index.ts
```

### MEDIUM PRIORITY

**D. Add `POST /api/orders` route**
`OrderService.createOrder()` exists but has no route. Needed for platform integrations and manual order entry.

**E. Frontend home page (`/`) is still boilerplate**
`frontend/src/app/page.tsx` is the default Next.js template. Replace with redirect to `/packing` or a nav page.

**F. Add backend `.env.example`**
Frontend has `.env.example` but backend does not. Add one:
```
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/oms_db?schema=public
PORT=3001
```

**G. OrderItem → ProductVariant uses `onDelete: Restrict`**
This is intentional (preserves order history), but note: you cannot delete a ProductVariant that has associated OrderItems. Use Prisma Studio to manually clean up if needed during development.

### LOW PRIORITY

**H. No tests**
Zero test coverage. Recommend adding:
- Unit tests for `OrderService.updateOrderStatus()` state machine
- Integration test for `PATCH /api/orders/batch/status` partial failure case
- Frontend: test the `computeSummary()` aggregation in PackingSummaryModal

---

## 4. Phase 2 Integration Readiness

The schema is ready for platform integrations:

### ChannelProduct table
Maps a platform SKU string to an internal `ProductVariant`:
```prisma
model ChannelProduct {
  channel          OrderChannel  // SHOPEE | TIKTOK | LINE
  channelSku       String        // SKU string from the platform API
  productVariantId String        // Maps to our internal ProductVariant
  @@unique([channel, channelSku])
}
```

### OrderService.createOrder()
Ready to receive data from platform webhooks:
- `upsert` on `channelOrderId` (idempotent — safe to call twice for same order)
- Auto-assigns `category` and `shipByDate`
- Accepts `channel: OrderChannel`

### Recommended integration pattern (per platform)
1. Create `backend/src/integrations/shopee.ts` (or tiktok, line)
2. Implement OAuth + order fetch / webhook handler
3. Map platform order items: `platformSku → ChannelProduct → ProductVariant.id`
4. Call `OrderService.createOrder()` with mapped data
5. Set `syncStatus = 'SYNCED'` on success, `'FAILED'` on error

---

## 5. Architecture Quick Reference

```
OMS-Project/
├── backend/
│   ├── src/
│   │   ├── index.ts              ← Express app + middleware setup
│   │   ├── lib/prisma.ts         ← Singleton DB client (always import from here)
│   │   ├── lib/logger.ts         ← pino logger
│   │   ├── routes/
│   │   │   ├── order-routes.ts   ← /api/orders/* (batch route FIRST)
│   │   │   └── product-routes.ts ← /api/products/*
│   │   ├── middleware/
│   │   │   ├── validate.ts       ← Zod request validation
│   │   │   └── error-handler.ts  ← Centralized error handling
│   │   ├── services/
│   │   │   └── order-service.ts  ← createOrder, updateOrderStatus
│   │   └── utils/
│   │       └── order-utils.ts    ← getShipByDate (Bangkok TZ), getOrderCategory
│   └── prisma/
│       ├── schema.prisma         ← DB schema source of truth (uses enums)
│       └── seed.ts               ← 6 toppings + 4 sample orders
├── frontend/
│   └── src/
│       ├── app/packing/page.tsx       ← Main packing dashboard
│       └── components/packing/        ← OrderCard, SelectionBar, PackingSummaryModal, etc.
├── docker-compose.yml            ← PostgreSQL 15 on port 5432
├── CLAUDE.md                     ← Context for Claude Code sessions
├── decision_log.md               ← Gemini's original decisions (#1–#7)
├── decision_log_claude.md        ← Claude's decisions (#8–#27)
└── PROJECT_REVIEW_FOR_GEMINI.md  ← This file
```

**Data model core concept:**
- `Product` = physical stock (e.g. Popping Boba Barley, 500 units)
- `ProductVariant` = sellable SKU (1-pack deducts 1, 3-pack deducts 3 from `Product.baseStock`)
- Deduction formula: `quantity × packSize` applied atomically when order moves to `PACKING`
- Category enum: `ONE_ITEM` / `TWO_ITEMS` / `THREE_PLUS` / `MIXED` — Prisma serializes the key name, NOT any `@map` value

**Critical enum warning:**
Prisma enums serialize as the TypeScript key name in JSON (e.g. `"ONE_ITEM"`), not the `@map` DB value. If you add `@map` to enum values, the frontend will receive the key name but the DB stores the mapped value — causing a silent mismatch. Keep enum key names and DB values identical (no `@map`) unless you know what you're doing.

---

## 6. Commands to Resume Development

```bash
# Start everything from scratch
docker compose up -d                    # start DB
cd backend && npm run dev               # start backend :3001
cd frontend && npm run dev              # start frontend :3000

# After any schema.prisma change
cd backend && npx prisma db push

# Re-seed (safe for products; will fail on duplicate orders — that's OK)
cd backend && npx prisma db seed

# Check DB visually
cd backend && npx prisma studio

# If schema change involves converting String→Enum (DESTRUCTIVE — wipes data)
cd backend && npx prisma db push --force-reset
cd backend && npx prisma db seed
```
