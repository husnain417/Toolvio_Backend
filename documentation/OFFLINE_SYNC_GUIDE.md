# 🔄 Offline Sync & Conflict Resolution Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [API Endpoints](#api-endpoints)
5. [Client Implementation](#client-implementation)
6. [Conflict Resolution](#conflict-resolution)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The Toolvio Backend now includes comprehensive **offline sync functionality** that allows clients to:

- ✅ **Work offline** and sync changes when connection is restored
- ✅ **Handle conflicts** intelligently with multiple resolution strategies
- ✅ **Track sync state** per device and tenant
- ✅ **Resolve schema evolution** issues automatically
- ✅ **Maintain data integrity** with reference validation
- ✅ **Audit all changes** with complete sync history

### **Key Features**

- **Multi-version sync system** (Global, Tenant, Schema levels)
- **Intelligent conflict detection** and resolution
- **Client state management** with preferences
- **Tombstone support** for deleted records
- **Schema migration** during sync
- **Performance optimization** with change aggregation

---

## 🏗️ Architecture

### **Sync Version Management**

The system uses a **three-tier versioning system**:

```javascript
{
  globalSyncVersion: 1000,      // Total ordering across all changes
  tenantSyncVersion: 500,       // Tenant-specific ordering
  schemaSyncVersion: 250        // Schema-specific ordering
}
```

### **Data Flow**

```
Client Offline Changes → Local Storage → Sync Request → Conflict Detection → Resolution → Server Update → Audit Log
```

### **Conflict Types**

1. **Concurrent Modifications** - Same record modified on client and server
2. **Schema Mismatches** - Client using older schema version
3. **Reference Integrity** - Invalid references to other records
4. **Deletion Conflicts** - Updating deleted records
5. **Multi-Device Conflicts** - Same user, different devices

---

## 🚀 Getting Started

### **1. Initialize Client Sync State**

First, register your device with the sync system:

```javascript
// POST /api/sync/state
const syncState = await fetch('/api/sync/state', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deviceId: 'iphone_12_pro_max_12345',
    appVersion: '1.2.3',
    platform: 'ios',
    syncIntervalMinutes: 15,
    connectionType: 'wifi',
    networkQuality: 'good',
    preferences: {
      autoSync: true,
      syncOnWifiOnly: false,
      maxBatchSize: 1000,
      conflictResolution: 'smart_merge'
    }
  })
});
```

### **2. Get Changes Since Last Sync**

Retrieve incremental changes from the server:

```javascript
// GET /api/sync/changes?since=1000&deviceId=iphone_12_pro_max_12345
const changes = await fetch('/api/sync/changes?since=1000&deviceId=iphone_12_pro_max_12345', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const response = await changes.json();

if (response.data.requiresFullSync) {
  // Handle full sync requirement
  console.log('Full sync required:', response.data.reason);
} else {
  // Process incremental changes
  const { changes, schemaVersions, currentGlobalVersion } = response.data;
  await processServerChanges(changes);
  await updateLocalSyncVersion(currentGlobalVersion);
}
```

### **3. Send Client Changes**

Send offline changes to the server:

```javascript
// POST /api/sync/batch
const syncResult = await fetch('/api/sync/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deviceId: 'iphone_12_pro_max_12345',
    clientSyncVersion: 1000,
    changes: [
      {
        operation: 'create',
        schema: 'products',
        data: {
          name: 'New Product',
          price: 99.99,
          category: 'electronics'
        },
        clientTimestamp: new Date().toISOString(),
        clientVersion: '1.2.3'
      },
      {
        operation: 'update',
        schema: 'products',
        recordId: '507f1f77bcf86cd799439011',
        data: {
          price: 89.99
        },
        clientTimestamp: new Date().toISOString(),
        clientVersion: '1.2.3'
      }
    ],
    conflictResolution: {
      strategy: 'smart_merge'
    }
  }
});
```

---

## 🌐 API Endpoints

### **Sync Changes**
```
GET /api/sync/changes
```
**Parameters:**
- `since` (required) - Last known global sync version
- `deviceId` (required) - Unique device identifier
- `schemas` (optional) - Specific schemas to sync (comma-separated)
- `limit` (optional) - Maximum changes to return (default: 1000)
- `includeDeleted` (optional) - Include tombstone records (default: true)

**Response:**
```json
{
  "success": true,
  "changes": [...],
  "schemaVersions": {
    "products": 250,
    "orders": 180
  },
  "currentGlobalVersion": 1000,
  "currentTenantVersion": 500,
  "syncMetadata": {
    "changeCount": 25,
    "syncDuration": 150,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### **Batch Sync**
```
POST /api/sync/batch
```
**Request Body:**
```json
{
  "deviceId": "device_123",
  "clientSyncVersion": 1000,
  "changes": [
    {
      "operation": "create|update|delete",
      "schema": "schema_name",
      "recordId": "record_id", // Required for update/delete
      "data": {}, // Record data
      "clientTimestamp": "2024-01-15T10:30:00Z",
      "clientVersion": "1.2.3"
    }
  ],
  "conflictResolution": {
    "strategy": "server_wins|client_wins|manual|smart_merge"
  }
}
```

### **Sync State Management**
```
GET /api/sync/state?deviceId=device_123
POST /api/sync/state
```

### **Conflict Management**
```
GET /api/sync/conflicts?schemas=products,orders
```

### **System Health**
```
GET /api/sync/health
```

---

## 📱 Client Implementation

### **Basic Sync Client**

```javascript
class SyncClient {
  constructor(tenantId, deviceId, token) {
    this.tenantId = tenantId;
    this.deviceId = deviceId;
    this.token = token;
    this.lastSyncVersion = 0;
    this.pendingChanges = [];
    this.syncInterval = null;
  }

  // Initialize sync
  async initialize() {
    // Register device
    await this.registerDevice();
    
    // Start auto-sync
    this.startAutoSync();
    
    // Perform initial sync
    await this.sync();
  }

  // Register device with server
  async registerDevice() {
    const response = await fetch('/api/sync/state', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        appVersion: '1.2.3',
        platform: 'web',
        preferences: {
          conflictResolution: 'smart_merge'
        }
      })
    });
    
    return response.json();
  }

  // Perform sync
  async sync() {
    try {
      // Get changes from server
      const changes = await this.getServerChanges();
      
      // Send local changes to server
      const syncResult = await this.sendLocalChanges();
      
      // Update local sync version
      this.lastSyncVersion = changes.currentGlobalVersion;
      
      return { success: true, changes: changes.changes };
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get changes from server
  async getServerChanges() {
    const response = await fetch(
      `/api/sync/changes?since=${this.lastSyncVersion}&deviceId=${this.deviceId}`,
      {
        headers: { 'Authorization': `Bearer ${this.token}` }
      }
    );
    
    return response.json();
  }

  // Send local changes to server
  async sendLocalChanges() {
    if (this.pendingChanges.length === 0) {
      return { success: true, processedChanges: 0 };
    }

    const response = await fetch('/api/sync/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        clientSyncVersion: this.lastSyncVersion,
        changes: this.pendingChanges
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.pendingChanges = []; // Clear pending changes
    }
    
    return result;
  }

  // Queue local change
  queueChange(operation, schema, data, recordId = null) {
    this.pendingChanges.push({
      operation,
      schema,
      recordId,
      data,
      clientTimestamp: new Date().toISOString(),
      clientVersion: '1.2.3'
    });
  }

  // Start auto-sync
  startAutoSync() {
    this.syncInterval = setInterval(() => {
      this.sync();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  // Stop auto-sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}
```

### **Usage Example**

```javascript
// Initialize sync client
const syncClient = new SyncClient('acme-corp', 'web_client_123', userToken);
await syncClient.initialize();

// Queue changes while offline
syncClient.queueChange('create', 'products', {
  name: 'New Product',
  price: 99.99
});

syncClient.queueChange('update', 'products', {
  price: 89.99
}, 'product_id_123');

// Sync will happen automatically, or manually:
await syncClient.sync();
```

---

## ⚔️ Conflict Resolution

### **Resolution Strategies**

1. **Server Wins** - Server values always override client values
2. **Client Wins** - Client values always override server values
3. **Smart Merge** - Intelligent field-level merging
4. **Manual** - Require human intervention

### **Conflict Detection**

The system automatically detects:

- **Concurrent modifications** to the same record
- **Schema version mismatches** with breaking changes
- **Reference integrity violations**
- **Deletion conflicts**
- **Multi-device conflicts**

### **Smart Merge Example**

```javascript
// Client changes product price to 89.99
// Server changes product name to "Updated Product"
// Result: Both changes are merged
{
  "name": "Updated Product",    // From server
  "price": 89.99               // From client
}
```

### **Handling Conflicts**

```javascript
// Check for conflicts
const conflicts = await fetch('/api/sync/conflicts', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Resolve conflicts manually
for (const conflict of conflicts.data.conflicts) {
  if (conflict.conflictType === 'concurrent') {
    // Show user both versions and let them choose
    const resolution = await showConflictDialog(conflict);
    
    // Apply resolution
    await resolveConflict(conflict._id, resolution);
  }
}
```

---

## 🎯 Best Practices

### **1. Device Management**

- Use **unique device IDs** (e.g., `iphone_12_pro_max_12345`)
- Include **platform information** for better conflict resolution
- Set appropriate **sync intervals** based on app usage

### **2. Change Batching**

- **Batch changes** instead of sending individual requests
- **Limit batch size** to 1000 changes maximum
- **Queue changes** while offline and sync when possible

### **3. Conflict Resolution**

- Use **smart_merge** as default strategy
- **Monitor conflicts** regularly
- **Resolve high-severity conflicts** manually
- **Educate users** about conflict resolution

### **4. Error Handling**

- **Implement retry logic** with exponential backoff
- **Handle network interruptions** gracefully
- **Provide user feedback** during sync operations
- **Log sync failures** for debugging

### **5. Performance**

- **Sync only changed schemas** when possible
- **Use appropriate batch sizes** based on network quality
- **Implement incremental sync** to avoid full resyncs
- **Cache schema information** locally

---

## 🔧 Troubleshooting

### **Common Issues**

#### **1. "Client too far behind" Error**

**Cause:** Client hasn't synced for a long time
**Solution:** Perform full sync or reset client state

```javascript
// Reset client sync state
await fetch('/api/sync/state', {
  method: 'POST',
  body: JSON.stringify({
    deviceId: 'device_123',
    appVersion: '1.2.3',
    platform: 'web',
    resetSync: true
  })
});
```

#### **2. Schema Version Mismatch**

**Cause:** Client using outdated schema
**Solution:** Update client app or handle migration

```javascript
// Check if client update is required
if (response.data.requiresClientUpdate) {
  showUpdateDialog(response.data.minRequiredVersion);
}
```

#### **3. Reference Integrity Violations**

**Cause:** Referenced records don't exist
**Solution:** Validate references before sync

```javascript
// Validate references locally
const isValid = await validateLocalReferences(change.data);
if (!isValid) {
  // Handle invalid references
  await cleanupInvalidReferences(change);
}
```

#### **4. Sync Performance Issues**

**Cause:** Large sync payloads or network issues
**Solution:** Optimize sync strategy

```javascript
// Reduce batch size for poor connections
const batchSize = networkQuality === 'poor' ? 100 : 1000;

// Sync only essential schemas
const schemas = ['products', 'orders']; // Skip non-essential schemas
```

### **Debug Information**

Enable detailed logging for troubleshooting:

```javascript
// Check sync health
const health = await fetch('/api/sync/health');
console.log('Sync health:', health.data);

// Check client state
const state = await fetch('/api/sync/state?deviceId=device_123');
console.log('Client state:', state.data);

// Check for conflicts
const conflicts = await fetch('/api/sync/conflicts');
console.log('Active conflicts:', conflicts.data);
```

---

## 📊 Monitoring & Analytics

### **Sync Metrics**

Track sync performance and health:

- **Sync success rate** per device
- **Average sync duration**
- **Conflict frequency** by type
- **Network quality** impact
- **Schema evolution** tracking

### **Health Dashboard**

Monitor overall sync system health:

```javascript
// Get system health
const health = await fetch('/api/sync/health');
const { statistics, status } = health.data;

console.log(`Status: ${status}`);
console.log(`Active clients: ${statistics.activeClients}`);
console.log(`Global version: ${statistics.globalVersion}`);
console.log(`Recent syncs:`, statistics.recentSyncs);
```

---

## 🚀 Advanced Features

### **1. Offline-First Architecture**

- **Local-first data storage**
- **Optimistic UI updates**
- **Background sync**
- **Conflict resolution UI**

### **2. Smart Sync Strategies**

- **WiFi-only sync** for large datasets
- **Adaptive batch sizing** based on network
- **Priority-based sync** for critical data
- **Incremental schema updates**

### **3. Multi-Device Coordination**

- **Cross-device conflict detection**
- **Device preference management**
- **Sync state synchronization**
- **Offline capability coordination**

---

This offline sync system provides enterprise-grade synchronization capabilities with intelligent conflict resolution, making it perfect for applications that need to work reliably both online and offline.
