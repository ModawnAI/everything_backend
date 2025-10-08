import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { adminPaymentManagementController } from '../controllers/admin-payment-management.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticateJWT());
router.use(requireRole('admin'));

/**
 * Payment Gateway Management
 */
router.get('/gateway/config',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  (req, res) => adminPaymentManagementController.getGatewayConfig(req, res)
);

router.post('/gateway/test',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  (req, res) => adminPaymentManagementController.testGateway(req, res)
);

/**
 * Real-time Monitoring
 */
router.get('/monitoring/realtime',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  (req, res) => adminPaymentManagementController.getRealtimeMonitoring(req, res)
);

/**
 * Webhook Management
 */
router.get('/webhooks',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  (req, res) => adminPaymentManagementController.getWebhooks(req, res)
);

router.post('/webhooks/:webhookId/retry',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  (req, res) => adminPaymentManagementController.retryWebhook(req, res)
);

/**
 * Fraud Detection
 */
router.get('/fraud',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  (req, res) => adminPaymentManagementController.getFraudAlerts(req, res)
);

router.post('/fraud/:alertId/action',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  (req, res) => adminPaymentManagementController.handleFraudAlert(req, res)
);

/**
 * Dispute Management
 */
router.get('/disputes',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  (req, res) => adminPaymentManagementController.getDisputes(req, res)
);

router.post('/disputes/:disputeId/respond',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  (req, res) => adminPaymentManagementController.respondToDispute(req, res)
);

/**
 * Batch Operations
 */
router.post('/batch/refund',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  (req, res) => adminPaymentManagementController.processBatchRefund(req, res)
);

router.post('/batch/update-status',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  (req, res) => adminPaymentManagementController.batchUpdateStatus(req, res)
);

/**
 * Reconciliation
 */
router.get('/reconciliation',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  (req, res) => adminPaymentManagementController.getReconciliationReport(req, res)
);

export default router;