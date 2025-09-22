import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { 
  contentModerationService, 
  ContentAnalysisResult, 
  ContentViolation, 
  ModerationConfig 
} from './content-moderation.service';

export interface FeedContentAnalysisResult extends ContentAnalysisResult {
  autoAction: 'none' | 'flag' | 'hide' | 'remove';
  requiresReview: boolean;
  reportThreshold: number;
  hashtagViolations: string[];
  imageViolations: string[];
}

export interface FeedModerationConfig extends ModerationConfig {
  feedSpecific: {
    maxHashtags: number;
    maxImages: number;
    autoHideThreshold: number; // Number of reports to auto-hide
    autoRemoveThreshold: number; // Number of reports to auto-remove
    spamDetectionSensitivity: 'low' | 'medium' | 'high';
    beautyContentOnly: boolean; // Enforce beauty-related content only
  };
}

export interface HashtagAnalysis {
  isAppropriate: boolean;
  violations: string[];
  spamScore: number;
  suggestedAction: 'allow' | 'flag' | 'block';
}

export interface ImageAnalysis {
  isAppropriate: boolean;
  violations: string[];
  suggestedAction: 'allow' | 'flag' | 'block';
  metadata: {
    hasText: boolean;
    suspiciousPatterns: string[];
  };
}

class ContentModerator {
  private supabase = getSupabaseClient();
  private config: FeedModerationConfig;

  // Beauty-related keywords for content validation
  private beautyKeywords = [
    // English
    'beauty', 'makeup', 'skincare', 'cosmetics', 'nail', 'hair', 'salon', 'spa', 'facial', 
    'manicure', 'pedicure', 'eyebrow', 'eyelash', 'lipstick', 'foundation', 'concealer',
    'blush', 'mascara', 'eyeshadow', 'treatment', 'massage', 'waxing', 'threading',
    // Korean
    '뷰티', '화장품', '메이크업', '스킨케어', '네일', '헤어', '미용실', '살롱', '스파', 
    '페이셜', '마사지', '매니큐어', '페디큐어', '눈썹', '속눈썹', '립스틱', '파운데이션',
    '컨실러', '블러셔', '마스카라', '아이섀도우', '트리트먼트', '왁싱', '쓰레딩',
    // Japanese
    'ビューティー', '化粧品', 'メイクアップ', 'スキンケア', 'ネイル', 'ヘア', '美容室', 
    'サロン', 'スパ', 'フェイシャル', 'マッサージ', 'マニキュア', 'ペディキュア'
  ];

  // Spam hashtag patterns
  private spamHashtagPatterns = [
    /^#*(follow|like|share|subscribe|click|buy|sale|discount|free|win|prize).*$/gi,
    /^#*(팔로우|좋아요|공유|구독|클릭|구매|세일|할인|무료|당첨|상품).*$/gi,
    /^#*(フォロー|いいね|シェア|購読|クリック|購入|セール|割引|無料|当選).*$/gi,
    /^#{2,}/, // Multiple hash symbols
    /^#[0-9]+$/, // Only numbers
    /^#.{1,2}$/, // Too short (1-2 characters)
    /^#.{51,}$/, // Too long (over 50 characters)
  ];

  // Inappropriate hashtag patterns
  private inappropriateHashtagPatterns = [
    /^#*(sex|porn|nude|adult|escort|drug|scam|fake|spam).*$/gi,
    /^#*(성인|포르노|나체|에스코트|마약|사기|가짜|스팸).*$/gi,
    /^#*(セックス|ポルノ|裸|大人|エスコート|薬物|詐欺|偽物|スパム).*$/gi,
  ];

  constructor() {
    this.config = {
      ...contentModerationService.getConfig(),
      feedSpecific: {
        maxHashtags: 10,
        maxImages: 10,
        autoHideThreshold: 5,
        autoRemoveThreshold: 10,
        spamDetectionSensitivity: 'medium',
        beautyContentOnly: true
      }
    };
  }

  /**
   * Analyze feed post content comprehensively
   */
  async analyzeFeedPost(postData: {
    content: string;
    hashtags?: string[];
    images?: Array<{ url: string; alt_text?: string }>;
    location_tag?: string;
    category?: string;
  }): Promise<FeedContentAnalysisResult> {
    try {
      // Analyze main content using existing service
      const baseAnalysis = await contentModerationService.analyzeContent(postData.content, 'profile_content');
      
      // Additional feed-specific analysis
      const hashtagAnalysis = postData.hashtags ? await this.analyzeHashtags(postData.hashtags) : null;
      const imageAnalysis = postData.images ? await this.analyzeImages(postData.images) : null;
      const beautyRelevance = this.config.feedSpecific.beautyContentOnly ? 
        this.analyzeBeautyRelevance(postData.content, postData.hashtags) : null;

      // Combine results
      let totalScore = baseAnalysis.score;
      let maxSeverity = baseAnalysis.severity;
      const allViolations = [...baseAnalysis.violations];
      let requiresReview = false;
      let autoAction: 'none' | 'flag' | 'hide' | 'remove' = 'none';

      // Process hashtag violations
      const hashtagViolations: string[] = [];
      if (hashtagAnalysis && !hashtagAnalysis.isAppropriate) {
        hashtagViolations.push(...hashtagAnalysis.violations);
        totalScore += hashtagAnalysis.spamScore;
        
        if (hashtagAnalysis.suggestedAction === 'block') {
          maxSeverity = 'high';
          requiresReview = true;
        }
      }

      // Process image violations
      const imageViolations: string[] = [];
      if (imageAnalysis && !imageAnalysis.isAppropriate) {
        imageViolations.push(...imageAnalysis.violations);
        totalScore += 20; // Add penalty for image violations
        
        if (imageAnalysis.suggestedAction === 'block') {
          maxSeverity = 'high';
          requiresReview = true;
        }
      }

      // Beauty relevance check
      if (beautyRelevance && !beautyRelevance.isRelevant) {
        totalScore += 15;
        allViolations.push({
          type: 'inappropriate',
          description: 'Content not related to beauty/cosmetics industry',
          severity: 'medium',
          confidence: beautyRelevance.confidence
        });
        requiresReview = true;
      }

      // Determine auto action based on score and severity
      if (totalScore >= this.config.thresholds.block || maxSeverity === 'critical') {
        autoAction = 'remove';
        requiresReview = true;
      } else if (totalScore >= this.config.thresholds.flag || maxSeverity === 'high') {
        autoAction = 'flag';
        requiresReview = true;
      } else if (totalScore >= this.config.thresholds.medium) {
        autoAction = 'flag';
      }

      // Calculate report threshold based on content risk
      let reportThreshold = this.config.feedSpecific.autoHideThreshold;
      if (totalScore >= 50) {
        reportThreshold = Math.max(3, reportThreshold - 2); // Lower threshold for risky content
      } else if (totalScore <= 20) {
        reportThreshold = reportThreshold + 2; // Higher threshold for safe content
      }

      const result: FeedContentAnalysisResult = {
        ...baseAnalysis,
        score: Math.min(100, totalScore),
        severity: maxSeverity,
        violations: allViolations,
        suggestedAction: autoAction === 'remove' ? 'block' : autoAction === 'flag' ? 'flag' : baseAnalysis.suggestedAction,
        autoAction,
        requiresReview,
        reportThreshold,
        hashtagViolations,
        imageViolations
      };

      logger.info('Feed content analyzed', {
        contentLength: postData.content.length,
        hashtagCount: postData.hashtags?.length || 0,
        imageCount: postData.images?.length || 0,
        score: result.score,
        severity: result.severity,
        autoAction: result.autoAction,
        requiresReview: result.requiresReview
      });

      return result;

    } catch (error) {
      logger.error('Error analyzing feed content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentLength: postData.content?.length
      });
      
      // Return safe default on error
      return {
        isAppropriate: false,
        severity: 'high',
        score: 80,
        violations: [{
          type: 'inappropriate',
          description: 'Content analysis failed - requires manual review',
          severity: 'high',
          confidence: 100
        }],
        suggestedAction: 'review',
        confidence: 100,
        autoAction: 'flag',
        requiresReview: true,
        reportThreshold: 3,
        hashtagViolations: [],
        imageViolations: []
      };
    }
  }

  /**
   * Analyze comment content
   */
  async analyzeComment(content: string): Promise<FeedContentAnalysisResult> {
    try {
      const baseAnalysis = await contentModerationService.analyzeContent(content, 'profile_content');
      
      // Comments have stricter moderation
      let adjustedScore = baseAnalysis.score;
      let autoAction: 'none' | 'flag' | 'hide' | 'remove' = 'none';
      
      // Increase penalties for comments
      if (baseAnalysis.severity === 'high') {
        adjustedScore += 20;
        autoAction = 'hide';
      } else if (baseAnalysis.severity === 'medium') {
        adjustedScore += 10;
        autoAction = 'flag';
      }

      const result: FeedContentAnalysisResult = {
        ...baseAnalysis,
        score: Math.min(100, adjustedScore),
        autoAction,
        requiresReview: adjustedScore >= 60,
        reportThreshold: 3, // Lower threshold for comments
        hashtagViolations: [],
        imageViolations: []
      };

      return result;

    } catch (error) {
      logger.error('Error analyzing comment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentLength: content?.length
      });
      
      return {
        isAppropriate: false,
        severity: 'high',
        score: 80,
        violations: [{
          type: 'inappropriate',
          description: 'Comment analysis failed - requires manual review',
          severity: 'high',
          confidence: 100
        }],
        suggestedAction: 'review',
        confidence: 100,
        autoAction: 'flag',
        requiresReview: true,
        reportThreshold: 3,
        hashtagViolations: [],
        imageViolations: []
      };
    }
  }

  /**
   * Analyze hashtags for spam and inappropriate content
   */
  private async analyzeHashtags(hashtags: string[]): Promise<HashtagAnalysis> {
    const violations: string[] = [];
    let spamScore = 0;
    let inappropriateCount = 0;

    for (const hashtag of hashtags) {
      const cleanTag = hashtag.toLowerCase().trim();
      
      // Check for spam patterns
      for (const pattern of this.spamHashtagPatterns) {
        if (pattern.test(cleanTag)) {
          violations.push(`Spam hashtag detected: ${hashtag}`);
          spamScore += 10;
          break;
        }
      }

      // Check for inappropriate content
      for (const pattern of this.inappropriateHashtagPatterns) {
        if (pattern.test(cleanTag)) {
          violations.push(`Inappropriate hashtag: ${hashtag}`);
          inappropriateCount++;
          break;
        }
      }

      // Check for excessive repetition
      const duplicateCount = hashtags.filter(h => h.toLowerCase() === cleanTag).length;
      if (duplicateCount > 1) {
        violations.push(`Duplicate hashtag: ${hashtag}`);
        spamScore += 5 * duplicateCount;
      }
    }

    // Check for too many hashtags
    if (hashtags.length > this.config.feedSpecific.maxHashtags) {
      violations.push(`Too many hashtags (${hashtags.length}/${this.config.feedSpecific.maxHashtags})`);
      spamScore += (hashtags.length - this.config.feedSpecific.maxHashtags) * 5;
    }

    const isAppropriate = violations.length === 0;
    let suggestedAction: 'allow' | 'flag' | 'block' = 'allow';

    if (inappropriateCount > 0 || spamScore >= 30) {
      suggestedAction = 'block';
    } else if (spamScore >= 15 || violations.length >= 3) {
      suggestedAction = 'flag';
    }

    return {
      isAppropriate,
      violations,
      spamScore,
      suggestedAction
    };
  }

  /**
   * Analyze images for inappropriate content
   */
  private async analyzeImages(images: Array<{ url: string; alt_text?: string }>): Promise<ImageAnalysis> {
    const violations: string[] = [];
    let hasText = false;
    const suspiciousPatterns: string[] = [];

    // Check image count
    if (images.length > this.config.feedSpecific.maxImages) {
      violations.push(`Too many images (${images.length}/${this.config.feedSpecific.maxImages})`);
    }

    // Analyze alt text and URLs
    for (const image of images) {
      // Check alt text if provided
      if (image.alt_text) {
        hasText = true;
        const altAnalysis = await contentModerationService.analyzeContent(image.alt_text, 'profile_content');
        if (!altAnalysis.isAppropriate) {
          violations.push(`Inappropriate image description: ${image.alt_text}`);
        }
      }

      // Check URL patterns for suspicious content
      const url = image.url.toLowerCase();
      if (url.includes('adult') || url.includes('porn') || url.includes('sex')) {
        violations.push(`Suspicious image URL pattern detected`);
        suspiciousPatterns.push('adult_content_url');
      }

      // Check for external/untrusted domains
      if (!url.includes('supabase.co') && !url.includes('localhost')) {
        violations.push(`External image source: ${image.url}`);
        suspiciousPatterns.push('external_source');
      }
    }

    const isAppropriate = violations.length === 0;
    let suggestedAction: 'allow' | 'flag' | 'block' = 'allow';

    if (suspiciousPatterns.includes('adult_content_url')) {
      suggestedAction = 'block';
    } else if (violations.length >= 2) {
      suggestedAction = 'flag';
    }

    return {
      isAppropriate,
      violations,
      suggestedAction,
      metadata: {
        hasText,
        suspiciousPatterns
      }
    };
  }

  /**
   * Check if content is relevant to beauty industry
   */
  private analyzeBeautyRelevance(content: string, hashtags?: string[]): {
    isRelevant: boolean;
    confidence: number;
    matchedKeywords: string[];
  } {
    const text = content.toLowerCase();
    const allHashtags = hashtags ? hashtags.join(' ').toLowerCase() : '';
    const combinedText = `${text} ${allHashtags}`;

    const matchedKeywords: string[] = [];
    
    for (const keyword of this.beautyKeywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    // Calculate relevance based on keyword matches and content length
    const relevanceScore = matchedKeywords.length;
    const contentWords = text.split(/\s+/).length;
    const relevanceRatio = relevanceScore / Math.max(contentWords / 10, 1);

    const isRelevant = relevanceScore > 0 || relevanceRatio > 0.1;
    const confidence = Math.min(100, relevanceScore * 20 + relevanceRatio * 30);

    return {
      isRelevant,
      confidence,
      matchedKeywords
    };
  }

  /**
   * Check if content should be auto-hidden based on reports
   */
  async shouldAutoHide(postId: string): Promise<{
    shouldHide: boolean;
    reportCount: number;
    threshold: number;
  }> {
    try {
      const { data: reports, error } = await this.supabase
        .from('post_reports')
        .select('id')
        .eq('post_id', postId)
        .eq('status', 'pending');

      if (error) {
        logger.error('Error checking report count', { error, postId });
        return { shouldHide: false, reportCount: 0, threshold: this.config.feedSpecific.autoHideThreshold };
      }

      const reportCount = reports?.length || 0;
      const shouldHide = reportCount >= this.config.feedSpecific.autoHideThreshold;

      return {
        shouldHide,
        reportCount,
        threshold: this.config.feedSpecific.autoHideThreshold
      };

    } catch (error) {
      logger.error('Error in shouldAutoHide', { error, postId });
      return { shouldHide: false, reportCount: 0, threshold: this.config.feedSpecific.autoHideThreshold };
    }
  }

  /**
   * Update moderation configuration
   */
  updateConfig(newConfig: Partial<FeedModerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Feed moderation configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): FeedModerationConfig {
    return { ...this.config };
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalPosts: number;
    flaggedPosts: number;
    hiddenPosts: number;
    removedPosts: number;
    totalReports: number;
    avgModerationScore: number;
  }> {
    try {
      const now = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      const [postsResult, reportsResult] = await Promise.all([
        this.supabase
          .from('posts')
          .select('moderation_status, moderation_score')
          .gte('created_at', startDate.toISOString()),
        this.supabase
          .from('post_reports')
          .select('id')
          .gte('created_at', startDate.toISOString())
      ]);

      const posts = postsResult.data || [];
      const reports = reportsResult.data || [];

      const stats = {
        totalPosts: posts.length,
        flaggedPosts: posts.filter(p => p.moderation_status === 'flagged').length,
        hiddenPosts: posts.filter(p => p.moderation_status === 'hidden').length,
        removedPosts: posts.filter(p => p.moderation_status === 'removed').length,
        totalReports: reports.length,
        avgModerationScore: posts.length > 0 ? 
          posts.reduce((sum, p) => sum + (p.moderation_score || 0), 0) / posts.length : 0
      };

      return stats;

    } catch (error) {
      logger.error('Error getting moderation stats', { error, timeframe });
      return {
        totalPosts: 0,
        flaggedPosts: 0,
        hiddenPosts: 0,
        removedPosts: 0,
        totalReports: 0,
        avgModerationScore: 0
      };
    }
  }
}

export const contentModerator = new ContentModerator();

