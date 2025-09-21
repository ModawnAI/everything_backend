/**
 * User Settings Routes
 * 
 * Routes for comprehensive user settings management
 */

import { Router } from 'express';
import { userSettingsController } from '../controllers/user-settings.controller';
import { 
  validateUserSettingsUpdate,
  validateBulkSettingsUpdate,
  validateSettingsReset,
  validateSettingsHistoryQuery,
  validateSettingsCategoryQuery,
  validateSettingsValidationRuleQuery,
  validateSettingsSearchQuery,
  validateSettingsExportQuery,
  validateSettingsImport,
  validateSettingsField
} from '../validators/user-settings.express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Apply rate limiting to all routes
router.use(rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }));

// Basic settings operations
router.get('/settings', userSettingsController.getSettings);
router.put('/settings', validateUserSettingsUpdate, userSettingsController.updateSettings);
// router.patch('/settings', validateUserSettingsUpdate, userSettingsController.patchSettings); // Method not implemented

// Bulk operations
router.put('/settings/bulk', validateBulkSettingsUpdate, userSettingsController.bulkUpdateSettings);
router.post('/settings/reset', validateSettingsReset, userSettingsController.resetSettings);

// Settings history
router.get('/settings/history', validateSettingsHistoryQuery, userSettingsController.getSettingsHistory);
// router.get('/settings/history/:id', userSettingsController.getSettingsHistoryItem); // Method not implemented

// Settings categories
router.get('/settings/categories', validateSettingsCategoryQuery, userSettingsController.getSettingsCategories);
// router.get('/settings/category/:category', validateSettingsCategoryQuery, userSettingsController.getSettingsByCategory); // Method not implemented

// Settings validation
router.get('/settings/validation-rules', validateSettingsValidationRuleQuery, userSettingsController.getValidationRules);
// router.get('/settings/validation-rules/:field', userSettingsController.getValidationRule); // Method not implemented
// router.post('/settings/validate', validateUserSettingsUpdate, userSettingsController.validateSettings); // Method not implemented
// router.post('/settings/validate-field', validateSettingsField, userSettingsController.validateField); // Method not implemented

// Settings search and discovery
// router.get('/settings/search', validateSettingsSearchQuery, userSettingsController.searchSettings); // Method not implemented
// router.get('/settings/fields', userSettingsController.getSettingsFields); // Method not implemented
// router.get('/settings/fields/:field', userSettingsController.getSettingsField); // Method not implemented

// Settings export and import
// router.get('/settings/export', validateSettingsExportQuery, userSettingsController.exportSettings); // Method not implemented
// router.post('/settings/import', validateSettingsImport, userSettingsController.importSettings); // Method not implemented

// Settings metadata
// router.get('/settings/metadata', userSettingsController.getSettingsMetadata); // Method not implemented
router.get('/settings/defaults', userSettingsController.getDefaultSettings);
// router.get('/settings/schema', userSettingsController.getSettingsSchema); // Method not implemented

// Settings statistics
// router.get('/settings/stats', userSettingsController.getSettingsStats); // Method not implemented
// router.get('/settings/usage', userSettingsController.getSettingsUsage); // Method not implemented

// Settings preferences
// router.get('/settings/preferences', userSettingsController.getPreferences); // Method not implemented
// router.put('/settings/preferences', validateUserSettingsUpdate, userSettingsController.updatePreferences); // Method not implemented

// Settings notifications
// router.get('/settings/notifications', userSettingsController.getNotificationSettings); // Method not implemented
// router.put('/settings/notifications', validateUserSettingsUpdate, userSettingsController.updateNotificationSettings); // Method not implemented

// Settings privacy
// router.get('/settings/privacy', userSettingsController.getPrivacySettings); // Method not implemented
// router.put('/settings/privacy', validateUserSettingsUpdate, userSettingsController.updatePrivacySettings); // Method not implemented

// Settings appearance
// router.get('/settings/appearance', userSettingsController.getAppearanceSettings); // Method not implemented
// router.put('/settings/appearance', validateUserSettingsUpdate, userSettingsController.updateAppearanceSettings); // Method not implemented

// Settings accessibility
// router.get('/settings/accessibility', userSettingsController.getAccessibilitySettings); // Method not implemented
// router.put('/settings/accessibility', validateUserSettingsUpdate, userSettingsController.updateAccessibilitySettings); // Method not implemented

// Settings advanced
// router.get('/settings/advanced', userSettingsController.getAdvancedSettings); // Method not implemented
// router.put('/settings/advanced', validateUserSettingsUpdate, userSettingsController.updateAdvancedSettings); // Method not implemented

// Settings backup and restore
// router.post('/settings/backup', userSettingsController.createBackup); // Method not implemented
// router.get('/settings/backups', userSettingsController.getBackups); // Method not implemented
// router.post('/settings/restore/:backupId', userSettingsController.restoreBackup); // Method not implemented
// router.delete('/settings/backups/:backupId', userSettingsController.deleteBackup); // Method not implemented

// Settings sync
// router.post('/settings/sync', userSettingsController.syncSettings); // Method not implemented
// router.get('/settings/sync/status', userSettingsController.getSyncStatus); // Method not implemented

// Settings webhooks
// router.post('/settings/webhooks', userSettingsController.createWebhook); // Method not implemented
// router.get('/settings/webhooks', userSettingsController.getWebhooks); // Method not implemented
// router.put('/settings/webhooks/:webhookId', userSettingsController.updateWebhook); // Method not implemented
// router.delete('/settings/webhooks/:webhookId', userSettingsController.deleteWebhook); // Method not implemented

// Settings analytics
// router.get('/settings/analytics', userSettingsController.getSettingsAnalytics); // Method not implemented
// router.get('/settings/analytics/usage', userSettingsController.getUsageAnalytics); // Method not implemented
// router.get('/settings/analytics/trends', userSettingsController.getTrendsAnalytics); // Method not implemented

// Settings health check
// router.get('/settings/health', userSettingsController.healthCheck); // Method not implemented

export { router as userSettingsRoutes };
