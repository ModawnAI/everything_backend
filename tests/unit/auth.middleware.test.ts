import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateJWT,
  optionalAuth,
  requireRole,
  requireVerification,
  extractTokenFromHeader,
  verifySupabaseToken,
  getUserFromToken,
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
  UserNotFoundError,
  type AuthenticatedRequest
} from '../../src/middleware/auth.middleware';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
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

jest.mock('../../src/config/environment', () => ({
  config: {
    auth: {
      jwtSecret: 'test-secret',
      issuer: 'test-supabase',
      audience: 'authenticated',
    }
  }
}));

jest.mock('jsonwebtoken');

describe('Auth Middleware Tests', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn(() => 'test-user-agent')
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
  });

  describe('extractTokenFromHeader', () => {
    test('should extract valid Bearer token', () => {
      const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const token = extractTokenFromHeader(authHeader);
      
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    test('should return null for missing header', () => {
      const token = extractTokenFromHeader(undefined);
      expect(token).toBeNull();
    });

    test('should return null for invalid format', () => {
      const token = extractTokenFromHeader('InvalidFormat token');
      expect(token).toBeNull();
    });

    test('should return null for missing token part', () => {
      const token = extractTokenFromHeader('Bearer');
      expect(token).toBeNull();
    });

    test('should return null for non-Bearer scheme', () => {
      const token = extractTokenFromHeader('Basic dGVzdDp0ZXN0');
      expect(token).toBeNull();
    });

    test('should handle case-insensitive Bearer scheme', () => {
      const token = extractTokenFromHeader('bearer test-token');
      expect(token).toBe('test-token');
    });
  });

  describe('verifySupabaseToken', () => {
    const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

    beforeEach(() => {
      process.env.SUPABASE_JWT_SECRET = 'test-secret';
    });

    test('should verify valid token successfully', async () => {
      const mockPayload = {
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        email: 'test@example.com'
      };

      mockJwtVerify.mockReturnValue(mockPayload);

      const result = await verifySupabaseToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid-token',
        'test-secret',
        {
          issuer: 'test-supabase',
          audience: 'authenticated'
        }
      );
    });

    test('should throw InvalidTokenError for missing JWT secret', async () => {
      delete process.env.SUPABASE_JWT_SECRET;
      require('../../src/config/environment').config.auth.jwtSecret = undefined;

      await expect(verifySupabaseToken('token')).rejects.toThrow(InvalidTokenError);
    });

    test('should throw TokenExpiredError for expired token', async () => {
      mockJwtVerify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(verifySupabaseToken('expired-token')).rejects.toThrow(TokenExpiredError);
    });

    test('should throw InvalidTokenError for malformed token', async () => {
      mockJwtVerify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await expect(verifySupabaseToken('invalid-token')).rejects.toThrow(InvalidTokenError);
    });

    test('should throw InvalidTokenError for token missing user ID', async () => {
      const mockPayload = {
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase'
        // Missing sub field
      };

      mockJwtVerify.mockReturnValue(mockPayload);

      await expect(verifySupabaseToken('token')).rejects.toThrow(InvalidTokenError);
    });

    test('should throw TokenExpiredError for expired timestamp', async () => {
      const mockPayload = {
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        iss: 'test-supabase'
      };

      mockJwtVerify.mockReturnValue(mockPayload);

      await expect(verifySupabaseToken('token')).rejects.toThrow(TokenExpiredError);
    });
  });

  describe('getUserFromToken', () => {
    const mockTokenPayload = {
      sub: 'user-123',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: 'test-supabase',
      email: 'test@example.com'
    };

    test('should fetch user data successfully', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_role: 'user',
        user_status: 'active',
        is_influencer: false,
        phone_verified: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const result = await getUserFromToken(mockTokenPayload);

      expect(result).toEqual(mockUserData);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    test('should throw UserNotFoundError for database error', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(getUserFromToken(mockTokenPayload)).rejects.toThrow(UserNotFoundError);
    });

    test('should throw UserNotFoundError for missing user', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(getUserFromToken(mockTokenPayload)).rejects.toThrow(UserNotFoundError);
    });

    test('should throw AuthenticationError for inactive user', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        user_status: 'suspended' // Not active
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      await expect(getUserFromToken(mockTokenPayload)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('authenticateJWT middleware', () => {
    const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;
    
    beforeEach(() => {
      process.env.SUPABASE_JWT_SECRET = 'test-secret';
    });

    test('should authenticate valid token successfully', async () => {
      const mockPayload = {
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        email: 'test@example.com'
      };

      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_role: 'user',
        user_status: 'active'
      };

      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockJwtVerify.mockReturnValue(mockPayload);
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const middleware = authenticateJWT();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe('user-123');
      expect(mockRequest.token).toBe('valid-token');
    });

    test('should return 401 for missing token', async () => {
      const middleware = authenticateJWT();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Missing authorization token',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 401 for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const middleware = authenticateJWT();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 403 for inactive user', async () => {
      const mockPayload = {
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase'
      };

      const mockUserData = {
        id: 'user-123',
        user_status: 'suspended'
      };

      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockJwtVerify.mockReturnValue(mockPayload);
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const middleware = authenticateJWT();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

    test('should continue without authentication when no token provided', async () => {
      const middleware = optionalAuth();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    test('should authenticate when valid token is provided', async () => {
      const mockPayload = {
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase'
      };

      const mockUserData = {
        id: 'user-123',
        user_role: 'user',
        user_status: 'active'
      };

      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockJwtVerify.mockReturnValue(mockPayload);
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const middleware = optionalAuth();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
    });

    test('should continue without authentication for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const middleware = optionalAuth();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('requireRole middleware', () => {
    test('should allow access for authorized role', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'admin',
        status: 'active',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        sub: 'user-123'
      };

      const middleware = requireRole('admin', 'shop_owner');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access for unauthorized role', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        sub: 'user-123'
      };

      const middleware = requireRole('admin');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this action',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should require authentication first', () => {
      const middleware = requireRole('admin');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireVerification middleware', () => {
    test('should allow access for verified user', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        sub: 'user-123',
        email_confirmed_at: '2023-01-01T00:00:00Z'
      };

      const middleware = requireVerification();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access for unverified user', () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        sub: 'user-123'
        // Missing email_confirmed_at
      };

      const middleware = requireVerification();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should require authentication first', () => {
      const middleware = requireVerification();
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error Classes', () => {
    test('AuthenticationError should have correct properties', () => {
      const error = new AuthenticationError('Test message', 401, 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AuthenticationError');
    });

    test('TokenExpiredError should inherit from AuthenticationError', () => {
      const error = new TokenExpiredError('Custom message');
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Custom message');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('TOKEN_EXPIRED');
      expect(error.name).toBe('TokenExpiredError');
    });

    test('InvalidTokenError should have default message', () => {
      const error = new InvalidTokenError();
      
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('UserNotFoundError should have correct status code', () => {
      const error = new UserNotFoundError();
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete authentication flow', async () => {
      const mockPayload = {
        sub: 'user-123',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'test-supabase',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z'
      };

      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_role: 'admin',
        user_status: 'active'
      };

      mockRequest.headers!.authorization = 'Bearer valid-token';
      
      const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;
      mockJwtVerify.mockReturnValue(mockPayload);
      
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      // Test complete flow with chained middleware
      const authMiddleware = authenticateJWT();
      const roleMiddleware = requireRole('admin');
      const verificationMiddleware = requireVerification();

      // Execute authentication
      await authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset next mock for role check
      mockNext.mockReset();
      
      // Execute role check
      roleMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Reset next mock for verification check
      mockNext.mockReset();
      
      // Execute verification check
      verificationMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Verify user data is properly populated
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe('user-123');
      expect(mockRequest.user!.role).toBe('admin');
      expect(mockRequest.user!.email_confirmed_at).toBe('2023-01-01T00:00:00Z');
      expect(mockRequest.token).toBe('valid-token');
    });

    test('should handle concurrent authentication requests', async () => {
      const requests = Array(10).fill(null).map((_, index) => ({
        headers: { authorization: `Bearer token-${index}` },
        ip: `127.0.0.${index + 1}`,
        get: jest.fn(() => 'test-user-agent')
      }));

      const responses = Array(10).fill(null).map(() => ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      }));

      const nexts = Array(10).fill(null).map(() => jest.fn());

      const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const middleware = authenticateJWT();
      
      // Execute all requests concurrently
      await Promise.all(
        requests.map((req, index) =>
          middleware(req as AuthenticatedRequest, responses[index] as Response, nexts[index])
        )
      );

      // Verify all requests were handled
      responses.forEach(response => {
        expect(response.status).toHaveBeenCalledWith(401);
      });

      nexts.forEach(next => {
        expect(next).not.toHaveBeenCalled();
      });
    });
  });
}); 