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
 *           enum: [admin, office, technician, customer]
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
 * /api/auth/register:
 *   post:
 *     summary: User registration
 *     description: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid request data or user already exists
 *       403:
 *         description: Tenant inactive or user limit reached
 */
router.post('/register', authController.register);

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
