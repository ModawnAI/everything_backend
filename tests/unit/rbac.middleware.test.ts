import { Request, Response, NextFunction } from 'express';
import {
  requirePermission,
  requireAnyPermission,
  requireResourceOwnership,
  requireShopOwnership,
  requireAdmin,
  PermissionService,
  permissionService
} from '../../src/middleware/rbac.middleware';
import {
  PERMISSION_MATRIX,
  getPermissionsForRole,
  hasPermission,
  getPermissionConditions
} from '../../src/config/permissions.config';
import {
  PermissionError,
  InsufficientPermissionError,
  AuthorizedRequest,
  UserRole,
  Resource,
  PermissionAction
} from '../../src/types/permissions.types';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn()
    }))
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RBAC Middleware Tests', () => {
  let mockRequest: Partial<AuthorizedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-123',
        role: 'user',
        status: 'active',
        email: 'test@example.com',
        isEmailVerified: true,
        isPaymentVerified: true
      },
      ip: '127.0.0.1',
      get: jest.fn(() => 'test-user-agent'),
      originalUrl: '/api/test',
      method: 'GET',
      params: {},
      query: {},
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup database mock
    const { getSupabaseClient } = require('../../src/config/database');
    mockSupabaseClient = getSupabaseClient();
    const mockSingle = jest.fn();
    const mockEq = jest.fn(() => ({ single: mockSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect, insert: jest.fn() }));
    mockSupabaseClient.from = mockFrom;
  });

  describe('Permission Matrix Configuration', () => {
    test('should have all user roles defined', () => {
      const roles: UserRole[] = ['user', 'shop_owner', 'influencer', 'admin'];
      
      roles.forEach(role => {
        expect(PERMISSION_MATRIX[role]).toBeDefined();
        expect(Array.isArray(PERMISSION_MATRIX[role])).toBe(true);
      });
    });

    test('should have admin with full permissions', () => {
      const adminPermissions = getPermissionsForRole('admin');
      
      // Admin should have the most permissions
      expect(adminPermissions.length).toBeGreaterThan(50);
      
      // Admin should have management permissions for all key resources
      expect(hasPermission('admin', 'users', 'manage')).toBe(true);
      expect(hasPermission('admin', 'shops', 'manage')).toBe(true);
      expect(hasPermission('admin', 'reservations', 'manage')).toBe(true);
      expect(hasPermission('admin', 'payments', 'manage')).toBe(true);
    });

    test('should have proper permission hierarchy', () => {
      const userPerms = getPermissionsForRole('user').length;
      const shopOwnerPerms = getPermissionsForRole('shop_owner').length;
      const influencerPerms = getPermissionsForRole('influencer').length;
      const adminPerms = getPermissionsForRole('admin').length;

      // Shop owners should have more permissions than regular users
      expect(shopOwnerPerms).toBeGreaterThan(userPerms);
      
      // Admin should have the most permissions
      expect(adminPerms).toBeGreaterThan(shopOwnerPerms);
      expect(adminPerms).toBeGreaterThan(influencerPerms);
    });

    test('should have role-appropriate restrictions', () => {
      // Users cannot manage shops
      expect(hasPermission('user', 'shops', 'manage')).toBe(false);
      
      // Shop owners can manage their shops
      expect(hasPermission('shop_owner', 'shops', 'manage')).toBe(true);
      
      // Users cannot access admin actions
      expect(hasPermission('user', 'admin_actions', 'create')).toBe(false);
      
      // Only admin can access system settings
      expect(hasPermission('admin', 'system_settings', 'configure')).toBe(true);
      expect(hasPermission('shop_owner', 'system_settings', 'configure')).toBe(false);
    });

    test('should have proper conditions for sensitive operations', () => {
      // Reservation creation should require verification
      const conditions = getPermissionConditions('user', 'reservations', 'create');
      expect(conditions).toContain('verified_user');
      expect(conditions).toContain('payment_verified');
      
      // Shop service creation should require approval
      const shopServiceConditions = getPermissionConditions('shop_owner', 'shop_services', 'create');
      expect(shopServiceConditions).toContain('approved_shop');
    });
  });

  describe('PermissionService', () => {
    test('should allow admin override', async () => {
      const context = {
        userId: 'admin-123',
        userRole: 'admin' as UserRole,
        userStatus: 'active',
        requestTime: new Date()
      };

      const result = await permissionService.checkPermission(
        context,
        'users',
        'delete',
        { allowSuperAdmin: true }
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Admin override');
    });

    test('should deny permission for insufficient role', async () => {
      const context = {
        userId: 'user-123',
        userRole: 'user' as UserRole,
        userStatus: 'active',
        requestTime: new Date()
      };

      const result = await permissionService.checkPermission(
        context,
        'shops',
        'manage'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not have permission');
      expect(result.missingPermissions).toEqual([{ resource: 'shops', action: 'manage' }]);
    });

    test('should validate active status condition', async () => {
      const context = {
        userId: 'user-123',
        userRole: 'user' as UserRole,
        userStatus: 'suspended',
        requestTime: new Date()
      };

      const result = await permissionService.checkPermission(
        context,
        'shops',
        'read'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('active_status');
    });

    test('should validate user verification condition', async () => {
      const context = {
        userId: 'user-123',
        userRole: 'user' as UserRole,
        userStatus: 'active',
        isEmailVerified: false,
        requestTime: new Date()
      };

      const result = await permissionService.checkPermission(
        context,
        'reviews',
        'create'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('verified_user');
    });

    test('should validate ownership condition', async () => {
      const context = {
        userId: 'user-123',
        userRole: 'user' as UserRole,
        userStatus: 'active',
        resourceId: 'resource-456',
        requestTime: new Date()
      };

      // Mock database response for ownership check
      const mockFrom = mockSupabaseClient.from;
      mockFrom().select().eq().single.mockResolvedValue({
        data: { id: 'user-456' }, // Different owner
        error: null
      });

      const result = await permissionService.checkPermission(
        context,
        'users',
        'update'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('own_resource');
    });

    test('should validate shop access condition', async () => {
      const context = {
        userId: 'shop-owner-123',
        userRole: 'shop_owner' as UserRole,
        userStatus: 'active',
        shopId: 'shop-123',
        resourceId: 'reservation-456',
        requestTime: new Date()
      };

      // Mock database response for shop access check
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { shop_id: 'shop-456' }, // Different shop
        error: null
      });

      const result = await permissionService.checkPermission(
        context,
        'reservations',
        'read'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('same_shop');
    });

    test('should validate business hours condition', async () => {
      const morningTime = new Date();
      morningTime.setHours(8, 0, 0, 0); // 8:00 AM - before business hours

      const context = {
        userId: 'user-123',
        userRole: 'user' as UserRole,
        userStatus: 'active',
        requestTime: morningTime,
        businessHours: { start: '09:00', end: '21:00' }
      };

      const result = await permissionService.checkPermission(
        context,
        'shops',
        'read'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('within_hours');
    });

    test('should allow access during business hours', async () => {
      const businessTime = new Date();
      businessTime.setHours(14, 0, 0, 0); // 2:00 PM - during business hours

      const context = {
        userId: 'user-123',
        userRole: 'user' as UserRole,
        userStatus: 'active',
        requestTime: businessTime,
        businessHours: { start: '09:00', end: '21:00' }
      };

      const result = await permissionService.checkPermission(
        context,
        'shops',
        'read'
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('All conditions satisfied');
    });
  });

  describe('requirePermission middleware', () => {
    test('should allow access with proper permissions', async () => {
      mockRequest.user = {
        id: 'admin-123',
        role: 'admin',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requirePermission({
        resource: 'users',
        action: 'read'
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.permissionContext).toBeDefined();
      expect(mockRequest.permissions).toBeDefined();
    });

    test('should deny access without permission', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requirePermission({
        resource: 'admin_actions',
        action: 'create'
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INSUFFICIENT_PERMISSIONS'
          })
        })
      );
    });

    test('should validate resource ownership', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };
      
      mockRequest.params = { id: 'user-456' };

      // Mock ownership check - user doesn't own resource
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { id: 'user-456' }, // Different user
        error: null
      });

      const middleware = requirePermission({
        resource: 'users',
        action: 'update',
        getResourceId: (req) => req.params?.id
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    test('should handle unauthenticated requests', async () => {
      mockRequest.user = undefined;

      const middleware = requirePermission({
        resource: 'users',
        action: 'read'
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'PERMISSION_DENIED'
          })
        })
      );
    });
  });

  describe('requireAnyPermission middleware', () => {
    test('should allow access if user has any of the required permissions', async () => {
      mockRequest.user = {
        id: 'shop-owner-123',
        role: 'shop_owner',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requireAnyPermission([
        { resource: 'shops', action: 'manage' },
        { resource: 'admin_actions', action: 'create' }
      ]);

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access if user has none of the required permissions', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requireAnyPermission([
        { resource: 'shops', action: 'manage' },
        { resource: 'admin_actions', action: 'create' }
      ]);

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireResourceOwnership middleware', () => {
    test('should allow access for resource owner', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };
      
      mockRequest.params = { id: 'user-123' };

      // Mock ownership check - user owns resource
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { id: 'user-123' }, // Same user
        error: null
      });

      const middleware = requireResourceOwnership('users', (req) => req.params?.id);

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireShopOwnership middleware', () => {
    test('should allow access for shop owner', async () => {
      mockRequest.user = {
        id: 'shop-owner-123',
        role: 'shop_owner',
        status: 'active',
        shopId: 'shop-123',
        isEmailVerified: true
      };
      
      mockRequest.params = { shopId: 'shop-123' };

      const middleware = requireShopOwnership((req) => req.params?.shopId);

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    test('should allow access for admin users', () => {
      mockRequest.user = {
        id: 'admin-123',
        role: 'admin',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requireAdmin();
      middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access for non-admin users', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requireAdmin();
      middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'ADMIN_REQUIRED'
          })
        })
      );
    });

    test('should deny access for unauthenticated requests', () => {
      mockRequest.user = undefined;

      const middleware = requireAdmin();
      middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex permission chains', async () => {
      // Test a shop owner managing their own shop services
      mockRequest.user = {
        id: 'shop-owner-123',
        role: 'shop_owner',
        status: 'active',
        shopId: 'shop-123',
        isEmailVerified: true
      };
      
      mockRequest.params = { serviceId: 'service-456' };

      // Mock shop service ownership check
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { shop_id: 'shop-123' }, // Same shop
        error: null
      });

      const middleware = requirePermission({
        resource: 'shop_services',
        action: 'update',
        getResourceId: (req) => req.params?.serviceId
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.permissionContext).toBeDefined();
      expect(mockRequest.permissionContext?.shopId).toBe('shop-123');
    });

    test('should handle influencer content permissions', async () => {
      mockRequest.user = {
        id: 'influencer-123',
        role: 'influencer',
        status: 'active',
        influencerTier: 'premium',
        isEmailVerified: true
      };

      const middleware = requirePermission({
        resource: 'influencer_content',
        action: 'create'
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should audit permission denials', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requirePermission({
        resource: 'shops',
        action: 'manage'
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      
      // Should have logged the permission denial
      const { logger } = require('../../src/utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Permission check',
        expect.objectContaining({
          allowed: false,
          resource: 'shops',
          action: 'manage'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };
      
      mockRequest.params = { id: 'user-456' };

      // Mock database error
      mockSupabaseClient.from().select().eq().single.mockRejectedValue(new Error('Database error'));

      const middleware = requirePermission({
        resource: 'users',
        action: 'update',
        getResourceId: (req) => req.params?.id
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    test('should handle missing resource ID gracefully', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        isEmailVerified: true
      };

      const middleware = requirePermission({
        resource: 'users',
        action: 'update',
        getResourceId: (req) => undefined // No resource ID
      });

      await middleware(mockRequest as AuthorizedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should pass if no specific resource to check
    });
  });
}); 