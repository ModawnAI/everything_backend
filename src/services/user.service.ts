/**
 * User Service
 * 
 * Handles user registration, profile management, and referral code functionality
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { adminUserManagementService } from './admin-user-management.service';
import { UserProfile } from '../types/social-auth.types';
import { phoneValidationService, PhoneValidationResult } from './phone-validation.service';
import { referralCodeService, ReferralCodeValidationResult } from './referral-code.service';

export interface UserRegistrationData {
  name: string;
  email?: string;
  phoneNumber: string;
  birthDate: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nickname?: string;
  referredByCode?: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export interface UserProfileUpdateData {
  name?: string;
  email?: string;
  phoneNumber?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nickname?: string;
  marketingConsent?: boolean;
}

export interface ReferralCodeInfo {
  code: string;
  userId: string;
  isValid: boolean;
  referrerInfo?: {
    id: string;
    name: string;
  };
}

export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

class UserServiceImpl {
  private supabase = getSupabaseClient();

  /**
   * Generate unique referral code using enhanced service
   */
  async generateReferralCode(): Promise<string> {
    try {
      return await referralCodeService.generateReferralCode({
        length: 8,
        excludeSimilar: true,
        excludeProfanity: true,
        maxAttempts: 50
      });
    } catch (error) {
      logger.error('Failed to generate referral code', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new UserServiceError(
        'Failed to generate unique referral code',
        'REFERRAL_CODE_GENERATION_FAILED',
        500
      );
    }
  }

  /**
   * Validate referral code and get referrer info using enhanced service
   */
  async validateReferralCode(code: string): Promise<ReferralCodeInfo> {
    try {
      const result = await referralCodeService.validateReferralCode(code);
      
      if (!result.isValid) {
        return {
          code: result.normalizedCode,
          userId: '',
          isValid: false
        };
      }

      return {
        code: result.normalizedCode,
        userId: result.referrerId || '',
        isValid: true,
        referrerInfo: result.referrerInfo ? {
          id: result.referrerInfo.id,
          name: result.referrerInfo.name
        } : undefined
      };
    } catch (error) {
      logger.error('Error validating referral code', {
        code,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        code: code.toUpperCase(),
        userId: '',
        isValid: false
      };
    }
  }

  /**
   * Validate Korean phone number format
   */
  validatePhoneNumber(phoneNumber: string): PhoneValidationResult {
    return phoneValidationService.validateKoreanPhoneNumber(phoneNumber);
  }

  /**
   * Check if phone number is already registered
   */
  async isPhoneNumberRegistered(phoneNumber: string): Promise<{
    isRegistered: boolean;
    validationResult: PhoneValidationResult;
  }> {
    try {
      // First validate the phone number format
      const validationResult = this.validatePhoneNumber(phoneNumber);
      
      if (!validationResult.isValid) {
        return {
          isRegistered: false,
          validationResult
        };
      }

      // Use normalized phone number for database check
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('phone_number', validationResult.normalized)
        .single();

      const isRegistered = !error && data !== null;

      logger.debug('Phone number registration check', {
        original: phoneNumber,
        normalized: validationResult.normalized,
        isRegistered,
        isValid: validationResult.isValid
      });

      return {
        isRegistered,
        validationResult
      };

    } catch (error) {
      logger.error('Error checking phone number registration', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isRegistered: false,
        validationResult: {
          isValid: false,
          normalized: '',
          formatted: '',
          type: 'unknown',
          errors: ['Database error occurred while checking phone number']
        }
      };
    }
  }

  /**
   * Check if phone number is already registered (legacy method for backward compatibility)
   */
  async isPhoneNumberRegisteredLegacy(phoneNumber: string): Promise<boolean> {
    const result = await this.isPhoneNumberRegistered(phoneNumber);
    return result.isRegistered;
  }

  /**
   * Check if email is already registered
   */
  async isEmailRegistered(email: string): Promise<boolean> {
    try {
             const { data, error } = await this.supabase
         .from('users')
         .select('id')
         .eq('email', email.toLowerCase())
         .single();

       return !error && data !== null;
    } catch (error) {
      logger.error('Error checking email registration', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Check if nickname is available
   */
  async isNicknameAvailable(nickname: string, excludeUserId?: string): Promise<boolean> {
    try {
      let query = this.supabase
        .from('users')
        .select('id')
        .eq('nickname', nickname);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data, error } = await query.single();

      return error && error.code === 'PGRST116'; // No rows returned means available
    } catch (error) {
      logger.error('Error checking nickname availability', {
        nickname,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Register new user
   */
  async registerUser(userId: string, registrationData: UserRegistrationData): Promise<UserProfile> {
    try {
      // Validate and normalize phone number
      const phoneCheck = await this.isPhoneNumberRegistered(registrationData.phoneNumber);
      
      if (!phoneCheck.validationResult.isValid) {
        throw new UserServiceError(
          `잘못된 휴대폰 번호 형식입니다: ${phoneCheck.validationResult.errors.join(', ')}`,
          'INVALID_PHONE_NUMBER_FORMAT',
          400
        );
      }

      if (phoneCheck.isRegistered) {
        throw new UserServiceError(
          '이미 등록된 휴대폰 번호입니다.',
          'PHONE_NUMBER_ALREADY_EXISTS',
          409
        );
      }

      const normalizedPhone = phoneCheck.validationResult.normalized;

      // Check if email is already registered (if provided)
      if (registrationData.email) {
        const emailExists = await this.isEmailRegistered(registrationData.email);
        if (emailExists) {
          throw new UserServiceError(
            '이미 등록된 이메일입니다.',
            'EMAIL_ALREADY_EXISTS',
            409
          );
        }
      }

      // Check nickname availability (if provided)
      if (registrationData.nickname) {
        const nicknameAvailable = await this.isNicknameAvailable(registrationData.nickname);
        if (!nicknameAvailable) {
          throw new UserServiceError(
            '이미 사용 중인 닉네임입니다.',
            'NICKNAME_ALREADY_EXISTS',
            409
          );
        }
      }

      // Validate referral code (if provided)
      let referralInfo: ReferralCodeInfo | null = null;
      if (registrationData.referredByCode) {
        referralInfo = await this.validateReferralCode(registrationData.referredByCode);
        if (!referralInfo.isValid) {
          throw new UserServiceError(
            '유효하지 않은 추천코드입니다.',
            'INVALID_REFERRAL_CODE',
            400
          );
        }
      }

      // Generate unique referral code for new user
      const userReferralCode = await this.generateReferralCode();

      // Prepare user data
      const userData = {
        id: userId,
        email: registrationData.email?.toLowerCase() || null,
        phone_number: normalizedPhone,
        phone_verified: false,
        name: registrationData.name.trim(),
        nickname: registrationData.nickname?.trim() || null,
        gender: registrationData.gender || null,
        birth_date: registrationData.birthDate,
        user_role: 'user' as const,
        user_status: 'active' as const,
        is_influencer: false,
        referral_code: userReferralCode,
        referred_by_code: referralInfo?.code || null,
        total_points: 0,
        available_points: 0,
        total_referrals: 0,
        successful_referrals: 0,
        last_login_at: new Date().toISOString(),
        terms_accepted_at: registrationData.termsAccepted ? new Date().toISOString() : null,
        privacy_accepted_at: registrationData.privacyAccepted ? new Date().toISOString() : null,
        marketing_consent: registrationData.marketingConsent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Begin transaction-like operations with rollback capability
      let createdUser: any = null;
      let referralCountUpdated = false;

      try {
        // Step 1: Insert user data
        const { data: user, error } = await this.supabase
          .from('users')
          .insert(userData)
          .select(`
            id,
            email,
            name,
            user_role,
            user_status,
            profile_image_url,
            phone_number,
            birth_date,
            created_at,
            updated_at
          `)
          .single();

        if (error) {
          throw new UserServiceError(
            `사용자 등록에 실패했습니다: ${error.message}`,
            'USER_REGISTRATION_FAILED',
            500
          );
        }

        createdUser = user;
        logger.info('User created successfully', { userId: user.id });

        // Step 2: Update referrer's referral count if applicable
        if (referralInfo?.isValid && referralInfo.referrerInfo) {
          try {
            await this.incrementReferralCount(referralInfo.referrerInfo.id);
            referralCountUpdated = true;
            logger.info('Referral count updated successfully', { 
              referrerId: referralInfo.referrerInfo.id,
              newUserId: user.id 
            });
          } catch (referralError) {
            logger.error('Failed to update referral count, rolling back user creation', {
              error: referralError instanceof Error ? referralError.message : 'Unknown error',
              userId: user.id,
              referrerId: referralInfo.referrerInfo.id
            });
            
            // Rollback: Delete the created user
            await this.rollbackUserCreation(user.id);
            
            throw new UserServiceError(
              '추천인 정보 업데이트에 실패했습니다. 등록이 취소되었습니다.',
              'REFERRAL_UPDATE_FAILED',
              500
            );
          }
        }

        // Step 3: Create user settings with default preferences
        try {
          const defaultSettings = {
            user_id: user.id,
            push_notifications_enabled: true,
            reservation_notifications: true,
            event_notifications: true,
            marketing_notifications: registrationData.marketingConsent || false,
            location_tracking_enabled: true,
            language_preference: 'ko',
            currency_preference: 'KRW',
            theme_preference: 'light',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error: settingsError } = await this.supabase
            .from('user_settings')
            .insert(defaultSettings);

          if (settingsError) {
            logger.error('Failed to create user settings, rolling back user creation', {
              error: settingsError.message,
              userId: user.id
            });
            
            // Rollback: Delete the created user and any referral updates
            await this.rollbackUserCreation(user.id);
            if (referralCountUpdated && referralInfo?.referrerInfo) {
              await this.decrementReferralCount(referralInfo.referrerInfo.id);
            }
            
            throw new UserServiceError(
              '사용자 설정 생성에 실패했습니다. 등록이 취소되었습니다.',
              'USER_SETTINGS_CREATION_FAILED',
              500
            );
          }

          logger.info('User settings created successfully', { userId: user.id });
        } catch (settingsError) {
          logger.error('Failed to create user settings, rolling back registration', {
            error: settingsError instanceof Error ? settingsError.message : 'Unknown error',
            userId: user.id
          });
          
          // Rollback user creation and referral updates
          await this.rollbackUserCreation(user.id);
          if (referralCountUpdated && referralInfo?.referrerInfo) {
            await this.decrementReferralCount(referralInfo.referrerInfo.id);
          }
          
          throw settingsError instanceof UserServiceError ? settingsError : new UserServiceError(
            '사용자 설정 생성 중 오류가 발생했습니다. 등록이 취소되었습니다.',
            'USER_SETTINGS_ERROR',
            500
          );
        }

        logger.info('User registration transaction completed successfully', {
          userId: user.id,
          hasReferrer: !!referralInfo?.isValid,
          referrerUserId: referralInfo?.referrerInfo?.id,
          referralCountUpdated
        });

        // Send welcome notification to new user
        try {
          await adminUserManagementService.sendWelcomeNotification(user.id, user.name);
        } catch (notificationError) {
          // Don't fail registration if notification fails
          logger.warn('Failed to send welcome notification', {
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
            userId: user.id
          });
        }

        return {
          id: user.id,
          email: user.email || '',
          name: user.name,
          user_role: user.user_role,
          user_status: user.user_status,
          profile_image_url: user.profile_image_url,
          phone: user.phone_number,
          birth_date: user.birth_date,
          created_at: user.created_at,
          updated_at: user.updated_at
        };

      } catch (transactionError) {
        // If we have a created user but something failed later, attempt rollback
        if (createdUser && !referralCountUpdated) {
          logger.error('Registration transaction failed, attempting rollback', {
            error: transactionError instanceof Error ? transactionError.message : 'Unknown error',
            userId: createdUser.id
          });
          
          try {
            await this.rollbackUserCreation(createdUser.id);
            logger.info('User creation rollback completed', { userId: createdUser.id });
          } catch (rollbackError) {
            logger.error('Failed to rollback user creation', {
              error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
              userId: createdUser.id
            });
            // Continue to throw the original error
          }
        }
        
        // Re-throw the original error or the UserServiceError we created
        throw transactionError;
      }
    } catch (error) {
      logger.error('User registration failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof UserServiceError) {
        throw error;
      }

      throw new UserServiceError(
        '사용자 등록 중 오류가 발생했습니다.',
        'USER_REGISTRATION_ERROR',
        500
      );
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateData: UserProfileUpdateData): Promise<UserProfile> {
    try {
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // Handle phone number normalization
      if (updateData.phoneNumber) {
        const normalizedPhone = updateData.phoneNumber.replace(/[-.\s]/g, '');
        const phoneExists = await this.isPhoneNumberRegistered(normalizedPhone);
        if (phoneExists) {
          // Check if it's the same user's phone
          const { data: existingUser } = await this.supabase
            .from('users')
            .select('id')
            .eq('phone_number', normalizedPhone)
            .single();

          if (existingUser && existingUser.id !== userId) {
            throw new UserServiceError(
              '이미 등록된 휴대폰 번호입니다.',
              'PHONE_NUMBER_ALREADY_EXISTS',
              409
            );
          }
        }
        updates.phone_number = normalizedPhone;
        updates.phone_verified = false; // Reset verification when phone changes
      }

      // Handle email normalization
      if (updateData.email) {
        const emailExists = await this.isEmailRegistered(updateData.email);
        if (emailExists) {
          // Check if it's the same user's email
          const { data: existingUser } = await this.supabase
            .from('users')
            .select('id')
            .eq('email', updateData.email.toLowerCase())
            .single();

          if (existingUser && existingUser.id !== userId) {
            throw new UserServiceError(
              '이미 등록된 이메일입니다.',
              'EMAIL_ALREADY_EXISTS',
              409
            );
          }
        }
        updates.email = updateData.email.toLowerCase();
      }

      // Handle nickname
      if (updateData.nickname) {
        const nicknameAvailable = await this.isNicknameAvailable(updateData.nickname, userId);
        if (!nicknameAvailable) {
          throw new UserServiceError(
            '이미 사용 중인 닉네임입니다.',
            'NICKNAME_ALREADY_EXISTS',
            409
          );
        }
        updates.nickname = updateData.nickname.trim();
      }

      // Handle other fields
      if (updateData.name) updates.name = updateData.name.trim();
      if (updateData.birthDate) updates.birth_date = updateData.birthDate;
      if (updateData.gender) updates.gender = updateData.gender;
      if (updateData.marketingConsent !== undefined) updates.marketing_consent = updateData.marketingConsent;

      // Update user
      const { data: user, error } = await this.supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select(`
          id,
          email,
          name,
          user_role,
          user_status,
          profile_image_url,
          phone_number,
          birth_date,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        throw new UserServiceError(
          `프로필 업데이트에 실패했습니다: ${error.message}`,
          'PROFILE_UPDATE_FAILED',
          500
        );
      }

      logger.info('User profile updated successfully', {
        userId: user.id,
        updatedFields: Object.keys(updates)
      });

      return {
        id: user.id,
        email: user.email || '',
        name: user.name,
        user_role: user.user_role,
        user_status: user.user_status,
        profile_image_url: user.profile_image_url,
        phone: user.phone_number,
        birth_date: user.birth_date,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    } catch (error) {
      logger.error('Profile update failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof UserServiceError) {
        throw error;
      }

      throw new UserServiceError(
        '프로필 업데이트 중 오류가 발생했습니다.',
        'PROFILE_UPDATE_ERROR',
        500
      );
    }
  }

  /**
   * Increment referral count for referrer
   */
  private async incrementReferralCount(referrerId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          total_referrals: this.supabase.rpc('increment_referrals', { user_id: referrerId }),
          updated_at: new Date().toISOString()
        })
        .eq('id', referrerId);

      if (error) {
        logger.warn('Failed to increment referral count', {
          referrerId,
          error: error.message
        });
      }
    } catch (error) {
      logger.warn('Error incrementing referral count', {
        referrerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Decrement referral count for a user (used in rollback scenarios)
   */
  private async decrementReferralCount(referrerId: string): Promise<void> {
    try {
      // First get the current referral count
      const { data: currentUser, error: fetchError } = await this.supabase
        .from('users')
        .select('total_referrals')
        .eq('id', referrerId)
        .single();

      if (fetchError || !currentUser || currentUser.total_referrals <= 0) {
        logger.warn('Cannot decrement referral count - user not found or count already zero', {
          referrerId,
          currentCount: currentUser?.total_referrals || 0
        });
        return;
      }

      const { error } = await this.supabase
        .from('users')
        .update({
          total_referrals: currentUser.total_referrals - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', referrerId);

      if (error) {
        logger.error('Failed to decrement referral count', {
          referrerId,
          error: error.message
        });
        throw error;
      }

      logger.info('Referral count decremented successfully', { referrerId });
    } catch (error) {
      logger.warn('Error decrementing referral count', {
        referrerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Rollback user creation by deleting the user record
   * Used for transaction rollback when registration fails
   */
  private async rollbackUserCreation(userId: string): Promise<void> {
    try {
      logger.warn('Attempting to rollback user creation', { userId });

      // Delete user record
      const { error: deleteError } = await this.supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete user during rollback: ${deleteError.message}`);
      }

      // Also clean up any related records that might have been created
      // (user settings, phone verifications, sessions, etc.)
      try {
        await this.supabase
          .from('user_settings')
          .delete()
          .eq('user_id', userId);

        await this.supabase
          .from('phone_verifications')
          .delete()
          .eq('user_id', userId);

        await this.supabase
          .from('refresh_tokens')
          .delete()
          .eq('user_id', userId);

        logger.info('User rollback completed successfully', { userId });
      } catch (cleanupError) {
        // Log cleanup errors but don't fail the rollback
        logger.warn('Some cleanup operations failed during rollback', {
          userId,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
        });
      }

    } catch (error) {
      logger.error('Failed to rollback user creation', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          user_role,
          user_status,
          profile_image_url,
          phone_number,
          birth_date,
          created_at,
          updated_at
        `)
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }

      return {
        id: user.id,
        email: user.email || '',
        name: user.name,
        user_role: user.user_role,
        user_status: user.user_status,
        profile_image_url: user.profile_image_url,
        phone: user.phone_number,
        birth_date: user.birth_date,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    } catch (error) {
      logger.error('Error getting user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}

// Export singleton instance
export const userService = new UserServiceImpl();

// Export class for testing
export { UserServiceImpl }; 