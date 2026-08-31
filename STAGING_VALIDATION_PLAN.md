# Restaurant & Food Service Platform (RFSP) — Core Platform v1
# Staging Validation Plan & Test Matrix (Node.js 24 LTS / PostgreSQL 16)

## Document Purpose
This document defines the comprehensive verification protocol to validate **RFSP Core Platform v1** upon deployment to a staging environment prior to any future production consideration.

---

## 1. Core User Journey Validation

### 1.1 Administration Experience (`/admin`)
Execute the full administrative workflow in the staging browser interface:

| Step | Action | Expected Result | Pass/Fail |
| :---: | :--- | :--- | :---: |
| 1 | Navigate to `/admin` and log in with admin credentials (`admin` / `AdminPass123!`). | Successfully authenticates, stores JWT in session/local storage, and displays Dashboard overview with KPI counters. | [ ] |
| 2 | Navigate to **Restaurant Profile** and update description or contact info. | Profile updates successfully; changes reflect in database and audit history. | [ ] |
| 3 | Navigate to **Branches** and create a new branch (e.g. `Uptown Bistro`, code `UB03`). | New branch created in `Active` status with unique slug. | [ ] |
| 4 | Navigate to **Menus** and create a new menu (`Weekend Brunch`). | Menu created in `Active` status. | [ ] |
| 5 | Navigate to **Categories** and add categories (`Egg Specialties`, `Bakery`). Reorder categories. | Categories appear in configured order. | [ ] |
| 6 | Navigate to **Menu Items** and create an item with price, dietary flags, and allergen tags. | Item created and associated with category. | [ ] |
| 7 | Navigate to **Menu Assignments** and assign the menu to the branch. | Assignment recorded with `is_active = 1`. | [ ] |
| 8 | Navigate to **Media Library** and upload a food image. | Image uploads to persistent storage and renders in media library. | [ ] |
| 9 | Navigate to **QR Publishing** and generate a QR code for the branch. | High-res PNG QR code generated with destination URL `/menu/<branch-slug>`. | [ ] |
| 10 | Navigate to **Audit Logs** and verify administrative operations. | Structured log entries exist for all mutations (`RESTAURANT_UPDATE`, `BRANCH_CREATE`, `MENU_CREATE`, `QR_CREATE`). | [ ] |

### 1.2 Customer Digital Menu Experience (`/menu/:branchSlug`)
Execute the zero-authentication customer browsing journey:

| Step | Action | Expected Result | Pass/Fail |
| :---: | :--- | :--- | :---: |
| 1 | Scan/visit the generated QR URL (`/qr/<qr-code>`). | HTTP 302 redirects seamlessly to `/menu/<branch-slug>`. | [ ] |
| 2 | View the digital menu interface. | Restaurant branding (logo/banner), branch operating hours, and active menus render cleanly. | [ ] |
| 3 | Browse category sections via sticky navigation pills. | Smooth scrolling to category headings. | [ ] |
| 4 | Click on a menu item card. | Modal opens displaying full description, price, dietary badges, and allergen alerts. | [ ] |
| 5 | Use search input to filter items by keyword (e.g. `Burrata`). | Menu instantly filters matching items. | [ ] |

---

## 2. Staging Failure & Edge Case Scenarios

Verify that the system fails safely and returns clear, understandable diagnostics for all edge cases:

| ID | Test Scenario | Trigger / Payload | Expected Safe System Behavior | Pass/Fail |
| :---: | :--- | :--- | :--- | :---: |
| **FS-01** | Invalid Login Credentials | `POST /api/v1/auth/login` with wrong password | HTTP 401 Unauthorized: `"Invalid credentials"`. No details leaked. | [ ] |
| **FS-02** | Unauthorized Admin Access | Access `/api/v1/restaurants` without `Bearer` token | HTTP 401 Unauthorized: `"Authorization header missing or invalid"`. | [ ] |
| **FS-03** | Inactive Restaurant Publishing | Set Restaurant status to `Inactive`, browse `/menu/:branchSlug` | Public menu returns friendly error page stating the restaurant is temporarily unavailable. | [ ] |
| **FS-04** | Inactive Branch Publishing | Set Branch status to `Inactive`, browse `/menu/:branchSlug` | Public menu returns friendly error page stating the branch is currently inactive. | [ ] |
| **FS-05** | Inactive / Archived Menu | Set Menu status to `Archived` | Menu is immediately hidden from customer public view. Active assigned menus remain visible. | [ ] |
| **FS-06** | Unavailable Menu Item | Toggle item `is_available = 0` in Admin console | Item is immediately hidden from customer public menu presentation. | [ ] |
| **FS-07** | Invalid QR Code Resolution | Request `/qr/NON_EXISTENT_QR_CODE` | Friendly landing page displays: `"QR Code Not Found or Inactive"`. | [ ] |
| **FS-08** | Disabled QR Code | Set QR code status to `Disabled`, visit `/qr/:code` | Friendly landing page displays: `"This QR code has been disabled by management"`. | [ ] |
| **FS-09** | Expired QR Code | Set QR code status to `Expired`, visit `/qr/:code` | Friendly landing page displays: `"This QR code has expired"`. | [ ] |
| **FS-10** | Cross-Restaurant Menu Assignment | Assign Menu of Restaurant A to Branch of Restaurant B | HTTP 400 Bad Request: `"Menu and branch must belong to the same restaurant"`. | [ ] |
| **FS-11** | Database Unavailable | Stop PostgreSQL 16 daemon, query `/api/health` | Returns HTTP 503 with `"database": {"status": "DOWN"}`. Zero database crash. | [ ] |
| **FS-12** | Missing Configuration | Start application with invalid/missing `JWT_SECRET` in staging | Process halts immediately during startup with clear error log. | [ ] |
| **FS-13** | Invalid Media File Upload | Upload `.exe` or file exceeding 5MB | HTTP 400 Bad Request: `"Invalid file type or size exceeded"`. | [ ] |
| **FS-14** | Unauthorized CORS Origin | Send administrative API request from disallowed origin | Request rejected by CORS policy. Public customer menu GET remains accessible. | [ ] |
| **FS-15** | Container Restart Media Persistence | Upload image $\to$ restart container $\to$ access image | Image remains available via `/uploads/<filename>` with HTTP 200. | [ ] |

---

## 3. Responsive UI & Viewport Validation Matrix

Verify usability across device screen sizes in the staging environment:

| Device Viewport | Target Dimensions | Component / Area | Verification Criteria | Pass/Fail |
| :--- | :---: | :--- | :--- | :---: |
| **Mobile Phone** | 375px $\times$ 667px (iPhone SE)<br>390px $\times$ 844px (iPhone 14) | Customer Digital Menu | - No horizontal page overflow.<br>- Category pills scroll horizontally smoothly.<br>- Item cards stack in 1-column layout.<br>- Touch targets $\ge 44\text{px}$.<br>- Item detail modal fits viewport with scrollable body. | [ ] |
| **Tablet** | 768px $\times$ 1024px (iPad Portrait)<br>1024px $\times$ 768px (iPad Landscape) | Customer Menu & Admin Console | - Customer menu displays 2-column grid layout.<br>- Admin navigation sidebar collapses or displays cleanly.<br>- Data tables scroll horizontally without breaking container. | [ ] |
| **Desktop** | 1280px $\times$ 800px<br>1920px $\times$ 1080px (Full HD) | Admin Console (`/admin`) | - Multi-column dashboard metrics render cleanly.<br>- Side navigation is persistent.<br>- Modal dialogs appear centered with semi-transparent overlay.<br>- Form fields align properly. | [ ] |

---

## 4. Security Validation Checklist

Verify the following before promoting beyond staging:

- [ ] **Authentication Token Verification**: Expired or tampered JWT tokens return HTTP 401 and redirect to login in `/admin`.
- [ ] **Role-Based Access Control (RBAC)**: Non-admin users cannot delete restaurants or bypass branch scopes.
- [ ] **Data Mutation Isolation**: All public customer routes (`/api/v1/public/*`, `/menu/*`, `/qr/*`) are strictly read-only and contain no data mutation handlers.
- [ ] **CORS Origin Restriction**: Administrative endpoints reject unauthorized origins while public menu reads remain open.
- [ ] **Information Disclosure Prevention**: Stack traces and internal database schemas are excluded from production/staging HTTP responses.
- [ ] **Credential Protection**: Environment files (`.env`) and database credentials are excluded from Git commits.
- [ ] **MIME Type Validation**: Media uploads validate magic bytes / MIME types and restrict uploads to images (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`).

---

## 5. Performance Baseline Measurements (Staging)

Collect baseline response times on the PostgreSQL 16 staging server:

| Endpoint | Method | Target Latency (p95) | Measured Latency | Status |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/health` | GET | $< 20\text{ ms}$ | _Pending staging test_ | [ ] |
| `GET /api/v1/public/menu/:branchSlug` | GET | $< 50\text{ ms}$ | _Pending staging test_ | [ ] |
| `GET /qr/:code` (Redirect) | GET | $< 30\text{ ms}$ | _Pending staging test_ | [ ] |
| `POST /api/v1/auth/login` | POST | $< 250\text{ ms}$ (BCrypt cost 10) | _Pending staging test_ | [ ] |
| `GET /api/v1/menus` | GET | $< 50\text{ ms}$ | _Pending staging test_ | [ ] |

---

## 6. Staging Acceptance Sign-Off

Upon completing all verification checks in this plan:
* If all automated tests pass, failure scenarios fail safely, responsive viewports render cleanly, and performance baselines are met: **`STAGING READY`** is certified.
