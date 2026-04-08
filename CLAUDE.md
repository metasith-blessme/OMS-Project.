# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Production Deployment (live as of 2026-04-08)

| Layer | Service | URL |
|---|---|---|
| Database | Neon (Postgres, Singapore region) | `ep-broad-rice-a1jrv0ed.ap-southeast-1.aws.neon.tech/neondb` |
| Backend | Render (free tier, Singapore) | https://oms-project-hnjf.onrender.com |
| Frontend | Vercel | (see Vercel dashboard) |
| Repo | GitHub | `github.com/metasith-blessme/OMS-Project.` (trailing dot in name!) |

**Render free tier caveat:** backend sleeps after 15 min idle. First request after sleep takes ~30–60s to wake.

**Deployment config lives in `render.yaml`** (project root). Env vars marked `sync: false` must be set manually in the Render dashboard: `DATABASE_URL`, `API_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`.

**Vercel env vars required:** `NEXT_PUBLIC_API_URL` (Render backend URL) and `NEXT_PUBLIC_API_TOKEN` (must match backend `API_TOKEN`).

**Deploy flow:** push to `main` → Render and Vercel both auto-deploy from GitHub.

## Running the Project Locally

All three components must be running together:

```bash
# 1. Database (PostgreSQL via Docker) — run from project root
docker compose up -d

# 2. Backend (port 3001) — run from /backend
npm run dev

# 3. Frontend (port 3000) — run from /frontend
npm run dev
```

**Packing dashboard:** http://localhost:3000/packing

### First-time setup

```bash
# Backend
cd backend
npm install
npx prisma db push        # apply schema to DB
npx prisma db seed        # seed 6 toppings + 4 sample orders

# Frontend
cd frontend
npm install
```

### Schema changes

```bash
npx prisma db push               # apply after editing schema.prisma
npx prisma db push --force-reset # WIPE DB + reapply (use when changing String → Enum)
npx prisma db seed               # re-seed after a reset
npx prisma studio                # GUI DB browser at localhost:5555
npm run build                    # compile TypeScript to dist/
```

> ⚠️ Converting `String` fields to Prisma `enum` types requires `--force-reset` because PostgreSQL cannot cast varchar → enum with existing data. All seed data will be lost and must be re-seeded.

## Architecture

### Data model (the key insight)

`Product` = physical raw material stock (e.g. "Popping Boba Barley", 500 units).
`ProductVariant` = sellable SKU with a `packSize` multiplier (1-pack deducts 1, 3-pack deducts 3).
When an order moves to `PACKING`, inventory is deducted: `quantity × packSize` from `Product.baseStock`.

All schema is in `backend/prisma/schema.prisma`. After editing it, run `npx prisma db push`.

### Prisma Enums (as of 2026-03-31)

All previously free-text fields are now strongly typed enums:
- `OrderStatus`: `PENDING | PACKING | FINISHED | CANCELLED`
- `OrderChannel`: `SHOPEE | TIKTOK | LINE`
- `OrderCategory`: `ONE_ITEM | TWO_ITEMS | THREE_PLUS | MIXED`
- `SyncStatus`: `SYNCED | PENDING_SYNC | FAILED`

### Request flow

```
Frontend (Next.js :3000)
  └─ fetch() calls
       └─ Backend API (Express :3001)
            └─ routes/ (order-routes.ts, product-routes.ts)
                 └─ OrderService (src/services/order-service.ts)
                      └─ Prisma (src/lib/prisma.ts singleton)
                           └─ PostgreSQL (:5432 Docker)
```

### Order lifecycle

```
PENDING → PACKING (locks to employee, deducts inventory)
        → FINISHED
        → CANCELLED (restores inventory)
PACKING → FINISHED
        → PENDING (restores inventory — "undo")
        → CANCELLED (restores inventory)
FINISHED → PACKING (reopen — no inventory change)
         → PENDING (restores inventory)
```

State transitions are validated via `VALID_TRANSITIONS` map in `order-service.ts`. The backend rejects invalid transitions with HTTP 409.

### Order categories (auto-assigned on creation)

`ONE_ITEM` — 1 unique SKU, 1 unit
`TWO_ITEMS` — 1 unique SKU, 2 units
`THREE_PLUS` — 1 unique SKU, 3+ units
`MIXED` — order contains more than one distinct SKU

### Key files

| File | Purpose |
|---|---|
| `backend/src/index.ts` | Express app setup, middleware, graceful shutdown. Line webhook excluded from express.json() (raw body needed for HMAC) |
| `backend/src/routes/order-routes.ts` | Order endpoints incl. batch status update |
| `backend/src/routes/product-routes.ts` | Product + stock endpoints |
| `backend/src/routes/integration-routes.ts` | `POST /shopee/upload` (CSV import) + `POST /line/webhook` (slip confirmation) |
| `backend/src/integrations/shopee-csv.ts` | Shopee packing list CSV parser — normalizes Thai + English headers, groups rows by order ID |
| `backend/src/integrations/shopee.ts` | Legacy ShopeeService (API-based, not used in production — kept for reference) |
| `backend/src/integrations/line.ts` | Line webhook handler — HMAC validation, slip image matching, Thai auto-reply |
| `backend/src/middleware/error-handler.ts` | Centralized error handling |
| `backend/src/middleware/validate.ts` | Zod request validation middleware |
| `backend/src/lib/logger.ts` | pino HTTP request logger |
| `backend/src/services/order-service.ts` | `createOrder`, `updateOrderStatus` — all business logic |
| `backend/src/utils/order-utils.ts` | `getShipByDate` (Asia/Bangkok noon cutoff), `getOrderCategory` |
| `backend/src/lib/prisma.ts` | Shared PrismaClient singleton — always import from here |
| `backend/prisma/schema.prisma` | Source of truth for all DB models |
| `backend/prisma/seed.ts` | Seeds 6 toppings × 2 variants + 4 sample orders |
| `frontend/src/app/packing/page.tsx` | Main packing dashboard |
| `frontend/src/hooks/useOrders.ts` | Data fetching, 5s polling, status updates, batch update, `importShopeeCSV`, `createOrder` |
| `frontend/src/hooks/useAuth.ts` | Employee login/logout via localStorage |
| `frontend/src/components/packing/` | OrderCard, StockTicker, FilterBar, LoginScreen, ToastContainer, SelectionBar, PackingSummaryModal, ImportCsvModal, NewOrderModal |
| `frontend/src/types/index.ts` | Shared TypeScript types incl. `CreateOrderPayload`, `ImportResult` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` — backend URL for frontend fetch calls |

## Important Constraints

- **Always import Prisma from `src/lib/prisma.ts`** — never `new PrismaClient()` directly. The singleton prevents connection pool exhaustion.
- **Valid order statuses:** `PENDING`, `PACKING`, `FINISHED`, `CANCELLED`. Use `OrderStatus` enum from `@prisma/client`.
- **Inventory deduction happens at `PACKING` transition**, not at order creation. Rollback is handled by Prisma `$transaction`.
- **Inventory restoration happens on revert to `PENDING` or `CANCELLED`.**
- **Negative stock is prevented:** `updateOrderStatus` throws if `baseStock < totalDeduction`.
- **Timezone:** Ship-by date logic always uses `Asia/Bangkok` (UTC+7). Do not use server local time.
- **Schema changes** require `npx prisma db push`. String→Enum changes require `--force-reset`.
- **`seed.ts` uses `upsert`** for products (safe to re-run), but sample orders will fail on duplicate `channelOrderId`. Use `--force-reset` first if re-seeding.
- **Batch route must be declared BEFORE `/:id/status`** in `order-routes.ts` — Express would match "batch" as the `:id` param otherwise.
- **Line webhook must use `express.raw()`** — the global `express.json()` in `index.ts` is bypassed for `/api/integrations/line/webhook` so that HMAC-SHA256 signature validation can read the raw body. Do not remove this bypass.
- **Shopee CSV SKU resolution** requires rows in the `ChannelProduct` table (`channel='SHOPEE'`, `channelSku=<sku from CSV>`). Without mappings, every row will error. Seed this table before using CSV import in production.
- **Line slip matching** uses `lineUserId` on the `Order` model. First match: PENDING LINE order with same `lineUserId`. Fallback: most recent PENDING LINE order with `lineUserId = null`. Admin should create the LINE order before the customer sends a slip.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check + DB connectivity |
| GET | `/api/products` | All products with variants |
| GET | `/api/orders?page=1&limit=50` | Paginated orders (non-FINISHED + FINISHED last 7 days) |
| POST | `/api/orders` | Create a single order manually |
| PATCH | `/api/orders/batch/status` | Batch status update for multiple orders |
| PATCH | `/api/orders/:id/status` | Single order status update |
| POST | `/api/integrations/shopee/upload` | Upload Shopee Packing List CSV (multipart, field name: `file`) |
| POST | `/api/integrations/line/webhook` | Line Messaging API webhook (raw body, validates X-Line-Signature) |

## Environment Variables

### Backend (`backend/.env` local, Render dashboard in prod)
```
DATABASE_URL=postgresql://...       # local: Docker Postgres; prod: Neon pooler URL
PORT=3001                           # Render sets its own PORT automatically
API_TOKEN=...                       # static bearer token; must match frontend
LINE_CHANNEL_SECRET=                # from LINE Developers Console
LINE_CHANNEL_ACCESS_TOKEN=          # from LINE Developers Console
```

### Frontend (`frontend/.env.local` local, Vercel dashboard in prod)
```
NEXT_PUBLIC_API_URL=http://localhost:3001       # prod: Render URL
NEXT_PUBLIC_API_TOKEN=...                       # must match backend API_TOKEN
```

## Build Config Notes

- **`backend/tsconfig.json`** — `rootDir` is `./src` (not `.`), so `tsc` emits `dist/index.js` directly. If you re-include `prisma/` in `include`, tsc will nest output under `dist/src/` and break `npm start` in production.
- **`backend/package.json`** — has `postinstall: prisma generate` so Render/Vercel regenerate the Prisma client on deploy without a custom build step.
- **`render.yaml`** — project-root blueprint; edit this (not the Render UI) for reproducible service config.

## Phase Status

- **Phase 1 (done):** DB schema, backend scaffold, packing dashboard, inventory deduction, concurrency lock
- **Phase 1.5 (done):** Code review fixes — enums, indexes, Zod validation, route extraction, error middleware, pagination, toast notifications, component refactor, batch packing, category sections
- **Phase 2 (done):** Shopee CSV + PDF import, Line OA slip confirmation webhook, manual order entry modal, order delete (soft CANCEL), stock edit on ticker, bearer auth, Vitest unit tests
- **Phase 2.5 (done, 2026-04-08):** Production deployment — Neon (DB) + Render (backend) + Vercel (frontend). See "Production Deployment" section above.
- **Phase 2 pending activation:** LINE webhook URL still needs to be pointed at `https://oms-project-hnjf.onrender.com/api/integrations/line/webhook` in LINE console and tested with a real slip. Shopee CSV needs `ChannelProduct` SKU mappings seeded in Neon.
- **Phase 3 (pending):** Inventory management page, analytics/reporting page
- **Phase 4 (pending):** Webhooks, stock sync back to platforms
