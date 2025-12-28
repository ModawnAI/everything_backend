import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

/**
 * User Shop Validation Utilities
 *
 * Validates user data to ensure shop roles have required shopId
 * and that shopId references exist and are valid
 */

const SHOP_ROLES = ['shop_owner'];
const PLATFORM_ROLES = ['admin'];
const ALL_VALID_ROLES = [...PLATFORM_ROLES, ...SHOP_ROLES, 'customer'];

export interface UserShopValidation {
  isValid: boolean;
  errors: string[];
}

export interface UserData {
  role: string;
  shopId?: string | null;
  shopName?: string | null;
  email?: string;
  name?: string;
}

/**
 * Validate user data for create/update operations
 */
export async function validateUserShopData(userData: UserData): Promise<UserShopValidation> {
  const errors: string[] = [];
  const supabase = getSupabaseClient();

  try {
    // Validate role is one of the allowed values
    if (!ALL_VALID_ROLES.includes(userData.role)) {
      errors.push(`Invalid role: ${userData.role}. Must be one of: ${ALL_VALID_ROLES.join(', ')}`);
      return { isValid: false, errors };
    }

    // Shop roles MUST have shopId
    if (SHOP_ROLES.includes(userData.role)) {
      if (!userData.shopId) {
        errors.push(`Shop roles (${SHOP_ROLES.join(', ')}) require a shopId`);
        return { isValid: false, errors };
      }

      // Verify shop exists and is active
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name, user_status')
        .eq('id', userData.shopId)
        .single();

      if (shopError || !shop) {
        logger.error('Shop validation failed', {
          shopId: userData.shopId,
          error: shopError?.message
        });
        errors.push(`Invalid shopId: Shop does not exist`);
        return { isValid: false, errors };
      }

      // Check if shop is active (if you have a status field)
      if (shop.user_status && shop.user_status !== 'active') {
        errors.push(`Cannot assign user to inactive shop (status: ${shop.user_status})`);
        return { isValid: false, errors };
      }

      // If shopName is not provided, auto-populate from shop
      if (!userData.shopName && shop.name) {
        userData.shopName = shop.name;
      }
    }

    // Platform roles can optionally have shopId (for toggle feature)
    if (PLATFORM_ROLES.includes(userData.role) && userData.shopId) {
      // Verify shop exists if provided
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name')
        .eq('id', userData.shopId)
        .single();

      if (shopError || !shop) {
        logger.error('Shop validation failed for platform admin', {
          shopId: userData.shopId,
          error: shopError?.message
        });
        errors.push(`Invalid shopId: Shop does not exist`);
        return { isValid: false, errors };
      }

      // Auto-populate shopName if not provided
      if (!userData.shopName && shop.name) {
        userData.shopName = shop.name;
      }
    }

    // Regular users should not have shopId
    if (userData.role === 'user' && userData.shopId) {
      errors.push('Regular users cannot be assigned to a shop');
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  } catch (error) {
    logger.error('Error validating user shop data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userData
    });
    errors.push('Internal error during validation');
    return { isValid: false, errors };
  }
}

/**
 * Validate shop ownership change
 * Ensures user can only be reassigned to shops they have permission for
 */
export async function validateShopOwnershipChange(
  userId: string,
  newShopId: string,
  currentShopId?: string | null
): Promise<UserShopValidation> {
  const errors: string[] = [];
  const supabase = getSupabaseClient();

  try {
    // Get user's current role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_role, shop_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      errors.push('User not found');
      return { isValid: false, errors };
    }

    // Validate new shop exists
    const { data: newShop, error: shopError } = await supabase
      .from('shops')
      .select('id, name, user_status')
      .eq('id', newShopId)
      .single();

    if (shopError || !newShop) {
      errors.push('Target shop does not exist');
      return { isValid: false, errors };
    }

    // Check if shop is active
    if (newShop.user_status && newShop.user_status !== 'active') {
      errors.push(`Cannot assign user to inactive shop`);
      return { isValid: false, errors };
    }

    // Additional business logic: prevent changing shop for shop_owner
    // (shop_owner typically shouldn't change shops, but this is configurable)
    if (user.user_role === 'shop_owner' && user.shop_id && user.shop_id !== newShopId) {
      logger.warn('Attempting to change shop for shop_owner', {
        userId,
        currentShopId: user.shop_id,
        newShopId
      });
      // Uncomment to enforce this rule:
      // errors.push('Shop owners cannot be reassigned to different shops');
      // return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  } catch (error) {
    logger.error('Error validating shop ownership change', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      newShopId
    });
    errors.push('Internal error during validation');
    return { isValid: false, errors };
  }
}

/**
 * Check if user has permission to manage another user
 */
export async function canManageUser(
  managerId: string,
  targetUserId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // Get manager's data
    const { data: manager } = await supabase
      .from('users')
      .select('user_role, shop_id')
      .eq('id', managerId)
      .single();

    // Get target user's data
    const { data: targetUser } = await supabase
      .from('users')
      .select('user_role, shop_id')
      .eq('id', targetUserId)
      .single();

    if (!manager || !targetUser) {
      return false;
    }

    // Platform admins can manage anyone
    if (PLATFORM_ROLES.includes(manager.user_role)) {
      return true;
    }

    // Shop owners can manage users in their shop
    if (manager.user_role === 'shop_owner' && manager.shop_id) {
      return targetUser.shop_id === manager.shop_id;
    }

    return false;
  } catch (error) {
    logger.error('Error checking user management permission', {
      error: error instanceof Error ? error.message : 'Unknown error',
      managerId,
      targetUserId
    });
    return false;
  }
}

/**
 * Helper to check if role requires shopId
 */
export function roleRequiresShopId(role: string): boolean {
  return SHOP_ROLES.includes(role);
}

/**
 * Helper to check if role can have optional shopId
 */
export function roleAllowsOptionalShopId(role: string): boolean {
  return PLATFORM_ROLES.includes(role);
}

export default {
  validateUserShopData,
  validateShopOwnershipChange,
  canManageUser,
  roleRequiresShopId,
  roleAllowsOptionalShopId
};
