const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - identifier
 *         - password
 *         - tenantId
 *       properties:
 *         identifier:
 *           type: string
 *           description: Username or email address
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           description: User password
 *           example: "securePassword123"
 *         tenantId:
 *           type: string
 *           description: Tenant identifier
 *           example: "acme-corp"
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - tenantId
 *       properties:
 *         username:
 *           type: string
 *           description: Unique username
 *           example: "john.doe"
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User password (minimum 8 characters)
 *           example: "securePassword123"
 *         firstName:
 *           type: string
 *           description: User's first name
 *           example: "John"
 *         lastName:
 *           type: string
 *           description: User's last name
 *           example: "Doe"
 *         role:
 *           type: string
 *           enum: [system_admin, admin, office, technician, customer]
 *           default: customer
 *           description: User role
 *           example: "technician"
 *         tenantId:
 *           type: string
 *           description: Tenant identifier
 *           example: "acme-corp"
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: Current password
 *           example: "currentPassword123"
 *         newPassword:
 *           type: string
 *           minLength: 8
 *           description: New password (minimum 8 characters)
 *           example: "newPassword123"
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - token
 *       properties:
 *         token:
 *           type: string
 *           description: Current JWT token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     UserProfile:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID
 *         username:
 *           type: string
 *           description: Username
 *         email:
 *           type: string
 *           format: email
 *           description: Email address
 *         firstName:
 *           type: string
 *           description: First name
 *         lastName:
 *           type: string
 *           description: Last name
 *         role:
 *           type: string
 *           enum: [admin, office, technician, customer]
 *           description: User role
 *         tenantId:
 *           type: string
 *           description: Tenant ID
 *         permissions:
 *           type: object
 *           description: User permissions
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *     TenantInfo:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Tenant ID
 *         tenantId:
 *           type: string
 *           description: Tenant identifier
 *         name:
 *           type: string
 *           description: Tenant name
 *         displayName:
 *           type: string
 *           description: Display name
 *         description:
 *           type: string
 *           description: Tenant description
 *         subscriptionPlan:
 *           type: string
 *           enum: [trial, basic, professional, enterprise]
 *           description: Subscription plan
 *         subscriptionStatus:
 *           type: string
 *           description: Current subscription status
 *         settings:
 *           type: object
 *           description: Tenant settings
 *         usage:
 *           type: object
 *           description: Usage statistics
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Operation success status
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/UserProfile'
 *             token:
 *               type: string
 *               description: JWT authentication token
 *         message:
 *           type: string
 *           description: Response message
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with username/email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication failed
 *       403:
 *         description: Account locked or tenant inactive
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/register-super-admin:
 *   post:
 *     summary: Register the first super admin (production use)
 *     description: Creates the first super admin user. Only works if no super admin exists in the system.
 *     tags: [Authentication]
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
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username for the super admin
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address for the super admin
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Password for the super admin
 *               firstName:
 *                 type: string
 *                 description: First name of the super admin
 *               lastName:
 *                 type: string
 *                 description: Last name of the super admin
 *     responses:
 *       201:
 *         description: Super admin registered successfully
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
 *                   example: Super admin registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
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
 *                         isSystemAdmin:
 *                           type: boolean
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         domain:
 *                           type: string
 *                     token:
 *                       type: string
 *       400:
 *         description: Bad request - validation error or super admin already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 code:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/register-super-admin', authController.registerSuperAdmin);

/**
 * @swagger
 * /api/auth/bootstrap:
 *   post:
 *     summary: Bootstrap system (development/testing use)
 *     description: Creates system admin and first tenant. Master key required in production if super admin exists.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address for the system admin
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Password for the system admin
 *               firstName:
 *                 type: string
 *                 description: First name of the system admin
 *               lastName:
 *                 type: string
 *                 description: Last name of the system admin
 *               masterKey:
 *                 type: string
 *                 description: Master key (required in production if super admin exists)
 *     responses:
 *       201:
 *         description: System bootstrapped successfully
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
 *                   example: System bootstrapped successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     systemAdmin:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         isSystemAdmin:
 *                           type: boolean
 *                     firstTenant:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         domain:
 *                           type: string
 *                     token:
 *                       type: string
 *                     tenantsCreated:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Bad request - validation error or system already bootstrapped
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 code:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/bootstrap', authController.bootstrap);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: User registration
 *     description: Create a new user account (customer or technician only)
 *     tags: [Authentication]
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
 *               - role
 *               - tenantId
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User password
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               role:
 *                 type: string
 *                 enum: [customer, technician]
 *                 description: User role (self-registration limited to these roles)
 *               tenantId:
 *                 type: string
 *                 description: Tenant identifier
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid request data, user already exists, or invalid role
 *       403:
 *         description: Tenant inactive or user limit reached
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/create-office-user:
 *   post:
 *     summary: Create office user (admin only)
 *     description: Create a new office user account. Only tenant admins can create office users.
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
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
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User password
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *     responses:
 *       201:
 *         description: Office user created successfully
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
 *                     user:
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
 *                           example: office
 *                         tenantId:
 *                           type: string
 *                         permissions:
 *                           type: object
 *                 message:
 *                   type: string
 *                   example: Office user created successfully
 *       400:
 *         description: Invalid request data or user already exists
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions or tenant inactive
 */
router.post('/create-office-user', authenticate, requireRole(['admin']), authController.createOfficeUser);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh authentication token
 *     description: Get a new token using current valid token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Token required
 *       401:
 *         description: Invalid or expired token
 */
router.post('/refresh', authController.refreshToken);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve current user's profile information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update current user's profile information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: New first name
 *               lastName:
 *                 type: string
 *                 description: New last name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     description: Change current user's password
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid request data or incorrect current password
 *       401:
 *         description: Authentication required
 */
router.post('/change-password', authenticate, authController.changePassword);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logout current user (client-side token removal)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Authentication required
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /api/auth/tenant:
 *   get:
 *     summary: Get tenant information
 *     description: Retrieve current user's tenant information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TenantInfo'
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Tenant not found
 */
router.get('/tenant', authenticate, authController.getTenantInfo);

/**
 * @swagger
 * /api/auth/validate:
 *   get:
 *     summary: Validate authentication token
 *     description: Check if current token is valid and return user info
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *       401:
 *         description: Invalid or expired token
 */
router.get('/validate', authenticate, authController.validateToken);

module.exports = router;
