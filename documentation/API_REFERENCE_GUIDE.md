# Craftsman Dynamic Backend Platform - Complete API Reference Guide

## 🎯 Platform Overview

The Craftsman Dynamic Backend Platform is a schema-driven, multi-tenant backend system that provides:
- **Dynamic CRUD APIs** based on JSON Schema definitions
- **Complete audit trail** with MongoDB change streams and rollback capabilities
- **Offline sync** with conflict resolution for mobile clients
- **Schema versioning** and automated migrations
- **Background processing** using BullMQ + Redis
- **Multi-tenant isolation** with role-based access control

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Mobile Apps   │    │   Admin Panel   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    Express.js Server      │
                    │  (Dynamic Route Handler)  │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│   MongoDB Atlas   │  │   Redis + BullMQ  │  │   File Storage   │
│  (Multi-tenant)   │  │  (Background Jobs)│  │   (Uploads)      │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

## 📚 Core Modules & Services

### 1. Authentication & Authorization (`src/middleware/auth.js`)

**Purpose**: Handles JWT-based authentication and role-based access control.

**Key Features**:
- JWT token generation and validation
- Role-based permissions (system_admin, admin, office, technician, customer)
- Tenant access validation with system admin override
- Token refresh mechanism
- System-level permission management
- **Automatic tenant detection** - no tenantId required during login
- **Simplified login flow** with automatic tenant context

**Login Flow (NEW SIMPLIFIED)**:
1. **User submits credentials** with `identifier` and `password`
2. **System automatically detects** user's tenant from database
3. **JWT token includes** tenant context automatically
4. **No tenantId required** for login requests

**Login Request Format**:
```json
{
  "identifier": "user@company.com",  // Username or email
  "password": "password123"
  // No tenantId needed - system auto-detects it!
}
```

**System Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "email": "user@company.com",
      "tenantId": "company-tenant",  // Automatically included!
      "role": "admin",
      "permissions": { ... }
    },
    "token": "jwt-token-with-tenant-context"
  }
}
```

**Backward Compatibility**:
- **Legacy format** with `tenantId` still works
- **New format** automatically detects tenant
- **Both approaches** are supported for smooth migration

**Middleware Functions**:
- `authenticate`: Validates JWT tokens and automatically sets tenant context
- `authorize`: Checks user permissions for specific operations
- `requireSystemPermission`: Checks system-level permissions
- `requireTenantAccess`: Ensures user has access to specified tenant
- `requireTenantManagement`: Ensures user can manage specified tenant

### 2. Schema Management (`src/services/SchemaService.js`)

**Purpose**: Manages JSON Schema definitions and dynamic model generation.

**Key Features**:
- CRUD operations for schema definitions
- Dynamic Mongoose model generation
- Hot-reload capability
- Schema validation using AJV

**Core Methods**:
- `createSchema`: Creates new schema definition
- `updateSchema`: Updates existing schema
- `deleteSchema`: Removes schema and associated data
- `getSchema`: Retrieves schema definition
- `listSchemas`: Lists all schemas for a tenant

### 3. Dynamic CRUD Service (`src/services/DynamicCrudService.js`)

**Purpose**: Provides dynamic CRUD operations for any schema-defined collection.

**Key Features**:
- Automatic endpoint generation based on schemas
- Data validation against JSON Schema
- Reference resolution for linked documents
- Bulk operations support

**Core Methods**:
- `createRecord`: Creates new document
- `getRecord`: Retrieves single document
- `updateRecord`: Updates existing document
- `deleteRecord`: Soft-deletes document
- `listRecords`: Lists documents with pagination
- `bulkCreateRecords`: Creates multiple documents

### 4. Audit Trail System (`src/services/AuditService.js`)

**Purpose**: Tracks all document changes and provides rollback capabilities.

**Key Features**:
- MongoDB change stream integration
- Document versioning
- Rollback functionality (single and bulk)
- Audit statistics and reporting

**Core Methods**:
- `logChange`: Records document change
- `getDocumentHistory`: Gets change history for document
- `revertToVersion`: Reverts document to specific version
- `bulkRevertDocuments`: Reverts multiple documents
- `getAuditStats`: Generates audit statistics

### 5. Change Stream Service (`src/services/ChangeStreamService.js`)

**Purpose**: Monitors MongoDB collections for real-time changes.

**Key Features**:
- Automatic change stream setup for new schemas
- Real-time audit event processing
- Background job dispatching for audit operations

**Core Methods**:
- `setupChangeStream`: Creates change stream for collection
- `handleChangeEvent`: Processes change events
- `removeChangeStream`: Removes change stream

### 6. Queue Management (`src/services/QueueService.js`)

**Purpose**: Manages background job processing using BullMQ and Redis.

**Key Features**:
- Background audit processing
- Job retry and failure handling
- Queue monitoring and statistics
- Graceful fallback to synchronous processing

**Core Methods**:
- `addAuditJob`: Queues audit log creation
- `addBulkAuditJob`: Queues bulk audit operations
- `getJob`: Retrieves job status
- `getQueueStats`: Gets queue performance metrics

### 7. Schema Versioning (`src/services/SchemaVersionService.js`)

**Purpose**: Manages schema definition versions and compatibility.

**Key Features**:
- Semantic versioning for schemas
- Backward compatibility checking
- Schema evolution tracking
- Version activation management

**Core Methods**:
- `createSchemaVersion`: Creates new schema version
- `getSchemaVersionHistory`: Gets version history
- `activateSchemaVersion`: Activates specific version
- `checkSchemaCompatibility`: Checks breaking changes

### 8. Migration Service (`src/services/MigrationService.js`)

**Purpose**: Handles automated data migrations between schema versions.

**Key Features**:
- Migration script generation
- Background migration execution
- Progress tracking and rollback
- Data integrity validation

**Core Methods**:
- `createMigration`: Creates migration record
- `runMigration`: Executes migration
- `rollbackMigration`: Reverts migration
- `validateMigration`: Tests migration safety

### 9. Discovery Service (`src/services/DiscoveryService.js`)

**Purpose**: Provides dynamic API discovery and documentation.

**Key Features**:
- OpenAPI specification generation
- TypeScript interface generation
- Endpoint discovery
- Platform capability reporting

**Core Methods**:
- `getAvailableSchemas`: Lists accessible schemas
- `generateOpenAPISpec`: Creates OpenAPI documentation
- `generateTypeScriptInterface`: Generates TS interfaces
- `getAPICapabilities`: Reports platform features

### 10. Offline Sync Service (`src/services/SyncService.js`)

**Purpose**: Manages offline synchronization and conflict resolution.

**Key Features**:
- Delta sync for mobile clients
- Conflict detection and resolution
- Client state management
- Sync status tracking

**Core Methods**:
- `getChangesSince`: Gets changes since last sync
- `resolveConflicts`: Handles sync conflicts
- `updateClientState`: Updates client sync status
- `getSyncStatus`: Reports sync health

## 🌐 API Endpoints Reference

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/bootstrap` | System bootstrap (one-time) | No |
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| POST | `/refresh` | Refresh JWT token | Yes |
| POST | `/logout` | User logout | Yes |

**Request Examples**:
```json
// System Bootstrap (one-time setup)
POST /api/auth/bootstrap
{
  "email": "admin@platform.com",
  "password": "securepassword123",
  "firstName": "System",
  "lastName": "Administrator",
  "masterKey": "SYSTEM_BOOTSTRAP_KEY_2025"
}

// Register System Admin
POST /api/auth/register
{
  "username": "system_admin",
  "email": "admin@platform.com",
  "password": "securepassword123",
  "firstName": "System",
  "lastName": "Administrator",
  "role": "system_admin"
}

// Register Tenant User
POST /api/auth/register
{
  "username": "admin",
  "email": "admin@company.com",
  "password": "securepassword123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "admin",
  "tenantId": "company-tenant"
}

// Login (System Admin - no tenantId needed)
POST /api/auth/login
{
  "email": "admin@platform.com",
  "password": "securepassword123"
}

// Login (Tenant User - tenantId required)
POST /api/auth/login
{
  "email": "admin@company.com",
  "password": "securepassword123",
  "tenantId": "company-tenant"
}
```

### Schema Management Routes (`/api/schemas`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create new schema | Yes (Admin) |
| GET | `/:tenantId` | List schemas for tenant | Yes |
| GET | `/:tenantId/:schemaName` | Get specific schema | Yes |
| PUT | `/:tenantId/:schemaName` | Update schema | Yes (Admin) |
| DELETE | `/:tenantId/:schemaName` | Delete schema | Yes (Admin) |

**Request Examples**:
```json
// Create Schema
POST /api/schemas
{
  "tenantId": "company-tenant",
  "name": "customer",
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "minLength": 1 },
      "email": { "type": "string", "format": "email" },
      "phone": { "type": "string" }
    },
    "required": ["name", "email"]
  }
}
```

### Dynamic Data Routes (`/api/data/:tenantId/:schemaName`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create record | Yes |
| GET | `/` | List records | Yes |
| GET | `/:id` | Get single record | Yes |
| PUT | `/:id` | Update record | Yes |
| DELETE | `/:id` | Delete record | Yes |
| POST | `/bulk` | Bulk create records | Yes |

**Request Examples**:
```json
// Create Record
POST /api/data/company-tenant/customer
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}

// List Records
GET /api/data/company-tenant/customer?page=1&limit=10&sort=name

// Update Record
PUT /api/data/company-tenant/customer/64f1a2b3c4d5e6f7g8h9i0j1
{
  "phone": "+1987654321"
}
```

### Audit Trail Routes (`/api/audit/:tenantId/:schemaName`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/history` | Get audit history | Yes |
| GET | `/history/:documentId` | Get document history | Yes |
| GET | `/stats` | Get audit statistics | Yes |
| POST | `/revert/:documentId/:version` | Revert document | Yes (Admin) |
| POST | `/bulk-revert` | Bulk revert documents | Yes (Admin) |
| GET | `/jobs/:jobId` | Get job status | Yes |
| GET | `/queue-status` | Get queue status | Yes |

**Request Examples**:
```json
// Get Audit History
GET /api/audit/company-tenant/customer/history?page=1&limit=20

// Revert Document
POST /api/audit/company-tenant/customer/revert/64f1a2b3c4d5e6f7g8h9i0j1/2

// Bulk Revert
POST /api/audit/company-tenant/customer/bulk-revert
{
  "documentIds": ["64f1a2b3c4d5e6f7g8h9i0j1", "64f1a2b3c4d5e6f7g8h9i0j2"],
  "version": 1
}
```

### Schema Versioning Routes (`/api/schema-versions/:tenantId/:schemaName`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create new version | Yes (Admin) |
| GET | `/` | Get version history | Yes |
| GET | `/current` | Get current version | Yes |
| PUT | `/activate/:version` | Activate version | Yes (Admin) |
| GET | `/diff/:version1/:version2` | Compare versions | Yes |
| DELETE | `/:version` | Delete version | Yes (Admin) |

**Request Examples**:
```json
// Create Version
POST /api/schema-versions/company-tenant/customer
{
  "version": "2.0.0",
  "schema": { /* updated schema */ },
  "changelog": "Added phone field as required",
  "compatibilityLevel": "MINOR"
}

// Activate Version
PUT /api/schema-versions/company-tenant/customer/activate/2.0.0
```

### Migration Routes (`/api/migrations/:tenantId/:schemaName`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create migration | Yes (Admin) |
| GET | `/` | Get migration history | Yes |
| POST | `/run` | Run pending migrations | Yes (Admin) |
| POST | `/rollback/:migrationId` | Rollback migration | Yes (Admin) |
| GET | `/status/:migrationId` | Get migration status | Yes |
| POST | `/validate` | Validate migration script | Yes (Admin) |

**Request Examples**:
```json
// Create Migration
POST /api/migrations/company-tenant/customer
{
  "fromVersion": "1.0.0",
  "toVersion": "2.0.0",
  "migrationScript": "db.collection.updateMany({}, {$set: {phone: ''}})"
}

// Run Migration
POST /api/migrations/company-tenant/customer/run
{
  "dryRun": false,
  "backup": true
}
```

### Discovery Routes (`/api/discovery`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/:tenantId/schemas` | List available schemas | Yes |
| GET | `/:tenantId/endpoints` | List available endpoints | Yes |
| GET | `/:tenantId/openapi` | Get OpenAPI spec | Yes |
| GET | `/capabilities` | Get platform capabilities | No |
| GET | `/:tenantId/schema/:name/meta` | Get schema metadata | Yes |
| GET | `/:tenantId/typescript/:schemaName` | Generate TS interface | Yes |

**Request Examples**:
```json
// Get Available Schemas
GET /api/discovery/company-tenant/schemas

// Get OpenAPI Spec
GET /api/discovery/company-tenant/openapi

// Generate TypeScript Interface
GET /api/discovery/company-tenant/typescript/customer
```

### Queue Management Routes (`/api/admin/queues`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List all queues | Yes (Admin) |
| GET | `/:queueName/jobs` | List jobs in queue | Yes (Admin) |
| GET | `/:queueName/failed` | List failed jobs | Yes (Admin) |
| POST | `/:queueName/retry-failed` | Retry failed jobs | Yes (Admin) |
| GET | `/stats` | Get queue statistics | Yes (Admin) |
| POST | `/:queueName/pause` | Pause queue | Yes (Admin) |
| POST | `/:queueName/resume` | Resume queue | Yes (Admin) |

**Request Examples**:
```json
// List All Queues
GET /api/admin/queues

// Retry Failed Jobs
POST /api/admin/queues/audit/retry-failed

// Get Queue Stats
GET /api/admin/queues/stats
```

### Offline Sync Routes (`/api/sync/:tenantId/:schemaName`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/changes` | Get changes since timestamp | Yes |
| POST | `/changes` | Submit client changes | Yes |
| GET | `/status` | Get sync status | Yes |
| POST | `/resolve` | Resolve sync conflicts | Yes |
| GET | `/conflicts` | Get pending conflicts | Yes |

**Request Examples**:
```json
// Get Changes Since Last Sync
GET /api/sync/company-tenant/customer/changes?since=1640995200000&deviceId=device-001

// Submit Client Changes
POST /api/sync/company-tenant/customer/changes
{
  "deviceId": "device-001",
  "clientTimestamp": 1640995200000,
  "changes": [
    {
      "operation": "create",
      "data": { "name": "Jane Doe", "email": "jane@example.com" }
    }
  ]
}

// Resolve Conflicts
POST /api/sync/company-tenant/customer/resolve
{
  "conflictId": "conflict-123",
  "resolution": "client-wins",
  "resolvedData": { /* resolved data */ }
}
```

## 🔧 System Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/craftsman
MONGODB_DB_NAME=craftsman

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Queue Configuration
QUEUE_CONCURRENCY=5
AUDIT_JOB_ATTEMPTS=3
AUDIT_JOB_BACKOFF=exponential

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

### Database Collections

**Core Collections**:
- `schemas`: JSON Schema definitions
- `audit_logs`: Document change history
- `schema_versions`: Schema version tracking
- `migrations`: Migration records
- `tenants`: Tenant information
- `users`: User accounts and roles

**Dynamic Collections**:
- Generated based on schema definitions
- Follow naming pattern: `{tenantId}_{schemaName}`

## 🚀 Testing Strategy

### 1. System Bootstrap
- **One-time setup**: Use `/api/auth/bootstrap` endpoint
- **Master key protection**: Secure bootstrap key required
- **Automatic tenant creation**: First tenant created during bootstrap
- **System admin setup**: Platform administrator account created

### 2. Testing Flow
```
1. Bootstrap system (creates system admin + first tenant)
2. Login as system admin
3. Create additional tenants
4. Create tenant admin users
5. Test tenant-specific functionality
6. Test system-wide operations
```

### 3. Unit Testing
- Test individual services in isolation
- Mock external dependencies (MongoDB, Redis)
- Validate business logic and error handling

### 2. Integration Testing
- Test service interactions
- Validate data flow between components
- Test error propagation and recovery

### 3. End-to-End Testing
- Test complete user workflows
- Validate multi-tenant isolation
- Test offline sync scenarios
- Verify audit trail integrity

### 4. Performance Testing
- Load testing with multiple concurrent users
- Test queue processing under load
- Validate database performance with large datasets

## 🐛 Common Issues & Troubleshooting

### 1. Authentication Issues
- **Problem**: JWT token expired
- **Solution**: Use refresh token endpoint or re-login

### 2. Permission Denied
- **Problem**: User lacks required role
- **Solution**: Check user role and tenant access

### 3. Schema Validation Errors
- **Problem**: Data doesn't match schema
- **Solution**: Validate data against schema definition

### 4. Queue Processing Issues
- **Problem**: Redis connection failed
- **Solution**: Check Redis service and connection settings

### 5. Change Stream Errors
- **Problem**: MongoDB change streams not working
- **Solution**: Verify MongoDB replica set configuration

## 📊 Monitoring & Health Checks

### Health Endpoints
- `GET /health`: Basic health check
- `GET /ready`: Kubernetes readiness probe
- `GET /api/system/info`: System information

### Queue Monitoring
- Queue depth and processing rates
- Failed job counts and retry attempts
- Worker performance metrics

### Database Monitoring
- Connection pool status
- Query performance metrics
- Change stream health

## 🔒 Security Considerations

### 1. Authentication
- JWT tokens with appropriate expiration
- Secure password hashing
- Rate limiting on auth endpoints

### 2. Authorization
- **System Admin Role**: Platform-wide access, tenant management
- **Tenant Admin Role**: Organization-level access, user management
- **Office Role**: Business operations, customer management
- **Technician Role**: Field work, job updates, offline sync
- **Customer Role**: Limited read-only access to own data
- Role-based access control with granular permissions
- Tenant isolation with system admin override
- Resource-level permissions for fine-grained control

### 3. Permission Structure
```javascript
// System-level permissions (system_admin only)
system: {
  manageTenants: true,      // Create/delete tenants
  systemMonitoring: true,   // Platform-wide analytics
  platformConfig: true      // System configuration
}

// Business permissions (varies by role)
jobs: { read, create, update, assign, complete }
customers: { read, create, update, delete }
invoices: { read, create, update, approve }
reports: { read, create, export }
sync: { offline, conflict, batch }
```

### 3. Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### 4. API Security
- HTTPS enforcement
- CORS configuration
- Request size limits

## 📈 Performance Optimization

### 1. Database
- Proper indexing on frequently queried fields
- Connection pooling
- Query optimization

### 2. Caching
- Redis for session storage
- Query result caching
- Schema definition caching

### 3. Background Processing
- Asynchronous audit logging
- Batch operations for bulk data
- Queue-based job processing

### 4. API Optimization
- Pagination for large datasets
- Field selection for partial responses
- Compression for large payloads

This comprehensive API reference provides a complete understanding of the Craftsman Dynamic Backend Platform's capabilities, endpoints, and implementation details. Use this as a foundation for generating comprehensive Postman testing guides and identifying any missing or incorrectly implemented features.
