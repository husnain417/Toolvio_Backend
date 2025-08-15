# Craftsman Dynamic Backend

A schema-driven, dynamic backend system that allows you to create and manage data models on-the-fly using JSON Schema definitions.

## 🏗️ Architecture

The project follows a clean, layered architecture pattern:

```
src/
├── controllers/          # Request handlers and business logic
├── services/            # Business logic and data operations
├── models/              # Data models and schemas
├── routes/              # API route definitions
├── middleware/          # Request/response middleware
├── utils/               # Utility functions and helpers
└── config/              # Configuration files
```

### Architecture Layers

1. **Controllers** (`/controllers`): Handle HTTP requests, validate input, and coordinate with services
2. **Services** (`/services`): Contain business logic and interact with data models
3. **Models** (`/models`): Define data structures and database schemas
4. **Routes** (`/routes`): Define API endpoints and HTTP methods
5. **Middleware** (`/middleware`): Handle cross-cutting concerns like validation and error handling
6. **Utils** (`/utils`): Provide helper functions and utilities
7. **Config** (`/config`): Manage application configuration and environment variables

## 🚀 Features

- **Dynamic Schema Creation**: Create data models using JSON Schema
- **Hot Schema Reloading**: Update schemas without restarting the server
- **Automatic CRUD Operations**: Generate CRUD endpoints for any schema
- **JSON Schema Validation**: Validate data against defined schemas
- **MongoDB Integration**: Built on MongoDB with Mongoose ODM
- **RESTful API**: Clean, RESTful API design
- **Error Handling**: Comprehensive error handling and validation
- **Middleware Support**: Extensible middleware architecture

## 📁 Project Structure

```
craftsman-dynamic-backend/
├── src/
│   ├── controllers/
│   │   ├── schemaController.js      # Schema management operations
│   │   ├── dynamicController.js     # Dynamic data CRUD operations
│   │   └── systemController.js      # System health and information
│   ├── services/
│   │   ├── SchemaService.js         # Schema business logic
│   │   ├── DynamicCrudService.js    # Dynamic CRUD operations
│   │   └── CollectionGenerator.js   # Dynamic model generation
│   ├── models/
│   │   ├── Schema.js                # Schema definition model
│   │   └── DynamicModel.js          # Base dynamic model class
│   ├── routes/
│   │   ├── schemaRoutes.js          # Schema management endpoints
│   │   ├── dynamicRoutes.js         # Dynamic data endpoints
│   │   └── systemRoutes.js          # System endpoints
│   ├── middleware/
│   │   ├── errorHandler.js          # Global error handling
│   │   └── validateSchema.js        # Schema validation middleware
│   ├── utils/
│   │   ├── responseHelper.js        # Response formatting utilities
│   │   └── schemaValidator.js       # JSON Schema validation
│   ├── config/
│   │   ├── database.js              # Database configuration
│   │   └── environment.js           # Environment configuration
│   └── server.js                    # Main application entry point
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore rules
├── package.json                     # Project dependencies and scripts
└── README.md                        # This file
```

## 🔧 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd craftsman-dynamic-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Configure environment variables in `.env`:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/craftsman_dynamic_backend
```

5. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📚 API Endpoints

### Schema Management (`/api/schemas`)

- `GET /` - Get all schemas
- `GET /:name` - Get schema by name
- `POST /` - Create new schema
- `PUT /:name` - Update schema
- `DELETE /:name` - Delete schema (soft delete)
- `POST /:name/reload` - Hot reload schema
- `GET /:name/stats` - Get schema statistics
- `POST /validate` - Validate schema definition

### Dynamic Data (`/api/data`)

- `GET /:schemaName` - Get records with pagination
- `GET /:schemaName/:recordId` - Get single record
- `POST /:schemaName` - Create new record
- `PUT /:schemaName/:recordId` - Update record
- `PATCH /:schemaName/:recordId` - Partial update record
- `DELETE /:schemaName/:recordId` - Delete record
- `POST /:schemaName/bulk` - Bulk create records
- `GET /:schemaName/count` - Get record count
- `GET /:schemaName/search` - Search records
- `GET /:schemaName/stats` - Get record statistics

### System (`/api/system`)

- `GET /health` - Health check
- `GET /info` - System information
- `GET /stats/database` - Database statistics
- `GET /stats/api` - API statistics
- `POST /init` - Initialize system
- `GET /logs` - System logs

## 🎯 Usage Examples

### Creating a Schema

```javascript
// POST /api/schemas
{
  "name": "user",
  "displayName": "User",
  "description": "User profile information",
  "jsonSchema": {
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
      "age": {
        "type": "integer",
        "minimum": 0,
        "maximum": 150
      }
    },
    "required": ["firstName", "lastName", "email"]
  }
}
```

### Creating Records

```javascript
// POST /api/data/user
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "age": 30
}
```

### Querying Records

```javascript
// GET /api/data/user?page=1&limit=10&sort={"firstName":1}
// GET /api/data/user/search?q=john&fields=firstName,lastName
// GET /api/data/user/count
```

## 🔒 Security Features

- **Input Validation**: All inputs are validated against JSON schemas
- **CORS Protection**: Configurable CORS settings
- **Helmet Security**: Security headers with Helmet middleware
- **Rate Limiting**: Configurable rate limiting
- **Environment Validation**: Environment variables are validated at startup

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📝 Development

### Code Style

- Use ES6+ features
- Follow async/await patterns
- Implement proper error handling
- Add JSDoc comments for public methods
- Use meaningful variable and function names

### Adding New Features

1. **Controller**: Add business logic in appropriate controller
2. **Service**: Implement business operations in service layer
3. **Route**: Define API endpoints in route files
4. **Middleware**: Add validation or processing middleware as needed
5. **Model**: Create data models if required

### Error Handling

The application uses a centralized error handling system:

- All errors are caught and formatted consistently
- HTTP status codes are set appropriately
- Error messages are user-friendly
- Detailed error information is logged for debugging

## 🚀 Deployment

### Environment Variables

Ensure all required environment variables are set:

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-mongo-uri
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=https://yourdomain.com
```

### Production Considerations

- Use PM2 or similar process manager
- Set up proper logging
- Configure monitoring and alerting
- Use environment-specific configurations
- Implement proper backup strategies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the API examples

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Dynamic schema creation and management
- Dynamic CRUD operations
- JSON Schema validation
- MongoDB integration
- RESTful API design
