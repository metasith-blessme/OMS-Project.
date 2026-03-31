# Order Management System (OMS) Project

## Project Overview
This project is a centralized Order Management System (OMS) designed to retrieve and manage order, sales, and inventory data from three platforms: Shopee, TikTok Shop, and Line OA. 

The system specifically manages inventory for 6 popping boba toppings (barley, red bean, oat, sticky rice, sweet osmanthus, chestnut). 

**Key Business Logic:** Each topping SKU has variants (a 1-pack and a 3-pack). When an order is placed on any platform, the system correctly deducts the proportional amount (1 or 3) from a central, shared raw material stock for that topping.

**Key Features:**
*   **Centralized Inventory:** Real-time stock deduction and restoration from shared raw material pools.
*   **Live Stock Monitoring:** A real-time stock ticker with low-stock visual alerts (<50 units).
*   **Packing Dashboard:** Automatically categorizes orders into "1 Item", "2 Items", "3+ Items", and "Mixed" to minimize packing errors and speed up shipping.
*   **Mobile-First Design:** Optimized for iPhone and mobile warehouse use with large touch targets and responsive layouts.
*   **Same-Day Shipping Logic:** Automatically identifies "Ship Today" orders based on a 12:00 PM cutoff to ensure platform SLA compliance.
*   **Team Collaboration:** 
    *   **Employee Login:** Manual name-entry login to track packing responsibility.
    *   **Concurrency Lock:** Real-time order status tracking (`TO PACK`, `PACKING`, `DONE`) with a locking mechanism.
    *   **Reversion & Undo:** Ability to move orders back to `PENDING` with automatic inventory restoration.
*   **UX Features:** Dark/Light mode support, instant search/scan, and haptic/sound feedback on task completion.
*   **Automated Cleanup:** Completed orders automatically disappear from the dashboard after 7 days to maintain performance.


## Architecture & Tech Stack
*   **Backend:** Node.js with TypeScript, Express framework, and Prisma ORM.
*   **Frontend:** Next.js (React 19) with Tailwind CSS v4 and TypeScript.
*   **Database:** PostgreSQL (running locally via Docker).

## Directory Structure
*   `/backend`: Contains the Node.js API server, Prisma schema (`prisma/schema.prisma`), database seed script, and backend logic.
*   `/frontend`: Contains the Next.js web dashboard for viewing sales and managing inventory.
*   `docker-compose.yml`: Configuration to run the local PostgreSQL database.
*   `OMS implement.md`: A detailed progress tracking and planning document for the implementation phases.

## Building and Running

### 1. Database
The project uses Docker to run a local PostgreSQL instance.
```bash
# Start the database in the background
docker compose up -d

# (Optional) Stop the database
docker compose down
```

### 2. Backend
The backend runs on Node.js and uses Prisma to interact with the database.
```bash
cd backend

# Install dependencies (if not already done)
npm install

# Run database migrations and apply schema
npx prisma db push

# Seed the database with initial products and variants
npx prisma db seed

# Start the backend development server (uses nodemon)
npm run dev
```

### 3. Frontend
The frontend is a Next.js application.
```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start the frontend development server
npm run dev
```

## Development Conventions
*   **TypeScript:** Both backend and frontend use TypeScript. Ensure strong typing is maintained.
*   **Prisma:** Any database schema changes must be made in `backend/prisma/schema.prisma` and applied using `npx prisma db push`.
*   **Timezone:** All shipping logic is locked to `Asia/Bangkok`.
*   **Inventory:** Deductions happen at `PACKING` start; restorations happen if an order is reverted to `PENDING`.
*   **Status Tracking:** Refer to `OMS implement.md` to see the current progress and next steps (e.g., Phase 2: Platform Integrations).
