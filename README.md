# Restaurant & Food Service Platform (RFSP) — Core Platform v1

## Overview
**RFSP Core Platform v1** is the foundational digital-menu capability of the Restaurant & Food Service Platform. It provides a complete, modular, enterprise-architected system enabling restaurant administrators to manage organizations, branches, digital menus, categories, menu items, media assets, and QR codes, while providing customers with a fast, mobile-responsive, zero-authentication digital menu experience.

The system uses **PostgreSQL** as the core database engine to ensure high concurrency, relational integrity, and seamless future evolution into transactional domains (Orders, POS, Kitchen, Inventory).

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
│  - Audit Logging              │ │  - PostgreSQL Engine      │
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
* Reusable media library with usage tracking across restaurants and menu items.

### 5. QR Publishing (Core Publishing Capability)
* High-resolution QR code image generation (PNG data URI) for branch destinations.
* QR code lifecycle management (`Active`, `Disabled`, `Expired`).
* Public QR resolution handler with seamless redirect to `/menu/:branchSlug`.

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

## Database & Migration System

### PostgreSQL Schema
* Located in `src/data/migrations/001_initial_core_schema.sql`.
* Managed deterministically by the migration runner (`src/data/migrator.js`).
* Automatically applies migrations upon server startup and seeds initial administrator credentials if the database is empty.

### Connection Configuration
Configurable via environment variables (or `.env` file):
* `DATABASE_URL`: Full PostgreSQL connection URI (e.g. `postgresql://user:pass@host:5432/dbname`)
* `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSL`
* Fully supports real PostgreSQL daemons as well as an embedded PostgreSQL engine for test environments.

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

## Getting Started

### Prerequisites
* Node.js v24+ (or Node.js v22+ with ES modules)
* npm 10+
* (Optional) PostgreSQL 14+ instance

### Installation
```bash
npm install
```

### Run Migrations & Seed Initial Demo Data
```bash
npm run seed
```
* **Admin User**: `admin` / `AdminPass123!`
* **Manager User**: `manager` / `ManagerPass123!`
* **Demo Restaurant**: Aura Artisan Bistro (`aura-artisan-bistro`)
* **Demo Branches**:
  - Downtown Flagship (`downtown-flagship`)
  - Westside Promenade (`westside-promenade`)

### Run Development Server
```bash
npm start
```
* **Administration Console**: `http://localhost:3000/admin`
* **Customer Digital Menu**: `http://localhost:3000/menu/downtown-flagship`
* **QR Scan Resolution**: `http://localhost:3000/qr/QR_DT01_MAIN`
* **Health Check API**: `http://localhost:3000/api/health`

### Run Automated Tests
```bash
npm test
```
Executes all 7 automated test suites:
- `tests/identity.test.js`: Authentication, password hashing, JWT tokens, RBAC.
- `tests/organization.test.js`: Restaurant and branch lifecycle.
- `tests/menu.test.js`: Menus, categories, items, assignments, availability.
- `tests/publishing.test.js`: Authoritative publishing logic and availability filters.
- `tests/qr.test.js`: QR code creation, status lifecycle, destination resolution.
- `tests/audit.test.js`: Structured administrative action audit logs.
- `tests/e2e.test.js`: Full end-to-end integration workflow.
