# ControlCheck — Claude Agent Guide

This file is loaded automatically by Claude Code. Read it before making any changes.

---

## Project Overview

**ControlCheck** is an MSP-facing SaaS for managing SMB1001:2026 compliance across multiple client tenants.

- **Standard**: SMB1001:2026 — 39 controls, 5 tiers (Bronze T1 → Diamond T5), 5 domains
- **Stack**: Fastify API + React/TypeScript frontend + BullMQ worker + PostgreSQL + Redis
- **Auth**: Cloudflare OIDC SSO (primary) + local email/password fallback; JWT Bearer tokens
- **Deployment**: Docker images on GitHub Container Registry, deployed via Portainer on a VPS

---

## Infrastructure

Frontend and API are on **separate Cloudflare tunnel endpoints** — no nginx reverse proxy between them:

- **Frontend**: `controlcheck.globaltechnology.nz` → `smb1001_frontend` container (nginx, static files)
- **API**: `controlcheckapi.globaltechnology.nz` → `smb1001_api` container (Node.js :3000)

Both containers are on the `cftunnel_default` external Docker network.

`VITE_API_URL` is baked into the frontend image at build time — it must be the **absolute** API URL (`https://controlcheckapi.globaltechnology.nz`). Never use a relative path. This is set as an ARG default in `frontend/Dockerfile`.

CORS on the API uses `origin: true, credentials: true` (reflects request origin).

---

## Portainer Deployment

Webhook to redeploy the ControlCheck stack:
```
POST https://portainer.globaltech.nz/api/stacks/webhooks/dad4a6a0-20df-49e5-815a-5ab4f7edb37c
```

**Critical limitation**: The webhook redeploys using Portainer's **stored stack config** — it does NOT re-read `portainer-stack.yml` from the repo. If you add or change environment variables in the yml, you must also update them in the Portainer UI (Stack → Environment Variables). This is why `FRONTEND_URL` must be set manually in Portainer even after updating the yml.

---

## Versioning Rule

**Always bump `frontend/package.json` patch version before every push**, even for tiny fixes.

The login page displays `v{__APP_VERSION__}` so the user can confirm a fresh deployment took effect. If the version doesn't change, there's no visual confirmation the redeploy picked up new images.

Format: `1.2.3 → 1.2.4`. Include the version in the commit message (e.g. `feat: add X v1.2.4`).

---

## Database Migrations

The API has its own migration runner (`api/src/index.ts` → `runMigrations()`). It tracks applied files in a `_migrations` table and wraps each in `BEGIN/COMMIT`; on error it does `ROLLBACK + process.exit(1)`.

**Never** mount `./migrations` as a postgres `docker-entrypoint-initdb.d` init script. If you do, postgres runs all SQL on DB init, `_migrations` stays empty, the API re-runs `001_init.sql` on start → "relation already exists" → crash loop.

The API migration runner is the **sole owner** of migrations. All migration files should be idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc.).

---

## RBAC and Tenant Access

Three roles: `admin`, `auditor`, `readonly`.

**Access model is an exclusion/deny-list — not an allowlist.**

- **Admin**: full access to all tenants; can manage users, SSO, integrations.
- **Auditor**: MSP staff — sees **all** non-suspended tenants by default. Access is restricted by adding rows to `user_tenant_exclusions`.
- **Readonly**: same tenant visibility as auditor but cannot mutate assessments.

Why deny-list: auditors manage all client tenants; new tenants should be visible to all auditors automatically without needing individual grants.

Key files:
- `api/src/middleware/tenant.ts` — `validateTenantAccess`: admin path checks tenant exists/not-suspended; non-admin path checks tenant is not in the user's exclusion list
- `api/src/services/tenant.service.ts` — `listForUser(userId)`: returns all non-suspended tenants minus exclusions
- `user_tenant_exclusions(user_id, tenant_id, excluded_by, excluded_at)` — migration 014
- Settings → Users tab: checkboxes to restrict individual auditors from specific tenants
- `GET /tenants` branches on role: admin gets paginated full list, non-admin gets `listForUser` result

SSO auto-provisioned users default to `auditor` role. The first admin must be created/promoted via a password account through Settings → Users.

---

## `/auth/me` Must Return camelCase

`auth.controller.ts` `me()` must **explicitly map** DB column names to camelCase. Never `return reply.send(row)` directly.

The frontend `User` type uses `tenantId`, `firstName`, `lastName`. The DB returns `tenant_id`, `first_name`, `last_name`. Returning the raw row causes `TenantContext` to read `user.tenantId` as `undefined` → `tenantApi.getOne(undefined)` → 404 → no tenants load → Controls/Audits pages stuck. The failure is silent (no thrown error).

Correct shape:
```typescript
return reply.send({
  id: row.id, email: row.email, role: row.role,
  firstName: row.first_name, lastName: row.last_name,
  tenantId: row.tenant_id, tenantName: row.tenant_name, tenantSlug: row.tenant_slug,
  has_password: row.has_password,
});
```
If you add new fields to the `me()` query, always add the camelCase mapping too.
