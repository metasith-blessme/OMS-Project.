# OMS Project Review & Handoff — For Gemini

**Last updated:** 2026-04-07 by Claude Code (claude-sonnet-4-6)

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

### Session 4 (2026-04-07) — Phase 2: Shopee CSV Import + Line OA (Claude)

| # | Feature | Status |
|---|---|---|
| 28 | Shopee API abandoned → CSV upload from Seller Center | ✅ Done |
| 29 | CSV parser: Thai + English header normalization | ✅ Done |
| 30 | CSV parser: multi-row grouping by Order ID | ✅ Done |
| 31 | `POST /api/integrations/shopee/upload` endpoint (multer + partial results) | ✅ Done |
| 32 | `ImportCsvModal.tsx` — drag/drop, upload, result summary | ✅ Done |
| 33 | FilterBar: replaced SYNC SHOPEE with CSV + NEW ORDER buttons | ✅ Done |
| 34 | `NewOrderModal.tsx` — manual LINE/TikTok order entry form | ✅ Done |
| 35 | `POST /api/integrations/line/webhook` — HMAC validation, slip matching | ✅ Done |
| 36 | `backend/src/integrations/line.ts` — LineService + Thai auto-reply | ✅ Done |
| 37 | `express.json()` bypass for Line webhook (raw body for HMAC) | ✅ Done |
| 38 | DB: `slipReceived`, `slipReceivedAt`, `lineUserId` fields on `Order` | ✅ Done |
| 39 | OrderCard: AWAITING SLIP / SLIP ✓ badges for LINE orders | ✅ Done |
| 40 | `useOrders`: `importShopeeCSV()` + `createOrder()` hook functions | ✅ Done |
| 41 | CLAUDE.md + decision_log_Claude.md + this file updated | ✅ Done |

---

## 2. Current Project State (as of 2026-04-07)

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
- **Shopee CSV import:** Upload Packing List CSV → auto-parse → create orders (handles Thai + English headers)
- **Manual order entry:** "+ ORDER" button → form to create LINE/TikTok orders with items
- **Line OA slip webhook:** Receives slip images, marks matching order `slipReceived=true`, Thai auto-reply
- **SLIP badges:** LINE order cards show "AWAITING SLIP" (pulse) or "SLIP ✓" (static)
- Seeded data: 6 toppings × 2 variants + 4 sample orders

### Backend Structure (current)
```
backend/src/
├── index.ts                      ← App bootstrap, middleware (Line webhook bypasses express.json)
├── lib/
│   ├── prisma.ts                 ← Singleton PrismaClient (always import from here)
│   └── logger.ts                 ← pino + pino-http logger
├── routes/
│   ├── order-routes.ts           ← All /api/orders/* routes (batch BEFORE /:id!)
│   ├── product-routes.ts         ← All /api/products/* routes
│   └── integration-routes.ts     ← POST /shopee/upload + POST /line/webhook
├── integrations/
│   ├── shopee-csv.ts             ← CSV parser (Thai/English headers, multi-row grouping)
│   ├── shopee.ts                 ← Legacy API-based ShopeeService (unused, kept for reference)
│   └── line.ts                   ← LineService (HMAC validation, slip matching, reply)
├── middleware/
│   ├── validate.ts               ← Zod validation middleware
│   └── error-handler.ts          ← AppError class + centralized error handler
├── services/
│   └── order-service.ts          ← createOrder, updateOrderStatus
└── utils/
    └── order-utils.ts            ← getShipByDate (Bangkok TZ), getOrderCategory
```

### Frontend Structure (current)
```
frontend/src/
├── app/packing/page.tsx          ← Main dashboard
├── components/packing/
│   ├── OrderCard.tsx             ← Long-press, select, status buttons, SLIP badges
│   ├── SelectionBar.tsx          ← Sticky bottom bar when orders selected
│   ├── PackingSummaryModal.tsx   ← Aggregated quantity summary before batch pack
│   ├── ImportCsvModal.tsx        ← CSV file picker, upload, result summary (NEW)
│   ├── NewOrderModal.tsx         ← Manual LINE/TikTok order entry form (NEW)
│   ├── FilterBar.tsx             ← Status/search/urgency filters + CSV + NEW ORDER buttons
│   ├── StockTicker.tsx           ← Scrolling stock level display
│   ├── LoginScreen.tsx           ← Employee name entry
│   └── ToastContainer.tsx        ← Toast notifications
├── hooks/
│   ├── useOrders.ts              ← Orders + products + batchUpdateStatus + importShopeeCSV + createOrder
│   └── useAuth.ts                ← Employee name state
└── types/index.ts                ← Shared types incl. CreateOrderPayload, ImportResult
```

### API Endpoints (current)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + DB connectivity |
| GET | `/api/orders?page=1&limit=50` | Paginated orders |
| GET | `/api/orders/:id` | Single order |
| POST | `/api/orders` | Create order (manual entry) |
| PATCH | `/api/orders/batch/status` | Batch status update |
| PATCH | `/api/orders/:id/status` | Single order status update |
| GET | `/api/products` | All products with variants and stock |
| POST | `/api/integrations/shopee/upload` | Upload Shopee Packing List CSV |
| POST | `/api/integrations/line/webhook` | Line Messaging API webhook (raw body) |

### What Does NOT Exist Yet
- No Line OA credentials in `.env` yet (needs LINE Developers Console setup)
- No Shopee SKU mappings in `ChannelProduct` table (CSV import will error until seeded)
- No TikTok Shop integration
- No inventory management page (Phase 3)
- No analytics/reporting page (Phase 3)
- No webhooks / stock sync back to platforms (Phase 4)
- No frontend pages beyond packing dashboard
- No authentication/authorization (name-based employee tracking only)
- No tests

---

## 3. What Gemini Should Work On Next

### MUST DO BEFORE LINE OA GOES LIVE

**A. LINE Developers Console setup (Parn does this, not code)**
1. Go to developers.line.biz → create Messaging API channel on existing OA
2. Get Channel Secret + Channel Access Token
3. Add to `backend/.env`:
   ```
   LINE_CHANNEL_SECRET=xxx
   LINE_CHANNEL_ACCESS_TOKEN=xxx
   ```
4. Deploy backend, set webhook URL: `https://your-domain/api/integrations/line/webhook`
5. Disable auto-reply in LINE console

**B. Seed ChannelProduct table for Shopee SKU mapping**
CSV import currently errors for every row because `ChannelProduct` is empty. You must insert rows mapping Shopee SKUs to internal `ProductVariant` IDs before the CSV upload is usable:
```sql
-- Example (use Prisma Studio or a seed script)
INSERT INTO "ChannelProduct" (id, "productVariantId", channel, "channelSku", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '<productVariantId>', 'SHOPEE', '<shopee_sku>', now(), now());
```
Or create a Prisma seed script that inserts the real SKU mappings.

### MEDIUM PRIORITY

**C. CORS whitelist**
`app.use(cors())` allows all origins. Restrict to frontend URL in production:
```typescript
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
```
File: `backend/src/index.ts`

**D. Frontend home page (`/`) is still boilerplate**
`frontend/src/app/page.tsx` is the default Next.js template. Replace with redirect to `/packing`.

**E. No tests**
Recommend unit tests for `OrderService.updateOrderStatus()` state machine transitions.

---

## 4. Key Architectural Decisions Gemini Should Know

1. **Line webhook uses raw body** — the `express.json()` bypass in `index.ts` is intentional and critical. Do not remove it or re-order middleware. See decision #33.

2. **Shopee API is abandoned** — `integrations/shopee.ts` is kept but not wired up. The CSV upload approach replaces it. Do not re-enable the old API routes unless Parn gets actual API credentials.

3. **CSV import returns 200 with partial results** — even if some rows fail, the endpoint returns 200. Errors are in the `errors[]` array in the response body, not in HTTP status code.

4. **slipReceived matching is fuzzy** — the Line webhook tries to match a PENDING LINE order by `lineUserId`, falling back to the most recent PENDING LINE order with no userId. This works for sequential orders but is ambiguous for simultaneous orders. This is intentional — admin resolves manually via the SLIP badge.

---

## 5. Architecture Quick Reference

```
OMS-Project/
├── backend/
│   ├── src/
│   │   ├── index.ts                   ← Express setup (Line webhook bypasses express.json)
│   │   ├── lib/prisma.ts              ← Singleton DB client
│   │   ├── lib/logger.ts              ← pino logger
│   │   ├── routes/
│   │   │   ├── order-routes.ts        ← /api/orders/*
│   │   │   ├── product-routes.ts      ← /api/products/*
│   │   │   └── integration-routes.ts  ← /shopee/upload + /line/webhook
│   │   ├── integrations/
│   │   │   ├── shopee-csv.ts          ← CSV parser
│   │   │   ├── shopee.ts              ← Legacy (unused)
│   │   │   └── line.ts                ← Line slip handler
│   │   ├── middleware/
│   │   │   ├── validate.ts
│   │   │   └── error-handler.ts
│   │   ├── services/order-service.ts  ← All business logic
│   │   └── utils/order-utils.ts
│   └── prisma/
│       ├── schema.prisma              ← Source of truth
│       └── seed.ts
├── frontend/src/
│   ├── app/packing/page.tsx
│   ├── components/packing/            ← All packing UI components
│   ├── hooks/useOrders.ts
│   └── types/index.ts
├── docker-compose.yml
├── CLAUDE.md
├── decision_log.md                    ← Gemini decisions #1–#7
├── decision_log_claude.md             ← Claude decisions #8–#40
└── PROJECT_REVIEW_FOR_GEMINI.md       ← This file
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

# Test CSV upload manually
curl -F "file=@/path/to/packing_list.csv" http://localhost:3001/api/integrations/shopee/upload

# Test Line webhook locally (use ngrok to expose localhost)
ngrok http 3001
# Then set https://<ngrok-id>.ngrok.io/api/integrations/line/webhook in LINE console
```
