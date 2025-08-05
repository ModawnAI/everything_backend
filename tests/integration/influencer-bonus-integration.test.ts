/**
 * Influencer Bonus Integration Tests
 * 
 * Integration tests for influencer bonus system including:
 * - API endpoint testing
 * - Database integration
 * - End-to-end bonus calculation flow
 * - Analytics and reporting endpoints
 */

import request from 'supertest';
import app from '../../src/app';
import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

// Mock database and logger for integration tests
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

describe('Influencer Bonus Integration Tests', () => {
  let mockSupabase: any;
  let adminToken: string;
  let influencerToken: string;
  let regularUserToken: string;

  beforeAll(async () => {
    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis()
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock authentication tokens
    adminToken = 'mock-admin-token';
    influencerToken = 'mock-influencer-token';
    regularUserToken = 'mock-regular-user-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/influencer-bonus/stats', () => {
    it('should return influencer bonus statistics', async () => {
      const mockStats = {
        totalInfluencers: 5,
        totalBonusPointsAwarded: 15000,
        totalBonusTransactions: 25,
        averageBonusPerInfluencer: 3000,
        topEarningInfluencers: [
          {
            userId: 'user-1',
            userName: 'Top Influencer',
            totalBonusPoints: 5000,
            totalTransactions: 10,
            averageBonusPerTransaction: 500
          }
        ],
        monthlyTrends: [
          {
            month: '2024-01',
            totalBonusPoints: 5000,
            totalTransactions: 10,
            activeInfluencers: 3
          }
        ],
        bonusDistribution: {
          smallBonus: 10,
          mediumBonus: 10,
          largeBonus: 5
        }
      };

      mockSupabase.lte.mockResolvedValue({
        data: [
          {
            id: 'transaction-1',
            user_id: 'user-1',
            amount: 2000,
            metadata: { bonusAmount: 1000 },
            created_at: '2024-01-01T00:00:00.000Z',
            users: { id: 'user-1', name: 'Top Influencer', is_influencer: true }
          }
        ],
        error: null
      });

      const response = await request(app)
        .get('/api/admin/influencer-bonus/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalInfluencers).toBe(1);
      expect(response.body.data.totalBonusPointsAwarded).toBe(1000);
    });

    it('should handle time range filtering', async () => {
      mockSupabase.lte.mockResolvedValue({
        data: [],
        error: null
      });

      const response = await request(app)
        .get('/api/admin/influencer-bonus/stats?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-01-31');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/influencer-bonus/stats')
        .expect(401);
    });
  });

  describe('GET /api/admin/influencer-bonus/analytics/:influencerId', () => {
    it('should return detailed analytics for specific influencer', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test Influencer',
        is_influencer: true,
        influencer_qualified_at: '2024-01-01T00:00:00.000Z'
      };

      const mockTransactions = [
        {
          id: 'transaction-1',
          user_id: 'user-1',
          amount: 2000,
          description: 'Service bonus',
          status: 'available',
          created_at: '2024-01-01T00:00:00.000Z',
          metadata: { baseAmount: 1000, bonusAmount: 1000 }
        }
      ];

      mockSupabase.single
        .mockResolvedValueOnce({
          data: mockUser,
          error: null
        })
        .mockResolvedValueOnce({
          data: mockTransactions,
          error: null
        });

      const response = await request(app)
        .get('/api/admin/influencer-bonus/analytics/user-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.influencerId).toBe('user-1');
      expect(response.body.data.influencerName).toBe('Test Influencer');
      expect(response.body.data.totalBonusPoints).toBe(1000);
    });

    it('should handle non-influencer user error', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Regular User',
        is_influencer: false
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const response = await request(app)
        .get('/api/admin/influencer-bonus/analytics/user-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('인플루언서 보너스 분석 조회 중 오류가 발생했습니다.');
    });
  });

  describe('POST /api/admin/influencer-bonus/validate/:transactionId', () => {
    it('should validate influencer bonus transaction', async () => {
      const mockTransaction = {
        id: 'transaction-1',
        user_id: 'user-1',
        transaction_type: 'influencer_bonus',
        amount: 2000,
        status: 'pending',
        metadata: {
          baseAmount: 1000,
          bonusAmount: 1000,
          isInfluencer: true
        }
      };

      const mockUser = {
        id: 'user-1',
        name: 'Test Influencer',
        is_influencer: true,
        influencer_qualified_at: '2024-01-01T00:00:00.000Z'
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: mockTransaction,
          error: null
        })
        .mockResolvedValueOnce({
          data: mockUser,
          error: null
        });

      const response = await request(app)
        .post('/api/admin/influencer-bonus/validate/transaction-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'user-1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should detect validation errors', async () => {
      const mockTransaction = {
        id: 'transaction-1',
        user_id: 'user-1',
        transaction_type: 'earned_service', // Wrong type
        amount: 2000,
        status: 'pending',
        metadata: {
          baseAmount: 1000,
          bonusAmount: 1000
        }
      };

      const mockUser = {
        id: 'user-1',
        name: 'Test Influencer',
        is_influencer: true
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: mockTransaction,
          error: null
        })
        .mockResolvedValueOnce({
          data: mockUser,
          error: null
        });

      const response = await request(app)
        .post('/api/admin/influencer-bonus/validate/transaction-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'user-1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors).toContain('Transaction type must be influencer_bonus');
    });

    it('should require userId in request body', async () => {
      const response = await request(app)
        .post('/api/admin/influencer-bonus/validate/transaction-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_USER_ID');
    });
  });

  describe('POST /api/admin/influencer-bonus/check-qualification', () => {
    it('should check influencer qualification', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        is_influencer: false,
        user_status: 'active',
        phone_verified: true,
        created_at: '2023-01-01T00:00:00.000Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const response = await request(app)
        .post('/api/admin/influencer-bonus/check-qualification')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-1',
          criteria: {
            accountAge: 30,
            verificationStatus: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user-1');
      expect(response.body.data.isQualified).toBe(true);
      expect(response.body.data.qualificationScore).toBeGreaterThan(0);
    });

    it('should handle already qualified influencer', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test Influencer',
        is_influencer: true,
        influencer_qualified_at: '2024-01-01T00:00:00.000Z',
        user_status: 'active'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const response = await request(app)
        .post('/api/admin/influencer-bonus/check-qualification')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-1',
          criteria: {}
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isQualified).toBe(true);
      expect(response.body.data.criteriaMet).toContain('Already qualified as influencer');
    });

    it('should require userId in request body', async () => {
      const response = await request(app)
        .post('/api/admin/influencer-bonus/check-qualification')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          criteria: {}
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_USER_ID');
    });
  });

  describe('Integration with Point System', () => {
    it('should integrate with point earning flow', async () => {
      // Mock user data
      const mockUser = {
        id: 'user-1',
        name: 'Test Influencer',
        is_influencer: true,
        influencer_qualified_at: '2024-01-01T00:00:00.000Z'
      };

      // Mock point transaction creation
      const mockTransaction = {
        id: 'transaction-1',
        user_id: 'user-1',
        transaction_type: 'influencer_bonus',
        amount: 2000,
        status: 'pending',
        description: '인플루언서 보너스',
        available_from: '2024-01-08T00:00:00.000Z',
        expires_at: '2025-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        metadata: {
          source: 'influencer_bonus',
          baseAmount: 1000,
          bonusAmount: 1000,
          isInfluencer: true
        }
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      mockSupabase.insert.mockResolvedValue({
        data: mockTransaction,
        error: null
      });

      // Test point earning with influencer bonus
      const response = await request(app)
        .post('/api/points/earn')
        .set('Authorization', `Bearer ${influencerToken}`)
        .send({
          userId: 'user-1',
          transactionType: 'influencer_bonus',
          amount: 1000,
          description: '인플루언서 보너스'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(2000); // 2x bonus
      expect(response.body.data.transactionType).toBe('influencer_bonus');
      expect(response.body.data.metadata.isInfluencer).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.lte.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .get('/api/admin/influencer-bonus/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INFLUENCER_BONUS_STATS_ERROR');
    });

    it('should handle missing transaction errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Transaction not found' }
      });

      const response = await request(app)
        .post('/api/admin/influencer-bonus/validate/transaction-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'user-1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors).toContain('Transaction not found: transaction-1');
    });
  });
}); 