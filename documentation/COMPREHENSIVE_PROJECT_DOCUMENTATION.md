# 🚀 Toolvio Backend - Comprehensive Project Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Core Features](#core-features)
4. [Authentication & Authorization](#authentication--authorization)
5. [Multi-Tenant System](#multi-tenant-system)
6. [Dynamic Schema System](#dynamic-schema-system)
7. [Audit Trail System](#audit-trail-system)
8. [Change Streams & Real-time Updates](#change-streams--real-time-updates)
9. [API Endpoints & Routes](#api-endpoints--routes)
10. [Data Flow & Relationships](#data-flow--relationships)
11. [Security & Performance](#security--performance)
12. [Deployment & Configuration](#deployment--configuration)

---

## 🎯 Project Overview

**Toolvio Backend** is a sophisticated, enterprise-grade backend system that provides:

- **Multi-tenant SaaS platform** with complete data isolation
- **Dynamic schema management** - create data models on-the-fly
- **Real-time audit trails** with change tracking and rollback capabilities
- **Role-based access control** with granular permissions
- **Auto-generated REST APIs** for dynamic schemas
- **Change stream monitoring** for real-time data synchronization
- **Reference resolution** and relationship management
- **Performance optimization** with intelligent indexing and caching

### 🏗️ **Architecture Principles**
- **Microservices-ready** with modular service architecture
- **Event-driven** with change streams and real-time updates
- **Schema-first** design with JSON Schema validation
- **Tenant-isolated** with complete data segregation
- **Audit-compliant** with full change tracking
- **Scalable** with MongoDB and efficient query patterns

---

## 🏛️ System Architecture

### **High-Level Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│                    Toolvio Backend                          │
├─────────────────────────────────────────────────────────────┤
│  🚪 API Gateway & Middleware Layer                        │
│  ├─ Authentication & Authorization                         │
│  ├─ Rate Limiting & Security                              │
│  ├─ Request Validation & Sanitization                     │
│  └─ Error Handling & Logging                              │
├─────────────────────────────────────────────────────────────┤
│  🎯 Business Logic Layer                                  │
│  ├─ AuthService (JWT, Password Management)                │
│  ├─ SchemaService (Dynamic Schema Management)             │
│  ├─ DynamicCrudService (CRUD Operations)                  │
│  ├─ AuditService (Change Tracking)                        │
│  ├─ ChangeStreamService (Real-time Updates)               │
│  └─ ChangePropagation (Relationship Management)           │
├─────────────────────────────────────────────────────────────┤
│  🗄️ Data Access Layer                                     │
│  ├─ CollectionGenerator (Dynamic Models)                  │
│  ├─ ReferenceResolver (Relationship Validation)           │
│  ├─ SchemaValidator (JSON Schema Validation)              │
│  └─ Database Models (MongoDB/Mongoose)                    │
├─────────────────────────────────────────────────────────────┤
│  💾 Data Storage Layer                                    │
│  ├─ MongoDB (Primary Database)                            │
│  ├─ Dynamic Collections (Schema-based)                    │
│  ├─ Audit Logs (Change History)                           │
│  └─ System Collections (Users, Tenants, Schemas)          │
└─────────────────────────────────────────────────────────────┘
```

### **Service Layer Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AuthService   │    │ SchemaService   │    │ DynamicCrud     │
│                 │    │                 │    │ Service        │
│ • JWT Tokens   │    │ • Schema CRUD   │    │ • CRUD Ops     │
│ • Password Mgmt│    │ • Validation    │    │ • Validation   │
│ • User Mgmt    │    │ • Model Gen     │    │ • Audit Log    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ CollectionGen   │
                    │                 │
                    │ • Dynamic Models│
                    │ • Schema Convert│
                    │ • Model Cache   │
                    └─────────────────┘
```

---

## ⭐ Core Features

### **1. Multi-Tenant Architecture**
- **Complete data isolation** between tenants
- **Tenant-specific collections** with automatic filtering
- **Resource limits** per subscription plan
- **Usage tracking** and monitoring

### **2. Dynamic Schema System**
- **JSON Schema-based** data model definitions
- **Runtime model generation** without code changes
- **Hot schema reloading** for instant updates
- **Automatic validation** and type checking

### **3. Real-Time Audit Trail**
- **Complete change tracking** for all operations
- **Version history** with rollback capabilities
- **User activity logging** with IP and user agent
- **Change propagation** to related records

### **4. Role-Based Access Control**
- **4 distinct roles**: Admin, Office, Technician, Customer
- **Granular permissions** per resource and action
- **Tenant-scoped** permissions and access
- **Dynamic permission resolution**

### **5. Auto-Generated APIs**
- **RESTful endpoints** for all dynamic schemas
- **Automatic CRUD operations** with validation
- **Relationship handling** and reference resolution
- **Pagination and filtering** support

---

## 🔐 Authentication & Authorization

### **JWT-Based Authentication**
```javascript
// Token Structure
{
  userId: "507f1f77bcf86cd799439011",
  username: "john.doe",
  email: "john@acme.com",
  role: "technician",
  tenantId: "acme-corp",
  permissions: {
    schemas: { read: true, write: false, delete: false },
    data: { read: true, write: true, delete: false },
    audit: { read: true, rollback: false },
    users: { read: false, write: false, delete: false }
  }
}
```

### **Permission System**
| Resource | Action | Admin | Office | Technician | Customer |
|----------|--------|-------|--------|------------|----------|
| **Schemas** | Read | ✅ | ✅ | ✅ | ❌ |
| **Schemas** | Write | ✅ | ✅ | ❌ | ❌ |
| **Schemas** | Delete | ✅ | ❌ | ❌ | ❌ |
| **Data** | Read | ✅ | ✅ | ✅ | ✅ |
| **Data** | Write | ✅ | ✅ | ✅ | ❌ |
| **Data** | Delete | ✅ | ❌ | ❌ | ❌ |
| **Audit** | Read | ✅ | ✅ | ✅ | ❌ |
| **Audit** | Rollback | ✅ | ❌ | ❌ | ❌ |

### **Security Features**
- **bcrypt password hashing** with salt rounds
- **Account locking** after failed login attempts
- **JWT token expiration** and refresh mechanism
- **Rate limiting** per tenant and user
- **IP-based security** and user agent tracking

---

## 🏢 Multi-Tenant System

### **Tenant Model Structure**
```javascript
{
  tenantId: "acme-corp",           // Unique identifier
  name: "Acme Corporation",        // Company name
  displayName: "Acme Corp",        // Display name
  
  // Subscription & Limits
  subscriptionPlan: "professional", // trial, basic, professional, enterprise
  settings: {
    maxUsers: 100,                 // Maximum users allowed
    maxSchemas: 50,                // Maximum schemas allowed
    maxStorageGB: 10,              // Maximum storage in GB
    features: {
      auditTrail: true,            // Audit trail enabled
      changeStreams: true,         // Change streams enabled
      offlineSync: true,           // Offline sync enabled
      apiRateLimit: true           // API rate limiting
    }
  },
  
  // Usage Tracking
  usage: {
    userCount: 25,                 // Current user count
    schemaCount: 12,               // Current schema count
    storageUsedGB: 2.5,           // Current storage usage
    apiCallsThisMonth: 1500       // API usage tracking
  }
}
```

### **Tenant Isolation Mechanisms**
- **Collection naming**: `dynamic_{tenantId}_{schemaName}`
- **Query filtering**: Automatic `tenantId` inclusion
- **User isolation**: Users can only access their tenant's data
- **Schema isolation**: Schemas are tenant-specific
- **Audit isolation**: Audit logs are tenant-scoped

---

## 🔧 Dynamic Schema System

### **Schema Definition Process**
```javascript
// 1. Define JSON Schema
const productSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    price: { type: "number", minimum: 0 },
    category: { type: "string", enum: ["electronics", "clothing"] },
    tags: { type: "array", items: { type: "string" } }
  },
  required: ["name", "price"]
};

// 2. Create Schema via API
POST /api/schemas
{
  "name": "product",
  "displayName": "Product",
  "description": "Product catalog",
  "jsonSchema": productSchema
}

// 3. System automatically:
//    - Validates JSON Schema
//    - Generates Mongoose model
//    - Creates MongoDB collection
//    - Sets up change streams
//    - Enables CRUD operations
```

### **Collection Generator Service**
```javascript
class CollectionGenerator {
  // Converts JSON Schema to Mongoose Schema
  generateMongooseSchema(jsonSchema) {
    const mongooseSchema = {};
    
    // Convert each field type
    for (const [fieldName, fieldDef] of Object.entries(jsonSchema.properties)) {
      mongooseSchema[fieldName] = this.convertFieldType(fieldDef);
    }
    
    // Add system fields
    mongooseSchema._schemaName = { type: String, required: true, index: true };
    mongooseSchema.createdAt = { type: Date, default: Date.now, index: true };
    mongooseSchema.updatedAt = { type: Date, default: Date.now };
    
    return mongooseSchema;
  }
  
  // Creates dynamic Mongoose model
  createDynamicModel(schemaDefinition) {
    const mongooseSchema = new mongoose.Schema(
      this.generateMongooseSchema(schemaDefinition.jsonSchema),
      { collection: schemaDefinition.collectionName }
    );
    
    return mongoose.model(schemaDefinition.name, mongooseSchema);
  }
}
```

### **Schema Relationships**
```javascript
// Reference fields in JSON Schema
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "category": { 
      "type": "string",
      "reference": {
        "schema": "category",
        "type": "single_reference"
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string",
        "reference": {
          "schema": "tag",
          "type": "array_reference"
        }
      }
    }
  }
}
```

---

## 📝 Audit Trail System

### **Audit Log Structure**
```javascript
{
  documentId: "507f1f77bcf86cd799439011",
  schemaName: "product",
  collectionName: "dynamic_acme_corp_product",
  operation: "update", // create, update, delete
  
  // Document states
  previousState: { /* complete previous document */ },
  currentState: { /* complete current document */ },
  
  // Change details
  changedFields: [
    {
      field: "price",
      oldValue: 699.99,
      newValue: 799.99
    }
  ],
  
  // User context
  userId: "user123",
  userAgent: "Mozilla/5.0...",
  ipAddress: "192.168.1.100",
  
  // Metadata
  version: 5,
  timestamp: "2024-01-15T10:30:00Z",
  canRevert: true
}
```

### **Audit Middleware**
```javascript
// Automatic audit logging for all operations
const logAuditTrail = (operation) => async (req, res, next) => {
  // Capture request context
  req.auditContext = {
    userId: req.user?.id,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    timestamp: new Date()
  };
  
  // Log operation after completion
  res.on('finish', () => {
    if (res.statusCode < 400) {
      logOperationAudit(req, operation, res.locals.responseData);
    }
  });
  
  next();
};

// Usage in routes
router.put('/:recordId', 
  captureDocumentState,    // Capture before state
  logAuditTrail('update'), // Log after update
  dataController.updateRecord
);
```

### **Change Propagation System**
```javascript
class ChangePropagation {
  // Track dependencies between records
  async trackDependencies(schemaName, recordId, recordData) {
    const dependencies = [];
    
    // Find all reference fields
    const schema = await SchemaService.getSchemaByName(schemaName);
    for (const [field, fieldDef] of Object.entries(schema.jsonSchema.properties)) {
      if (fieldDef.reference) {
        dependencies.push({
          field,
          referencedSchema: fieldDef.reference.schema,
          referenceType: fieldDef.reference.type
        });
      }
    }
    
    return dependencies;
  }
  
  // Propagate changes to dependent records
  async propagateChanges(schemaName, recordId, changes) {
    const dependentRecords = await this.findDependentRecords(schemaName, recordId);
    
    for (const dependent of dependentRecords) {
      // Update dependent records with new reference data
      await this.updateDependentRecord(dependent, changes);
    }
  }
}
```

---

## 🔄 Change Streams & Real-time Updates

### **Change Stream Service**
```javascript
class ChangeStreamService {
  constructor() {
    this.changeStreams = new Map();
  }
  
  // Initialize change streams for all schemas
  async initialize() {
    const schemas = await SchemaService.getAllSchemas({ active: true });
    
    for (const schema of schemas) {
      await this.initializeSchemaChangeStream(schema);
    }
    
    // Monitor for new collections
    await this.initializeGlobalChangeStream();
  }
  
  // Create change stream for specific schema
  async initializeSchemaChangeStream(schema) {
    const collection = mongoose.connection.db.collection(schema.collectionName);
    
    const changeStream = collection.watch([
      { $match: { operationType: { $in: ['insert', 'update', 'delete'] } } }
    ]);
    
    changeStream.on('change', (change) => {
      this.handleChangeEvent(change, schema);
    });
    
    this.changeStreams.set(schema.name, changeStream);
  }
  
  // Handle change events
  async handleChangeEvent(change, schema) {
    try {
      switch (change.operationType) {
        case 'insert':
          await this.handleInsert(change, schema);
          break;
        case 'update':
          await this.handleUpdate(change, schema);
          break;
        case 'delete':
          await this.handleDelete(change, schema);
          break;
      }
    } catch (error) {
      console.error('Error handling change event:', error);
    }
  }
}
```

### **Real-time Update Flow**
```
1. User updates record via API
2. MongoDB change stream detects change
3. ChangeStreamService processes event
4. AuditService logs the change
5. ChangePropagation updates dependent records
6. WebSocket/SSE notification sent to clients
7. UI updates in real-time
```

---

## 🌐 API Endpoints & Routes

### **Authentication Routes**
```
POST   /api/auth/login              # User login
POST   /api/auth/register           # User registration
POST   /api/auth/refresh            # Refresh token
POST   /api/auth/logout             # User logout
GET    /api/auth/profile            # Get user profile
PUT    /api/auth/profile            # Update user profile
POST   /api/auth/change-password   # Change password
GET    /api/auth/tenant             # Get tenant info
GET    /api/auth/validate           # Validate token
```

### **Tenant Management Routes**
```
POST   /api/tenants                 # Create tenant
GET    /api/tenants                 # List all tenants
GET    /api/tenants/summary         # Get tenants summary
GET    /api/tenants/{tenantId}      # Get tenant details
PUT    /api/tenants/{tenantId}      # Update tenant
DELETE /api/tenants/{tenantId}      # Delete tenant
PATCH  /api/tenants/{tenantId}/status # Toggle tenant status
GET    /api/tenants/{tenantId}/stats  # Get tenant statistics
```

### **Schema Management Routes**
```
GET    /api/schemas                 # List schemas
POST   /api/schemas                 # Create schema
GET    /api/schemas/{name}          # Get schema
PUT    /api/schemas/{name}          # Update schema
DELETE /api/schemas/{name}          # Delete schema
POST   /api/schemas/{name}/reload   # Hot reload schema
GET    /api/schemas/{name}/stats    # Schema statistics
```

### **Dynamic Data Routes**
```
GET    /api/data/{schemaName}       # List records
POST   /api/data/{schemaName}       # Create record
GET    /api/data/{schemaName}/count # Record count
GET    /api/data/{schemaName}/stats # Record statistics
GET    /api/data/{schemaName}/search # Search records
POST   /api/data/{schemaName}/bulk  # Bulk create
GET    /api/data/{schemaName}/{id}  # Get record
PUT    /api/data/{schemaName}/{id}  # Update record
PATCH  /api/data/{schemaName}/{id}  # Patch record
DELETE /api/data/{schemaName}/{id}  # Delete record
```

### **Audit Routes**
```
GET    /api/audit/{schemaName}/history           # Schema audit history
GET    /api/audit/{schemaName}/stats             # Audit statistics
GET    /api/audit/{schemaName}/{recordId}/history # Document audit history
POST   /api/audit/{schemaName}/{recordId}/revert/{version} # Revert document
```

---

## 🔗 Data Flow & Relationships

### **Data Creation Flow**
```
1. Client sends POST request to /api/data/{schemaName}
2. Authentication middleware validates JWT token
3. Authorization middleware checks permissions
4. SchemaService validates schema exists
5. CollectionGenerator gets dynamic model
6. SchemaValidator validates data against JSON Schema
7. ReferenceResolver validates references
8. DynamicCrudService creates record
9. AuditService logs the creation
10. ChangeStreamService detects change
11. ChangePropagation updates dependent records
12. Response sent to client
```

### **Reference Resolution System**
```javascript
class ReferenceResolver {
  // Validate references in data
  async validateReferences(schemaName, data) {
    const schema = await SchemaService.getSchemaByName(schemaName);
    const errors = [];
    
    for (const [field, value] of Object.entries(data)) {
      const fieldDef = schema.jsonSchema.properties[field];
      
      if (fieldDef.reference) {
        const isValid = await this.validateReference(
          fieldDef.reference.schema,
          value,
          fieldDef.reference.type
        );
        
        if (!isValid) {
          errors.push({
            field,
            message: `Invalid reference to ${fieldDef.reference.schema}`
          });
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  // Resolve references in query results
  async resolveReferences(schemaName, records, populateFields = []) {
    const schema = await SchemaService.getSchemaByName(schemaName);
    
    for (const record of records) {
      for (const field of populateFields) {
        const fieldDef = schema.jsonSchema.properties[field];
        
        if (fieldDef.reference) {
          record[field] = await this.resolveReference(
            fieldDef.reference.schema,
            record[field]
          );
        }
      }
    }
    
    return records;
  }
}
```

---

## 🛡️ Security & Performance

### **Security Features**
- **JWT token validation** with expiration
- **Role-based access control** with granular permissions
- **Tenant isolation** preventing cross-tenant data access
- **Input validation** using JSON Schema
- **SQL injection prevention** with parameterized queries
- **Rate limiting** per tenant and user
- **Audit logging** for all operations

### **Performance Optimizations**
- **Database indexing** on tenantId and common fields
- **Model caching** in CollectionGenerator
- **Efficient queries** with proper MongoDB patterns
- **Connection pooling** for database connections
- **Lazy loading** of dynamic models
- **Pagination** for large result sets

### **Monitoring & Health Checks**
```
GET /api/system/health           # System health status
GET /api/system/info             # System information
GET /api/system/stats/database   # Database statistics
GET /api/system/stats/api        # API usage statistics
GET /api/system/logs             # Recent system logs
```

---

## 🚀 Deployment & Configuration

### **Environment Variables**
```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/toolvio

# JWT Configuration
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRES_IN=24h

# Security
BCRYPT_ROUNDS=12
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_DURATION=2h

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Features
ENABLE_AUDIT_TRAIL=true
ENABLE_CHANGE_STREAMS=true
ENABLE_OFFLINE_SYNC=true
```

### **Dependencies**
```json
{
  "express": "^4.18.0",
  "mongoose": "^7.0.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "helmet": "^7.0.0",
  "cors": "^2.8.5",
  "morgan": "^1.10.0",
  "swagger-ui-express": "^5.0.0",
  "yaml": "^2.3.0"
}
```

### **Production Considerations**
- **HTTPS enforcement** with SSL certificates
- **Environment-specific** configuration files
- **Database backup** and recovery procedures
- **Monitoring and alerting** setup
- **Load balancing** for high availability
- **CDN integration** for static assets

---

## 📊 System Capabilities

### **What This System Can Do**
✅ **Create dynamic data models** without code changes  
✅ **Multi-tenant SaaS applications** with complete isolation  
✅ **Real-time audit trails** with rollback capabilities  
✅ **Auto-generated REST APIs** for all schemas  
✅ **Reference management** between related records  
✅ **Change propagation** to dependent data  
✅ **Role-based access control** with granular permissions  
✅ **Performance monitoring** and health checks  
✅ **Hot schema reloading** for instant updates  
✅ **Real-time change notifications** via change streams  

### **Use Cases**
- **Enterprise SaaS platforms** with multiple clients
- **Content management systems** with dynamic schemas
- **E-commerce platforms** with flexible product models
- **Project management tools** with customizable workflows
- **Data analytics platforms** with dynamic data models
- **API-first applications** requiring flexible schemas

---

This comprehensive system provides a robust, secure, and scalable foundation for building enterprise-grade applications with dynamic schemas, complete audit trails, and multi-tenant support.
