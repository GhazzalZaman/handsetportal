# Role administration and Experience Center scope — Module 3

Module 3 provides user, role permission, center and cluster administration. Module 4 adds the global handset catalog; see [CATALOG.md](CATALOG.md). Inventory and sales endpoints remain for later modules.

## Default roles and permissions

These are seed defaults, not immutable grants. Repeat seeds add missing defaults and preserve extra custom grants. Module 4 intentionally restores missing default grants; avoid reseeding if those defaults were deliberately revoked.

| Role                         | Scope    | Default permissions                                                                                                    |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| SYSTEM_ADMIN                 | ALL      | dashboard.view, inventory.edit, masterdata.create, masterdata.manage, export.run, import.run, audit.view, users.manage |
| HEAD_OF_EXPERIENCE_CENTERS   | ALL      | dashboard.view, export.run, audit.view                                                                                 |
| CLUSTER_HEAD                 | CLUSTER  | dashboard.view, export.run                                                                                             |
| EXPERIENCE_CENTER_SUPERVISOR | CENTER   | dashboard.view, inventory.edit, export.run                                                                             |
| EXPERIENCE_CENTER_MANAGER    | CENTER   | dashboard.view, inventory.edit, export.run, masterdata.create                                                          |
| OTHER_STAKEHOLDER            | ASSIGNED | dashboard.view                                                                                                         |

Roles/codes/scope types are not editable through the API. The AssignedScope migration expands the role CHECK constraint and changes existing OTHER_STAKEHOLDER roles to ASSIGNED, with a system audit entry. New seeds use ASSIGNED. Down maps ASSIGNED back to CENTER; cluster-only users then have no center access. Review that access impact before rollback.

## Scope resolution

AuthGuard resolves request.scope for each authenticated request. ScopeService loads the active user, active role and current assignments, without a shared cache.

- ALL: IDs of every currently active center, including new centers.
- CLUSTER: centers in active assigned clusters, union direct center assignments.
- CENTER: direct center assignments only.
- ASSIGNED: the same union as CLUSTER, with either assignment type allowed.
- Inactive centers never enter scope. An inactive cluster stops granting indirect access; a direct assignment to an active center remains effective.
- No assignments means an empty set for every non-ALL role. Unknown/inactive roles fail closed.
- allCenters describes the role; it is **not** permission to skip filtering. ALL still filters to the resolved active center IDs.
- Role/assignment mutations revoke all of the affected user's sessions in the transaction. Center-to-cluster mapping, center status and cluster status are read fresh on the next request.

The parameterized IN predicate uses OPENJSON with a single JSON array parameter, avoiding SQL Server's 2100 parameter limit. This needs SQL Server 2016+ with database compatibility level 130+. See [Microsoft OPENJSON documentation](https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql). No database compatibility setting is changed automatically.

### Mandatory helper usage

```ts
@Get()
list(@Scope() scope: CenterScope, @Query() dto: PageDto) {
  return this.inventory.list(scope, dto);
}

// Repository/service, never controller business logic:
const query = manager.getRepository(InventoryStock)
  .createQueryBuilder('stock')
  .where('stock.quantityAvailable > :quantity', { quantity: 0 });

scope.applyToQuery(query, 'stock.centerId');
const [items, total] = await query
  .orderBy('stock.id', 'ASC')
  .skip((dto.page - 1) * dto.pageSize)
  .take(dto.pageSize)
  .getManyAndCount();
```

Pass a hard-coded developer alias to applyToQuery, never a URL/query parameter. Group OR predicates in brackets before applying scope; never replace the scoped WHERE or append an ungrouped OR afterward. Empty scope appends 1=0.

Use assertCanAccessCenter(id) for explicit center selection (403). For lookup by resource ID, use a scoped query and return 404 when missing/out of scope; assertCanAccessCenter(id, true) also returns 404. Center PATCH follows that rule. Inventory mutations must call assertCanEditCenter(id), which requires both inventory.edit and scope membership, and scope their SQL query. Re-resolve scope inside a write transaction where concurrent administrative changes matter.

## API

All routes below are under /api/v1. All lists return {items,total,page,pageSize}; page defaults to 1, pageSize to 25, maximum 100. Authenticated API responses use Cache-Control: no-store. Mutations require existing Origin and CSRF checks.

| Method and path                 | Behavior                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET /users                      | Paginated users; roleId, centerId, clusterId, isActive, search filters                                                |
| GET /users/:id                  | Explicit safe identity fields, role, centerIds and clusterIds, lastLoginAt, isActive, lockedUntil, mustChangePassword |
| POST /users                     | Create; optional temporaryPassword; returns {user,temporaryPassword} once                                             |
| PATCH /users/:id                | Display name, email, roleId and assignments; revoke sessions on role/assignment change                                |
| POST /users/:id/activate        | Activate account                                                                                                      |
| POST /users/:id/deactivate      | Deactivate and revoke sessions with USER_DEACTIVATED                                                                  |
| POST /users/:id/reset-password  | Generate temporary password, force change, clear lockout, revoke all sessions                                         |
| POST /users/:id/unlock          | Clear failed count and lockout                                                                                        |
| POST /users/:id/revoke-sessions | Revoke all sessions with ADMIN_REVOKED                                                                                |
| GET /users/:id/sessions         | Active session createdAt, lastSeenAt, ipAddress, userAgent truncated to 100 characters; no IDs/hashes                 |
| GET /roles                      | Role code/name/scopeType, permission codes and total assigned user count                                              |
| GET /permissions                | Active permission code catalog                                                                                        |
| PUT /roles/:id/permissions      | Replace exact canonical permission codes                                                                              |
| GET /centers                    | Active centers in caller scope; id/code/name/shortName/cluster                                                        |
| GET /clusters                   | Clusters containing at least one in-scope center                                                                      |
| GET /clusters/catalog           | Administrative catalog including empty/inactive clusters                                                              |
| POST /centers                   | Add center                                                                                                            |
| PATCH /centers/:id              | Rename, short name, cluster mapping, deactivate; target must be in caller scope                                       |
| POST /clusters                  | Add cluster                                                                                                           |
| PATCH /clusters/:id             | Rename or change active status                                                                                        |

Every route above except GET /centers and GET /clusters requires users.manage. Center/cluster reads require authentication but no dashboard permission, so later modules can use them as scoped reference lists.

Users/roles administration is global for any holder of users.manage; there is **no lower-role-only hierarchy**. User details expose assignment IDs as administrative metadata, but the center directory remains scoped. Center and cluster reference validation during user administration verifies existence/activity, not the administrator's center scope. Cluster catalog is an explicit administrative endpoint so new/empty clusters can be assigned before any center belongs to them. It does not expose center data.

User centerId/clusterId filters mean direct assignments, not effective inherited scope. User counts include inactive users. Codes and usernames cannot be renamed. Empty email becomes null in the UI; duplicate non-null emails and usernames are rejected case-insensitively with 409.

### Assignment validation

| Scope    | Required assignments           | Additional rule                             |
| -------- | ------------------------------ | ------------------------------------------- |
| ALL      | None                           | Reject any centers/clusters                 |
| CENTER   | At least one center            | Reject clusters (they would have no effect) |
| CLUSTER  | At least one cluster           | Direct centers allowed too                  |
| ASSIGNED | At least one center or cluster | Both allowed                                |

Referenced centers/clusters must exist and be active. Arrays must be unique and have at most 500 IDs each. PATCH merges omitted fields with current values, then validates the complete result. Changing to ALL must explicitly clear existing assignments. Usernames max 100, names max 160, emails max 254; temporary passwords follow the existing configured password policy.

### Safety and transactions

Admin services acquire a schema-specific SQL transaction application lock. Once acquired, they recheck that the actor's session is still valid and their active role still grants users.manage. This prevents a queued request from writing after another admin revokes its authorization.

Self-deactivation, self-role change and removal of one's own users.manage are blocked. SYSTEM_ADMIN must retain users.manage and audit.view. Before commit, the transaction verifies at least one active user with an active role and active users.manage grant remains. Concurrent admin changes serialize and cannot jointly remove all administrators. Locked/forced-password-change administrators still count as active, per the requirement; no recovery/MFA workflow is added.

Business changes and field-level audits commit together. USER assignment audits use ASSIGNED_CENTERS / ASSIGNED_CLUSTERS and sorted before/after IDs. Role grants are audited under entity type ROLE, one row per added/removed code; centers and clusters use CENTER/CLUSTER. Password values are always [REDACTED]. SQL unique violations map to safe DUPLICATE_VALUE responses without SQL text.

Role permission edits deliberately keep sessions working. IdentityRepository loads current grants on every request; its session fingerprint now binds role identity/scope and assignment IDs, not permission codes or the role row version. This supersedes Module 2's permission-change reauthentication behavior and the older standing rotation rule for this explicitly requested case. Sessions with the old fingerprint format require one fresh login after rollout.

Display name/email edits keep sessions valid. Password reset revokes all sessions and does not issue a session. Reset does not activate an inactive account. Previously validated in-flight reads cannot be recalled; admin mutations recheck session/permission state within their transaction.

## Web administration

Visit /admin/users, /admin/roles, /admin/centers. Every page checks the authenticated profile server-side; the API independently enforces permissions. The dashboard shows an Administration link only with users.manage. Proxy cookie-presence checks remain a convenience.

Forms use the existing CSRF-aware authFetch wrapper. Temporary passwords appear in a one-time panel with a copy button and warning; closing it drops the value from component state. They are never put in a URL, browser storage or logs. Copy is an explicit user action; clipboard contents are managed by the browser/OS. No automatic password download or email is performed.

## Assumptions and limitations

- No per-user permission overrides, approval workflow, SSO/AD, recovery, MFA or business dashboard.
- Administrative reference validation and global user management are authorized by users.manage; users with this permission must be trusted administrators even when their business scope is narrow.
- Center edits require an active center in the caller's current scope; inactive centers disappear from lists and cannot be reactivated via this module. History is retained. Cluster reactivation is available through its administrative catalog.
- Any users.manage holder can add centers. ALL roles see them immediately; other roles need an appropriate assignment.
- Assignment validation runs on complete PATCH state, so an old inactive assignment must be removed before saving that user.
- Role permission changes are immediately visible on the next API request; already rendered browser content updates on reload/navigation or the next action.
- Administration uses a transaction rather than a client version token. Concurrent writes serialize; the last accepted write wins.
- No new dependencies were added.

## Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check

# Configure TEST_DATABASE_URL explicitly in apps/api/.env (non-production).
pnpm --filter @handset/api exec jest --runInBand test/rbac.integration.spec.ts
pnpm --filter @handset/api exec jest --runInBand test/auth.integration.spec.ts test/database.integration.spec.ts
```

SQL suites skip explicitly when TEST_DATABASE_URL is absent. They create uniquely named schemas, use synthetic users, then undo their migrations and remove only their schema. Tests never silently fall back to the application database. Unit tests cover assignment combinations and scope assertions; SQL tests cover each scope type, empty and cross-center predicates against real rows, fresh mappings, last-admin/concurrency safeguards, revocation, password reset, validation, permission denial, auditing and captured-log password redaction.

For the optional real Next.js HTTP smoke checks, set AUTH_WEB_SMOKE=true in the test process before running the auth/RBAC suites. They start temporary API/web ports and use .next/auth-smoke. These verify HTTP redirects, server-rendered admin pages, permission denial and proxy mutations; they do not automate browser interaction. The database lifecycle test allows ten minutes for full up/down/up, demo seeding and cleanup on a remote SQL connection.

## Module 4 catalog boundary

Catalog masters are global. Catalog reads require dashboard.view; creation requires masterdata.create; correction/status/import requires masterdata.manage. Managers receive create by default; administrators receive both. Legacy customized masterdata.edit grants migrate to both permissions. Catalog data is not filtered by CenterScope. The global HAS_STOCK integrity gate exposes only scoped center details. See [CATALOG.md](CATALOG.md).
