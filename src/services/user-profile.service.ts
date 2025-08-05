/**
 * User Profile Management Service
 * 
 * Handles comprehensive user profile operations including:
 * - Profile CRUD operations
 * - Profile image upload and management
 * - Privacy settings management
 * - Profile completion tracking
 * - Data validation and sanitization
 */

import { getSupabaseClient } from '../config/database';
import { User, UserSettings } from '../types/database.types';
import { logger } from '../utils/logger';

// Profile completion requirements
export interface ProfileCompletionRequirements {
  hasName: boolean;
  hasPhone: boolean;
  hasPhoneVerified: boolean;
  hasGender: boolean;
  hasBirthDate: boolean;
  hasProfileImage: boolean;
  hasTermsAccepted: boolean;
  hasPrivacyAccepted: boolean;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  requirements: ProfileCompletionRequirements;
}

export interface ProfileUpdateRequest {
  name?: string;
  nickname?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birth_date?: string;
  profile_image_url?: string;
  marketing_consent?: boolean;
}

export interface PrivacySettingsUpdateRequest {
  push_notifications_enabled?: boolean;
  reservation_notifications?: boolean;
  event_notifications?: boolean;
  marketing_notifications?: boolean;
  location_tracking_enabled?: boolean;
  language_preference?: string;
  currency_preference?: string;
  theme_preference?: string;
}

export interface ProfileImageUploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export class UserProfileService {
  private supabase = getSupabaseClient();

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error fetching user profile:', { userId, error });
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error('UserProfileService.getUserProfile error:', { userId, error });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: ProfileUpdateRequest): Promise<User> {
    try {
      // Validate updates
      this.validateProfileUpdates(updates);

      // Check if user exists
      const existingUser = await this.getUserProfile(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prepare update data
      const updateData: Partial<User> = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user profile:', { userId, error });
        throw new Error(`Failed to update user profile: ${error.message}`);
      }

      logger.info('User profile updated successfully:', { userId, updatedFields: Object.keys(updates) });
      return data;
    } catch (error) {
      logger.error('UserProfileService.updateUserProfile error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get user privacy settings
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error fetching user settings:', { userId, error });
        throw new Error(`Failed to fetch user settings: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error('UserProfileService.getUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Update user privacy settings
   */
  async updateUserSettings(userId: string, updates: PrivacySettingsUpdateRequest): Promise<UserSettings | null> {
    try {
      // Validate settings updates
      this.validateSettingsUpdates(updates);

      // Check if settings exist, create if not
      let existingSettings: UserSettings | null = await this.getUserSettings(userId);
      
      if (!existingSettings) {
        // Create default settings
        const { data: newSettings, error: createError } = await this.supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            ...updates
          })
          .select()
          .single();

        if (createError) {
          logger.error('Error creating user settings:', { userId, error: createError });
          throw new Error(`Failed to create user settings: ${createError.message}`);
        }

        existingSettings = newSettings;
      } else {
        // Update existing settings
        const { data, error } = await this.supabase
          .from('user_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          logger.error('Error updating user settings:', { userId, error });
          throw new Error(`Failed to update user settings: ${error.message}`);
        }

        if (!data) {
          throw new Error('Failed to update user settings: No data returned');
        }

        existingSettings = data;
      }

      logger.info('User settings updated successfully:', { userId, updatedFields: Object.keys(updates) });
      return existingSettings;
    } catch (error) {
      logger.error('UserProfileService.updateUserSettings error:', { userId, error });
      throw error;
    }
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletionStatus(userId: string): Promise<ProfileCompletionStatus> {
    try {
      const user = await this.getUserProfile(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const requirements: ProfileCompletionRequirements = {
        hasName: !!user.name && user.name.trim().length > 0,
        hasPhone: !!user.phone_number,
        hasPhoneVerified: user.phone_verified,
        hasGender: !!user.gender,
        hasBirthDate: !!user.birth_date,
        hasProfileImage: !!user.profile_image_url,
        hasTermsAccepted: !!user.terms_accepted_at,
        hasPrivacyAccepted: !!user.privacy_accepted_at
      };

      const totalRequirements = Object.keys(requirements).length;
      const completedRequirements = Object.values(requirements).filter(Boolean).length;
      const completionPercentage = Math.round((completedRequirements / totalRequirements) * 100);

      const missingFields = Object.entries(requirements)
        .filter(([_, completed]) => !completed)
        .map(([field, _]) => field.replace('has', '').toLowerCase());

      return {
        isComplete: completionPercentage === 100,
        completionPercentage,
        missingFields,
        requirements
      };
    } catch (error) {
      logger.error('UserProfileService.getProfileCompletionStatus error:', { userId, error });
      throw error;
    }
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(userId: string, imageBuffer: Buffer, fileName: string): Promise<ProfileImageUploadResult> {
    try {
      // Validate file
      this.validateImageFile(imageBuffer, fileName);

      // Generate unique filename
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      const uniqueFileName = `profile-${userId}-${Date.now()}.${fileExtension}`;
      const filePath = `profile-images/${uniqueFileName}`;

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from('profile-images')
        .upload(filePath, imageBuffer, {
          contentType: this.getContentType(fileExtension),
          upsert: false
        });

      if (error) {
        logger.error('Error uploading profile image:', { userId, error });
        return {
          success: false,
          error: `Failed to upload image: ${error.message}`
        };
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      // Update user profile with new image URL
      await this.updateUserProfile(userId, { profile_image_url: imageUrl });

      logger.info('Profile image uploaded successfully:', { userId, imageUrl });
      return {
        success: true,
        imageUrl
      };
    } catch (error) {
      logger.error('UserProfileService.uploadProfileImage error:', { userId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteUserAccount(userId: string, reason?: string): Promise<void> {
    try {
      // Check if user exists
      const existingUser = await this.getUserProfile(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Soft delete user
      const { error } = await this.supabase
        .from('users')
        .update({
          user_status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error deleting user account:', { userId, error });
        throw new Error(`Failed to delete user account: ${error.message}`);
      }

      // Log the deletion
      logger.info('User account deleted successfully:', { userId, reason });

      // TODO: Implement additional cleanup tasks
      // - Cancel active reservations
      // - Process refunds if needed
      // - Archive user data
      // - Send confirmation email
    } catch (error) {
      logger.error('UserProfileService.deleteUserAccount error:', { userId, error });
      throw error;
    }
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error accepting terms:', { userId, error });
        throw new Error(`Failed to accept terms: ${error.message}`);
      }

      logger.info('Terms accepted successfully:', { userId });
    } catch (error) {
      logger.error('UserProfileService.acceptTerms error:', { userId, error });
      throw error;
    }
  }

  /**
   * Accept privacy policy
   */
  async acceptPrivacy(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          privacy_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error accepting privacy policy:', { userId, error });
        throw new Error(`Failed to accept privacy policy: ${error.message}`);
      }

      logger.info('Privacy policy accepted successfully:', { userId });
    } catch (error) {
      logger.error('UserProfileService.acceptPrivacy error:', { userId, error });
      throw error;
    }
  }

  /**
   * Validate profile updates
   */
  private validateProfileUpdates(updates: ProfileUpdateRequest): void {
    if (updates.name !== undefined) {
      if (!updates.name.trim() || updates.name.length > 100) {
        throw new Error('Name must be between 1 and 100 characters');
      }
    }

    if (updates.nickname !== undefined) {
      if (updates.nickname.length > 50) {
        throw new Error('Nickname must be 50 characters or less');
      }
    }

    if (updates.birth_date !== undefined) {
      const birthDate = new Date(updates.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (isNaN(birthDate.getTime())) {
        throw new Error('Invalid birth date format');
      }
      
      if (age < 14) {
        throw new Error('User must be at least 14 years old');
      }
      
      if (age > 120) {
        throw new Error('Invalid birth date');
      }
    }

    if (updates.gender !== undefined) {
      const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
      if (!validGenders.includes(updates.gender)) {
        throw new Error('Invalid gender selection');
      }
    }
  }

  /**
   * Validate settings updates
   */
  private validateSettingsUpdates(updates: PrivacySettingsUpdateRequest): void {
    if (updates.language_preference !== undefined) {
      const validLanguages = ['ko', 'en', 'ja', 'zh'];
      if (!validLanguages.includes(updates.language_preference)) {
        throw new Error('Invalid language preference');
      }
    }

    if (updates.currency_preference !== undefined) {
      const validCurrencies = ['KRW', 'USD', 'JPY', 'CNY'];
      if (!validCurrencies.includes(updates.currency_preference)) {
        throw new Error('Invalid currency preference');
      }
    }

    if (updates.theme_preference !== undefined) {
      const validThemes = ['light', 'dark', 'auto'];
      if (!validThemes.includes(updates.theme_preference)) {
        throw new Error('Invalid theme preference');
      }
    }
  }

  /**
   * Validate image file
   */
  private validateImageFile(imageBuffer: Buffer, fileName: string): void {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (imageBuffer.length > maxSize) {
      throw new Error('Image file size must be less than 5MB');
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new Error('Only JPG, PNG, and WebP images are allowed');
    }
  }

  /**
   * Get content type for file extension
   */
  private getContentType(extension?: string): string {
    switch (extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
}

export const userProfileService = new UserProfileService(); 