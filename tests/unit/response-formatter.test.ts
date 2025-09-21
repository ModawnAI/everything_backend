/**
 * Response Formatter Unit Tests
 * 
 * Comprehensive test suite for the API response standardization utility
 */

import { ResponseFormatter, responseFormatter } from '../../src/utils/response-formatter';
import { Response } from 'express';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/logger');

describe('ResponseFormatter', () => {
  let mockResponse: Partial<Response>;
  let mockRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Express Response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      get: jest.fn(),
      locals: {},
      req: {
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn()
      }
    };

    mockRequest = mockResponse.req;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ResponseFormatter.getInstance();
      const instance2 = ResponseFormatter.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should use the exported singleton instance', () => {
      expect(responseFormatter).toBeInstanceOf(ResponseFormatter);
    });
  });

  describe('Success Responses', () => {
    describe('success', () => {
      it('should send successful response with data', () => {
        const testData = { id: 1, name: 'Test' };
        const testMessage = 'Operation successful';

        responseFormatter.success(mockResponse as Response, testData, testMessage);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: testData,
          message: testMessage,
          timestamp: expect.any(String)
        });
      });

      it('should send successful response without data', () => {
        responseFormatter.success(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          timestamp: expect.any(String)
        });
      });

      it('should include request ID when available', () => {
        mockResponse.locals!.requestId = 'req-123';

        responseFormatter.success(mockResponse as Response, { test: true });

        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: { test: true },
          timestamp: expect.any(String),
          requestId: 'req-123'
        });
      });

      it('should include execution time in metadata', () => {
        mockResponse.locals!.startTime = Date.now() - 100;
        const meta = { page: 1, limit: 10 };

        responseFormatter.success(mockResponse as Response, { test: true }, 'Success', 200, meta);

        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: { test: true },
          message: 'Success',
          timestamp: expect.any(String),
          meta: expect.objectContaining({
            page: 1,
            limit: 10,
            executionTime: expect.any(Number),
            version: '1.0.0'
          })
        });
      });

      it('should log successful response', () => {
        responseFormatter.success(mockResponse as Response, { test: true });

        expect(logger.info).toHaveBeenCalledWith(
          'API Response Success',
          expect.objectContaining({
            statusCode: 200,
            path: '/api/test',
            method: 'GET'
          })
        );
      });
    });

    describe('paginated', () => {
      it('should send paginated response with correct metadata', () => {
        const testData = [{ id: 1 }, { id: 2 }];
        const pagination = {
          page: 1,
          limit: 10,
          total: 25
        };

        responseFormatter.paginated(mockResponse as Response, testData, pagination);

        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: testData,
          timestamp: expect.any(String),
          meta: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasMore: true,
            version: '1.0.0'
          })
        });
      });

      it('should calculate hasMore correctly for last page', () => {
        const testData = [{ id: 1 }];
        const pagination = {
          page: 3,
          limit: 10,
          total: 25
        };

        responseFormatter.paginated(mockResponse as Response, testData, pagination);

        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.meta.hasMore).toBe(false);
      });

      it('should include filters and sort in metadata', () => {
        const testData = [{ id: 1 }];
        const pagination = {
          page: 1,
          limit: 10,
          total: 5,
          filters: { status: 'active' },
          sort: { field: 'created_at', order: 'desc' as const }
        };

        responseFormatter.paginated(mockResponse as Response, testData, pagination);

        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.meta.filters).toEqual({ status: 'active' });
        expect(callArgs.meta.sort).toEqual({ field: 'created_at', order: 'desc' });
      });
    });

    describe('created', () => {
      it('should send 201 status with created message', () => {
        const testData = { id: 1, name: 'New Item' };

        responseFormatter.created(mockResponse as Response, testData);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: testData,
          message: '리소스가 성공적으로 생성되었습니다.',
          timestamp: expect.any(String)
        });
      });

      it('should allow custom created message', () => {
        const customMessage = '사용자가 성공적으로 생성되었습니다.';

        responseFormatter.created(mockResponse as Response, { id: 1 }, customMessage);

        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.message).toBe(customMessage);
      });
    });

    describe('noContent', () => {
      it('should send 204 status with no body', () => {
        responseFormatter.noContent(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(204);
        expect(mockResponse.send).toHaveBeenCalledWith();
      });

      it('should log no content response', () => {
        responseFormatter.noContent(mockResponse as Response);

        expect(logger.info).toHaveBeenCalledWith(
          'API Response No Content',
          expect.objectContaining({
            statusCode: 204,
            path: '/api/test',
            method: 'GET'
          })
        );
      });
    });
  });

  describe('Error Responses', () => {
    describe('error', () => {
      it('should send error response with correct format', () => {
        const code = 'TEST_ERROR';
        const message = 'Test error message';
        const statusCode = 400;

        responseFormatter.error(mockResponse as Response, code, message, statusCode);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code,
            message,
            timestamp: expect.any(String),
            path: '/api/test'
          }
        });
      });

      it('should include request ID when available', () => {
        mockResponse.locals!.requestId = 'req-123';

        responseFormatter.error(mockResponse as Response, 'TEST_ERROR', 'Test message');

        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.requestId).toBe('req-123');
      });

      it('should include details when provided', () => {
        const details = { field: 'email', issue: 'invalid format' };

        responseFormatter.error(mockResponse as Response, 'VALIDATION_ERROR', 'Invalid input', 400, details);

        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.details).toEqual(details);
      });

      it('should include stack trace in development', () => {
        process.env.NODE_ENV = 'development';
        mockResponse.locals!.errorStack = 'Error stack trace';

        responseFormatter.error(mockResponse as Response, 'TEST_ERROR', 'Test message');

        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.stack).toBe('Error stack trace');

        // Reset NODE_ENV
        delete process.env.NODE_ENV;
      });

      it('should log error response', () => {
        responseFormatter.error(mockResponse as Response, 'TEST_ERROR', 'Test message', 500);

        expect(logger.error).toHaveBeenCalledWith(
          'API Response Error',
          expect.objectContaining({
            statusCode: 500,
            errorCode: 'TEST_ERROR',
            message: 'Test message',
            path: '/api/test',
            method: 'GET'
          })
        );
      });
    });

    describe('Specific Error Methods', () => {
      it('should send validation error (400)', () => {
        responseFormatter.validationError(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('VALIDATION_ERROR');
        expect(callArgs.error.message).toBe('입력 데이터가 유효하지 않습니다.');
      });

      it('should send unauthorized error (401)', () => {
        responseFormatter.unauthorized(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('UNAUTHORIZED');
        expect(callArgs.error.message).toBe('인증이 필요합니다.');
      });

      it('should send forbidden error (403)', () => {
        responseFormatter.forbidden(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('FORBIDDEN');
        expect(callArgs.error.message).toBe('접근 권한이 없습니다.');
      });

      it('should send not found error (404)', () => {
        responseFormatter.notFound(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('NOT_FOUND');
        expect(callArgs.error.message).toBe('요청한 리소스를 찾을 수 없습니다.');
      });

      it('should send conflict error (409)', () => {
        const details = { field: 'email', conflict: 'already exists' };
        responseFormatter.conflict(mockResponse as Response, '이메일이 이미 존재합니다.', details);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('CONFLICT');
        expect(callArgs.error.message).toBe('이메일이 이미 존재합니다.');
        expect(callArgs.error.details).toEqual(details);
      });

      it('should send rate limit error (429) with retry header', () => {
        const retryAfter = 60;
        responseFormatter.rateLimitExceeded(mockResponse as Response, '요청이 너무 많습니다.', retryAfter);

        expect(mockResponse.status).toHaveBeenCalledWith(429);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '60');
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(callArgs.error.details.retryAfter).toBe(60);
      });

      it('should send internal server error (500)', () => {
        responseFormatter.internalError(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(callArgs.error.message).toBe('서버 내부 오류가 발생했습니다.');
      });

      it('should send service unavailable error (503)', () => {
        responseFormatter.serviceUnavailable(mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(503);
        const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(callArgs.error.code).toBe('SERVICE_UNAVAILABLE');
        expect(callArgs.error.message).toBe('서비스를 일시적으로 사용할 수 없습니다.');
      });
    });
  });

  describe('Custom Messages', () => {
    it('should allow custom error messages', () => {
      const customMessage = '커스텀 오류 메시지';
      responseFormatter.validationError(mockResponse as Response, customMessage);

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error.message).toBe(customMessage);
    });

    it('should allow custom success messages', () => {
      const customMessage = '커스텀 성공 메시지';
      responseFormatter.success(mockResponse as Response, { test: true }, customMessage);

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.message).toBe(customMessage);
    });
  });

  describe('Response Metadata', () => {
    it('should include version in metadata', () => {
      const meta = { page: 1 };
      responseFormatter.success(mockResponse as Response, { test: true }, 'Success', 200, meta);

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.meta.version).toBe('1.0.0');
    });

    it('should calculate execution time when start time is available', () => {
      const startTime = Date.now() - 150;
      mockResponse.locals!.startTime = startTime;

      responseFormatter.success(mockResponse as Response, { test: true }, 'Success', 200, { page: 1 });

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.meta.executionTime).toBeGreaterThan(100);
      expect(callArgs.meta.executionTime).toBeLessThan(200);
    });
  });

  describe('Timestamp Format', () => {
    it('should use ISO 8601 timestamp format', () => {
      responseFormatter.success(mockResponse as Response, { test: true });

      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      
      // Check if it's a valid ISO 8601 timestamp
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('Data Size Logging', () => {
    it('should log data size for success responses', () => {
      const largeData = { items: new Array(100).fill({ id: 1, name: 'test' }) };
      responseFormatter.success(mockResponse as Response, largeData);

      expect(logger.info).toHaveBeenCalledWith(
        'API Response Success',
        expect.objectContaining({
          dataSize: expect.any(Number)
        })
      );
    });

    it('should handle undefined data size', () => {
      responseFormatter.success(mockResponse as Response);

      expect(logger.info).toHaveBeenCalledWith(
        'API Response Success',
        expect.objectContaining({
          dataSize: 0
        })
      );
    });
  });

  describe('Request Context', () => {
    it('should include user agent in error logs', () => {
      mockRequest.get.mockReturnValue('Mozilla/5.0 Test Browser');

      responseFormatter.error(mockResponse as Response, 'TEST_ERROR', 'Test message');

      expect(logger.error).toHaveBeenCalledWith(
        'API Response Error',
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 Test Browser'
        })
      );
    });

    it('should include IP address in error logs', () => {
      responseFormatter.error(mockResponse as Response, 'TEST_ERROR', 'Test message');

      expect(logger.error).toHaveBeenCalledWith(
        'API Response Error',
        expect.objectContaining({
          ip: '127.0.0.1'
        })
      );
    });
  });
});
