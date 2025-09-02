const express = require('express');
const router = express.Router();
const DiscoveryService = require('../services/DiscoveryService');
const { authenticate, requireTenantAccess, authorize } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Helper functions
function generateTypeScriptInterface(schemaName, schema) {
  const interfaceName = schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
  let typescript = `// Auto-generated TypeScript interface for ${schemaName}\n`;
  typescript += `// Generated on: ${new Date().toISOString()}\n\n`;
  typescript += `export interface ${interfaceName} {\n`;

  const properties = schema.properties || {};
  
  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    const required = (schema.required || []).includes(fieldName);
    const optional = required ? '' : '?';
    const type = convertSchemaTypeToTypeScript(fieldSchema);
    
    typescript += `  ${fieldName}${optional}: ${type};\n`;
  }

  typescript += `}\n\n`;
  typescript += `// API Response types\n`;
  typescript += `export interface ${interfaceName}ListResponse {\n`;
  typescript += `  success: boolean;\n`;
  typescript += `  data: {\n`;
  typescript += `    documents: ${interfaceName}[];\n`;
  typescript += `    pagination: {\n`;
  typescript += `      currentPage: number;\n`;
  typescript += `      totalPages: number;\n`;
  typescript += `      totalRecords: number;\n`;
  typescript += `      hasNextPage: boolean;\n`;
  typescript += `      hasPrevPage: boolean;\n`;
  typescript += `      limit: number;\n`;
  typescript += `    };\n`;
  typescript += `  };\n`;
  typescript += `  message: string;\n`;
  typescript += `}\n\n`;
  typescript += `export interface ${interfaceName}Response {\n`;
  typescript += `  success: boolean;\n`;
  typescript += `  data: ${interfaceName};\n`;
  typescript += `  message: string;\n`;
  typescript += `}\n`;

  return typescript;
}

// Convert JSON Schema type to TypeScript type
function convertSchemaTypeToTypeScript(fieldSchema) {
  const { type, format, enum: enumValues, items, properties } = fieldSchema;

  switch (type) {
    case 'string':
      if (enumValues && enumValues.length > 0) {
        return `'${enumValues.join("' | '")}'`;
      }
      if (format === 'email') return 'string';
      if (format === 'date' || format === 'date-time') return 'string';
      if (format === 'uuid') return 'string';
      return 'string';
    
    case 'number':
    case 'integer':
      return 'number';
    
    case 'boolean':
      return 'boolean';
    
    case 'array':
      if (items) {
        const itemType = convertSchemaTypeToTypeScript(items);
        return `${itemType}[]`;
      }
      return 'any[]';
    
    case 'object':
      if (properties) {
        let objectType = '{\n';
        for (const [propName, propSchema] of Object.entries(properties)) {
          const propType = convertSchemaTypeToTypeScript(propSchema);
          objectType += `    ${propName}: ${propType};\n`;
        }
        objectType += '  }';
        return objectType;
      }
      return 'Record<string, any>';
    
    default:
      return 'any';
  }
}

// Generate documentation examples
function generateDocumentationExamples(endpoints) {
  const examples = [];

  for (const endpoint of endpoints.endpoints) {
    if (endpoint.examples) {
      examples.push({
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        examples: endpoint.examples
      });
    }
  }

  return examples;
}

// Public platform capabilities (no auth required)
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = await DiscoveryService.getAPICapabilities();
    successResponse(res, capabilities, 'Platform capabilities retrieved successfully');
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
});

// Apply authentication and tenant access to the remaining routes
router.use(authenticate);
router.use(requireTenantAccess);

// Get available schemas for tenant
router.get('/:tenant/schemas', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant } = req.params;
      const { role = req.user.role } = req.query;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const schemas = await DiscoveryService.getAvailableSchemas(tenant, role);

      successResponse(res, schemas, 'Available schemas retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get all available endpoints for tenant
router.get('/:tenant/endpoints', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant } = req.params;
      const { schema } = req.query;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      if (schema) {
        // Get endpoints for specific schema
        const endpoints = await DiscoveryService.getSchemaEndpoints(tenant, schema);
        successResponse(res, endpoints, 'Schema endpoints retrieved successfully');
      } else {
        // Get all schemas and their endpoints
        const schemas = await DiscoveryService.getAvailableSchemas(tenant, req.user.role);
        const allEndpoints = [];

        for (const schemaInfo of schemas.schemas) {
          try {
            const endpoints = await DiscoveryService.getSchemaEndpoints(tenant, schemaInfo.name);
            allEndpoints.push({
              schema: schemaInfo.name,
              displayName: schemaInfo.displayName,
              endpoints: endpoints.endpoints
            });
          } catch (error) {
            console.error(`Error getting endpoints for schema ${schemaInfo.name}:`, error);
          }
        }

        successResponse(res, {
          tenantId: tenant,
          totalSchemas: schemas.schemas.length,
          schemas: allEndpoints
        }, 'All endpoints retrieved successfully');
      }
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get OpenAPI specification for tenant
router.get('/:tenant/openapi', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant } = req.params;
      const { format = 'json' } = req.query;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const openapiSpec = await DiscoveryService.generateOpenAPISpec(tenant);

      if (format === 'yaml') {
        // Convert to YAML if requested
        const yaml = require('js-yaml');
        res.setHeader('Content-Type', 'text/yaml');
        res.send(yaml.dump(openapiSpec));
      } else {
        successResponse(res, openapiSpec, 'OpenAPI specification generated successfully');
      }
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// (moved above) Public capabilities route

// Get schema metadata
router.get('/:tenant/schema/:name/meta', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, name } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const metadata = await DiscoveryService.getSchemaMetadata(tenant, name);
      successResponse(res, metadata, 'Schema metadata retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get schema endpoints
router.get('/:tenant/schema/:name/endpoints', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, name } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const endpoints = await DiscoveryService.getSchemaEndpoints(tenant, name);

      successResponse(res, endpoints, 'Schema endpoints retrieved successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Generate TypeScript interfaces from schema
router.get('/:tenant/schema/:name/typescript', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant, name } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const endpoints = await DiscoveryService.getSchemaEndpoints(tenant, name);
      const schema = endpoints.schema;

      // Generate TypeScript interface
      const typescriptInterface = generateTypeScriptInterface(name, schema);

      res.setHeader('Content-Type', 'text/plain');
      res.send(typescriptInterface);
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

// Get API documentation for tenant
router.get('/:tenant/docs', 
  authorize('schemas', 'read'),
  async (req, res) => {
    try {
      const { tenant } = req.params;

      // Validate tenant access
      if (req.user.tenantId !== tenant) {
        return errorResponse(res, 'Access denied to this tenant', 403);
      }

      const schemas = await DiscoveryService.getAvailableSchemas(tenant, req.user.role);
      const documentation = [];

      for (const schemaInfo of schemas.schemas) {
        try {
          const endpoints = await DiscoveryService.getSchemaEndpoints(tenant, schemaInfo.name);
          documentation.push({
            schema: schemaInfo,
            endpoints: endpoints.endpoints,
            examples: generateDocumentationExamples(endpoints)
          });
        } catch (error) {
          console.error(`Error generating documentation for schema ${schemaInfo.name}:`, error);
        }
      }

      successResponse(res, {
        tenantId: tenant,
        totalSchemas: schemas.schemas.length,
        documentation
      }, 'API documentation generated successfully');
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  }
);

module.exports = router;
