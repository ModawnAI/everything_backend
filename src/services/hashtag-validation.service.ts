/**
 * Hashtag Validation Service
 * 
 * Enhanced hashtag validation and profanity filtering with advanced pattern matching,
 * trending analysis, and community guidelines enforcement.
 */

import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

export interface HashtagValidationResult {
  isValid: boolean;
  sanitizedHashtag: string;
  violations: HashtagViolation[];
  suggestions?: string[];
  metadata: {
    originalLength: number;
    sanitizedLength: number;
    category?: HashtagCategory;
    trendingScore?: number;
    usageCount?: number;
  };
}

export interface HashtagViolation {
  type: 'profanity' | 'spam' | 'inappropriate' | 'banned' | 'format' | 'length' | 'reserved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number; // 0-100
  suggestedAction: 'allow' | 'warn' | 'block' | 'replace';
  replacement?: string;
}

export type HashtagCategory = 
  | 'beauty' 
  | 'lifestyle' 
  | 'fashion' 
  | 'food' 
  | 'travel' 
  | 'fitness' 
  | 'technology' 
  | 'entertainment' 
  | 'business' 
  | 'education'
  | 'general'
  | 'inappropriate';

export interface HashtagAnalytics {
  hashtag: string;
  usageCount: number;
  trendingScore: number;
  category: HashtagCategory;
  lastUsed: Date;
  isBlocked: boolean;
  isTrending: boolean;
}

export interface ProfanityFilterConfig {
  enableMultiLanguage: boolean;
  enableContextualAnalysis: boolean;
  enableLeetSpeakDetection: boolean;
  enableSimilarityMatching: boolean;
  strictMode: boolean;
  customBlockedWords: string[];
  allowedExceptions: string[];
  similarityThreshold: number; // 0-1, for fuzzy matching
}

class HashtagValidationService {
  private supabase = getSupabaseClient();
  private config: ProfanityFilterConfig;
  
  // Enhanced profanity patterns with multiple languages and variations
  private readonly profanityPatterns = {
    english: [
      // Direct profanity
      /\b(fuck|shit|damn|bitch|asshole|cunt|piss|bastard|whore|slut)\b/gi,
      // Variations and leetspeak
      /\b(f[u*@#]ck|sh[i1!]t|b[i1!]tch|@sshole|c[u*@#]nt)\b/gi,
      // Offensive terms
      /\b(retard|faggot|nigger|chink|spic|kike|wetback)\b/gi,
    ],
    korean: [
      // Korean profanity
      /\b(시발|씨발|지랄|개새끼|좆|꺼져|닥쳐|병신|미친|개년|년|놈|새끼)\b/gi,
      // Korean variations
      /\b(시1발|씨1발|ㅅㅂ|ㅆㅂ|ㅂㅅ|ㅁㅊ|ㄱㅅㄲ)\b/gi,
    ],
    japanese: [
      /\b(ばか|あほ|くそ|ちくしょう|やろう|きちく|ぶす)\b/gi,
    ],
    chinese: [
      /\b(操|妈的|傻逼|白痴|混蛋|王八蛋|去死)\b/gi,
    ]
  };

  // Spam and inappropriate patterns
  private readonly spamPatterns = [
    // Promotional spam
    /\b(buy|sale|discount|offer|deal|cheap|free|win|prize|lottery|casino|gambling)\b/gi,
    // Korean promotional
    /\b(구매|세일|할인|혜택|무료|당첨|로또|카지노|도박|베팅)\b/gi,
    // Excessive repetition
    /(.)\1{4,}/gi,
    // Multiple numbers/symbols
    /[0-9]{5,}/gi,
    /[!@#$%^&*()]{3,}/gi,
  ];

  // Banned/reserved hashtags
  private readonly bannedHashtags = new Set([
    // System reserved
    'admin', 'system', 'api', 'root', 'null', 'undefined',
    // Inappropriate content
    'porn', 'sex', 'nude', 'nsfw', 'xxx', 'adult',
    // Korean inappropriate
    '야동', '성인', '누드', '섹스', '포르노',
    // Hate speech
    'nazi', 'hitler', 'isis', 'terrorist', 'racism',
    // Scam related
    'scam', 'fraud', 'phishing', 'hack', 'crack',
    // Korean scam
    '사기', '피싱', '해킹', '크랙', '불법'
  ]);

  // Beauty/lifestyle related positive hashtags for categorization
  private readonly categoryKeywords = {
    beauty: ['beauty', 'makeup', 'skincare', 'cosmetics', '뷰티', '메이크업', '스킨케어', '화장품'],
    lifestyle: ['lifestyle', 'daily', 'life', 'living', '라이프스타일', '일상', '생활'],
    fashion: ['fashion', 'style', 'outfit', 'clothing', '패션', '스타일', '옷', '코디'],
    food: ['food', 'recipe', 'cooking', 'restaurant', '음식', '요리', '레시피', '맛집'],
    travel: ['travel', 'trip', 'vacation', 'tourism', '여행', '휴가', '관광'],
    fitness: ['fitness', 'workout', 'gym', 'health', '운동', '헬스', '피트니스', '건강'],
  };

  constructor(config?: Partial<ProfanityFilterConfig>) {
    this.config = {
      enableMultiLanguage: true,
      enableContextualAnalysis: true,
      enableLeetSpeakDetection: true,
      enableSimilarityMatching: true,
      strictMode: false,
      customBlockedWords: [],
      allowedExceptions: [],
      similarityThreshold: 0.8,
      ...config
    };
  }

  /**
   * Validate a single hashtag with comprehensive analysis
   */
  async validateHashtag(hashtag: string): Promise<HashtagValidationResult> {
    try {
      const originalHashtag = hashtag;
      let sanitizedHashtag = this.sanitizeHashtag(hashtag);
      const violations: HashtagViolation[] = [];

      // Basic format validation
      if (!this.isValidFormat(sanitizedHashtag)) {
        violations.push({
          type: 'format',
          severity: 'high',
          description: 'Hashtag contains invalid characters or format',
          confidence: 100,
          suggestedAction: 'block'
        });
      }

      // Length validation
      if (sanitizedHashtag.length > 50) {
        violations.push({
          type: 'length',
          severity: 'medium',
          description: 'Hashtag exceeds maximum length of 50 characters',
          confidence: 100,
          suggestedAction: 'block'
        });
      }

      if (sanitizedHashtag.length < 2) {
        violations.push({
          type: 'length',
          severity: 'medium',
          description: 'Hashtag must be at least 2 characters long',
          confidence: 100,
          suggestedAction: 'block'
        });
      }

      // Check if banned/reserved
      if (this.isBannedHashtag(sanitizedHashtag)) {
        violations.push({
          type: 'banned',
          severity: 'critical',
          description: 'Hashtag is banned or reserved',
          confidence: 100,
          suggestedAction: 'block'
        });
      }

      // Profanity detection
      const profanityViolations = this.detectProfanity(sanitizedHashtag);
      violations.push(...profanityViolations);

      // Spam detection
      const spamViolations = this.detectSpam(sanitizedHashtag);
      violations.push(...spamViolations);

      // Get hashtag analytics
      const analytics = await this.getHashtagAnalytics(sanitizedHashtag);
      const category = this.categorizeHashtag(sanitizedHashtag);

      // Generate suggestions for blocked hashtags
      const suggestions = violations.length > 0 ? await this.generateSuggestions(sanitizedHashtag) : undefined;

      return {
        isValid: violations.filter(v => v.suggestedAction === 'block').length === 0,
        sanitizedHashtag,
        violations,
        suggestions,
        metadata: {
          originalLength: originalHashtag.length,
          sanitizedLength: sanitizedHashtag.length,
          category,
          trendingScore: analytics?.trendingScore,
          usageCount: analytics?.usageCount
        }
      };

    } catch (error) {
      logger.error('Hashtag validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hashtag
      });

      return {
        isValid: false,
        sanitizedHashtag: hashtag,
        violations: [{
          type: 'inappropriate',
          severity: 'high',
          description: 'Hashtag validation failed - requires manual review',
          confidence: 100,
          suggestedAction: 'block'
        }],
        metadata: {
          originalLength: hashtag.length,
          sanitizedLength: hashtag.length
        }
      };
    }
  }

  /**
   * Validate multiple hashtags with batch processing
   */
  async validateHashtags(hashtags: string[]): Promise<{
    validHashtags: string[];
    invalidHashtags: string[];
    results: HashtagValidationResult[];
    summary: {
      total: number;
      valid: number;
      invalid: number;
      blocked: number;
      warnings: number;
    };
  }> {
    const results: HashtagValidationResult[] = [];
    const validHashtags: string[] = [];
    const invalidHashtags: string[] = [];

    for (const hashtag of hashtags) {
      const result = await this.validateHashtag(hashtag);
      results.push(result);

      if (result.isValid) {
        validHashtags.push(result.sanitizedHashtag);
      } else {
        invalidHashtags.push(hashtag);
      }
    }

    const blocked = results.filter(r => r.violations.some(v => v.suggestedAction === 'block')).length;
    const warnings = results.filter(r => r.violations.some(v => v.suggestedAction === 'warn')).length;

    return {
      validHashtags,
      invalidHashtags,
      results,
      summary: {
        total: hashtags.length,
        valid: validHashtags.length,
        invalid: invalidHashtags.length,
        blocked,
        warnings
      }
    };
  }

  /**
   * Enhanced profanity detection with multiple languages and patterns
   */
  private detectProfanity(hashtag: string): HashtagViolation[] {
    const violations: HashtagViolation[] = [];

    if (!this.config.enableMultiLanguage) {
      return violations;
    }

    // Check each language pattern
    for (const [language, patterns] of Object.entries(this.profanityPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(hashtag)) {
          violations.push({
            type: 'profanity',
            severity: 'high',
            description: `Contains profanity in ${language}`,
            confidence: 90,
            suggestedAction: 'block'
          });
          break; // One violation per language is enough
        }
      }
    }

    // Check custom blocked words
    for (const blockedWord of this.config.customBlockedWords) {
      if (hashtag.toLowerCase().includes(blockedWord.toLowerCase())) {
        violations.push({
          type: 'profanity',
          severity: 'high',
          description: 'Contains custom blocked word',
          confidence: 100,
          suggestedAction: 'block'
        });
      }
    }

    // Similarity matching for obfuscated profanity
    if (this.config.enableSimilarityMatching) {
      const similarityViolations = this.detectSimilarProfanity(hashtag);
      violations.push(...similarityViolations);
    }

    return violations;
  }

  /**
   * Detect spam patterns in hashtags
   */
  private detectSpam(hashtag: string): HashtagViolation[] {
    const violations: HashtagViolation[] = [];

    for (const pattern of this.spamPatterns) {
      if (pattern.test(hashtag)) {
        violations.push({
          type: 'spam',
          severity: 'medium',
          description: 'Contains spam-like patterns',
          confidence: 80,
          suggestedAction: 'warn'
        });
        break;
      }
    }

    return violations;
  }

  /**
   * Detect similar profanity using fuzzy matching
   */
  private detectSimilarProfanity(hashtag: string): HashtagViolation[] {
    const violations: HashtagViolation[] = [];
    
    // This is a simplified similarity check - in production, you might use
    // more sophisticated algorithms like Levenshtein distance or phonetic matching
    const commonObfuscations = [
      { original: 'fuck', variations: ['f*ck', 'f**k', 'fck', 'fuk', 'phuck'] },
      { original: 'shit', variations: ['sh*t', 'sh**', 'sht', 'shyt'] },
      { original: '시발', variations: ['시1발', 'ㅅㅂ', 'ㅆㅂ', 'si발'] }
    ];

    for (const { original, variations } of commonObfuscations) {
      for (const variation of variations) {
        if (hashtag.toLowerCase().includes(variation.toLowerCase())) {
          violations.push({
            type: 'profanity',
            severity: 'high',
            description: `Contains obfuscated profanity (${original})`,
            confidence: 85,
            suggestedAction: 'block',
            replacement: this.generateCleanAlternative(hashtag, variation)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Sanitize hashtag by removing invalid characters
   */
  private sanitizeHashtag(hashtag: string): string {
    // Remove # prefix if present
    let sanitized = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;
    
    // Remove invalid characters, keep only alphanumeric, Korean, and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9가-힣_]/g, '');
    
    // Convert to lowercase for consistency
    return sanitized.toLowerCase();
  }

  /**
   * Check if hashtag format is valid
   */
  private isValidFormat(hashtag: string): boolean {
    const pattern = /^[a-zA-Z0-9가-힣_]+$/;
    return pattern.test(hashtag) && hashtag.length >= 2 && hashtag.length <= 50;
  }

  /**
   * Check if hashtag is banned or reserved
   */
  private isBannedHashtag(hashtag: string): boolean {
    const bannedArray = Array.from(this.bannedHashtags);
    return bannedArray.includes(hashtag.toLowerCase());
  }

  /**
   * Categorize hashtag based on content
   */
  private categorizeHashtag(hashtag: string): HashtagCategory {
    const lowerHashtag = hashtag.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      for (const keyword of keywords) {
        if (lowerHashtag.includes(keyword.toLowerCase())) {
          return category as HashtagCategory;
        }
      }
    }

    return 'general';
  }

  /**
   * Get hashtag analytics from database
   */
  private async getHashtagAnalytics(hashtag: string): Promise<HashtagAnalytics | null> {
    try {
      const { data, error } = await this.supabase
        .from('hashtags')
        .select('*')
        .eq('tag', hashtag)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        hashtag: data.tag,
        usageCount: data.usage_count || 0,
        trendingScore: data.trending_score || 0,
        category: data.category || 'general',
        lastUsed: new Date(data.updated_at),
        isBlocked: data.is_blocked || false,
        isTrending: data.is_trending || false
      };
    } catch (error) {
      logger.warn('Failed to get hashtag analytics', { hashtag, error });
      return null;
    }
  }

  /**
   * Generate alternative suggestions for blocked hashtags
   */
  private async generateSuggestions(hashtag: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Simple suggestion generation - in production, you might use ML or more sophisticated methods
    const category = this.categorizeHashtag(hashtag);
    
    // Get popular hashtags in the same category
    try {
      const { data, error } = await this.supabase
        .from('hashtags')
        .select('tag')
        .eq('category', category)
        .eq('is_blocked', false)
        .order('usage_count', { ascending: false })
        .limit(3);

      if (!error && data) {
        suggestions.push(...data.map(h => h.tag));
      }
    } catch (error) {
      logger.warn('Failed to generate hashtag suggestions', { hashtag, error });
    }

    // Add generic suggestions based on category
    const genericSuggestions = {
      beauty: ['뷰티', 'beauty', 'makeup', 'skincare'],
      lifestyle: ['daily', 'life', 'lifestyle', '일상'],
      fashion: ['fashion', 'style', 'outfit', '패션'],
      general: ['daily', 'life', 'good', 'nice']
    };

    const categoryGeneric = genericSuggestions[category] || genericSuggestions.general;
    suggestions.push(...categoryGeneric.slice(0, 2));

    return [...new Set(suggestions)].slice(0, 5); // Remove duplicates and limit to 5
  }

  /**
   * Generate clean alternative for obfuscated words
   */
  private generateCleanAlternative(hashtag: string, obfuscatedWord: string): string {
    // Simple replacement with asterisks or removal
    return hashtag.replace(new RegExp(obfuscatedWord, 'gi'), '***');
  }

  /**
   * Update hashtag usage statistics
   */
  async updateHashtagUsage(hashtag: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('increment_hashtag_usage', { hashtag_name: hashtag });

      if (error) {
        logger.warn('Failed to update hashtag usage', { hashtag, error });
      }
    } catch (error) {
      logger.warn('Failed to update hashtag usage', { hashtag, error });
    }
  }

  /**
   * Get trending hashtags
   */
  async getTrendingHashtags(limit: number = 10): Promise<HashtagAnalytics[]> {
    try {
      const { data, error } = await this.supabase
        .from('hashtags')
        .select('*')
        .eq('is_trending', true)
        .eq('is_blocked', false)
        .order('trending_score', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.map(h => ({
        hashtag: h.tag,
        usageCount: h.usage_count,
        trendingScore: h.trending_score,
        category: h.category,
        lastUsed: new Date(h.updated_at),
        isBlocked: h.is_blocked,
        isTrending: h.is_trending
      }));
    } catch (error) {
      logger.error('Failed to get trending hashtags', { error });
      return [];
    }
  }
}

export const hashtagValidationService = new HashtagValidationService();
