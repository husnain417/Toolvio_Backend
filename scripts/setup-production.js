#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

const CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  superAdmin: {
    username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@craftsman-platform.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!',
    firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
    lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Administrator'
  }
};

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`.blue),
  success: (msg) => console.log(`✅ ${msg}`.green),
  error: (msg) => console.log(`❌ ${msg}`.red),
  warning: (msg) => console.log(`⚠️  ${msg}`.yellow),
  step: (msg) => console.log(`\n🚀 ${msg}`.cyan.bold)
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const response = await axios({
      method,
      url: `${CONFIG.baseURL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000
    });
    
    // Ensure we have valid JSON data
    let responseData = response.data;
    if (typeof responseData === 'string') {
      try {
        responseData = JSON.parse(responseData);
      } catch (parseError) {
        return { 
          success: false, 
          error: { message: `Invalid JSON response: ${responseData}` }, 
          status: response.status 
        };
      }
    }
    
    return { success: true, data: responseData, status: response.status };
  } catch (error) {
    if (error.response) {
      let errorData = error.response.data;
      
      // Handle JSON parsing errors in error responses
      if (typeof errorData === 'string') {
        try {
          errorData = JSON.parse(errorData);
        } catch (parseError) {
          errorData = { message: `Invalid JSON error response: ${errorData}` };
        }
      }
      
      return { 
        success: false, 
        error: errorData, 
        status: error.response.status 
      };
    }
    return { 
      success: false, 
      error: { message: error.message }, 
      status: 0 
    };
  }
};

const waitForServer = async (maxAttempts = 30, delay = 2000) => {
  log.step('Waiting for server to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.info(`Attempt ${attempt}/${maxAttempts}: Checking server...`);
      
      const healthCheck = await makeRequest('GET', '/health');
      if (healthCheck.success) {
        log.success('Server is responding to health checks');
        return true;
      }
      
      if (attempt < maxAttempts) {
        log.info(`Server not ready yet, waiting ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (attempt < maxAttempts) {
        log.info(`Connection failed, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  log.error(`Server did not become ready after ${maxAttempts} attempts`);
  return false;
};

const checkSystemHealth = async () => {
  log.step('Checking system health...');
  
  const healthCheck = await makeRequest('GET', '/health');
  if (!healthCheck.success) {
    log.error(`Health check failed: ${healthCheck.error.message || 'Unknown error'}`);
    return false;
  }
  
  log.success(`Health check passed: ${healthCheck.data.status}`);
  
  const readyCheck = await makeRequest('GET', '/ready');
  if (!readyCheck.success) {
    log.error(`Ready check failed: ${readyCheck.error.message || 'Unknown error'}`);
    return false;
  }
  
  log.success(`Ready check passed: ${readyCheck.data.status}`);
  return true;
};

const loginSuperAdmin = async () => {
  log.step('Attempting to login as existing super admin...');
  
  // Try different login payload formats
  const loginAttempts = [
    // Try with email + password
    {
      email: CONFIG.superAdmin.email,
      password: CONFIG.superAdmin.password
    },
    // Try with username + password  
    {
      username: CONFIG.superAdmin.username,
      password: CONFIG.superAdmin.password
    },
    // Try with identifier (email)
    {
      identifier: CONFIG.superAdmin.email,
      password: CONFIG.superAdmin.password
    },
    // Try with identifier (username)
    {
      identifier: CONFIG.superAdmin.username,
      password: CONFIG.superAdmin.password
    }
  ];
  
  for (let i = 0; i < loginAttempts.length; i++) {
    const loginData = loginAttempts[i];
    const attemptType = Object.keys(loginData)[0]; // email, username, or identifier
    
    log.info(`Trying login with ${attemptType}: ${loginData[attemptType]}`);
    
    const result = await makeRequest('POST', '/api/auth/login', loginData);
    
    if (result.success) {
      log.success('Successfully logged in as super admin');
      return {
        success: true,
        token: result.data.data.token,
        user: result.data.data.user,
        tenant: result.data.data.tenant
      };
    } else {
      log.info(`Login attempt ${i + 1} failed: ${result.error.message || 'Unknown error'}`);
    }
  }
  
  log.error('All login attempts failed');
  return null;
};

const registerSuperAdmin = async () => {
  log.step('Registering super admin...');
  
  const superAdminData = {
    username: CONFIG.superAdmin.username,
    email: CONFIG.superAdmin.email,
    password: CONFIG.superAdmin.password,
    firstName: CONFIG.superAdmin.firstName,
    lastName: CONFIG.superAdmin.lastName
  };
  
  const result = await makeRequest('POST', '/api/auth/register-super-admin', superAdminData);
  
  if (!result.success) {
    // Handle various error conditions that indicate existing data
    const errorMessage = result.error.message || '';
    
    // Check for explicit super admin exists response
    if (result.status === 400 && result.error.code === 'SUPER_ADMIN_EXISTS') {
      log.warning('Super admin already exists in the system');
      return { exists: true };
    }
    
    // Check for duplicate key errors (E11000) - tenant
    if (result.status === 500 && errorMessage.includes('E11000') && errorMessage.includes('tenantId')) {
      log.warning('Default tenant already exists in database');
      return { exists: true };
    }
    
    // Check for duplicate key errors (E11000) - user
    if (result.status === 500 && errorMessage.includes('E11000') && 
        (errorMessage.includes('username') || errorMessage.includes('email'))) {
      log.warning('Super admin user already exists in database');
      return { exists: true };
    }
    
    // Check for any "already exists" type messages
    if (errorMessage.toLowerCase().includes('already exists') || 
        errorMessage.toLowerCase().includes('duplicate')) {
      log.warning('Super admin or tenant already exists');
      return { exists: true };
    }
    
    log.error(`Failed to register super admin: ${errorMessage}`);
    return { success: false, error: result.error };
  }
  
  log.success('Super admin registered successfully');
  return { 
    success: true, 
    token: result.data.data.token,
    user: result.data.data.user,
    tenant: result.data.data.tenant
  };
};

const createDemoTenant = async (token) => {
  log.step('Creating demo tenant...');
  
  const tenantData = {
    tenantId: 'craftsman-demo',
    name: 'Craftsman Demo Company',
    displayName: 'Demo Company',
    description: 'Demo tenant for testing purposes',
    settings: {
      timezone: 'America/Chicago',
      currency: 'USD',
      businessType: 'plumbing'
    }
  };
  
  const result = await makeRequest('POST', '/api/tenants', tenantData, {
    'Authorization': `Bearer ${token}`
  });
  
  if (!result.success) {
    const errorMessage = result.error.message || '';
    
    // Check if tenant already exists
    if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
      log.warning('Demo tenant already exists, skipping creation');
      return { exists: true };
    }
    
    log.warning(`Failed to create demo tenant: ${errorMessage}`);
    return null;
  }
  
  log.success(`Demo tenant created: ${result.data.data.name} (${result.data.data.tenantId})`);
  return result.data.data;
};

const createTenantAdmin = async (token, tenantId) => {
  log.step('Creating tenant admin user...');
  
  const adminData = {
    username: 'tenant-admin',
    email: 'admin@craftsman-demo.com',
    password: 'TenantAdmin123!',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'admin',
    tenantId: tenantId
  };
  
  const result = await makeRequest('POST', '/api/auth/register', adminData, {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId
  });
  
  if (!result.success) {
    log.error(`Failed to create tenant admin: ${result.error.message}`);
    return null;
  }
  
  log.success('Tenant admin created successfully');
  return result.data.data;
};

const testSystemAccess = async (token) => {
  log.step('Testing super admin access...');
  
  const result = await makeRequest('GET', '/api/tenants', null, {
    'Authorization': `Bearer ${token}`
  });
  
  if (!result.success) {
    log.error(`Failed to test system access: ${result.error.message}`);
    return false;
  }
  
  log.success('Super admin access verified');
  return true;
};

const testTenantAdminLogin = async (tenantId) => {
  log.step('Testing tenant admin login...');
  
  const loginData = {
    identifier: 'admin@craftsman-demo.com',
    password: 'TenantAdmin123!'
    // No tenantId needed - system will auto-detect it
  };
  
  const result = await makeRequest('POST', '/api/auth/login', loginData);
  
  if (!result.success) {
    log.error(`Failed to test tenant admin login: ${result.error.message}`);
    return false;
  }
  
  log.success('Tenant admin login verified');
  return result.data.data.token;
};

const main = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🏗️  CRAFTSMAN PLATFORM - PRODUCTION SETUP'.bold);
  console.log('='.repeat(60));
  
  try {
    // Check system health
    const isHealthy = await checkSystemHealth();
    if (!isHealthy) {
      process.exit(1);
    }
    
    // Register super admin
    const superAdminResult = await registerSuperAdmin();
    if (!superAdminResult.success && !superAdminResult.exists) {
      process.exit(1);
    }
    
    if (superAdminResult.exists) {
      log.info('System is already set up. You can now:');
      log.info('1. Login as super admin');
      log.info('2. Create tenants through the API');
      log.info('3. Have tenant admins register themselves');
      return;
    }
    
    const { token, user, tenant } = superAdminResult;
    
    // Test system access
    const accessVerified = await testSystemAccess(token);
    if (!accessVerified) {
      process.exit(1);
    }
    
    // Create demo tenant
    const demoTenant = await createDemoTenant(token);
    if (!demoTenant) {
      process.exit(1);
    }
    
    // Create tenant admin
    const tenantAdmin = await createTenantAdmin(token, demoTenant.domain);
    if (!tenantAdmin) {
      process.exit(1);
    }
    
    // Test tenant admin login
    const tenantAdminToken = await testTenantAdminLogin(demoTenant.domain);
    if (!tenantAdminToken) {
      log.warning('Tenant admin login test failed, but user was created');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    log.success('PRODUCTION SETUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    
    console.log('\n📋 Setup Summary:');
    console.log(`   Super Admin: ${user.email} (${user.username})`);
    console.log(`   Default Tenant: ${tenant.name} (${tenant.domain})`);
    console.log(`   Demo Tenant: ${demoTenant.name} (${demoTenant.domain})`);
    console.log(`   Tenant Admin: admin@craftsman-demo.com`);
    
    console.log('\n🔑 Next Steps:');
    console.log('   1. Login as super admin using the credentials above');
    console.log('   2. Create additional tenants as needed');
    console.log('   3. Have tenant admins register themselves using tenant IDs');
    console.log('   4. Start building your schemas and data models');
    
    console.log('\n⚠️  Security Notes:');
    console.log('   - Change default passwords immediately');
    console.log('   - Store credentials securely');
    console.log('   - Monitor system access');
    
    console.log('\n🚀 You can now use the platform!');
    
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };