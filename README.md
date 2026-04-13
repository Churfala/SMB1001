# ControlCheck

A production-ready, multi-tenant SMB1001 compliance audit platform for Managed Service Providers (MSPs). Automates evidence collection from Microsoft 365 and Google Workspace, evaluates 26 SMB1001 controls, and generates executive compliance reports.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │           Nginx :80              │
                    │  /api/* → API   /  → Frontend    │
                    └────────┬────────────┬────────────┘
                             │            │
              ┌──────────────▼──┐   ┌─────▼───────────┐
              │   Fastify API   │   │  React Frontend  │
              │   :3000         │   │  (Vite/Nginx)    │
              └──────┬──────────┘   └─────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼───┐  ┌─────▼────┐  ┌───▼──────────┐
   │  PG    │  │  Redis   │  │  BullMQ      │
   │ :5432  │  │  :6379   │  │  Worker      │
   └────────┘  └──────────┘  └──────────────┘
```

- **API**: Fastify (Node.js), TypeScript, JWT auth, multi-tenant RBAC
- **Worker**: BullMQ consumer, Microsoft Graph API + Google Admin SDK integration, audit evaluation engine
- **Frontend**: React 18, React Router v6, Recharts, Vite
- **Database**: PostgreSQL 15 with UUID PKs and JSONB
- **Queue**: Redis + BullMQ for async audit processing
- **Proxy**: Nginx with SPA fallback and `/api/` rewriting

## Quick Start

### Prerequisites

- Docker and Docker Compose v2
- A `.env` file (copy from `.env.example`)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

### 2. Start the platform

```bash
docker compose up -d
```

This will:
1. Start PostgreSQL and Redis
2. Run database migrations and seed data
3. Start the API server, worker, frontend, and Nginx

### 3. Access the platform

Open [http://localhost](http://localhost) in your browser.

**Default credentials:**

| Field       | Value           |
|-------------|-----------------|
| Tenant Slug | `msp-admin`     |
| Email       | `admin@msp.local` |
| Password    | `Admin1234!`    |

## User Roles

| Role       | Permissions                                               |
|------------|-----------------------------------------------------------|
| `admin`    | Full access — manage all tenants, users, integrations    |
| `auditor`  | Create/run audits, update results, add evidence          |
| `readonly` | View audits and results only                             |

## Integrations

### Microsoft 365

Requires an Azure AD app registration with **client credentials** (no user sign-in needed):

**Required API permissions (Application):**

| Permission | Purpose |
|---|---|
| `User.Read.All` | List users, MFA methods |
| `Policy.Read.All` | Conditional Access policies, security defaults |
| `SecurityEvents.Read.All` | Secure Score, alerts |
| `Directory.Read.All` | Directory roles and members |
| `Sites.Read.All` | SharePoint sharing settings |
| `ServicePrincipalEndpoint.Read.All` | OAuth app listing |

**Configuration values needed:**

- Client ID (Application ID)
- Client Secret
- Directory (Tenant) ID

### Google Workspace

Requires a service account with **domain-wide delegation**:

**Required OAuth scopes:**

- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly`
- `https://www.googleapis.com/auth/admin.reports.audit.readonly`
- `https://www.googleapis.com/auth/admin.directory.device.mobile.readonly`

**Configuration values needed:**

- Service account private key JSON (full JSON object)
- Admin email (for impersonation)
- Customer ID (from Google Admin console)

## SMB1001 Controls

26 controls across 7 categories, mapped to the ACSC SMB1001 framework:

| Category | Controls | Description |
|---|---|---|
| GOV | 5 | Governance, policies, vendor management |
| IAM | 6 | Identity, MFA, privileged access, passwords |
| EMAIL | 6 | DMARC/DKIM/SPF, anti-phishing, secure email |
| CA | 3 | Conditional Access, device compliance, legacy auth |
| DATA | 3 | Data sharing, classification, DLP |
| DET | 3 | Secure Score, audit logging, SIEM |
| REC | 2 | Backup integrity, recovery testing |

**Severity weighting for compliance score:**

| Severity | Weight |
|---|---|
| Critical | 4 |
| High | 3 |
| Medium | 2 |
| Low | 1 |

Partial results count as 0.5× weight. `not_applicable` and `manual_review` controls are excluded from the denominator.

## API Reference

Base URL: `http://localhost/api`

### Authentication

```
POST /auth/login       Body: { email, password, tenantSlug }
POST /auth/refresh     Body: { refreshToken }
GET  /auth/me
POST /auth/change-password
```

### Audits

```
GET    /tenants/:tenantId/audits
POST   /tenants/:tenantId/audits         Body: { name }
GET    /tenants/:tenantId/audits/:id
POST   /tenants/:tenantId/audits/:id/run
GET    /tenants/:tenantId/audits/:id/progress
POST   /tenants/:tenantId/audits/:id/finalise
PATCH  /tenants/:tenantId/audits/:id/results/:controlId
```

### Evidence

```
GET    /tenants/:tenantId/audits/:id/results/:controlId/evidence
POST   /tenants/:tenantId/audits/:id/results/:controlId/evidence/text
POST   /tenants/:tenantId/audits/:id/results/:controlId/evidence/file
```

### Reports

```
GET /tenants/:tenantId/reports/:auditId          JSON summary
GET /tenants/:tenantId/reports/:auditId?format=csv
GET /tenants/:tenantId/reports/:auditId?format=pdf
```

### Controls

```
GET /controls            Query: ?category=IAM&severity=critical
GET /controls/:id
```

## Scheduled Audits

Create recurring audits via the API:

```
POST /tenants/:tenantId/audits/:id/schedules
Body: { cron_expression: "0 9 * * 1", name: "Weekly Monday Audit" }
```

Supported patterns: `daily`, `weekly`, `monthly`, `quarterly` — or any valid cron expression.

## File Structure

```
SMB1001/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf
├── migrations/
│   ├── 001_init.sql
│   └── 002_seed_controls.sql
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── config/          # DB, Redis, env
│       ├── controllers/     # Route handlers
│       ├── middleware/      # Auth, tenant validation
│       ├── routes/          # Fastify route registration
│       ├── services/        # Business logic
│       ├── types/           # TypeScript types
│       └── index.ts
├── worker/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── config/
│       ├── evaluators/      # Per-control evaluation logic
│       ├── processors/      # Audit job + scheduler
│       ├── services/        # M365 + Google data collection
│       └── index.ts
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.ts
    └── src/
        ├── components/      # Layout, StatusBadge
        ├── contexts/        # AuthContext, TenantContext
        ├── pages/           # Dashboard, AuditDetail, Controls, Tenants
        ├── services/        # Axios API client
        ├── types/
        ├── App.tsx
        └── main.tsx
```

## Development

### Run API locally

```bash
cd api
npm install
cp ../.env.example .env   # edit as needed
npm run dev
```

### Run worker locally

```bash
cd worker
npm install
npm run dev
```

### Run frontend locally

```bash
cd frontend
npm install
npm run dev   # proxies /api to localhost:3000
```

### Apply migrations manually

```bash
cd api
npm run migrate
```

## Security Notes

- All integration credentials are encrypted at rest using AES-256-GCM
- JWT access tokens expire in 15 minutes; refresh tokens in 7 days
- Tenant isolation is enforced at the middleware layer — users cannot access other tenants' data
- File uploads are stored outside the web root at `UPLOAD_DIR` (default: `/uploads`)
- Rate limiting is applied globally via Redis-backed `@fastify/rate-limit`
- Change the default `Admin1234!` password immediately after first login

## License

MIT
