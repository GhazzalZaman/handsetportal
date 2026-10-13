# Standing rules

These rules apply to every future task in this repository.

1. Session handling and auth
   - Server-side opaque sessions stored in the SQL database. Session ID = 256-bit cryptographically random value; store only a SHA-256 hash of it in the DB.
   - Cookie: name with __Host- prefix in production, httpOnly, Secure (production), SameSite=Lax, Path=/. Never expose session IDs or tokens to client-side JS, localStorage, or sessionStorage.
   - Idle timeout (default 30 min, sliding) and absolute timeout (default 8 h), both configurable via env.
   - Rotate the session ID on login and on any privilege/role change. Revoke all sessions on password change or user deactivation. Logout must destroy the session server-side.
   - CSRF protection for all state-changing requests (Origin/Referer check plus a CSRF token header).
   - Login rate limiting and account lockout after repeated failures. Generic error messages that do not reveal whether a username exists.
   - Passwords hashed with argon2id.
   - The browser only talks to the Next.js origin; Next.js rewrites/proxies /api/* to the Nest API so cookies are first-party. CORS on the API stays locked down.
2. Authorization
   - Deny by default: a global auth guard, with explicit @Public() for open routes.
   - RBAC and Experience Center scoping are enforced on the SERVER in every query. Never rely on UI hiding. Users must never receive data for centers outside their scope.
3. API hygiene
   - Helmet, compression, global exception filter that returns consistent error shapes and never leaks stack traces or SQL errors.
   - Every endpoint uses DTOs. Parameterized queries / query builder only, no string-concatenated SQL.
   - All list endpoints are paginated with a max page size.
   - API versioned under /api/v1. Health endpoints /health/live and /health/ready (ready must check DB connectivity).
   - Config validated at startup (fail fast on missing/invalid env).
4. Data and time
   - Store all timestamps in UTC. Business logic for "Day-1/today", MTD, and YTD uses the Asia/Karachi (PKT, UTC+5) calendar. Put this in one shared date utility with tests.
   - Every audited table has createdAt, updatedAt, createdBy, updatedBy. Soft delete where deletion is allowed.
   - Writes that change business data and their audit-log entries happen in the same DB transaction.
5. Quality
   - Small, focused modules (NestJS feature modules: controller, service, repository, dto, entity, tests). No business logic in controllers.
   - Unit tests for services, e2e tests for critical flows. Each task must leave lint, typecheck, and tests passing.
   - Conventional Commits. Do not add dependencies without a one-line justification in the summary.
   - Never log PII, passwords, connection strings, or session identifiers.

6. Module 3 scope requirements
   - Every center-bound business read, aggregate, export and write must use request.scope / @Scope() and CenterScope.applyToQuery with a developer-supplied alias. Never infer ALL from empty assignments or bypass the helper for ALL roles.
   - Group OR predicates before adding scope; never replace the scoped WHERE. Resource lookups return 404 outside scope; explicit center selection uses 403. Inventory edits additionally call assertCanEditCenter.
   - Resolve scope fresh for each request; re-resolve inside write transactions where needed. See docs/RBAC.md for examples and the users.manage administrative metadata boundary.
   - Per Module 3's explicit requirement, role permission edits preserve sessions and load permissions fresh on every request. User role/assignment changes revoke all sessions.

7. Module 4 catalog boundary
   - Catalog master data is global and intentionally does not use CenterScope. Require dashboard.view for reads, masterdata.create for creates, and masterdata.manage for correction/status/import.
   - The catalog deactivation stock-existence check is a global integrity exception; returned center/quantity details must still use freshly resolved CenterScope.applyToQuery. Never expose outside-scope stock details.
   - Future inventory mutations must check SKU and parent activity within the same transaction. See docs/CATALOG.md.

8. Module 5 stock and sales invariants
   - All stock changes go through InventoryService.changeStock. In one transaction it uses an atomic conditional UPDATE (decrements require sufficient quantity and affected-row verification), inserts inventory_movements, audits the change, and updates last_stock_update_at. No other application code may write inventory_stock; migrations may establish the initial ledger baseline.
   - Every sales query uses the shared applySalesVisibility helper, excluding voided_at IS NOT NULL by default. Explicit includeVoided reads and the void/idempotency workflows must opt in through that helper.
