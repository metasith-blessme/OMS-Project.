# Project Review & Handoff — For Claude

This document serves as a bridge for the next agent session.

## Latest Updates (2026-03-31)

### 1. Hardening (Phase 1.5)
- **Pagination:** Dashboard now supports pagination (50/page). UI controls added.
- **Manual API:** `POST /api/orders` is live with Zod validation.
- **Seed Fix:** `seed.ts` updated to use the Prisma singleton.
- **Environment:** Added `backend/.env.example`.

### 2. Shopee Integration (Phase 2 - In Progress)
- **Status:** Infrastructure is 90% complete.
- **Files Created:**
  - `backend/src/integrations/shopee.ts`: Handles signing, OAuth, and syncing.
  - `backend/src/routes/integration-routes.ts`: Callback and manual sync endpoints.
- **Database:** `ShopCredentials` table added for tokens. `ChannelProduct` mappings seeded for testing (Prefix: `SHP-`).
- **Frontend:** "SYNC SHOPEE" button added to `FilterBar`.

### 3. Missing Links
- **Credentials:** `SHOPEE_PARTNER_ID` and `SHOPEE_PARTNER_KEY` are needed in `.env`.
- **Authorization:** Need to generate the redirect URL for the first-time shop link.

## API Table
| Method | Path | Description |
|---|---|---|
| GET | `/api/orders?page=1&limit=50` | Paginated orders |
| POST | `/api/orders` | Create order (manual/testing) |
| POST | `/api/integrations/sync/:shopId` | Trigger Shopee sync |
| GET | `/api/integrations/shopee/callback` | Shopee OAuth return |

## Technical Note
Shopee signature logic: `hmac_sha256(PARTNER_KEY, partner_id + path + timestamp + [access_token] + [shop_id])`.
Access tokens expire in 4 hours; `ShopeeService` has auto-refresh logic in `syncOrders`.
