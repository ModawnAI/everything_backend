/**
 * Influencer Bonus Service Tests
 * 
 * Comprehensive tests for influencer bonus functionality including:
 * - Bonus calculation and validation
 * - Analytics and reporting
 * - Influencer qualification tracking
 * - Performance metrics
 */

import { InfluencerBonusService } from '../../src/services/influencer-bonus.service';
import { PointTransactionType } from '../../src/types/database.types';

// Mock database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('InfluencerBonusService', () => {
  let influencerBonusService: InfluencerBonusService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Supabase client
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

    // Mock the getSupabaseClient function
    const { getSupabaseClient } = require('../../src/config/database');
    getSupabaseClient.mockReturnValue(mockSupabase);

    // Create service instance
    influencerBonusService = new InfluencerBonusService();
  });

  describe('calculateInfluencerBonus', () => {
    it('should calculate 2x bonus for influencer users', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test Influencer',
        is_influencer: true,
        influencer_qualified_at: '2024-01-01T00:00:00.000Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const result = await influencerBonusService.calculateInfluencerBonus(
        'user-1',
        1000,
        'earned_service'
      );

      expect(result).toEqual({
        totalAmount: 2000,
        baseAmount: 1000,
        bonusAmount: 1000,
        isInfluencer: true,
        bonusMultiplier: 2
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.select).toHaveBeenCalledWith('id, name, is_influencer, influencer_qualified_at');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('should calculate 1x bonus for non-influencer users', async () => {
      const mockUser = {
        id: 'user-2',
        name: 'Regular User',
        is_influencer: false,
        influencer_qualified_at: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      const result = await influencerBonusService.calculateInfluencerBonus(
        'user-2',
        1000,
        'earned_service'
      );

      expect(result).toEqual({
        totalAmount: 1000,
        baseAmount: 1000,
        bonusAmount: 0,
        isInfluencer: false,
        bonusMultiplier: 1
      });
    });

    it('should handle user not found error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      await expect(
        influencerBonusService.calculateInfluencerBonus('user-3', 1000, 'earned_service')
      ).rejects.toThrow('User not found: user-3');
    });
  });

  describe('validateInfluencerBonus', () => {
    it('should validate correct influencer bonus transaction', async () => {
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

      const result = await influencerBonusService.validateInfluencerBonus('user-1', 'transaction-1');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid transaction type', async () => {
      const mockTransaction = {
        id: 'transaction-1',
        user_id: 'user-1',
        transaction_type: 'earned_service',
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

      const result = await influencerBonusService.validateInfluencerBonus('user-1', 'transaction-1');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction type must be influencer_bonus');
    });

    it('should detect bonus amount mismatch', async () => {
      const mockTransaction = {
        id: 'transaction-1',
        user_id: 'user-1',
        transaction_type: 'influencer_bonus',
        amount: 2000,
        status: 'pending',
        metadata: {
          baseAmount: 1000,
          bonusAmount: 500 // Should be 1000 for influencer
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

      const result = await influencerBonusService.validateInfluencerBonus('user-1', 'transaction-1');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bonus amount mismatch: expected 1000, got 500');
    });
  });

  describe('getInfluencerBonusStats', () => {
    it('should return influencer bonus statistics', async () => {
      const mockTransactions = [
        {
          id: 'transaction-1',
          user_id: 'user-1',
          amount: 2000,
          metadata: { bonusAmount: 1000 },
          created_at: '2024-01-01T00:00:00.000Z',
          users: { id: 'user-1', name: 'Influencer 1', is_influencer: true }
        },
        {
          id: 'transaction-2',
          user_id: 'user-2',
          amount: 3000,
          metadata: { bonusAmount: 1500 },
          created_at: '2024-01-02T00:00:00.000Z',
          users: { id: 'user-2', name: 'Influencer 2', is_influencer: true }
        }
      ];

      mockSupabase.lte.mockResolvedValue({
        data: mockTransactions,
        error: null
      });

      const result = await influencerBonusService.getInfluencerBonusStats();

      expect(result.totalInfluencers).toBe(2);
      expect(result.totalBonusPointsAwarded).toBe(2500);
      expect(result.totalBonusTransactions).toBe(2);
      expect(result.averageBonusPerInfluencer).toBe(1250);
      expect(result.topEarningInfluencers).toHaveLength(2);
    });

    it('should handle time range filtering', async () => {
      const timeRange = {
        start: '2024-01-01T00:00:00.000Z',
        end: '2024-01-31T23:59:59.000Z'
      };

      mockSupabase.lte.mockResolvedValue({
        data: [],
        error: null
      });

      await influencerBonusService.getInfluencerBonusStats(timeRange);

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', timeRange.start);
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', timeRange.end);
    });
  });

  describe('getInfluencerBonusAnalytics', () => {
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

      const result = await influencerBonusService.getInfluencerBonusAnalytics('user-1');

      expect(result.influencerId).toBe('user-1');
      expect(result.influencerName).toBe('Test Influencer');
      expect(result.totalBonusPoints).toBe(1000);
      expect(result.totalTransactions).toBe(1);
      expect(result.bonusHistory).toHaveLength(1);
    });

    it('should throw error for non-influencer user', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Regular User',
        is_influencer: false
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      await expect(
        influencerBonusService.getInfluencerBonusAnalytics('user-1')
      ).rejects.toThrow('User is not an influencer: user-1');
    });
  });

  describe('checkInfluencerQualification', () => {
    it('should check qualification based on criteria', async () => {
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

      const criteria = {
        accountAge: 30,
        verificationStatus: true
      };

      const result = await influencerBonusService.checkInfluencerQualification('user-1', criteria);

      expect(result.userId).toBe('user-1');
      expect(result.userName).toBe('Test User');
      expect(result.isQualified).toBe(true);
      expect(result.qualificationScore).toBeGreaterThan(0);
      expect(result.criteriaMet).toContain('Account age: 365 days');
      expect(result.criteriaMet).toContain('Phone verification: Verified');
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

      const result = await influencerBonusService.checkInfluencerQualification('user-1', {});

      expect(result.isQualified).toBe(true);
      expect(result.criteriaMet).toContain('Already qualified as influencer');
      expect(result.qualificationScore).toBe(50);
    });
  });
}); 