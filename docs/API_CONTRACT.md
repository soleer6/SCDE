# SCDEE API Contract Documentation

**Analysis Date:** 2026-04-20  
**API Version:** 1.0.0  
**Backend Repository:** https://github.com/anxoCRuam/SCDEE (branch: backend)  
**Status:** Early-stage implementation (Fase 0 - Infrastructure & Core Models)

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication & Security](#authentication--security)
3. [Base Configuration](#base-configuration)
4. [Project Phases & Roadmap](#project-phases--roadmap)
5. [Implemented Endpoints](#implemented-endpoints)
6. [Planned Endpoints by Phase](#planned-endpoints-by-phase)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)
9. [Pagination](#pagination)

---

## API Overview

The SCDEE backend is a **Django REST Framework** API implementing a digital exam correction system with multi-tenant isolation and complex permission models. The system is designed with a **plugin-based authentication architecture** to support JWT in v1.0 and future SSO (SAML 2.0, OIDC) integrations.

**Base URL:** `http://<host>/api/v1/`

**Documentation endpoints:**
- OpenAPI Schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`
- ReDoc: `GET /api/docs/redoc/`
- Health Check: `GET /health/`

---

## Authentication & Security

### Authentication Mechanism

The API uses **JWT (JSON Web Tokens)** with:

- **Access Token:** 15-minute lifetime (configurable via `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` env var)
- **Refresh Token:** 7-day lifetime (configurable via `JWT_REFRESH_TOKEN_LIFETIME_DAYS` env var)
- **Algorithm:** HS256
- **Token Format:** Bearer token in `Authorization` header

**Header Format:**
```http
Authorization: Bearer <access_token>
```

### Token Structure

JWT payload includes:
- User ID (UUID)
- Organization ID (for automatic multi-tenant filtering)
- Issued timestamp
- Expiration timestamp

### Password Hashing

- **Primary:** Argon2 (memory-hard, GPU/ASIC-resistant)
- **Fallback:** BCrypt-SHA256 (for migration compatibility)
- **Legacy support:** PBKDF2

### Security Features

- **AES-256-GCM encryption** for sensitive PII (DNI - national ID numbers)
- **Multi-tenant isolation** enforced at middleware level (no cross-organization data leakage)
- **CORS:** Configurable per environment (default: `http://localhost:5173`)
- **Security Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - **CSRF protection disabled** (stateless JWT API, no session cookies)

### Token Blacklist (Logout)

Revoked tokens are stored in Redis with TTL equal to remaining token lifetime. This prevents token reuse after explicit logout.

---

## Base Configuration

### Environment Variables

Key settings loaded from `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SETTINGS_MODULE` | `scdee.settings.dev` | Settings environment |
| `DJANGO_SECRET_KEY` | (required) | Django secret |
| `DJANGO_DEBUG` | `False` | Debug mode |
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `REDIS_URL` | `redis://redis:6379/0` | Redis cache |
| `CELERY_BROKER_URL` | `redis://redis:6379/1` | Celery message broker |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | `15` | Access token TTL |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | `7` | Refresh token TTL |
| `ENCRYPTION_MASTER_KEY` | (required) | AES-256-GCM key (hex, 32 bytes) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | CORS whitelist |

### Database

- **Engine:** PostgreSQL 5.1+
- **Timezone:** UTC (enforced at connection level)
- **Transactions:** ATOMIC_REQUESTS enabled (all requests wrapped in transaction)
- **Connection pooling:** Max age 600 seconds

### Cache

- **Backend:** Redis via django-redis
- **Default TTL:** 300 seconds (5 minutes)
- **Uses:**
  - Organization config cache
  - Token blacklist (logout)
  - General application cache

### Storage

- **Engine:** MinIO (S3-compatible)
- **Bucket:** Shared with per-organization prefixes
- **Presigned URLs:** Enabled with 900-second (15 min) default expiry
- **File overwrite protection:** Disabled (never silently overwrite)

### Async Tasks (Celery)

Three isolated queues:
1. **default** — General background tasks
2. **ocr** — CPU-intensive PDF/OCR processing
3. **notifications** — Email delivery

**Task limits:**
- Hard timeout: 5 minutes (300s)
- Graceful timeout: 4 minutes (240s)

---

## Project Phases & Roadmap

The system is implemented in **phases**, with clear separation of concerns:

### Phase 0 (Infrastructure & Core Models) — **CURRENT**

**Status:** COMPLETE  
**Focus:** Foundation, authentication design, multi-tenant isolation

**Completed:**
- ✓ Custom User model (UUID PK, encrypted DNI, per-org email uniqueness)
- ✓ Organization model (multi-tenant boundaries)
- ✓ Abstract base models (UUIDModel, TimestampedModel, OrganizationOwnedModel)
- ✓ Audit log model (immutable, append-only, PostgreSQL trigger protection)
- ✓ Health check endpoint (`GET /health/`)
- ✓ Exception handler (symbolic error codes)
- ✓ Pagination (offset-based per RNF-15)
- ✓ Middleware (multi-tenant context extraction)
- ✓ Logging (JSON structured, to stdout)

**Database models (read-only via migrations):**
- `accounts.User`
- `organizations.Organization`
- `audit.AuditLog`

### Phase 1 (Authentication & User Management) — **PLANNED**

**Expected endpoints:**
- `POST /auth/login/` — Credential-based authentication
- `POST /auth/refresh/` — Token refresh
- `POST /auth/logout/` — Revoke tokens
- `GET /users/` — List organization users (paginated)
- `POST /users/` — Create user
- `GET /users/{id}/` — User detail
- `PATCH /users/{id}/` — Update user
- `DELETE /users/{id}/` — Soft-delete user
- `GET /organizations/` — List organizations (superadmin only)
- `POST /organizations/` — Create organization (superadmin only)

**Roles implemented:** (matching frontend convention)
- `PROFESSOR` — Maps to Django `User.is_staff=True` + subject admin permission
- `STUDENT` — Regular user with limited access
- `SUPERADMIN` — System-level admin (`User.is_superadmin=True`)

### Phase 2 (Courses & Enrollment)

**Expected models:** Course, CourseEnrollment, CourseGroup

### Phase 3 (Subjects & Permissions)

**Expected models:** Subject, SubjectMembership, ExamGroup  
**Key feature:** Context-based permissions (RBAC by subject membership)

### Phase 4 (Exams & Problem Definition)

**Expected models:** Exam, ExamModel, Problem, ExamRubric, RecognitionZone

### Phase 5 (Instances & Grading)

**Expected models:** ExamInstance, StudentExamInstance, GradingTask, Grade

### Phase 6+ (Annotations, Ingestion, Reviews, Notifications)

---

## Implemented Endpoints

### GET /health/

**Health check endpoint for infrastructure monitoring.**

- **Auth:** Not required (AllowAny)
- **Method:** GET
- **Query params:** None
- **Request body:** Not applicable
- **Response status:** 
  - `200 OK` if all components healthy
  - `503 Service Unavailable` if any component unhealthy
- **Response body:**
  ```json
  {
    "status": "healthy|unhealthy",
    "components": {
      "postgresql": {
        "status": "healthy|unhealthy",
        "error": "optional error message"
      },
      "redis": {
        "status": "healthy|unhealthy",
        "error": "optional error message"
      },
      "minio": {
        "status": "healthy|unhealthy",
        "error": "optional error message",
        "note": "optional (e.g. bucket_not_found)"
      },
      "celery_workers": {
        "status": "healthy|unhealthy",
        "error": "optional error message",
        "workers": 2
      }
    }
  }
  ```
- **Notas:** 
  - Executes trivial DB query to check PostgreSQL
  - Tests Redis via `PING` command
  - Tests MinIO with `head_bucket()` call
  - Checks Celery worker responsiveness
  - No authentication required
  - Used by container orchestrators and monitoring tools

---

## Planned Endpoints by Phase

> **Note:** These endpoints are NOT yet implemented. This section documents the expected API contract based on requirements analysis (RF-* requirements from the TFG specification).

### Phase 1: Authentication

#### POST /auth/login/
**Credential-based authentication (RF-1.2)**

- **Auth:** Not required
- **Request body:**
  ```json
  {
    "email": "string (email format)",
    "password": "string"
  }
  ```
- **Response status:** 
  - `200 OK` on success
  - `400 Bad Request` if validation fails
  - `401 Unauthorized` if credentials invalid or user inactive
- **Response body (success):**
  ```json
  {
    "access": "string (JWT token)",
    "refresh": "string (JWT token)",
    "user": {
      "id": "UUID",
      "email": "string",
      "first_name": "string",
      "last_name": "string",
      "organization": "UUID",
      "is_staff": "boolean",
      "is_superadmin": "boolean"
    }
  }
  ```
- **Response body (error):**
  ```json
  {
    "error_code": "INVALID_CREDENTIALS|AUTHENTICATION_REQUIRED|VALIDATION_ERROR"
  }
  ```
- **Notas:**
  - Sets `last_login` timestamp
  - Logs LOGIN_SUCCESS or LOGIN_FAILED to audit log
  - Refresh token is rotative (new token issued per refresh)
  - Access token lifetime: 15 minutes (configurable)
  - Refresh token lifetime: 7 days (configurable)

#### POST /auth/refresh/
**Token refresh without credentials (RF-1.3)**

- **Auth:** Not required (token in body, not header)
- **Request body:**
  ```json
  {
    "refresh": "string (refresh token)"
  }
  ```
- **Response status:**
  - `200 OK` on success
  - `401 Unauthorized` if token invalid/expired/blacklisted
- **Response body:**
  ```json
  {
    "access": "string (new JWT token)",
    "refresh": "string (new refresh token)"
  }
  ```
- **Notas:**
  - Old refresh token is revoked (added to blacklist in Redis)
  - Rotation prevents replay attacks
  - Logs TOKEN_REFRESHED to audit log

#### POST /auth/logout/
**Revoke all tokens (RF-1.4)**

- **Auth:** Required (JWT)
- **Request body:**
  ```json
  {
    "refresh": "string (refresh token to revoke)"
  }
  ```
- **Response status:**
  - `204 No Content` on success
  - `401 Unauthorized` if token invalid
- **Response body:** Empty
- **Notas:**
  - Adds refresh token to Redis blacklist
  - TTL = remaining token lifetime
  - Logs LOGOUT event to audit log
  - Access token becomes unusable immediately

### Phase 1: User Management

#### GET /users/

**List organization users (paginated)**

- **Auth:** Required (JWT) — PROFESSOR or SUPERADMIN only
- **Query params:**
  - `page` (integer, default: 1) — Page number
  - `page_size` (integer, default: 25, max: 100) — Items per page
  - `search` (string, optional) — Filter by email/name
  - `is_active` (boolean, optional) — Filter active/inactive users
- **Response status:** 
  - `200 OK`
  - `401 Unauthorized`
  - `403 Forbidden` (insufficient permissions)
- **Response body:**
  ```json
  {
    "count": 142,
    "page": 1,
    "page_size": 25,
    "total_pages": 6,
    "next": "http://api/v1/users/?page=2",
    "previous": null,
    "results": [
      {
        "id": "UUID",
        "email": "string",
        "first_name": "string",
        "last_name": "string",
        "nia": "string (optional)",
        "is_active": "boolean",
        "is_staff": "boolean",
        "created_at": "ISO8601 datetime",
        "updated_at": "ISO8601 datetime"
      }
    ]
  }
  ```
- **Notas:**
  - Filtered by current organization (multi-tenant)
  - PROFESSOR can only list/create users in their organization
  - SUPERADMIN can list users across all organizations
  - DNI field is NEVER exposed (encrypted, server-side only)

#### POST /users/

**Create new user in organization**

- **Auth:** Required (JWT) — PROFESSOR or SUPERADMIN
- **Request body:**
  ```json
  {
    "email": "string (unique per organization)",
    "first_name": "string",
    "last_name": "string",
    "password": "string (min 8 chars, must include uppercase+digit)",
    "nia": "string (optional, unique per organization)",
    "is_staff": "boolean (optional, default: false)",
    "email_notifications_enabled": "boolean (optional, default: true)"
  }
  ```
- **Response status:**
  - `201 Created`
  - `400 Bad Request` if validation fails
  - `401 Unauthorized`
  - `403 Forbidden`
  - `409 Conflict` if email already exists in organization
- **Response body:**
  ```json
  {
    "id": "UUID",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "nia": "string",
    "is_active": true,
    "is_staff": "boolean",
    "created_at": "ISO8601 datetime",
    "updated_at": "ISO8601 datetime"
  }
  ```
- **Notas:**
  - Email must be unique within the organization (not globally)
  - Same person can have accounts in multiple organizations
  - Password is hashed with Argon2
  - Logs USER_CREATED to audit log
  - DNI not exposed or set during creation

#### GET /users/{id}/

**Retrieve user details**

- **Auth:** Required (JWT)
- **URL params:**
  - `id` (UUID) — User ID
- **Response status:**
  - `200 OK`
  - `401 Unauthorized`
  - `403 Forbidden` (if user belongs to different organization)
  - `404 Not Found`
- **Response body:**
  ```json
  {
    "id": "UUID",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "nia": "string",
    "is_active": "boolean",
    "is_staff": "boolean",
    "email_notifications_enabled": "boolean",
    "created_at": "ISO8601 datetime",
    "updated_at": "ISO8601 datetime"
  }
  ```

#### PATCH /users/{id}/

**Update user**

- **Auth:** Required (JWT) — User's own record or PROFESSOR/SUPERADMIN
- **URL params:** `id` (UUID)
- **Request body (partial update):**
  ```json
  {
    "first_name": "string (optional)",
    "last_name": "string (optional)",
    "nia": "string (optional)",
    "is_active": "boolean (optional, PROFESSOR only)",
    "is_staff": "boolean (optional, PROFESSOR only)",
    "email_notifications_enabled": "boolean (optional)"
  }
  ```
- **Response status:**
  - `200 OK`
  - `400 Bad Request`
  - `401 Unauthorized`
  - `403 Forbidden`
  - `404 Not Found`
- **Response body:** Updated user object (same as GET /users/{id}/)
- **Notas:**
  - Email cannot be changed
  - Password is changed via separate endpoint (not here)
  - Logs USER_UPDATED to audit log

#### DELETE /users/{id}/

**Soft-delete user**

- **Auth:** Required (JWT) — PROFESSOR or SUPERADMIN
- **URL params:** `id` (UUID)
- **Response status:**
  - `204 No Content`
  - `401 Unauthorized`
  - `403 Forbidden`
  - `404 Not Found`
- **Response body:** Empty
- **Notas:**
  - Sets `is_active=False` (soft delete, data preserved)
  - User cannot login after deletion
  - Logs USER_DELETED to audit log
  - Data remains in database for audit trail

#### POST /users/{id}/change-password/

**Change user password**

- **Auth:** Required (JWT) — User's own record or SUPERADMIN
- **URL params:** `id` (UUID)
- **Request body:**
  ```json
  {
    "current_password": "string (required if not SUPERADMIN)",
    "new_password": "string (min 8 chars, must include uppercase+digit)"
  }
  ```
- **Response status:**
  - `204 No Content`
  - `400 Bad Request`
  - `401 Unauthorized`
  - `403 Forbidden`
- **Response body:** Empty
- **Notas:**
  - SUPERADMIN can change any user's password without current password
  - Regular users must provide current password
  - Logs PASSWORD_CHANGED to audit log

### Phase 1: Organizations (SUPERADMIN only)

#### GET /organizations/

**List all organizations (superadmin only)**

- **Auth:** Required (JWT) — SUPERADMIN only
- **Query params:**
  - `page` (integer, default: 1)
  - `page_size` (integer, default: 25, max: 100)
  - `search` (string, optional) — Filter by name/subdomain
- **Response status:**
  - `200 OK`
  - `401 Unauthorized`
  - `403 Forbidden`
- **Response body:**
  ```json
  {
    "count": 5,
    "page": 1,
    "page_size": 25,
    "total_pages": 1,
    "next": null,
    "previous": null,
    "results": [
      {
        "id": "UUID",
        "name": "string",
        "subdomain": "string (unique)",
        "plan": "FREE|PREMIUM",
        "auth_mode": "JWT",
        "is_active": "boolean",
        "created_at": "ISO8601 datetime",
        "updated_at": "ISO8601 datetime"
      }
    ]
  }
  ```

#### POST /organizations/

**Create new organization (superadmin only)**

- **Auth:** Required (JWT) — SUPERADMIN only
- **Request body:**
  ```json
  {
    "name": "string",
    "subdomain": "string (lowercase, alphanumeric+dash, 3-63 chars, unique)",
    "plan": "FREE|PREMIUM (default: FREE)",
    "auth_mode": "JWT (only value in v1.0)"
  }
  ```
- **Response status:**
  - `201 Created`
  - `400 Bad Request`
  - `401 Unauthorized`
  - `403 Forbidden`
  - `409 Conflict` if subdomain already exists
- **Response body:** New organization object
- **Notas:**
  - Logs ORGANIZATION_CREATED to audit log
  - Creates MinIO prefix for this organization

---

## Data Models

### User Model

```python
class User(AbstractBaseUser):
    id: UUID (primary key)
    email: str (unique per organization, max 254 chars)
    first_name: str (max 150 chars)
    last_name: str (max 150 chars)
    organization: ForeignKey(Organization, null=True for SUPERADMIN)
    nia: str (optional, unique per organization, institutional ID)
    encrypted_dni: bytes (AES-256-GCM encrypted, never exposed)
    dni_nonce: bytes (encryption nonce, server-side only)
    is_active: bool (default: True, soft-delete when False)
    is_staff: bool (default: False, organization manager)
    is_superadmin: bool (default: False, system admin)
    email_notifications_enabled: bool (default: True)
    created_at: datetime (auto_now_add)
    updated_at: datetime (auto_now)
    password: str (hashed with Argon2, inherited from AbstractBaseUser)
    last_login: datetime (auto, inherited from AbstractBaseUser)
```

**Constraints:**
- UniqueConstraint: (email, organization)
- UniqueConstraint: (nia, organization) where nia != ""

**Indexes:**
- Index: (organization, is_active)

**Notes:**
- Email is unique **per organization**, not globally
- Same person can have multiple User accounts in different organizations
- DNI is stored encrypted with AES-256-GCM; never exposed via API
- `is_staff` semantics: organization manager (not Django admin access)
- `is_superadmin`: system-level admin, can manage organizations

### Organization Model

```python
class Organization(models.Model):
    id: UUID (primary key)
    name: str (max 255, e.g. "Universidad Autónoma de Madrid")
    subdomain: str (unique, indexed, 3-63 chars, e.g. "uam")
    plan: str choices ["FREE", "PREMIUM"] (default: "FREE")
    auth_mode: str choices ["JWT"] (default: "JWT", SAML/OIDC placeholder)
    is_active: bool (default: True)
    created_at: datetime (auto_now_add)
    updated_at: datetime (auto_now)
```

**Notes:**
- Top-level multi-tenant boundary
- Subdomain uniquely identifies organization
- Plan determines feature availability and quotas
- `auth_mode`: v1.0 only supports JWT; SAML/OIDC fields exist for future SSO plugins

### AuditLog Model

```python
class AuditLog(models.Model):
    id: UUID (primary key)
    organization: ForeignKey(Organization, null=True)
    event_type: str (indexed, e.g. "USER_CREATED", "GRADE_MODIFIED")
    actor: ForeignKey(User, null=True for system events)
    ip_address: str (IPv4/IPv6, null=True)
    timestamp: datetime (auto_now_add, indexed)
    entity_type: str (e.g. "User", "Exam")
    entity_id: str (PK of affected entity)
    payload: JSON (event-specific data, old/new values, etc.)
```

**Notes:**
- **IMMUTABLE:** Cannot be updated or deleted
- PostgreSQL trigger prevents SQL-level modifications
- Manager.update() and .delete() raise PermissionError
- Appended indefinitely (never deleted per RF-16.1)
- Supports business event audit trail and compliance

### Abstract Base Models

#### UUIDModel
```python
class UUIDModel(models.Model):
    id: UUID = models.UUIDField(primary_key=True, default=uuid.uuid4)
```
- Security: no sequential ID exposure
- Portability: globally unique across services
- Foundation for all business models

#### TimestampedModel (extends UUIDModel)
```python
class TimestampedModel(UUIDModel):
    created_at: datetime (auto_now_add, indexed)
    updated_at: datetime (auto_now)
```
- Automatic audit trail
- Ordered by -created_at by default

#### OrganizationOwnedModel (extends TimestampedModel)
```python
class OrganizationOwnedModel(TimestampedModel):
    organization: ForeignKey(Organization)
    objects: TenantManager()  # Auto-filters by current org
    unfiltered: UnfilteredManager()  # Bypass tenant filter (admin/system)
```
- Multi-tenant isolation enforced at manager level
- Every business entity extends this
- `objects.all()` → auto-filtered by request organization
- `unfiltered.all()` → escape hatch for admin/background tasks

---

## Error Handling

### Uniform Error Response Format

All API errors return symbolic (not human-readable) error codes per RNF-8.

**Single error response:**
```json
{
  "error_code": "ERROR_CODE"
}
```

**Validation error response (field-level):**
```json
{
  "error_code": "VALIDATION_ERROR",
  "errors": {
    "email": ["FIELD_REQUIRED"],
    "password": ["MIN_LENGTH"]
  }
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Input validation failed (field details in `errors`) |
| 401 | `AUTHENTICATION_REQUIRED` | Missing or invalid JWT token |
| 403 | `PERMISSION_DENIED` | User lacks required permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 405 | `METHOD_NOT_ALLOWED` | HTTP method not supported |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate email) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error (details logged, never exposed) |

### Validation Error Codes

Common field-level validation codes:
- `FIELD_REQUIRED` — Field is required but missing
- `INVALID` — Field value is invalid (generic)
- `MIN_LENGTH` — String shorter than minimum
- `MAX_LENGTH` — String longer than maximum
- `INVALID_EMAIL` — Email format invalid
- `UNIQUE` — Value must be unique (e.g., duplicate email)

### Error Handling Philosophy

- **Symbolic codes, never human text:** Allows clients to translate errors to user language
- **No information leakage:** Validation errors don't expose system internals
- **Unhandled exceptions logged:** Server logs full exception; client sees generic `INTERNAL_ERROR`
- **Field-level granularity:** Enables precise client-side error hints

---

## Pagination

All list endpoints use **offset-based pagination** (page number + page size) per RNF-15.

### Pagination Response Format

```json
{
  "count": 142,
  "page": 1,
  "page_size": 25,
  "total_pages": 6,
  "next": "http://api/v1/resource/?page=2",
  "previous": null,
  "results": [
    { "id": "...", ... }
  ]
}
```

### Query Parameters

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | integer | 1 | unlimited | Page number (1-based) |
| `page_size` | integer | 25 | 100 | Items per page |

**Example:**
```
GET /api/v1/users/?page=2&page_size=50
```

### Pagination Metadata

- `count` — Total items matching query
- `page` — Current page number
- `page_size` — Items per page
- `total_pages` — Calculated as ceil(count / page_size)
- `next` — URL to next page (null if last page)
- `previous` — URL to previous page (null if first page)
- `results` — Array of items for current page

---

## Multi-Tenant Architecture

### Tenant Isolation Mechanism

**Organization ID** is extracted from the JWT payload by `OrganizationMiddleware`:

1. Client sends JWT in `Authorization: Bearer <token>` header
2. Middleware decodes token and extracts `organization_id`
3. Sets `request.organization` context
4. All `OrganizationOwnedModel` queries automatically filtered to this organization
5. Users from Org A cannot access Org B's data (enforced at ORM level)

### Manager-Level Enforcement

```python
# Default: filtered by organization
User.objects.all()  # → Only users in request.organization

# Escape hatch: bypass tenant filter (admin/background tasks only)
User.unfiltered.all()  # → All users, all organizations
```

### Constraints

- Users have per-organization email uniqueness: `unique_together = (email, organization)`
- Same person can have accounts in multiple organizations
- Each account is a separate User record with separate password

---

## API Conventions

### URL Structure

- **Collections (plural nouns):** `/api/v1/users/`, `/api/v1/exams/`
- **Nested resources:** `/api/v1/subjects/{id}/exams/`
- **Custom actions (sub-paths):** `/api/v1/exams/{id}/publish/`

### HTTP Methods

- `GET /resource/` — List (paginated)
- `POST /resource/` — Create
- `GET /resource/{id}/` — Retrieve
- `PATCH /resource/{id}/` — Partial update
- `DELETE /resource/{id}/` — Delete
- `POST /resource/{id}/action/` — Custom action

### Status Codes

- `200 OK` — GET, PATCH successful
- `201 Created` — POST successful
- `204 No Content` — DELETE, POST logout successful
- `400 Bad Request` — Validation error
- `401 Unauthorized` — Missing/invalid authentication
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `409 Conflict` — Duplicate/constraint violation

### Datetime Format

All datetimes are ISO 8601 with timezone (UTC):
```
2026-04-20T14:30:45.123456Z
```

---

## Future Enhancements (Post v1.0)

### Phase 1.5: SSO Support (RF-1.5)

- SAML 2.0 authentication plugin
- OpenID Connect (OIDC) plugin
- Organization-level auth mode configuration
- External IdP metadata management
- No frontend changes required (JWT standard token)

### Planned Features (Phases 2-6)

See [Project Phases & Roadmap](#project-phases--roadmap) section.

---

## Testing

### Health Check Test

```bash
curl http://localhost:8000/health/
```

Expected response (200 or 503):
```json
{
  "status": "healthy",
  "components": {
    "postgresql": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "minio": { "status": "healthy" },
    "celery_workers": { "status": "healthy", "workers": 1 }
  }
}
```

### Test Suite

Run with pytest:
```bash
pytest backend/
```

---

## Documentation References

- **Requirements document:** `/docs/chapters/requirements/`
- **Authentication (RF-1):** `rf_auth.tex`
- **User management (RF-2):** `rf_users.tex`
- **Non-functional (RNF):** `rnf.tex`
- **OpenAPI schema:** `GET /api/schema/` (auto-generated by drf-spectacular)

---

## Implementation Notes

### Development Server

```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

### Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Async Tasks (Celery)

```bash
celery -A scdee worker -l info -Q default,ocr,notifications
```

### Environment Setup

Copy `.env.example` to `.env` and configure:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your settings
```

---

## Summary

The SCDEE backend is a **structured, multi-phase implementation** of a complex exam correction system. **Phase 0 (current)** provides the foundational infrastructure:

- Robust multi-tenant isolation
- Secure password hashing and DNI encryption
- Comprehensive audit logging
- JWT-based authentication (v1.0) with SSO-ready plugin architecture
- Health monitoring and structured logging

**Phase 1** will implement the authentication and user management endpoints documented in this contract. Subsequent phases will add exam management, grading workflows, annotations, and review systems, all following the same design principles and API conventions established here.

**Key design decisions:**
1. **Plugin-based authentication:** JWT in v1.0, SSO (SAML/OIDC) support added without breaking changes
2. **Multi-tenant by design:** Organization ID in every token, auto-filtered at ORM level
3. **Symbolic error codes:** Language-agnostic API, translation on client side
4. **Immutable audit trail:** PostgreSQL trigger protection, indefinite retention
5. **Async-ready:** Celery task queue with queue isolation for workload management

---

**Document generated:** 2026-04-20  
**API Version:** 1.0.0  
**Status:** Early implementation — Phase 0 complete, Phase 1 in progress
