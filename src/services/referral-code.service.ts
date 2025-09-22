import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Referral Code Service
 * 
 * Enhanced referral code generation with improved uniqueness guarantees,
 * performance optimization, and comprehensive validation
 */

export interface ReferralCodeGenerationOptions {
  length?: number;
  prefix?: string;
  suffix?: string;
  excludeSimilar?: boolean; // Exclude similar looking characters (0, O, I, 1)
  excludeProfanity?: boolean; // Exclude potentially offensive combinations
  maxAttempts?: number;
  cacheSize?: number; // Number of pre-generated codes to cache
}

export interface ReferralCodeValidationResult {
  isValid: boolean;
  code: string;
  normalizedCode: string;
  referrerId?: string;
  referrerInfo?: {
    id: string;
    name: string;
    userStatus: string;
    isInfluencer: boolean;
  };
  error?: string;
  errorCode?: string;
}

export interface ReferralCodeStats {
  totalCodes: number;
  activeCodes: number;
  expiredCodes: number;
  averageGenerationTime: number;
  collisionRate: number;
  cacheHitRate: number;
}

class ReferralCodeService {
  private supabase = getSupabaseClient();
  private codeCache: string[] = [];
  private generationStats = {
    totalAttempts: 0,
    collisions: 0,
    cacheHits: 0,
    generationTimes: [] as number[]
  };

  // Default configuration
  private readonly defaultOptions: Required<ReferralCodeGenerationOptions> = {
    length: 8,
    prefix: '',
    suffix: '',
    excludeSimilar: true,
    excludeProfanity: true,
    maxAttempts: 50,
    cacheSize: 100
  };

  // Character sets for different configurations
  private readonly baseCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private readonly similarExcludedCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, 1
  private readonly profanityPatterns = [
    /FUCK/i, /SHIT/i, /DAMN/i, /HELL/i, /BITCH/i, /ASS/i, /DICK/i, /PISS/i,
    /CUNT/i, /FAG/i, /NIG/i, /KILL/i, /DIE/i, /HATE/i, /DEAD/i, /BOMB/i,
    /GUN/i, /KNIFE/i, /BLOOD/i, /DEATH/i, /MURDER/i, /RAPE/i, /SEX/i, /PORN/i
  ];

  /**
   * Generate a unique referral code with enhanced features
   */
  async generateReferralCode(options: ReferralCodeGenerationOptions = {}): Promise<string> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      // Try to get a code from cache first
      if (this.codeCache.length > 0) {
        const cachedCode = this.codeCache.pop()!;
        this.generationStats.cacheHits++;
        
        logger.debug('Using cached referral code', { code: cachedCode });
        return cachedCode;
      }

      // Generate new codes
      const characters = this.getCharacterSet(config);
      let attempts = 0;
      const generatedCodes = new Set<string>();

      while (attempts < config.maxAttempts) {
        const code = this.generateCode(config, characters);
        this.generationStats.totalAttempts++;

        // Check if code is valid (not similar, not profanity, not duplicate in this batch)
        if (this.isValidCode(code, config) && !generatedCodes.has(code)) {
          generatedCodes.add(code);

          // Check uniqueness in database
          const isUnique = await this.checkCodeUniqueness(code);
          if (isUnique) {
            const generationTime = Date.now() - startTime;
            this.generationStats.generationTimes.push(generationTime);

            // Pre-generate additional codes for cache
            this.preGenerateCodes(config, characters, 10);

            logger.info('Referral code generated successfully', {
              code,
              attempts: attempts + 1,
              generationTime,
              cacheSize: this.codeCache.length
            });

            return code;
          } else {
            this.generationStats.collisions++;
            logger.debug('Code collision detected', { code, attempt: attempts + 1 });
          }
        }

        attempts++;
      }

      // If we reach here, generation failed
      const generationTime = Date.now() - startTime;
      logger.error('Failed to generate unique referral code', {
        attempts,
        maxAttempts: config.maxAttempts,
        generationTime,
        collisionRate: this.generationStats.collisions / this.generationStats.totalAttempts
      });

      throw new Error(`Failed to generate unique referral code after ${attempts} attempts`);

    } catch (error) {
      const generationTime = Date.now() - startTime;
      logger.error('Referral code generation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime,
        config
      });
      throw error;
    }
  }

  /**
   * Validate a referral code with comprehensive checks
   */
  async validateReferralCode(code: string): Promise<ReferralCodeValidationResult> {
    try {
      // Normalize the code
      const normalizedCode = code.trim().toUpperCase();
      
      // Basic format validation
      if (!this.isValidFormat(normalizedCode)) {
        return {
          isValid: false,
          code: code,
          normalizedCode,
          error: 'Invalid referral code format',
          errorCode: 'INVALID_FORMAT'
        };
      }

      // Check if code exists and get referrer info
      const { data: referrer, error } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          user_status,
          is_influencer,
          referral_code,
          created_at
        `)
        .eq('referral_code', normalizedCode)
        .eq('user_status', 'active')
        .single();

      if (error || !referrer) {
        return {
          isValid: false,
          code: code,
          normalizedCode,
          error: 'Referral code not found or user inactive',
          errorCode: 'CODE_NOT_FOUND'
        };
      }

      // Additional validation checks
      const validationChecks = await this.performAdditionalValidations(normalizedCode, referrer);
      if (!validationChecks.isValid) {
        return {
          isValid: false,
          code: code,
          normalizedCode,
          error: validationChecks.error,
          errorCode: validationChecks.errorCode
        };
      }

      return {
        isValid: true,
        code: code,
        normalizedCode,
        referrerId: referrer.id,
        referrerInfo: {
          id: referrer.id,
          name: referrer.name,
          userStatus: referrer.user_status,
          isInfluencer: referrer.is_influencer
        }
      };

    } catch (error) {
      logger.error('Error validating referral code', {
        code,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        code: code,
        normalizedCode: code.trim().toUpperCase(),
        error: 'Validation error occurred',
        errorCode: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Batch generate multiple referral codes
   */
  async batchGenerateReferralCodes(
    count: number, 
    options: ReferralCodeGenerationOptions = {}
  ): Promise<string[]> {
    const config = { ...this.defaultOptions, ...options };
    const codes: string[] = [];
    const characters = this.getCharacterSet(config);

    logger.info('Starting batch referral code generation', { count, config });

    for (let i = 0; i < count; i++) {
      try {
        const code = await this.generateReferralCode(config);
        codes.push(code);
      } catch (error) {
        logger.error('Failed to generate code in batch', {
          index: i,
          total: count,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }

    logger.info('Batch referral code generation completed', {
      requested: count,
      generated: codes.length,
      success: codes.length === count
    });

    return codes;
  }

  /**
   * Get referral code statistics
   */
  async getReferralCodeStats(): Promise<ReferralCodeStats> {
    try {
      // Get database statistics
      const { data: totalCodes } = await this.supabase
        .from('users')
        .select('id', { count: 'exact' })
        .not('referral_code', 'is', null);

      const { data: activeCodes } = await this.supabase
        .from('users')
        .select('id', { count: 'exact' })
        .not('referral_code', 'is', null)
        .eq('user_status', 'active');

      // Calculate performance metrics
      const averageGenerationTime = this.generationStats.generationTimes.length > 0
        ? this.generationStats.generationTimes.reduce((a, b) => a + b, 0) / this.generationStats.generationTimes.length
        : 0;

      const collisionRate = this.generationStats.totalAttempts > 0
        ? this.generationStats.collisions / this.generationStats.totalAttempts
        : 0;

      const cacheHitRate = this.generationStats.totalAttempts > 0
        ? this.generationStats.cacheHits / this.generationStats.totalAttempts
        : 0;

      return {
        totalCodes: totalCodes?.length || 0,
        activeCodes: activeCodes?.length || 0,
        expiredCodes: 0, // Would need additional logic to track expired codes
        averageGenerationTime,
        collisionRate,
        cacheHitRate
      };

    } catch (error) {
      logger.error('Error getting referral code stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Pre-generate codes for caching
   */
  private async preGenerateCodes(
    config: Required<ReferralCodeGenerationOptions>,
    characters: string,
    count: number
  ): Promise<void> {
    try {
      const codes: string[] = [];
      const generatedCodes = new Set<string>();

      for (let i = 0; i < count && codes.length < count; i++) {
        const code = this.generateCode(config, characters);
        
        if (this.isValidCode(code, config) && !generatedCodes.has(code)) {
          generatedCodes.add(code);
          
          // Check uniqueness in database
          const isUnique = await this.checkCodeUniqueness(code);
          if (isUnique) {
            codes.push(code);
          }
        }
      }

      // Add to cache
      this.codeCache.push(...codes);
      
      logger.debug('Pre-generated codes for cache', {
        requested: count,
        generated: codes.length,
        cacheSize: this.codeCache.length
      });

    } catch (error) {
      logger.warn('Failed to pre-generate codes for cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate a single code
   */
  private generateCode(config: Required<ReferralCodeGenerationOptions>, characters: string): string {
    let code = config.prefix;
    
    for (let i = 0; i < config.length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return code + config.suffix;
  }

  /**
   * Get character set based on configuration
   */
  private getCharacterSet(config: Required<ReferralCodeGenerationOptions>): string {
    if (config.excludeSimilar) {
      return this.similarExcludedCharacters;
    }
    return this.baseCharacters;
  }

  /**
   * Check if code is valid (format, profanity, etc.)
   */
  private isValidCode(code: string, config: Required<ReferralCodeGenerationOptions>): boolean {
    // Check format
    if (!this.isValidFormat(code)) {
      return false;
    }

    // Check profanity if enabled
    if (config.excludeProfanity && this.containsProfanity(code)) {
      return false;
    }

    return true;
  }

  /**
   * Check if code has valid format
   */
  private isValidFormat(code: string): boolean {
    // Basic format validation - alphanumeric, reasonable length
    return /^[A-Z0-9]{4,12}$/.test(code);
  }

  /**
   * Check if code contains profanity
   */
  private containsProfanity(code: string): boolean {
    return this.profanityPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Check if code is unique in database
   */
  private async checkCodeUniqueness(code: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('referral_code', code)
        .single();

      // If no rows found, code is unique
      return error?.code === 'PGRST116';
    } catch (error) {
      logger.error('Error checking code uniqueness', {
        code,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Perform additional validation checks
   */
  private async performAdditionalValidations(code: string, referrer: any): Promise<{
    isValid: boolean;
    error?: string;
    errorCode?: string;
  }> {
    // Check if referrer account is too new (prevent abuse)
    const accountAge = Date.now() - new Date(referrer.created_at).getTime();
    const minimumAccountAge = 24 * 60 * 60 * 1000; // 24 hours

    if (accountAge < minimumAccountAge) {
      return {
        isValid: false,
        error: 'Referrer account is too new',
        errorCode: 'ACCOUNT_TOO_NEW'
      };
    }

    // Additional checks can be added here
    // - Check if referrer has been banned
    // - Check if referrer has reached referral limits
    // - Check if code has been flagged for abuse

    return { isValid: true };
  }

  /**
   * Clear the code cache
   */
  public clearCache(): void {
    this.codeCache = [];
    logger.info('Referral code cache cleared');
  }

  /**
   * Reset generation statistics
   */
  public resetStats(): void {
    this.generationStats = {
      totalAttempts: 0,
      collisions: 0,
      cacheHits: 0,
      generationTimes: []
    };
    logger.info('Referral code generation statistics reset');
  }
}

export const referralCodeService = new ReferralCodeService();

