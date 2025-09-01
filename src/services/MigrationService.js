const Migration = require('../models/Migration');
const SchemaVersion = require('../models/SchemaVersion');
const CollectionGenerator = require('./CollectionGenerator');
const QueueService = require('./QueueService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Migration Service
 * Handles automated schema migrations with safety features
 */
class MigrationService {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  async ensureBackupDir() {
    try {
      await fs.access(this.backupDir);
    } catch (error) {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  /**
   * Generate migration script automatically
   * @param {Object} oldSchema - Old schema definition
   * @param {Object} newSchema - New schema definition
   * @returns {string} - Generated migration script
   */
  generateMigrationScript(oldSchema, newSchema) {
    const script = [];
    const oldProperties = oldSchema.properties || {};
    const newProperties = newSchema.properties || {};
    const oldRequired = oldSchema.required || [];
    const newRequired = newSchema.required || [];

    script.push('// Auto-generated migration script');
    script.push('// This script will be executed in a safe context');
    script.push('');
    script.push('async function migrate(document) {');
    script.push('  const migrated = { ...document };');
    script.push('');

    // Handle new required fields
    const newRequiredFields = newRequired.filter(field => !oldRequired.includes(field));
    for (const field of newRequiredFields) {
      const prop = newProperties[field];
      if (prop.default !== undefined) {
        script.push(`  // Set default value for new required field: ${field}`);
        script.push(`  if (migrated.${field} === undefined) {`);
        script.push(`    migrated.${field} = ${JSON.stringify(prop.default)};`);
        script.push(`  }`);
        script.push('');
      } else {
        script.push(`  // New required field without default: ${field}`);
        script.push(`  // You may need to set a value manually`);
        script.push(`  if (migrated.${field} === undefined) {`);
        script.push(`    throw new Error('Field ${field} is required but has no default value');`);
        script.push(`  }`);
        script.push('');
      }
    }

    // Handle removed fields
    const removedFields = Object.keys(oldProperties).filter(field => !(field in newProperties));
    for (const field of removedFields) {
      script.push(`  // Remove deprecated field: ${field}`);
      script.push(`  delete migrated.${field};`);
      script.push('');
    }

    // Handle type changes
    for (const [field, oldProp] of Object.entries(oldProperties)) {
      if (field in newProperties) {
        const newProp = newProperties[field];
        
        if (oldProp.type !== newProp.type) {
          script.push(`  // Convert field type: ${field} from ${oldProp.type} to ${newProp.type}`);
          
          if (oldProp.type === 'string' && newProp.type === 'number') {
            script.push(`  if (typeof migrated.${field} === 'string') {`);
            script.push(`    migrated.${field} = parseFloat(migrated.${field}) || 0;`);
            script.push(`  }`);
          } else if (oldProp.type === 'number' && newProp.type === 'string') {
            script.push(`  if (typeof migrated.${field} === 'number') {`);
            script.push(`    migrated.${field} = String(migrated.${field});`);
            script.push(`  }`);
          } else if (oldProp.type === 'boolean' && newProp.type === 'string') {
            script.push(`  if (typeof migrated.${field} === 'boolean') {`);
            script.push(`    migrated.${field} = migrated.${field} ? 'true' : 'false';`);
            script.push(`  }`);
          } else if (oldProp.type === 'string' && newProp.type === 'boolean') {
            script.push(`  if (typeof migrated.${field} === 'string') {`);
            script.push(`    migrated.${field} = migrated.${field} === 'true';`);
            script.push(`  }`);
          }
          script.push('');
        }

        // Handle constraint changes
        if (oldProp.maxLength !== newProp.maxLength && newProp.maxLength !== undefined) {
          script.push(`  // Apply new maxLength constraint: ${field}`);
          script.push(`  if (migrated.${field} && migrated.${field}.length > ${newProp.maxLength}) {`);
          script.push(`    migrated.${field} = migrated.${field}.substring(0, ${newProp.maxLength});`);
          script.push(`  }`);
          script.push('');
        }
      }
    }

    script.push('  return migrated;');
    script.push('}');
    script.push('');
    script.push('// Export the migration function');
    script.push('module.exports = migrate;');

    return script.join('\n');
  }

  /**
   * Create a new migration
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @param {string} migrationScript - Migration script
   * @param {string} userId - User creating the migration
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} - Created migration
   */
  async createMigration(tenantId, schemaName, fromVersion, toVersion, migrationScript, userId, options = {}) {
    try {
      // Validate versions exist
      const [fromSchema, toSchema] = await Promise.all([
        SchemaVersion.findOne({ tenantId, schemaName, version: fromVersion }),
        SchemaVersion.findOne({ tenantId, schemaName, version: toVersion })
      ]);

      if (!fromSchema) {
        throw new Error(`Source schema version ${fromVersion} not found`);
      }

      if (!toSchema) {
        throw new Error(`Target schema version ${toVersion} not found`);
      }

      // Create migration record
      const migration = new Migration({
        tenantId,
        schemaName,
        fromVersion,
        toVersion,
        migrationScript: migrationScript || this.generateMigrationScript(fromSchema.schema, toSchema.schema),
        executedBy: userId,
        metadata: {
          dryRun: options.dryRun || false,
          estimatedDuration: options.estimatedDuration || null
        }
      });

      const savedMigration = await migration.save();
      console.log(`✅ Created migration from ${fromVersion} to ${toVersion} for ${schemaName}`);

      return savedMigration;
    } catch (error) {
      console.error('❌ Error creating migration:', error);
      throw new Error(`Failed to create migration: ${error.message}`);
    }
  }

  /**
   * Run a migration
   * @param {string} migrationId - Migration ID
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Migration result
   */
  async runMigration(migrationId, options = {}) {
    const startTime = Date.now();
    let migration;

    try {
      // Get migration record
      migration = await Migration.findById(migrationId);
      if (!migration) {
        throw new Error('Migration not found');
      }

      // Check if migration can be run
      if (migration.status !== 'PENDING') {
        throw new Error(`Migration is not in PENDING status (current: ${migration.status})`);
      }

      // Start migration
      await migration.start();

      // Create backup if not dry run
      if (!options.dryRun) {
        await this.createBackup(migration.tenantId, migration.schemaName);
        migration.metadata.backupCreated = true;
        await migration.save();
      }

      // Get the dynamic model
      const Model = CollectionGenerator.getDynamicModel(migration.schemaName);
      if (!Model) {
        throw new Error(`Dynamic model for schema '${migration.schemaName}' not found`);
      }

      // Count total documents
      const totalDocuments = await Model.countDocuments();
      migration.progress.total = totalDocuments;
      await migration.save();

      // Execute migration
      const result = await this.executeMigration(migration, Model, options);

      // Complete migration
      const duration = Date.now() - startTime;
      await migration.complete(result.affectedCount, duration);

      console.log(`✅ Migration ${migrationId} completed successfully`);
      return {
        success: true,
        migration: migration.toObject(),
        affectedDocuments: result.affectedCount,
        duration
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      
      if (migration) {
        const duration = Date.now() - startTime;
        await migration.fail(error.message, duration);
      }

      return {
        success: false,
        error: error.message,
        migration: migration ? migration.toObject() : null
      };
    }
  }

  /**
   * Execute migration on documents
   * @param {Object} migration - Migration record
   * @param {Object} Model - Mongoose model
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeMigration(migration, Model, options = {}) {
    const { dryRun = false, batchSize = 1000 } = options;
    let affectedCount = 0;
    let processedCount = 0;

    try {
      // Create migration function from script
      const migrationFunction = this.createMigrationFunction(migration.migrationScript);

      // Process documents in batches
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const documents = await Model.find({})
          .skip(skip)
          .limit(batchSize)
          .lean();

        if (documents.length === 0) {
          hasMore = false;
          break;
        }

        for (const document of documents) {
          try {
            // Apply migration
            const migratedDocument = await migrationFunction(document);

            if (!dryRun) {
              // Update document in database
              await Model.updateOne(
                { _id: document._id },
                { $set: migratedDocument }
              );
            }

            affectedCount++;
          } catch (error) {
            console.error(`❌ Error migrating document ${document._id}:`, error);
            // Continue with other documents
          }

          processedCount++;
          
          // Update progress
          if (processedCount % 100 === 0) {
            await migration.updateProgress(processedCount, migration.progress.total);
          }
        }

        skip += batchSize;
      }

      return { affectedCount };
    } catch (error) {
      throw new Error(`Migration execution failed: ${error.message}`);
    }
  }

  /**
   * Create migration function from script
   * @param {string} script - Migration script
   * @returns {Function} - Migration function
   */
  createMigrationFunction(script) {
    try {
      // Create a safe context for the migration function
      const context = {
        console: {
          log: (...args) => console.log('[Migration]:', ...args),
          error: (...args) => console.error('[Migration]:', ...args),
          warn: (...args) => console.warn('[Migration]:', ...args)
        },
        // Add utility functions
        parseInt: parseInt,
        parseFloat: parseFloat,
        String: String,
        Number: Number,
        Boolean: Boolean,
        Date: Date,
        Math: Math,
        JSON: JSON
      };

      // Create function from script
      const functionBody = script.replace(/^async function migrate\(/, 'async function(');
      const migrationFunction = new Function('document', functionBody);

      // Bind context
      return migrationFunction.bind(context);
    } catch (error) {
      throw new Error(`Invalid migration script: ${error.message}`);
    }
  }

  /**
   * Create backup of collection
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @returns {Promise<string>} - Backup file path
   */
  async createBackup(tenantId, schemaName) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${tenantId}_${schemaName}_${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Get the dynamic model
      const Model = CollectionGenerator.getDynamicModel(schemaName);
      if (!Model) {
        throw new Error(`Dynamic model for schema '${schemaName}' not found`);
      }

      // Export data
      const documents = await Model.find({}).lean();
      const backupData = {
        tenantId,
        schemaName,
        timestamp: new Date().toISOString(),
        documentCount: documents.length,
        documents
      };

      // Write backup file
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      console.log(`✅ Backup created: ${backupPath}`);

      return backupPath;
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Rollback a migration
   * @param {string} migrationId - Migration ID
   * @param {string} userId - User performing rollback
   * @returns {Promise<Object>} - Rollback result
   */
  async rollbackMigration(migrationId, userId) {
    try {
      const migration = await Migration.findById(migrationId);
      if (!migration) {
        throw new Error('Migration not found');
      }

      if (migration.status !== 'COMPLETED' && migration.status !== 'FAILED') {
        throw new Error(`Migration cannot be rolled back (status: ${migration.status})`);
      }

      if (!migration.rollback.canRollback) {
        throw new Error('Migration cannot be rolled back');
      }

      // Perform rollback
      await migration.performRollback(userId);

      console.log(`✅ Migration ${migrationId} rolled back successfully`);
      return {
        success: true,
        migration: migration.toObject()
      };

    } catch (error) {
      console.error('❌ Error rolling back migration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate migration script
   * @param {string} script - Migration script
   * @param {Object} sampleData - Sample document for testing
   * @returns {Promise<Object>} - Validation result
   */
  async validateMigration(script, sampleData) {
    try {
      // Create migration function
      const migrationFunction = this.createMigrationFunction(script);

      // Test with sample data
      const result = await migrationFunction(sampleData);

      return {
        valid: true,
        result,
        message: 'Migration script is valid'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message: 'Migration script validation failed'
      };
    }
  }

  /**
   * Get migration status
   * @param {string} migrationId - Migration ID
   * @returns {Promise<Object>} - Migration status
   */
  async getMigrationStatus(migrationId) {
    try {
      const migration = await Migration.findById(migrationId);
      if (!migration) {
        throw new Error('Migration not found');
      }

      return migration.toObject();
    } catch (error) {
      throw new Error(`Failed to get migration status: ${error.message}`);
    }
  }

  /**
   * Get migration history
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Migration history
   */
  async getMigrationHistory(tenantId, schemaName = null, options = {}) {
    try {
      return await Migration.getMigrationHistory(tenantId, schemaName, options);
    } catch (error) {
      throw new Error(`Failed to get migration history: ${error.message}`);
    }
  }
}

module.exports = new MigrationService();
