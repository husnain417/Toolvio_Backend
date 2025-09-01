# 🔐 Login Format Reference

## **System Admin Login**
**Endpoint**: `POST /api/auth/login`
**Fields**: `identifier` + `password` (NO `tenantId`)

```json
{
  "identifier": "admin@craftsman-platform.com",
  "password": "SuperAdmin123!"
}
```

## **Regular User Login (NEW SIMPLIFIED FORMAT)**
**Endpoint**: `POST /api/auth/login`
**Fields**: `identifier` + `password` (NO `tenantId` required!)

```json
{
  "identifier": "admin@craftsman-demo.com",
  "password": "TenantAdmin123!"
}
```

**🎉 NEW**: The system automatically detects your tenant from your user record!

## **Legacy Support (Backward Compatible)**
**Endpoint**: `POST /api/auth/login`
**Fields**: `identifier` + `password` + `tenantId`

```json
{
  "identifier": "admin@craftsman-demo.com",
  "password": "TenantAdmin123!",
  "tenantId": "craftsman-demo"
}
```

## **Key Points**

### **Field Names**
- ✅ **Use**: `identifier` (not `email`)
- ✅ **Use**: `password`
- ❌ **Don't need**: `tenantId` (system auto-detects it!)

### **System Admin vs Regular User**
- **System Admin**: No `tenantId` required
- **Regular User**: No `tenantId` required (NEW!)
- **Legacy Support**: `tenantId` still works if provided

### **Identifier Format**
- Can be either username or email
- Backend will search both fields
- System automatically finds your tenant

## **How It Works Now**

### **1. User Login (Simplified)**
```json
{
  "identifier": "user@company.com",
  "password": "password123"
}
```

### **2. System Response**
```json
{
  "success": true,
  "data": {
    "user": {
      "email": "user@company.com",
      "tenantId": "company-tenant",  // Automatically included!
      "role": "admin"
    },
    "token": "jwt-token-with-tenant-context"
  }
}
```

### **3. JWT Token Contains**
```javascript
{
  "userId": "user123",
  "email": "user@company.com",
  "tenantId": "company-tenant",  // Automatically included!
  "role": "admin",
  "isSystemAdmin": false
}
```

## **Common Mistakes**

### ❌ Old Format (No Longer Needed)
```json
{
  "email": "admin@craftsman-demo.com",  // Wrong field name
  "password": "password123",
  "tenantId": "craftsman-demo"  // No longer required!
}
```

### ✅ New Simplified Format
```json
{
  "identifier": "admin@craftsman-demo.com",  // Correct field name
  "password": "password123"
  // No tenantId needed - system auto-detects it!
}
```

## **Testing Examples**

### **Test System Admin Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@craftsman-platform.com",
    "password": "SuperAdmin123!"
  }'
```

### **Test Regular User Login (NEW SIMPLIFIED)**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@craftsman-demo.com",
    "password": "TenantAdmin123!"
  }'
```

## **Troubleshooting**

### **Error: "Username/email and password are required"**
- Check that you're using `identifier` field (not `email`)
- Ensure both `identifier` and `password` are provided

### **Error: "Invalid credentials"**
- Verify username/email exists
- Check password is correct
- System will automatically find your tenant

### **Error: "User not found"**
- Check if user exists in any tenant
- Ensure user is active
- System searches across all tenants automatically

## **Migration Notes**

### **From Old Format to New**
- **Remove**: `tenantId` field from login requests
- **Keep**: `identifier` and `password` fields
- **Result**: Simpler, more secure login process

### **Backward Compatibility**
- Old format with `tenantId` still works
- New format automatically detects tenant
- Both approaches are supported
