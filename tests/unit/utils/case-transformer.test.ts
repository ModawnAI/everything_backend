/**
 * Unit Tests for Case Transformer Utility
 *
 * Tests automatic snake_case ↔ camelCase transformation for API layer
 */

import {
  snakeToCamel,
  camelToSnake,
  transformKeysToCamel,
  transformKeysToSnake,
  transformResponse,
  transformRequest,
} from '../../../src/utils/case-transformer';

describe('Case Transformer Utility', () => {
  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('user_id')).toBe('userId');
      expect(snakeToCamel('shop_id')).toBe('shopId');
      expect(snakeToCamel('reservation_date')).toBe('reservationDate');
      expect(snakeToCamel('total_amount')).toBe('totalAmount');
    });

    it('should handle multiple underscores', () => {
      expect(snakeToCamel('very_long_field_name')).toBe('veryLongFieldName');
      expect(snakeToCamel('my_super_long_variable_name')).toBe('mySuperLongVariableName');
    });

    it('should handle already camelCase strings', () => {
      expect(snakeToCamel('userId')).toBe('userId');
      expect(snakeToCamel('alreadyCamelCase')).toBe('alreadyCamelCase');
    });

    it('should handle strings without underscores', () => {
      expect(snakeToCamel('id')).toBe('id');
      expect(snakeToCamel('name')).toBe('name');
      expect(snakeToCamel('email')).toBe('email');
    });
  });

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('userId')).toBe('user_id');
      expect(camelToSnake('shopId')).toBe('shop_id');
      expect(camelToSnake('reservationDate')).toBe('reservation_date');
      expect(camelToSnake('totalAmount')).toBe('total_amount');
    });

    it('should handle multiple capital letters', () => {
      expect(camelToSnake('veryLongFieldName')).toBe('very_long_field_name');
      expect(camelToSnake('mySuperLongVariableName')).toBe('my_super_long_variable_name');
    });

    it('should handle already snake_case strings', () => {
      expect(camelToSnake('user_id')).toBe('user_id');
      expect(camelToSnake('already_snake_case')).toBe('already_snake_case');
    });

    it('should handle strings without capital letters', () => {
      expect(camelToSnake('id')).toBe('id');
      expect(camelToSnake('name')).toBe('name');
      expect(camelToSnake('email')).toBe('email');
    });
  });

  describe('transformKeysToCamel', () => {
    it('should transform simple object keys', () => {
      const input = {
        user_id: '123',
        shop_id: '456',
        reservation_date: '2025-01-01',
      };

      const expected = {
        userId: '123',
        shopId: '456',
        reservationDate: '2025-01-01',
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it('should transform nested objects', () => {
      const input = {
        user_id: '123',
        user_profile: {
          first_name: 'John',
          last_name: 'Doe',
          phone_number: '010-1234-5678',
        },
      };

      const expected = {
        userId: '123',
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '010-1234-5678',
        },
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it('should transform arrays of objects', () => {
      const input = {
        reservations: [
          { user_id: '123', shop_id: '456' },
          { user_id: '789', shop_id: '012' },
        ],
      };

      const expected = {
        reservations: [
          { userId: '123', shopId: '456' },
          { userId: '789', shopId: '012' },
        ],
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it('should transform deeply nested structures', () => {
      const input = {
        shop_services: [
          {
            service_name: 'Haircut',
            duration_minutes: 30,
            service_images: [
              { image_url: 'https://example.com/1.jpg', is_primary: true },
              { image_url: 'https://example.com/2.jpg', is_primary: false },
            ],
          },
        ],
      };

      const expected = {
        shopServices: [
          {
            serviceName: 'Haircut',
            durationMinutes: 30,
            serviceImages: [
              { imageUrl: 'https://example.com/1.jpg', isPrimary: true },
              { imageUrl: 'https://example.com/2.jpg', isPrimary: false },
            ],
          },
        ],
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it('should preserve excluded fields', () => {
      const input = {
        id: 'res-123',
        email: 'user@example.com',
        name: 'John Doe',
        user_id: '456',
      };

      const expected = {
        id: 'res-123',
        email: 'user@example.com',
        name: 'John Doe',
        userId: '456',
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it('should handle null and undefined values', () => {
      const input = {
        user_id: null,
        shop_id: undefined,
        reservation_date: '2025-01-01',
      };

      const expected = {
        userId: null,
        shopId: undefined,
        reservationDate: '2025-01-01',
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-01-01');
      const input = {
        created_at: date,
        user_id: '123',
      };

      const result = transformKeysToCamel(input);
      expect(result.createdAt).toBe(date);
      expect(result.userId).toBe('123');
    });

    it('should handle empty objects', () => {
      expect(transformKeysToCamel({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(transformKeysToCamel([])).toEqual([]);
    });

    it('should handle primitive values', () => {
      expect(transformKeysToCamel('string')).toBe('string');
      expect(transformKeysToCamel(123)).toBe(123);
      expect(transformKeysToCamel(true)).toBe(true);
      expect(transformKeysToCamel(null)).toBe(null);
      expect(transformKeysToCamel(undefined)).toBe(undefined);
    });
  });

  describe('transformKeysToSnake', () => {
    it('should transform simple object keys', () => {
      const input = {
        userId: '123',
        shopId: '456',
        reservationDate: '2025-01-01',
      };

      const expected = {
        user_id: '123',
        shop_id: '456',
        reservation_date: '2025-01-01',
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });

    it('should transform nested objects', () => {
      const input = {
        userId: '123',
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '010-1234-5678',
        },
      };

      const expected = {
        user_id: '123',
        user_profile: {
          first_name: 'John',
          last_name: 'Doe',
          phone_number: '010-1234-5678',
        },
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });

    it('should transform arrays of objects', () => {
      const input = {
        reservations: [
          { userId: '123', shopId: '456' },
          { userId: '789', shopId: '012' },
        ],
      };

      const expected = {
        reservations: [
          { user_id: '123', shop_id: '456' },
          { user_id: '789', shop_id: '012' },
        ],
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });

    it('should preserve excluded fields', () => {
      const input = {
        id: 'res-123',
        email: 'user@example.com',
        name: 'John Doe',
        userId: '456',
      };

      const expected = {
        id: 'res-123',
        email: 'user@example.com',
        name: 'John Doe',
        user_id: '456',
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });
  });

  describe('transformResponse', () => {
    it('should transform API response with data wrapper', () => {
      const input = {
        success: true,
        data: {
          reservations: [
            {
              id: 'res-123',
              user_id: 'user-456',
              shop_id: 'shop-789',
              reservation_date: '2025-01-01',
              total_amount: 50000,
            },
          ],
        },
      };

      const result = transformResponse(input);

      expect(result.success).toBe(true);
      expect(result.data.reservations[0].userId).toBe('user-456');
      expect(result.data.reservations[0].shopId).toBe('shop-789');
      expect(result.data.reservations[0].reservationDate).toBe('2025-01-01');
      expect(result.data.reservations[0].totalAmount).toBe(50000);
    });

    it('should transform paginated response', () => {
      const input = {
        success: true,
        data: {
          reservations: [
            { user_id: '123', shop_id: '456' },
          ],
          pagination: {
            total_count: 100,
            current_page: 1,
            total_pages: 10,
          },
        },
      };

      const result = transformResponse(input);

      expect(result.data.pagination.totalCount).toBe(100);
      expect(result.data.pagination.currentPage).toBe(1);
      expect(result.data.pagination.totalPages).toBe(10);
    });
  });

  describe('transformRequest', () => {
    it('should transform request body', () => {
      const input = {
        userId: '123',
        shopId: '456',
        reservationDate: '2025-01-01',
        totalAmount: 50000,
      };

      const result = transformRequest(input);

      expect(result.user_id).toBe('123');
      expect(result.shop_id).toBe('456');
      expect(result.reservation_date).toBe('2025-01-01');
      expect(result.total_amount).toBe(50000);
    });
  });

  describe('Real-world API response scenarios', () => {
    it('should handle shop reservations response', () => {
      const input = {
        success: true,
        data: {
          reservations: [
            {
              id: 'res-123',
              user_id: 'user-456',
              shop_id: 'shop-789',
              reservation_date: '2025-01-15',
              reservation_time: '14:00:00',
              status: 'confirmed',
              total_amount: 50000,
              deposit_amount: 10000,
              remaining_amount: 40000,
              points_used: 500,
              points_earned: 250,
              special_requests: 'Window seat please',
              users: {
                id: 'user-456',
                name: 'John Doe',
                email: 'john@example.com',
                phone_number: '010-1234-5678',
              },
              shops: {
                id: 'shop-789',
                name: 'Beauty Salon',
              },
            },
          ],
          pagination: {
            total: 45,
            page: 1,
            limit: 20,
            totalPages: 3,
            hasMore: true,
          },
        },
      };

      const result = transformResponse(input);
      const reservation = result.data.reservations[0];

      // Check transformed fields
      expect(reservation.userId).toBe('user-456');
      expect(reservation.shopId).toBe('shop-789');
      expect(reservation.reservationDate).toBe('2025-01-15');
      expect(reservation.reservationTime).toBe('14:00:00');
      expect(reservation.totalAmount).toBe(50000);
      expect(reservation.depositAmount).toBe(10000);
      expect(reservation.remainingAmount).toBe(40000);
      expect(reservation.pointsUsed).toBe(500);
      expect(reservation.pointsEarned).toBe(250);
      expect(reservation.specialRequests).toBe('Window seat please');

      // Check nested user object
      expect(reservation.users.phoneNumber).toBe('010-1234-5678');

      // Check excluded fields remain unchanged
      expect(reservation.id).toBe('res-123');
      expect(reservation.status).toBe('confirmed');
      expect(reservation.users.name).toBe('John Doe');
      expect(reservation.users.email).toBe('john@example.com');
    });

    it('should handle shop payments response', () => {
      const input = {
        success: true,
        data: {
          payments: [
            {
              id: 'pay-123',
              user_id: 'user-456',
              shop_id: 'shop-789',
              reservation_id: 'res-123',
              payment_method: 'card',
              payment_status: 'completed',
              amount: 50000,
              refund_amount: 0,
              net_amount: 50000,
              created_at: '2025-01-12T10:00:00Z',
              paid_at: '2025-01-12T10:00:05Z',
            },
          ],
          summary: {
            total_amount: 500000,
            total_refunded: 50000,
            net_amount: 450000,
          },
        },
      };

      const result = transformResponse(input);
      const payment = result.data.payments[0];

      expect(payment.userId).toBe('user-456');
      expect(payment.shopId).toBe('shop-789');
      expect(payment.reservationId).toBe('res-123');
      expect(payment.paymentMethod).toBe('card');
      expect(payment.paymentStatus).toBe('completed');
      expect(payment.refundAmount).toBe(0);
      expect(payment.netAmount).toBe(50000);
      expect(payment.createdAt).toBe('2025-01-12T10:00:00Z');
      expect(payment.paidAt).toBe('2025-01-12T10:00:05Z');

      // Check summary
      expect(result.data.summary.totalAmount).toBe(500000);
      expect(result.data.summary.totalRefunded).toBe(50000);
      expect(result.data.summary.netAmount).toBe(450000);
    });

    it('should handle service catalog response', () => {
      const input = {
        success: true,
        data: {
          services: [
            {
              id: 'svc-123',
              shop_id: 'shop-789',
              service_name: 'Premium Haircut',
              duration_minutes: 60,
              price_min: 30000,
              price_max: 50000,
              service_images: [
                'https://example.com/1.jpg',
                'https://example.com/2.jpg',
              ],
              is_available: true,
              created_at: '2025-01-01T00:00:00Z',
            },
          ],
        },
      };

      const result = transformResponse(input);
      const service = result.data.services[0];

      expect(service.shopId).toBe('shop-789');
      expect(service.serviceName).toBe('Premium Haircut');
      expect(service.durationMinutes).toBe(60);
      expect(service.priceMin).toBe(30000);
      expect(service.priceMax).toBe(50000);
      expect(service.serviceImages).toEqual([
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
      ]);
      expect(service.isAvailable).toBe(true);
      expect(service.createdAt).toBe('2025-01-01T00:00:00Z');
    });
  });
});
