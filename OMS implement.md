# OMS Implementation Status

## Background & Motivation
The objective is to build a centralized Order Management System (OMS) to retrieve and manage order, sales, and inventory data from three platforms: Shopee, TikTok Shop, and Line OA. The business currently manages 6 specific toppings:
- Popping boba barley
- Popping boba red bean
- Popping boba oat
- Popping boba sticky rice
- Popping boba sweet osmanthus
- Popping boba chestnut

**Important Business Logic:**
Each topping SKU has variants: a 1-pack and a 3-pack. When an order is placed, the system must deduct the correct amount (1 or 3) from the central, shared raw material stock for that topping.

## Architecture
- **Backend:** Node.js with TypeScript, Express, and Prisma ORM.
- **Frontend:** Next.js (React) with Tailwind CSS.
- **Database:** PostgreSQL running locally via Docker Compose.

## Progress So Far

### Phase 1: Setup and Data Modeling (COMPLETED)
- [x] Initialized Next.js frontend (`frontend/`).
- [x] Initialized Node.js backend (`backend/`).
- [x] Configured PostgreSQL database via `docker-compose.yml` and successfully started it.
- [x] Set up Prisma ORM and defined the database schema handling physical stock vs sellable variants.
- [x] Seeded the database with initial products: 6 base raw material stocks (500 units each) and their respective 1-pack and 3-pack product variants.

### Phase 2: Platform Integrations (NEXT STEPS)
- [ ] Implement Shopee API client (OAuth, fetch orders, update stock).
- [ ] Implement TikTok Shop API client.
- [ ] Implement Line OA / Line Shopping integration.

### Phase 3: Order Synchronization & Inventory
- [ ] Webhook handling to deduct central inventory when an order arrives from any channel.
- [ ] Push updated stock counts back to platforms.

### Phase 4: Frontend Dashboard
- [ ] Develop Sales Dashboard (Daily/Weekly sales per topping).
- [ ] Develop Inventory Dashboard (Current stock levels, low-stock alerts).
- [ ] Connect frontend to backend APIs.

## Database Schema Highlights
- `Product`: Represents the physical stock/raw material.
- `ProductVariant`: Represents the sellable SKU (e.g., 1-pack, 3-pack) linked to a base `Product` with a `packSize` multiplier.
- `ChannelProduct`: Maps a platform-specific SKU to a central `ProductVariant`.
- `Order` & `OrderItem`: Tracks incoming orders and the variants purchased.
- `InventoryLog`: Keeps a history of all stock movements.
