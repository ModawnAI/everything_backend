/**
 * User Service
 * 
 * Handles user registration, profile management, and referral code functionality
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { UserProfile } from '../types/social-auth.types';

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
   * Generate unique referral code
   */
  async generateReferralCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Check if code is unique
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('referral_code', code)
        .single();

      if (error && error.code === 'PGRST116') { // No rows returned
        return code;
      }

      attempts++;
    }

    throw new UserServiceError(
      'Failed to generate unique referral code',
      'REFERRAL_CODE_GENERATION_FAILED',
      500
    );
  }

  /**
   * Validate referral code and get referrer info
   */
  async validateReferralCode(code: string): Promise<ReferralCodeInfo> {
    try {
      const { data: referrer, error } = await this.supabase
        .from('users')
        .select('id, name, user_status')
        .eq('referral_code', code.toUpperCase())
        .eq('user_status', 'active')
        .single();

      if (error || !referrer) {
        return {
          code: code.toUpperCase(),
          userId: '',
          isValid: false
        };
      }

      return {
        code: code.toUpperCase(),
        userId: referrer.id,
        isValid: true,
        referrerInfo: {
          id: referrer.id,
          name: referrer.name
        }
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
   * Check if phone number is already registered
   */
  async isPhoneNumberRegistered(phoneNumber: string): Promise<boolean> {
    try {
      // Normalize phone number (remove dots and hyphens)
      const normalizedPhone = phoneNumber.replace(/[-.\s]/g, '');

             const { data, error } = await this.supabase
         .from('users')
         .select('id')
         .eq('phone_number', normalizedPhone)
         .single();

       return !error && data !== null;
    } catch (error) {
      logger.error('Error checking phone number registration', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
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
      // Normalize phone number
      const normalizedPhone = registrationData.phoneNumber.replace(/[-.\s]/g, '');

      // Check if phone number is already registered
      const phoneExists = await this.isPhoneNumberRegistered(normalizedPhone);
      if (phoneExists) {
        throw new UserServiceError(
          '이미 등록된 휴대폰 번호입니다.',
          'PHONE_NUMBER_ALREADY_EXISTS',
          409
        );
      }

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

      // Insert user data
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

      // Update referrer's referral count if applicable
      if (referralInfo?.isValid && referralInfo.referrerInfo) {
        await this.incrementReferralCount(referralInfo.referrerInfo.id);
      }

      logger.info('User registered successfully', {
        userId: user.id,
        hasReferrer: !!referralInfo?.isValid,
        referrerUserId: referralInfo?.referrerInfo?.id
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