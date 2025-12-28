/**
 * Shop Contact Methods API Integration Test
 * 
 * Tests the shop contact methods endpoints:
 * - PUT /api/shop/contact-methods (Update contact methods)
 * - GET /api/shop/contact-methods (Get contact methods)
 * - DELETE /api/shop/contact-methods/:contactMethodId (Delete specific contact method)
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

// Test data
const testContactMethods = [
  {
    method_type: 'phone',
    value: '+821012345678',
    description: 'Main business phone',
    is_primary: true,
    display_order: 1,
    is_active: true
  },
  {
    method_type: 'email',
    value: 'contact@shop.com',
    description: 'Customer service email',
    is_primary: true,
    display_order: 2,
    is_active: true
  },
  {
    method_type: 'kakao_channel',
    value: 'https://pf.kakao.com/_abc123',
    description: 'KakaoTalk customer service',
    is_primary: false,
    display_order: 3,
    is_active: true
  },
  {
    method_type: 'instagram',
    value: 'https://instagram.com/shopname',
    description: 'Follow us on Instagram',
    is_primary: true,
    display_order: 4,
    is_active: true
  },
  {
    method_type: 'facebook',
    value: 'https://facebook.com/shopname',
    description: 'Like our Facebook page',
    is_primary: false,
    display_order: 5,
    is_active: true
  },
  {
    method_type: 'website',
    value: 'https://www.shopname.com',
    description: 'Visit our website',
    is_primary: true,
    display_order: 6,
    is_active: true
  }
];

const invalidContactMethods = [
  {
    method_type: 'phone',
    value: 'invalid-phone', // Invalid phone format
    description: 'Invalid phone',
    is_primary: true,
    display_order: 1,
    is_active: true
  },
  {
    method_type: 'email',
    value: 'invalid-email', // Invalid email format
    description: 'Invalid email',
    is_primary: true,
    display_order: 2,
    is_active: true
  },
  {
    method_type: 'kakao_channel',
    value: 'https://invalid-kakao.com', // Invalid Kakao channel URL
    description: 'Invalid Kakao channel',
    is_primary: false,
    display_order: 3,
    is_active: true
  }
];

class ShopContactMethodsAPITester {
  constructor() {
    this.authToken = null;
    this.shopId = null;
    this.createdContactMethodIds = [];
  }

  async authenticate() {
    console.log('🔐 Authenticating...');
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

      if (response.data.success && response.data.data?.token) {
        this.authToken = response.data.data.token;
        console.log('✅ Authentication successful');
        return true;
      } else {
        console.error('❌ Authentication failed:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Authentication error:', error.response?.data || error.message);
      return false;
    }
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  async testUpdateContactMethods() {
    console.log('\n📝 Testing PUT /api/shop/contact-methods (Update contact methods)...');
    
    try {
      const response = await axios.put(
        `${BASE_URL}/api/shop/contact-methods`,
        {
          contactMethods: testContactMethods
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      if (response.status === 200 && response.data.success) {
        console.log('✅ Contact methods updated successfully');
        console.log(`📊 Updated ${response.data.data.contactMethods.length} contact methods`);
        
        // Store created contact method IDs for cleanup
        this.createdContactMethodIds = response.data.data.contactMethods.map(cm => cm.id);
        
        // Display updated contact methods
        response.data.data.contactMethods.forEach((cm, index) => {
          console.log(`   ${index + 1}. ${cm.method_type}: ${cm.value} (${cm.description || 'No description'})`);
        });
        
        return true;
      } else {
        console.error('❌ Failed to update contact methods:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Update contact methods error:', error.response?.data || error.message);
      return false;
    }
  }

  async testGetContactMethods() {
    console.log('\n📖 Testing GET /api/shop/contact-methods (Get contact methods)...');
    
    try {
      const response = await axios.get(
        `${BASE_URL}/api/shop/contact-methods`,
        {
          headers: this.getAuthHeaders()
        }
      );

      if (response.status === 200 && response.data.success) {
        console.log('✅ Contact methods retrieved successfully');
        console.log(`📊 Retrieved ${response.data.data.contactMethods.length} contact methods`);
        
        // Display retrieved contact methods
        response.data.data.contactMethods.forEach((cm, index) => {
          console.log(`   ${index + 1}. ${cm.method_type}: ${cm.value} (${cm.description || 'No description'})`);
        });
        
        return true;
      } else {
        console.error('❌ Failed to get contact methods:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Get contact methods error:', error.response?.data || error.message);
      return false;
    }
  }

  async testDeleteContactMethod() {
    console.log('\n🗑️  Testing DELETE /api/shop/contact-methods/:contactMethodId...');
    
    if (this.createdContactMethodIds.length === 0) {
      console.log('⚠️  No contact method IDs available for deletion test');
      return true;
    }

    const contactMethodId = this.createdContactMethodIds[0]; // Delete the first one
    
    try {
      const response = await axios.delete(
        `${BASE_URL}/api/shop/contact-methods/${contactMethodId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      if (response.status === 200 && response.data.success) {
        console.log('✅ Contact method deleted successfully');
        console.log(`🗑️  Deleted contact method ID: ${contactMethodId}`);
        
        // Remove from our tracking list
        this.createdContactMethodIds = this.createdContactMethodIds.filter(id => id !== contactMethodId);
        
        return true;
      } else {
        console.error('❌ Failed to delete contact method:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Delete contact method error:', error.response?.data || error.message);
      return false;
    }
  }

  async testInvalidContactMethods() {
    console.log('\n🚫 Testing validation with invalid contact methods...');
    
    try {
      const response = await axios.put(
        `${BASE_URL}/api/shop/contact-methods`,
        {
          contactMethods: invalidContactMethods
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      // This should fail with validation errors
      console.error('❌ Expected validation errors but got success:', response.data);
      return false;
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Validation correctly rejected invalid contact methods');
        console.log(`🚫 Validation error: ${error.response.data.message}`);
        return true;
      } else {
        console.error('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  async testUnauthorizedAccess() {
    console.log('\n🔒 Testing unauthorized access...');
    
    try {
      const response = await axios.get(
        `${BASE_URL}/api/shop/contact-methods`
        // No authorization header
      );

      // This should fail with unauthorized error
      console.error('❌ Expected unauthorized error but got success:', response.data);
      return false;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Unauthorized access correctly rejected');
        return true;
      } else {
        console.error('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  async testEmptyContactMethods() {
    console.log('\n📝 Testing update with empty contact methods array...');
    
    try {
      const response = await axios.put(
        `${BASE_URL}/api/shop/contact-methods`,
        {
          contactMethods: []
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      if (response.status === 200 && response.data.success) {
        console.log('✅ Empty contact methods array accepted');
        console.log(`📊 Updated ${response.data.data.contactMethods.length} contact methods`);
        return true;
      } else {
        console.error('❌ Failed to handle empty contact methods:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Empty contact methods error:', error.response?.data || error.message);
      return false;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    // Try to delete any remaining contact methods
    for (const contactMethodId of this.createdContactMethodIds) {
      try {
        await axios.delete(
          `${BASE_URL}/api/shop/contact-methods/${contactMethodId}`,
          {
            headers: this.getAuthHeaders()
          }
        );
        console.log(`🗑️  Cleaned up contact method: ${contactMethodId}`);
      } catch (error) {
        console.log(`⚠️  Could not clean up contact method ${contactMethodId}:`, error.message);
      }
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Shop Contact Methods API Tests...\n');
    
    const results = {
      authentication: false,
      updateContactMethods: false,
      getContactMethods: false,
      deleteContactMethod: false,
      invalidContactMethods: false,
      unauthorizedAccess: false,
      emptyContactMethods: false
    };

    try {
      // Test authentication
      results.authentication = await this.authenticate();
      if (!results.authentication) {
        console.log('❌ Authentication failed, skipping other tests');
        return results;
      }

      // Test updating contact methods
      results.updateContactMethods = await this.testUpdateContactMethods();

      // Test getting contact methods
      results.getContactMethods = await this.testGetContactMethods();

      // Test deleting a contact method
      results.deleteContactMethod = await this.testDeleteContactMethod();

      // Test validation with invalid data
      results.invalidContactMethods = await this.testInvalidContactMethods();

      // Test unauthorized access
      results.unauthorizedAccess = await this.testUnauthorizedAccess();

      // Test empty contact methods array
      results.emptyContactMethods = await this.testEmptyContactMethods();

    } finally {
      // Always cleanup
      await this.cleanup();
    }

    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const successRate = Math.round((passedTests / totalTests) * 100);

    console.log(`\n🎯 Overall Success Rate: ${passedTests}/${totalTests} (${successRate}%)`);

    if (successRate === 100) {
      console.log('🎉 All tests passed! Shop Contact Methods API is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please check the implementation.');
    }

    return results;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new ShopContactMethodsAPITester();
  tester.runAllTests().then(results => {
    process.exit(Object.values(results).every(Boolean) ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });
}

module.exports = ShopContactMethodsAPITester;

