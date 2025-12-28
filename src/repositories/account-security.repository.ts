/**
 * Account Security Repository
 * Manages security settings for all user roles
 */

import { BaseRepository } from './base.repository';
import { AccountSecurity, UpdateAccountSecurityInput, UserRole } from '../types/unified-auth.types';
import { logger } from '../utils/logger';

export class AccountSecurityRepository extends BaseRepository<AccountSecurity> {
  protected tableName = 'account_security';

  constructor() {
    super();
  }

  /**
   * Find account security by user ID
   */
  async findByUserId(userId: string): Promise<AccountSecurity | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to find account security: ${error.message}`);
      }

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error finding account security by user ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Create account security record for new user
   */
  async createForUser(userId: string, role: UserRole): Promise<AccountSecurity> {
    try {
      const securityData = {
        user_id: userId,
        user_role: role,
        failed_login_attempts: 0,
        is_locked: false,
        require_password_change: false,
        two_factor_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(securityData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create account security: ${error.message}`);
      }

      logger.info('Account security created', {
        userId,
        role
      });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error creating account security', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Get or create account security (ensures record exists)
   */
  async getOrCreate(userId: string, role: UserRole): Promise<AccountSecurity> {
    try {
      let security = await this.findByUserId(userId);
      if (!security) {
        security = await this.createForUser(userId, role);
      }
      return security;
    } catch (error) {
      logger.error('Error getting or creating account security', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedAttempts(userId: string): Promise<AccountSecurity> {
    try {
      const security = await this.findByUserId(userId);
      if (!security) {
        throw new Error('Account security record not found');
      }

      const newFailedAttempts = security.failed_login_attempts + 1;
      const updateData: any = {
        failed_login_attempts: newFailedAttempts,
        last_failed_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Auto-lock after 5 failed attempts
      if (newFailedAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30); // Lock for 30 minutes

        updateData.is_locked = true;
        updateData.locked_until = lockUntil.toISOString();
        updateData.locked_reason = 'Too many failed login attempts';
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to increment failed attempts: ${error.message}`);
      }

      logger.info('Failed login attempts incremented', {
        userId,
        attempts: newFailedAttempts,
        locked: updateData.is_locked
      });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error incrementing failed attempts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedAttempts(userId: string): Promise<AccountSecurity> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          failed_login_attempts: 0,
          last_successful_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to reset failed attempts: ${error.message}`);
      }

      logger.info('Failed login attempts reset', { userId });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error resetting failed attempts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Lock account
   */
  async lockAccount(
    userId: string,
    reason: string,
    durationMinutes: number = 30
  ): Promise<AccountSecurity> {
    try {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + durationMinutes);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          is_locked: true,
          locked_until: lockedUntil.toISOString(),
          locked_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to lock account: ${error.message}`);
      }

      logger.warn('Account locked', {
        userId,
        reason,
        lockedUntil
      });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error locking account', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        reason
      });
      throw error;
    }
  }

  /**
   * Unlock account
   */
  async unlockAccount(userId: string): Promise<AccountSecurity> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          is_locked: false,
          locked_until: null,
          locked_reason: null,
          failed_login_attempts: 0,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to unlock account: ${error.message}`);
      }

      logger.info('Account unlocked', { userId });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error unlocking account', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    try {
      const security = await this.findByUserId(userId);
      if (!security) return false;

      if (!security.is_locked) return false;

      // Check if lock has expired
      if (security.locked_until && new Date(security.locked_until) < new Date()) {
        await this.unlockAccount(userId);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking account lock status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Update account security settings
   */
  async updateSecurity(userId: string, input: UpdateAccountSecurityInput): Promise<AccountSecurity> {
    try {
      const updateData = {
        ...input,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update account security: ${error.message}`);
      }

      logger.info('Account security updated', { userId });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error updating account security', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        input
      });
      throw error;
    }
  }

  /**
   * Auto-unlock expired locks (call auto_unlock_accounts RPC)
   */
  async autoUnlockExpired(): Promise<void> {
    try {
      await this.executeRPC('auto_unlock_accounts');
      logger.info('Expired account locks auto-unlocked');
    } catch (error) {
      logger.error('Error auto-unlocking expired locks', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(
    userId: string,
    secret: string,
    backupCodes: string[]
  ): Promise<AccountSecurity> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          two_factor_enabled: true,
          two_factor_secret: secret,
          backup_codes: backupCodes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to enable two-factor: ${error.message}`);
      }

      logger.info('Two-factor authentication enabled', { userId });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error enabling two-factor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactor(userId: string): Promise<AccountSecurity> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          backup_codes: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to disable two-factor: ${error.message}`);
      }

      logger.info('Two-factor authentication disabled', { userId });

      return data as AccountSecurity;
    } catch (error) {
      logger.error('Error disabling two-factor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }
}
