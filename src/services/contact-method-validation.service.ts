/**
 * Contact Method Validation Service
 * 
 * Provides validation for different types of contact methods including
 * phone numbers, email addresses, KakaoTalk channels, social media handles, etc.
 */

import { logger } from '../utils/logger';

// Contact method types from the database enum
export type ContactMethodType = 
  | 'phone'
  | 'email'
  | 'kakaotalk_channel'
  | 'kakaotalk_id'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'naver_blog'
  | 'tiktok'
  | 'website'
  | 'whatsapp'
  | 'telegram'
  | 'discord'
  | 'custom';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalizedValue?: string;
  metadata?: Record<string, any>;
}

export interface ContactMethodValidationOptions {
  allowInternational?: boolean;
  strictMode?: boolean;
  customValidationRules?: Record<string, any>;
}

export class ContactMethodValidationService {
  private readonly validationPatterns: Record<ContactMethodType, RegExp>;
  private readonly validationOptions: ContactMethodValidationOptions;

  constructor(options: ContactMethodValidationOptions = {}) {
    this.validationOptions = {
      allowInternational: true,
      strictMode: false,
      ...options
    };

    // Initialize validation patterns
    this.validationPatterns = {
      phone: this.createPhonePattern(),
      email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      kakaotalk_channel: /^https?:\/\/(?:pf|channel)\.kakao\.com\/(_|channel\/)[a-zA-Z0-9-_]+$/,
      kakaotalk_id: /^[a-zA-Z0-9._-]{3,20}$/,
      instagram: /^https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+$/,
      facebook: /^https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+$/,
      youtube: /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:c\/|channel\/|user\/)|youtu\.be\/)[a-zA-Z0-9._-]+$/,
      naver_blog: /^https?:\/\/blog\.naver\.com\/[a-zA-Z0-9._-]+$/,
      tiktok: /^https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+$/,
      website: /^https?:\/\/(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      whatsapp: /^https?:\/\/wa\.me\/[0-9]{10,15}$/,
      telegram: /^https?:\/\/t\.me\/[a-zA-Z0-9._-]+$/,
      discord: /^https?:\/\/discord\.gg\/[a-zA-Z0-9]+$/,
      custom: /^.+$/ // Accept any non-empty string for custom types
    };
  }

  /**
   * Validate a contact method based on its type
   */
  public validateContactMethod(
    type: ContactMethodType,
    value: string,
    customOptions?: ContactMethodValidationOptions
  ): ValidationResult {
    try {
      if (!value || typeof value !== 'string') {
        return {
          isValid: false,
          error: 'Contact value is required and must be a string'
        };
      }

      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return {
          isValid: false,
          error: 'Contact value cannot be empty'
        };
      }

      // Get validation pattern for the type
      const pattern = this.validationPatterns[type];
      if (!pattern) {
        return {
          isValid: false,
          error: `Unsupported contact method type: ${type}`
        };
      }

      // Perform type-specific validation
      const validationResult = this.performTypeSpecificValidation(
        type,
        trimmedValue,
        customOptions || this.validationOptions
      );

      return validationResult;
    } catch (error) {
      logger.error('ContactMethodValidationService.validateContactMethod error:', {
        type,
        value: value?.substring(0, 50), // Log only first 50 chars for security
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        error: 'Validation failed due to an internal error'
      };
    }
  }

  /**
   * Validate multiple contact methods at once
   */
  public validateMultipleContactMethods(
    contactMethods: Array<{ type: ContactMethodType; value: string }>,
    customOptions?: ContactMethodValidationOptions
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (let i = 0; i < contactMethods.length; i++) {
      const { type, value } = contactMethods[i];
      const key = `${type}_${i}`;
      results[key] = this.validateContactMethod(type, value, customOptions);
    }

    return results;
  }

  /**
   * Normalize a contact method value based on its type
   */
  public normalizeContactMethod(type: ContactMethodType, value: string): string {
    const trimmedValue = value.trim();

    switch (type) {
      case 'phone':
        return this.normalizePhoneNumber(trimmedValue);
      case 'email':
        return this.normalizeEmail(trimmedValue);
      case 'kakaotalk_channel':
        return this.normalizeKakaoTalkChannel(trimmedValue);
      case 'instagram':
      case 'facebook':
      case 'youtube':
      case 'naver_blog':
      case 'tiktok':
      case 'website':
        return this.normalizeUrl(trimmedValue);
      case 'kakaotalk_id':
      case 'whatsapp':
      case 'telegram':
      case 'discord':
        return trimmedValue.toLowerCase();
      default:
        return trimmedValue;
    }
  }

  /**
   * Get metadata for a contact method
   */
  public getContactMethodMetadata(type: ContactMethodType, value: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      switch (type) {
        case 'kakaotalk_channel':
          metadata.channelId = this.extractKakaoTalkChannelId(value);
          metadata.channelType = this.extractKakaoTalkChannelType(value);
          break;
        case 'instagram':
          metadata.username = this.extractInstagramUsername(value);
          break;
        case 'facebook':
          metadata.pageId = this.extractFacebookPageId(value);
          break;
        case 'youtube':
          metadata.channelId = this.extractYouTubeChannelId(value);
          metadata.channelType = this.extractYouTubeChannelType(value);
          break;
        case 'website':
          metadata.domain = this.extractDomain(value);
          break;
        case 'phone':
          metadata.countryCode = this.extractCountryCode(value);
          metadata.isInternational = this.isInternationalPhone(value);
          break;
      }
    } catch (error) {
      logger.warn('ContactMethodValidationService.getContactMethodMetadata error:', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return metadata;
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private createPhonePattern(): RegExp {
    if (this.validationOptions.allowInternational) {
      // International phone number pattern (E.164 format)
      return /^\+[1-9]\d{1,14}$/;
    } else {
      // Korean phone number pattern
      return /^(010|011|016|017|018|019)-\d{3,4}-\d{4}$/;
    }
  }

  private performTypeSpecificValidation(
    type: ContactMethodType,
    value: string,
    options: ContactMethodValidationOptions
  ): ValidationResult {
    const pattern = this.validationPatterns[type];

    // Basic pattern validation
    if (!pattern.test(value)) {
      return {
        isValid: false,
        error: this.getValidationErrorMessage(type)
      };
    }

    // Type-specific validation
    switch (type) {
      case 'phone':
        return this.validatePhoneNumber(value, options);
      case 'email':
        return this.validateEmail(value, options);
      case 'kakaotalk_channel':
        return this.validateKakaoTalkChannel(value);
      case 'website':
        return this.validateWebsite(value);
      default:
        return {
          isValid: true,
          normalizedValue: this.normalizeContactMethod(type, value),
          metadata: this.getContactMethodMetadata(type, value)
        };
    }
  }

  private validatePhoneNumber(value: string, options: ContactMethodValidationOptions): ValidationResult {
    const normalizedValue = this.normalizePhoneNumber(value);
    const pattern = this.validationPatterns.phone;

    if (!pattern.test(normalizedValue)) {
      return {
        isValid: false,
        error: 'Invalid phone number format'
      };
    }

    // Additional validation for Korean numbers
    if (!options.allowInternational && !this.isKoreanPhoneNumber(normalizedValue)) {
      return {
        isValid: false,
        error: 'Only Korean phone numbers are allowed'
      };
    }

    return {
      isValid: true,
      normalizedValue,
      metadata: this.getContactMethodMetadata('phone', value)
    };
  }

  private validateEmail(value: string, options: ContactMethodValidationOptions): ValidationResult {
    const normalizedValue = this.normalizeEmail(value);
    const pattern = this.validationPatterns.email;

    if (!pattern.test(normalizedValue)) {
      return {
        isValid: false,
        error: 'Invalid email format'
      };
    }

    // Additional checks for strict mode
    if (options.strictMode) {
      if (normalizedValue.length > 254) {
        return {
          isValid: false,
          error: 'Email address is too long'
        };
      }

      const localPart = normalizedValue.split('@')[0];
      if (localPart.length > 64) {
        return {
          isValid: false,
          error: 'Email local part is too long'
        };
      }
    }

    return {
      isValid: true,
      normalizedValue,
      metadata: this.getContactMethodMetadata('email', value)
    };
  }

  private validateKakaoTalkChannel(value: string): ValidationResult {
    const normalizedValue = this.normalizeKakaoTalkChannel(value);
    const pattern = this.validationPatterns.kakaotalk_channel;

    if (!pattern.test(normalizedValue)) {
      return {
        isValid: false,
        error: 'Invalid KakaoTalk channel URL format'
      };
    }

    return {
      isValid: true,
      normalizedValue,
      metadata: this.getContactMethodMetadata('kakaotalk_channel', value)
    };
  }

  private validateWebsite(value: string): ValidationResult {
    const normalizedValue = this.normalizeUrl(value);
    const pattern = this.validationPatterns.website;

    if (!pattern.test(normalizedValue)) {
      return {
        isValid: false,
        error: 'Invalid website URL format'
      };
    }

    return {
      isValid: true,
      normalizedValue,
      metadata: this.getContactMethodMetadata('website', value)
    };
  }

  // =============================================
  // NORMALIZATION METHODS
  // =============================================

  private normalizePhoneNumber(value: string): string {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');

    // If it starts with 0, assume it's a Korean number and add +82
    if (cleaned.startsWith('0')) {
      return '+82' + cleaned.substring(1);
    }

    // If it doesn't start with +, add it
    if (!cleaned.startsWith('+')) {
      return '+' + cleaned;
    }

    return cleaned;
  }

  private normalizeEmail(value: string): string {
    return value.toLowerCase().trim();
  }

  private normalizeKakaoTalkChannel(value: string): string {
    // Ensure it starts with https://
    if (!value.startsWith('http')) {
      return 'https://' + value;
    }
    return value;
  }

  private normalizeUrl(value: string): string {
    // Ensure it starts with https://
    if (!value.startsWith('http')) {
      return 'https://' + value;
    }
    return value;
  }

  // =============================================
  // METADATA EXTRACTION METHODS
  // =============================================

  private extractKakaoTalkChannelId(value: string): string | null {
    const match = value.match(/\/(_|channel\/)([a-zA-Z0-9-_]+)$/);
    return match ? match[2] : null;
  }

  private extractKakaoTalkChannelType(value: string): string | null {
    return value.includes('/_') ? 'plus_friend' : 'channel';
  }

  private extractInstagramUsername(value: string): string | null {
    const match = value.match(/instagram\.com\/([a-zA-Z0-9._-]+)/);
    return match ? match[1] : null;
  }

  private extractFacebookPageId(value: string): string | null {
    const match = value.match(/facebook\.com\/([a-zA-Z0-9._-]+)/);
    return match ? match[1] : null;
  }

  private extractYouTubeChannelId(value: string): string | null {
    // Extract channel ID from various YouTube URL formats
    const channelMatch = value.match(/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) return channelMatch[1];

    const userMatch = value.match(/user\/([a-zA-Z0-9_-]+)/);
    if (userMatch) return userMatch[1];

    const cMatch = value.match(/\/c\/([a-zA-Z0-9_-]+)/);
    if (cMatch) return cMatch[1];

    return null;
  }

  private extractYouTubeChannelType(value: string): string | null {
    if (value.includes('/channel/')) return 'channel';
    if (value.includes('/user/')) return 'user';
    if (value.includes('/c/')) return 'custom';
    return null;
  }

  private extractDomain(value: string): string | null {
    try {
      const url = new URL(value);
      return url.hostname;
    } catch {
      return null;
    }
  }

  private extractCountryCode(value: string): string | null {
    const match = value.match(/^\+(\d{1,3})/);
    return match ? match[1] : null;
  }

  private isInternationalPhone(value: string): boolean {
    return value.startsWith('+') && !value.startsWith('+82');
  }

  private isKoreanPhoneNumber(value: string): boolean {
    return value.startsWith('+82') && value.length === 13;
  }

  private getValidationErrorMessage(type: ContactMethodType): string {
    const errorMessages: Record<ContactMethodType, string> = {
      phone: 'Invalid phone number format',
      email: 'Invalid email address format',
      kakaotalk_channel: 'Invalid KakaoTalk channel URL',
      kakaotalk_id: 'Invalid KakaoTalk ID format',
      instagram: 'Invalid Instagram URL',
      facebook: 'Invalid Facebook URL',
      youtube: 'Invalid YouTube URL',
      naver_blog: 'Invalid Naver blog URL',
      tiktok: 'Invalid TikTok URL',
      website: 'Invalid website URL',
      whatsapp: 'Invalid WhatsApp URL',
      telegram: 'Invalid Telegram URL',
      discord: 'Invalid Discord invite URL',
      custom: 'Invalid custom contact method format'
    };

    return errorMessages[type] || 'Invalid contact method format';
  }
}

// Export singleton instance
export const contactMethodValidationService = new ContactMethodValidationService();

