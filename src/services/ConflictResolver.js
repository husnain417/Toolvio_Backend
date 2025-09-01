const AuditLog = require('../models/AuditLog');
const Schema = require('../models/Schema');
const CollectionGenerator = require('./CollectionGenerator');

class ConflictResolver {
  constructor() {
    this.conflictTypes = {
      CONCURRENT: 'concurrent',
      SCHEMA_MISMATCH: 'schema',
      DELETED: 'deleted',
      REFERENCE_INTEGRITY: 'reference_integrity',
      MULTI_DEVICE: 'multi_device'
    };
  }

  /**
   * Analyze a client change for potential conflicts
   */
  async analyzeChange(change, tenantId) {
    const { operation, schema, recordId, data, clientTimestamp } = change;
    
    try {
      // Get current server state
      const serverState = await this.getServerState(schema, recordId, tenantId);
      
      // Check for different types of conflicts
      const conflicts = [];
      
      // 1. Check for concurrent modifications
      if (operation === 'update' && serverState.exists) {
        const concurrentConflict = await this.checkConcurrentModification(
          change, serverState, clientTimestamp
        );
        if (concurrentConflict) conflicts.push(concurrentConflict);
      }
      
      // 2. Check for schema version mismatches
      const schemaConflict = await this.checkSchemaMismatch(change, tenantId);
      if (schemaConflict) conflicts.push(schemaConflict);
      
      // 3. Check for reference integrity issues
      const referenceConflict = await this.checkReferenceIntegrity(change, tenantId);
      if (referenceConflict) conflicts.push(referenceConflict);
      
      // 4. Check for deletion conflicts
      if (operation === 'update' && serverState.isTombstone) {
        conflicts.push({
          type: this.conflictTypes.DELETED,
          severity: 'high',
          message: 'Attempting to update a deleted record',
          serverValue: null,
          clientValue: data
        });
      }
      
      // 5. Check for multi-device conflicts
      const multiDeviceConflict = await this.checkMultiDeviceConflict(change, tenantId);
      if (multiDeviceConflict) conflicts.push(multiDeviceConflict);
      
      return {
        hasConflict: conflicts.length > 0,
        conflicts,
        serverState,
        clientState: change,
        recommendedResolution: this.getRecommendedResolution(conflicts)
      };
      
    } catch (error) {
      console.error('Error analyzing change for conflicts:', error);
      return {
        hasConflict: false,
        conflicts: [],
        error: error.message
      };
    }
  }

  /**
   * Check for concurrent modifications
   */
  async checkConcurrentModification(change, serverState, clientTimestamp) {
    const { operation, data } = change;
    
    if (operation !== 'update') return null;
    
    // Get the most recent server modification
    const recentAuditLog = await AuditLog.findOne({
      documentId: change.recordId,
      schemaName: change.schema,
      operation: { $in: ['update', 'create'] }
    }).sort({ timestamp: -1 });
    
    if (!recentAuditLog) return null;
    
    // Check if client and server modified the same record around the same time
    const timeDiff = Math.abs(clientTimestamp - recentAuditLog.timestamp);
    const toleranceMs = 5 * 60 * 1000; // 5 minutes tolerance
    
    if (timeDiff < toleranceMs) {
      // Check for field-level conflicts
      const fieldConflicts = this.detectFieldConflicts(data, serverState.data);
      
      if (fieldConflicts.length > 0) {
        return {
          type: this.conflictTypes.CONCURRENT,
          severity: 'medium',
          message: 'Concurrent modification detected',
          fieldConflicts,
          serverValue: serverState.data,
          clientValue: data,
          serverTimestamp: recentAuditLog.timestamp,
          clientTimestamp
        };
      }
    }
    
    return null;
  }

  /**
   * Check for schema version mismatches
   */
  async checkSchemaMismatch(change, tenantId) {
    try {
      const schema = await Schema.findOne({ name: change.schema, tenantId });
      if (!schema) return null;
      
      // Check if client is using an older schema version
      const clientSchemaVersion = change.clientSchemaVersion || '1.0.0';
      const serverSchemaVersion = schema.version || '1.0.0';
      
      if (this.compareVersions(clientSchemaVersion, serverSchemaVersion) < 0) {
        // Check for breaking changes
        const breakingChanges = this.identifyBreakingChanges(
          change.data, 
          schema.jsonSchema, 
          clientSchemaVersion
        );
        
        if (breakingChanges.length > 0) {
          return {
            type: this.conflictTypes.SCHEMA_MISMATCH,
            severity: 'high',
            message: 'Schema version mismatch with breaking changes',
            breakingChanges,
            clientSchemaVersion,
            serverSchemaVersion,
            requiredClientUpdate: true
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking schema mismatch:', error);
      return null;
    }
  }

  /**
   * Check for reference integrity issues
   */
  async checkReferenceIntegrity(change, tenantId) {
    try {
      const schema = await Schema.findOne({ name: change.schema, tenantId });
      if (!schema) return null;
      
      const referenceIssues = [];
      
      // Check each field for reference integrity
      for (const [fieldName, fieldValue] of Object.entries(change.data)) {
        const fieldDef = schema.jsonSchema.properties[fieldName];
        
        if (fieldDef && fieldDef.reference) {
          const isValid = await this.validateReference(
            fieldDef.reference.schema,
            fieldValue,
            fieldDef.reference.type,
            tenantId
          );
          
          if (!isValid) {
            referenceIssues.push({
              field: fieldName,
              value: fieldValue,
              referencedSchema: fieldDef.reference.schema,
              issue: 'Referenced record does not exist'
            });
          }
        }
      }
      
      if (referenceIssues.length > 0) {
        return {
          type: this.conflictTypes.REFERENCE_INTEGRITY,
          severity: 'high',
          message: 'Reference integrity violations detected',
          referenceIssues,
          serverValue: null,
          clientValue: change.data
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking reference integrity:', error);
      return null;
    }
  }

  /**
   * Check for multi-device conflicts
   */
  async checkMultiDeviceConflict(change, tenantId) {
    try {
      // Find other devices that modified the same record recently
      const recentChanges = await AuditLog.find({
        documentId: change.recordId,
        schemaName: change.schema,
        tenantId,
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        deviceId: { $ne: change.deviceId }
      }).sort({ timestamp: -1 });
      
      if (recentChanges.length > 0) {
        return {
          type: this.conflictTypes.MULTI_DEVICE,
          severity: 'medium',
          message: 'Multiple devices modified the same record',
          otherDevices: recentChanges.map(log => ({
            deviceId: log.deviceId,
            operation: log.operation,
            timestamp: log.timestamp,
            changes: log.changedFields
          })),
          serverValue: null,
          clientValue: change.data
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking multi-device conflict:', error);
      return null;
    }
  }

  /**
   * Detect field-level conflicts between client and server data
   */
  detectFieldConflicts(clientData, serverData) {
    const conflicts = [];
    
    for (const [field, clientValue] of Object.entries(clientData)) {
      if (serverData[field] !== undefined && serverData[field] !== clientValue) {
        conflicts.push({
          field,
          serverValue: serverData[field],
          clientValue,
          conflictType: 'value_mismatch'
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Identify breaking changes in schema evolution
   */
  identifyBreakingChanges(clientData, serverSchema, clientSchemaVersion) {
    const breakingChanges = [];
    
    // Check for removed required fields
    if (serverSchema.required) {
      for (const requiredField of serverSchema.required) {
        if (!(requiredField in clientData)) {
          breakingChanges.push({
            type: 'required_field_missing',
            field: requiredField,
            severity: 'high'
          });
        }
      }
    }
    
    // Check for type changes
    for (const [field, fieldDef] of Object.entries(serverSchema.properties)) {
      if (clientData[field] !== undefined) {
        const clientType = this.getTypeOf(clientData[field]);
        if (clientType !== fieldDef.type) {
          breakingChanges.push({
            type: 'type_mismatch',
            field,
            expectedType: fieldDef.type,
            actualType: clientType,
            severity: 'high'
          });
        }
      }
    }
    
    return breakingChanges;
  }

  /**
   * Validate a reference to another record
   */
  async validateReference(schemaName, value, referenceType, tenantId) {
    try {
      if (!value) return true; // Null/undefined references are valid
      
      const CollectionGenerator = require('./CollectionGenerator');
      const model = await CollectionGenerator.getDynamicModel(schemaName, tenantId);
      
      if (referenceType === 'array_reference') {
        // For array references, check if all values exist
        if (!Array.isArray(value)) return false;
        const existingRecords = await model.countDocuments({
          _id: { $in: value }
        });
        return existingRecords === value.length;
      } else {
        // For single references, check if the record exists
        const existingRecord = await model.findById(value);
        return !!existingRecord;
      }
    } catch (error) {
      console.error('Error validating reference:', error);
      return false;
    }
  }

  /**
   * Get current server state for a record
   */
  async getServerState(schemaName, recordId, tenantId) {
    try {
      const CollectionGenerator = require('./CollectionGenerator');
      const model = await CollectionGenerator.getDynamicModel(schemaName, tenantId);
      
      if (!recordId) {
        return { exists: false, data: null, isTombstone: false };
      }
      
      const record = await model.findById(recordId);
      
      if (!record) {
        // Check if it's a tombstone
        const tombstone = await AuditLog.findOne({
          documentId: recordId,
          schemaName,
          tenantId,
          isTombstone: true
        });
        
        return {
          exists: false,
          data: null,
          isTombstone: !!tombstone
        };
      }
      
      return {
        exists: true,
        data: record.toObject(),
        isTombstone: false
      };
    } catch (error) {
      console.error('Error getting server state:', error);
      return { exists: false, data: null, isTombstone: false };
    }
  }

  /**
   * Get recommended resolution strategy based on conflicts
   */
  getRecommendedResolution(conflicts) {
    if (conflicts.length === 0) return 'accept';
    
    // Check for high severity conflicts
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    
    if (highSeverityConflicts.length > 0) {
      // For high severity conflicts, recommend manual resolution
      return 'manual';
    }
    
    // For medium severity conflicts, recommend smart merge
    return 'smart_merge';
  }

  /**
   * Compare version strings
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  /**
   * Get type of a value
   */
  getTypeOf(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  /**
   * Resolve conflicts using specified strategy
   */
  async resolveConflicts(conflicts, strategy, tenantId) {
    switch (strategy) {
      case 'server_wins':
        return await this.resolveServerWins(conflicts);
      
      case 'client_wins':
        return await this.resolveClientWins(conflicts);
      
      case 'smart_merge':
        return await this.resolveSmartMerge(conflicts, tenantId);
      
      case 'manual':
        return await this.flagForManualResolution(conflicts);
      
      default:
        return await this.resolveSmartMerge(conflicts, tenantId);
    }
  }

  /**
   * Resolve conflicts by accepting server values
   */
  async resolveServerWins(conflicts) {
    return {
      strategy: 'server_wins',
      resolved: true,
      message: 'All conflicts resolved using server values',
      conflicts: conflicts.map(c => ({
        ...c,
        resolution: 'server_wins',
        resolvedAt: new Date()
      }))
    };
  }

  /**
   * Resolve conflicts by accepting client values
   */
  async resolveClientWins(conflicts) {
    return {
      strategy: 'client_wins',
      resolved: true,
      message: 'All conflicts resolved using client values',
      conflicts: conflicts.map(c => ({
        ...c,
        resolution: 'client_wins',
        resolvedAt: new Date()
      }))
    };
  }

  /**
   * Resolve conflicts using intelligent merging
   */
  async resolveSmartMerge(conflicts, tenantId) {
    const resolvedConflicts = [];
    
    for (const conflict of conflicts) {
      let resolution = 'merged';
      
      switch (conflict.type) {
        case this.conflictTypes.CONCURRENT:
          resolution = await this.mergeConcurrentChanges(conflict);
          break;
        
        case this.conflictTypes.SCHEMA_MISMATCH:
          resolution = await this.migrateClientData(conflict, tenantId);
          break;
        
        case this.conflictTypes.REFERENCE_INTEGRITY:
          resolution = 'rejected'; // Reject invalid references
          break;
        
        default:
          resolution = 'manual'; // Require manual resolution for unknown conflicts
      }
      
      resolvedConflicts.push({
        ...conflict,
        resolution,
        resolvedAt: new Date()
      });
    }
    
    return {
      strategy: 'smart_merge',
      resolved: resolvedConflicts.every(c => c.resolution !== 'manual'),
      message: 'Conflicts resolved using intelligent merging',
      conflicts: resolvedConflicts
    };
  }

  /**
   * Flag conflicts for manual resolution
   */
  async flagForManualResolution(conflicts) {
    return {
      strategy: 'manual',
      resolved: false,
      message: 'Conflicts require manual resolution',
      conflicts: conflicts.map(c => ({
        ...c,
        resolution: 'pending_manual',
        flaggedAt: new Date()
      }))
    };
  }

  /**
   * Merge concurrent changes intelligently
   */
  async mergeConcurrentChanges(conflict) {
    if (!conflict.fieldConflicts) return 'merged';
    
    const mergedData = {};
    let hasConflicts = false;
    
    for (const fieldConflict of conflict.fieldConflicts) {
      if (fieldConflict.conflictType === 'value_mismatch') {
        // For simple value conflicts, use timestamp-based resolution
        if (conflict.clientTimestamp > conflict.serverTimestamp) {
          mergedData[fieldConflict.field] = fieldConflict.clientValue;
        } else {
          mergedData[fieldConflict.field] = fieldConflict.serverValue;
        }
        hasConflicts = true;
      }
    }
    
    return hasConflicts ? 'merged' : 'no_conflict';
  }

  /**
   * Migrate client data to current schema version
   */
  async migrateClientData(conflict, tenantId) {
    try {
      // This is a simplified migration - in production you'd want more sophisticated logic
      const migratedData = { ...conflict.clientValue };
      
      // Handle missing required fields
      if (conflict.breakingChanges) {
        for (const breakingChange of conflict.breakingChanges) {
          if (breakingChange.type === 'required_field_missing') {
            // Provide default value for missing required field
            migratedData[breakingChange.field] = this.getDefaultValue(breakingChange.field);
          }
        }
      }
      
      return 'migrated';
    } catch (error) {
      console.error('Error migrating client data:', error);
      return 'manual'; // Fallback to manual resolution
    }
  }

  /**
   * Get default value for a field
   */
  getDefaultValue(fieldName) {
    // Simple default value logic - enhance based on your needs
    if (fieldName.includes('date') || fieldName.includes('Date')) {
      return new Date();
    }
    if (fieldName.includes('count') || fieldName.includes('Count')) {
      return 0;
    }
    if (fieldName.includes('enabled') || fieldName.includes('active')) {
      return false;
    }
    return '';
  }
}

module.exports = ConflictResolver;
