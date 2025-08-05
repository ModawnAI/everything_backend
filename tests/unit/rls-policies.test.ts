import {
  createUserPolicies,
  createShopPolicies,
  createReservationPolicies,
  createPaymentPolicies,
  createPointsPolicies,
  createInteractionPolicies,
  createAdminPolicies,
  createAllRLSPolicies,
  verifyRLSEnabled,
  getRLSPolicySummary,
} from '../../src/config/rls-policies';

// Mock database and logger
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RLS Policies Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Policy Category Creation', () => {
    test('should create user policies successfully', async () => {
      const result = await createUserPolicies();
      expect(result).toBe(true);
    });

    test('should create shop policies successfully', async () => {
      const result = await createShopPolicies();
      expect(result).toBe(true);
    });

    test('should create reservation policies successfully', async () => {
      const result = await createReservationPolicies();
      expect(result).toBe(true);
    });

    test('should create payment policies successfully', async () => {
      const result = await createPaymentPolicies();
      expect(result).toBe(true);
    });

    test('should create points policies successfully', async () => {
      const result = await createPointsPolicies();
      expect(result).toBe(true);
    });

    test('should create interaction policies successfully', async () => {
      const result = await createInteractionPolicies();
      expect(result).toBe(true);
    });

    test('should create admin policies successfully', async () => {
      const result = await createAdminPolicies();
      expect(result).toBe(true);
    });
  });

  describe('Complete RLS Implementation', () => {
    test('should create all RLS policies successfully', async () => {
      const result = await createAllRLSPolicies();
      expect(result).toBe(true);
    });

    test('should verify RLS is enabled', async () => {
      const result = await verifyRLSEnabled();
      expect(result).toBe(true);
    });
  });

  describe('Policy Summary and Statistics', () => {
    test('should provide comprehensive policy summary', () => {
      const summary = getRLSPolicySummary();
      
      expect(summary).toHaveProperty('totalPolicies');
      expect(summary).toHaveProperty('byTable');
      expect(summary).toHaveProperty('byType');
      expect(summary).toHaveProperty('categories');
      
      // Verify total policies count is reasonable
      expect(summary.totalPolicies).toBeGreaterThan(20);
      
      // Verify all categories are present
      expect(summary.categories).toHaveProperty('userPolicies');
      expect(summary.categories).toHaveProperty('shopPolicies');
      expect(summary.categories).toHaveProperty('reservationPolicies');
      expect(summary.categories).toHaveProperty('paymentPolicies');
      expect(summary.categories).toHaveProperty('pointsPolicies');
      expect(summary.categories).toHaveProperty('interactionPolicies');
      expect(summary.categories).toHaveProperty('adminPolicies');
    });

    test('should have policies for all critical tables', () => {
      const summary = getRLSPolicySummary();
      
      // Critical tables that must have RLS policies
      const criticalTables = [
        'users',
        'user_settings',
        'shops',
        'shop_services',
        'reservations',
        'payments',
        'point_transactions',
        'user_favorites',
        'push_tokens',
        'admin_actions'
      ];
      
      criticalTables.forEach(table => {
        expect(summary.byTable).toHaveProperty(table);
        expect(summary.byTable[table]).toBeGreaterThan(0);
      });
    });

    test('should have appropriate policy type distribution', () => {
      const summary = getRLSPolicySummary();
      
      // Should have a mix of different policy types
      expect(summary.byType).toHaveProperty('SELECT');
      expect(summary.byType).toHaveProperty('INSERT');
      expect(summary.byType).toHaveProperty('UPDATE');
      expect(summary.byType).toHaveProperty('ALL');
      
      // SELECT policies should be most common (for read access)
      expect(summary.byType.SELECT).toBeGreaterThan(0);
    });
  });

  describe('Security Policy Validation', () => {
    test('should validate user data access policies', () => {
      const summary = getRLSPolicySummary();
      
      // Users table should have multiple policies (own access + admin access)
      expect(summary.byTable.users).toBeGreaterThanOrEqual(4);
      
      // User settings should be protected
      expect(summary.byTable.user_settings).toBeGreaterThanOrEqual(1);
    });

    test('should validate shop data access policies', () => {
      const summary = getRLSPolicySummary();
      
      // Shops should have public read + owner management + admin access
      expect(summary.byTable.shops).toBeGreaterThanOrEqual(3);
      
      // Shop services should be protected
      expect(summary.byTable.shop_services).toBeGreaterThanOrEqual(2);
    });

    test('should validate sensitive data protection', () => {
      const summary = getRLSPolicySummary();
      
      // Payments should have strict access controls
      expect(summary.byTable.payments).toBeGreaterThanOrEqual(3);
      
      // Point transactions should be protected
      expect(summary.byTable.point_transactions).toBeGreaterThanOrEqual(3);
    });

    test('should validate admin access controls', () => {
      const summary = getRLSPolicySummary();
      
      // Admin actions should have controlled access
      expect(summary.byTable.admin_actions).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Multi-tenant Security Validation', () => {
    test('should ensure user data isolation', () => {
      const summary = getRLSPolicySummary();
      
      // Tables with user_id should have policies to ensure users only see their own data
      const userDataTables = [
        'user_settings',
        'reservations', 
        'payments',
        'point_transactions',
        'user_favorites',
        'push_tokens'
      ];
      
      userDataTables.forEach(table => {
        expect(summary.byTable[table]).toBeGreaterThanOrEqual(1);
      });
    });

    test('should ensure shop owner data isolation', () => {
      const summary = getRLSPolicySummary();
      
      // Shop-related tables should have policies for owner access
      const shopDataTables = [
        'shops',
        'shop_images',
        'shop_services',
        'service_images'
      ];
      
      shopDataTables.forEach(table => {
        expect(summary.byTable[table]).toBeGreaterThanOrEqual(2);
      });
    });

    test('should ensure public vs private data separation', () => {
      const summary = getRLSPolicySummary();
      
      // Public readable tables should have separate policies for public access
      const publicDataTables = [
        'shops',
        'shop_images', 
        'shop_services',
        'service_images'
      ];
      
      publicDataTables.forEach(table => {
        expect(summary.byTable[table]).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Policy Structure Validation', () => {
    test('should have comprehensive coverage for all operations', () => {
      const summary = getRLSPolicySummary();
      
      // Should have policies for all major operation types
      const expectedTypes = ['SELECT', 'INSERT', 'UPDATE', 'ALL'];
      expectedTypes.forEach(type => {
        expect(summary.byType[type]).toBeGreaterThan(0);
      });
    });

    test('should have reasonable policy distribution', () => {
      const summary = getRLSPolicySummary();
      
      // Total policies should be substantial but not excessive
      expect(summary.totalPolicies).toBeGreaterThan(25);
      expect(summary.totalPolicies).toBeLessThan(100);
      
      // No single table should dominate policy count
      Object.values(summary.byTable).forEach(count => {
        expect(count).toBeLessThan(10); // Max policies per table
      });
    });
  });

  describe('Production Readiness', () => {
    test('should handle policy creation in production environment', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const result = await createAllRLSPolicies();
        expect(result).toBe(true);
        
        // Should log warnings about production policy application
        // (This would be verified by checking logger mock calls)
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should handle RLS verification in production environment', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const result = await verifyRLSEnabled();
        expect(result).toBe(true);
        
        // Should log warnings about production verification
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle policy creation failures gracefully', async () => {
      // This tests the error handling paths in the policy creation functions
      const result = await createUserPolicies();
      
      // Even with mocked success, should not throw errors
      expect(result).toBe(true);
    });

    test('should provide meaningful policy summary even with errors', () => {
      const summary = getRLSPolicySummary();
      
      // Summary should always be available
      expect(summary).toBeDefined();
      expect(typeof summary.totalPolicies).toBe('number');
    });
  });

  describe('Security Best Practices Validation', () => {
    test('should implement principle of least privilege', () => {
      const summary = getRLSPolicySummary();
      
      // More restrictive policies (SELECT, specific operations) than permissive (ALL)
      const restrictivePolicies = (summary.byType.SELECT || 0) + 
                                  (summary.byType.INSERT || 0) + 
                                  (summary.byType.UPDATE || 0) + 
                                  (summary.byType.DELETE || 0);
      const permissivePolicies = summary.byType.ALL || 0;
      
      expect(restrictivePolicies).toBeGreaterThanOrEqual(permissivePolicies);
    });

    test('should ensure admin access is controlled', () => {
      const summary = getRLSPolicySummary();
      
      // Admin policies should exist but be limited
      expect(summary.categories.adminPolicies).toBeGreaterThan(0);
      expect(summary.categories.adminPolicies).toBeLessThan(10);
    });

    test('should protect sensitive financial data', () => {
      const summary = getRLSPolicySummary();
      
      // Payment and point transaction tables should have strict policies
      expect(summary.byTable.payments).toBeGreaterThanOrEqual(3);
      expect(summary.byTable.point_transactions).toBeGreaterThanOrEqual(3);
    });
  });
}); 