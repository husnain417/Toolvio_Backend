const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { authenticate, requireRole, requireSystemPermission, requireTenantAccess, requireTenantManagement } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     TenantCreate:
 *       type: object
 *       required:
 *         - tenantId
 *         - name
 *         - displayName
 *       properties:
 *         tenantId:
 *           type: string
 *           description: Unique tenant identifier
 *           example: "acme-corp"
 *         name:
 *           type: string
 *           description: Company/organization name
 *           example: "Acme Corporation"
 *         displayName:
 *           type: string
 *           description: Display name for the tenant
 *           example: "Acme Corp"
 *         description:
 *           type: string
 *           description: Tenant description
 *           example: "Leading technology solutions provider"
 *         contactEmail:
 *           type: string
 *           format: email
 *           description: Primary contact email
 *           example: "admin@acme.com"
 *         contactPhone:
 *           type: string
 *           description: Primary contact phone
 *           example: "+1-555-0123"
 *         settings:
 *           type: object
 *           properties:
 *             maxUsers:
 *               type: number
 *               description: Maximum number of users allowed
 *               example: 100
 *             maxSchemas:
 *               type: number
 *               description: Maximum number of schemas allowed
 *               example: 50
 *             maxStorageGB:
 *               type: number
 *               description: Maximum storage in GB
 *               example: 10
 *         subscriptionPlan:
 *           type: string
 *           enum: [trial, basic, professional, enterprise]
 *           default: trial
 *           description: Subscription plan
 *     TenantUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Company/organization name
 *         displayName:
 *           type: string
 *           description: Display name for the tenant
 *         description:
 *           type: string
 *           description: Tenant description
 *         contactEmail:
 *           type: string
 *           format: email
 *           description: Primary contact email
 *         contactPhone:
 *           type: string
 *           description: Primary contact phone
 *         settings:
 *           type: object
 *           properties:
 *             maxUsers:
 *               type: number
 *               description: Maximum number of users allowed
 *             maxSchemas:
 *               type: number
 *               description: Maximum number of schemas allowed
 *             maxStorageGB:
 *               type: number
 *               description: Maximum storage in GB
 *         subscriptionPlan:
 *           type: string
 *           enum: [trial, basic, professional, enterprise]
 *           description: Subscription plan
 *     TenantResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Tenant ID
 *         tenantId:
 *           type: string
 *           description: Unique tenant identifier
 *         name:
 *           type: string
 *           description: Company/organization name
 *         displayName:
 *           type: string
 *           description: Display name for the tenant
 *         description:
 *           type: string
 *           description: Tenant description
 *         contactEmail:
 *           type: string
 *           description: Primary contact email
 *         contactPhone:
 *           type: string
 *           description: Primary contact phone
 *         settings:
 *           type: object
 *           properties:
 *             maxUsers:
 *               type: number
 *               description: Maximum number of users allowed
 *             maxSchemas:
 *               type: number
 *               description: Maximum number of schemas allowed
 *             maxStorageGB:
 *               type: number
 *               description: Maximum storage in GB
 *             features:
 *               type: object
 *               properties:
 *                 auditTrail:
 *                   type: boolean
 *                   description: Audit trail feature enabled
 *                 changeStreams:
 *                   type: boolean
 *                   description: Change streams feature enabled
 *                 offlineSync:
 *                   type: boolean
 *                   description: Offline sync feature enabled
 *                 apiRateLimit:
 *                   type: boolean
 *                   description: API rate limiting enabled
 *         subscriptionPlan:
 *           type: string
 *           description: Subscription plan
 *         isActive:
 *           type: boolean
 *           description: Whether tenant is active
 *         isTrial:
 *           type: boolean
 *           description: Whether tenant is in trial period
 *         trialExpiresAt:
 *           type: string
 *           format: date-time
 *           description: Trial expiration date
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Tenant creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 *     TenantStats:
 *       type: object
 *       properties:
 *         tenantId:
 *           type: string
 *           description: Tenant identifier
 *         name:
 *           type: string
 *           description: Tenant name
 *         displayName:
 *           type: string
 *           description: Display name
 *         subscriptionPlan:
 *           type: string
 *           description: Subscription plan
 *         isActive:
 *           type: boolean
 *           description: Active status
 *         usage:
 *           type: object
 *           properties:
 *             userCount:
 *               type: number
 *               description: Current number of users
 *             schemaCount:
 *               type: number
 *               description: Current number of schemas
 *             storageUsedGB:
 *               type: number
 *               description: Storage used in GB
 *             maxUsers:
 *               type: number
 *               description: Maximum users allowed
 *             maxSchemas:
 *               type: number
 *               description: Maximum schemas allowed
 *             maxStorageGB:
 *               type: number
 *               description: Maximum storage allowed
 *         limits:
 *           type: object
 *           properties:
 *             userLimitReached:
 *               type: boolean
 *               description: User limit reached
 *             schemaLimitReached:
 *               type: boolean
 *               description: Schema limit reached
 *             storageLimitReached:
 *               type: boolean
 *               description: Storage limit reached
 */

/**
 * @swagger
 * /api/tenants:
 *   post:
 *     summary: Create a new tenant with admin user
 *     description: Create a new tenant and automatically create an admin user for that tenant
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - tenantInfo
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for the admin user
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email for the admin user
 *               password:
 *                 type: string
 *                 description: Password for the admin user
 *               firstName:
 *                 type: string
 *                 description: First name of the admin user
 *               lastName:
 *                 type: string
 *                 description: Last name of the admin user
 *               role:
 *                 type: string
 *                 default: admin
 *                 description: Role for the user (defaults to admin)
 *               tenantInfo:
 *                 type: object
 *                 required:
 *                   - name
 *                   - domain
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Display name of the tenant
 *                   domain:
 *                     type: string
 *                     description: Unique domain identifier for the tenant
 *                   description:
 *                     type: string
 *                     description: Tenant description
 *                   phone:
 *                     type: string
 *                     description: Contact phone number
 *                   timezone:
 *                     type: string
 *                     description: Timezone for the tenant
 *                   currency:
 *                     type: string
 *                     description: Default currency for the tenant
 *                   businessType:
 *                     type: string
 *                     description: Type of business
 *                   subscriptionPlan:
 *                     type: string
 *                     enum: [trial, basic, professional, enterprise]
 *                     default: trial
 *                     description: Subscription plan
 *     responses:
 *       201:
 *         description: Tenant and admin user created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Tenant and admin user created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         tenantId:
 *                           type: string
 *                         name:
 *                           type: string
 *                         displayName:
 *                           type: string
 *                         domain:
 *                           type: string
 *                         contactEmail:
 *                           type: string
 *                         settings:
 *                           type: object
 *                         subscriptionPlan:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         isTrial:
 *                           type: boolean
 *                         trialExpiresAt:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                     adminUser:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         role:
 *                           type: string
 *                         tenantId:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                     token:
 *                       type: string
 *                       description: JWT token for the new admin user
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.post('/', tenantController.createTenant.bind(tenantController));

/**
 * @swagger
 * /api/tenants:
 *   get:
 *     summary: Get all tenants
 *     description: Retrieve all tenants with pagination, filtering, and sorting
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name, display name, or tenant ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by tenant status
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *           enum: [trial, basic, professional, enterprise]
 *         description: Filter by subscription plan
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Tenants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TenantResponse'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         pages:
 *                           type: number
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/', authenticate, requireSystemPermission('manageTenants'), tenantController.getAllTenants.bind(tenantController));

/**
 * @swagger
 * /api/tenants/summary:
 *   get:
 *     summary: Get tenants summary
 *     description: Get a simplified list of active tenants for dropdowns and selection
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tenants summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tenantId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       subscriptionPlan:
 *                         type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 */
router.get('/summary', authenticate, tenantController.getTenantsSummary);

/**
 * @swagger
 * /api/tenants/{tenantId}:
 *   get:
 *     summary: Get tenant by ID
 *     description: Retrieve a specific tenant by its ID
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 *     responses:
 *       200:
 *         description: Tenant retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TenantResponse'
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Tenant not found
 */
router.get('/:tenantId', authenticate, requireTenantAccess, tenantController.getTenantById);

/**
 * @swagger
 * /api/tenants/{tenantId}:
 *   put:
 *     summary: Update tenant
 *     description: Update an existing tenant's information
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantUpdate'
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TenantResponse'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Tenant not found
 */
router.put('/:tenantId', authenticate, requireTenantManagement, tenantController.updateTenant.bind(tenantController));

/**
 * @swagger
 * /api/tenants/{tenantId}:
 *   delete:
 *     summary: Delete tenant (soft delete)
 *     description: Deactivate a tenant (soft delete - sets isActive to false)
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 *     responses:
 *       200:
 *         description: Tenant deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TenantResponse'
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Tenant not found
 */
router.delete('/:tenantId', authenticate, requireTenantManagement, tenantController.deleteTenant);

/**
 * @swagger
 * /api/tenants/{tenantId}/status:
 *   patch:
 *     summary: Toggle tenant status
 *     description: Activate or deactivate a tenant
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Whether to activate or deactivate the tenant
 *                 example: true
 *     responses:
 *       200:
 *         description: Tenant status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TenantResponse'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Tenant not found
 */
router.patch('/:tenantId/status', authenticate, requireTenantManagement, tenantController.toggleTenantStatus);

/**
 * @swagger
 * /api/tenants/{tenantId}/stats:
 *   get:
 *     summary: Get tenant statistics
 *     description: Retrieve usage statistics and limits for a specific tenant
 *     tags: [Tenants]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 *     responses:
 *       200:
 *         description: Tenant statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TenantStats'
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Tenant not found
 */
router.get('/:tenantId/stats', authenticate, requireTenantAccess, tenantController.getTenantStats);

module.exports = router;
