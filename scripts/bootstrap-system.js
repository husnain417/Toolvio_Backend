#!/usr/bin/env node

/**
 * System Bootstrap Script for Craftsman Dynamic Backend Platform
 * 
 * This script bootstraps the system by creating:
 * 1. System admin user
 * 2. First tenant
 * 3. Sets up initial configuration
 * 
 * Usage: node scripts/bootstrap-system.js
 */

const axios = require('axios');
const colors = require('colors');

// Configuration
const CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  systemAdmin: {
    email: process.env.SYSTEM_ADMIN_EMAIL || 'admin@craftsman-platform.com',
    password: process.env.SYSTEM_ADMIN_PASSWORD || 'SystemAdmin123!',
    firstName: process.env.SYSTEM_ADMIN_FIRST_NAME || 'System',
    lastName: process.env.SYSTEM_ADMIN_LAST_NAME || 'Administrator'
  },
  masterKey: process.env.SYSTEM_BOOTSTRAP_KEY || 'SYSTEM_BOOTSTRAP_KEY_2025'
};

// Utility functions
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`.blue),
  success: (msg) => console.log(`✅ ${msg}`.green),
  error: (msg) => console.log(`❌ ${msg}`.red),
  warning: (msg) => console.log(`⚠️  ${msg}`.yellow),
  step: (msg) => console.log(`\n🔍 ${msg}`.cyan)
};

const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${CONFIG.baseURL}${endpoint}`,
      timeout: 10000
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status || 'Network Error' 
    };
  }
};

const checkSystemHealth = async () => {
  log.step('Checking system health...');
  
  const healthCheck = await makeRequest('GET', '/health');
  if (!healthCheck.success) {
    log.error(`System health check failed: ${healthCheck.error}`);
    return false;
  }
  
  log.success('System is healthy and responding');
  return true;
};

const bootstrapSystem = async () => {
  log.step('Bootstrapping system...');
  
  const bootstrapData = {
    email: CONFIG.systemAdmin.email,
    password: CONFIG.systemAdmin.password,
    firstName: CONFIG.systemAdmin.firstName,
    lastName: CONFIG.systemAdmin.lastName,
    masterKey: CONFIG.masterKey
  };
  
  const bootstrapResult = await makeRequest('POST', '/api/auth/bootstrap', bootstrapData);
  
  if (!bootstrapResult.success) {
    if (bootstrapResult.status === 400 && bootstrapResult.error?.message?.includes('already bootstrapped')) {
      log.warning('System already bootstrapped');
      return await loginAsSystemAdmin();
    }
    
    log.error(`Bootstrap failed: ${bootstrapResult.error?.message || bootstrapResult.error}`);
    return false;
  }
  
  log.success('System bootstrapped successfully!');
  
  const { systemAdmin, firstTenant, token } = bootstrapResult.data.data;
  
  console.log('\n🎉 Bootstrap Results:');
  console.log(`   👤 System Admin: ${systemAdmin.firstName} ${systemAdmin.lastName}`);
  console.log(`   📧 Email: ${systemAdmin.email}`);
  console.log(`   🔑 Role: ${systemAdmin.role}`);
  console.log(`   🏢 First Tenant: ${firstTenant.name} (${firstTenant.tenantId})`);
  console.log(`   🎫 Token: ${token.substring(0, 20)}...`);
  
  return { token, systemAdmin, firstTenant };
};

const loginAsSystemAdmin = async () => {
  log.step('Logging in as existing system admin...');
  
  const loginData = {
    identifier: CONFIG.systemAdmin.email,
    password: CONFIG.systemAdmin.password
    // Note: No tenantId needed for system admin
  };
  
  const loginResult = await makeRequest('POST', '/api/auth/login', loginData);
  
  if (!loginResult.success) {
    log.error(`Login failed: ${loginResult.error?.message || loginResult.error}`);
    return false;
  }
  
  log.success('Logged in as system admin');
  return { token: loginResult.data.data.token, systemAdmin: loginResult.data.data.user };
};

const createDemoTenant = async (token) => {
  log.step('Creating demo tenant...');
  
  const demoTenantData = {
    tenantId: 'demo-company',
    name: 'Demo Company',
    displayName: 'Demo Company Inc.',
    description: 'Demo tenant for testing and development',
    contactEmail: 'demo@example.com',
    contactPhone: '+1234567890',
    settings: {
      maxUsers: 500,
      maxSchemas: 50,
      maxStorageGB: 25,
      features: {
        auditTrail: true,
        changeStreams: true,
        offlineSync: true,
        apiRateLimit: true
      }
    },
    subscriptionPlan: 'professional'
  };
  
  const createResult = await makeRequest('POST', '/api/tenants', demoTenantData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!createResult.success) {
    log.error(`Failed to create demo tenant: ${createResult.error?.message || createResult.error}`);
    return false;
  }
  
  log.success('Demo tenant created successfully');
  return createResult.data.data;
};

const createTenantAdmin = async (token, tenantId) => {
  log.step('Creating tenant admin user...');
  
  const adminData = {
    username: 'tenant_admin',
    email: 'admin@demo-company.com',
    password: 'TenantAdmin123!',
    firstName: 'Tenant',
    lastName: 'Administrator',
    role: 'admin',
    tenantId
  };
  
  const createResult = await makeRequest('POST', '/api/auth/register', adminData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!createResult.success) {
    log.error(`Failed to create tenant admin: ${createResult.error?.message || createResult.error}`);
    return false;
  }
  
  log.success('Tenant admin created successfully');
  return createResult.data.data;
};

const testSystemAccess = async (token) => {
  log.step('Testing system admin access...');
  
  // Test tenant listing
  const tenantsResult = await makeRequest('GET', '/api/tenants', null, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!tenantsResult.success) {
    log.error(`Failed to list tenants: ${tenantsResult.error?.message || tenantsResult.error}`);
    return false;
  }
  
  log.success('System admin can access tenant management');
  
  // Test platform capabilities
  const capabilitiesResult = await makeRequest('GET', '/api/discovery/capabilities');
  
  if (!capabilitiesResult.success) {
    log.error(`Failed to get platform capabilities: ${capabilitiesResult.error?.message || capabilitiesResult.error}`);
    return false;
  }
  
  log.success('Platform capabilities accessible');
  return true;
};

const main = async () => {
  console.log('\n🚀 Craftsman Dynamic Backend Platform - System Bootstrap');
  console.log(`📍 Target: ${CONFIG.baseURL}`);
  console.log(`👤 System Admin: ${CONFIG.systemAdmin.email}`);
  console.log(`🔑 Master Key: ${CONFIG.masterKey}`);
  console.log('='.repeat(60));
  
  try {
    // Step 1: Check system health
    if (!(await checkSystemHealth())) {
      process.exit(1);
    }
    
    // Step 2: Bootstrap system or login
    let result = await bootstrapSystem();
    if (!result) {
      process.exit(1);
    }
    
    const { token, systemAdmin, firstTenant } = result;
    
    // Step 3: Test system admin access
    if (!(await testSystemAccess(token))) {
      process.exit(1);
    }
    
    // Step 4: Create demo tenant
    const demoTenant = await createDemoTenant(token);
    
    // Step 5: Create tenant admin (if demo tenant was created)
    if (demoTenant) {
      await createTenantAdmin(token, demoTenant.tenantId);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SYSTEM BOOTSTRAP COMPLETE!'.green.bold);
    console.log('='.repeat(60));
    
    console.log('\n👤 System Admin Account:');
    console.log(`   Email: ${systemAdmin.email}`);
    console.log(`   Password: ${CONFIG.systemAdmin.password}`);
    console.log(`   Role: ${systemAdmin.role}`);
    
    console.log('\n🏢 Tenants Created:');
    console.log(`   1. ${firstTenant.name} (${firstTenant.tenantId})`);
    if (demoTenant) {
      console.log(`   2. ${demoTenant.name} (${demoTenant.tenantId})`);
    }
    
    console.log('\n🔑 Next Steps:');
    console.log('   1. Use system admin credentials to access platform');
    console.log('   2. Create additional tenants via /api/tenants');
    console.log('   3. Manage users and schemas for each tenant');
    console.log('   4. Configure platform settings and monitoring');
    
    console.log('\n📚 API Documentation:');
    console.log(`   ${CONFIG.baseURL}/api/docs`);
    
    console.log('\n🔒 Security Note:');
    console.log('   - Change default passwords after first login');
    console.log('   - Store master key securely');
    console.log('   - Monitor system admin activities');
    
  } catch (error) {
    log.error(`Bootstrap failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
