const SchemaVersion = require('../models/SchemaVersion');
const semver = require('semver');

/**
 * Schema Version Service
 * Manages schema versioning, compatibility checking, and version control
 */
class SchemaVersionService {
  /**
   * Create a new schema version
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {Object} newSchema - New schema definition
   * @param {string} changelog - Human-readable changes
   * @param {string} userId - User creating the version
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Created schema version
   */
  async createSchemaVersion(tenantId, schemaName, newSchema, changelog, userId, options = {}) {
    try {
      // Get current active version
      const currentVersion = await SchemaVersion.getActiveVersion(tenantId, schemaName);
      
      // Determine new version number
      let newVersion;
      if (!currentVersion) {
        newVersion = '1.0.0'; // First version
      } else {
        const { compatibilityLevel = 'PATCH' } = options;
        newVersion = this.calculateNextVersion(currentVersion.version, compatibilityLevel);
      }

      // Check compatibility with current version
      let compatibilityLevel = 'PATCH';
      let metadata = {};
      
      if (currentVersion) {
        const compatibility = this.checkSchemaCompatibility(currentVersion.schema, newSchema);
        compatibilityLevel = compatibility.level;
        metadata = compatibility.metadata;
      }

      // Create new schema version
      const schemaVersion = new SchemaVersion({
        tenantId,
        schemaName,
        version: newVersion,
        schema: newSchema,
        changelog,
        createdBy: userId,
        isActive: options.activate || false,
        migrationScript: options.migrationScript || null,
        compatibilityLevel,
        previousVersion: currentVersion ? currentVersion.version : null,
        metadata
      });

      // If this should be active, activate it
      if (schemaVersion.isActive) {
        await schemaVersion.activate();
      }

      const savedVersion = await schemaVersion.save();
      console.log(`✅ Created schema version ${newVersion} for ${schemaName}`);

      return savedVersion;
    } catch (error) {
      console.error('❌ Error creating schema version:', error);
      throw new Error(`Failed to create schema version: ${error.message}`);
    }
  }

  /**
   * Get schema version history
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Version history with pagination
   */
  async getSchemaVersionHistory(tenantId, schemaName, options = {}) {
    try {
      const { page = 1, limit = 20, includeSchema = false } = options;
      
      const query = { tenantId, schemaName };
      const skip = (page - 1) * limit;
      
      const total = await SchemaVersion.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      let versionsQuery = SchemaVersion.find(query)
        .sort({ version: -1 })
        .skip(skip)
        .limit(limit);

      // Optionally exclude schema for performance
      if (!includeSchema) {
        versionsQuery = versionsQuery.select('-schema');
      }

      const versions = await versionsQuery.lean();

      return {
        schemaName,
        tenantId,
        versions,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        }
      };
    } catch (error) {
      console.error('❌ Error getting schema version history:', error);
      throw new Error(`Failed to get schema version history: ${error.message}`);
    }
  }

  /**
   * Get active schema version
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @returns {Promise<Object|null>} - Active schema version
   */
  async getActiveSchemaVersion(tenantId, schemaName) {
    try {
      return await SchemaVersion.getActiveVersion(tenantId, schemaName);
    } catch (error) {
      console.error('❌ Error getting active schema version:', error);
      throw new Error(`Failed to get active schema version: ${error.message}`);
    }
  }

  /**
   * Activate a specific schema version
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {string} version - Version to activate
   * @returns {Promise<Object>} - Activated schema version
   */
  async activateSchemaVersion(tenantId, schemaName, version) {
    try {
      const schemaVersion = await SchemaVersion.findOne({
        tenantId,
        schemaName,
        version
      });

      if (!schemaVersion) {
        throw new Error(`Schema version ${version} not found`);
      }

      await schemaVersion.activate();
      console.log(`✅ Activated schema version ${version} for ${schemaName}`);

      return schemaVersion;
    } catch (error) {
      console.error('❌ Error activating schema version:', error);
      throw new Error(`Failed to activate schema version: ${error.message}`);
    }
  }

  /**
   * Check schema compatibility between two versions
   * @param {Object} oldSchema - Old schema definition
   * @param {Object} newSchema - New schema definition
   * @returns {Object} - Compatibility analysis
   */
  checkSchemaCompatibility(oldSchema, newSchema) {
    const analysis = {
      level: 'PATCH',
      breakingChanges: [],
      deprecatedFields: [],
      newFields: [],
      modifiedFields: [],
      isCompatible: true
    };

    try {
      const oldProperties = oldSchema.properties || {};
      const newProperties = newSchema.properties || {};
      const oldRequired = oldSchema.required || [];
      const newRequired = newSchema.required || [];

      // Check for new required fields (breaking change)
      const newRequiredFields = newRequired.filter(field => !oldRequired.includes(field));
      if (newRequiredFields.length > 0) {
        analysis.breakingChanges.push(`New required fields: ${newRequiredFields.join(', ')}`);
        analysis.level = 'MAJOR';
        analysis.isCompatible = false;
      }

      // Check for removed fields
      const removedFields = Object.keys(oldProperties).filter(field => !(field in newProperties));
      if (removedFields.length > 0) {
        analysis.breakingChanges.push(`Removed fields: ${removedFields.join(', ')}`);
        analysis.level = 'MAJOR';
        analysis.isCompatible = false;
      }

      // Check for field type changes
      for (const [field, oldProp] of Object.entries(oldProperties)) {
        if (field in newProperties) {
          const newProp = newProperties[field];
          
          // Check for type changes
          if (oldProp.type !== newProp.type) {
            analysis.breakingChanges.push(`Field '${field}' type changed from ${oldProp.type} to ${newProp.type}`);
            analysis.level = 'MAJOR';
            analysis.isCompatible = false;
          }

          // Check for constraint changes
          if (oldProp.maxLength !== newProp.maxLength || 
              oldProp.minLength !== newProp.minLength ||
              oldProp.maximum !== newProp.maximum ||
              oldProp.minimum !== newProp.minimum) {
            analysis.modifiedFields.push(`Field '${field}' constraints modified`);
            analysis.level = 'MINOR';
          }
        }
      }

      // Check for new fields
      const newFields = Object.keys(newProperties).filter(field => !(field in oldProperties));
      if (newFields.length > 0) {
        analysis.newFields = newFields;
        if (analysis.level === 'PATCH') {
          analysis.level = 'MINOR';
        }
      }

      // Check for deprecated fields
      const deprecatedFields = Object.keys(oldProperties).filter(field => {
        const newProp = newProperties[field];
        return newProp && newProp.deprecated === true;
      });
      
      if (deprecatedFields.length > 0) {
        analysis.deprecatedFields = deprecatedFields;
        if (analysis.level === 'PATCH') {
          analysis.level = 'MINOR';
        }
      }

      analysis.metadata = {
        breakingChanges: analysis.breakingChanges,
        deprecatedFields: analysis.deprecatedFields,
        newFields: analysis.newFields,
        modifiedFields: analysis.modifiedFields
      };

      return analysis;
    } catch (error) {
      console.error('❌ Error checking schema compatibility:', error);
      return {
        level: 'MAJOR',
        breakingChanges: ['Error analyzing compatibility'],
        isCompatible: false,
        metadata: {}
      };
    }
  }

  /**
   * Compare two schema versions
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {Promise<Object>} - Comparison result
   */
  async compareSchemaVersions(tenantId, schemaName, version1, version2) {
    try {
      const [schema1, schema2] = await Promise.all([
        SchemaVersion.findOne({ tenantId, schemaName, version: version1 }),
        SchemaVersion.findOne({ tenantId, schemaName, version: version2 })
      ]);

      if (!schema1) {
        throw new Error(`Schema version ${version1} not found`);
      }

      if (!schema2) {
        throw new Error(`Schema version ${version2} not found`);
      }

      // Determine which version is newer
      const newerVersion = semver.gt(version1, version2) ? version1 : version2;
      const olderVersion = semver.gt(version1, version2) ? version2 : version1;
      const newerSchema = semver.gt(version1, version2) ? schema1 : schema2;
      const olderSchema = semver.gt(version1, version2) ? version2 : schema1;

      const compatibility = this.checkSchemaCompatibility(olderSchema.schema, newerSchema.schema);

      return {
        schemaName,
        tenantId,
        comparison: {
          olderVersion: {
            version: olderVersion,
            schema: olderSchema.schema,
            createdAt: olderSchema.createdAt,
            createdBy: olderSchema.createdBy
          },
          newerVersion: {
            version: newerVersion,
            schema: newerSchema.schema,
            createdAt: newerSchema.createdAt,
            createdBy: newerSchema.createdBy
          },
          compatibility,
          changelog: newerSchema.changelog
        }
      };
    } catch (error) {
      console.error('❌ Error comparing schema versions:', error);
      throw new Error(`Failed to compare schema versions: ${error.message}`);
    }
  }

  /**
   * Calculate next version number based on compatibility level
   * @param {string} currentVersion - Current version
   * @param {string} compatibilityLevel - Compatibility level
   * @returns {string} - Next version number
   */
  calculateNextVersion(currentVersion, compatibilityLevel) {
    try {
      switch (compatibilityLevel) {
        case 'MAJOR':
          return semver.inc(currentVersion, 'major');
        case 'MINOR':
          return semver.inc(currentVersion, 'minor');
        case 'PATCH':
        default:
          return semver.inc(currentVersion, 'patch');
      }
    } catch (error) {
      console.error('❌ Error calculating next version:', error);
      // Fallback to patch increment
      return semver.inc(currentVersion, 'patch');
    }
  }

  /**
   * Get schema version by version number
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {string} version - Version number
   * @returns {Promise<Object|null>} - Schema version
   */
  async getSchemaVersion(tenantId, schemaName, version) {
    try {
      return await SchemaVersion.findOne({ tenantId, schemaName, version });
    } catch (error) {
      console.error('❌ Error getting schema version:', error);
      throw new Error(`Failed to get schema version: ${error.message}`);
    }
  }

  /**
   * Delete a schema version (only if not active)
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {string} version - Version to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSchemaVersion(tenantId, schemaName, version) {
    try {
      const schemaVersion = await SchemaVersion.findOne({
        tenantId,
        schemaName,
        version
      });

      if (!schemaVersion) {
        throw new Error(`Schema version ${version} not found`);
      }

      if (schemaVersion.isActive) {
        throw new Error('Cannot delete active schema version');
      }

      await SchemaVersion.deleteOne({ _id: schemaVersion._id });
      console.log(`✅ Deleted schema version ${version} for ${schemaName}`);

      return true;
    } catch (error) {
      console.error('❌ Error deleting schema version:', error);
      throw new Error(`Failed to delete schema version: ${error.message}`);
    }
  }
}

module.exports = new SchemaVersionService();
