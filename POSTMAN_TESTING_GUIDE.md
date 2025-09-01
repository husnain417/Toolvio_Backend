# 🧪 Craftsman Dynamic Backend Platform - Complete Postman Testing Guide

## 📋 Table of Contents
1. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
2. [System Bootstrap & Authentication](#system-bootstrap--authentication)
3. [Tenant Management](#tenant-management)
4. [Schema Management](#schema-management)
5. [Dynamic Data Operations](#dynamic-data-operations)
6. [Audit Trail & Rollback](#audit-trail--rollback)
7. [Offline Sync & Conflict Resolution](#offline-sync--conflict-resolution)
8. [Schema Versioning & Migrations](#schema-versioning--migrations)
9. [Dynamic Endpoint Discovery](#dynamic-endpoint-discovery)
10. [Queue Management & Background Jobs](#queue-management--background-jobs)
11. [System & Health Monitoring](#system--health-monitoring)
12. [Advanced Testing Scenarios](#advanced-testing-scenarios)

---

## 🚀 Prerequisites & Environment Setup

### ⚠️ IMPORTANT: System Setup Required
**Before running any API tests, you MUST set up the system using one of these methods:**

#### **Option 1: Production Setup (Recommended)**
```bash
# 1. Ensure MongoDB is running
# 2. Ensure Redis is running (for BullMQ queues)
# 3. Start the Node.js application
# 4. Use the new super admin registration endpoint
```

#### **Option 2: Development/Testing Setup**
```bash
# 1. Ensure MongoDB is running
# 2. Ensure Redis is running (for BullMQ queues)
# 3. Start the Node.js application
# 4. Run the system setup script
node scripts/bootstrap-system.js
```

### Base Configuration
- **Base URL**: `http://localhost:3000` (or your deployed URL)
- **Content-Type**: `application/json`
- **Environment Variables**: Set up in Postman environment

### Required Services
- MongoDB running (with replica set for production)
- Redis running (for BullMQ queues)
- Node.js application started

### Postman Environment Variables
```json
{
  "baseUrl": "http://localhost:3000",
  "systemAdminToken": "",
  "tenantAdminToken": "",
  "officeToken": "",
  "technicianToken": "",
  "customerToken": "",
  "tenantId": "",
  "tenantId2": "",
  "schemaName": "customer",
  "documentId": "",
  "migrationId": "",
  "deviceId": "test-device-001",
  "lastSyncTimestamp": "",
  "bootstrapKey": "SYSTEM_BOOTSTRAP_KEY_2025"
}
```

---

## 🔐 System Bootstrap & Authentication

### **Production Flow (Recommended)**

#### 1. System Health Check
**GET** `{{baseUrl}}/health`
**Expected**: 200 OK with health status

**GET** `{{baseUrl}}/ready`
**Expected**: 200 OK with readiness status

#### 2. Register Super Admin (Production)
**POST** `{{baseUrl}}/api/auth/register-super-admin`
```json
{
  "username": "superadmin",
  "email": "admin@craftsman-platform.com",
  "password": "SuperAdmin123!",
  "firstName": "Super",
  "lastName": "Administrator"
}
```
**Expected**: 201 Created with super admin and default tenant
**Action**: Save `data.token` to `{{systemAdminToken}}` and `data.tenant.domain` to `{{tenantId}}`

#### 3. Create Demo Tenant (Super Admin)
**POST** `{{baseUrl}}/api/tenants`
**Headers**: `Authorization: Bearer {{systemAdminToken}}`
```json
{
  "username": "demo-admin",
  "email": "admin@craftsman-demo.com",
  "password": "DemoAdmin123!",
  "firstName": "Demo",
  "lastName": "Admin",
  "name": "Craftsman Demo Company",
  "description": "Demo tenant for testing purposes",
  "contactEmail": "admin@craftsman-demo.com",
  "contactPhone": "+1-555-0123",
  "subscriptionPlan": "professional",
  "settings": {
    "maxUsers": 100,
    "maxSchemas": 50,
    "maxStorageGB": 25,
    "features": {
      "auditTrail": true,
      "changeStreams": true,
      "offlineSync": true,
      "apiRateLimit": true
    }
  }
}
```
**Expected**: 201 Created with tenant and admin user details
**Action**: Save `data.tenant.tenantId` to `{{tenantId}}`

#### 4. Create Second Tenant (Super Admin)
**POST** `{{baseUrl}}/api/tenants`
**Headers**: `Authorization: Bearer {{systemAdminToken}}`
```json
{
  "username": "plumbing-admin",
  "email": "admin@plumbing-pro.com",
  "password": "PlumbingAdmin123!",
  "firstName": "Pro",
  "lastName": "Admin",
  "name": "Plumbing Pro Services",
  "description": "Professional plumbing services company",
  "contactEmail": "admin@plumbing-pro.com",
  "contactPhone": "+1-555-0456",
  "subscriptionPlan": "enterprise",
  "settings": {
    "maxUsers": 500,
    "maxSchemas": 200,
    "maxStorageGB": 100,
    "features": {
      "auditTrail": true,
      "changeStreams": true,
      "offlineSync": true,
      "apiRateLimit": true
    }
  }
}
```
**Expected**: 201 Created with tenant and admin user details
**Action**: Save `data.tenant.tenantId` to `{{tenantId2}}`

#### 5. Login as Tenant Admin (Use the created admin user)
**POST** `{{baseUrl}}/api/auth/login`
```json
{
  "identifier": "admin@craftsman-demo.com",
  "password": "DemoAdmin123!",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 200 OK with JWT token
**Action**: Save `data.accessToken` to `{{tenantAdminToken}}`

### **Development/Testing Flow (Alternative)**

#### 1. System Bootstrap (Development)
**POST** `{{baseUrl}}/api/auth/bootstrap`
```json
{
  "email": "admin@craftsman-platform.com",
  "password": "SystemAdmin123!",
  "firstName": "System",
  "lastName": "Administrator",
  "masterKey": "{{bootstrapKey}}"
}
```
**Expected**: 201 Created with system admin and first tenant
**Action**: Save `data.token` to `{{systemAdminToken}}` and `data.tenantsCreated[0]` to `{{tenantId}}`

#### 2. System Admin Login (Development)
**POST** `{{baseUrl}}/api/auth/login`
```json
{
  "identifier": "admin@craftsman-platform.com",
  "password": "SystemAdmin123!"
}
```
**Note**: System admin login does NOT require `tenantId` field
**Expected**: 200 OK with JWT token
**Action**: Save `data.accessToken` to `{{systemAdminToken}}`

### **Continue with User Creation (Both Flows)**

#### 7. Create Office User (Tenant Admin)
**POST** `{{baseUrl}}/api/auth/register`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Headers**: `X-Tenant-ID: {{tenantId}}`
```json
{
  "username": "office-manager",
  "email": "office@craftsman-demo.com",
  "password": "OfficePass123!",
  "firstName": "Office",
  "lastName": "Manager",
  "role": "office",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 201 Created with user details

#### 8. Create Technician User (Tenant Admin)
**POST** `{{baseUrl}}/api/auth/register`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Headers**: `X-Tenant-ID: {{tenantId}}`
```json
{
  "username": "field-tech",
  "email": "tech@craftsman-demo.com",
  "password": "TechPass123!",
  "firstName": "John",
  "lastName": "Technician",
  "role": "technician",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 201 Created with user details

#### 9. Create Customer User (Tenant Admin)
**POST** `{{baseUrl}}/api/auth/register`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Headers**: `X-Tenant-ID: {{tenantId}}`
```json
{
  "username": "customer-user",
  "email": "customer@craftsman-demo.com",
  "password": "CustomerPass123!",
  "firstName": "Jane",
  "lastName": "Customer",
  "role": "customer",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 201 Created with user details

#### 10. Login as Different Users
**POST** `{{baseUrl}}/api/auth/login`
```json
{
  "identifier": "office@craftsman-demo.com",
  "password": "OfficePass123!"
}
```
**Note**: No `tenantId` required - system auto-detects tenant
**Action**: Save token to `{{officeToken}}`

**POST** `{{baseUrl}}/api/auth/login`
```json
{
  "identifier": "tech@craftsman-demo.com",
  "password": "TechPass123!"
}
```
**Note**: No `tenantId` required - system auto-detects tenant
**Action**: Save token to `{{technicianToken}}`

**POST** `{{baseUrl}}/api/auth/login`
```json
{
  "identifier": "customer@craftsman-demo.com",
  "password": "CustomerPass123!"
}
```
**Note**: No `tenantId` required - system auto-detects tenant
**Action**: Save token to `{{customerToken}}`

---

## 🆕 **Test New Registration Flow (Updated)**

### **Test Self-Registration (Customer - No Token Required)**
**POST** `{{baseUrl}}/api/auth/register`
```json
{
  "username": "john.customer",
  "email": "john@customer.com",
  "password": "Customer123!",
  "firstName": "John",
  "lastName": "Customer",
  "role": "customer",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 201 Created with user details and JWT token
**Action**: Save `data.token` to `{{customerToken}}`

### **Test Self-Registration (Technician - No Token Required)**
**POST** `{{baseUrl}}/api/auth/register`
```json
{
  "username": "mike.technician",
  "email": "mike@technician.com",
  "password": "Technician123!",
  "firstName": "Mike",
  "lastName": "Technician",
  "role": "technician",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 201 Created with user details and JWT token
**Action**: Save `data.token` to `{{technicianToken}}`

### **Test Self-Registration Restriction (Office Role - Should Fail)**
**POST** `{{baseUrl}}/api/auth/register`
```json
{
  "username": "office.user",
  "email": "office@user.com",
  "password": "Office123!",
  "firstName": "Office",
  "lastName": "User",
  "role": "office",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 400 Bad Request - "Self-registration limited to customer and technician roles only"

### **Create Office User (Admin Only)**
**POST** `{{baseUrl}}/api/auth/create-office-user`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
```json
{
  "username": "sarah.office",
  "email": "sarah@office.com",
  "password": "Office123!",
  "firstName": "Sarah",
  "lastName": "Office"
}
```
**Expected**: 201 Created with office user details (no token returned)
**Action**: Save `data.user.email` to `{{officeEmail}}`

### **Login as Office User**
**POST** `{{baseUrl}}/api/auth/login`
```json
{
  "email": "{{officeEmail}}",
  "password": "Office123!",
  "tenantId": "{{tenantId}}"
}
```
**Expected**: 200 OK with JWT token
**Action**: Save `data.accessToken` to `{{officeToken}}`

### **Test Office User Cannot Create Other Office Users (Should Fail)**
**POST** `{{baseUrl}}/api/auth/create-office-user`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "username": "another.office",
  "email": "another@office.com",
  "password": "Another123!",
  "firstName": "Another",
  "lastName": "Office"
}
```
**Expected**: 403 Forbidden - "Insufficient permissions" (office users cannot create other office users)

---

## 📋 **New Registration Flow Summary**

---

## 🏢 Tenant Management

### 11. Get Tenant Information (Tenant Admin)
**GET** `{{baseUrl}}/api/tenants/{{tenantId}}`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Headers**: `X-Tenant-ID: {{tenantId}}`
**Expected**: 200 OK with tenant details

### 12. Update Tenant Settings (Tenant Admin)
**PUT** `{{baseUrl}}/api/tenants/{{tenantId}}`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Headers**: `X-Tenant-ID: {{tenantId}}`
```json
{
  "name": "Updated Craftsman Demo Company",
  "settings": {
    "timezone": "America/Chicago",
    "currency": "USD",
    "businessType": "plumbing",
    "maxUsers": 150,
    "maxSchemas": 75
  }
}
```
**Expected**: 200 OK with updated tenant

### 13. Get All Tenants (Super Admin Only)
**GET** `{{baseUrl}}/api/tenants`
**Headers**: `Authorization: Bearer {{systemAdminToken}}`
**Expected**: 200 OK with tenant list

### 14. Test Tenant Admin Cannot Access Other Tenants (Should Fail)
**GET** `{{baseUrl}}/api/tenants/{{tenantId2}}`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Headers**: `X-Tenant-ID: {{tenantId}}`
**Expected**: 403 Forbidden

---

## 📋 Schema Management

### 15. Create Customer Schema (Tenant Admin)
**POST** `{{baseUrl}}/api/schemas`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
```json
env
```
**Expected**: 201 Created with schema details

### 16. Create Job Schema (Tenant Admin)
**POST** `{{baseUrl}}/api/schemas`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
```json
{
  "name": "job",
  "displayName": "Job",
  "description": "Job tracking schema",
  "jsonSchema": {
    "type": "object",
    "properties": {
      "jobNumber": {
        "type": "string",
        "pattern": "^JOB-[0-9]{6}$"
      },
      "title": {
        "type": "string",
        "minLength": 5,
        "maxLength": 100
      },
      "description": {
        "type": "string",
        "maxLength": 1000
      },
      "customerId": {
        "type": "string",
        "format": "objectId",
        "reference": "customer"
      },
      "assignedTechnician": {
        "type": "string",
        "format": "objectId"
      },
      "status": {
        "type": "string",
        "enum": ["pending", "in_progress", "completed", "cancelled"]
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high", "urgent"]
      },
      "scheduledDate": {
        "type": "string",
        "format": "date-time"
      },
      "completedDate": {
        "type": "string",
        "format": "date-time"
      },
      "materials": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "itemName": { "type": "string" },
            "quantity": { "type": "number", "minimum": 1 },
            "unitPrice": { "type": "number", "minimum": 0 },
            "totalPrice": { "type": "number", "minimum": 0 }
          },
          "required": ["itemName", "quantity", "unitPrice"]
        }
      },
      "laborHours": {
        "type": "number",
        "minimum": 0
      },
      "totalAmount": {
        "type": "number",
        "minimum": 0
      }
    },
    "required": ["jobNumber", "title", "customerId", "status", "priority"]
  }
}
```
**Expected**: 201 Created with schema details

### 17. Test Office User Cannot Create Schema (Should Fail)
**POST** `{{baseUrl}}/api/schemas`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "name": "unauthorized-schema",
  "jsonSchema": {"type": "object", "properties": {"name": {"type": "string"}}}
}
```
**Expected**: 403 Forbidden

### 18. Get All Schemas for Tenant
**GET** `{{baseUrl}}/api/schemas`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with schema list for the tenant

### 19. Get Specific Schema
**GET** `{{baseUrl}}/api/schemas/customer`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with schema details

---

## 📊 Dynamic Data Operations

### 20. Create Customer Records (Office Manager)
**POST** `{{baseUrl}}/api/data/customer`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@email.com",
  "phone": "+1-555-0101",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "US"
  },
  "customerType": "residential",
  "isActive": true,
  "tags": ["vip", "repeat-customer"]
}
```
**Expected**: 201 Created with record details
**Action**: Save `data._id` to `{{documentId}}`

### 21. Create Second Customer (Office Manager)
**POST** `{{baseUrl}}/api/data/customer`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@business.com",
  "phone": "+1-555-0102",
  "address": {
    "street": "456 Business Ave",
    "city": "Chicago",
    "state": "IL",
    "zipCode": "60601",
    "country": "US"
  },
  "customerType": "commercial",
  "isActive": true,
  "tags": ["new-customer", "commercial"]
}
```
**Expected**: 201 Created with record details

### 22. Bulk Create Customers (Office Manager)
**POST** `{{baseUrl}}/api/data/customer/bulk`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "records": [
    {
      "firstName": "Mike",
      "lastName": "Johnson",
      "email": "mike@company.com",
      "phone": "+1-555-0103",
      "address": {
        "street": "789 Industrial Blvd",
        "city": "Rockford",
        "state": "IL",
        "zipCode": "61101",
        "country": "US"
      },
      "customerType": "industrial",
      "isActive": true,
      "tags": ["bulk-customer"]
    },
    {
      "firstName": "Sarah",
      "lastName": "Wilson",
      "email": "sarah.wilson@home.com",
      "phone": "+1-555-0104",
      "address": {
        "street": "321 Residential Dr",
        "city": "Peoria",
        "state": "IL",
        "zipCode": "61602",
        "country": "US"
      },
      "customerType": "residential",
      "isActive": true,
      "tags": ["bulk-customer"]
    }
  ]
}
```
**Expected**: 201 Created with bulk operation results

### 23. List Customers with Pagination (Office Manager)
**GET** `{{baseUrl}}/api/data/customer?page=1&limit=10&sort=firstName&order=asc`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with paginated records

### 24. Get Single Customer (Office Manager)
**GET** `{{baseUrl}}/api/data/customer/{{documentId}}`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with record details

### 25. Update Customer (Office Manager)
**PUT** `{{baseUrl}}/api/data/customer/{{documentId}}`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "phone": "+1-555-0199",
  "tags": ["vip", "repeat-customer", "updated"]
}
```
**Expected**: 200 OK with updated record

### 26. Create Job Record (Office Manager)
**POST** `{{baseUrl}}/api/data/job`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "jobNumber": "JOB-000001",
  "title": "Kitchen Sink Repair",
  "description": "Replace kitchen sink faucet and fix drainage issues",
  "customerId": "{{documentId}}",
  "status": "pending",
  "priority": "medium",
  "scheduledDate": "2025-09-01T09:00:00Z",
  "materials": [
    {
      "itemName": "Kitchen Faucet",
      "quantity": 1,
      "unitPrice": 89.99,
      "totalPrice": 89.99
    },
    {
      "itemName": "Pipe Sealant",
      "quantity": 1,
      "unitPrice": 12.99,
      "totalPrice": 12.99
    }
  ],
  "laborHours": 2.5,
  "totalAmount": 227.47
}
```
**Expected**: 201 Created with record details

### 27. Test Technician Job Access (Should Work)
**GET** `{{baseUrl}}/api/data/job`
**Headers**: `Authorization: Bearer {{technicianToken}}`
**Expected**: 200 OK - Technicians can read job data

### 28. Test Technician Customer Creation (Should Fail)
**POST** `{{baseUrl}}/api/data/customer`
**Headers**: `Authorization: Bearer {{technicianToken}}`
```json
{
  "firstName": "Unauthorized",
  "lastName": "Customer",
  "email": "unauthorized@test.com",
  "customerType": "residential"
}
```
**Expected**: 403 Forbidden - Technicians cannot create customers

---

## 🔍 Audit Trail & Rollback

### 29. Get Document History (Office Manager)
**GET** `{{baseUrl}}/api/audit/customer/{{documentId}}/history`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with audit history

### 30. Get Schema Audit History (Office Manager)
**GET** `{{baseUrl}}/api/audit/customer/history`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with all customer audit history

### 31. Get Document at Specific Version (Office Manager)
**GET** `{{baseUrl}}/api/audit/customer/{{documentId}}/versions/1`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with document at version 1

### 32. Get All Document Versions (Office Manager)
**GET** `{{baseUrl}}/api/audit/customer/{{documentId}}/versions`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with all versions of the document

### 33. Compare Two Document Versions (Office Manager)
**GET** `{{baseUrl}}/api/audit/customer/{{documentId}}/compare?version1=1&version2=2`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with version comparison

### 34. Get Audit Statistics (Tenant Admin Only)
**GET** `{{baseUrl}}/api/audit/customer/stats`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with audit stats

### 35. Get Audit Summary (Tenant Admin Only)
**GET** `{{baseUrl}}/api/audit/customer/summary`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with audit summary

### 36. Test Redis Audit Health (Tenant Admin)
**GET** `{{baseUrl}}/api/audit/health/redis-audit`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with Redis queue status

### 37. Test Direct Audit Service (Tenant Admin)
**GET** `{{baseUrl}}/api/audit/test-audit-direct`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with direct audit test result

### 38. Make More Changes for Audit Testing (Office Manager)
**PUT** `{{baseUrl}}/api/data/customer/{{documentId}}`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "email": "john.smith.updated@email.com",
  "tags": ["vip", "repeat-customer", "updated", "email-changed"]
}
```
**Expected**: 200 OK with updated record

### 39. Another Update (Office Manager)
**PUT** `{{baseUrl}}/api/data/customer/{{documentId}}`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "address": {
    "street": "123 Main St - Updated",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "US"
  }
}
```
**Expected**: 200 OK with updated record

### 40. Get Updated History (Office Manager)
**GET** `{{baseUrl}}/api/audit/customer/{{documentId}}/history`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with 3+ versions of the document

### 41. Revert to Previous Version (Tenant Admin Only)
**POST** `{{baseUrl}}/api/audit/customer/{{documentId}}/revert/2`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with rollback result

### 42. Verify Revert (Office Manager)
**GET** `{{baseUrl}}/api/data/customer/{{documentId}}`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with document matching version 2 data

### 43. Test Office Manager Cannot Revert (Should Fail)
**POST** `{{baseUrl}}/api/audit/customer/{{documentId}}/revert/1`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 403 Forbidden - Only tenant admins can revert

### 44. Bulk Revert Multiple Documents (Tenant Admin Only)
**POST** `{{baseUrl}}/api/audit/customer/bulk-revert`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
```json
{
  "documentIds": ["{{documentId}}"],
  "targetVersion": 1,
  "reason": "Bulk rollback test"
}
```
**Expected**: 200 OK with bulk revert results

### 45. Cleanup Old Audit Logs (Tenant Admin Only)
**POST** `{{baseUrl}}/api/audit/customer/cleanup`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
```json
{
  "olderThan": "30d",
  "dryRun": true
}
```
**Expected**: 200 OK with cleanup preview

### 46. Get Audit Job Status (Tenant Admin)
**GET** `{{baseUrl}}/api/audit/jobs/{{jobId}}/status`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with job status

### 47. Get Audit Queue Status (Tenant Admin)
**GET** `{{baseUrl}}/api/audit/queue/status`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with queue status

---

## 🔄 Offline Sync & Conflict Resolution

### 48. Get Initial Sync State (Technician)
**GET** `{{baseUrl}}/api/sync/job/status`
**Headers**: `Authorization: Bearer {{technicianToken}}`
**Expected**: 200 OK with sync status

### 49. Get Changes Since Timestamp (Technician)
**GET** `{{baseUrl}}/api/sync/job/changes?since=0&deviceId={{deviceId}}`
**Headers**: `Authorization: Bearer {{technicianToken}}`
**Expected**: 200 OK with all job records (initial sync)
**Action**: Save `data.timestamp` to `{{lastSyncTimestamp}}`

### 50. Make Changes While "Offline" (Office Manager)
**PUT** `{{baseUrl}}/api/data/job/{{jobId}}`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "priority": "high",
  "description": "Kitchen Sink Repair - URGENT: Customer called multiple times"
}
```
**Expected**: 200 OK with updated record

### 51. Get Incremental Changes (Technician)
**GET** `{{baseUrl}}/api/sync/job/changes?since={{lastSyncTimestamp}}&deviceId={{deviceId}}`
**Headers**: `Authorization: Bearer {{technicianToken}}`
**Expected**: 200 OK with only changes since last sync

### 52. Submit Client Changes (Technician)
**POST** `{{baseUrl}}/api/sync/job/changes`
**Headers**: `Authorization: Bearer {{technicianToken}}`
```json
{
  "deviceId": "{{deviceId}}",
  "clientTimestamp": 1693497600000,
  "changes": [
    {
      "operation": "update",
      "id": "{{jobId}}",
      "data": {
        "status": "completed",
        "completedDate": "2025-08-31T15:30:00Z",
        "laborHours": 3.0
      }
    }
  ]
}
```
**Expected**: 200 OK with sync results

### 53. Test Customer Sync Restrictions (Should Be Limited)
**GET** `{{baseUrl}}/api/sync/job/changes?since=0&deviceId=customer-device`
**Headers**: `Authorization: Bearer {{customerToken}}`
**Expected**: 200 OK with only jobs related to this customer

---

## 📋 Schema Versioning & Migrations

### 54. Get Current Schema Version (Tenant Admin)
**GET** `{{baseUrl}}/api/schema-versions/customer/current`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with current version (should be 1.0.0)

### 55. Create New Schema Version (Tenant Admin)
**POST** `{{baseUrl}}/api/schema-versions/customer`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
```json
{
  "version": "1.1.0",
  "changelog": "Added socialMedia field and emergency contact",
  "compatibilityLevel": "MINOR",
  "schema": {
    "type": "object",
    "properties": {
      "firstName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 50
      },
      "lastName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 50
      },
      "email": {
        "type": "string",
        "format": "email"
      },
      "phone": {
        "type": "string",
        "pattern": "^[+]?[0-9\\s\\-\\(\\)]{10,}$"
      },
      "emergencyContact": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "phone": { "type": "string" },
          "relationship": { "type": "string" }
        }
      },
      "socialMedia": {
        "type": "object",
        "properties": {
          "facebook": { "type": "string" },
          "twitter": { "type": "string" },
          "linkedin": { "type": "string" }
        }
      },
      "address": {
        "type": "object",
        "properties": {
          "street": { "type": "string" },
          "city": { "type": "string" },
          "state": { "type": "string" },
          "zipCode": { "type": "string" },
          "country": { "type": "string", "default": "US" }
        },
        "required": ["street", "city", "state", "zipCode"]
      },
      "customerType": {
        "type": "string",
        "enum": ["residential", "commercial", "industrial"]
      },
      "isActive": {
        "type": "boolean",
        "default": true
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["firstName", "lastName", "email", "customerType"]
  }
}
```
**Expected**: 201 Created with version details

### 56. Test Office Manager Cannot Create Schema Version (Should Fail)
**POST** `{{baseUrl}}/api/schema-versions/customer`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "version": "1.2.0",
  "changelog": "Unauthorized version",
  "schema": {}
}
```
**Expected**: 403 Forbidden - Only tenant admins can manage schema versions

### 57. Get Schema Version History (Tenant Admin)
**GET** `{{baseUrl}}/api/schema-versions/customer`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with list of all versions

### 58. Compare Schema Versions (Tenant Admin)
**GET** `{{baseUrl}}/api/schema-versions/customer/diff/1.0.0/1.1.0`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with differences between versions

### 59. Activate New Schema Version (Tenant Admin)
**PUT** `{{baseUrl}}/api/schema-versions/customer/activate/1.1.0`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with version activated successfully

### 60. Test New Schema Fields (Office Manager)
**POST** `{{baseUrl}}/api/data/customer`
**Headers**: `Authorization: Bearer {{officeToken}}`
```json
{
  "firstName": "Version",
  "lastName": "Test",
  "email": "version@test.com",
  "customerType": "residential",
  "emergencyContact": {
    "name": "Emergency Person",
    "phone": "+1-555-9911",
    "relationship": "spouse"
  },
  "socialMedia": {
    "facebook": "facebook.com/versiontest",
    "twitter": "@versiontest"
  },
  "address": {
    "street": "123 Version St",
    "city": "Test City",
    "state": "IL",
    "zipCode": "60001",
    "country": "US"
  },
  "isActive": true,
  "tags": ["version-test"]
}
```
**Expected**: 201 Created - Should accept new fields

---

## 🔍 Dynamic Endpoint Discovery

### 61. Get Platform Capabilities (No Auth Required)
**GET** `{{baseUrl}}/api/discovery/capabilities`
**Expected**: 200 OK with platform features and capabilities

### 62. List Available Schemas (Tenant Admin)
**GET** `{{baseUrl}}/api/discovery/schemas`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with all schemas available to tenant admin

### 63. List Available Schemas (Office Manager - Limited View)
**GET** `{{baseUrl}}/api/discovery/schemas`
**Headers**: `Authorization: Bearer {{officeToken}}`
**Expected**: 200 OK with schemas office manager can access

### 64. Get Available Endpoints (Tenant Admin)
**GET** `{{baseUrl}}/api/discovery/endpoints`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with dynamically generated endpoint list

### 65. Generate OpenAPI Specification (Tenant Admin)
**GET** `{{baseUrl}}/api/discovery/openapi`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with complete OpenAPI spec for tenant

### 66. Generate TypeScript Interfaces (Tenant Admin)
**GET** `{{baseUrl}}/api/discovery/typescript/customer`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 200 OK with TypeScript interface definitions

---

## 📋 Queue Management & Background Jobs

### 67. Get Queue Status (Super Admin Only)
**GET** `{{baseUrl}}/api/admin/queues`
**Headers**: `Authorization: Bearer {{systemAdminToken}}`
**Expected**: 200 OK with list of active queues

### 68. Get Queue Statistics (Super Admin Only)
**GET** `{{baseUrl}}/api/admin/queues/stats`
**Headers**: `Authorization: Bearer {{systemAdminToken}}`
**Expected**: 200 OK with queue performance metrics

### 69. Test Tenant Admin Cannot Access Queues (Should Fail)
**GET** `{{baseUrl}}/api/admin/queues`
**Headers**: `Authorization: Bearer {{tenantAdminToken}}`
**Expected**: 403 Forbidden - Only super admin can access queue management

---

## 🏥 System & Health Monitoring

### 70. Health Check
**GET** `{{baseUrl}}/health`
**Expected**: 200 OK with health status

### 71. Ready Check
**GET** `{{baseUrl}}/ready`
**Expected**: 200 OK with readiness status

### 72. System Information
**GET** `{{baseUrl}}/api/system/info`
**Expected**: 200 OK with platform capabilities and version info

---

## 🧪 Advanced Testing Scenarios

### 62. Test Multi-Tenant Isolation
**Create a second tenant and verify data isolation:**
1. Use `{{tenantId2}}` for second tenant operations
2. Create schema in tenant-2
3. Create data in tenant-2
4. Verify admin from tenant-1 cannot access tenant-2 data
5. Verify proper 403/404 responses

### 63. Test Role-Based Access Control
**Test different user roles:**
1. Use `{{officeToken}}` to test office permissions
2. Use `{{technicianToken}}` to test technician permissions
3. Use `{{customerToken}}` to test customer permissions
4. Verify proper access restrictions
5. Test permission escalation attempts

### 64. Test Schema Hot-Reload
**Test schema changes without restart:**
1. Update existing schema
2. Verify new endpoints are available immediately
3. Test data validation with new schema
4. Verify old data still works
5. Test schema rollback

### 65. Test Conflict Resolution
**Simulate offline conflicts:**
1. Create conflicting changes from different devices
2. Test various conflict resolution strategies
3. Verify conflict history is maintained
4. Test manual conflict resolution
5. Verify data integrity after resolution

### 66. Test Background Job Processing
**Test queue system:**
1. Monitor job creation and processing
2. Test job failure and retry mechanisms
3. Verify job status updates
4. Test queue pause/resume functionality
5. Monitor job completion and cleanup

### 67. Test Audit Trail Completeness
**Verify comprehensive auditing:**
1. Create, update, delete operations
2. Verify all changes are logged
3. Test version comparison
4. Verify rollback functionality
5. Test audit cleanup and retention

### 68. Test Offline Sync Edge Cases
**Test sync robustness:**
1. Test with large datasets
2. Test with network interruptions
3. Test with corrupted data
4. Test with version mismatches
5. Test with full sync requirements

---

## 🔧 Testing Tips & Best Practices

### Environment Setup
- Use separate Postman collections for different test scenarios
- Set up environment variables for easy token management
- Use pre-request scripts to automatically set tokens
- Use test scripts to validate responses and set variables

### Data Management
- Clean up test data after testing
- Use unique identifiers for test data
- Test with realistic data volumes
- Verify data consistency across operations

### Error Testing
- Test with invalid data
- Test with missing required fields
- Test with unauthorized access
- Test with malformed requests
- Verify proper error responses

### Performance Testing
- Test with concurrent requests
- Monitor response times
- Test with large datasets
- Verify queue processing performance
- Test system under load

### Security Testing
- Test authentication bypass attempts
- Test authorization boundaries
- Test tenant isolation
- Test input validation
- Test rate limiting

---

## 📊 Expected Response Patterns

### Success Responses
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

### Error Responses
```json
{
  "success": false,
  "error": "Error description",
  "message": "User-friendly error message",
  "code": "ERROR_CODE"
}
```

### Pagination Responses
```json
{
  "success": true,
  "data": {
    "documents": [ /* array of items */ ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalRecords": 100,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  },
  "message": "Records retrieved successfully"
}
```

---

## 🎯 Testing Completion Checklist

- [ ] System bootstrap completed successfully (or super admin registered)
- [ ] Authentication flow working for all user types
- [ ] Multi-tenant isolation verified
- [ ] Role-based access control tested
- [ ] Schema management functional
- [ ] Dynamic CRUD operations working
- [ ] Audit trail complete and accurate
- [ ] Rollback functionality verified
- [ ] Offline sync working correctly
- [ ] Conflict resolution tested
- [ ] Schema versioning functional
- [ ] Discovery endpoints functional
- [ ] Queue system operational (super admin only)
- [ ] Background jobs processing
- [ ] System health monitoring working
- [ ] Error handling comprehensive
- [ ] Performance acceptable
- [ ] Security measures effective

---

## 🚀 Next Steps After Testing

1. **Performance Optimization**: Based on testing results
2. **Security Hardening**: Address any security findings
3. **Documentation Updates**: Update API documentation
4. **Production Deployment**: Deploy to production environment
5. **Monitoring Setup**: Configure production monitoring
6. **Backup Procedures**: Test backup and recovery
7. **Disaster Recovery**: Test failover procedures
8. **User Training**: Train end users on the system

---

## 🔧 Troubleshooting Common Issues

### "Access token required" Error
**Problem**: Getting `TOKEN_MISSING` error when trying to access protected endpoints
**Solution**: 
1. Use `/api/auth/register-super-admin` to create super admin (production)
2. Or run `node scripts/bootstrap-system.js` (development)
3. Follow the authentication flow to get valid tokens
4. Ensure tokens are being sent in Authorization headers

### "Tenant not found" Error
**Problem**: Getting 404 when accessing tenant-specific endpoints
**Solution**:
1. Verify the tenant ID in your environment variables
2. Ensure the tenant was created successfully
3. Check that you're using the correct tenant ID format

### Authentication Issues
**Problem**: Getting 401/403 errors
**Solution**:
1. Ensure you've completed the user registration and login flow
2. Verify JWT tokens are being sent in Authorization headers
3. Check that user roles have the required permissions
4. Ensure `X-Tenant-ID` header is set for tenant-specific operations

### Database Connection Issues
**Problem**: Getting database connection errors
**Solution**:
1. Ensure MongoDB is running and accessible
2. Check connection string in environment variables
3. Verify database permissions and network access

### Queue System Issues
**Problem**: Background jobs not processing
**Solution**:
1. Ensure Redis is running and accessible
2. Check Redis connection parameters
3. Verify BullMQ worker processes are running

---

**This testing guide covers all API endpoints and provides comprehensive testing scenarios for the Craftsman Dynamic Backend Platform. Follow the sequential order to ensure proper dependency management and thorough functionality validation.**
