# Handset Inventory, Sales & Customer Feedback Dashboard

Foundation, database layer and Module 2 authentication for Jazz Experience Centers. Inventory/sales database structures exist; inventory/sales features, exports and feedback remain future modules. Module 2 adds password authentication and SQL-backed sessions. The API denies every route unless explicitly public; only health probes and non-production Swagger are exposed by the scaffold.

## Prerequisites and setup

- Node.js 24 LTS (see .nvmrc), pnpm 10, Git.
- An existing reachable SQL Server database and SQL login; provision the database outside this application. No Docker setup is required.
- Keep the Nest API on a private network in production. Terminate HTTPS at the Next.js deployment/reverse proxy.

```powershell
npm install --global pnpm@10.28.2
pnpm install --frozen-lockfile
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
# Edit the two local files, supplying real connection settings.
pnpm dev
```

Web: http://localhost:3000. API probes: http://localhost:3001/health/live and /health/ready. Development Swagger: http://localhost:3001/api/docs (also proxied at http://localhost:3000/api/docs). Business routes will use /api/v1. No business routes exist yet.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm --filter @handset/api start
pnpm --filter @handset/web start
```

Set NODE_ENV=production in the API deployment environment when starting production builds. Next sets production mode for its production server. API startup needs SQL connectivity; web build needs API_URL but does not contact the API. Unit/HTTP tests use a mocked DataSource and require no SQL Server. The API deliberately fails startup if the initial database connection fails; once started, readiness returns 503 during a database outage while liveness remains healthy.

## Layout

```text
apps/
  api/src/
    common/          public marker, default-deny guard, sanitized errors
    config/          environment, connection parsing, structured logging
    database/        entities, CLI DataSource, migrations and seeds
    health/          live/ready probes
  api/test/          HTTP boundary tests with a mocked database
  web/app/           App Router placeholder
  web/security.mjs   proxy validation and response security headers
packages/shared/src/ PKT boundary utilities and tests
docs/BRD-summary.md   domain brief for later modules
AGENTS.md            standing implementation rules
```

## Database conventions

Only DATABASE_URL configures the application connection. DATABASE_MIGRATION_URL optionally overrides it for CLI migrations; never provide a blank override. DB_POOL_MAX defaults to 10 and DB_CONNECT_TIMEOUT to 15000 milliseconds. Both must be positive integers (pool maximum 1000). Configuration errors never include input values.

Supported formats:

```text
mssql://user:encoded_password@host:1433/database?encrypt=true&trustServerCertificate=false
Server=host,1433;Database=db;User Id=user;Password="quoted;password";Encrypt=true;TrustServerCertificate=false
```

URL credentials must be percent-encoded once with encodeURIComponent; ADO values are literal, not URL-decoded. Quote ADO values containing semicolons or leading/trailing spaces; double the delimiter to escape it. ADO keys are case-insensitive. Only the documented keys/options are accepted, so typos fail fast. TCP hosts with optional ports and IPv6 are supported; named instances and integrated authentication are outside this scaffold. Encryption defaults to true and certificate trust bypass defaults to false. Local self-signed SQL certificates may require explicitly enabling trustServerCertificate; use validated certificates for deployments.

TypeORM synchronize, automatic migration execution and query logging are disabled. Module 1 registers 19 entities and a reversible initial migration; see [Database documentation](docs/DATABASE.md). UTC driver handling is explicit. The driver-specific translation is isolated in config/database.ts for a future database change.

Run migrations from the API package context (root scripts below handle that):

```sh
pnpm --filter @handset/api migration:show
pnpm --filter @handset/api migration:generate src/database/migrations/DescribeChange
pnpm --filter @handset/api migration:run
pnpm --filter @handset/api migration:revert
```

Generation is for future entity changes; it needs a reachable database and registered entities. Review generated SQL before applying it. All Module 1 entities are registered in both runtime and CLI configuration. Production migration jobs should use the same source checkout with CLI dependencies, execute reviewed migrations before application rollout, and keep migration credentials out of application runtime configuration.

## Security and time

The global AuthGuard validates SQL-backed sessions. Login, password changes, CSRF, lockout and permission checks are implemented; center/cluster query scoping and user administration are implemented in Module 3. See docs/AUTH.md for the complete auth design.

CORS is not enabled. Browsers call the Next origin, which rewrites /api/* to API_URL. Deployment must prevent direct public access to Nest; CORS is not authentication or CSRF protection.

Logs allowlist request ID, method and status, omitting URLs, headers, bodies and raw errors. IDs are generated by the API, not trusted from callers. Explicit sensitive-field redaction adds a second layer. Future code must not log arbitrary objects or exception messages containing PII/secrets.

Page scripts use a per-request nonce CSP. Production excludes script unsafe-inline and unsafe-eval; inline styles remain permitted. Other headers prohibit framing, restrict browser capabilities and enable production HSTS. Production HTTPS is required.

Shared date helpers return UTC instants for the fixed Asia/Karachi UTC+05 calendar. Day-1 uses half-open yesterday bounds; month/year starts use PKT, not the host timezone. Future MTD/YTD queries should share these helpers and an explicit as-of instant.

## Tooling and dependency rationale

- Next, React and React DOM provide the requested App Router UI; Nest core/platform and RxJS provide the API runtime.
- TypeORM, its Nest integration and mssql provide SQL Server access and migrations; dotenv loads CLI configuration.
- Nest config validates startup settings; class-validator/class-transformer enforce DTO boundaries.
- Nest Swagger generates non-production API docs; helmet and compression supply HTTP hardening and compression.
- pino, pino-http and nestjs-pino provide structured, redacted request logs; reflect-metadata supports decorators.
- TypeScript, framework CLIs, ts-node and type packages compile/check source and execute migration tooling.
- Jest, ts-jest, Nest testing and supertest validate API behavior; Vitest validates web configuration and shared dates.
- ESLint/typescript-eslint, Prettier, Husky and lint-staged enforce consistent code before commits.

Use Conventional Commits, for example `chore: scaffold handset portal`. Install Git hooks with `pnpm prepare` after initializing or cloning a Git repository. Each future task must leave lint, typecheck and tests passing. Do not commit real .env files.

## Local Windows tooling used for validation

Node.js and pnpm were absent from PATH on this machine. A checksum-verified portable Node.js 24 and pnpm were installed under the current user's local app-data folder. To use this installation in a fresh PowerShell session, run:

```powershell
$portalTools = Join-Path $env:LOCALAPPDATA 'HandsetPortalTools'
$portalNode = (Get-ChildItem -LiteralPath $portalTools -Directory -Filter 'node-v24.*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1).FullName
$env:Path = "$portalNode;$portalTools;$env:Path"
pnpm.cmd --version
```

Then follow the setup commands above. The repository is initialized locally with Husky hooks; no commit or remote was created. Dependency versions are recorded in pnpm-lock.yaml.

Validation completed: lint, strict typecheck, all three package builds, 51 automated tests, formatting, and a running production web smoke test covering the page, security headers and proxy against a temporary mock upstream. This paragraph records the initial scaffold checks. Module 1 migration and seed verification is documented in docs/DATABASE.md.

## Module 1 database commands

See [docs/DATABASE.md](docs/DATABASE.md) for the ER diagram, constraints, seed behavior and SQL Server-specific details. Run pnpm db:migrate, then pnpm db:seed; pnpm db:status reports pending migrations. Configure optional DB_SCHEMA, TEST_DATABASE_URL and SEED_ADMIN_* in apps/api/.env. Demo data is disabled by default. Added dependency: argon2 provides argon2id hashing for optional initial administrator provisioning.

## Module 2 authentication

See [docs/AUTH.md](docs/AUTH.md). Apply pnpm db:migrate before starting the API. Configure CSRF_SECRET and ALLOWED_ORIGINS in apps/api/.env and match SESSION_COOKIE_NAME in the web environment. Visit /login; bootstrap users must change their password before the protected placeholder. Tests use an isolated schema when TEST_DATABASE_URL is supplied. New dependencies: @nestjs/schedule for retention, @nestjs/throttler for rate counters, cookie-parser and its type package for session cookie parsing.

## Module 3 administration

Apply pnpm db:migrate, then sign in with a users.manage account. Use /admin/users to create users and manage sessions, /admin/roles for permission grants, and /admin/centers for centers and cluster mapping. Scope enforcement and safety rules are documented in [docs/RBAC.md](docs/RBAC.md). Older sessions may require one new login after the fingerprint update. The global handset catalog is provided by Module 4 below.

## Module 4 handset catalog

Run pnpm db:migrate and pnpm db:seed, then open /catalog. Managers can create global handset definitions; administrators can manage records and import CSV. See [docs/CATALOG.md](docs/CATALOG.md) for normalization, duplicates, optimistic concurrency, stock-blocked deactivation, import limits and tests. Catalog work adds csv-parse for streaming CSV parsing. Module 5 is not included.
