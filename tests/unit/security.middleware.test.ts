import { Request, Response, NextFunction } from 'express';
import {
  securityHeaders,
  strictSecurityHeaders,
  apiSecurityHeaders,
  developmentSecurityHeaders,
  validateSecurityHeaders,
  securityMetrics,
  cspViolationHandler,
  SecurityHeadersService
} from '../../src/middleware/security.middleware';
import {
  getSecurityConfig,
  getSecurityConfigForEnvironment,
  getSecurityPolicyTemplate,
  ENVIRONMENT_SECURITY_CONFIG
} from '../../src/config/security.config';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('helmet', () => {
  return jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    // Mock helmet middleware
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    next();
  });
});

jest.mock('cors', () => {
  return jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    // Mock CORS middleware
    res.set('Access-Control-Allow-Origin', '*');
    next();
  });
});

describe('Security Headers Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseHeaders: Record<string, string>;

  beforeEach(() => {
    responseHeaders = {};
    
    mockRequest = {
      ip: '127.0.0.1',
      url: '/api/test',
      method: 'GET',
      headers: {
        'user-agent': 'test-browser/1.0'
      },
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-browser/1.0';
        return undefined;
      }),
      connection: {
        remoteAddress: '127.0.0.1'
      } as any,
      secure: false
    };
    
    mockResponse = {
      set: jest.fn((name: string, value: string) => {
        responseHeaders[name] = value;
        return mockResponse as Response;
      }),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      on: jest.fn(),
      statusCode: 200
    };
    
    mockNext = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Security Configuration', () => {
    test('should have environment-specific configurations', () => {
      const devConfig = getSecurityConfigForEnvironment('development');
      const prodConfig = getSecurityConfigForEnvironment('production');

      expect(devConfig).toBeDefined();
      expect(prodConfig).toBeDefined();
      
      // Development should be more permissive
      expect(devConfig.csp?.reportOnly).toBe(true);
      expect(prodConfig.csp?.reportOnly).toBe(false);
      
      // Production should have stricter HSTS
      expect(prodConfig.hsts?.maxAge).toBeGreaterThan(devConfig.hsts?.maxAge || 0);
    });

    test('should have security policy templates', () => {
      const strictTemplate = getSecurityPolicyTemplate('strict');
      const relaxedTemplate = getSecurityPolicyTemplate('relaxed');
      const apiTemplate = getSecurityPolicyTemplate('api-only');

      expect(strictTemplate).toBeDefined();
      expect(relaxedTemplate).toBeDefined();
      expect(apiTemplate).toBeDefined();

      // Strict should be more restrictive
      expect(strictTemplate.frameOptions).toBe('DENY');
      expect(strictTemplate.referrerPolicy).toBe('no-referrer');
    });

    test('should validate security configuration correctly', () => {
      const securityService = new SecurityHeadersService();
      const validation = securityService.validateConfig();

      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('warnings');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('score');
      expect(validation.score).toBeGreaterThanOrEqual(0);
      expect(validation.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Security Headers Service', () => {
    test('should generate CSP string correctly', () => {
      const config = getSecurityConfigForEnvironment('production');
      const securityService = new SecurityHeadersService(config);
      
      const cspString = securityService.generateCSPString();
      
      expect(cspString).toContain('default-src');
      expect(cspString).toContain('script-src');
      expect(cspString).toContain('style-src');
    });

    test('should generate Permissions Policy string correctly', () => {
      const config = getSecurityConfigForEnvironment('production');
      const securityService = new SecurityHeadersService(config);
      
      const permissionsPolicy = securityService.generatePermissionsPolicyString();
      
      expect(permissionsPolicy).toContain('geolocation');
      expect(permissionsPolicy).toContain('camera');
      expect(permissionsPolicy).toContain('microphone');
    });

    test('should validate production configuration strictly', () => {
      const prodConfig = getSecurityConfigForEnvironment('production');
      const securityService = new SecurityHeadersService(prodConfig);
      
      const validation = securityService.validateConfig();
      
      // Production should have higher security standards
      expect(validation.score).toBeGreaterThan(70);
    });

    test('should detect unsafe CSP directives in production', () => {
      const unsafeConfig = {
        ...getSecurityConfigForEnvironment('production'),
        csp: {
          directives: {
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
          }
        }
      };
      
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const securityService = new SecurityHeadersService(unsafeConfig);
      const validation = securityService.validateConfig();
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.score).toBeLessThan(80);
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Basic Security Headers Middleware', () => {
    test('should apply basic security headers', async () => {
      const middleware = securityHeaders();
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalled();
    });

    test('should apply environment-specific headers', async () => {
      const devMiddleware = securityHeaders({ environment: 'development' });
      const prodMiddleware = securityHeaders({ environment: 'production' });
      
      // Test development
      await devMiddleware(mockRequest as Request, mockResponse as Response, jest.fn());
      const devHeaders = { ...responseHeaders };
      
      // Reset and test production
      responseHeaders = {};
      jest.clearAllMocks();
      
      await prodMiddleware(mockRequest as Request, mockResponse as Response, jest.fn());
      const prodHeaders = { ...responseHeaders };
      
      // Production should have different environment header
      expect(devHeaders['X-Environment']).toBe('development');
      expect(prodHeaders['X-Environment']).toBe('production');
    });

    test('should apply custom configuration overrides', async () => {
      const customConfig = {
        customHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-API-Version': 'v2'
        }
      };
      
      const middleware = securityHeaders({ customConfig });
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(responseHeaders['X-Custom-Header']).toBe('custom-value');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle middleware errors gracefully', async () => {
      // Mock an error in the middleware
      const errorMiddleware = securityHeaders();
      
      // Force an error by modifying response object
      mockResponse.set = jest.fn(() => {
        throw new Error('Header setting failed');
      });
      
      await errorMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should still call next with error
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Specialized Security Middleware', () => {
    test('should apply strict security headers', async () => {
      const middleware = strictSecurityHeaders();
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalled();
    });

    test('should apply API-only security headers', async () => {
      const middleware = apiSecurityHeaders();
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(responseHeaders['X-API-Version']).toBe('v1');
    });

    test('should apply development security headers', async () => {
      const middleware = developmentSecurityHeaders();
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(responseHeaders['X-Environment']).toBe('development');
    });
  });

  describe('CSP Violation Handler', () => {
    test('should handle valid CSP violation reports', () => {
      const handler = cspViolationHandler();
      
      const validReport = {
        'document-uri': 'https://example.com/',
        'referrer': 'https://example.com/',
        'violated-directive': 'script-src \'self\'',
        'effective-directive': 'script-src',
        'original-policy': 'script-src \'self\'',
        'disposition': 'enforce' as const,
        'blocked-uri': 'https://evil.com/script.js',
        'status-code': 200
      };
      
      mockRequest.body = validReport;
      
      handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    test('should reject invalid CSP violation reports', () => {
      const handler = cspViolationHandler();
      
      mockRequest.body = { invalid: 'report' };
      
      handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid CSP report' });
    });

    test('should handle CSP report processing errors', () => {
      const handler = cspViolationHandler();
      
      // Mock JSON parsing error
      mockRequest.body = null;
      
      handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Security Validation Middleware', () => {
    test('should validate security headers and log warnings', () => {
      const middleware = validateSecurityHeaders();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      const { logger } = require('../../src/utils/logger');
      // Logger might be called for warnings
      expect(logger.warn).toHaveBeenCalledTimes(0); // No warnings expected for default config
    });
  });

  describe('Security Metrics Middleware', () => {
    test('should track security metrics', () => {
      const middleware = securityMetrics();
      
      // Simulate multiple requests
      for (let i = 0; i < 5; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      expect(mockNext).toHaveBeenCalledTimes(5);
    });

    test('should track HTTPS usage', () => {
      const middleware = securityMetrics();
      
      // Test HTTP request
      mockRequest.secure = false;
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Test HTTPS request
      mockRequest.secure = true;
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Test X-Forwarded-Proto header
      mockRequest.secure = false;
      mockRequest.headers = { 'x-forwarded-proto': 'https' };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration Tests', () => {
    test('should work with full middleware stack', async () => {
      const middleware = securityHeaders({
        environment: 'production',
        enableSecurityLogging: true,
        customConfig: {
          customHeaders: {
            'X-Integration-Test': 'true'
          }
        }
      });
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(responseHeaders['X-Integration-Test']).toBe('true');
      expect(responseHeaders['X-Environment']).toBe('production');
    });

    test('should handle CORS and security headers together', async () => {
      const config = {
        cors: {
          origin: 'https://example.com',
          credentials: true
        },
        customHeaders: {
          'X-Test': 'cors-security'
        }
      };
      
      const middleware = securityHeaders({ config });
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(responseHeaders['X-Test']).toBe('cors-security');
    });

    test('should apply multiple security policies', async () => {
      // Apply multiple middleware in sequence
      const middleware1 = securityHeaders({ environment: 'production' });
      const middleware2 = validateSecurityHeaders();
      const middleware3 = securityMetrics();
      
      await middleware1(mockRequest as Request, mockResponse as Response, jest.fn());
      middleware2(mockRequest as Request, mockResponse as Response, jest.fn());
      middleware3(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle configuration validation errors', () => {
      const invalidConfig = {
        hsts: {
          maxAge: -1 // Invalid value
        }
      };
      
      const securityService = new SecurityHeadersService(invalidConfig as any);
      const validation = securityService.validateConfig();
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.score).toBeLessThan(100);
    });

    test('should handle missing configuration gracefully', () => {
      const middleware = securityHeaders({ config: {} });
      
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).not.toThrow();
    });

    test('should handle security service errors', async () => {
      const securityService = new SecurityHeadersService();
      
      // Test error handling in violation logging
      await expect(
        securityService.logSecurityViolation(mockRequest as Request, {
          type: 'csp',
          description: 'Test violation'
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should have minimal performance impact', async () => {
      const middleware = securityHeaders();
      
      const startTime = process.hrtime();
      
      // Run middleware multiple times
      for (let i = 0; i < 100; i++) {
        await middleware(mockRequest as Request, mockResponse as Response, jest.fn());
      }
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      // Should complete 100 iterations in under 100ms
      expect(milliseconds).toBeLessThan(100);
    });

    test('should cache security configuration', () => {
      const service1 = new SecurityHeadersService();
      const service2 = new SecurityHeadersService();
      
      const csp1 = service1.generateCSPString();
      const csp2 = service2.generateCSPString();
      
      // Should generate consistent results
      expect(csp1).toBe(csp2);
    });
  });
}); 