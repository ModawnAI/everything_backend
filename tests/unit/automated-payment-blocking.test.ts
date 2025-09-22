/**
 * Unit Tests for Automated Payment Blocking Service
 * 
 * Tests for automated payment blocking and whitelist/blacklist management including:
 * - Blocking decision engine
 * - Whitelist and blacklist checking
 * - Rule evaluation and condition matching
 * - Blocking analytics and reporting
 * - Override and resolution workflows
 */

import { AutomatedPaymentBlockingService, BlockingRule, WhitelistEntry, BlacklistEntry } from '../../src/services/automated-payment-blocking.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock Supabase client
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AutomatedPaymentBlockingService', () => {
  let service: AutomatedPaymentBlockingService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      data: null,
      error: null,
      count: 0
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    service = new AutomatedPaymentBlockingService();
  });

  describe('makeBlockingDecision', () => {
    it('should allow payment when whitelisted', async () => {
      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 50000,
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 95,
        riskLevel: 'critical' as const,
        detectedRules: [],
        metadata: {}
      };

      // Mock whitelist entry
      const whitelistEntry: WhitelistEntry = {
        id: 'whitelist-1',
        type: 'user',
        value: 'user-123',
        reason: 'VIP customer',
        addedBy: 'admin-1',
        addedAt: new Date().toISOString(),
        isActive: true,
        metadata: {}
      };

      // Mock whitelist check
      jest.spyOn(service as any, 'checkWhitelist').mockResolvedValue({
        isWhitelisted: true,
        entry: whitelistEntry
      });

      const result = await service.makeBlockingDecision(request);

      expect(result.shouldBlock).toBe(false);
      expect(result.blockingReason).toBe('Whitelisted');
      expect(result.blockingRule).toBe('whitelist_check');
      expect(result.actions).toHaveLength(0);
      expect(result.overrideRequired).toBe(false);
      expect(result.reviewRequired).toBe(false);
    });

    it('should block payment when blacklisted', async () => {
      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 50000,
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 50,
        riskLevel: 'low' as const,
        detectedRules: [],
        metadata: {}
      };

      // Mock blacklist entry
      const blacklistEntry: BlacklistEntry = {
        id: 'blacklist-1',
        type: 'user',
        value: 'user-123',
        reason: 'Fraudulent activity',
        addedBy: 'admin-1',
        addedAt: new Date().toISOString(),
        isActive: true,
        severity: 'critical',
        metadata: {}
      };

      // Mock blacklist check
      jest.spyOn(service as any, 'checkBlacklist').mockResolvedValue({
        isBlacklisted: true,
        entry: blacklistEntry
      });

      const result = await service.makeBlockingDecision(request);

      expect(result.shouldBlock).toBe(true);
      expect(result.blockingReason).toContain('Blacklisted');
      expect(result.blockingRule).toBe('blacklist_check');
      expect(result.severity).toBe('critical');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('block_payment');
      expect(result.overrideRequired).toBe(true);
      expect(result.reviewRequired).toBe(true);
    });

    it('should block payment when blocking rule is triggered', async () => {
      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 50000,
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 95,
        riskLevel: 'high' as const,
        detectedRules: [],
        metadata: {}
      };

      // Mock no whitelist/blacklist
      jest.spyOn(service as any, 'checkWhitelist').mockResolvedValue({ isWhitelisted: false });
      jest.spyOn(service as any, 'checkBlacklist').mockResolvedValue({ isBlacklisted: false });

      // Mock blocking rule evaluation
      const mockRule: BlockingRule = {
        id: 'rule-1',
        name: 'High Fraud Score Block',
        description: 'Block high fraud scores',
        type: 'automatic',
        conditions: [{
          field: 'fraud_score',
          operator: 'greater_than',
          value: 90
        }],
        actions: [{
          type: 'block_payment',
          parameters: { reason: 'High fraud score' },
          severity: 'critical',
          message: 'Payment blocked due to high fraud score'
        }],
        priority: 100,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-1',
        metadata: {}
      };

      jest.spyOn(service as any, 'evaluateBlockingRules').mockResolvedValue([{
        rule: mockRule,
        shouldBlock: true,
        reason: 'Rule "High Fraud Score Block" triggered: fraud_score greater_than 90',
        severity: 'critical',
        confidence: 95,
        actions: mockRule.actions,
        triggeredConditions: ['fraud_score greater_than 90']
      }]);

      const result = await service.makeBlockingDecision(request);

      expect(result.shouldBlock).toBe(true);
      expect(result.blockingReason).toContain('High Fraud Score Block');
      expect(result.blockingRule).toBe('rule-1');
      expect(result.severity).toBe('critical');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('block_payment');
    });

    it('should allow payment when no rules are triggered', async () => {
      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 50000,
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 30,
        riskLevel: 'low' as const,
        detectedRules: [],
        metadata: {}
      };

      // Mock no whitelist/blacklist
      jest.spyOn(service as any, 'checkWhitelist').mockResolvedValue({ isWhitelisted: false });
      jest.spyOn(service as any, 'checkBlacklist').mockResolvedValue({ isBlacklisted: false });

      // Mock no rules triggered
      jest.spyOn(service as any, 'evaluateBlockingRules').mockResolvedValue([]);

      const result = await service.makeBlockingDecision(request);

      expect(result.shouldBlock).toBe(false);
      expect(result.blockingReason).toBe('No blocking rules triggered');
      expect(result.blockingRule).toBe('no_rules');
      expect(result.actions).toHaveLength(0);
      expect(result.overrideRequired).toBe(false);
      expect(result.reviewRequired).toBe(false);
    });

    it('should handle system errors gracefully', async () => {
      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 50000,
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 50,
        riskLevel: 'low' as const,
        detectedRules: [],
        metadata: {}
      };

      // Mock system error
      jest.spyOn(service as any, 'checkWhitelist').mockRejectedValue(new Error('Database error'));

      const result = await service.makeBlockingDecision(request);

      expect(result.shouldBlock).toBe(true);
      expect(result.blockingReason).toBe('System error during blocking decision');
      expect(result.blockingRule).toBe('system_error');
      expect(result.severity).toBe('critical');
      expect(result.overrideRequired).toBe(true);
      expect(result.reviewRequired).toBe(true);
    });
  });

  describe('whitelist and blacklist checking', () => {
    it('should check whitelist correctly', async () => {
      const whitelistEntry: WhitelistEntry = {
        id: 'whitelist-1',
        type: 'user',
        value: 'user-123',
        reason: 'VIP customer',
        addedBy: 'admin-1',
        addedAt: new Date().toISOString(),
        isActive: true,
        metadata: {}
      };

      // Mock whitelist data
      service['whitelist'].set('user:user-123', whitelistEntry);

      const result = await service['checkWhitelist']({
        userId: 'user-123',
        ipAddress: '192.168.1.1'
      });

      expect(result.isWhitelisted).toBe(true);
      expect(result.entry).toEqual(whitelistEntry);
    });

    it('should check blacklist correctly', async () => {
      const blacklistEntry: BlacklistEntry = {
        id: 'blacklist-1',
        type: 'ip_address',
        value: '192.168.1.1',
        reason: 'Suspicious activity',
        addedBy: 'admin-1',
        addedAt: new Date().toISOString(),
        isActive: true,
        severity: 'high',
        metadata: {}
      };

      // Mock blacklist data
      service['blacklist'].set('ip_address:192.168.1.1', blacklistEntry);

      const result = await service['checkBlacklist']({
        userId: 'user-123',
        ipAddress: '192.168.1.1'
      });

      expect(result.isBlacklisted).toBe(true);
      expect(result.entry).toEqual(blacklistEntry);
    });

    it('should handle expired whitelist entries', async () => {
      const expiredEntry: WhitelistEntry = {
        id: 'whitelist-1',
        type: 'user',
        value: 'user-123',
        reason: 'VIP customer',
        addedBy: 'admin-1',
        addedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        isActive: true,
        metadata: {}
      };

      service['whitelist'].set('user:user-123', expiredEntry);

      const result = await service['checkWhitelist']({
        userId: 'user-123',
        ipAddress: '192.168.1.1'
      });

      expect(result.isWhitelisted).toBe(false);
    });

    it('should handle inactive blacklist entries', async () => {
      const inactiveEntry: BlacklistEntry = {
        id: 'blacklist-1',
        type: 'ip_address',
        value: '192.168.1.1',
        reason: 'Suspicious activity',
        addedBy: 'admin-1',
        addedAt: new Date().toISOString(),
        isActive: false, // Inactive
        severity: 'high',
        metadata: {}
      };

      service['blacklist'].set('ip_address:192.168.1.1', inactiveEntry);

      const result = await service['checkBlacklist']({
        userId: 'user-123',
        ipAddress: '192.168.1.1'
      });

      expect(result.isBlacklisted).toBe(false);
    });
  });

  describe('rule evaluation', () => {
    it('should evaluate blocking rules correctly', async () => {
      const mockRule: BlockingRule = {
        id: 'rule-1',
        name: 'High Amount Block',
        description: 'Block high amount payments',
        type: 'automatic',
        conditions: [{
          field: 'amount',
          operator: 'greater_than',
          value: 100000
        }],
        actions: [{
          type: 'block_payment',
          parameters: { reason: 'High amount' },
          severity: 'high',
          message: 'Payment blocked due to high amount'
        }],
        priority: 80,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-1',
        metadata: {}
      };

      service['blockingRules'].set('rule-1', mockRule);

      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 150000, // Triggers the rule
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 50,
        riskLevel: 'low' as const,
        detectedRules: [],
        metadata: {}
      };

      const result = await service['evaluateBlockingRules'](request);

      expect(result).toHaveLength(1);
      expect(result[0].rule.id).toBe('rule-1');
      expect(result[0].shouldBlock).toBe(true);
      expect(result[0].reason).toContain('High Amount Block');
      expect(result[0].triggeredConditions).toContain('amount greater_than 100000');
    });

    it('should handle multiple conditions with AND logic', async () => {
      const mockRule: BlockingRule = {
        id: 'rule-1',
        name: 'High Risk User Block',
        description: 'Block high risk users with high amounts',
        type: 'automatic',
        conditions: [
          {
            field: 'fraud_score',
            operator: 'greater_than',
            value: 80
          },
          {
            field: 'amount',
            operator: 'greater_than',
            value: 50000,
            logicalOperator: 'AND'
          }
        ],
        actions: [{
          type: 'block_payment',
          parameters: { reason: 'High risk user with high amount' },
          severity: 'critical',
          message: 'Payment blocked due to high risk user with high amount'
        }],
        priority: 90,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-1',
        metadata: {}
      };

      service['blockingRules'].set('rule-1', mockRule);

      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 60000, // Meets amount condition
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 85, // Meets fraud score condition
        riskLevel: 'high' as const,
        detectedRules: [],
        metadata: {}
      };

      const result = await service['evaluateBlockingRules'](request);

      expect(result).toHaveLength(1);
      expect(result[0].shouldBlock).toBe(true);
      expect(result[0].triggeredConditions).toHaveLength(2);
    });

    it('should handle OR logic correctly', async () => {
      const mockRule: BlockingRule = {
        id: 'rule-1',
        name: 'High Risk OR High Amount',
        description: 'Block if high risk OR high amount',
        type: 'automatic',
        conditions: [
          {
            field: 'fraud_score',
            operator: 'greater_than',
            value: 80
          },
          {
            field: 'amount',
            operator: 'greater_than',
            value: 100000,
            logicalOperator: 'OR'
          }
        ],
        actions: [{
          type: 'block_payment',
          parameters: { reason: 'High risk or high amount' },
          severity: 'high',
          message: 'Payment blocked due to high risk or high amount'
        }],
        priority: 70,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-1',
        metadata: {}
      };

      service['blockingRules'].set('rule-1', mockRule);

      const request = {
        userId: 'user-123',
        paymentId: 'payment-123',
        amount: 50000, // Does not meet amount condition
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        fraudScore: 85, // Meets fraud score condition
        riskLevel: 'high' as const,
        detectedRules: [],
        metadata: {}
      };

      const result = await service['evaluateBlockingRules'](request);

      expect(result).toHaveLength(1);
      expect(result[0].shouldBlock).toBe(true);
      expect(result[0].triggeredConditions).toContain('fraud_score greater_than 80');
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate equals condition correctly', () => {
      expect(service['evaluateCondition']('card', 'equals', 'card')).toBe(true);
      expect(service['evaluateCondition']('card', 'equals', 'bank_transfer')).toBe(false);
    });

    it('should evaluate greater_than condition correctly', () => {
      expect(service['evaluateCondition'](100000, 'greater_than', 50000)).toBe(true);
      expect(service['evaluateCondition'](30000, 'greater_than', 50000)).toBe(false);
    });

    it('should evaluate contains condition correctly', () => {
      expect(service['evaluateCondition']('Mozilla/5.0', 'contains', 'Mozilla')).toBe(true);
      expect(service['evaluateCondition']('Chrome/91.0', 'contains', 'Mozilla')).toBe(false);
    });

    it('should evaluate in condition correctly', () => {
      expect(service['evaluateCondition']('card', 'in', ['card', 'bank_transfer'])).toBe(true);
      expect(service['evaluateCondition']('crypto', 'in', ['card', 'bank_transfer'])).toBe(false);
    });

    it('should evaluate regex condition correctly', () => {
      expect(service['evaluateCondition']('user@example.com', 'regex', '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')).toBe(true);
      expect(service['evaluateCondition']('invalid-email', 'regex', '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      expect(service['evaluateCondition']('test', 'regex', '[invalid')).toBe(false);
    });
  });

  describe('whitelist and blacklist management', () => {
    it('should add entry to whitelist', async () => {
      const entry = {
        type: 'user' as const,
        value: 'user-123',
        reason: 'VIP customer',
        addedBy: 'admin-1',
        isActive: true,
        metadata: {}
      };

      mockSupabase.data = { id: 'whitelist-1' };

      const result = await service.addToWhitelist(entry);

      expect(result).toBe('whitelist-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('whitelist_entries');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should add entry to blacklist', async () => {
      const entry = {
        type: 'ip_address' as const,
        value: '192.168.1.1',
        reason: 'Suspicious activity',
        addedBy: 'admin-1',
        isActive: true,
        severity: 'high' as const,
        metadata: {}
      };

      mockSupabase.data = { id: 'blacklist-1' };

      const result = await service.addToBlacklist(entry);

      expect(result).toBe('blacklist-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('blacklist_entries');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle whitelist addition errors', async () => {
      const entry = {
        type: 'user' as const,
        value: 'user-123',
        reason: 'VIP customer',
        addedBy: 'admin-1',
        isActive: true,
        metadata: {}
      };

      mockSupabase.error = new Error('Database error');

      await expect(service.addToWhitelist(entry)).rejects.toThrow('Database error');
    });

    it('should handle blacklist addition errors', async () => {
      const entry = {
        type: 'ip_address' as const,
        value: '192.168.1.1',
        reason: 'Suspicious activity',
        addedBy: 'admin-1',
        isActive: true,
        severity: 'high' as const,
        metadata: {}
      };

      mockSupabase.error = new Error('Database error');

      await expect(service.addToBlacklist(entry)).rejects.toThrow('Database error');
    });
  });

  describe('analytics', () => {
    it('should get blocking analytics', async () => {
      const mockEvents = [
        { severity: 'critical', blocking_rule: 'rule-1', is_overridden: false, is_resolved: true, created_at: new Date().toISOString(), resolved_at: new Date().toISOString() },
        { severity: 'high', blocking_rule: 'rule-2', is_overridden: true, is_resolved: false, created_at: new Date().toISOString() },
        { severity: 'medium', blocking_rule: 'rule-1', is_overridden: false, is_resolved: true, created_at: new Date().toISOString(), resolved_at: new Date().toISOString() }
      ];

      mockSupabase.data = mockEvents;
      mockSupabase.count = 5; // For whitelist, blacklist, and rules counts

      const result = await service.getBlockingAnalytics('24h');

      expect(result.totalBlocks).toBe(3);
      expect(result.blocksBySeverity.critical).toBe(1);
      expect(result.blocksBySeverity.high).toBe(1);
      expect(result.blocksBySeverity.medium).toBe(1);
      expect(result.blocksByRule['rule-1']).toBe(2);
      expect(result.blocksByRule['rule-2']).toBe(1);
      expect(result.overrideRate).toBe(33.33);
      expect(result.whitelistSize).toBe(5);
      expect(result.blacklistSize).toBe(5);
      expect(result.activeRules).toBe(5);
    });

    it('should handle analytics errors gracefully', async () => {
      mockSupabase.error = new Error('Database error');

      await expect(service.getBlockingAnalytics('24h')).rejects.toThrow('Database error');
    });
  });

  describe('field value mapping', () => {
    it('should map field names correctly', () => {
      const request = {
        fraudScore: 85,
        riskLevel: 'high',
        amount: 100000,
        paymentMethod: 'card',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'fp-123',
        email: 'user@example.com',
        phone: '+1234567890',
        cardNumber: '4111111111111111',
        country: 'US',
        isp: 'Comcast'
      };

      expect(service['getFieldValue'](request, 'fraud_score')).toBe(85);
      expect(service['getFieldValue'](request, 'risk_level')).toBe('high');
      expect(service['getFieldValue'](request, 'amount')).toBe(100000);
      expect(service['getFieldValue'](request, 'payment_method')).toBe('card');
      expect(service['getFieldValue'](request, 'ip_address')).toBe('192.168.1.1');
      expect(service['getFieldValue'](request, 'user_agent')).toBe('Mozilla/5.0');
      expect(service['getFieldValue'](request, 'device_fingerprint')).toBe('fp-123');
      expect(service['getFieldValue'](request, 'email')).toBe('user@example.com');
      expect(service['getFieldValue'](request, 'phone')).toBe('+1234567890');
      expect(service['getFieldValue'](request, 'card_number')).toBe('4111111111111111');
      expect(service['getFieldValue'](request, 'country')).toBe('US');
      expect(service['getFieldValue'](request, 'isp')).toBe('Comcast');
    });

    it('should return undefined for unknown fields', () => {
      const request = { fraudScore: 85 };
      expect(service['getFieldValue'](request, 'unknown_field')).toBeUndefined();
    });
  });

  describe('severity and confidence calculation', () => {
    it('should calculate rule severity correctly', () => {
      const rule: BlockingRule = {
        id: 'rule-1',
        name: 'Test Rule',
        description: 'Test rule',
        type: 'automatic',
        conditions: [],
        actions: [{ type: 'block_payment', parameters: {}, severity: 'high' }],
        priority: 50,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-1',
        metadata: {}
      };

      const request = { fraudScore: 95, riskLevel: 'critical' };
      const severity = service['calculateRuleSeverity'](rule, request);
      expect(severity).toBe('critical');
    });

    it('should calculate rule confidence correctly', () => {
      const rule: BlockingRule = {
        id: 'rule-1',
        name: 'Test Rule',
        description: 'Test rule',
        type: 'automatic',
        conditions: [],
        actions: [{ type: 'block_payment', parameters: {}, severity: 'high' }],
        priority: 50,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-1',
        metadata: {}
      };

      const request = { fraudScore: 85, riskLevel: 'high' };
      const triggeredConditions = ['fraud_score greater_than 80', 'amount greater_than 50000'];
      const confidence = service['calculateRuleConfidence'](rule, request, triggeredConditions);
      
      expect(confidence).toBeGreaterThan(50);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });
});

