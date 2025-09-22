import { PaymentReconciliationService } from '../../src/services/payment-reconciliation.service';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn()
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock the service constructor to use our mock
jest.mock('../../src/services/payment-reconciliation.service', () => {
  const originalModule = jest.requireActual('../../src/services/payment-reconciliation.service');
  return {
    ...originalModule,
    PaymentReconciliationService: class extends originalModule.PaymentReconciliationService {
      constructor() {
        super();
        this.supabase = mockSupabase;
      }
    }
  };
});

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('PaymentReconciliationService - Automated Alerts and Manual Tools', () => {
  let service: PaymentReconciliationService;

  beforeEach(() => {
    service = new PaymentReconciliationService();
    (service as any).logger = mockLogger;
    jest.clearAllMocks();
  });

  describe('createAutomatedAlerts', () => {
    it('should create automated alerts based on thresholds', async () => {
      const reconciliationId = 'reconciliation_123';
      
      // Mock reconciliation record with high discrepancy count
      const mockReconciliation = {
        id: reconciliationId,
        matchedTransactions: 8,
        unmatchedTransactions: 2,
        discrepancyAmount: 150000,
        status: 'pending' as const,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Mock statistics with high counts
      const mockStats = {
        total: 15,
        byType: { missing_transaction: 3 },
        bySeverity: { high: 7 },
        byStatus: { open: 12 },
        openCount: 12,
        resolvedCount: 3,
        ignoredCount: 0
      };

      // Mock service methods
      jest.spyOn(service, 'getReconciliationRecord').mockResolvedValue(mockReconciliation);
      jest.spyOn(service, 'getDiscrepancyStatistics').mockResolvedValue(mockStats);
      jest.spyOn(service, 'getDiscrepancies').mockResolvedValue([]);
      jest.spyOn(service, 'createReconciliationAlert').mockResolvedValue();

      await service.createAutomatedAlerts(reconciliationId);

      // Verify alerts were created for high discrepancy count, critical severity, low match rate, and large discrepancy amount
      expect(service.createReconciliationAlert).toHaveBeenCalledTimes(5);
      expect(service.createReconciliationAlert).toHaveBeenCalledWith(
        reconciliationId,
        'discrepancy',
        'High number of open discrepancies detected: 12',
        'high',
        { discrepancyCount: 12, threshold: 10 }
      );
      expect(service.createReconciliationAlert).toHaveBeenCalledWith(
        reconciliationId,
        'discrepancy',
        'Multiple high-severity discrepancies found: 7',
        'critical',
        { highSeverityCount: 7, threshold: 5 }
      );
      expect(service.createReconciliationAlert).toHaveBeenCalledWith(
        reconciliationId,
        'warning',
        'Low transaction match rate: 80.00%',
        'medium',
        { matchRate: 80, threshold: 90 }
      );
      expect(service.createReconciliationAlert).toHaveBeenCalledWith(
        reconciliationId,
        'discrepancy',
        'Large discrepancy amount detected: 150000 KRW',
        'high',
        { discrepancyAmount: 150000, threshold: 100000 }
      );
      expect(service.createReconciliationAlert).toHaveBeenCalledWith(
        reconciliationId,
        'warning',
        'Missing internal transactions detected: 3',
        'medium',
        { missingTransactionCount: 3 }
      );
    });

    it('should handle errors in automated alerts creation', async () => {
      const reconciliationId = 'reconciliation_123';

      // Mock service method to throw error
      jest.spyOn(service, 'getReconciliationRecord').mockRejectedValue(new Error('Database error'));

      await expect(service.createAutomatedAlerts(reconciliationId)).rejects.toThrow('Database error');
    });
  });

  describe('getManualReconciliationTools', () => {
    it('should get manual reconciliation tools data', async () => {
      const reconciliationId = 'reconciliation_123';
      
      const mockReconciliation = {
        id: reconciliationId,
        settlementId: 'settlement_123',
        status: 'pending' as const,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      const mockSettlement = {
        settlementId: 'settlement_123',
        settlementDate: '2024-01-15',
        totalAmount: 1000000,
        totalCount: 10,
        fees: 29000,
        netAmount: 971000,
        currency: 'KRW',
        status: 'completed' as const,
        transactions: [],
        metadata: {},
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      const mockDiscrepancies = [];
      const mockStats = { 
        total: 0,
        byType: {},
        bySeverity: { high: 0, medium: 0, low: 0 },
        byStatus: { open: 0, resolved: 0, ignored: 0 },
        openCount: 0,
        resolvedCount: 0,
        ignoredCount: 0
      };
      const mockAlerts = [];
      const mockMatches = [];

      // Mock service methods
      jest.spyOn(service, 'getReconciliationRecord').mockResolvedValue(mockReconciliation);
      jest.spyOn(service, 'getSettlementDataById').mockResolvedValue(mockSettlement);
      jest.spyOn(service, 'getDiscrepancies').mockResolvedValue(mockDiscrepancies);
      jest.spyOn(service, 'getDiscrepancyStatistics').mockResolvedValue(mockStats);
      jest.spyOn(service, 'getReconciliationAlerts').mockResolvedValue(mockAlerts);

      // Mock database call for transaction matches
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockMatches, error: null })
        })
      });

      const result = await service.getManualReconciliationTools(reconciliationId);

      expect(result).toBeDefined();
      expect(result.reconciliation).toEqual(mockReconciliation);
      expect(result.settlement).toEqual(mockSettlement);
      expect(result.discrepancies).toEqual(mockDiscrepancies);
      expect(result.statistics).toEqual(mockStats);
      expect(result.alerts).toEqual(mockAlerts);
      expect(result.transactionMatches).toEqual(mockMatches);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle errors in manual reconciliation tools', async () => {
      const reconciliationId = 'reconciliation_123';

      // Mock service method to throw error
      jest.spyOn(service, 'getReconciliationRecord').mockRejectedValue(new Error('Reconciliation not found'));

      await expect(service.getManualReconciliationTools(reconciliationId)).rejects.toThrow('Reconciliation not found');
    });
  });

  describe('manualResolveDiscrepancy', () => {
    it('should manually resolve discrepancy', async () => {
      const discrepancyId = 'discrepancy_123';
      const resolution = 'Test resolution';
      const resolvedBy = 'admin_test';
      const resolutionType = 'resolve';

      // Mock service methods
      jest.spyOn(service, 'resolveDiscrepancy').mockResolvedValue();
      jest.spyOn(service, 'logReconciliationAuditEvent').mockResolvedValue();

      await service.manualResolveDiscrepancy(
        discrepancyId,
        resolution,
        resolvedBy,
        resolutionType
      );

      expect(service.resolveDiscrepancy).toHaveBeenCalledWith(discrepancyId, resolution, resolvedBy);
      expect(service.logReconciliationAuditEvent).toHaveBeenCalledWith(
        discrepancyId,
        'manual_resolve_discrepancy',
        resolvedBy,
        {
          discrepancyId,
          resolution,
          resolutionType,
          metadata: undefined
        }
      );
    });

    it('should manually ignore discrepancy', async () => {
      const discrepancyId = 'discrepancy_123';
      const resolution = 'Test ignore reason';
      const resolvedBy = 'admin_test';
      const resolutionType = 'ignore';

      // Mock service methods
      jest.spyOn(service, 'ignoreDiscrepancy').mockResolvedValue();
      jest.spyOn(service, 'logReconciliationAuditEvent').mockResolvedValue();

      await service.manualResolveDiscrepancy(
        discrepancyId,
        resolution,
        resolvedBy,
        resolutionType
      );

      expect(service.ignoreDiscrepancy).toHaveBeenCalledWith(discrepancyId, resolution, resolvedBy);
      expect(service.logReconciliationAuditEvent).toHaveBeenCalledWith(
        discrepancyId,
        'manual_ignore_discrepancy',
        resolvedBy,
        {
          discrepancyId,
          resolution,
          resolutionType,
          metadata: undefined
        }
      );
    });
  });

  describe('bulkResolveDiscrepancies', () => {
    it('should bulk resolve discrepancies', async () => {
      const discrepancyIds = ['discrepancy_1', 'discrepancy_2', 'discrepancy_3'];
      const resolution = 'Bulk resolution';
      const resolvedBy = 'admin_test';
      const resolutionType = 'resolve';

      // Mock service methods - first two succeed, third fails
      jest.spyOn(service, 'manualResolveDiscrepancy')
        .mockResolvedValueOnce() // discrepancy_1
        .mockResolvedValueOnce() // discrepancy_2
        .mockRejectedValueOnce(new Error('Resolution failed')); // discrepancy_3

      const result = await service.bulkResolveDiscrepancies(
        discrepancyIds,
        resolution,
        resolvedBy,
        resolutionType
      );

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('discrepancy_3');
      expect(result.errors[0]).toContain('Resolution failed');
    });

    it('should handle errors in bulk discrepancy resolution', async () => {
      const discrepancyIds = ['discrepancy_1', 'discrepancy_2'];
      const resolution = 'Test resolution';
      const resolvedBy = 'admin_test';

      // Mock all resolutions to fail
      jest.spyOn(service, 'manualResolveDiscrepancy').mockRejectedValue(new Error('Resolution failed'));

      const result = await service.bulkResolveDiscrepancies(
        discrepancyIds,
        resolution,
        resolvedBy
      );

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Resolution failed');
      expect(result.errors[1]).toContain('Resolution failed');
    });
  });

  describe('forceReconciliationCompletion', () => {
    it('should force reconciliation completion', async () => {
      const reconciliationId = 'reconciliation_123';
      const completedBy = 'admin_test';
      const forceReason = 'Emergency completion required';

      const mockReconciliation = {
        id: reconciliationId,
        status: 'pending' as const,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };

      // Mock service methods
      jest.spyOn(service, 'getReconciliationRecord').mockResolvedValue(mockReconciliation);
      jest.spyOn(service, 'createReconciliationAlert').mockResolvedValue();
      jest.spyOn(service, 'logReconciliationAuditEvent').mockResolvedValue();

      // Mock database update
      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await service.forceReconciliationCompletion(
        reconciliationId,
        completedBy,
        forceReason
      );

      // Verify database update was called
      expect(mockSupabase.from).toHaveBeenCalledWith('reconciliation_records');
      
      // Verify alert was created
      expect(service.createReconciliationAlert).toHaveBeenCalledWith(
        reconciliationId,
        'info',
        `Reconciliation force completed: ${forceReason}`,
        'medium',
        { forceReason, completedBy }
      );

      // Verify audit event was logged
      expect(service.logReconciliationAuditEvent).toHaveBeenCalledWith(
        reconciliationId,
        'force_completion',
        completedBy,
        { forceReason }
      );
    });
  });

  describe('getReconciliationDashboard', () => {
    it('should get reconciliation dashboard data', async () => {
      const mockReconciliations = [
        {
          id: 'reconciliation_1',
          status: 'completed' as const,
          matchedTransactions: 8,
          unmatchedTransactions: 2,
          discrepancyCount: 1,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z'
        },
        {
          id: 'reconciliation_2',
          status: 'pending' as const,
          matchedTransactions: 5,
          unmatchedTransactions: 1,
          discrepancyCount: 0,
          createdAt: '2024-01-14T10:00:00Z',
          updatedAt: '2024-01-14T10:00:00Z'
        }
      ];

      const mockAlerts = [
        {
          id: 'alert_1',
          reconciliation_id: 'reconciliation_1',
          alert_type: 'discrepancy',
          status: 'active'
        }
      ];

      // Mock service methods
      jest.spyOn(service, 'getReconciliationRecords').mockResolvedValue(mockReconciliations);
      jest.spyOn(service, 'getReconciliationAlerts').mockResolvedValue(mockAlerts);
      jest.spyOn(service, 'getDiscrepancies').mockResolvedValue([]);

      const result = await service.getReconciliationDashboard();

      expect(result).toBeDefined();
      expect(result.summary.totalReconciliations).toBe(2);
      expect(result.summary.completedReconciliations).toBe(1);
      expect(result.summary.pendingReconciliations).toBe(1);
      expect(result.summary.failedReconciliations).toBe(0);
      expect(result.summary.totalDiscrepancies).toBe(1);
      expect(result.recentReconciliations).toHaveLength(2);
      expect(result.activeAlerts).toEqual(mockAlerts);
      expect(Array.isArray(result.topDiscrepancies)).toBe(true);
    });
  });

  describe('exportReconciliationData', () => {
    it('should export reconciliation data as JSON', async () => {
      const reconciliationId = 'reconciliation_123';
      const format = 'json';

      const mockToolsData = {
        reconciliation: { id: reconciliationId, status: 'completed' },
        settlement: { settlementId: 'settlement_123' },
        discrepancies: [],
        statistics: { total: 0 },
        transactionMatches: [],
        alerts: [],
        recommendations: ['Test recommendation']
      };

      // Mock service method
      jest.spyOn(service, 'getManualReconciliationTools').mockResolvedValue(mockToolsData);

      const result = await service.exportReconciliationData(reconciliationId, format);

      expect(result).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.data).toHaveProperty('reconciliation');
      expect(result.data).toHaveProperty('settlement');
      expect(result.data).toHaveProperty('discrepancies');
      expect(result.data).toHaveProperty('recommendations');
      expect(result.data).toHaveProperty('exportedAt');
      expect(result.data).toHaveProperty('exportedBy');
    });

    it('should export reconciliation data as CSV', async () => {
      const reconciliationId = 'reconciliation_123';
      const format = 'csv';

      const mockToolsData = {
        reconciliation: { 
          id: reconciliationId, 
          status: 'completed',
          totalSettlementAmount: 1000000
        },
        settlement: { settlementId: 'settlement_123' },
        discrepancies: [
          { id: 'disc_1', status: 'open', expectedValue: 1000, description: 'Test discrepancy' }
        ],
        statistics: { total: 1 },
        transactionMatches: [],
        alerts: [],
        recommendations: ['Test recommendation']
      };

      // Mock service method
      jest.spyOn(service, 'getManualReconciliationTools').mockResolvedValue(mockToolsData);

      const result = await service.exportReconciliationData(reconciliationId, format);

      expect(result).toBeDefined();
      expect(result.format).toBe('csv');
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('Type,ID,Status,Amount,Description');
      expect(result.data).toContain('Reconciliation,reconciliation_123,completed,1000000,Reconciliation Record');
      expect(result.data).toContain('Discrepancy,disc_1,open,1000,Test discrepancy');
    });
  });
});
