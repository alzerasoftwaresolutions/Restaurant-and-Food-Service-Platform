# Restaurant & Food Service Platform (RFSP) — Core Platform v1

## Overview
**RFSP Core Platform v1** is the foundational digital-menu capability of the Restaurant & Food Service Platform. It provides a complete, modular, enterprise-architected system enabling restaurant administrators to manage organizations, branches, digital menus, categories, menu items, media assets, and QR codes, while providing customers with a fast, mobile-responsive, zero-authentication digital menu experience.

The system uses **PostgreSQL 16** as the core database engine to ensure high concurrency, relational integrity, and seamless future evolution into transactional domains (Orders, POS, Kitchen, Inventory).

This implementation strictly complies with:
1. `EDA-001` — Enterprise Domain Architecture
2. `SA-001` — Solution Architecture (Evolutionary Modular Monolith)
3. `CORE-IMP-001` — Core Platform v1 Implementation Definition

---

## Architectural Structure

```text
┌─────────────────────────────────────────────────────────────┐
│                 Client Experience Layer                     │
│  - Administration Console Experience (/admin)               │
│  - Customer Digital Menu Experience (/menu/:branchSlug)     │
└─────────────────────────────────────────────────────────────┘
                              │ REST APIs (JSON / Multipart)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Experience Layer                       │
│  - Express HTTP Routing & Error Handling                    │
│  - Authentication & Role-Based Access Control (RBAC)        │
│  - Request Validation & Experience Orchestration            │
│  - QR Destination Resolver & Public Menu API                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Business Core                         │
│  ├── Organization Management (Restaurant, Branch, Status)   │
│  ├── Menu Management (Menu, Category, Item, Assignment, Avail)
│  └── Core Publishing: QR Publishing (QR Lifecycle, Code Gen)│
└─────────────────────────────────────────────────────────────┘
               │                                │
               ▼                                ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│       Platform Services       │ │        Data Layer         │
│  - Identity & Access          │ │  - Schema & Migrations    │
│  - Media Management           │ │  - Domain Repositories    │
│  - Audit Logging              │ │  - PostgreSQL 16 Engine   │
│  - Configuration              │ │    (ANSI SQL / Pooled)    │
└───────────────────────────────┘ └───────────────────────────┘
```

---

## Core Capabilities Implemented

### 1. Identity & Access (Platform Service)
* User account registration and authentication.
* Secure password hashing with BCrypt.
* Stateless JWT authentication token issuance and verification.
* Role-Based Access Control (`admin` and `manager` roles).

### 2. Organization Management (Business Domain)
* **Restaurant**: Name, legal name, unique slug, currency, description, contact details, logo and banner associations, lifecycle states (`Active`, `Inactive`).
* **Branch**: Multi-branch hierarchy belonging to parent restaurant, unique slug, branch code, address, operating hours, status (`Active`, `Inactive`).

### 3. Menu Management (Business Domain)
* **Menu**: Name, description, lifecycle states (`Active`, `Inactive`, `Archived`).
* **Category**: Associated to menu, name, description, display order sequencing, reorder controls.
* **Menu Item**: Category association, name, price, currency, description, dietary tags, allergen metadata, media asset association, availability switch (`Available`, `Unavailable`).
* **Menu-Branch Assignment**: Many-to-many relationship allowing a menu to be assigned to multiple branches and a branch to hold multiple menus.

### 4. Media Management (Platform Service)
* Multi-format image asset uploads (PNG, JPEG, WebP, SVG).
* File size constraints and MIME type validation.
* Reusable media library with persistent volume disk storage.

### 5. QR Publishing (Core Publishing Capability)
* High-resolution QR code image generation (PNG data URI) for branch destinations.
* QR code lifecycle management (`Active`, `Disabled`, `Expired`).
* Public QR resolution handler with canonical HTTP 302 redirect to `/menu/:branchSlug`.

### 6. Customer Digital Menu (Client Experience)
* Canonical public route: `/menu/:branchSlug`.
* Authentication-free, lightning-fast mobile-responsive presentation.
* Authoritative publishing rules strictly enforced:
  $$\text{Visible} = (\text{Restaurant Active}) \land (\text{Branch Active}) \land (\text{Menu Active}) \land (\text{Menu Assigned}) \land (\text{Item Available})$$
* Live search filtering and category navigation.
* Item detail modal displaying ingredients and allergen warnings.

### 7. Administration Experience (Client Experience)
* Modern responsive single-page administrative console at `/admin`.
* Dashboard overview with operational KPI metrics and recent audit activity feed.
* Interactive managers for Restaurant Profile, Branches, Menus, Categories, Items, Assignments matrix, Media library, QR publishing, and Audit logs.

### 8. Audit Logging (Platform Service)
* Captures significant administrative mutations (actor, action, target type, target ID, timestamp, result, details, IP).
* Searchable and filterable audit trail in the administrative console.

---

## Strictly Excluded Capabilities (Core v1 Boundary)
The following are strictly out of scope for Core Platform v1:
* No Customer Ordering, Cart, Checkout, Payments, or Billing.
* No Kitchen Display System (KDS) or kitchen ticketing.
* No POS hardware integrations, cash drawers, or receipt printers.
* No Inventory management, recipes, or stock deductions.
* No Table management, waiter call buttons, or reservations.
* No Delivery management or driver dispatching.
* No Loyalty programs, promotions, coupons, or customer reviews.
* No Hotel PMS integrations or room service workflows.
* No Multi-tenant SaaS billing or AI feature placeholders.

---

## Local Development Setup Guide

> [!IMPORTANT]
> **Working Directory**: All commands must be executed from the **repository root directory**:
> ```text
> C:\Users\Natha\Desktop\Restaurant & Food Service Platform
> ```
> Do NOT execute commands from inside the `src/` folder.

### 1. Prerequisites
* **Node.js**: `v24 LTS` (or Node.js `v20.6.0+` with native `.env` loading)
* **npm**: `v10+`
* **PostgreSQL**: `v16` (or `v14+`) running locally on port `5432`

---

### 2. Create PostgreSQL Database
In your local PostgreSQL instance (via `psql` or pgAdmin), create the database:
```sql
CREATE DATABASE rfsp_core_v1;
```

*(Optional Recommended)* Create a dedicated development application user:
```sql
CREATE USER rfsp_app WITH ENCRYPTED PASSWORD 'your_secure_dev_password';
GRANT ALL PRIVILEGES ON DATABASE rfsp_core_v1 TO rfsp_app;
ALTER DATABASE rfsp_core_v1 OWNER TO rfsp_app;
```

---

### 3. Configure Local `.env`
Create a `.env` file in the project root by copying `.env.example`:
```bash
cp .env.example .env
```

Edit `.env` to supply your local PostgreSQL password:
```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

# Local PostgreSQL Connection
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=YOUR_ACTUAL_LOCAL_POSTGRES_PASSWORD
PGDATABASE=rfsp_core_v1
PGSSL=false

# Security & Publishing
JWT_SECRET=rfsp_core_v1_super_secure_jwt_secret_key_2026
PUBLIC_MENU_BASE_URL=http://localhost:3000/menu
AUTO_SEED=true
```

> [!NOTE]
> `.env` is listed in `.gitignore` and must never be committed to source control.

---

### 4. Database Setup & Verification Commands

Execute the following sequential verification commands from the project root:

```bash
# 1. Verify PostgreSQL connection and schema status
npm run db:verify

# 2. Run deterministic database migrations
npm run migrate

# 3. Seed initial demonstration data (Admin, Manager, Restaurant, Branches, Menus, QR)
npm run seed

# 4. Verify live HTTP endpoints
npm run health:check

# 5. Run full automated test suite (46 tests)
npm test

# 6. Start local development server with auto-reload
npm run dev
```

---

### 5. Application Endpoints

Once the development server is running:
* **Administration Console**: `http://localhost:3000/admin`
  * **Admin Login**: `admin` / `AdminPass123!`
  * **Manager Login**: `manager` / `ManagerPass123!`
* **Customer Digital Menu**: `http://localhost:3000/menu/downtown-flagship`
* **QR Resolution Handler**: `http://localhost:3000/qr/QR_DT01_MAIN`
* **System Health API**: `http://localhost:3000/api/health`

---

## Automated Test Suites

```bash
npm test
```
Executes all 7 domain test suites using isolated in-memory testing adapter:
1. `tests/identity.test.js`: Authentication, password hashing, JWT tokens, RBAC.
2. `tests/organization.test.js`: Restaurant, branch lifecycle, and branch query counts.
3. `tests/menu.test.js`: Menus, categories, items, assignments, availability.
4. `tests/publishing.test.js`: Authoritative publishing logic and availability filters.
5. `tests/qr.test.js`: QR code creation, status lifecycle, destination resolution.
6. `tests/audit.test.js`: Structured administrative action audit logs.
7. `tests/e2e.test.js`: Full end-to-end integration workflow.
