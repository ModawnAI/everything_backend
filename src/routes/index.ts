// Routes barrel export
// Export all routes here for clean imports

// Authentication Routes
export { default as authRoutes } from './auth.routes';

// Admin Authentication Routes - ARCHIVED (conflicts with auth.routes.ts)
// export { default as adminAuthRoutes } from './admin-auth.routes';

// Admin User Management Routes
export { default as adminUserManagementRoutes } from './admin-user-management.routes';

// User Profile Routes - ARCHIVED (conflicts with user-settings.routes.ts)
// export { default as userProfileRoutes } from './user-profile.routes';

// Shop Routes
export { default as shopRoutes } from './shop.routes';

// Shop Categories Routes
export { default as shopCategoriesRoutes } from './shop-categories.routes';

// Shop Image Routes
export { default as shopImageRoutes } from './shop-image.routes';

// Shop Owner Routes
export { default as shopOwnerRoutes } from './shop-owner.routes';

// Admin Shop Routes
export { adminShopRoutes } from './admin-shop.routes';

// User Status Routes
export { default as userStatusRoutes } from './user-status.routes';

// Referral Routes
export { default as referralRoutes } from './referral.routes';

// Storage Routes
export { storageRoutes } from './storage.routes';

// Reservation Routes
export { default as reservationRoutes } from './reservation.routes';

// No-Show Detection Routes
export { default as noShowDetectionRoutes } from './no-show-detection.routes';

// Reservation Rescheduling Routes
export { default as reservationReschedulingRoutes } from './reservation-rescheduling.routes';
export { default as conflictResolutionRoutes } from './conflict-resolution.routes';

// Payment Routes
export { default as paymentRoutes } from './payment.routes';

// Split Payment Routes
export { default as splitPaymentRoutes } from './split-payment.routes';

// Payment Security Routes
export { default as paymentSecurityRoutes } from './payment-security.routes';

// Point Routes
export { default as pointRoutes } from './point.routes';

// Point Balance Routes
export { default as pointBalanceRoutes } from './point-balance.routes';

// Influencer Bonus Routes
export { default as influencerBonusRoutes } from './influencer-bonus.routes';

// Admin Adjustment Routes
export { default as adminAdjustmentRoutes } from './admin-adjustment.routes';

// Admin Payment Routes
export { default as adminPaymentRoutes } from './admin-payment.routes';

// Admin Analytics Routes
export { default as adminAnalyticsRoutes } from './admin-analytics.routes';

// Notification Routes
export { default as notificationRoutes } from './notification.routes';

// WebSocket Routes
export { default as websocketRoutes } from './websocket.routes';
