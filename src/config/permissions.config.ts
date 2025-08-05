/**
 * RBAC Permission Matrix Configuration
 * 
 * Defines comprehensive role-based permissions for all platform resources
 * Supporting granular access control with conditions and ownership rules
 */

import {
  Permission,
  PermissionMatrix,
  ResourceOwnership,
  UserRole,
  Resource,
  PermissionAction,
  PermissionCondition
} from '../types/permissions.types';

/**
 * Resource Ownership Configuration
 * Defines how ownership is determined for each resource type
 */
export const RESOURCE_OWNERSHIP: Record<Resource, ResourceOwnership> = {
  users: {
    resource: 'users',
    ownerField: 'id' // Users own themselves
  },
  shops: {
    resource: 'shops',
    ownerField: 'owner_id'
  },
  shop_services: {
    resource: 'shop_services',
    ownerField: 'shop_id',
    shopField: 'shop_id'
  },
  reservations: {
    resource: 'reservations',
    ownerField: 'user_id', // Customer owns reservation
    shopField: 'shop_id'   // Shop can manage reservations
  },
  payments: {
    resource: 'payments',
    ownerField: 'user_id', // Customer owns payment
    shopField: 'shop_id'   // Shop can view payments
  },
  points: {
    resource: 'points',
    ownerField: 'user_id'
  },
  reviews: {
    resource: 'reviews',
    ownerField: 'user_id', // Reviewer owns review
    shopField: 'shop_id'   // Shop can respond to reviews
  },
  analytics: {
    resource: 'analytics',
    ownerField: 'user_id',
    shopField: 'shop_id'
  },
  admin_actions: {
    resource: 'admin_actions',
    ownerField: 'admin_user_id'
  },
  push_notifications: {
    resource: 'push_notifications',
    ownerField: 'user_id'
  },
  content: {
    resource: 'content',
    ownerField: 'creator_id'
  },
  reports: {
    resource: 'reports',
    ownerField: 'generated_by',
    shopField: 'shop_id'
  },
  system_settings: {
    resource: 'system_settings',
    ownerField: 'updated_by'
  },
  audit_logs: {
    resource: 'audit_logs',
    ownerField: 'user_id'
  },
  influencer_content: {
    resource: 'influencer_content',
    ownerField: 'influencer_id'
  }
};

/**
 * User Role Permissions
 * Comprehensive permission matrix for each user role
 */

// Regular user permissions
const USER_PERMISSIONS: Permission[] = [
  // User profile management
  { resource: 'users', action: 'read', conditions: ['own_resource'] },
  { resource: 'users', action: 'update', conditions: ['own_resource'] },
  
  // Shop browsing and services
  { resource: 'shops', action: 'read', conditions: ['active_status'] },
  { resource: 'shops', action: 'list', conditions: ['active_status'] },
  { resource: 'shop_services', action: 'read', conditions: ['active_status'] },
  { resource: 'shop_services', action: 'list', conditions: ['active_status'] },
  
  // Reservations (customer perspective)
  { resource: 'reservations', action: 'create', conditions: ['verified_user', 'payment_verified'] },
  { resource: 'reservations', action: 'read', conditions: ['own_resource'] },
  { resource: 'reservations', action: 'update', conditions: ['own_resource'] },
  { resource: 'reservations', action: 'list', conditions: ['own_resource'] },
  
  // Payments
  { resource: 'payments', action: 'create', conditions: ['own_resource'] },
  { resource: 'payments', action: 'read', conditions: ['own_resource'] },
  { resource: 'payments', action: 'list', conditions: ['own_resource'] },
  
  // Points management
  { resource: 'points', action: 'read', conditions: ['own_resource'] },
  { resource: 'points', action: 'list', conditions: ['own_resource'] },
  
  // Reviews
  { resource: 'reviews', action: 'create', conditions: ['verified_user'] },
  { resource: 'reviews', action: 'read' },
  { resource: 'reviews', action: 'update', conditions: ['own_resource'] },
  { resource: 'reviews', action: 'delete', conditions: ['own_resource'] },
  { resource: 'reviews', action: 'list' },
  
  // Content viewing
  { resource: 'content', action: 'read' },
  { resource: 'content', action: 'list' },
  { resource: 'influencer_content', action: 'read' },
  { resource: 'influencer_content', action: 'list' },
  
  // Push notifications
  { resource: 'push_notifications', action: 'read', conditions: ['own_resource'] },
  { resource: 'push_notifications', action: 'update', conditions: ['own_resource'] }
];

// Shop owner permissions
const SHOP_OWNER_PERMISSIONS: Permission[] = [
  // Include all user permissions
  ...USER_PERMISSIONS,
  
  // Shop management
  { resource: 'shops', action: 'create', conditions: ['verified_user'] },
  { resource: 'shops', action: 'update', conditions: ['own_resource'] },
  { resource: 'shops', action: 'manage', conditions: ['own_resource'] },
  
  // Shop services management
  { resource: 'shop_services', action: 'create', conditions: ['same_shop', 'approved_shop'] },
  { resource: 'shop_services', action: 'update', conditions: ['same_shop'] },
  { resource: 'shop_services', action: 'delete', conditions: ['same_shop'] },
  { resource: 'shop_services', action: 'manage', conditions: ['same_shop'] },
  
  // Reservation management (business perspective)
  { resource: 'reservations', action: 'read', conditions: ['same_shop'] },
  { resource: 'reservations', action: 'update', conditions: ['same_shop'] },
  { resource: 'reservations', action: 'list', conditions: ['same_shop'] },
  { resource: 'reservations', action: 'approve', conditions: ['same_shop'] },
  { resource: 'reservations', action: 'reject', conditions: ['same_shop'] },
  
  // Payment viewing (business perspective)
  { resource: 'payments', action: 'read', conditions: ['same_shop'] },
  { resource: 'payments', action: 'list', conditions: ['same_shop'] },
  
  // Analytics for own shop
  { resource: 'analytics', action: 'read', conditions: ['same_shop'] },
  { resource: 'analytics', action: 'list', conditions: ['same_shop'] },
  
  // Shop reports
  { resource: 'reports', action: 'create', conditions: ['same_shop'] },
  { resource: 'reports', action: 'read', conditions: ['same_shop'] },
  { resource: 'reports', action: 'list', conditions: ['same_shop'] },
  { resource: 'reports', action: 'export', conditions: ['same_shop'] },
  
  // Review responses
  { resource: 'reviews', action: 'update', conditions: ['same_shop'] }, // Respond to reviews
  
  // Customer management for shop
  { resource: 'users', action: 'read', conditions: ['same_shop'] }, // View customers who visited
  { resource: 'users', action: 'list', conditions: ['same_shop'] }
];

// Influencer permissions
const INFLUENCER_PERMISSIONS: Permission[] = [
  // Include all user permissions
  ...USER_PERMISSIONS,
  
  // Content creation and management
  { resource: 'influencer_content', action: 'create', conditions: ['verified_user', 'influencer_tier'] },
  { resource: 'influencer_content', action: 'update', conditions: ['own_resource'] },
  { resource: 'influencer_content', action: 'delete', conditions: ['own_resource'] },
  { resource: 'influencer_content', action: 'manage', conditions: ['own_resource'] },
  
  // Enhanced content permissions
  { resource: 'content', action: 'create', conditions: ['verified_user', 'influencer_tier'] },
  { resource: 'content', action: 'update', conditions: ['own_resource'] },
  
  // Analytics for own content
  { resource: 'analytics', action: 'read', conditions: ['own_resource'] },
  { resource: 'analytics', action: 'list', conditions: ['own_resource'] },
  
  // Special shop relationships
  { resource: 'shops', action: 'read' }, // Enhanced shop browsing
  { resource: 'shop_services', action: 'read' }, // Enhanced service access
  
  // Enhanced reporting
  { resource: 'reports', action: 'create', conditions: ['own_resource'] },
  { resource: 'reports', action: 'read', conditions: ['own_resource'] },
  { resource: 'reports', action: 'export', conditions: ['own_resource'] }
];

// Admin permissions (super user)
const ADMIN_PERMISSIONS: Permission[] = [
  // Full access to all resources and actions
  // Users management
  { resource: 'users', action: 'create' },
  { resource: 'users', action: 'read' },
  { resource: 'users', action: 'update' },
  { resource: 'users', action: 'delete' },
  { resource: 'users', action: 'list' },
  { resource: 'users', action: 'manage' },
  
  // Shops management
  { resource: 'shops', action: 'create' },
  { resource: 'shops', action: 'read' },
  { resource: 'shops', action: 'update' },
  { resource: 'shops', action: 'delete' },
  { resource: 'shops', action: 'list' },
  { resource: 'shops', action: 'manage' },
  { resource: 'shops', action: 'approve' },
  { resource: 'shops', action: 'reject' },
  
  // Shop services management
  { resource: 'shop_services', action: 'create' },
  { resource: 'shop_services', action: 'read' },
  { resource: 'shop_services', action: 'update' },
  { resource: 'shop_services', action: 'delete' },
  { resource: 'shop_services', action: 'list' },
  { resource: 'shop_services', action: 'manage' },
  
  // Reservations management
  { resource: 'reservations', action: 'create' },
  { resource: 'reservations', action: 'read' },
  { resource: 'reservations', action: 'update' },
  { resource: 'reservations', action: 'delete' },
  { resource: 'reservations', action: 'list' },
  { resource: 'reservations', action: 'manage' },
  { resource: 'reservations', action: 'approve' },
  { resource: 'reservations', action: 'reject' },
  
  // Payments management
  { resource: 'payments', action: 'read' },
  { resource: 'payments', action: 'update' },
  { resource: 'payments', action: 'list' },
  { resource: 'payments', action: 'manage' },
  { resource: 'payments', action: 'approve' },
  { resource: 'payments', action: 'reject' },
  
  // Points management
  { resource: 'points', action: 'create' },
  { resource: 'points', action: 'read' },
  { resource: 'points', action: 'update' },
  { resource: 'points', action: 'delete' },
  { resource: 'points', action: 'list' },
  { resource: 'points', action: 'manage' },
  
  // Reviews management
  { resource: 'reviews', action: 'read' },
  { resource: 'reviews', action: 'update' },
  { resource: 'reviews', action: 'delete' },
  { resource: 'reviews', action: 'list' },
  { resource: 'reviews', action: 'manage' },
  
  // Analytics (full access)
  { resource: 'analytics', action: 'read' },
  { resource: 'analytics', action: 'list' },
  { resource: 'analytics', action: 'analytics' },
  { resource: 'analytics', action: 'export' },
  
  // Admin actions
  { resource: 'admin_actions', action: 'create' },
  { resource: 'admin_actions', action: 'read' },
  { resource: 'admin_actions', action: 'list' },
  
  // Push notifications
  { resource: 'push_notifications', action: 'create' },
  { resource: 'push_notifications', action: 'read' },
  { resource: 'push_notifications', action: 'update' },
  { resource: 'push_notifications', action: 'delete' },
  { resource: 'push_notifications', action: 'list' },
  { resource: 'push_notifications', action: 'manage' },
  
  // Content management
  { resource: 'content', action: 'create' },
  { resource: 'content', action: 'read' },
  { resource: 'content', action: 'update' },
  { resource: 'content', action: 'delete' },
  { resource: 'content', action: 'list' },
  { resource: 'content', action: 'manage' },
  { resource: 'content', action: 'approve' },
  { resource: 'content', action: 'reject' },
  
  // Influencer content management
  { resource: 'influencer_content', action: 'read' },
  { resource: 'influencer_content', action: 'update' },
  { resource: 'influencer_content', action: 'delete' },
  { resource: 'influencer_content', action: 'list' },
  { resource: 'influencer_content', action: 'manage' },
  { resource: 'influencer_content', action: 'approve' },
  { resource: 'influencer_content', action: 'reject' },
  
  // Reports (full access)
  { resource: 'reports', action: 'create' },
  { resource: 'reports', action: 'read' },
  { resource: 'reports', action: 'update' },
  { resource: 'reports', action: 'delete' },
  { resource: 'reports', action: 'list' },
  { resource: 'reports', action: 'export' },
  { resource: 'reports', action: 'import' },
  
  // System settings
  { resource: 'system_settings', action: 'read' },
  { resource: 'system_settings', action: 'update' },
  { resource: 'system_settings', action: 'configure' },
  
  // Audit logs
  { resource: 'audit_logs', action: 'read' },
  { resource: 'audit_logs', action: 'list' },
  { resource: 'audit_logs', action: 'export' }
];

/**
 * Complete Permission Matrix
 * Maps each user role to their allowed permissions
 */
export const PERMISSION_MATRIX: PermissionMatrix = {
  user: USER_PERMISSIONS,
  shop_owner: SHOP_OWNER_PERMISSIONS,
  influencer: INFLUENCER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS
};

/**
 * Helper functions for permission management
 */

/**
 * Get permissions for a specific role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return PERMISSION_MATRIX[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole, 
  resource: Resource, 
  action: PermissionAction
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.some(
    permission => 
      permission.resource === resource && 
      permission.action === action
  );
}

/**
 * Get all available actions for a role on a specific resource
 */
export function getAvailableActions(
  role: UserRole, 
  resource: Resource
): PermissionAction[] {
  const permissions = getPermissionsForRole(role);
  return permissions
    .filter(permission => permission.resource === resource)
    .map(permission => permission.action);
}

/**
 * Get required conditions for a specific permission
 */
export function getPermissionConditions(
  role: UserRole,
  resource: Resource,
  action: PermissionAction
): PermissionCondition[] {
  const permissions = getPermissionsForRole(role);
  const permission = permissions.find(
    p => p.resource === resource && p.action === action
  );
  return permission?.conditions || [];
}

/**
 * Check if a permission requires ownership validation
 */
export function requiresOwnership(
  role: UserRole,
  resource: Resource,
  action: PermissionAction
): boolean {
  const conditions = getPermissionConditions(role, resource, action);
  return conditions.includes('own_resource') || conditions.includes('same_shop');
}

/**
 * Get resource ownership configuration
 */
export function getResourceOwnership(resource: Resource): ResourceOwnership {
  return RESOURCE_OWNERSHIP[resource];
}

export default {
  PERMISSION_MATRIX,
  RESOURCE_OWNERSHIP,
  getPermissionsForRole,
  hasPermission,
  getAvailableActions,
  getPermissionConditions,
  requiresOwnership,
  getResourceOwnership
}; 