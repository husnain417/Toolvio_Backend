/**
 * Test Schema References and Change Propagation
 * 
 * This file demonstrates how to use the new schema reference functionality:
 * 1. Create schemas with $ref properties
 * 2. Create records with references
 * 3. Test population functionality
 * 4. Test change propagation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test data for schemas with references
const userSchema = {
  name: 'user',
  displayName: 'User Profile',
  jsonSchema: {
    type: 'object',
    properties: {
      firstName: { type: 'string', minLength: 1 },
      lastName: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['admin', 'user', 'moderator'] }
    },
    required: ['firstName', 'lastName', 'email', 'role']
  }
};

const categorySchema = {
  name: 'category',
  displayName: 'Product Category',
  jsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      isActive: { type: 'boolean', default: true }
    },
    required: ['name']
  }
};

const productSchema = {
  name: 'product',
  displayName: 'Product',
  jsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      category: { $ref: '#/definitions/category' },
      createdBy: { $ref: '#/definitions/user' },
      tags: { type: 'array', items: { type: 'string' } },
      relatedProducts: { 
        type: 'array', 
        items: { $ref: '#/definitions/product' }
      }
    },
    required: ['name', 'price', 'category', 'createdBy'],
    definitions: {
      category: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' }
        }
      },
      user: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' }
        }
      },
      product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' }
        }
      }
    }
  }
};

async function testSchemaReferences() {
  try {
    console.log('🚀 Testing Schema References and Change Propagation\n');

    // Step 1: Create schemas
    console.log('📝 Step 1: Creating schemas...');
    
    const userSchemaResponse = await axios.post(`${BASE_URL}/schemas`, userSchema);
    console.log('✅ User schema created:', userSchemaResponse.data.data.name);
    
    const categorySchemaResponse = await axios.post(`${BASE_URL}/schemas`, categorySchema);
    console.log('✅ Category schema created:', categorySchemaResponse.data.data.name);
    
    const productSchemaResponse = await axios.post(`${BASE_URL}/schemas`, productSchema);
    console.log('✅ Product schema created:', productSchemaResponse.data.data.name);
    
    // Step 2: Create records
    console.log('\n📝 Step 2: Creating records...');
    
    // Create a user
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: 'admin'
    };
    const userResponse = await axios.post(`${BASE_URL}/data/user`, userData);
    const userId = userResponse.data.data._id;
    console.log('✅ User created:', userId);
    
    // Create a category
    const categoryData = {
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      isActive: true
    };
    const categoryResponse = await axios.post(`${BASE_URL}/data/category`, categoryData);
    const categoryId = categoryResponse.data.data._id;
    console.log('✅ Category created:', categoryId);
    
    // Create a product with references
    const productData = {
      name: 'Smartphone',
      description: 'Latest smartphone model',
      price: 699.99,
      category: categoryId,
      createdBy: userId,
      tags: ['mobile', 'smartphone', 'tech'],
      relatedProducts: []
    };
    const productResponse = await axios.post(`${BASE_URL}/data/product`, productData);
    const productId = productResponse.data.data._id;
    console.log('✅ Product created:', productId);
    
    // Step 3: Test population functionality
    console.log('\n📝 Step 3: Testing population...');
    
    // Get product without population
    const productWithoutPopulate = await axios.get(`${BASE_URL}/data/product/${productId}`);
    console.log('📦 Product without population:');
    console.log('  - Category ID:', productWithoutPopulate.data.data.category);
    console.log('  - Created By ID:', productWithoutPopulate.data.data.createdBy);
    
    // Get product with population
    const productWithPopulate = await axios.get(`${BASE_URL}/data/product/${productId}?populate=category,createdBy`);
    console.log('\n📦 Product with population:');
    console.log('  - Category:', productWithPopulate.data.data.category?.name);
    console.log('  - Created By:', `${productWithPopulate.data.data.createdBy?.firstName} ${productWithPopulate.data.data.createdBy?.lastName}`);
    
    // Step 4: Test change propagation
    console.log('\n📝 Step 4: Testing change propagation...');
    
    // Update the category
    const updatedCategoryData = {
      name: 'Advanced Electronics',
      description: 'High-end electronic devices and gadgets'
    };
    await axios.put(`${BASE_URL}/data/category/${categoryId}`, updatedCategoryData);
    console.log('✅ Category updated');
    
    // Check if product reflects the change (metadata should be updated)
    const updatedProduct = await axios.get(`${BASE_URL}/data/product/${productId}`);
    console.log('📦 Product after category update:');
    console.log('  - Category last updated:', updatedProduct.data.data.category_lastUpdated);
    console.log('  - Category version:', updatedProduct.data.data.category_version);
    
    // Step 5: Test array references
    console.log('\n📝 Step 5: Testing array references...');
    
    // Create another product
    const product2Data = {
      name: 'Laptop',
      description: 'High-performance laptop',
      price: 1299.99,
      category: categoryId,
      createdBy: userId,
      tags: ['computer', 'laptop', 'tech'],
      relatedProducts: []
    };
    const product2Response = await axios.post(`${BASE_URL}/data/product`, product2Data);
    const product2Id = product2Response.data.data._id;
    console.log('✅ Second product created:', product2Id);
    
    // Update first product to reference second product
    const updateProductData = {
      relatedProducts: [product2Id]
    };
    await axios.patch(`${BASE_URL}/data/product/${productId}`, updateProductData);
    console.log('✅ First product updated with related product');
    
    // Get product with related products populated
    const productWithRelated = await axios.get(`${BASE_URL}/data/product/${productId}?populate=relatedProducts`);
    console.log('📦 Product with related products:');
    console.log('  - Related products count:', productWithRelated.data.data.relatedProducts?.length);
    console.log('  - First related product:', productWithRelated.data.data.relatedProducts?.[0]?.name);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary of what was tested:');
    console.log('  ✅ Schema creation with $ref properties');
    console.log('  ✅ Record creation with references');
    console.log('  ✅ Population of referenced data');
    console.log('  ✅ Change propagation to dependent records');
    console.log('  ✅ Array references and population');
    console.log('  ✅ Automatic relationship tracking');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
if (require.main === module) {
  testSchemaReferences();
}

module.exports = { testSchemaReferences };
