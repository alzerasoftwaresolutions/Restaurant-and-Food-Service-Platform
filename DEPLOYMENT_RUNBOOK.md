# Restaurant & Food Service Platform (RFSP) — Core Platform v1
# Deployment Runbook & Operations Guide

## Document Purpose
This runbook provides complete operational guidance for deploying, configuring, migrating, verifying, and troubleshooting **RFSP Core Platform v1** in **Development** and **Staging** environments.

---

## 1. Architecture & Deployment Model

```text
┌─────────────────────────────────────────────────────────────┐
│                 Client Experience Layer                     │
│  - Administration Console Experience (/admin)               │
│  - Customer Digital Menu Experience (/menu/:branchSlug)     │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS / Reverse Proxy (Nginx, Traefik, Caddy)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           RFSP Core Platform v1 (Node.js 24 LTS / Express)  │
│  - Evolutionary Modular Monolith (Stateless Service)        │
│  - Port: 3000 (Configurable)                                │
└─────────────────────────────────────────────────────────────┘
                              │ Connection Pool (pg.Pool / TCP 5432)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL 16 Relational Engine             │
│  - Schema Migrations Table (schema_migrations)              │
│  - 10 Core Tables & Relational Constraints                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles
* **Stateless Application Tier**: The Node.js application process stores no session state in memory (JWT authentication is stateless).
* **Deterministic Migrations**: Schema updates are managed via versioned SQL migration scripts executed in sequential order.
* **Separation of Environments**: `Development DB` $\neq$ `Staging DB` $\neq$ `Production DB`.
* **Standardized Runtime**: **Node.js 24 LTS** and **PostgreSQL 16**.
* **Zero Automatic Overwriting**: `AUTO_SEED=false` in staging prevents any accidental data modification upon container restart.

---

## 2. Environment Configuration Reference

The following environment variables govern application behavior. Configure them in `.env` or inject them via container orchestrators / systemd environment files.

| Variable Name | Required | Default (Dev) | Allowed Values / Constraints | Purpose & Description |
| :--- | :---: | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` | `development`, `staging`, `production` | Controls runtime safeguards, error verbosity, and strict startup checks. |
| `HOST` | No | `0.0.0.0` | IP Address / Hostname | Network interface to bind the HTTP server. |
| `PORT` | No | `3000` | Integer (1–65535) | TCP port for incoming HTTP traffic. |
| `DATABASE_URL` | Staging/Prod | `null` | PostgreSQL 16 Connection URI | Full connection URI (takes precedence over individual `PG*` variables). |
| `PGHOST` | If no URL | `localhost` | Hostname / IP | PostgreSQL 16 database host address. |
| `PGPORT` | If no URL | `5432` | Integer (1–65535) | PostgreSQL 16 database port. |
| `PGUSER` | If no URL | `postgres` | String | PostgreSQL 16 database username. |
| `PGPASSWORD` | If no URL | `postgres` | String | PostgreSQL 16 database password. |
| `PGDATABASE` | If no URL | `rfsp_core_v1` | String | PostgreSQL 16 database name. |
| `PGSSL` | No | `false` | `true`, `false` | Enable TLS/SSL connection for managed PostgreSQL instances. |
| `PGPOOL_MAX` | No | `20` | Integer (1–100) | Maximum connections in the database connection pool. |
| `JWT_SECRET` | Yes | Dev Default | String ($\ge 32$ chars) | Cryptographic signing key for authentication tokens. **Must be unique per env.** |
| `JWT_EXPIRES_IN` | No | `24h` | Time String (`12h`, `24h`, `7d`) | Lifetime of issued authentication JWT tokens. |
| `PUBLIC_MENU_BASE_URL` | Yes | `http://localhost:3000/menu` | Full URL | Canonical base URL embedded in generated QR codes. |
| `CORS_ORIGIN` | Staging | `http://localhost:3000` | Staging Origin URL | Allowed origin for administrative APIs (e.g. `https://staging.aurabistro.com`). |
| `UPLOAD_DIR` | No | `/app/public/uploads` | Filepath | Persistent directory path for uploaded media assets. |
| `AUTO_SEED` | No | `false` | `true`, `false` | Disabled in staging (`false`) to ensure data persistence across restarts. |
| `SHUTDOWN_TIMEOUT_MS`| No | `10000` | Integer (ms) | Maximum wait time for in-flight requests during graceful shutdown. |

---

## 3. Database Setup & Migration Procedure (PostgreSQL 16)

### 3.1 Provisioning PostgreSQL 16 (Staging)
1. Create a dedicated staging PostgreSQL 16 database instance:
   ```sql
   CREATE DATABASE rfsp_staging;
   CREATE USER rfsp_staging_user WITH ENCRYPTED PASSWORD 'your_strong_password_here';
   GRANT ALL PRIVILEGES ON DATABASE rfsp_staging TO rfsp_staging_user;
   ALTER DATABASE rfsp_staging OWNER TO rfsp_staging_user;
   ```

### 3.2 Running Migrations
Execute the standalone migration runner to apply pending schema migrations:
```bash
npm run migrate
```
The migration runner:
- Creates `schema_migrations` tracking table if not present.
- Executes unapplied `.sql` scripts in `src/data/migrations/` sequentially inside transactions.
- Records each applied file with timestamp.

### 3.3 Initial Staging Data Population
When establishing a fresh staging environment, seed data is inserted explicitly once:
```bash
npm run seed
```
`AUTO_SEED=false` ensures that subsequent application starts and container restarts do not overwrite or modify existing staging records.

### 3.4 Verifying Database Schema
Verify that the database connection is healthy, migrations are recorded, and all 10 domain tables are present:
```bash
npm run db:verify
```

---

## 4. Staging Deployment Procedures

### Option A: Staging with Docker Compose (Recommended)
1. Copy the staging environment configuration:
   ```bash
   cp .env.example .env
   # Set NODE_ENV=staging
   # Set JWT_SECRET=your_staging_secret_key_32_chars_long
   # Set CORS_ORIGIN=https://staging.aurabistro.com
   # Set PUBLIC_MENU_BASE_URL=https://staging.aurabistro.com/menu
   # Set AUTO_SEED=false
   ```
2. Build and start the staging stack in detached mode:
   ```bash
   docker compose -f docker-compose.staging.yml up -d --build
   ```
3. Monitor application startup logs:
   ```bash
   docker compose -f docker-compose.staging.yml logs -f rfsp-app
   ```
4. Verify health:
   ```bash
   curl -i http://localhost:3000/api/health
   ```

### Option B: Bare-Metal / Virtual Machine (Systemd)
1. Install **Node.js 24 LTS** and **PostgreSQL 16** on the target server.
2. Clone repository to `/opt/rfsp-core-platform`:
   ```bash
   git clone https://github.com/alzerasoftwaresolutions/Restaurant-and-Food-Service-Platform.git /opt/rfsp-core-platform
   cd /opt/rfsp-core-platform
   ```
3. Install production dependencies:
   ```bash
   npm ci --only=production
   ```
4. Configure `/opt/rfsp-core-platform/.env`:
   ```bash
   NODE_ENV=staging
   PORT=3000
   HOST=0.0.0.0
   DATABASE_URL=postgresql://rfsp_staging_user:password@localhost:5432/rfsp_staging
   JWT_SECRET=your_32_character_staging_secret_key_here
   CORS_ORIGIN=https://staging.aurabistro.com
   PUBLIC_MENU_BASE_URL=https://staging.aurabistro.com/menu
   UPLOAD_DIR=/opt/rfsp-core-platform/public/uploads
   AUTO_SEED=false
   ```
5. Apply database migrations and seed initial staging data:
   ```bash
   npm run migrate
   npm run seed
   npm run db:verify
   ```
6. Setup Systemd Service (`/etc/systemd/system/rfsp.service`):
   ```ini
   [Unit]
   Description=RFSP Core Platform v1 (Node.js 24)
   After=network.target postgresql.service

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/rfsp-core-platform
   ExecStart=/usr/bin/node src/server.js
   Restart=always
   RestartSec=5
   EnvironmentFile=/opt/rfsp-core-platform/.env
   LimitNOFILE=65536

   [Install]
   WantedBy=multi-user.target
   ```
7. Enable and start service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable rfsp
   sudo systemctl start rfsp
   ```

---

## 5. Persistent Media Storage Verification

Uploaded media assets (restaurant logos, banners, food item photographs) persist across container recreation, redeployment, and host reboots.

### Docker Volume Persistence
* `docker-compose.staging.yml` mounts the named volume `media_uploads_staging` to `/app/public/uploads`.
* Verification protocol:
  1. Upload an item image in `/admin`.
  2. Recreate the application container:
     ```bash
     docker compose -f docker-compose.staging.yml up -d --force-recreate rfsp-app
     ```
  3. Access the uploaded image via browser or `curl -i http://localhost:3000/uploads/<filename>`.
  4. The image returns HTTP 200 without data loss.

---

## 6. Verification & Health Check

### 6.1 Automated Endpoint Verification
Run the endpoint test script against the running server:
```bash
npm run health:check
```

### 6.2 Manual Health Check Probe
Send a `GET` request to `/api/health`:
```bash
curl -X GET http://localhost:3000/api/health
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "UP",
  "product": "Restaurant & Food Service Platform (RFSP)",
  "unit": "Core Platform v1",
  "environment": "staging",
  "database": {
    "status": "UP",
    "engine": "PostgreSQL 16",
    "latencyMs": 4,
    "mode": "connection-pool"
  },
  "uptimeSeconds": 120,
  "timestamp": "2026-09-01T01:00:00.000Z"
}
```

---

## 7. Rollback Procedures

### 7.1 Application Code Rollback
If a newly deployed code version exhibits issues:
1. Revert to the previous Git commit or Docker image tag:
   ```bash
   # Git
   git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>
   npm ci --only=production
   sudo systemctl restart rfsp

   # Docker
   docker compose -f docker-compose.staging.yml up -d --build
   ```
2. Verify `/api/health` status after rollback.

### 7.2 Database Migration Rollback Considerations
* Core Platform v1 migrations are additive.
* If a rollback requires altering the schema:
  - Do NOT modify applied migration scripts directly in production/staging.
  - Create a new migration script (e.g. `002_revert_feature.sql`) that explicitly drops or reverses the change.
  - Run `npm run migrate` to apply the reversal deterministically.

---

## 8. Database Backup & Disaster Recovery (PostgreSQL 16)

### 8.1 Creating a Database Backup (`pg_dump`)
Run a logical backup of the PostgreSQL 16 staging database:
```bash
pg_dump -h localhost -U rfsp_staging_user -d rfsp_staging -F c -b -v -f "/var/backups/rfsp_staging_$(date +%Y%m%d_%H%M%S).dump"
```

### 8.2 Restoring from a Backup (`pg_restore`)
To restore the database:
```bash
pg_restore -h localhost -U rfsp_staging_user -d rfsp_staging --clean --if-exists -v "/var/backups/rfsp_staging_backup.dump"
```

---

## 9. Troubleshooting Guidance

### Issue 1: Database Connection Refused
* **Symptoms**: Application fails to start with `PostgreSQL connection failed in staging mode: connect ECONNREFUSED`.
* **Remediation**:
  1. Verify PostgreSQL 16 service is active: `sudo systemctl status postgresql` or `docker ps`.
  2. Verify network reachability: `nc -zv $PGHOST $PGPORT` or `telnet $PGHOST $PGPORT`.
  3. Verify PostgreSQL configuration in `pg_hba.conf` allows connections from the application host IP.

### Issue 2: Configuration Validation Error on Startup
* **Symptoms**: Application exits immediately with `[Configuration Error] Application failed startup validation`.
* **Remediation**:
  1. Check `JWT_SECRET`: Must be set and contain $\ge 32$ characters in staging/production.
  2. Check `DATABASE_URL`: Ensure valid credentials and database name are provided.

### Issue 3: CORS Rejection for Admin Console
* **Symptoms**: Admin console requests fail with CORS policy error in browser console.
* **Remediation**: Ensure `CORS_ORIGIN` contains the exact staging origin (e.g. `CORS_ORIGIN=https://staging.aurabistro.com`).
