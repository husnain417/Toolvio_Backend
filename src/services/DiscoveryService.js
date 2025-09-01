const SchemaService = require('./SchemaService');
const SchemaVersionService = require('./SchemaVersionService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Discovery Service
 * Provides dynamic endpoint discovery and API documentation generation
 */
class DiscoveryService {
  constructor() {
    this.apiInfo = {
      name: 'Craftsman Dynamic Backend Platform',
      version: '1.0.0',
      description: 'A dynamic, schema-driven backend platform with multi-tenant support',
      contact: {
        name: 'Platform Support',
        email: 'support@craftsman-platform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    };
  }

  /**
   * Get available schemas for a tenant and user role
   * @param {string} tenantId - Tenant ID
   * @param {string} userRole - User role
   * @returns {Promise<Object>} - Available schemas with metadata
   */
  async getAvailableSchemas(tenantId, userRole) {
    try {
      // Get all schemas for the tenant
      const schemas = await SchemaService.getSchemas(tenantId);
      
      // Filter schemas based on user role and permissions
      const availableSchemas = schemas.filter(schema => {
        // Admin has access to all schemas
        if (userRole === 'admin') return true;
        
        // Check schema-specific permissions
        const schemaPermissions = schema.permissions || {};
        return schemaPermissions[userRole] || schemaPermissions.read;
      });

      // Get active versions for each schema
      const schemasWithVersions = await Promise.all(
        availableSchemas.map(async (schema) => {
          try {
            const activeVersion = await SchemaVersionService.getActiveSchemaVersion(tenantId, schema.name);
            return {
              name: schema.name,
              displayName: schema.displayName || schema.name,
              description: schema.description || '',
              version: activeVersion ? activeVersion.version : '1.0.0',
              isActive: activeVersion ? activeVersion.isActive : false,
              createdAt: schema.createdAt,
              updatedAt: schema.updatedAt,
              permissions: schema.permissions || {},
              fields: activeVersion ? Object.keys(activeVersion.schema.properties || {}) : [],
              requiredFields: activeVersion ? (activeVersion.schema.required || []) : [],
              fieldCount: activeVersion ? Object.keys(activeVersion.schema.properties || {}).length : 0
            };
          } catch (error) {
            console.error(`Error getting version for schema ${schema.name}:`, error);
            return {
              name: schema.name,
              displayName: schema.displayName || schema.name,
              description: schema.description || '',
              version: '1.0.0',
              isActive: false,
              createdAt: schema.createdAt,
              updatedAt: schema.updatedAt,
              permissions: schema.permissions || {},
              fields: [],
              requiredFields: [],
              fieldCount: 0,
              error: 'Version information unavailable'
            };
          }
        })
      );

      return {
        tenantId,
        totalSchemas: schemasWithVersions.length,
        schemas: schemasWithVersions
      };
    } catch (error) {
      console.error('❌ Error getting available schemas:', error);
      throw new Error(`Failed to get available schemas: ${error.message}`);
    }
  }

  /**
   * Get all endpoints for a specific schema
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @returns {Promise<Object>} - Schema endpoints with examples
   */
  async getSchemaEndpoints(tenantId, schemaName) {
    try {
      // Get schema information
      const schema = await SchemaService.getSchema(tenantId, schemaName);
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      // Get active version
      const activeVersion = await SchemaVersionService.getActiveSchemaVersion(tenantId, schemaName);
      if (!activeVersion) {
        throw new Error(`No active version found for schema '${schemaName}'`);
      }

      // Define standard CRUD endpoints
      const endpoints = [
        {
          method: 'GET',
          path: `/api/${tenantId}/${schemaName}`,
          description: 'Get all documents',
          parameters: {
            query: {
              page: { type: 'number', default: 1, description: 'Page number' },
              limit: { type: 'number', default: 50, description: 'Items per page' },
              sort: { type: 'string', description: 'Sort field' },
              order: { type: 'string', enum: ['asc', 'desc'], default: 'desc', description: 'Sort order' },
              filter: { type: 'string', description: 'JSON filter string' }
            }
          },
          responses: {
            200: 'List of documents with pagination',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          },
          examples: {
            request: `GET /api/${tenantId}/${schemaName}?page=1&limit=10&sort=createdAt&order=desc`,
            response: {
              success: true,
              data: {
                documents: [],
                pagination: {
                  currentPage: 1,
                  totalPages: 1,
                  totalRecords: 0,
                  hasNextPage: false,
                  hasPrevPage: false,
                  limit: 10
                }
              },
              message: 'Documents retrieved successfully'
            }
          }
        },
        {
          method: 'GET',
          path: `/api/${tenantId}/${schemaName}/:id`,
          description: 'Get document by ID',
          parameters: {
            path: {
              id: { type: 'string', description: 'Document ID' }
            }
          },
          responses: {
            200: 'Document data',
            404: 'Document not found',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          },
          examples: {
            request: `GET /api/${tenantId}/${schemaName}/507f1f77bcf86cd799439011`,
            response: {
              success: true,
              data: {},
              message: 'Document retrieved successfully'
            }
          }
        },
        {
          method: 'POST',
          path: `/api/${tenantId}/${schemaName}`,
          description: 'Create new document',
          parameters: {
            body: {
              description: 'Document data according to schema',
              required: true,
              schema: activeVersion.schema
            }
          },
          responses: {
            201: 'Document created successfully',
            400: 'Validation error',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          },
          examples: {
            request: {
              method: 'POST',
              url: `/api/${tenantId}/${schemaName}`,
              body: this.generateExampleData(activeVersion.schema)
            },
            response: {
              success: true,
              data: {},
              message: 'Document created successfully'
            }
          }
        },
        {
          method: 'PUT',
          path: `/api/${tenantId}/${schemaName}/:id`,
          description: 'Update document by ID',
          parameters: {
            path: {
              id: { type: 'string', description: 'Document ID' }
            },
            body: {
              description: 'Updated document data',
              required: true,
              schema: activeVersion.schema
            }
          },
          responses: {
            200: 'Document updated successfully',
            400: 'Validation error',
            404: 'Document not found',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          }
        },
        {
          method: 'DELETE',
          path: `/api/${tenantId}/${schemaName}/:id`,
          description: 'Delete document by ID',
          parameters: {
            path: {
              id: { type: 'string', description: 'Document ID' }
            }
          },
          responses: {
            200: 'Document deleted successfully',
            404: 'Document not found',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          }
        }
      ];

      // Add audit endpoints if available
      endpoints.push(
        {
          method: 'GET',
          path: `/api/audit/${schemaName}/:documentId/history`,
          description: 'Get document audit history',
          parameters: {
            path: {
              documentId: { type: 'string', description: 'Document ID' }
            },
            query: {
              page: { type: 'number', default: 1, description: 'Page number' },
              limit: { type: 'number', default: 50, description: 'Items per page' },
              operation: { type: 'string', enum: ['create', 'update', 'delete'], description: 'Filter by operation type' }
            }
          },
          responses: {
            200: 'Audit history with pagination',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          }
        }
      );

      // Add schema version endpoints
      endpoints.push(
        {
          method: 'GET',
          path: `/api/schema-versions/${tenantId}/${schemaName}`,
          description: 'Get schema version history',
          parameters: {
            query: {
              page: { type: 'number', default: 1, description: 'Page number' },
              limit: { type: 'number', default: 20, description: 'Items per page' },
              includeSchema: { type: 'boolean', default: false, description: 'Include full schema definition' }
            }
          },
          responses: {
            200: 'Schema version history',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          }
        },
        {
          method: 'GET',
          path: `/api/schema-versions/${tenantId}/${schemaName}/current`,
          description: 'Get current active schema version',
          responses: {
            200: 'Current active schema version',
            404: 'No active version found',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal server error'
          }
        }
      );

      return {
        tenantId,
        schemaName,
        schemaVersion: activeVersion.version,
        totalEndpoints: endpoints.length,
        endpoints,
        schema: {
          version: activeVersion.version,
          properties: activeVersion.schema.properties || {},
          required: activeVersion.schema.required || [],
          type: activeVersion.schema.type || 'object'
        }
      };
    } catch (error) {
      console.error('❌ Error getting schema endpoints:', error);
      throw new Error(`Failed to get schema endpoints: ${error.message}`);
    }
  }

  /**
   * Generate OpenAPI specification for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} - OpenAPI specification
   */
  async generateOpenAPISpec(tenantId) {
    try {
      // Get available schemas
      const schemas = await this.getAvailableSchemas(tenantId, 'admin'); // Admin to see all schemas
      
      const openapi = {
        openapi: '3.0.3',
        info: {
          title: `${this.apiInfo.name} - ${tenantId}`,
          version: this.apiInfo.version,
          description: this.apiInfo.description,
          contact: this.apiInfo.contact,
          license: this.apiInfo.license
        },
        servers: [
          {
            url: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/${tenantId}`,
            description: 'Tenant API Server'
          }
        ],
        paths: {},
        components: {
          schemas: {},
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        },
        security: [
          {
            bearerAuth: []
          }
        ]
      };

      // Generate paths and schemas for each schema
      for (const schema of schemas.schemas) {
        try {
          const endpoints = await this.getSchemaEndpoints(tenantId, schema.name);
          
          // Add paths
          for (const endpoint of endpoints.endpoints) {
            const pathKey = endpoint.path.replace(`/api/${tenantId}`, '');
            
            if (!openapi.paths[pathKey]) {
              openapi.paths[pathKey] = {};
            }

            const method = endpoint.method.toLowerCase();
            openapi.paths[pathKey][method] = {
              summary: endpoint.description,
              parameters: this.convertParametersToOpenAPI(endpoint.parameters),
              responses: this.convertResponsesToOpenAPI(endpoint.responses),
              tags: [schema.name]
            };
          }

          // Add schema definition
          if (endpoints.schema) {
            openapi.components.schemas[schema.name] = {
              type: endpoints.schema.type,
              properties: endpoints.schema.properties,
              required: endpoints.schema.required
            };
          }
        } catch (error) {
          console.error(`Error processing schema ${schema.name}:`, error);
        }
      }

      return openapi;
    } catch (error) {
      console.error('❌ Error generating OpenAPI spec:', error);
      throw new Error(`Failed to generate OpenAPI specification: ${error.message}`);
    }
  }

  /**
   * Get platform capabilities
   * @returns {Object} - Platform capabilities
   */
  getAPICapabilities() {
    return {
      platform: this.apiInfo.name,
      version: this.apiInfo.version,
      features: {
        schemaDriven: true,
        multiTenant: true,
        auditTrail: true,
        versioning: true,
        migrations: true,
        offlineSync: true,
        roleBasedAccess: true,
        dynamicEndpoints: true,
        backgroundProcessing: true,
        conflictResolution: true
      },
      authentication: {
        type: 'JWT',
        refreshTokens: true,
        multiFactor: false
      },
      database: {
        type: 'MongoDB',
        changeStreams: true,
        transactions: true
      },
      queue: {
        type: 'BullMQ',
        redis: true,
        backgroundJobs: true
      },
      limits: {
        maxSchemasPerTenant: 100,
        maxFieldsPerSchema: 100,
        maxDocumentsPerCollection: 1000000,
        maxFileSize: '10MB',
        rateLimit: '1000 requests per minute'
      },
      supportedDataTypes: [
        'string', 'number', 'boolean', 'array', 'object', 'date', 'email', 'url', 'uuid'
      ],
      supportedValidations: [
        'required', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'enum', 'format'
      ]
    };
  }

  /**
   * Get schema metadata
   * @param {string} tenantId - Tenant ID
   * @param {string} schemaName - Schema name
   * @returns {Promise<Object>} - Schema metadata
   */
  async getSchemaMetadata(tenantId, schemaName) {
    try {
      const schema = await SchemaService.getSchema(tenantId, schemaName);
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      const activeVersion = await SchemaVersionService.getActiveSchemaVersion(tenantId, schemaName);
      
      return {
        tenantId,
        schemaName,
        displayName: schema.displayName || schema.name,
        description: schema.description || '',
        version: activeVersion ? activeVersion.version : '1.0.0',
        isActive: activeVersion ? activeVersion.isActive : false,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
        permissions: schema.permissions || {},
        fieldCount: activeVersion ? Object.keys(activeVersion.schema.properties || {}).length : 0,
        requiredFieldCount: activeVersion ? (activeVersion.schema.required || []).length : 0,
        optionalFieldCount: activeVersion ? 
          Object.keys(activeVersion.schema.properties || {}).length - (activeVersion.schema.required || []).length : 0
      };
    } catch (error) {
      console.error('❌ Error getting schema metadata:', error);
      throw new Error(`Failed to get schema metadata: ${error.message}`);
    }
  }

  /**
   * Generate example data from schema
   * @param {Object} schema - JSON Schema
   * @returns {Object} - Example data
   */
  generateExampleData(schema) {
    const example = {};
    const properties = schema.properties || {};

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      example[fieldName] = this.generateFieldExample(fieldSchema);
    }

    return example;
  }

  /**
   * Generate example value for a field
   * @param {Object} fieldSchema - Field schema
   * @returns {any} - Example value
   */
  generateFieldExample(fieldSchema) {
    const { type, format, enum: enumValues, default: defaultValue } = fieldSchema;

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    if (enumValues && enumValues.length > 0) {
      return enumValues[0];
    }

    switch (type) {
      case 'string':
        if (format === 'email') return 'user@example.com';
        if (format === 'date') return new Date().toISOString().split('T')[0];
        if (format === 'date-time') return new Date().toISOString();
        if (format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
        return 'Example string';
      
      case 'number':
      case 'integer':
        return 42;
      
      case 'boolean':
        return true;
      
      case 'array':
        return [];
      
      case 'object':
        return {};
      
      default:
        return null;
    }
  }

  /**
   * Convert parameters to OpenAPI format
   * @param {Object} parameters - Parameters object
   * @returns {Array} - OpenAPI parameters array
   */
  convertParametersToOpenAPI(parameters) {
    const openapiParams = [];

    if (parameters.path) {
      for (const [name, param] of Object.entries(parameters.path)) {
        openapiParams.push({
          name,
          in: 'path',
          required: true,
          schema: { type: param.type },
          description: param.description
        });
      }
    }

    if (parameters.query) {
      for (const [name, param] of Object.entries(parameters.query)) {
        openapiParams.push({
          name,
          in: 'query',
          required: false,
          schema: { type: param.type, default: param.default },
          description: param.description
        });
      }
    }

    return openapiParams;
  }

  /**
   * Convert responses to OpenAPI format
   * @param {Object} responses - Responses object
   * @returns {Object} - OpenAPI responses object
   */
  convertResponsesToOpenAPI(responses) {
    const openapiResponses = {};

    for (const [code, description] of Object.entries(responses)) {
      openapiResponses[code] = {
        description,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                message: { type: 'string' }
              }
            }
          }
        }
      };
    }

    return openapiResponses;
  }
}

module.exports = new DiscoveryService();
