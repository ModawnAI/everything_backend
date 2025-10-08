import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { portOneService } from '../services/portone.service';
import { fraudDetectionService } from '../services/fraud-detection.service';
import { webhookSecurityService } from '../services/webhook-security.service';

/**
 * Enhanced Admin Payment Management Controller
 *
 * Comprehensive payment management system including:
 * - Gateway configuration and health monitoring
 * - Real-time payment monitoring
 * - Webhook management and debugging
 * - Fraud detection and prevention
 * - Dispute and chargeback handling
 * - Batch operations for efficiency
 */
export class AdminPaymentManagementController {
  private supabase = getSupabaseClient();

  /**
   * GET /api/admin/payments/gateway/config
   * Get payment gateway configuration and status
   */
  async getGatewayConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      // Get gateway configuration from environment
      const gatewayConfig = {
        provider: 'PortOne',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
        version: '1.0',
        features: {
          creditCard: true,
          bankTransfer: true,
          virtualAccount: true,
          mobilePayment: true,
          internationalCards: true,
          recurringPayments: true,
          partialRefunds: true,
          webhooks: true
        },
        limits: {
          maxTransactionAmount: 10000000, // 10M KRW
          minTransactionAmount: 100,
          dailyTransactionLimit: 100000000, // 100M KRW
          monthlyTransactionLimit: 3000000000 // 3B KRW
        },
        fees: {
          creditCard: 2.9, // percentage
          bankTransfer: 1.5,
          virtualAccount: 1.0,
          mobilePayment: 3.2
        },
        webhookEndpoint: `${process.env.BASE_URL}/api/webhooks/payments`,
        apiStatus: 'operational',
        lastHealthCheck: new Date().toISOString()
      };

      // Check gateway health
      const healthStatus = await this.checkGatewayHealth();

      res.json({
        success: true,
        data: {
          configuration: gatewayConfig,
          health: healthStatus,
          metadata: {
            lastUpdated: new Date().toISOString(),
            retrievedBy: adminId
          }
        },
        message: '게이트웨이 구성 정보를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting gateway config:', error);
      res.status(500).json({
        success: false,
        error: 'GATEWAY_5001',
        message: '게이트웨이 구성 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * POST /api/admin/payments/gateway/test
   * Test payment gateway connectivity and functionality
   */
  async testGateway(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      const testResults = {
        connectivity: false,
        authentication: false,
        paymentInitiation: false,
        webhookDelivery: false,
        refundCapability: false,
        responseTime: 0
      };

      const startTime = Date.now();

      // Test connectivity
      try {
        const response = await fetch('https://api.iamport.kr/v2/payments', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.PORTONE_API_KEY}`
          }
        });
        testResults.connectivity = response.ok;
        testResults.authentication = response.status !== 401;
      } catch (error) {
        testResults.connectivity = false;
      }

      testResults.responseTime = Date.now() - startTime;

      // Log test results
      await this.supabase
        .from('payment_gateway_tests')
        .insert({
          admin_id: adminId,
          test_type: 'full_test',
          results: testResults,
          tested_at: new Date().toISOString()
        });

      res.json({
        success: true,
        data: {
          testResults,
          timestamp: new Date().toISOString(),
          performedBy: adminId
        },
        message: '게이트웨이 테스트를 완료했습니다.'
      });

    } catch (error) {
      logger.error('Error testing gateway:', error);
      res.status(500).json({
        success: false,
        error: 'GATEWAY_5002',
        message: '게이트웨이 테스트 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * GET /api/admin/payments/monitoring/realtime
   * Get real-time payment monitoring dashboard data
   */
  async getRealtimeMonitoring(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      const timeRange = req.query.range || '1h'; // 1h, 6h, 24h, 7d
      const now = new Date();
      const startTime = this.getStartTime(now, timeRange as string);

      // Get real-time metrics
      const { data: recentPayments } = await this.supabase
        .from('payments')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      // Calculate metrics
      const metrics = {
        totalTransactions: recentPayments?.length || 0,
        successfulPayments: recentPayments?.filter(p => p.payment_status === 'fully_paid' || p.payment_status === 'deposit_paid').length || 0,
        failedPayments: recentPayments?.filter(p => p.payment_status === 'failed').length || 0,
        pendingPayments: recentPayments?.filter(p => p.payment_status === 'pending').length || 0,
        totalVolume: recentPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        averageTransactionValue: 0,
        successRate: 0,
        failureRate: 0
      };

      if (metrics.totalTransactions > 0) {
        metrics.averageTransactionValue = metrics.totalVolume / metrics.totalTransactions;
        metrics.successRate = (metrics.successfulPayments / metrics.totalTransactions) * 100;
        metrics.failureRate = (metrics.failedPayments / metrics.totalTransactions) * 100;
      }

      // Get payment velocity (transactions per minute)
      const timeRangeMinutes = this.getTimeRangeMinutes(timeRange as string);
      const transactionsPerMinute = metrics.totalTransactions / timeRangeMinutes;

      // Get suspicious activities
      const suspiciousActivities = await fraudDetectionService.getRecentSuspiciousActivities(startTime);

      res.json({
        success: true,
        data: {
          metrics,
          velocity: {
            transactionsPerMinute,
            peakHour: this.findPeakHour(recentPayments || []),
            trend: this.calculateTrend(recentPayments || [])
          },
          recentTransactions: recentPayments?.slice(0, 20).map(p => ({
            id: p.id,
            amount: p.amount,
            status: p.payment_status,
            method: p.payment_method,
            createdAt: p.created_at,
            userId: p.user_id,
            reservationId: p.reservation_id
          })),
          suspiciousActivities: suspiciousActivities.slice(0, 10),
          timeRange,
          lastUpdated: new Date().toISOString()
        },
        message: '실시간 모니터링 데이터를 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting realtime monitoring:', error);
      res.status(500).json({
        success: false,
        error: 'MONITOR_5001',
        message: '실시간 모니터링 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * GET /api/admin/payments/webhooks
   * Get webhook history and status
   */
  async getWebhooks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = this.supabase
        .from('webhook_logs')
        .select('*', { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }
      if (startDate) {
        query = query.gte('received_at', startDate);
      }
      if (endDate) {
        query = query.lte('received_at', endDate);
      }

      const { data: webhooks, count } = await query
        .order('received_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      // Get webhook statistics
      const { data: stats } = await this.supabase
        .from('webhook_logs')
        .select('status')
        .gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const statistics = {
        total: stats?.length || 0,
        successful: stats?.filter(s => s.status === 'processed').length || 0,
        failed: stats?.filter(s => s.status === 'failed').length || 0,
        pending: stats?.filter(s => s.status === 'pending').length || 0,
        retried: stats?.filter(s => s.status === 'retried').length || 0
      };

      res.json({
        success: true,
        data: {
          webhooks: webhooks || [],
          statistics,
          pagination: {
            total: count || 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil((count || 0) / Number(limit))
          }
        },
        message: '웹훅 히스토리를 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting webhooks:', error);
      res.status(500).json({
        success: false,
        error: 'WEBHOOK_5001',
        message: '웹훅 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * POST /api/admin/payments/webhooks/:webhookId/retry
   * Retry a failed webhook
   */
  async retryWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { webhookId } = req.params;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      // Get webhook details
      const { data: webhook } = await this.supabase
        .from('webhook_logs')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (!webhook) {
        res.status(404).json({
          success: false,
          error: 'WEBHOOK_4001',
          message: '웹훅을 찾을 수 없습니다.'
        });
        return;
      }

      // Retry webhook processing
      const result = await webhookSecurityService.retryWebhook(webhook);

      res.json({
        success: true,
        data: {
          webhookId,
          retryResult: result,
          retriedBy: adminId,
          retriedAt: new Date().toISOString()
        },
        message: '웹훅 재시도를 완료했습니다.'
      });

    } catch (error) {
      logger.error('Error retrying webhook:', error);
      res.status(500).json({
        success: false,
        error: 'WEBHOOK_5002',
        message: '웹훅 재시도 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * GET /api/admin/payments/fraud
   * Get fraud detection alerts and statistics
   */
  async getFraudAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      const { severity, status, startDate, endDate } = req.query;

      // Get fraud alerts
      let query = this.supabase
        .from('fraud_detection_alerts')
        .select('*, payments!inner(*)');

      if (severity) {
        query = query.eq('severity', severity);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (startDate) {
        query = query.gte('detected_at', startDate);
      }
      if (endDate) {
        query = query.lte('detected_at', endDate);
      }

      const { data: alerts } = await query
        .order('detected_at', { ascending: false })
        .limit(100);

      // Get fraud statistics
      const fraudStats = await fraudDetectionService.getFraudStatistics();

      res.json({
        success: true,
        data: {
          alerts: alerts || [],
          statistics: fraudStats,
          riskLevels: {
            high: alerts?.filter((a: any) => a.severity === 'high').length || 0,
            medium: alerts?.filter((a: any) => a.severity === 'medium').length || 0,
            low: alerts?.filter((a: any) => a.severity === 'low').length || 0
          },
          lastUpdated: new Date().toISOString()
        },
        message: '사기 탐지 알림을 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting fraud alerts:', error);
      res.status(500).json({
        success: false,
        error: 'FRAUD_5001',
        message: '사기 탐지 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * POST /api/admin/payments/fraud/:alertId/action
   * Take action on a fraud alert
   */
  async handleFraudAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { alertId } = req.params;
      const { action, notes } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      // Validate action
      const validActions = ['block_payment', 'block_user', 'allow', 'investigate', 'refund'];
      if (!validActions.includes(action)) {
        res.status(400).json({
          success: false,
          error: 'FRAUD_4001',
          message: '유효하지 않은 액션입니다.'
        });
        return;
      }

      // Process fraud alert action
      const result = await fraudDetectionService.handleAlert(alertId, action, adminId, notes);

      res.json({
        success: true,
        data: {
          alertId,
          action,
          result,
          processedBy: adminId,
          processedAt: new Date().toISOString()
        },
        message: '사기 알림 처리를 완료했습니다.'
      });

    } catch (error) {
      logger.error('Error handling fraud alert:', error);
      res.status(500).json({
        success: false,
        error: 'FRAUD_5002',
        message: '사기 알림 처리 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * GET /api/admin/payments/disputes
   * Get payment disputes and chargebacks
   */
  async getDisputes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      const { status, type, startDate, endDate } = req.query;

      let query = this.supabase
        .from('payment_disputes')
        .select('*, payments!inner(*)');

      if (status) {
        query = query.eq('dispute_status', status);
      }
      if (type) {
        query = query.eq('dispute_type', type);
      }
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: disputes } = await query
        .order('created_at', { ascending: false });

      // Calculate dispute metrics
      const metrics = {
        total: disputes?.length || 0,
        open: disputes?.filter((d: any) => d.dispute_status === 'open').length || 0,
        resolved: disputes?.filter((d: any) => d.dispute_status === 'resolved').length || 0,
        lost: disputes?.filter((d: any) => d.dispute_status === 'lost').length || 0,
        totalAmount: disputes?.reduce((sum, d: any) => sum + (d.dispute_amount || 0), 0) || 0
      };

      res.json({
        success: true,
        data: {
          disputes: disputes || [],
          metrics,
          lastUpdated: new Date().toISOString()
        },
        message: '분쟁 내역을 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error getting disputes:', error);
      res.status(500).json({
        success: false,
        error: 'DISPUTE_5001',
        message: '분쟁 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * POST /api/admin/payments/disputes/:disputeId/respond
   * Respond to a payment dispute
   */
  async respondToDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { disputeId } = req.params;
      const { response, evidence, action } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      // Update dispute with response
      const { data: dispute, error } = await this.supabase
        .from('payment_disputes')
        .update({
          admin_response: response,
          evidence_submitted: evidence,
          response_action: action,
          responded_by: adminId,
          responded_at: new Date().toISOString(),
          dispute_status: action === 'accept' ? 'resolved' : 'contested'
        })
        .eq('id', disputeId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // If accepting dispute, process refund
      if (action === 'accept' && dispute) {
        await portOneService.cancelPayment(
          dispute.payment_id,
          `Dispute accepted: ${dispute.dispute_reason}`,
          dispute.dispute_amount
        );
      }

      res.json({
        success: true,
        data: {
          disputeId,
          action,
          dispute,
          respondedBy: adminId,
          respondedAt: new Date().toISOString()
        },
        message: '분쟁 응답을 처리했습니다.'
      });

    } catch (error) {
      logger.error('Error responding to dispute:', error);
      res.status(500).json({
        success: false,
        error: 'DISPUTE_5002',
        message: '분쟁 응답 처리 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * POST /api/admin/payments/batch/refund
   * Process batch refunds
   */
  async processBatchRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { paymentIds, reason, refundMethod = 'original' } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'BATCH_4001',
          message: '처리할 결제 ID가 없습니다.'
        });
        return;
      }

      const results = [];
      let successCount = 0;
      let failCount = 0;

      // Process each refund
      for (const paymentId of paymentIds) {
        try {
          const { data: payment } = await this.supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

          if (payment) {
            await portOneService.cancelPayment(paymentId, reason, payment.amount);
            results.push({
              paymentId,
              status: 'success',
              refundAmount: payment.amount
            });
            successCount++;
          } else {
            results.push({
              paymentId,
              status: 'failed',
              error: 'Payment not found'
            });
            failCount++;
          }
        } catch (error) {
          results.push({
            paymentId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failCount++;
        }
      }

      // Log batch operation
      await this.supabase
        .from('batch_operation_logs')
        .insert({
          operation_type: 'batch_refund',
          admin_id: adminId,
          total_items: paymentIds.length,
          success_count: successCount,
          fail_count: failCount,
          details: { results, reason },
          created_at: new Date().toISOString()
        });

      res.json({
        success: true,
        data: {
          totalProcessed: paymentIds.length,
          successCount,
          failCount,
          results
        },
        message: `일괄 환불 처리 완료: 성공 ${successCount}건, 실패 ${failCount}건`
      });

    } catch (error) {
      logger.error('Error processing batch refund:', error);
      res.status(500).json({
        success: false,
        error: 'BATCH_5001',
        message: '일괄 환불 처리 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * POST /api/admin/payments/batch/update-status
   * Batch update payment statuses
   */
  async batchUpdateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      const { paymentIds, newStatus, reason } = req.body;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'BATCH_4002',
          message: '처리할 결제 ID가 없습니다.'
        });
        return;
      }

      // Update all payment statuses
      const { data: updatedPayments, error } = await this.supabase
        .from('payments')
        .update({
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
          metadata: {
            statusUpdatedBy: adminId,
            statusUpdateReason: reason,
            batchUpdate: true
          }
        })
        .in('id', paymentIds)
        .select();

      if (error) {
        throw error;
      }

      // Log batch operation
      await this.supabase
        .from('batch_operation_logs')
        .insert({
          operation_type: 'batch_status_update',
          admin_id: adminId,
          total_items: paymentIds.length,
          success_count: updatedPayments?.length || 0,
          fail_count: paymentIds.length - (updatedPayments?.length || 0),
          details: { newStatus, reason },
          created_at: new Date().toISOString()
        });

      res.json({
        success: true,
        data: {
          totalRequested: paymentIds.length,
          totalUpdated: updatedPayments?.length || 0,
          updatedPayments: updatedPayments || []
        },
        message: `${updatedPayments?.length || 0}건의 결제 상태를 업데이트했습니다.`
      });

    } catch (error) {
      logger.error('Error batch updating status:', error);
      res.status(500).json({
        success: false,
        error: 'BATCH_5002',
        message: '일괄 상태 업데이트 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * GET /api/admin/payments/reconciliation
   * Get payment reconciliation report
   */
  async getReconciliationReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.'
        });
        return;
      }

      const { startDate, endDate } = req.query;

      // Get payments within date range
      const { data: payments } = await this.supabase
        .from('payments')
        .select('*')
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString());

      // Calculate reconciliation metrics
      const reconciliation = {
        totalTransactions: payments?.length || 0,
        totalExpectedAmount: payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        totalReceivedAmount: payments?.filter(p => p.payment_status === 'fully_paid' || p.payment_status === 'deposit_paid')
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        totalRefundedAmount: payments?.filter(p => p.refund_amount)
          .reduce((sum, p) => sum + (p.refund_amount || 0), 0) || 0,
        pendingSettlements: payments?.filter(p => p.settlement_status === 'pending').length || 0,
        completedSettlements: payments?.filter(p => p.settlement_status === 'completed').length || 0,
        discrepancies: []
      };

      // Find discrepancies
      const discrepancies = payments?.filter(p => {
        return (p.payment_status === 'fully_paid' && !p.paid_at) ||
               (p.refund_amount && p.refund_amount > p.amount);
      }) || [];

      reconciliation.discrepancies = discrepancies.map(d => ({
        paymentId: d.id,
        type: !d.paid_at ? 'missing_payment_date' : 'excess_refund',
        amount: d.amount,
        details: d
      }));

      res.json({
        success: true,
        data: {
          reconciliation,
          dateRange: {
            start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: endDate || new Date().toISOString()
          },
          generatedAt: new Date().toISOString(),
          generatedBy: adminId
        },
        message: '정산 보고서를 생성했습니다.'
      });

    } catch (error) {
      logger.error('Error getting reconciliation report:', error);
      res.status(500).json({
        success: false,
        error: 'RECON_5001',
        message: '정산 보고서 생성 중 오류가 발생했습니다.'
      });
    }
  }

  // Helper methods
  private async checkGatewayHealth(): Promise<any> {
    try {
      const response = await fetch('https://api.iamport.kr/v2/payments', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PORTONE_API_KEY}`
        }
      });

      return {
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: 0,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      };
    }
  }

  private getStartTime(now: Date, range: string): Date {
    const ranges: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return new Date(now.getTime() - (ranges[range] || ranges['1h']));
  }

  private getTimeRangeMinutes(range: string): number {
    const minutes: Record<string, number> = {
      '1h': 60,
      '6h': 360,
      '24h': 1440,
      '7d': 10080
    };
    return minutes[range] || 60;
  }

  private findPeakHour(payments: any[]): number {
    if (!payments || payments.length === 0) return 0;

    const hourCounts: Record<number, number> = {};
    payments.forEach(p => {
      const hour = new Date(p.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let peakHour = 0;
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = Number(hour);
      }
    }
    return peakHour;
  }

  private calculateTrend(payments: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (!payments || payments.length < 2) return 'stable';

    const midPoint = Math.floor(payments.length / 2);
    const firstHalf = payments.slice(0, midPoint).length;
    const secondHalf = payments.slice(midPoint).length;

    if (secondHalf > firstHalf * 1.1) return 'increasing';
    if (secondHalf < firstHalf * 0.9) return 'decreasing';
    return 'stable';
  }
}

export const adminPaymentManagementController = new AdminPaymentManagementController();