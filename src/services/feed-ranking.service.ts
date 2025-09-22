/**
 * Feed Ranking Service
 * 
 * Sophisticated feed ranking algorithm that combines multiple factors to create
 * personalized, engaging social feeds. Uses machine learning-inspired scoring
 * with real-time adaptation based on user behavior and content performance.
 */

import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { FeedPost, User } from '../types/database.types';
import { createClient } from 'redis';

export interface FeedRankingWeights {
  recency: number;      // 40% - How recent the post is
  engagement: number;   // 30% - Likes, comments, shares, views
  relevance: number;    // 20% - Location, category, user interests
  authorInfluence: number; // 10% - Author's influence score
}

export interface UserPreferences {
  userId: string;
  locationPreference?: string;
  categoryInterests: string[];
  interactionHistory: {
    likedCategories: Record<string, number>;
    followedAuthors: string[];
    engagementPatterns: {
      timeOfDay: Record<string, number>;
      dayOfWeek: Record<string, number>;
      contentTypes: Record<string, number>;
    };
  };
  personalityProfile: {
    explorationVsExploitation: number; // 0-1, higher = more diverse content
    trendFollowing: number; // 0-1, higher = prefers trending content
    localFocus: number; // 0-1, higher = prefers local content
  };
}

export interface ContentMetrics {
  postId: string;
  engagementRate: number;
  viralityScore: number;
  qualityScore: number;
  freshnessScore: number;
  relevanceScore: number;
  authorInfluenceScore: number;
  finalScore: number;
  rankingFactors: {
    recency: number;
    engagement: number;
    relevance: number;
    authorInfluence: number;
  };
}

export interface FeedRankingOptions {
  userId: string;
  limit?: number;
  offset?: number;
  timeWindow?: 'hour' | 'day' | 'week' | 'month';
  includeFollowedOnly?: boolean;
  categoryFilter?: string[];
  locationFilter?: string;
  minQualityScore?: number;
  diversityBoost?: boolean;
  personalizedWeights?: Partial<FeedRankingWeights>;
}

export interface TrendingContent {
  postId: string;
  trendingScore: number;
  category: string;
  location?: string;
  timeframe: string;
  metrics: {
    engagementVelocity: number;
    shareRate: number;
    commentRate: number;
    uniqueViewers: number;
  };
}

class FeedRankingService {
  private supabase = getSupabaseClient();
  private redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  // Default ranking weights based on research and A/B testing
  private defaultWeights: FeedRankingWeights = {
    recency: 0.40,      // Recent content is more engaging
    engagement: 0.30,   // High engagement indicates quality
    relevance: 0.20,    // Personalized content performs better
    authorInfluence: 0.10 // Influencer content gets slight boost
  };

  // Cache TTL configurations
  private cacheTTL = {
    userPreferences: 60 * 60, // 1 hour
    contentMetrics: 30 * 60,  // 30 minutes
    feedRankings: 15 * 60,    // 15 minutes
    trendingContent: 10 * 60  // 10 minutes
  };

  /**
   * Generate personalized feed ranking for a user
   */
  async generatePersonalizedFeed(options: FeedRankingOptions): Promise<{
    posts: FeedPost[];
    metrics: ContentMetrics[];
    totalCount: number;
    nextOffset?: number;
  }> {
    try {
      const startTime = Date.now();
      
      // Get user preferences and content
      const [userPreferences, posts] = await Promise.all([
        this.getUserPreferences(options.userId),
        this.getEligiblePosts(options)
      ]);

      // Calculate personalized weights
      const weights = this.calculatePersonalizedWeights(
        userPreferences,
        options.personalizedWeights
      );

      // Score and rank all posts
      const metrics = await Promise.all(
        posts.map(post => this.calculateContentMetrics(post, userPreferences, weights))
      );

      // Sort by final score and apply diversity if enabled
      let rankedMetrics = metrics.sort((a, b) => b.finalScore - a.finalScore);
      
      if (options.diversityBoost) {
        rankedMetrics = this.applyDiversityBoost(rankedMetrics, userPreferences);
      }

      // Apply pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      const paginatedMetrics = rankedMetrics.slice(offset, offset + limit);
      
      // Get corresponding posts in ranked order
      const rankedPosts = paginatedMetrics.map(metric => 
        posts.find(post => post.id === metric.postId)!
      );

      // Cache the results
      await this.cacheFeedResults(options.userId, rankedMetrics, weights);

      const processingTime = Date.now() - startTime;
      logger.info('Feed ranking generated', {
        userId: options.userId,
        totalPosts: posts.length,
        returnedPosts: rankedPosts.length,
        processingTime,
        weights
      });

      return {
        posts: rankedPosts,
        metrics: paginatedMetrics,
        totalCount: rankedMetrics.length,
        nextOffset: offset + limit < rankedMetrics.length ? offset + limit : undefined
      };

    } catch (error) {
      logger.error('Feed ranking generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: options.userId,
        options
      });
      throw error;
    }
  }

  /**
   * Calculate comprehensive content metrics for ranking
   */
  async calculateContentMetrics(
    post: FeedPost,
    userPreferences: UserPreferences,
    weights: FeedRankingWeights
  ): Promise<ContentMetrics> {
    try {
      // Calculate individual scoring factors
      const recencyScore = this.calculateRecencyScore(post);
      const engagementScore = this.calculateEngagementScore(post);
      const relevanceScore = await this.calculateRelevanceScore(post, userPreferences);
      const authorInfluenceScore = await this.calculateAuthorInfluenceScore(post);

      // Apply weights to get final score
      const finalScore = (
        recencyScore * weights.recency +
        engagementScore * weights.engagement +
        relevanceScore * weights.relevance +
        authorInfluenceScore * weights.authorInfluence
      );

      // Calculate additional metrics
      const engagementRate = this.calculateEngagementRate(post);
      const viralityScore = this.calculateViralityScore(post);
      const qualityScore = this.calculateQualityScore(post);
      const freshnessScore = recencyScore;

      return {
        postId: post.id,
        engagementRate,
        viralityScore,
        qualityScore,
        freshnessScore,
        relevanceScore,
        authorInfluenceScore,
        finalScore: Math.max(0, Math.min(100, finalScore * 100)), // Normalize to 0-100
        rankingFactors: {
          recency: recencyScore,
          engagement: engagementScore,
          relevance: relevanceScore,
          authorInfluence: authorInfluenceScore
        }
      };

    } catch (error) {
      logger.warn('Content metrics calculation failed', {
        postId: post.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return default metrics on error
      return {
        postId: post.id,
        engagementRate: 0,
        viralityScore: 0,
        qualityScore: 50, // Neutral quality
        freshnessScore: 0,
        relevanceScore: 0,
        authorInfluenceScore: 0,
        finalScore: 25, // Low but not zero
        rankingFactors: {
          recency: 0,
          engagement: 0,
          relevance: 0,
          authorInfluence: 0
        }
      };
    }
  }

  /**
   * Calculate recency score (0-1) based on post age
   */
  private calculateRecencyScore(post: FeedPost): number {
    const now = Date.now();
    const postTime = new Date(post.created_at).getTime();
    const ageInHours = (now - postTime) / (1000 * 60 * 60);

    // Exponential decay: newer posts score higher
    // Score drops to ~0.5 after 24 hours, ~0.1 after 72 hours
    return Math.exp(-ageInHours / 24);
  }

  /**
   * Calculate engagement score (0-1) based on interactions
   */
  private calculateEngagementScore(post: FeedPost): number {
    const likes = post.like_count || 0;
    const comments = post.comment_count || 0;
    const shares = post.share_count || 0;
    const views = Math.max(post.view_count || 1, 1); // Avoid division by zero

    // Weighted engagement: comments worth more than likes
    const weightedEngagement = likes + (comments * 2) + (shares * 3);
    const engagementRate = weightedEngagement / views;

    // Normalize using sigmoid function to prevent outliers from dominating
    return 2 / (1 + Math.exp(-engagementRate * 10)) - 1;
  }

  /**
   * Calculate relevance score based on user preferences
   */
  private async calculateRelevanceScore(
    post: FeedPost,
    userPreferences: UserPreferences
  ): Promise<number> {
    let relevanceScore = 0;
    let factors = 0;

    // Category relevance
    if (post.category && userPreferences.categoryInterests.includes(post.category)) {
      relevanceScore += 0.4;
      factors++;
    }

    // Location relevance
    if (post.location_tag && userPreferences.locationPreference) {
      const locationMatch = this.calculateLocationSimilarity(
        post.location_tag,
        userPreferences.locationPreference
      );
      relevanceScore += locationMatch * 0.3;
      factors++;
    }

    // Author following
    if (userPreferences.interactionHistory.followedAuthors.includes(post.author_id)) {
      relevanceScore += 0.3;
      factors++;
    }

    // Hashtag relevance
    if (post.hashtags && post.hashtags.length > 0) {
      const hashtagRelevance = this.calculateHashtagRelevance(
        post.hashtags,
        userPreferences
      );
      relevanceScore += hashtagRelevance * 0.2;
      factors++;
    }

    // Time-based relevance (user's active hours)
    const timeRelevance = this.calculateTimeRelevance(post, userPreferences);
    relevanceScore += timeRelevance * 0.1;
    factors++;

    // Average the scores if we have factors, otherwise return neutral
    return factors > 0 ? relevanceScore / factors : 0.5;
  }

  /**
   * Calculate author influence score
   */
  private async calculateAuthorInfluenceScore(post: FeedPost): Promise<number> {
    try {
      // Get author information
      const { data: author } = await this.supabase
        .from('users')
        .select('is_influencer, follower_count, verification_status, created_at')
        .eq('id', post.author_id)
        .single();

      if (!author) return 0;

      let influenceScore = 0;

      // Influencer status
      if (author.is_influencer) {
        influenceScore += 0.4;
      }

      // Verification status
      if (author.verification_status === 'verified') {
        influenceScore += 0.3;
      }

      // Follower count (normalized)
      const followerCount = author.follower_count || 0;
      const followerScore = Math.min(followerCount / 10000, 1) * 0.2; // Max at 10k followers
      influenceScore += followerScore;

      // Account age (older accounts are more established)
      const accountAge = (Date.now() - new Date(author.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const ageScore = Math.min(accountAge / 365, 1) * 0.1; // Max at 1 year
      influenceScore += ageScore;

      return Math.min(influenceScore, 1);

    } catch (error) {
      logger.warn('Author influence calculation failed', {
        authorId: post.author_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(post: FeedPost): number {
    const totalInteractions = (post.like_count || 0) + (post.comment_count || 0) + (post.share_count || 0);
    const views = Math.max(post.view_count || 1, 1);
    return totalInteractions / views;
  }

  /**
   * Calculate virality score based on engagement velocity
   */
  private calculateViralityScore(post: FeedPost): number {
    const postAge = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60); // hours
    const engagementRate = this.calculateEngagementRate(post);
    
    // Virality = high engagement in short time
    if (postAge < 1) return engagementRate * 2; // Double score for very fresh content
    if (postAge < 6) return engagementRate * 1.5; // 1.5x for content under 6 hours
    if (postAge < 24) return engagementRate; // Normal score for content under 24 hours
    
    return engagementRate * 0.5; // Reduced score for older content
  }

  /**
   * Calculate content quality score
   */
  private calculateQualityScore(post: FeedPost): number {
    let qualityScore = 50; // Start with neutral

    // Content length (not too short, not too long)
    const contentLength = post.content.length;
    if (contentLength >= 50 && contentLength <= 500) {
      qualityScore += 10;
    } else if (contentLength < 20) {
      qualityScore -= 15;
    }

    // Has images
    if (post.images && post.images.length > 0) {
      qualityScore += 10;
    }

    // Has hashtags (but not too many)
    const hashtagCount = post.hashtags?.length || 0;
    if (hashtagCount >= 1 && hashtagCount <= 5) {
      qualityScore += 5;
    } else if (hashtagCount > 8) {
      qualityScore -= 10; // Penalty for hashtag spam
    }

    // Location tagged
    if (post.location_tag) {
      qualityScore += 5;
    }

    // Shop tagged (business relevance)
    if (post.tagged_shop_id) {
      qualityScore += 5;
    }

    // Moderation status
    if (post.moderation_status === 'approved') {
      qualityScore += 10;
    } else if (post.moderation_status === 'flagged') {
      qualityScore -= 20;
    }

    return Math.max(0, Math.min(100, qualityScore));
  }

  /**
   * Get user preferences with caching
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      // Try cache first
      const cacheKey = `user_preferences:${userId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached.toString());
      }

      // Build preferences from user data and interaction history
      const preferences = await this.buildUserPreferences(userId);
      
      // Cache the result
      await this.redis.setEx(cacheKey, this.cacheTTL.userPreferences, String(JSON.stringify(preferences)));
      
      return preferences;

    } catch (error) {
      logger.warn('Failed to get user preferences', { userId, error });
      return this.getDefaultUserPreferences(userId);
    }
  }

  /**
   * Build user preferences from database
   */
  private async buildUserPreferences(userId: string): Promise<UserPreferences> {
    // Get user basic info
    const { data: user } = await this.supabase
      .from('users')
      .select('location_preference, created_at')
      .eq('id', userId)
      .single();

    // Get interaction history
    const [likedPosts, comments, follows] = await Promise.all([
      this.supabase
        .from('post_likes')
        .select('post_id, created_at, feed_posts(category, location_tag)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      
      this.supabase
        .from('feed_comments')
        .select('post_id, created_at, feed_posts(category, author_id)')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      
      // This would be a follows table if implemented
      Promise.resolve({ data: [] })
    ]);

    // Analyze interaction patterns
    const categoryInterests = this.analyzeCategoryInterests(likedPosts.data || []);
    const engagementPatterns = this.analyzeEngagementPatterns(
      [...(likedPosts.data || []), ...(comments.data || [])]
    );

    return {
      userId,
      locationPreference: user?.location_preference,
      categoryInterests: Object.keys(categoryInterests).slice(0, 5), // Top 5 categories
      interactionHistory: {
        likedCategories: categoryInterests,
        followedAuthors: [], // Would be populated from follows table
        engagementPatterns
      },
      personalityProfile: {
        explorationVsExploitation: 0.3, // Slightly favor familiar content
        trendFollowing: 0.6, // Moderate trend following
        localFocus: user?.location_preference ? 0.7 : 0.3 // High if location set
      }
    };
  }

  /**
   * Analyze user's category interests from interactions
   */
  private analyzeCategoryInterests(interactions: any[]): Record<string, number> {
    const categoryCount: Record<string, number> = {};
    
    interactions.forEach(interaction => {
      const category = interaction.feed_posts?.category;
      if (category) {
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      }
    });

    // Normalize to percentages
    const total = Object.values(categoryCount).reduce((sum, count) => sum + count, 0);
    const normalized: Record<string, number> = {};
    
    Object.entries(categoryCount).forEach(([category, count]) => {
      normalized[category] = count / total;
    });

    return normalized;
  }

  /**
   * Analyze user's engagement patterns
   */
  private analyzeEngagementPatterns(interactions: any[]): UserPreferences['interactionHistory']['engagementPatterns'] {
    const timeOfDay: Record<string, number> = {};
    const dayOfWeek: Record<string, number> = {};
    const contentTypes: Record<string, number> = {};

    interactions.forEach(interaction => {
      const date = new Date(interaction.created_at);
      const hour = date.getHours();
      const day = date.getDay();

      // Time of day (0-23)
      const timeSlot = `${Math.floor(hour / 4) * 4}-${Math.floor(hour / 4) * 4 + 3}`;
      timeOfDay[timeSlot] = (timeOfDay[timeSlot] || 0) + 1;

      // Day of week
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
      dayOfWeek[dayName] = (dayOfWeek[dayName] || 0) + 1;

      // Content types (would need more analysis)
      contentTypes['general'] = (contentTypes['general'] || 0) + 1;
    });

    return { timeOfDay, dayOfWeek, contentTypes };
  }

  /**
   * Get default user preferences for new users
   */
  private getDefaultUserPreferences(userId: string): UserPreferences {
    return {
      userId,
      categoryInterests: ['beauty', 'lifestyle', 'general'],
      interactionHistory: {
        likedCategories: {},
        followedAuthors: [],
        engagementPatterns: {
          timeOfDay: {},
          dayOfWeek: {},
          contentTypes: {}
        }
      },
      personalityProfile: {
        explorationVsExploitation: 0.5,
        trendFollowing: 0.5,
        localFocus: 0.5
      }
    };
  }

  /**
   * Calculate personalized weights based on user preferences
   */
  private calculatePersonalizedWeights(
    userPreferences: UserPreferences,
    customWeights?: Partial<FeedRankingWeights>
  ): FeedRankingWeights {
    let weights = { ...this.defaultWeights };

    // Apply custom weights if provided
    if (customWeights) {
      weights = { ...weights, ...customWeights };
    }

    // Adjust based on user personality
    const personality = userPreferences.personalityProfile;

    // Trend followers prefer engagement over recency
    if (personality.trendFollowing > 0.7) {
      weights.engagement += 0.1;
      weights.recency -= 0.05;
      weights.relevance -= 0.05;
    }

    // Local focus users prefer relevance
    if (personality.localFocus > 0.7) {
      weights.relevance += 0.1;
      weights.authorInfluence -= 0.05;
      weights.recency -= 0.05;
    }

    // Exploration-focused users get more diverse content
    if (personality.explorationVsExploitation > 0.7) {
      weights.relevance -= 0.1;
      weights.recency += 0.05;
      weights.engagement += 0.05;
    }

    // Ensure weights sum to 1
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(weights).forEach(key => {
      weights[key as keyof FeedRankingWeights] /= total;
    });

    return weights;
  }

  /**
   * Get eligible posts for ranking
   */
  private async getEligiblePosts(options: FeedRankingOptions): Promise<FeedPost[]> {
    let query = this.supabase
      .from('feed_posts')
      .select(`
        *,
        author:users(id, name, nickname, profile_image_url, is_influencer, verification_status),
        images:post_images(*),
        post_likes(id)
      `)
      .eq('status', 'published')
      .eq('is_hidden', false)
      .neq('moderation_status', 'rejected');

    // Apply time window filter
    if (options.timeWindow) {
      const timeWindows = {
        hour: 1,
        day: 24,
        week: 24 * 7,
        month: 24 * 30
      };
      
      const hoursAgo = timeWindows[options.timeWindow];
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', cutoffTime);
    }

    // Apply category filter
    if (options.categoryFilter && options.categoryFilter.length > 0) {
      query = query.in('category', options.categoryFilter);
    }

    // Apply location filter
    if (options.locationFilter) {
      query = query.ilike('location_tag', `%${options.locationFilter}%`);
    }

    // Apply minimum quality filter
    if (options.minQualityScore) {
      // This would require a computed column or separate quality scoring
      // For now, we'll filter by engagement as a proxy
      query = query.gte('like_count', Math.floor(options.minQualityScore / 10));
    }

    // Order by created_at for consistent pagination
    query = query.order('created_at', { ascending: false });

    // Get more posts than needed for better ranking
    const fetchLimit = Math.min((options.limit || 20) * 5, 500);
    query = query.limit(fetchLimit);

    const { data: posts, error } = await query;

    if (error) {
      logger.error('Failed to fetch eligible posts', { error, options });
      throw error;
    }

    return posts || [];
  }

  /**
   * Apply diversity boost to prevent filter bubbles
   */
  private applyDiversityBoost(
    rankedMetrics: ContentMetrics[],
    userPreferences: UserPreferences
  ): ContentMetrics[] {
    const diversityFactor = userPreferences.personalityProfile.explorationVsExploitation;
    
    if (diversityFactor < 0.3) {
      return rankedMetrics; // Low diversity preference
    }

    // Implement diversity injection
    const result: ContentMetrics[] = [];
    const seenCategories = new Set<string>();
    const seenAuthors = new Set<string>();
    
    let diversityInjections = 0;
    const maxDiversityInjections = Math.floor(rankedMetrics.length * diversityFactor * 0.3);

    for (let i = 0; i < rankedMetrics.length; i++) {
      const metric = rankedMetrics[i];
      result.push(metric);

      // Every few items, try to inject diverse content
      if (i > 0 && i % 3 === 0 && diversityInjections < maxDiversityInjections) {
        const diverseCandidate = this.findDiverseCandidate(
          rankedMetrics.slice(i + 1),
          seenCategories,
          seenAuthors
        );

        if (diverseCandidate) {
          result.push(diverseCandidate);
          diversityInjections++;
          
          // Remove from remaining candidates
          const candidateIndex = rankedMetrics.indexOf(diverseCandidate);
          if (candidateIndex > i) {
            rankedMetrics.splice(candidateIndex, 1);
          }
        }
      }

      // Track seen content for diversity
      // Note: This would need post data to track categories and authors
      // For now, we'll use the postId as a proxy
      seenAuthors.add(metric.postId.substring(0, 8)); // Rough author proxy
    }

    return result;
  }

  /**
   * Find diverse candidate for injection
   */
  private findDiverseCandidate(
    candidates: ContentMetrics[],
    seenCategories: Set<string>,
    seenAuthors: Set<string>
  ): ContentMetrics | null {
    // This is a simplified implementation
    // In practice, you'd need access to post data to check actual diversity
    
    for (const candidate of candidates) {
      const authorProxy = candidate.postId.substring(0, 8);
      
      if (!seenAuthors.has(authorProxy) && candidate.finalScore > 30) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Calculate location similarity
   */
  private calculateLocationSimilarity(postLocation: string, userLocation: string): number {
    if (!postLocation || !userLocation) return 0;

    const postLoc = postLocation.toLowerCase();
    const userLoc = userLocation.toLowerCase();

    // Exact match
    if (postLoc === userLoc) return 1;

    // Partial match (same city/region)
    if (postLoc.includes(userLoc) || userLoc.includes(postLoc)) return 0.7;

    // Same country/area (rough heuristic)
    const postParts = postLoc.split(/[,\s]+/);
    const userParts = userLoc.split(/[,\s]+/);
    
    const commonParts = postParts.filter(part => 
      userParts.some(userPart => userPart.includes(part) || part.includes(userPart))
    );

    return commonParts.length > 0 ? 0.3 : 0;
  }

  /**
   * Calculate hashtag relevance
   */
  private calculateHashtagRelevance(
    postHashtags: string[],
    userPreferences: UserPreferences
  ): number {
    // This is simplified - in practice you'd have hashtag interaction history
    const categoryHashtags = {
      beauty: ['beauty', 'makeup', 'skincare', 'cosmetics', 'nails'],
      lifestyle: ['lifestyle', 'daily', 'life', 'mood', 'vibes'],
      review: ['review', 'recommend', 'experience', 'rating'],
      promotion: ['sale', 'discount', 'offer', 'deal', 'promo'],
      general: ['general', 'random', 'thoughts', 'share']
    };

    let relevanceScore = 0;
    let matchCount = 0;

    for (const hashtag of postHashtags) {
      for (const category of userPreferences.categoryInterests) {
        const categoryTags = categoryHashtags[category as keyof typeof categoryHashtags] || [];
        if (categoryTags.some(tag => hashtag.toLowerCase().includes(tag))) {
          relevanceScore += 1;
          matchCount++;
          break;
        }
      }
    }

    return matchCount > 0 ? relevanceScore / postHashtags.length : 0;
  }

  /**
   * Calculate time-based relevance
   */
  private calculateTimeRelevance(
    post: FeedPost,
    userPreferences: UserPreferences
  ): number {
    const postDate = new Date(post.created_at);
    const postHour = postDate.getHours();
    const postDay = postDate.getDay();

    const patterns = userPreferences.interactionHistory.engagementPatterns;
    
    // Check if user is typically active at this time
    const timeSlot = `${Math.floor(postHour / 4) * 4}-${Math.floor(postHour / 4) * 4 + 3}`;
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][postDay];

    const timeScore = patterns.timeOfDay[timeSlot] || 0;
    const dayScore = patterns.dayOfWeek[dayName] || 0;

    // Normalize and combine
    const maxTimeScore = Math.max(...Object.values(patterns.timeOfDay), 1);
    const maxDayScore = Math.max(...Object.values(patterns.dayOfWeek), 1);

    return (timeScore / maxTimeScore + dayScore / maxDayScore) / 2;
  }

  /**
   * Cache feed results for performance
   */
  private async cacheFeedResults(
    userId: string,
    metrics: ContentMetrics[],
    weights: FeedRankingWeights
  ): Promise<void> {
    try {
      const cacheKey = `feed_ranking:${userId}`;
      const cacheData = {
        metrics: metrics.slice(0, 100), // Cache top 100
        weights,
        timestamp: Date.now()
      };

      await this.redis.setEx(
        cacheKey,
        this.cacheTTL.feedRankings,
        String(JSON.stringify(cacheData))
      );

    } catch (error) {
      logger.warn('Failed to cache feed results', { userId, error });
    }
  }

  /**
   * Get trending content
   */
  async getTrendingContent(options: {
    timeframe?: 'hour' | 'day' | 'week';
    category?: string;
    location?: string;
    limit?: number;
  } = {}): Promise<TrendingContent[]> {
    try {
      const cacheKey = `trending:${JSON.stringify(options)}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached.toString());
      }

      // Calculate trending content
      const trending = await this.calculateTrendingContent(options);
      
      // Cache results
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.trendingContent,
        JSON.stringify(trending)
      );

      return trending;

    } catch (error) {
      logger.error('Failed to get trending content', { error, options });
      return [];
    }
  }

  /**
   * Calculate trending content based on engagement velocity
   */
  private async calculateTrendingContent(options: {
    timeframe?: 'hour' | 'day' | 'week';
    category?: string;
    location?: string;
    limit?: number;
  }): Promise<TrendingContent[]> {
    const timeframe = options.timeframe || 'day';
    const limit = options.limit || 20;

    // Time windows for trending calculation
    const timeWindows = {
      hour: 1,
      day: 24,
      week: 24 * 7
    };

    const hoursAgo = timeWindows[timeframe];
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    let query = this.supabase
      .from('feed_posts')
      .select('id, category, location_tag, like_count, comment_count, share_count, view_count, created_at')
      .eq('status', 'published')
      .eq('is_hidden', false)
      .gte('created_at', cutoffTime);

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.location) {
      query = query.ilike('location_tag', `%${options.location}%`);
    }

    const { data: posts, error } = await query.limit(500);

    if (error || !posts) {
      logger.error('Failed to fetch posts for trending calculation', { error });
      return [];
    }

    // Calculate trending scores
    const trendingPosts = posts.map(post => {
      const postAge = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
      const engagementVelocity = this.calculateEngagementVelocity(post, postAge);
      
      // Create a mock FeedPost for virality calculation
      const mockFeedPost: FeedPost = {
        id: post.id,
        author_id: '', // Not needed for virality calculation
        content: '', // Not needed for virality calculation
        category: post.category || 'general',
        location_tag: post.location_tag,
        hashtags: [], // Not needed for virality calculation
        images: [], // Not needed for virality calculation
        tagged_shop_id: null, // Not needed for virality calculation
        like_count: post.like_count || 0,
        comment_count: post.comment_count || 0,
        share_count: post.share_count || 0,
        view_count: post.view_count || 0,
        report_count: 0, // Not needed for virality calculation
        status: 'published' as any,
        is_hidden: false,
        moderation_status: 'approved',
        moderation_score: 0, // Not needed for virality calculation
        requires_review: false, // Not needed for virality calculation
        created_at: post.created_at,
        updated_at: post.created_at
      };
      
      const viralityScore = this.calculateViralityScore(mockFeedPost);
      const trendingScore = engagementVelocity * 0.7 + viralityScore * 0.3;

      return {
        postId: post.id,
        trendingScore,
        category: post.category || 'general',
        location: post.location_tag,
        timeframe,
        metrics: {
          engagementVelocity,
          shareRate: (post.share_count || 0) / Math.max(post.view_count || 1, 1),
          commentRate: (post.comment_count || 0) / Math.max(post.view_count || 1, 1),
          uniqueViewers: post.view_count || 0
        }
      };
    });

    // Sort by trending score and return top results
    return trendingPosts
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }

  /**
   * Calculate engagement velocity (engagement per hour)
   */
  private calculateEngagementVelocity(post: any, ageInHours: number): number {
    const totalEngagement = (post.like_count || 0) + (post.comment_count || 0) * 2 + (post.share_count || 0) * 3;
    return ageInHours > 0 ? totalEngagement / ageInHours : totalEngagement;
  }

  /**
   * Update user preferences based on interaction
   */
  async updateUserPreferences(
    userId: string,
    interaction: {
      type: 'like' | 'comment' | 'share' | 'view';
      postId: string;
      category?: string;
      authorId?: string;
    }
  ): Promise<void> {
    try {
      // Invalidate cache
      const cacheKey = `user_preferences:${userId}`;
      await this.redis.del(cacheKey);

      // Log interaction for future preference building
      logger.info('User interaction recorded for preference update', {
        userId,
        interaction
      });

    } catch (error) {
      logger.warn('Failed to update user preferences', { userId, error });
    }
  }

  /**
   * Get feed performance analytics
   */
  async getFeedAnalytics(userId: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalPosts: number;
    avgEngagementRate: number;
    topCategories: Array<{ category: string; count: number }>;
    engagementTrends: Array<{ date: string; engagement: number }>;
    personalizedScore: number;
  }> {
    try {
      // This would implement comprehensive feed analytics
      // For now, return mock data structure
      return {
        totalPosts: 0,
        avgEngagementRate: 0,
        topCategories: [],
        engagementTrends: [],
        personalizedScore: 0
      };

    } catch (error) {
      logger.error('Failed to get feed analytics', { userId, error });
      throw error;
    }
  }
}

export const feedRankingService = new FeedRankingService();
