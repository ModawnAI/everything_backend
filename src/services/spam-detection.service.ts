/**
 * Advanced Spam Detection Service
 * 
 * Comprehensive spam detection with machine learning-like patterns,
 * behavioral analysis, and integration with rate limiting systems.
 */

import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { ipBlockingService } from './ip-blocking.service';

export interface SpamAnalysisResult {
  isSpam: boolean;
  confidence: number; // 0-100
  spamScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  detectedPatterns: SpamPattern[];
  behavioralFlags: BehavioralFlag[];
  suggestedAction: 'allow' | 'warn' | 'throttle' | 'block' | 'quarantine';
  recommendations: string[];
}

export interface SpamPattern {
  type: SpamPatternType;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
}

export type SpamPatternType = 
  | 'excessive_repetition'
  | 'multiple_urls'
  | 'promotional_keywords'
  | 'fake_engagement'
  | 'bot_behavior'
  | 'content_farming'
  | 'phishing_attempt'
  | 'malicious_links'
  | 'duplicate_content'
  | 'rapid_posting'
  | 'suspicious_timing'
  | 'coordinated_activity';

export interface BehavioralFlag {
  type: BehavioralFlagType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  evidence: any;
}

export type BehavioralFlagType = 
  | 'rapid_posting'
  | 'identical_content'
  | 'suspicious_timing'
  | 'unusual_activity_pattern'
  | 'coordinated_behavior'
  | 'fake_engagement_pattern'
  | 'content_velocity_spike'
  | 'cross_platform_spam';

export interface UserBehaviorProfile {
  userId: string;
  accountAge: number; // days
  totalPosts: number;
  totalComments: number;
  averagePostLength: number;
  averageTimeBetweenPosts: number; // minutes
  engagementRate: number; // percentage
  reportedContentCount: number;
  suspiciousActivityScore: number; // 0-100
  lastActivityTime: Date;
  activityPatterns: {
    hourlyDistribution: number[]; // 24 hours
    dailyDistribution: number[]; // 7 days
    contentTypes: Record<string, number>;
  };
}

export interface SpamDetectionConfig {
  enableBehavioralAnalysis: boolean;
  enableContentAnalysis: boolean;
  enableNetworkAnalysis: boolean;
  enableMLPatterns: boolean;
  strictMode: boolean;
  
  // Thresholds
  spamThreshold: number; // 0-100, above this is considered spam
  quarantineThreshold: number; // 0-100, above this is quarantined
  blockThreshold: number; // 0-100, above this is blocked
  
  // Rate limiting integration
  enableAdaptiveRateLimit: boolean;
  rateLimitMultiplier: number; // Multiply rate limits for suspicious users
  
  // Behavioral analysis settings
  minAccountAgeHours: number; // Minimum account age to avoid new account penalties
  maxPostsPerHour: number;
  maxIdenticalContentPercentage: number;
  suspiciousTimingWindowMinutes: number;
}

class SpamDetectionService {
  private supabase = getSupabaseClient();
  private config: SpamDetectionConfig;
  
  // Spam pattern definitions
  private readonly spamPatterns = {
    // Content-based patterns
    excessive_repetition: {
      patterns: [
        /(.)\1{10,}/gi, // Same character repeated 10+ times
        /(\b\w+\b)(\s+\1){4,}/gi, // Same word repeated 5+ times
        /([!@#$%^&*()]{3,})/gi // Excessive symbols
      ],
      threshold: 2,
      severity: 'medium' as const
    },
    
    multiple_urls: {
      patterns: [
        /(https?:\/\/[^\s]+)/gi
      ],
      threshold: 3, // 3+ URLs in one post
      severity: 'high' as const
    },
    
    promotional_keywords: {
      patterns: [
        /\b(buy now|click here|limited time|act now|don't miss|urgent|free money|make money fast|discount|sale|offer|deal|win|prize|lottery|casino|gambling|bet|investment|crypto|bitcoin)\b/gi,
        /\b(지금 구매|클릭하세요|한정 시간|놓치지 마세요|긴급|무료 돈|빨리 돈벌기|할인|세일|혜택|당첨|로또|카지노|도박|베팅|투자|암호화폐|비트코인)\b/gi
      ],
      threshold: 3,
      severity: 'high' as const
    },
    
    phishing_attempt: {
      patterns: [
        /\b(verify your account|suspended account|click to verify|update payment|confirm identity|security alert|account locked)\b/gi,
        /\b(계정 확인|계정 정지|클릭하여 확인|결제 업데이트|신원 확인|보안 경고|계정 잠금)\b/gi,
        /(bit\.ly|tinyurl|t\.co|goo\.gl|short\.link)/gi // Suspicious URL shorteners
      ],
      threshold: 1,
      severity: 'critical' as const
    },
    
    bot_behavior: {
      patterns: [
        /^(.{1,50})\1{2,}$/gi, // Repeated short patterns
        /\b(follow for follow|f4f|like for like|l4l|sub for sub|s4s)\b/gi,
        /\b(팔로우|맞팔|좋아요|댓글|구독)\s*(해주세요|부탁|교환)/gi
      ],
      threshold: 1,
      severity: 'high' as const
    }
  };

  // Suspicious timing patterns
  private readonly suspiciousTimingPatterns = [
    { name: 'rapid_posting', windowMinutes: 5, maxPosts: 10 },
    { name: 'burst_activity', windowMinutes: 60, maxPosts: 50 },
    { name: 'overnight_spam', startHour: 2, endHour: 6, maxPosts: 20 }
  ];

  constructor(config?: Partial<SpamDetectionConfig>) {
    this.config = {
      enableBehavioralAnalysis: true,
      enableContentAnalysis: true,
      enableNetworkAnalysis: true,
      enableMLPatterns: true,
      strictMode: false,
      spamThreshold: 70,
      quarantineThreshold: 85,
      blockThreshold: 95,
      enableAdaptiveRateLimit: true,
      rateLimitMultiplier: 0.5, // Reduce rate limits for suspicious users
      minAccountAgeHours: 24,
      maxPostsPerHour: 20,
      maxIdenticalContentPercentage: 80,
      suspiciousTimingWindowMinutes: 5,
      ...config
    };
  }

  /**
   * Comprehensive spam analysis for content
   */
  async analyzeContent(content: {
    text: string;
    userId: string;
    contentType: 'post' | 'comment';
    metadata?: {
      images?: string[];
      hashtags?: string[];
      mentions?: string[];
      location?: string;
    };
  }): Promise<SpamAnalysisResult> {
    try {
      const detectedPatterns: SpamPattern[] = [];
      const behavioralFlags: BehavioralFlag[] = [];
      let totalSpamScore = 0;

      // Content-based analysis
      if (this.config.enableContentAnalysis) {
        const contentPatterns = await this.analyzeContentPatterns(content.text);
        detectedPatterns.push(...contentPatterns);
        totalSpamScore += contentPatterns.reduce((sum, p) => sum + (p.confidence * this.getSeverityMultiplier(p.severity)), 0);
      }

      // Behavioral analysis
      if (this.config.enableBehavioralAnalysis) {
        const behaviorAnalysis = await this.analyzeBehavioralPatterns(content.userId, content.contentType);
        behavioralFlags.push(...behaviorAnalysis.flags);
        totalSpamScore += behaviorAnalysis.score;
      }

      // Network analysis (IP, timing, coordination)
      if (this.config.enableNetworkAnalysis) {
        const networkAnalysis = await this.analyzeNetworkPatterns(content.userId);
        behavioralFlags.push(...networkAnalysis.flags);
        totalSpamScore += networkAnalysis.score;
      }

      // ML-like pattern analysis
      if (this.config.enableMLPatterns) {
        const mlScore = await this.analyzeMLPatterns(content);
        totalSpamScore += mlScore;
      }

      // Normalize score to 0-100
      const normalizedScore = Math.min(totalSpamScore, 100);

      // Determine risk level and suggested action
      const riskLevel = this.calculateRiskLevel(normalizedScore);
      const suggestedAction = this.determineSuggestedAction(normalizedScore, detectedPatterns, behavioralFlags);

      // Generate recommendations
      const recommendations = this.generateRecommendations(detectedPatterns, behavioralFlags);

      return {
        isSpam: normalizedScore >= this.config.spamThreshold,
        confidence: this.calculateConfidence(detectedPatterns, behavioralFlags),
        spamScore: normalizedScore,
        riskLevel,
        detectedPatterns,
        behavioralFlags,
        suggestedAction,
        recommendations
      };

    } catch (error) {
      logger.error('Spam analysis error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: content.userId,
        contentType: content.contentType
      });

      return {
        isSpam: true, // Fail safe
        confidence: 50,
        spamScore: 80,
        riskLevel: 'high',
        detectedPatterns: [],
        behavioralFlags: [],
        suggestedAction: 'quarantine',
        recommendations: ['Content analysis failed - manual review required']
      };
    }
  }

  /**
   * Analyze content patterns for spam indicators
   */
  private async analyzeContentPatterns(text: string): Promise<SpamPattern[]> {
    const patterns: SpamPattern[] = [];

    for (const [patternType, config] of Object.entries(this.spamPatterns)) {
      let matchCount = 0;
      const evidence: string[] = [];

      for (const regex of config.patterns) {
        const matches = text.match(regex);
        if (matches) {
          matchCount += matches.length;
          evidence.push(...matches.slice(0, 3)); // Limit evidence
        }
      }

      if (matchCount >= config.threshold) {
        patterns.push({
          type: patternType as SpamPatternType,
          description: `Detected ${patternType.replace('_', ' ')} pattern`,
          confidence: Math.min(90, 60 + (matchCount * 10)),
          severity: config.severity,
          evidence
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze behavioral patterns for spam indicators
   */
  private async analyzeBehavioralPatterns(userId: string, contentType: 'post' | 'comment'): Promise<{
    flags: BehavioralFlag[];
    score: number;
  }> {
    const flags: BehavioralFlag[] = [];
    let score = 0;

    try {
      // Get user behavior profile
      const profile = await this.getUserBehaviorProfile(userId);
      
      // Check rapid posting
      const rapidPostingFlag = await this.checkRapidPosting(userId, contentType);
      if (rapidPostingFlag) {
        flags.push(rapidPostingFlag);
        score += 25;
      }

      // Check for duplicate content
      const duplicateContentFlag = await this.checkDuplicateContent(userId);
      if (duplicateContentFlag) {
        flags.push(duplicateContentFlag);
        score += 30;
      }

      // Check suspicious timing
      const timingFlag = this.checkSuspiciousTiming(profile);
      if (timingFlag) {
        flags.push(timingFlag);
        score += 20;
      }

      // Check account age penalty
      if (profile.accountAge < this.config.minAccountAgeHours / 24) {
        flags.push({
          type: 'unusual_activity_pattern',
          description: 'New account with high activity',
          severity: 'medium',
          timeframe: `${profile.accountAge} days old`,
          evidence: { accountAge: profile.accountAge, totalPosts: profile.totalPosts }
        });
        score += 15;
      }

    } catch (error) {
      logger.warn('Behavioral analysis error', { userId, error });
      score += 10; // Small penalty for analysis failure
    }

    return { flags, score };
  }

  /**
   * Analyze network patterns (IP coordination, timing attacks)
   */
  private async analyzeNetworkPatterns(userId: string): Promise<{
    flags: BehavioralFlag[];
    score: number;
  }> {
    const flags: BehavioralFlag[] = [];
    let score = 0;

    try {
      // Check for coordinated activity (multiple users from same IP)
      const coordinationFlag = await this.checkCoordinatedActivity(userId);
      if (coordinationFlag) {
        flags.push(coordinationFlag);
        score += 40;
      }

      // Check for suspicious IP patterns
      const ipFlag = await this.checkSuspiciousIPActivity(userId);
      if (ipFlag) {
        flags.push(ipFlag);
        score += 25;
      }

    } catch (error) {
      logger.warn('Network analysis error', { userId, error });
    }

    return { flags, score };
  }

  /**
   * ML-like pattern analysis using statistical methods
   */
  private async analyzeMLPatterns(content: {
    text: string;
    userId: string;
    contentType: 'post' | 'comment';
    metadata?: any;
  }): Promise<number> {
    let score = 0;

    // Text entropy analysis (low entropy = repetitive = spam-like)
    const entropy = this.calculateTextEntropy(content.text);
    if (entropy < 2.0) { // Low entropy threshold
      score += 15;
    }

    // Content length analysis
    const length = content.text.length;
    if (length < 10 || length > 5000) { // Too short or too long
      score += 10;
    }

    // Keyword density analysis
    const keywordDensity = this.calculateKeywordDensity(content.text);
    if (keywordDensity > 0.3) { // High keyword repetition
      score += 20;
    }

    // Metadata analysis
    if (content.metadata) {
      if (content.metadata.hashtags && content.metadata.hashtags.length > 15) {
        score += 15; // Excessive hashtags
      }
      if (content.metadata.mentions && content.metadata.mentions.length > 10) {
        score += 10; // Excessive mentions
      }
    }

    return score;
  }

  /**
   * Get or create user behavior profile
   */
  private async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    try {
      // Get user account info
      const { data: user } = await this.supabase
        .from('users')
        .select('created_at')
        .eq('id', userId)
        .single();

      const accountAge = user ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Get user activity statistics
      const { data: posts } = await this.supabase
        .from('feed_posts')
        .select('created_at, content')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: comments } = await this.supabase
        .from('feed_comments')
        .select('created_at, content')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      const totalPosts = posts?.length || 0;
      const totalComments = comments?.length || 0;

      // Calculate activity patterns
      const hourlyDistribution = new Array(24).fill(0);
      const dailyDistribution = new Array(7).fill(0);

      [...(posts || []), ...(comments || [])].forEach(item => {
        const date = new Date(item.created_at);
        hourlyDistribution[date.getHours()]++;
        dailyDistribution[date.getDay()]++;
      });

      // Calculate averages
      const averagePostLength = posts?.reduce((sum, p) => sum + p.content.length, 0) / Math.max(totalPosts, 1) || 0;
      
      let averageTimeBetweenPosts = 0;
      if (posts && posts.length > 1) {
        const timeDiffs = [];
        for (let i = 0; i < posts.length - 1; i++) {
          const diff = new Date(posts[i].created_at).getTime() - new Date(posts[i + 1].created_at).getTime();
          timeDiffs.push(diff / (1000 * 60)); // Convert to minutes
        }
        averageTimeBetweenPosts = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
      }

      return {
        userId,
        accountAge,
        totalPosts,
        totalComments,
        averagePostLength,
        averageTimeBetweenPosts,
        engagementRate: 0, // Would need likes/shares data
        reportedContentCount: 0, // Would need reports data
        suspiciousActivityScore: 0,
        lastActivityTime: new Date(),
        activityPatterns: {
          hourlyDistribution,
          dailyDistribution,
          contentTypes: { posts: totalPosts, comments: totalComments }
        }
      };

    } catch (error) {
      logger.warn('Failed to get user behavior profile', { userId, error });
      return {
        userId,
        accountAge: 0,
        totalPosts: 0,
        totalComments: 0,
        averagePostLength: 0,
        averageTimeBetweenPosts: 0,
        engagementRate: 0,
        reportedContentCount: 0,
        suspiciousActivityScore: 50, // Default suspicious score for unknown users
        lastActivityTime: new Date(),
        activityPatterns: {
          hourlyDistribution: new Array(24).fill(0),
          dailyDistribution: new Array(7).fill(0),
          contentTypes: {}
        }
      };
    }
  }

  /**
   * Check for rapid posting behavior
   */
  private async checkRapidPosting(userId: string, contentType: 'post' | 'comment'): Promise<BehavioralFlag | null> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const table = contentType === 'post' ? 'feed_posts' : 'feed_comments';
      const authorField = 'author_id';

      const { data, error } = await this.supabase
        .from(table)
        .select('id')
        .eq(authorField, userId)
        .gte('created_at', fiveMinutesAgo.toISOString());

      if (error) throw error;

      const recentCount = data?.length || 0;
      if (recentCount >= 5) { // 5+ posts/comments in 5 minutes
        return {
          type: 'rapid_posting',
          description: `Posted ${recentCount} ${contentType}s in 5 minutes`,
          severity: recentCount >= 10 ? 'critical' : 'high',
          timeframe: '5 minutes',
          evidence: { count: recentCount, threshold: 5 }
        };
      }

      return null;
    } catch (error) {
      logger.warn('Rapid posting check failed', { userId, error });
      return null;
    }
  }

  /**
   * Check for duplicate content
   */
  private async checkDuplicateContent(userId: string): Promise<BehavioralFlag | null> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { data: posts } = await this.supabase
        .from('feed_posts')
        .select('content')
        .eq('author_id', userId)
        .gte('created_at', oneDayAgo.toISOString());

      if (!posts || posts.length < 2) return null;

      // Check for identical or very similar content
      const contentMap = new Map<string, number>();
      posts.forEach(post => {
        const normalized = post.content.toLowerCase().trim();
        contentMap.set(normalized, (contentMap.get(normalized) || 0) + 1);
      });

      const duplicates = Array.from(contentMap.entries()).filter(([_, count]) => count > 1);
      const duplicatePercentage = (duplicates.length / posts.length) * 100;

      if (duplicatePercentage > this.config.maxIdenticalContentPercentage) {
        return {
          type: 'identical_content',
          description: `${duplicatePercentage.toFixed(1)}% of content is identical`,
          severity: duplicatePercentage > 90 ? 'critical' : 'high',
          timeframe: '24 hours',
          evidence: { percentage: duplicatePercentage, duplicates: duplicates.length }
        };
      }

      return null;
    } catch (error) {
      logger.warn('Duplicate content check failed', { userId, error });
      return null;
    }
  }

  /**
   * Check suspicious timing patterns
   */
  private checkSuspiciousTiming(profile: UserBehaviorProfile): BehavioralFlag | null {
    // Check for bot-like regular intervals
    const hourlyVariance = this.calculateVariance(profile.activityPatterns.hourlyDistribution);
    if (hourlyVariance < 1.0) { // Very regular posting pattern
      return {
        type: 'suspicious_timing',
        description: 'Unusually regular posting pattern detected',
        severity: 'medium',
        timeframe: 'historical',
        evidence: { hourlyVariance, distribution: profile.activityPatterns.hourlyDistribution }
      };
    }

    return null;
  }

  /**
   * Check for coordinated activity
   */
  private async checkCoordinatedActivity(userId: string): Promise<BehavioralFlag | null> {
    // This would require IP tracking and cross-user analysis
    // Simplified implementation for now
    return null;
  }

  /**
   * Check suspicious IP activity
   */
  private async checkSuspiciousIPActivity(userId: string): Promise<BehavioralFlag | null> {
    // This would integrate with IP blocking service
    // Simplified implementation for now
    return null;
  }

  /**
   * Calculate text entropy (measure of randomness/information content)
   */
  private calculateTextEntropy(text: string): number {
    const charFreq = new Map<string, number>();
    const length = text.length;

    // Count character frequencies
    for (const char of text.toLowerCase()) {
      charFreq.set(char, (charFreq.get(char) || 0) + 1);
    }

    // Calculate entropy
    let entropy = 0;
    for (const freq of charFreq.values()) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Calculate keyword density
   */
  private calculateKeywordDensity(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();

    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    const maxCount = Math.max(...wordCount.values());
    return maxCount / words.length;
  }

  /**
   * Calculate variance of an array
   */
  private calculateVariance(arr: number[]): number {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(patterns: SpamPattern[], flags: BehavioralFlag[]): number {
    if (patterns.length === 0 && flags.length === 0) return 100;

    const avgPatternConfidence = patterns.length > 0 ? 
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0;
    
    const flagConfidence = flags.length * 15; // Each flag adds confidence

    return Math.min(90, avgPatternConfidence + flagConfidence);
  }

  /**
   * Calculate risk level based on spam score
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.config.blockThreshold) return 'critical';
    if (score >= this.config.quarantineThreshold) return 'high';
    if (score >= this.config.spamThreshold) return 'medium';
    return 'low';
  }

  /**
   * Determine suggested action
   */
  private determineSuggestedAction(
    score: number, 
    patterns: SpamPattern[], 
    flags: BehavioralFlag[]
  ): 'allow' | 'warn' | 'throttle' | 'block' | 'quarantine' {
    // Check for critical patterns first
    const hasCriticalPattern = patterns.some(p => p.severity === 'critical') || 
                              flags.some(f => f.severity === 'critical');
    
    if (hasCriticalPattern || score >= this.config.blockThreshold) {
      return 'block';
    }
    
    if (score >= this.config.quarantineThreshold) {
      return 'quarantine';
    }
    
    if (score >= this.config.spamThreshold) {
      return 'throttle';
    }
    
    if (score >= 50) {
      return 'warn';
    }
    
    return 'allow';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(patterns: SpamPattern[], flags: BehavioralFlag[]): string[] {
    const recommendations: string[] = [];

    if (patterns.some(p => p.type === 'promotional_keywords')) {
      recommendations.push('Reduce promotional language and focus on authentic content');
    }

    if (patterns.some(p => p.type === 'multiple_urls')) {
      recommendations.push('Limit the number of links in your posts');
    }

    if (flags.some(f => f.type === 'rapid_posting')) {
      recommendations.push('Slow down your posting frequency to avoid appearing automated');
    }

    if (flags.some(f => f.type === 'identical_content')) {
      recommendations.push('Create unique, original content for each post');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue creating authentic, engaging content');
    }

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }

  /**
   * Get severity multiplier for scoring
   */
  private getSeverityMultiplier(severity: string): number {
    const multipliers = { low: 0.5, medium: 1.0, high: 1.5, critical: 2.0 };
    return multipliers[severity as keyof typeof multipliers] || 1.0;
  }

  /**
   * Update user spam score in database
   */
  async updateUserSpamScore(userId: string, spamScore: number): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .update({ spam_score: spamScore, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      logger.warn('Failed to update user spam score', { userId, spamScore, error });
    }
  }

  /**
   * Get adaptive rate limit multiplier based on spam score
   */
  getAdaptiveRateLimitMultiplier(spamScore: number): number {
    if (!this.config.enableAdaptiveRateLimit) return 1.0;

    if (spamScore >= 80) return 0.1; // Very restrictive
    if (spamScore >= 60) return 0.3; // Restrictive
    if (spamScore >= 40) return 0.6; // Moderate restriction
    if (spamScore >= 20) return 0.8; // Light restriction
    
    return 1.0; // No restriction
  }
}

export const spamDetectionService = new SpamDetectionService();

