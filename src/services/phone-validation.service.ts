/**
 * Korean Phone Number Validation Service
 * 
 * Comprehensive phone number validation for Korean mobile numbers
 * with normalization, format validation, and carrier detection
 */

import { logger } from '../utils/logger';

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  formatted: string;
  carrier?: string;
  type: 'mobile' | 'landline' | 'unknown';
  errors: string[];
}

export interface KoreanPhoneCarrier {
  name: string;
  prefixes: string[];
  type: 'mobile' | 'landline';
}

/**
 * Korean Phone Number Validation Service
 */
export class PhoneValidationService {
  // Korean mobile carriers and their prefixes
  private readonly koreanCarriers: KoreanPhoneCarrier[] = [
    {
      name: 'SKT',
      prefixes: ['010', '011', '016', '017', '018', '019'],
      type: 'mobile'
    },
    {
      name: 'KT',
      prefixes: ['010', '016', '017', '018', '019'],
      type: 'mobile'
    },
    {
      name: 'LG U+',
      prefixes: ['010', '016', '017', '018', '019'],
      type: 'mobile'
    },
    {
      name: 'Seoul Landline',
      prefixes: ['02'],
      type: 'landline'
    },
    {
      name: 'Regional Landline',
      prefixes: ['031', '032', '033', '041', '042', '043', '044', '051', '052', '053', '054', '055', '061', '062', '063', '064'],
      type: 'landline'
    }
  ];

  // Korean mobile number regex patterns
  private readonly patterns = {
    // Mobile: 010-XXXX-XXXX, 01X-XXX-XXXX, 01X-XXXX-XXXX
    mobile: /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/,
    // Landline: 02-XXX-XXXX, 02-XXXX-XXXX, 0XX-XXX-XXXX, 0XX-XXXX-XXXX
    landline: /^0(2|[3-6][1-4])-?[0-9]{3,4}-?[0-9]{4}$/,
    // International format: +82-XX-XXXX-XXXX
    international: /^\+82-?[1-9][0-9]-?[0-9]{3,4}-?[0-9]{4}$/
  };

  /**
   * Validate Korean phone number with comprehensive checks
   */
  validateKoreanPhoneNumber(phoneNumber: string): PhoneValidationResult {
    const errors: string[] = [];
    let isValid = false;
    let normalized = '';
    let formatted = '';
    let carrier: string | undefined;
    let type: 'mobile' | 'landline' | 'unknown' = 'unknown';

    try {
      // Basic validation
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        errors.push('Phone number is required and must be a string');
        return { isValid: false, normalized: '', formatted: '', type: 'unknown', errors };
      }

      // Normalize phone number (remove spaces, dots, hyphens, parentheses)
      normalized = this.normalizePhoneNumber(phoneNumber);

      // Check if it's an international format
      if (phoneNumber.startsWith('+82')) {
        const result = this.validateInternationalFormat(phoneNumber);
        if (result.isValid) {
          normalized = result.normalized;
          formatted = result.formatted;
          type = result.type;
          carrier = result.carrier;
          isValid = true;
        } else {
          errors.push(...result.errors);
        }
      } else {
        // Validate domestic format
        const result = this.validateDomesticFormat(normalized);
        if (result.isValid) {
          formatted = result.formatted;
          type = result.type;
          carrier = result.carrier;
          isValid = true;
        } else {
          errors.push(...result.errors);
        }
      }

      // Additional validation rules
      if (isValid) {
        const additionalValidation = this.performAdditionalValidation(normalized, type);
        if (!additionalValidation.isValid) {
          errors.push(...additionalValidation.errors);
          isValid = false;
        }
      }

      logger.debug('Phone validation completed', {
        original: phoneNumber,
        normalized,
        formatted,
        isValid,
        type,
        carrier,
        errors
      });

      return {
        isValid,
        normalized,
        formatted,
        carrier,
        type,
        errors
      };

    } catch (error) {
      logger.error('Phone validation error', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        normalized: '',
        formatted: '',
        type: 'unknown',
        errors: ['Phone validation failed due to internal error']
      };
    }
  }

  /**
   * Normalize phone number by removing formatting characters
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber
      .replace(/[\s\-\.\(\)\+]/g, '') // Remove spaces, hyphens, dots, parentheses, plus
      .replace(/^82/, '0') // Convert international prefix to domestic
      .trim();
  }

  /**
   * Validate international format (+82-XX-XXXX-XXXX)
   */
  private validateInternationalFormat(phoneNumber: string): PhoneValidationResult {
    const errors: string[] = [];
    
    if (!this.patterns.international.test(phoneNumber)) {
      errors.push('Invalid international phone number format. Expected: +82-XX-XXXX-XXXX');
      return { isValid: false, normalized: '', formatted: '', type: 'unknown', errors };
    }

    // Convert to domestic format for further validation
    const domesticNumber = phoneNumber.replace(/^\+82-?/, '0');
    const normalized = this.normalizePhoneNumber(domesticNumber);
    
    const domesticResult = this.validateDomesticFormat(normalized);
    
    return {
      ...domesticResult,
      formatted: this.formatInternational(normalized)
    };
  }

  /**
   * Validate domestic format (0XX-XXXX-XXXX)
   */
  private validateDomesticFormat(normalized: string): PhoneValidationResult {
    const errors: string[] = [];
    let type: 'mobile' | 'landline' | 'unknown' = 'unknown';
    let carrier: string | undefined;

    // Check length
    if (normalized.length < 10 || normalized.length > 11) {
      errors.push('Phone number must be 10-11 digits long');
      return { isValid: false, normalized, formatted: '', type: 'unknown', errors };
    }

    // Must start with 0
    if (!normalized.startsWith('0')) {
      errors.push('Korean phone numbers must start with 0');
      return { isValid: false, normalized, formatted: '', type: 'unknown', errors };
    }

    // Extract prefix (first 2-3 digits)
    const prefix2 = normalized.substring(0, 2);
    const prefix3 = normalized.substring(0, 3);

    // Check mobile patterns
    if (this.patterns.mobile.test(this.addHyphens(normalized))) {
      type = 'mobile';
      carrier = this.detectMobileCarrier(prefix3);
      
      // Additional mobile validation
      if (prefix3 === '010' && normalized.length !== 11) {
        errors.push('010 numbers must be exactly 11 digits');
      } else if (prefix3 !== '010' && normalized.length !== 10) {
        errors.push('01X numbers must be exactly 10 digits');
      }
    }
    // Check landline patterns
    else if (this.patterns.landline.test(this.addHyphens(normalized))) {
      type = 'landline';
      carrier = this.detectLandlineCarrier(prefix2, prefix3);
      
      // Landline validation
      if (prefix2 === '02' && normalized.length < 9) {
        errors.push('Seoul landline numbers must be at least 9 digits');
      } else if (prefix2 !== '02' && normalized.length < 10) {
        errors.push('Regional landline numbers must be at least 10 digits');
      }
    } else {
      errors.push('Invalid Korean phone number format');
    }

    // Format the number
    const formatted = this.formatDomestic(normalized, type);

    return {
      isValid: errors.length === 0,
      normalized,
      formatted,
      carrier,
      type,
      errors
    };
  }

  /**
   * Perform additional validation rules
   */
  private performAdditionalValidation(normalized: string, type: 'mobile' | 'landline' | 'unknown'): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for sequential numbers (e.g., 01012345678)
    if (this.hasSequentialDigits(normalized)) {
      errors.push('Phone number contains too many sequential digits');
    }

    // Check for repeated digits (e.g., 01011111111)
    if (this.hasRepeatedDigits(normalized)) {
      errors.push('Phone number contains too many repeated digits');
    }

    // Check for known invalid patterns
    if (this.isKnownInvalidPattern(normalized)) {
      errors.push('Phone number matches known invalid pattern');
    }

    // Mobile-specific validation
    if (type === 'mobile') {
      // Check if it's a valid mobile prefix
      const prefix = normalized.substring(0, 3);
      const validMobilePrefixes = ['010', '011', '016', '017', '018', '019'];
      if (!validMobilePrefixes.includes(prefix)) {
        errors.push('Invalid mobile phone prefix');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Detect mobile carrier based on prefix
   */
  private detectMobileCarrier(prefix: string): string | undefined {
    // Note: In Korea, number portability means we can't definitively determine carrier from prefix
    // But we can provide historical/general information
    const carrierMap: Record<string, string> = {
      '010': 'Mobile (All Carriers)',
      '011': 'SKT (Legacy)',
      '016': 'KT (Legacy)',
      '017': 'SKT (Legacy)',
      '018': 'LG U+ (Legacy)',
      '019': 'SKT (Legacy)'
    };

    return carrierMap[prefix];
  }

  /**
   * Detect landline carrier/region based on prefix
   */
  private detectLandlineCarrier(prefix2: string, prefix3: string): string | undefined {
    const regionMap: Record<string, string> = {
      '02': 'Seoul',
      '031': 'Gyeonggi',
      '032': 'Incheon',
      '033': 'Gangwon',
      '041': 'Chungnam',
      '042': 'Daejeon',
      '043': 'Chungbuk',
      '044': 'Sejong',
      '051': 'Busan',
      '052': 'Ulsan',
      '053': 'Daegu',
      '054': 'Gyeongbuk',
      '055': 'Gyeongnam',
      '061': 'Jeonnam',
      '062': 'Gwangju',
      '063': 'Jeonbuk',
      '064': 'Jeju'
    };

    return regionMap[prefix3] || regionMap[prefix2];
  }

  /**
   * Format domestic phone number with hyphens
   */
  private formatDomestic(normalized: string, type: 'mobile' | 'landline' | 'unknown'): string {
    if (type === 'mobile') {
      if (normalized.startsWith('010') && normalized.length === 11) {
        // 010-XXXX-XXXX
        return `${normalized.substring(0, 3)}-${normalized.substring(3, 7)}-${normalized.substring(7)}`;
      } else if (normalized.length === 10) {
        // 01X-XXX-XXXX
        return `${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`;
      }
    } else if (type === 'landline') {
      if (normalized.startsWith('02')) {
        if (normalized.length === 9) {
          // 02-XXX-XXXX
          return `${normalized.substring(0, 2)}-${normalized.substring(2, 5)}-${normalized.substring(5)}`;
        } else if (normalized.length === 10) {
          // 02-XXXX-XXXX
          return `${normalized.substring(0, 2)}-${normalized.substring(2, 6)}-${normalized.substring(6)}`;
        }
      } else {
        if (normalized.length === 10) {
          // 0XX-XXX-XXXX
          return `${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`;
        } else if (normalized.length === 11) {
          // 0XX-XXXX-XXXX
          return `${normalized.substring(0, 3)}-${normalized.substring(3, 7)}-${normalized.substring(7)}`;
        }
      }
    }

    // Fallback formatting
    return this.addHyphens(normalized);
  }

  /**
   * Format international phone number
   */
  private formatInternational(normalized: string): string {
    const domestic = this.formatDomestic(normalized, normalized.startsWith('010') ? 'mobile' : 'landline');
    return `+82-${domestic.substring(1)}`; // Remove leading 0 and add +82
  }

  /**
   * Add hyphens to phone number for pattern matching
   */
  private addHyphens(normalized: string): string {
    if (normalized.length === 11 && normalized.startsWith('010')) {
      return `${normalized.substring(0, 3)}-${normalized.substring(3, 7)}-${normalized.substring(7)}`;
    } else if (normalized.length === 10) {
      if (normalized.startsWith('02')) {
        return `${normalized.substring(0, 2)}-${normalized.substring(2, 6)}-${normalized.substring(6)}`;
      } else {
        return `${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`;
      }
    }
    return normalized;
  }

  /**
   * Check for sequential digits
   */
  private hasSequentialDigits(phoneNumber: string): boolean {
    let sequentialCount = 1;
    for (let i = 1; i < phoneNumber.length; i++) {
      const current = parseInt(phoneNumber[i]);
      const previous = parseInt(phoneNumber[i - 1]);
      
      if (current === previous + 1 || current === previous - 1) {
        sequentialCount++;
        if (sequentialCount >= 4) { // 4 or more sequential digits
          return true;
        }
      } else {
        sequentialCount = 1;
      }
    }
    return false;
  }

  /**
   * Check for repeated digits
   */
  private hasRepeatedDigits(phoneNumber: string): boolean {
    const digitCounts: Record<string, number> = {};
    
    for (const digit of phoneNumber) {
      digitCounts[digit] = (digitCounts[digit] || 0) + 1;
      if (digitCounts[digit] >= 6) { // 6 or more of the same digit
        return true;
      }
    }

    // Check for patterns like 1111, 2222, etc.
    for (let i = 0; i <= phoneNumber.length - 4; i++) {
      const fourDigits = phoneNumber.substring(i, i + 4);
      if (fourDigits[0] === fourDigits[1] && fourDigits[1] === fourDigits[2] && fourDigits[2] === fourDigits[3]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for known invalid patterns
   */
  private isKnownInvalidPattern(phoneNumber: string): boolean {
    const invalidPatterns = [
      /^0{10,11}$/, // All zeros
      /^1{10,11}$/, // All ones
      /^01012345678$/, // Sequential test number
      /^01087654321$/, // Reverse sequential
      /^0101234567[89]$/, // Common test patterns
    ];

    return invalidPatterns.some(pattern => pattern.test(phoneNumber));
  }

  /**
   * Quick validation for mobile numbers only
   */
  isMobileNumber(phoneNumber: string): boolean {
    const result = this.validateKoreanPhoneNumber(phoneNumber);
    return result.isValid && result.type === 'mobile';
  }

  /**
   * Quick validation for landline numbers only
   */
  isLandlineNumber(phoneNumber: string): boolean {
    const result = this.validateKoreanPhoneNumber(phoneNumber);
    return result.isValid && result.type === 'landline';
  }

  /**
   * Get normalized phone number (for database storage)
   */
  getNormalizedPhoneNumber(phoneNumber: string): string | null {
    const result = this.validateKoreanPhoneNumber(phoneNumber);
    return result.isValid ? result.normalized : null;
  }

  /**
   * Get formatted phone number (for display)
   */
  getFormattedPhoneNumber(phoneNumber: string): string | null {
    const result = this.validateKoreanPhoneNumber(phoneNumber);
    return result.isValid ? result.formatted : null;
  }

  /**
   * Validate multiple phone numbers
   */
  validateMultiplePhoneNumbers(phoneNumbers: string[]): PhoneValidationResult[] {
    return phoneNumbers.map(phone => this.validateKoreanPhoneNumber(phone));
  }
}

// Export singleton instance
export const phoneValidationService = new PhoneValidationService();
export default phoneValidationService;

