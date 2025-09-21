import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { referralCodeService } from './referral-code.service';

/**
 * Referral Relationship Service
 * 
 * Handles referral relationship tracking with circular reference prevention,
 * duplicate detection, and comprehensive validation
 */

export interface ReferralRelationship {
  id: string;
  referrerId: string;
  referredId: string;
  referralCode: string;
  relationshipDepth: number; // How many levels deep in the referral chain
  isCircular: boolean;
  createdAt: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface ReferralChain {
  userId: string;
  userName: string;
  referralCode: string;
  level: number;
  referredBy: string | null;
  referredAt: string | null;
  totalReferrals: number;
  isActive: boolean;
}

export interface ReferralValidationResult {
  isValid: boolean;
  canRefer: boolean;
  reason?: string;
  errorCode?: string;
  relationshipDepth?: number;
  existingRelationship?: ReferralRelationship;
}

export interface CircularReferenceCheck {
  hasCircularReference: boolean;
  circularPath: string[];
  depth: number;
  reason: string;
}

export interface ReferralRelationshipStats {
  totalRelationships: number;
  activeRelationships: number;
  circularReferences: number;
  maxDepth: number;
  averageDepth: number;
  topReferrers: Array<{
    userId: string;
    userName: string;
    totalReferrals: number;
    activeReferrals: number;
  }>;
}

class ReferralRelationshipService {
  private supabase = getSupabaseClient();

  /**
   * Create a referral relationship with comprehensive validation
   */
  async createReferralRelationship(
    referrerId: string,
    referredId: string,
    referralCode: string
  ): Promise<ReferralRelationship> {
    try {
      logger.info('Creating referral relationship', {
        referrerId,
        referredId,
        referralCode
      });

      // Step 1: Validate basic requirements
      const basicValidation = await this.validateBasicRequirements(referrerId, referredId);
      if (!basicValidation.isValid) {
        throw new Error(basicValidation.reason || 'Basic validation failed');
      }

      // Step 2: Check for circular references
      const circularCheck = await this.checkCircularReference(referrerId, referredId);
      if (circularCheck.hasCircularReference) {
        throw new Error(`Circular reference detected: ${circularCheck.reason}`);
      }

      // Step 3: Check for existing relationships
      const existingRelationship = await this.getExistingRelationship(referredId);
      if (existingRelationship) {
        throw new Error('User already has a referral relationship');
      }

      // Step 4: Calculate relationship depth
      const relationshipDepth = await this.calculateRelationshipDepth(referrerId);

      // Step 5: Create the relationship record
      const relationshipData = {
        referrer_id: referrerId,
        referred_id: referredId,
        referral_code: referralCode,
        relationship_depth: relationshipDepth,
        is_circular: false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: relationship, error } = await this.supabase
        .from('referral_relationships')
        .insert(relationshipData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create referral relationship', {
          error: error.message,
          referrerId,
          referredId
        });
        throw new Error(`Failed to create referral relationship: ${error.message}`);
      }

      // Step 6: Update referral statistics
      await this.updateReferralStatistics(referrerId, referredId);

      logger.info('Referral relationship created successfully', {
        relationshipId: relationship.id,
        referrerId,
        referredId,
        relationshipDepth
      });

      return relationship;

    } catch (error) {
      logger.error('Error creating referral relationship', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId
      });
      throw error;
    }
  }

  /**
   * Validate if a user can refer another user
   */
  async validateReferralEligibility(
    referrerId: string,
    referredId: string
  ): Promise<ReferralValidationResult> {
    try {
      // Check if users are the same
      if (referrerId === referredId) {
        return {
          isValid: false,
          canRefer: false,
          reason: 'Cannot refer yourself',
          errorCode: 'SELF_REFERRAL_NOT_ALLOWED'
        };
      }

      // Check if referrer exists and is active
      const referrer = await this.getUserInfo(referrerId);
      if (!referrer || referrer.user_status !== 'active') {
        return {
          isValid: false,
          canRefer: false,
          reason: 'Referrer not found or inactive',
          errorCode: 'REFERRER_NOT_FOUND'
        };
      }

      // Check if referred user exists and is active
      const referred = await this.getUserInfo(referredId);
      if (!referred || referred.user_status !== 'active') {
        return {
          isValid: false,
          canRefer: false,
          reason: 'Referred user not found or inactive',
          errorCode: 'REFERRED_USER_NOT_FOUND'
        };
      }

      // Check for existing relationship
      const existingRelationship = await this.getExistingRelationship(referredId);
      if (existingRelationship) {
        return {
          isValid: false,
          canRefer: false,
          reason: 'User already has a referral relationship',
          errorCode: 'EXISTING_RELATIONSHIP',
          existingRelationship
        };
      }

      // Check for circular references
      const circularCheck = await this.checkCircularReference(referrerId, referredId);
      if (circularCheck.hasCircularReference) {
        return {
          isValid: false,
          canRefer: false,
          reason: `Circular reference detected: ${circularCheck.reason}`,
          errorCode: 'CIRCULAR_REFERENCE_DETECTED'
        };
      }

      // Check referral limits
      const referralCount = await this.getUserReferralCount(referrerId);
      const maxReferrals = 50; // This could be configurable
      if (referralCount >= maxReferrals) {
        return {
          isValid: false,
          canRefer: false,
          reason: `Referral limit exceeded (${maxReferrals})`,
          errorCode: 'REFERRAL_LIMIT_EXCEEDED'
        };
      }

      // Calculate relationship depth
      const relationshipDepth = await this.calculateRelationshipDepth(referrerId);

      return {
        isValid: true,
        canRefer: true,
        relationshipDepth
      };

    } catch (error) {
      logger.error('Error validating referral eligibility', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId
      });

      return {
        isValid: false,
        canRefer: false,
        reason: 'Validation error occurred',
        errorCode: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Check for circular references in referral chain
   */
  async checkCircularReference(
    referrerId: string,
    referredId: string
  ): Promise<CircularReferenceCheck> {
    try {
      const visited = new Set<string>();
      const path: string[] = [];
      
      // Start from the referred user and trace back to see if we reach the referrer
      let currentUserId = referredId;
      let depth = 0;
      const maxDepth = 10; // Prevent infinite loops

      while (currentUserId && depth < maxDepth) {
        if (visited.has(currentUserId)) {
          return {
            hasCircularReference: true,
            circularPath: [...path, currentUserId],
            depth,
            reason: `Circular reference detected at user ${currentUserId}`
          };
        }

        if (currentUserId === referrerId) {
          return {
            hasCircularReference: true,
            circularPath: [...path, currentUserId],
            depth,
            reason: `Direct circular reference: ${referrerId} -> ${referredId} -> ${referrerId}`
          };
        }

        visited.add(currentUserId);
        path.push(currentUserId);

        // Get the referrer of current user
        const { data: relationship } = await this.supabase
          .from('referral_relationships')
          .select('referrer_id')
          .eq('referred_id', currentUserId)
          .eq('status', 'active')
          .single();

        currentUserId = relationship?.referrer_id || null;
        depth++;
      }

      return {
        hasCircularReference: false,
        circularPath: [],
        depth: 0,
        reason: 'No circular reference detected'
      };

    } catch (error) {
      logger.error('Error checking circular reference', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId
      });

      return {
        hasCircularReference: true,
        circularPath: [],
        depth: 0,
        reason: 'Error occurred during circular reference check'
      };
    }
  }

  /**
   * Get the complete referral chain for a user
   */
  async getReferralChain(userId: string): Promise<ReferralChain[]> {
    try {
      const chain: ReferralChain[] = [];
      const visited = new Set<string>();
      let currentUserId = userId;
      let level = 0;
      const maxLevel = 20; // Prevent infinite loops

      while (currentUserId && level < maxLevel && !visited.has(currentUserId)) {
        visited.add(currentUserId);

        // Get user info
        const userInfo = await this.getUserInfo(currentUserId);
        if (!userInfo) break;

        // Get referral count
        const referralCount = await this.getUserReferralCount(currentUserId);

        // Get referrer info
        const { data: relationship } = await this.supabase
          .from('referral_relationships')
          .select('referrer_id, created_at')
          .eq('referred_id', currentUserId)
          .eq('status', 'active')
          .single();

        chain.push({
          userId: currentUserId,
          userName: userInfo.name,
          referralCode: userInfo.referral_code || '',
          level,
          referredBy: relationship?.referrer_id || null,
          referredAt: relationship?.created_at || null,
          totalReferrals: referralCount,
          isActive: userInfo.user_status === 'active'
        });

        currentUserId = relationship?.referrer_id || null;
        level++;
      }

      return chain;

    } catch (error) {
      logger.error('Error getting referral chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return [];
    }
  }

  /**
   * Get referral relationship statistics
   */
  async getReferralRelationshipStats(): Promise<ReferralRelationshipStats> {
    try {
      // Get total relationships
      const { data: totalRelationships } = await this.supabase
        .from('referral_relationships')
        .select('id', { count: 'exact' });

      // Get active relationships
      const { data: activeRelationships } = await this.supabase
        .from('referral_relationships')
        .select('id', { count: 'exact' })
        .eq('status', 'active');

      // Get circular references
      const { data: circularRelationships } = await this.supabase
        .from('referral_relationships')
        .select('id', { count: 'exact' })
        .eq('is_circular', true);

      // Get depth statistics
      const { data: depthData } = await this.supabase
        .from('referral_relationships')
        .select('relationship_depth')
        .eq('status', 'active');

      const depths = depthData?.map(r => r.relationship_depth) || [];
      const maxDepth = Math.max(...depths, 0);
      const averageDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;

      // Get top referrers
      const { data: topReferrers } = await this.supabase
        .from('referral_relationships')
        .select(`
          referrer_id,
          users!referral_relationships_referrer_id_fkey(name),
          status
        `)
        .eq('status', 'active');

      const referrerStats = new Map<string, { total: number; active: number; name: string }>();
      topReferrers?.forEach(rel => {
        const referrerId = rel.referrer_id;
        const userName = rel.users?.[0]?.name || 'Unknown';
        
        if (!referrerStats.has(referrerId)) {
          referrerStats.set(referrerId, { total: 0, active: 0, name: userName });
        }
        
        const stats = referrerStats.get(referrerId)!;
        stats.total++;
        if (rel.status === 'active') {
          stats.active++;
        }
      });

      const topReferrersList = Array.from(referrerStats.entries())
        .map(([userId, stats]) => ({
          userId,
          userName: stats.name,
          totalReferrals: stats.total,
          activeReferrals: stats.active
        }))
        .sort((a, b) => b.totalReferrals - a.totalReferrals)
        .slice(0, 10);

      return {
        totalRelationships: totalRelationships?.length || 0,
        activeRelationships: activeRelationships?.length || 0,
        circularReferences: circularRelationships?.length || 0,
        maxDepth,
        averageDepth: Math.round(averageDepth * 100) / 100,
        topReferrers: topReferrersList
      };

    } catch (error) {
      logger.error('Error getting referral relationship stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate basic requirements for referral relationship
   */
  private async validateBasicRequirements(
    referrerId: string,
    referredId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    // Check if users exist
    const referrer = await this.getUserInfo(referrerId);
    const referred = await this.getUserInfo(referredId);

    if (!referrer) {
      return { isValid: false, reason: 'Referrer not found' };
    }

    if (!referred) {
      return { isValid: false, reason: 'Referred user not found' };
    }

    // Check if users are active
    if (referrer.user_status !== 'active') {
      return { isValid: false, reason: 'Referrer is not active' };
    }

    if (referred.user_status !== 'active') {
      return { isValid: false, reason: 'Referred user is not active' };
    }

    // Check if users are different
    if (referrerId === referredId) {
      return { isValid: false, reason: 'Cannot refer yourself' };
    }

    return { isValid: true };
  }

  /**
   * Get existing referral relationship for a user
   */
  private async getExistingRelationship(userId: string): Promise<ReferralRelationship | null> {
    try {
      const { data, error } = await this.supabase
        .from('referral_relationships')
        .select('*')
        .eq('referred_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting existing relationship', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  /**
   * Calculate relationship depth
   */
  private async calculateRelationshipDepth(referrerId: string): Promise<number> {
    try {
      let depth = 0;
      let currentUserId = referrerId;
      const visited = new Set<string>();
      const maxDepth = 20;

      while (currentUserId && depth < maxDepth && !visited.has(currentUserId)) {
        visited.add(currentUserId);
        
        const { data: relationship } = await this.supabase
          .from('referral_relationships')
          .select('referrer_id')
          .eq('referred_id', currentUserId)
          .eq('status', 'active')
          .single();

        if (!relationship) break;

        currentUserId = relationship.referrer_id;
        depth++;
      }

      return depth;
    } catch (error) {
      logger.error('Error calculating relationship depth', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId
      });
      return 0;
    }
  }

  /**
   * Get user information
   */
  private async getUserInfo(userId: string): Promise<{
    id: string;
    name: string;
    user_status: string;
    referral_code?: string;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, name, user_status, referral_code')
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error getting user info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  /**
   * Get user referral count
   */
  private async getUserReferralCount(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('referral_relationships')
        .select('id', { count: 'exact' })
        .eq('referrer_id', userId)
        .eq('status', 'active');

      if (error) {
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      logger.error('Error getting user referral count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return 0;
    }
  }

  /**
   * Update referral statistics
   */
  private async updateReferralStatistics(referrerId: string, referredId: string): Promise<void> {
    try {
      // Update referrer's total referrals count
      await this.supabase.rpc('increment_user_referral_count', {
        user_id: referrerId
      });

      logger.info('Referral statistics updated', {
        referrerId,
        referredId
      });
    } catch (error) {
      logger.error('Error updating referral statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId
      });
    }
  }
}

export const referralRelationshipService = new ReferralRelationshipService();
