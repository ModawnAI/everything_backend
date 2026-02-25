/**
 * Payment Reconciliation Service (Stub)
 *
 * Stub module for the payment reconciliation system.
 * The full implementation is in payment-reconciliation.service.ts.disabled.
 * This stub provides exported types and a class skeleton so that
 * test files referencing this module can compile and be skipped gracefully.
 *
 * TODO: Enable full implementation after payment service changes are finalized.
 */

export interface SettlementData {
  settlementId: string;
  settlementDate: string;
  totalAmount: number;
  totalCount: number;
  fees: number;
  netAmount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactions: SettlementTransaction[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementTransaction {
  transactionId: string;
  paymentId: string;
  amount: number;
  fees: number;
  netAmount: number;
  status: 'success' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod: string;
  cardNumber?: string;
  approvalNumber?: string;
  processedAt: string;
  metadata: Record<string, any>;
}

export interface ReconciliationRecord {
  id: string;
  reconciliationDate: string;
  settlementId: string;
  totalSettlementAmount: number;
  totalInternalAmount: number;
  discrepancyAmount: number;
  discrepancyCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'discrepancy';
  matchedTransactions: number;
  unmatchedTransactions: number;
  discrepancies: ReconciliationDiscrepancy[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
}

export interface ReconciliationDiscrepancy {
  id: string;
  reconciliationId: string;
  type: 'amount_mismatch' | 'missing_transaction' | 'extra_transaction' | 'status_mismatch' | 'fee_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  settlementData: any;
  internalData: any;
  expectedValue: any;
  actualValue: any;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  createdAt: string;
  updatedAt: string;
}

export interface TransactionMatch {
  settlementTransaction: SettlementTransaction;
  internalTransaction: any;
  matchScore: number;
  matchType: 'exact' | 'fuzzy' | 'manual' | 'unmatched';
  confidence: number;
  discrepancies: string[];
  createdAt: string;
}

export interface ReconciliationAlert {
  id: string;
  reconciliationId: string;
  type: 'discrepancy' | 'failure' | 'completion' | 'threshold_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchingResult {
  matches: TransactionMatch[];
  unmatchedSettlement: SettlementTransaction[];
  unmatchedInternal: any[];
  summary: {
    totalSettlement: number;
    totalInternal: number;
    exactMatches: number;
    fuzzyMatches: number;
    manualMatches: number;
    unmatched: number;
    matchRate: number;
  };
}

export interface DiscrepancyStatistics {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  openCount: number;
}

export interface AutoResolutionResult {
  resolved: number;
  ignored: number;
  remaining: number;
}

/**
 * Stub class for PaymentReconciliationService.
 * All methods throw 'Not implemented' errors.
 * Enable the full implementation by replacing this file with the .disabled version.
 */
export class PaymentReconciliationService {

  async fetchSettlementData(_date: string): Promise<SettlementData> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async storeSettlementData(_settlementData: SettlementData): Promise<void> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getSettlementData(_startDate: string, _endDate: string): Promise<SettlementData[]> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getSettlementDataById(_settlementId: string): Promise<SettlementData | null> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getInternalTransactions(_startDate: string, _endDate: string): Promise<any[]> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async createReconciliationRecord(
    _settlementId: string,
    _date?: string,
    _description?: string
  ): Promise<any> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getReconciliationRecord(_reconciliationId: string): Promise<ReconciliationRecord | null> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getReconciliationRecords(_startDate: string, _endDate: string): Promise<ReconciliationRecord[]> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async performTransactionMatching(
    _settlementId: string,
    _reconciliationId: string
  ): Promise<MatchingResult> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async detectDiscrepancies(
    _reconciliationId: string,
    _unmatchedSettlement: SettlementTransaction[],
    _unmatchedInternal: any[]
  ): Promise<ReconciliationDiscrepancy[]> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getDiscrepancies(_reconciliationId: string): Promise<ReconciliationDiscrepancy[]> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async getDiscrepancyStatistics(_reconciliationId: string): Promise<DiscrepancyStatistics> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async resolveDiscrepancy(
    _discrepancyId: string,
    _resolution: string,
    _resolvedBy: string
  ): Promise<void> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async autoResolveDiscrepancies(_reconciliationId: string): Promise<AutoResolutionResult> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }

  async completeReconciliation(
    _reconciliationId: string,
    _completedBy: string,
    _autoResolve?: boolean
  ): Promise<any> {
    throw new Error('PaymentReconciliationService is not implemented. Enable from .disabled file.');
  }
}
