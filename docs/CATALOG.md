# Handset catalog — Module 4

The catalog contains global brands, models, specifications, colors and SKUs. Creating a handset makes its definition available to every center. Catalog queries deliberately do **not** use CenterScope. No inventory editing, sales ingestion or business dashboard is included.

## Model and permissions

Brand → Model → Specification; each SKU identifies one Model + optional Specification + Color. Specifications must belong to the SKU's model. The SKU identity and generated code are immutable through the API. Catalog records retain history through isActive; no DELETE routes exist.

| Default role                 | Read (`dashboard.view`) | Create (`masterdata.create`) | Manage/import (`masterdata.manage`) |
| ---------------------------- | ----------------------- | ---------------------------- | ----------------------------------- |
| SYSTEM_ADMIN                 | Yes                     | Yes                          | Yes                                 |
| EXPERIENCE_CENTER_MANAGER    | Yes                     | Yes                          | No                                  |
| EXPERIENCE_CENTER_SUPERVISOR | Yes                     | No                           | No                                  |
| HEAD_OF_EXPERIENCE_CENTERS   | Yes                     | No                           | No                                  |
| CLUSTER_HEAD                 | Yes                     | No                           | No                                  |
| OTHER_STAKEHOLDER            | Yes                     | No                           | No                                  |

Permissions remain configurable through role administration. Import requires masterdata.manage, including when explicitly granted to a non-SYSTEM_ADMIN role. Manage does not implicitly grant create or read. An override of a near duplicate also requires masterdata.create. The API checks permissions independently of UI visibility. Mutations require the existing session, Origin and CSRF protections, and recheck authorization after acquiring the transaction lock.

The migration replaces masterdata.edit with masterdata.create and masterdata.manage. Roles that had a customized legacy edit grant receive both new grants, preserving their previous authority; default managers receive create. Custom grants are not deleted. Down collapses either new grant into legacy edit, so rollback can broaden a create-only role's old master-data authority. Review role permissions before running older application code after rollback. Permission changes are read fresh without revoking sessions.

Seeds now add missing default mappings as explicitly required by Module 4. Repeat seeding preserves extra custom grants but **restores removed default grants**. Administrators should not rerun seeds to preserve an intentional removal of a default grant. Existing account passwords remain untouched. Canonical colors include Black, White, Blue, Green, Red, Silver, Gold, Grey, Purple, Pink, Titanium, Orange, Yellow, Brown and Beige.

## Names and duplicates

CatalogNormalizer strips Unicode control/format characters, trims and collapses whitespace, and preserves cleaned display casing. API maxima: brand 50, model 100, color 40, specification label 50 characters. Keys use NFKD Unicode normalization, remove accent marks, lowercase, and retain only Unicode letters and numbers. Thus `Galaxy  A16`, `GALAXY-A16`, and `galaxy a16` share a key.

Persisted name_key columns use binary collation. Unique constraints cover brands/colors globally, models within a brand, and specifications within a model. The existing display-name constraints remain. Inactive records still reserve their keys. Search is a normalized key prefix. The unique indexes support prefix and parent/key lookup; SKU indexes support model/spec/color filters.

Exact duplicates return 409 DUPLICATE with existing records and cannot be overridden. Near duplicates return 409 POSSIBLE_DUPLICATE with up to 20 candidates. Similarity includes edit distance at most two when both keys exceed four characters, and containment. Comparisons for models/specifications remain inside their parent. A caller with create permission may explicitly resend confirmDistinct=true; the UI requires a separate confirmation button. Confirmation never bypasses exact uniqueness.

RAM and storage are positive SQL integers supplied together. With dimensions, the label is generated as `8GB/128GB`; an explicitly supplied equivalent label is accepted. Free-text labels require both dimensions to be null. Feature phones may instead have no specification, producing one SKU per color.

Backfill preserves existing display names, including historical names longer than the new API limit. If an existing name yields an empty/oversized key or two records collide, the migration fails atomically and reports table/record IDs. It does not merge historical catalog or inventory records. An operator must resolve those records before retrying.

## API

All paths below are prefixed by `/api/v1/catalog`. List endpoints use page/pageSize (default 1/25, maximum 100). `includeInactive=true` is honored only for manage users. Active-only reads also require active parent records, colors and specifications. Internal normalization and actor columns are excluded from responses.

| Method | Path                                                       | Permission / behavior                                                      |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| GET    | /brands, /brands/:id                                       | dashboard.view; list/detail                                                |
| GET    | /models, /models/:id                                       | dashboard.view; brandId, search, isActive filters; counts and detail       |
| GET    | /colors                                                    | dashboard.view                                                             |
| GET    | /skus                                                      | dashboard.view; brandId/modelId/colorId/specificationId/search             |
| GET    | /lookups                                                   | dashboard.view; active brand/color pages and per-brand active model counts |
| POST   | /brands, /colors, /models                                  | masterdata.create                                                          |
| POST   | /models/:id/specifications                                 | masterdata.create                                                          |
| POST   | /models/:id/skus                                           | masterdata.create; immutable variant creation                              |
| POST   | /handsets                                                  | masterdata.create; complete atomic handset creation                        |
| PATCH  | /brands/:id, /models/:id, /colors/:id, /specifications/:id | masterdata.manage; rowVersion required                                     |
| POST   | /brands/:id/activate or /deactivate                        | masterdata.manage; rowVersion required                                     |
| POST   | /models/:id/activate or /deactivate                        | masterdata.manage; rowVersion required                                     |
| POST   | /colors/:id/activate or /deactivate                        | masterdata.manage; rowVersion required                                     |
| POST   | /specifications/:id/activate or /deactivate                | masterdata.manage; rowVersion required                                     |
| POST   | /skus/:id/activate or /deactivate                          | masterdata.manage; rowVersion required                                     |
| GET    | /import/template                                           | masterdata.manage; downloadable CSV                                        |
| POST   | /import?dryRun=true                                        | masterdata.manage; multipart field `file`                                  |

Model detail includes separate paginated `specifications` and `skus` envelopes. The same page/pageSize applies to both, preventing an unbounded detail response. Lookups also return two paginated envelopes; clients can fetch subsequent pages. The model list reports distinct colors from visible SKUs.

PATCH requires the displayed rowVersion. An atomic compare/update returns 409 CONFLICT if stale. SKU identity cannot be patched. Status operations also require rowVersion. A deactivated brand cascades to models and SKUs; model/color/specification deactivation cascades to affected SKUs. Specifications retain their own status when their model/brand is deactivated but are hidden by parent visibility. Reactivating a parent does not automatically reactivate children; child activation requires all its parents to be active.

Deactivation uses a serializable transaction and blocks with 409 HAS_STOCK when any affected SKU has positive stock. This is a global integrity check, an explicit exception to business-query scoping for this global operation. The error's center/quantity details are scoped using freshly resolved CenterScope.applyToQuery and capped at 100 centers; stock outside scope blocks the operation without disclosing its location or quantity. Future inventory writes must validate catalog activity in their transaction.

Business writes and audits share the same transaction. CREATE produces one audit per new entity; updates record each changed field. Every entity created by one handset request shares its request_id. Catalog and role administration serialize on the same schema-specific application lock, followed by session/permission revalidation. SQL constraints remain the final uniqueness defense. Unexpected errors expose neither SQL text nor stack traces.

## Add Handset

The default catalog view lists individual handset variants across all brands. **Add handset** is above the brand, color, RAM, storage and model/SKU-prefix filters. Filters run on the server before pagination; clearing them returns to all active variants. Managers can open **Manage catalog records** for brand/model/color maintenance.

Each SKU has an optional selling **price in PKR**, stored as `decimal(12,2)`. Existing and CSV-imported variants have no price until one is set; the UI shows **Not set**, distinct from zero. Prices accept up to ten whole-number digits and two decimal places. API prices are decimal strings or null, never floating-point request values. The final handset-creation step supports a default price plus individual variant overrides; additional variant creation also accepts `price`.

`PATCH /api/v1/catalog/skus/:id/price` requires `masterdata.manage`, a current `rowVersion`, and `price` (a decimal string or null to clear it). It revalidates permissions inside the transaction and writes the price change and audit together. It cannot change SKU identity. `POST /handsets` optionally accepts `variantPrices`, each containing a zero-based `colorIndex`, a zero-based `specificationIndex` (null for a handset with no specifications), and `price`. Duplicate or out-of-range variant indexes are rejected atomically.

`GET /skus` includes `modelName`, `brandId`, `brandName`, price, color, and specification. It accepts `ramGb` and `storageGb` in addition to the existing filters. `GET /specifications` is a paginated, read-permission-protected lookup for the filter choices. SKU list enrichment uses batched queries rather than one query per row. The CSV format remains compatible; imported prices can be entered using **Edit price**.

Open `/catalog`, choose **Add handset**, select an existing brand or enter a new one, enter the model, add RAM/storage combinations (or choose a feature phone), select canonical colors/add new colors, and review the complete cross-product of variants. Duplicate errors show candidates and require explicit confirmation. At most 30 specifications and 30 colors are accepted per request.

All steps submit one transaction. Any invalid reference, exact/near duplicate or later insertion failure rolls back every newly created record and audit. Generated SKU codes use uppercase ASCII key fragments in `BRAND-MODEL-RAM-STORAGE-COLOR` form; feature-phone dimensions use NA. Fragments are bounded, non-ASCII-only fragments use ITEM, and a numeric suffix resolves code collisions. Renaming a master does not change existing SKU codes.

## CSV import

```csv
brand,model,ram_gb,storage_gb,color
Samsung,Galaxy A16,4,128,Black
Samsung,Galaxy A16,4,128,Blue
FeatureBrand,FeaturePhone,,,Black
```

UTF-8 (optional BOM), exact header order, `.csv` filename, accepted MIME text/csv, application/csv or application/vnd.ms-excel. Upload limit is 2 MB and 1000 data rows; each parsed record is bounded. Multer bounds the uploaded buffer, then csv-parse consumes it as a stream with quoted-field and malformed-input handling. Neither original filenames nor upload contents are logged.

dryRun defaults to true. Preview simulates earlier accepted rows so later rows can reuse their entities. Results include would create, already exists, possible duplicate, or invalid plus a reason. Existing inactive references are invalid. Exact active records are reused, not duplicated. Formula-leading echoed cells (`=`, `+`, `-`, `@`, including leading whitespace) are prefixed with an apostrophe. CSV template cells use the same protection; browser output is React-escaped text.

Apply revalidates current database state rather than trusting preview data. It skips invalid/possible-duplicate rows and applies all accepted rows in a single transaction. Unexpected failures roll back the entire apply, including the MASTER data_import_batches record and audits. Batch counts include already-existing valid rows as accepted. A rejected row never contributes staged records to subsequent rows. Import does not provide a duplicate override; resolve such cases interactively.

## Verification and limitations

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd format:check
# Explicit non-production TEST_DATABASE_URL in apps/api/.env:
pnpm.cmd --filter @handset/api exec jest --runInBand test/catalog.integration.spec.ts
pnpm.cmd --filter @handset/api exec jest --runInBand test/database.integration.spec.ts
pnpm.cmd db:migrate
pnpm.cmd db:seed
```

SQL tests use an isolated schema and synthetic users, then remove their own schema. Coverage includes normalized backfill and permission migration, role checks, atomic rollback, duplicate confirmation, stale versions, stock blocking/cascades, immutable SKUs, CSRF, import dry-run/apply, malformed/oversized files, and correlated audits. Unit tests cover normalization thresholds and CSV injection. Browser-fetch tests verify multipart boundaries, CSRF and structured errors.

No master merging, hard deletes, cross-tenant catalog, asynchronous import jobs, inventory management, sales, or dashboard calculations are included. The initial bounded import planner loads catalog masters to simulate duplicate/reuse decisions; very large catalogs may need a database-backed staging design later. Canonical colors are seeded but business-specific synonyms are not automatically merged.

Dependency added: csv-parse provides a maintained streaming CSV parser with correct escaping, quoted fields, record limits and malformed-input rejection.
