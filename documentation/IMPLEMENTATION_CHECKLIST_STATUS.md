### Milestone 1: Schema-Driven API
- **1.1 JSON Schema Storage & Validation**
  - [x] Schema Storage System
    - [x] MongoDB collection for JSON Schemas (`SchemaDefinition` in `src/models/Schema.js`)
    - [x] Metadata (name, version, createdAt, updatedAt, description, displayName)
    - [ ] Unique constraints on schema names per tenant
      - Current: global `unique: true` on `name` (no tenant dimension)
    - [x] Schema validation before storage
      - Via `SchemaValidator.validateSchema` and Mongoose validators
  - [x] JSON Schema Validation Engine
    - [x] `ajv` + `ajv-formats` integrated (`src/utils/schemaValidator.js`)
    - [~] Custom rules: some structural checks; no advanced custom keywords
    - [x] Error handling
    - [ ] Performance optimization for repeated validations (no schema compile cache)

- **1.2 Auto-Generate MongoDB Collections**
  - [x] Dynamic Collection Creation
    - [x] Service to create models/collections (`CollectionGenerator.createDynamicModel`)
    - [x] Naming convention `dynamic_${schemaName}` (auto-set in `SchemaDefinition` pre-save)
    - [ ] Index creation based on schema properties
    - [x] Cleanup mechanism for unused collections (drop on delete in `SchemaService.deleteSchema`)
  - [x] Schema-to-Collection Mapping
    - [x] Registry/cache of active schemas (`CollectionGenerator.dynamicModels` Map)
    - [x] Collection metadata stored (`SchemaDefinition.collectionName`)
    - [x] Relationship handling (extracted in `SchemaDefinition` pre-save; used by `ReferenceResolver`)

- **1.3 Dynamic CRUD Endpoints**
  - [x] Automatic Endpoint Generation
    - [x] Dynamic param-based routes (`/api/data/:schemaName`) in `dynamicRoutes.js`
    - [x] Standard CRUD (GET list/id, POST, PUT, PATCH, DELETE) + `/count`, `/search`, `/stats`, bulk create
    - [x] Query support (filter, sort, pagination, optional reference population)
    - [~] Endpoint naming: uses `/api/data/:schemaName` (no tenant prefix)
  - [ ] NestJS Integration (project is Express, not NestJS)
    - Not applicable: no NestJS controllers/services/DTOs or Nest Swagger generation

- **1.4 Live Schema Hot-Reload**
  - [~] Schema Change Detection
    - [x] MongoDB change streams for dynamic collections (audit) via `ChangeStreamService`
    - [ ] Change stream watching the schemas collection (not present)
    - [x] Manual event path via `/api/schemas/:name/reload` and `SchemaService.updateSchema` regenerates model
    - [x] Cache invalidation (`CollectionGenerator.removeDynamicModel`)
  - [x] Runtime Updates
    - [x] Hot-reload models without server restart
    - [x] Update validation rules dynamically (AJV compiled on demand)
    - [ ] Refresh generated controllers/services (controllers are static)
    - [~] Graceful handling of active requests (general try/catch; no special draining logic)

### Milestone 2: Audit Trail & Rollback
- **2.1 Change Logging via MongoDB Change Streams**
  - [x] Change Streams setup for dynamic collections (`ChangeStreamService`)
  - [x] Event filtering, async handling, and retry/backoff on error
  - [x] Error handling and retry mechanisms
- **2.2 Audit Log Structure**
  - [x] Standardized schema (`AuditLog`) with before/after, operation, user, timestamps
- **2.2 Versioned Record Snapshots**
  - [x] Full snapshots per change
  - [ ] Delta storage
  - [~] Retention policies (TTL index commented; cleanup endpoint implemented)
  - [x] Cross-reference between live and snapshots via version numbers and `revertedFrom`
- **2.3 API to Revert Records**
  - [x] Rollback Endpoints (single: `POST /api/audit/:schema/:recordId/revert/:version`; bulk)
  - [x] Preview mode via `GET /version/:version` and version comparison API
  - [~] Rollback validation/conflicts: basic only; no complex detection
  - [ ] Transaction support across multi-doc rollbacks
  - [x] Rollback history tracking (`revertedFrom`, versioning)
- **2.4 UI Hooks for Admin Replay**
  - [x] Audit viewing endpoints (history, versions, stats, summary)
  - [x] Version comparison
  - [x] Rollback controls via API endpoints
  - [ ] Real-time updates to UI (no websockets/BullMQ)
- **Background Processing**
  - [ ] BullMQ/Redis queues
  - [ ] Job monitoring/failure handling via queue
  - [~] Performance metrics: logs only

### Milestone 3: Offline Sync & Access Control
- **3.1 Offline Sync**
  - [ ] `/sync/changes?since=` endpoints
  - [ ] Delta sync algorithms and pagination for sync
  - [ ] Schema-specific sync endpoints
  - [~] Last-modified tracking fields exist (`createdAt`, `updatedAt`) in dynamic docs
- **3.1 Batch Update Endpoint**
  - [~] Bulk create exists; no mixed-operation batch endpoint
  - [ ] Transaction support for batch
  - [~] Validation per record; not all-or-nothing batch validation
  - [ ] Partial success reporting for multi-op batch (not applicable)
- **3.2 Conflict Resolution**
  - [ ] Conflict detection (LWW/vector clocks/field-level) not implemented
  - [ ] Resolution mechanisms and history not implemented
- **3.3 JWT Authentication & Authorization**
  - [x] JWT token generation/verification (`AuthService`)
  - [x] Refresh token mechanism (`refreshToken` method; check `authRoutes` for route)
  - [x] Token expiration and issuer/audience config
  - [~] Secure storage recommendations (in docs)
- **3.3 Guards**
  - [x] Authentication, role-based, permissions, and tenant guard middlewares (`auth.js`)
  - [ ] NestJS Guards (not applicable)
- **3.4 Role & Tenant-Based Access Control**
  - [x] Predefined roles (admin, office, technician, customer)
  - [ ] Custom role creation (roles enum is fixed)
  - [~] Hierarchy: admin is superuser; no inheritance chain
  - [x] Permission assignment via base permissions and per-user `permissions`
  - [~] Tenant Isolation
    - [x] Tenant context enforced for users via middleware
    - [~] Dynamic data doesn’t enforce `tenantId` on documents by default; not part of generated schemas
  - [ ] Field-level and row-level permissions
  - [~] Dynamic permission evaluation: resource/action checks exist; no field/row rules

### Cross-Milestone Technical Requirements
- **Database Setup**
  - [~] MongoDB connection and bootstrap done; pooling not explicitly tuned
  - [~] Replica set script exists (`setup-replica-set.bat`); prod config not wired in code
  - [~] Indexes: present on `User`, `AuditLog`; no auto-indexing for dynamic models
  - [ ] Backup/recovery procedures (not in code)
- **API Design**
  - [~] Consistent HTTP codes and response shape via `responseHelper`
  - [~] Error format is consistent; no global correlation IDs
  - [ ] API versioning strategy
  - [ ] Content negotiation
- **Error Handling & Logging**
  - [x] Global error handler middleware
  - [x] Validation errors with messages
  - [x] Business logic errors surfaced
  - [~] Logging via morgan/console; no structured logs/correlation IDs or perf metrics
- **Testing**
  - [ ] Unit tests (services/controllers)
  - [ ] Integration tests
  - [ ] Auth/authorization tests
  - [ ] Sync tests
- **Documentation**
  - [x] OpenAPI docs served at `/api/docs` (from `documentation/openapi.yaml`, with fallback)
  - [~] Examples/usage scenarios likely in docs; auth docs exist
  - [~] Error code reference partial in messages

### Verification Questions
- Milestone 1:
  1) Create JSON Schema via API? Yes: `POST /api/schemas` (auth + permissions).
  2) Auto-generate collection on schema creation? Yes: dynamic model/collection created with name `dynamic_${name}`.
  3) CRUD endpoints immediately available? Yes: `/api/data/:schemaName` routes.
  4) Modify schema and see changes without restart? Yes: `PUT /api/schemas/:name` regenerates model; also `/api/schemas/:name/reload`.

- Milestone 2:
  1) Are data changes logged automatically? Yes: via `DynamicCrudService` and Change Streams.
  2) View complete history? Yes: `/api/audit/:schema/:recordId/history` and versions endpoints.
  3) Rollback to previous version? Yes: `POST /api/audit/:schema/:recordId/revert/:version` and bulk revert.
  4) Audit performs under load? Basic async + retry implemented; no queue/backpressure metrics.

- Milestone 3:
  1) Offline `/sync/changes`? Not implemented.
  2) Conflict detection/resolution? Not implemented.
  3) Endpoints protected with JWT? Yes: `authenticate`, role/permission checks across routes.
  4) Restrict access by roles/tenant? Roles/permissions enforced; tenant isolation middleware present, but dynamic data lacks enforced `tenantId` on records by default.

### High-signal gaps to address next
- Add per-tenant dimension for schemas and data: enforce unique schema per tenant and include `tenantId` in generated dynamic schemas and queries.
- Add schema-level change stream for `SchemaDefinition` to hot-reload automatically on schema updates.
- Implement index generation from JSON Schema and AJV compile caching.
- Implement offline sync APIs and conflict resolution strategy.
- Add transactions for rollback/batch operations where needed.
- Introduce structured logging with correlation IDs and API versioning.
- Add tests (unit/integration) and CI.
