# Decision Log

This document records the key architectural and design decisions for the Order Management System (OMS) project.

## 1. Tech Stack Selection
**Date:** 2026-03-30
**Decision:**
- **Backend:** Node.js with TypeScript and Express.
- **Frontend:** Next.js (React) with Tailwind CSS and TypeScript.
- **Database:** PostgreSQL managed via Prisma ORM.
- **Infrastructure:** Local development using Docker Compose for the database.
**Rationale:** This stack provides strong typing (TypeScript), ease of database management (Prisma), and a modern, scalable frontend framework (Next.js).

## 2. Inventory Data Model
**Date:** 2026-03-30
**Decision:** Decoupled physical stock (`Product`) from sellable SKUs (`ProductVariant`).
- `Product`: Represents the central raw material (e.g., Popping Boba Barley).
- `ProductVariant`: Represents the pack size sold on platforms (e.g., 1-pack or 3-pack).
- `packSize`: A multiplier attribute in `ProductVariant` to determine how many units of the base `Product` are deducted per sale.
**Rationale:** This allows multiple platform listings (1-pack, 3-pack) to draw from a single, shared physical stock pool, ensuring accurate inventory levels across all sales channels.

## 3. Multi-Channel Integration Strategy
**Date:** 2026-03-30
**Decision:** Plan to integrate Shopee, TikTok Shop, and Line OA.
- Use `ChannelProduct` to map platform-specific SKUs to internal `ProductVariant` IDs.
- Implement platform-specific API clients for fetching orders and updating stock.
**Rationale:** To centralize data from the three primary sales channels used by the business.

## 7. Packing Workflow & Concurrency Protection
**Date:** 2026-03-30
**Decision:** Implemented a structured workflow (`PENDING` -> `PACKING` -> `FINISHED`) with employee assignment.
- **Locking Mechanism:** When an order is moved to `PACKING`, it is assigned an employee name.
- **Collision Prevention:** The backend rejects status updates if another employee tries to pack an order already in the `PACKING` state.
- **Tracking:** Added `packedBy`, `packedAt`, and `finishedAt` for operational transparency.
**Rationale:** To prevent multiple employees from accidentally packing the same order and to organize the warehouse floor efficiently.

## 16. Inventory Reversal Logic
**Date:** 2026-03-30
**Decision:** Added the ability to revert orders from `PACKING` or `FINISHED` back to `PENDING`.
- **Logic:** When an order is moved back to `PENDING`, the system automatically increments the `baseStock` of the associated `Product` by the same amount that was originally deducted.
- **Audit:** A new `InventoryLog` entry is created with the reason `ORDER_STATUS_REVERTED_TO_PENDING`.
**Rationale:** To handle team errors where a status change was made prematurely or by mistake, without losing track of inventory.

## 17. Finished Order Retention Policy (7-Day Cleanup)
**Date:** 2026-03-30
**Decision:** The dashboard only fetches `FINISHED` orders that were completed within the last 7 days.
- **Implementation:** Added a `finishedAt { gte: sevenDaysAgo }` filter to the `GET /api/orders` backend route.
**Rationale:** To maintain dashboard performance and UI cleanliness. Older orders are still in the database for history but are not active "packing" tasks.

## 18. Session-less Employee Authentication
**Date:** 2026-03-30
**Decision:** Implemented a manual-entry login screen that stores the employee's name in `localStorage`.
**Rationale:** Provides accountability for status changes (who packed what) without the overhead of a full database-backed user/password system.

## 19. Mobile-First & iPhone Optimization
**Date:** 2026-03-30
**Decision:** Optimized the UI specifically for iPhone warehouse use.
- **Units:** Used `svh` (small viewport height) for the login screen to handle the iOS Safari keyboard.
- **Touch Targets:** Increased button height to 56px+ for thumb-friendly interaction.
- **Safe Areas:** Implemented safe-area-inset handling for the notch and home indicator.
**Rationale:** Recognizes that the primary hardware for the packing team will be mobile devices and tablets.

## 20. Real-time Stock Visibility (Ticker)
**Date:** 2026-03-30
**Decision:** Added a horizontally-scrolling ticker at the top of the dashboard showing live stock levels for all products.
**Rationale:** Allows the packing team to monitor raw material levels in real-time, enabling proactive stock replenishment.
