/**
 * Enhanced Profanity Filter Service
 * 
 * Advanced profanity detection and filtering with multi-language support,
 * contextual analysis, and intelligent replacement strategies.
 */

import { logger } from '../utils/logger';

export interface ProfanityAnalysisResult {
  isClean: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';
  score: number; // 0-100, where 100 is most inappropriate
  detectedWords: DetectedProfanity[];
  cleanedText: string;
  suggestions: string[];
  confidence: number; // 0-100
}

export interface DetectedProfanity {
  word: string;
  category: ProfanityCategory;
  severity: 'mild' | 'moderate' | 'severe' | 'extreme';
  position: { start: number; end: number };
  context: string;
  replacement: string;
  confidence: number;
  language: 'english' | 'korean' | 'japanese' | 'chinese' | 'mixed';
}

export type ProfanityCategory = 
  | 'sexual'
  | 'violence' 
  | 'hate_speech'
  | 'discrimination'
  | 'harassment'
  | 'general_profanity'
  | 'religious'
  | 'political'
  | 'scam'
  | 'spam';

export interface ProfanityFilterConfig {
  strictMode: boolean;
  enableContextAnalysis: boolean;
  enableMultiLanguage: boolean;
  enableLeetSpeakDetection: boolean;
  enablePhoneticMatching: boolean;
  customBlockedWords: string[];
  customAllowedWords: string[];
  replacementStrategy: 'asterisk' | 'random' | 'similar' | 'remove' | 'custom';
  customReplacements: Map<string, string>;
  severityThreshold: 'mild' | 'moderate' | 'severe' | 'extreme';
}

class ProfanityFilterService {
  private config: ProfanityFilterConfig;

  // Comprehensive profanity database with categories and severity
  private readonly profanityDatabase = {
    english: {
      extreme: {
        sexual: ['fuck', 'cunt', 'cock', 'pussy', 'dick', 'whore', 'slut', 'bitch'],
        hate_speech: ['nigger', 'faggot', 'kike', 'chink', 'spic', 'wetback'],
        violence: ['kill', 'murder', 'rape', 'torture', 'genocide']
      },
      severe: {
        sexual: ['sex', 'porn', 'nude', 'naked', 'horny', 'orgasm'],
        general_profanity: ['shit', 'damn', 'hell', 'bastard', 'asshole'],
        harassment: ['retard', 'idiot', 'moron', 'stupid', 'loser']
      },
      moderate: {
        general_profanity: ['crap', 'suck', 'piss', 'fart'],
        harassment: ['ugly', 'fat', 'dumb', 'weird']
      },
      mild: {
        general_profanity: ['damn', 'darn', 'heck']
      }
    },
    korean: {
      extreme: {
        sexual: ['좆', '보지', '자지', '섹스', '야동'],
        general_profanity: ['시발', '씨발', '개새끼', '병신'],
        hate_speech: ['장애인', '정신병자']
      },
      severe: {
        general_profanity: ['지랄', '개년', '년', '놈', '새끼', '미친'],
        harassment: ['바보', '멍청이', '똥개', '쓰레기']
      },
      moderate: {
        general_profanity: ['꺼져', '닥쳐', '엿먹어'],
        harassment: ['못생긴', '뚱뚱한']
      }
    },
    japanese: {
      extreme: {
        sexual: ['セックス', 'エロ', 'ポルノ'],
        general_profanity: ['くそ', 'ちくしょう', 'やろう']
      },
      severe: {
        general_profanity: ['ばか', 'あほ', 'きちく', 'ぶす'],
        harassment: ['死ね', 'きえろ']
      }
    },
    chinese: {
      extreme: {
        sexual: ['操', '妈的', '傻逼'],
        general_profanity: ['白痴', '混蛋', '王八蛋']
      },
      severe: {
        general_profanity: ['去死', '滚蛋', '笨蛋'],
        harassment: ['丑八怪', '胖子']
      }
    }
  };

  // Leetspeak and obfuscation patterns
  private readonly obfuscationPatterns = [
    { original: 'fuck', patterns: ['f*ck', 'f**k', 'fck', 'fuk', 'phuck', 'f4ck', 'fu(k', 'f.u.c.k'] },
    { original: 'shit', patterns: ['sh*t', 'sh**', 'sht', 'shyt', 'sh1t', 's.h.i.t'] },
    { original: 'bitch', patterns: ['b*tch', 'b**ch', 'btch', 'bi7ch', 'b.i.t.c.h'] },
    { original: '시발', patterns: ['시1발', 'ㅅㅂ', 'ㅆㅂ', 'si발', 's발', '시ㅂ'] },
    { original: '씨발', patterns: ['씨1발', 'ㅆㅂ', 'c발', '씨ㅂ'] }
  ];

  // Context-aware patterns (words that might be okay in certain contexts)
  private readonly contextualWords = [
    { word: 'kill', allowedContexts: ['kill time', 'kill it', 'killer app', 'killer workout'] },
    { word: 'sex', allowedContexts: ['sex education', 'sexual health', 'sex therapy'] },
    { word: 'hell', allowedContexts: ['what the hell', 'hell yeah', 'hell no'] }
  ];

  // Replacement strategies
  private readonly replacements = {
    asterisk: (word: string) => '*'.repeat(word.length),
    random: (word: string) => this.generateRandomReplacement(word.length),
    similar: (word: string) => this.generateSimilarReplacement(word),
    remove: () => '[removed]',
    custom: (word: string) => this.config.customReplacements.get(word.toLowerCase()) || '***'
  };

  constructor(config?: Partial<ProfanityFilterConfig>) {
    this.config = {
      strictMode: false,
      enableContextAnalysis: true,
      enableMultiLanguage: true,
      enableLeetSpeakDetection: true,
      enablePhoneticMatching: false,
      customBlockedWords: [],
      customAllowedWords: [],
      replacementStrategy: 'asterisk',
      customReplacements: new Map(),
      severityThreshold: 'moderate',
      ...config
    };
  }

  /**
   * Analyze text for profanity with comprehensive detection
   */
  async analyzeProfanity(text: string): Promise<ProfanityAnalysisResult> {
    try {
      const detectedWords: DetectedProfanity[] = [];
      let cleanedText = text;
      let totalScore = 0;
      let maxSeverity: 'none' | 'mild' | 'moderate' | 'severe' | 'extreme' = 'none';

      // Detect profanity in multiple languages
      if (this.config.enableMultiLanguage) {
        for (const [language, categories] of Object.entries(this.profanityDatabase)) {
          const languageDetections = this.detectInLanguage(text, language as any, categories);
          detectedWords.push(...languageDetections);
        }
      }

      // Detect obfuscated profanity
      if (this.config.enableLeetSpeakDetection) {
        const obfuscatedDetections = this.detectObfuscated(text);
        detectedWords.push(...obfuscatedDetections);
      }

      // Detect custom blocked words
      const customDetections = this.detectCustomWords(text);
      detectedWords.push(...customDetections);

      // Context analysis to reduce false positives
      if (this.config.enableContextAnalysis) {
        this.analyzeContext(detectedWords, text);
      }

      // Calculate overall score and severity
      for (const detection of detectedWords) {
        const severityScore = this.getSeverityScore(detection.severity);
        totalScore += severityScore * (detection.confidence / 100);
        
        if (this.getSeverityLevel(detection.severity) > this.getSeverityLevel(maxSeverity)) {
          maxSeverity = detection.severity;
        }
      }

      // Generate cleaned text
      cleanedText = this.generateCleanedText(text, detectedWords);

      // Generate suggestions
      const suggestions = this.generateSuggestions(detectedWords);

      // Calculate confidence
      const confidence = detectedWords.length > 0 ? 
        Math.round(detectedWords.reduce((sum, d) => sum + d.confidence, 0) / detectedWords.length) : 100;

      return {
        isClean: detectedWords.length === 0 || maxSeverity === 'none',
        severity: maxSeverity,
        score: Math.min(Math.round(totalScore), 100),
        detectedWords,
        cleanedText,
        suggestions,
        confidence
      };

    } catch (error) {
      logger.error('Profanity analysis error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length
      });

      return {
        isClean: false,
        severity: 'severe',
        score: 80,
        detectedWords: [],
        cleanedText: text,
        suggestions: [],
        confidence: 50
      };
    }
  }

  /**
   * Quick profanity check (lighter version)
   */
  async quickCheck(text: string): Promise<boolean> {
    const result = await this.analyzeProfanity(text);
    const thresholdLevel = this.getSeverityLevel(this.config.severityThreshold);
    const detectedLevel = this.getSeverityLevel(result.severity);
    
    return detectedLevel < thresholdLevel;
  }

  /**
   * Clean text by replacing profanity
   */
  async cleanText(text: string): Promise<string> {
    const result = await this.analyzeProfanity(text);
    return result.cleanedText;
  }

  /**
   * Detect profanity in a specific language
   */
  private detectInLanguage(
    text: string, 
    language: keyof typeof this.profanityDatabase, 
    categories: any
  ): DetectedProfanity[] {
    const detections: DetectedProfanity[] = [];
    const lowerText = text.toLowerCase();

    for (const [severity, categoryMap] of Object.entries(categories)) {
      for (const [category, words] of Object.entries(categoryMap as any)) {
        for (const word of words as string[]) {
          const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
          let match;

          while ((match = regex.exec(text)) !== null) {
            // Check if word is in allowed list
            if (this.config.customAllowedWords.includes(word.toLowerCase())) {
              continue;
            }

            detections.push({
              word: match[0],
              category: category as ProfanityCategory,
              severity: severity as any,
              position: { start: match.index, end: match.index + match[0].length },
              context: this.getContext(text, match.index, match[0].length),
              replacement: this.generateReplacement(match[0]),
              confidence: 95,
              language: language as any
            });
          }
        }
      }
    }

    return detections;
  }

  /**
   * Detect obfuscated profanity (leetspeak, symbols, etc.)
   */
  private detectObfuscated(text: string): DetectedProfanity[] {
    const detections: DetectedProfanity[] = [];

    for (const { original, patterns } of this.obfuscationPatterns) {
      for (const pattern of patterns) {
        const regex = new RegExp(this.escapeRegex(pattern), 'gi');
        let match;

        while ((match = regex.exec(text)) !== null) {
          detections.push({
            word: match[0],
            category: 'general_profanity',
            severity: 'severe',
            position: { start: match.index, end: match.index + match[0].length },
            context: this.getContext(text, match.index, match[0].length),
            replacement: this.generateReplacement(original),
            confidence: 85,
            language: 'mixed'
          });
        }
      }
    }

    return detections;
  }

  /**
   * Detect custom blocked words
   */
  private detectCustomWords(text: string): DetectedProfanity[] {
    const detections: DetectedProfanity[] = [];

    for (const word of this.config.customBlockedWords) {
      const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        detections.push({
          word: match[0],
          category: 'general_profanity',
          severity: 'moderate',
          position: { start: match.index, end: match.index + match[0].length },
          context: this.getContext(text, match.index, match[0].length),
          replacement: this.generateReplacement(match[0]),
          confidence: 100,
          language: 'mixed'
        });
      }
    }

    return detections;
  }

  /**
   * Analyze context to reduce false positives
   */
  private analyzeContext(detections: DetectedProfanity[], text: string): void {
    for (const detection of detections) {
      const contextualWord = this.contextualWords.find(cw => 
        cw.word.toLowerCase() === detection.word.toLowerCase()
      );

      if (contextualWord) {
        const context = detection.context.toLowerCase();
        const isAllowedContext = contextualWord.allowedContexts.some(allowedContext =>
          context.includes(allowedContext.toLowerCase())
        );

        if (isAllowedContext) {
          detection.confidence = Math.max(detection.confidence - 40, 10);
          detection.severity = 'mild';
        }
      }
    }
  }

  /**
   * Generate cleaned text with replacements
   */
  private generateCleanedText(text: string, detections: DetectedProfanity[]): string {
    let cleanedText = text;
    
    // Sort detections by position (reverse order to maintain indices)
    const sortedDetections = [...detections].sort((a, b) => b.position.start - a.position.start);

    for (const detection of sortedDetections) {
      if (detection.confidence >= 70) { // Only replace high-confidence detections
        const before = cleanedText.substring(0, detection.position.start);
        const after = cleanedText.substring(detection.position.end);
        cleanedText = before + detection.replacement + after;
      }
    }

    return cleanedText;
  }

  /**
   * Generate replacement for a word
   */
  private generateReplacement(word: string): string {
    const strategy = this.replacements[this.config.replacementStrategy];
    return strategy ? strategy(word) : this.replacements.asterisk(word);
  }

  /**
   * Generate random replacement characters
   */
  private generateRandomReplacement(length: number): string {
    const chars = '!@#$%^&*';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  /**
   * Generate similar-looking replacement
   */
  private generateSimilarReplacement(word: string): string {
    const replacements: { [key: string]: string } = {
      'a': '@', 'e': '3', 'i': '1', 'o': '0', 's': '$', 't': '7'
    };

    return word.toLowerCase().split('').map(char => replacements[char] || '*').join('');
  }

  /**
   * Get context around a word
   */
  private getContext(text: string, start: number, length: number): string {
    const contextLength = 20;
    const contextStart = Math.max(0, start - contextLength);
    const contextEnd = Math.min(text.length, start + length + contextLength);
    return text.substring(contextStart, contextEnd);
  }

  /**
   * Generate suggestions for cleaner alternatives
   */
  private generateSuggestions(detections: DetectedProfanity[]): string[] {
    const suggestions: string[] = [];
    
    for (const detection of detections) {
      switch (detection.category) {
        case 'general_profanity':
          suggestions.push('Please use more respectful language');
          break;
        case 'hate_speech':
          suggestions.push('Hate speech is not allowed');
          break;
        case 'sexual':
          suggestions.push('Sexual content is not appropriate');
          break;
        case 'harassment':
          suggestions.push('Please be kind and respectful to others');
          break;
        default:
          suggestions.push('Please review your content for appropriateness');
      }
    }

    // Remove duplicates and limit
    const uniqueSuggestions = suggestions.filter((item, index) => suggestions.indexOf(item) === index);
    return uniqueSuggestions.slice(0, 3);
  }

  /**
   * Get severity score for calculations
   */
  private getSeverityScore(severity: string): number {
    const scores = { mild: 10, moderate: 25, severe: 50, extreme: 100 };
    return scores[severity as keyof typeof scores] || 0;
  }

  /**
   * Get severity level for comparisons
   */
  private getSeverityLevel(severity: string): number {
    const levels = { none: 0, mild: 1, moderate: 2, severe: 3, extreme: 4 };
    return levels[severity as keyof typeof levels] || 0;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Add custom blocked word
   */
  addCustomBlockedWord(word: string): void {
    if (!this.config.customBlockedWords.includes(word.toLowerCase())) {
      this.config.customBlockedWords.push(word.toLowerCase());
    }
  }

  /**
   * Add custom allowed word
   */
  addCustomAllowedWord(word: string): void {
    if (!this.config.customAllowedWords.includes(word.toLowerCase())) {
      this.config.customAllowedWords.push(word.toLowerCase());
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ProfanityFilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const profanityFilterService = new ProfanityFilterService();
