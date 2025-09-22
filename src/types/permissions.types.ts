/**
 * RBAC Permission Types
 * 
 * Comprehensive type definitions for Role-Based Access Control system
 * supporting granular permissions across all platform resources
 */

import { Request } from 'express';

// Base permission actions
export type PermissionAction = 
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'manage'
  | 'approve'
  | 'reject'
  | 'export'
  | 'import'
  | 'analytics'
  | 'configure'
  | 'resolve';

// Platform resources
export type Resource = 
  | 'users'
  | 'shops'
  | 'shop_services'
  | 'reservations'
  | 'payments'
  | 'points'
  | 'reviews'
  | 'analytics'
  | 'admin_actions'
  | 'push_notifications'
  | 'content'
  | 'reports'
  | 'system_settings'
  | 'audit_logs'
  | 'influencer_content'
  | 'feed_posts'
  | 'feed_comments'
  | 'feed_likes'
  | 'feed_reports'
  | 'feed_moderation';

// User roles from database schema
export type UserRole = 'user' | 'shop_owner' | 'admin' | 'influencer';

// Permission definition
export interface Permission {
  resource: Resource;
  action: PermissionAction;
  conditions?: PermissionCondition[];
  description?: string;
}

// Permission condition types
export type PermissionCondition = 
  | 'own_resource'     // Can only access own resources
  | 'same_shop'        // Can only access resources from same shop
  | 'active_status'    // Can only access active resources
  | 'verified_user'    // Requires user email verification
  | 'approved_shop'    // Requires shop approval status
  | 'within_hours'     // Time-based restrictions (e.g., business hours)
  | 'payment_verified' // Requires payment method verification
  | 'influencer_tier'; // Requires specific influencer tier

// Permission context for dynamic checks
export interface PermissionContext {
  userId: string;
  userRole: UserRole;
  userStatus: string;
  shopId?: string;
  resourceId?: string;
  resourceOwnerId?: string;
  shopOwnerId?: string;
  isEmailVerified?: boolean;
  isPaymentVerified?: boolean;
  influencerTier?: string;
  requestTime?: Date;
  businessHours?: {
    start: string;
    end: string;
  };
}

// Permission check result
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredConditions?: PermissionCondition[];
  missingPermissions?: Permission[];
}

// Permission matrix type
export type PermissionMatrix = Record<UserRole, Permission[]>;

// Resource ownership types
export interface ResourceOwnership {
  resource: Resource;
  ownerField: string; // Field name that contains the owner ID
  shopField?: string; // Field name that contains the shop ID (if applicable)
}

// Advanced permission options
export interface PermissionOptions {
  requireAll?: boolean;        // Require all permissions (AND) vs any (OR)
  skipOwnershipCheck?: boolean; // Skip ownership validation
  allowSuperAdmin?: boolean;   // Allow admin override
  customConditions?: ((context: PermissionContext) => boolean)[];
}

// Audit log entry for permission checks
export interface PermissionAuditLog {
  userId: string;
  userRole: UserRole;
  resource: Resource;
  action: PermissionAction;
  resourceId?: string;
  allowed: boolean;
  reason?: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  additionalContext?: Record<string, any>;
}

// Permission error types
export class PermissionError extends Error {
  constructor(
    message: string,
    public code: string = 'PERMISSION_DENIED',
    public statusCode: number = 403,
    public requiredPermissions?: Permission[],
    public missingConditions?: PermissionCondition[]
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class InsufficientPermissionError extends PermissionError {
  constructor(
    resource: Resource,
    action: PermissionAction,
    userRole: UserRole,
    requiredPermissions?: Permission[]
  ) {
    super(
      `Insufficient permissions for ${action} on ${resource} with role ${userRole}`,
      'INSUFFICIENT_PERMISSIONS',
      403,
      requiredPermissions
    );
    this.name = 'InsufficientPermissionError';
  }
}

export class ResourceAccessError extends PermissionError {
  constructor(
    resource: Resource,
    resourceId: string,
    reason: string = 'Resource access denied'
  ) {
    super(
      `Access denied to ${resource} resource ${resourceId}: ${reason}`,
      'RESOURCE_ACCESS_DENIED',
      403
    );
    this.name = 'ResourceAccessError';
  }
}

export class ConditionNotMetError extends PermissionError {
  constructor(
    conditions: PermissionCondition[],
    message: string = 'Required conditions not met'
  ) {
    super(
      message,
      'CONDITIONS_NOT_MET',
      403,
      undefined,
      conditions
    );
    this.name = 'ConditionNotMetError';
  }
}

// Helper types for middleware
export interface AuthorizedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    status: string;
    email?: string;
    shopId?: string;
    isEmailVerified?: boolean;
    isPaymentVerified?: boolean;
    influencerTier?: string;
  };
  permissions?: Permission[];
  permissionContext?: PermissionContext;
}

// Permission middleware options
export interface PermissionMiddlewareOptions extends PermissionOptions {
  resource: Resource;
  action: PermissionAction;
  getResourceId?: (req: any) => string;
  getShopId?: (req: any) => string;
  errorHandler?: (error: PermissionError, req: any, res: any) => void;
}

// Types are exported above individually 