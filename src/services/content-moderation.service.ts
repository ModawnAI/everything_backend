import { logger } from '../utils/logger';
import { CustomError } from '../utils/error-handler';

export interface ContentAnalysisResult {
  isAppropriate: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100, where 100 is most inappropriate
  violations: ContentViolation[];
  suggestedAction: 'allow' | 'flag' | 'block' | 'review';
  confidence: number; // 0-100, confidence in the analysis
}

export interface ContentViolation {
  type: 'profanity' | 'spam' | 'harassment' | 'inappropriate' | 'fake_content' | 'phishing' | 'hate_speech';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  position?: {
    start: number;
    end: number;
    text: string;
  };
}

export interface ModerationConfig {
  thresholds: {
    block: number;      // Score above which to block content
    flag: number;       // Score above which to flag for review
    low: number;        // Score above which to mark as low severity
    medium: number;     // Score above which to mark as medium severity
    high: number;       // Score above which to mark as high severity
  };
  enableAutoBlock: boolean;
  enableAutoFlag: boolean;
  minConfidence: number; // Minimum confidence to take automated action
}

class ContentModerationService {
  private config: ModerationConfig;

  // Inappropriate content patterns
  private profanityPatterns = [
    /\b(fuck|shit|damn|bitch|asshole|cunt|piss|hell|crap|bollocks)\b/gi,
    /\b(시발|씨발|지랄|개새끼|좆|꺼져|닥쳐|병신|미친|씨팔)\b/gi,
    /\b(クソ|バカ|アホ|死ね|殺す|馬鹿|糞|クソ野郎)\b/gi,
  ];

  private spamPatterns = [
    /\b(buy now|click here|limited time|act now|don't miss|urgent|free money|make money|get rich|work from home)\b/gi,
    /\b(지금 구매|클릭하세요|한정 시간|놓치지 마세요|긴급|무료 돈|돈 벌기|부자되기|재택근무)\b/gi,
    /\b(今すぐ購入|クリック|限定時間|見逃すな|緊急|無料のお金|お金を稼ぐ|リッチになる|在宅勤務)\b/gi,
    /(http[s]?:\/\/[^\s]+){3,}/gi, // Multiple URLs
    /(www\.[^\s]+){3,}/gi, // Multiple websites
    /\b(guarantee|guaranteed|promise|100%|no risk|risk free|instant|immediate)\b/gi,
  ];

  private harassmentPatterns = [
    /\b(kill yourself|die|suicide|hang yourself|jump off|cut yourself)\b/gi,
    /\b(자살해|죽어|목매달아|뛰어내려|칼로 자해)\b/gi,
    /\b(自殺|死ね|首吊り|飛び降り|切腹)\b/gi,
    /\b(threat|threaten|hurt you|harm you|revenge|payback)\b/gi,
    /\b(협박|위협|해치겠다|복수|보복)\b/gi,
    /\b(脅迫|危害|復讐|報復)\b/gi,
  ];

  private inappropriatePatterns = [
    /\b(sex|porn|nude|naked|strip|escort|prostitute|hooker|massage parlor)\b/gi,
    /\b(성인|포르노|나체|스트립|에스코트|매춘|마사지 업소)\b/gi,
    /\b(セックス|ポルノ|裸|ストリップ|エスコート|売春|マッサージ)\b/gi,
    /\b(drug|marijuana|cocaine|heroin|crystal meth|weed|pills)\b/gi,
    /\b(마약|대마초|코카인|헤로인|크리스탈|위드|약물)\b/gi,
    /\b(ドラッグ|マリファナ|コカイン|ヘロイン|クリスタル|ウィード)\b/gi,
  ];

  private fakeContentPatterns = [
    /\b(fake|scam|fraud|cheat|lie|false|misleading|deceive)\b/gi,
    /\b(가짜|사기|사칭|속임|거짓|오해|기만)\b/gi,
    /\b(偽物|詐欺|騙す|嘘|誤解|欺く)\b/gi,
    /\b(not real|not genuine|counterfeit|imitation|replica)\b/gi,
    /\b(진짜 아님|정품 아님|모조품|복제품|이미테이션)\b/gi,
    /\b(本物ではない|偽物|模倣品|レプリカ)\b/gi,
  ];

  private phishingPatterns = [
    /\b(password|login|account|verify|confirm|update|suspended|locked)\b/gi,
    /\b(비밀번호|로그인|계정|확인|업데이트|정지|잠김)\b/gi,
    /\b(パスワード|ログイン|アカウント|確認|更新|停止|ロック)\b/gi,
    /(click here to|verify your|confirm your|update your|unlock your)/gi,
    /(여기를 클릭|확인하세요|업데이트하세요|잠금 해제)/gi,
    /(ここをクリック|確認してください|更新してください|ロック解除)/gi,
  ];

  private hateSpeechPatterns = [
    /\b(nazi|hitler|fascist|racist|sexist|homophobe|transphobe)\b/gi,
    /\b(나치|히틀러|파시스트|인종차별|성차별|동성애혐오|성전환혐오)\b/gi,
    /\b(ナチ|ヒトラー|ファシスト|人種差別|性差別|同性愛嫌悪|性転換嫌悪)\b/gi,
    /\b(white power|black power|supremacist|terrorist|extremist)\b/gi,
    /\b(백인 우월|흑인 우월|우월주의|테러리스트|극단주의)\b/gi,
    /\b(白人優越|黒人優越|優越主義|テロリスト|過激派)\b/gi,
  ];

  // Suspicious patterns that might indicate fake or spam content
  private suspiciousPatterns = [
    /(new|just opened|grand opening|special offer|limited edition)/gi,
    /(신규|막 오픈|그랜드 오픈|특별 할인|한정판)/gi,
    /(新規|オープン|グランドオープン|特別割引|限定版)/gi,
    /\b(call now|text now|dm me|contact us|message us)\b/gi,
    /\b(지금 전화|문자해|dm해|연락해|메시지해)\b/gi,
    /\b(今すぐ電話|テキスト|DM|連絡|メッセージ)\b/gi,
  ];

  constructor() {
    this.config = {
      thresholds: {
        block: 80,
        flag: 60,
        low: 20,
        medium: 40,
        high: 60,
      },
      enableAutoBlock: true,
      enableAutoFlag: true,
      minConfidence: 70,
    };
  }

  /**
   * Analyze text content for inappropriate content
   */
  async analyzeContent(content: string, contentType: 'shop_name' | 'shop_description' | 'profile_content'): Promise<ContentAnalysisResult> {
    try {
      if (!content || typeof content !== 'string') {
        return {
          isAppropriate: true,
          severity: 'low',
          score: 0,
          violations: [],
          suggestedAction: 'allow',
          confidence: 100,
        };
      }

      const violations: ContentViolation[] = [];
      let totalScore = 0;
      let maxConfidence = 0;

      // Check for profanity
      const profanityViolations = this.checkProfanity(content);
      violations.push(...profanityViolations);

      // Check for spam
      const spamViolations = this.checkSpam(content);
      violations.push(...spamViolations);

      // Check for harassment
      const harassmentViolations = this.checkHarassment(content);
      violations.push(...harassmentViolations);

      // Check for inappropriate content
      const inappropriateViolations = this.checkInappropriateContent(content);
      violations.push(...inappropriateViolations);

      // Check for fake content
      const fakeViolations = this.checkFakeContent(content);
      violations.push(...fakeViolations);

      // Check for phishing
      const phishingViolations = this.checkPhishing(content);
      violations.push(...phishingViolations);

      // Check for hate speech
      const hateSpeechViolations = this.checkHateSpeech(content);
      violations.push(...hateSpeechViolations);

      // Calculate overall score and confidence
      violations.forEach(violation => {
        const severityMultiplier = this.getSeverityMultiplier(violation.severity);
        totalScore += violation.confidence * severityMultiplier;
        maxConfidence = Math.max(maxConfidence, violation.confidence);
      });

      // Normalize score to 0-100
      const normalizedScore = Math.min(totalScore / violations.length, 100);
      
      // Determine severity
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (normalizedScore >= this.config.thresholds.high) {
        severity = 'high';
      } else if (normalizedScore >= this.config.thresholds.medium) {
        severity = 'medium';
      } else if (normalizedScore >= this.config.thresholds.low) {
        severity = 'low';
      }

      // Check for critical violations
      const criticalViolations = violations.filter(v => v.severity === 'critical');
      if (criticalViolations.length > 0) {
        severity = 'critical';
      }

      // Determine suggested action
      let suggestedAction: 'allow' | 'flag' | 'block' | 'review' = 'allow';
      if (this.config.enableAutoBlock && normalizedScore >= this.config.thresholds.block && maxConfidence >= this.config.minConfidence) {
        suggestedAction = 'block';
      } else if (this.config.enableAutoFlag && normalizedScore >= this.config.thresholds.flag && maxConfidence >= this.config.minConfidence) {
        suggestedAction = 'flag';
      } else if (normalizedScore >= this.config.thresholds.low) {
        suggestedAction = 'review';
      }

      const result: ContentAnalysisResult = {
        isAppropriate: violations.length === 0 || normalizedScore < this.config.thresholds.low,
        severity,
        score: Math.round(normalizedScore),
        violations,
        suggestedAction,
        confidence: Math.round(maxConfidence),
      };

      logger.info('Content analysis completed', {
        contentType,
        score: result.score,
        severity: result.severity,
        violationsCount: violations.length,
        suggestedAction: result.suggestedAction,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('Error analyzing content', { error, contentType });
      throw new CustomError('Content analysis failed', 500);
    }
  }

  /**
   * Check for profanity violations
   */
  private checkProfanity(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.profanityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'profanity',
            description: `Profanity detected: "${match}"`,
            severity: 'medium',
            confidence: 85,
            position,
          });
        });
      }
    });

    return violations;
  }

  /**
   * Check for spam violations
   */
  private checkSpam(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.spamPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'spam',
            description: `Spam content detected: "${match}"`,
            severity: 'medium',
            confidence: 75,
            position,
          });
        });
      }
    });

    // Check for excessive promotional language
    const promotionalWords = content.match(/\b(free|discount|sale|offer|promotion|deal|bargain|cheap|affordable)\b/gi);
    if (promotionalWords && promotionalWords.length >= 3) {
      violations.push({
        type: 'spam',
        description: 'Excessive promotional language detected',
        severity: 'low',
        confidence: 60,
      });
    }

    return violations;
  }

  /**
   * Check for harassment violations
   */
  private checkHarassment(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.harassmentPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'harassment',
            description: `Harassment detected: "${match}"`,
            severity: 'critical',
            confidence: 95,
            position,
          });
        });
      }
    });

    return violations;
  }

  /**
   * Check for inappropriate content violations
   */
  private checkInappropriateContent(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.inappropriatePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'inappropriate',
            description: `Inappropriate content detected: "${match}"`,
            severity: 'high',
            confidence: 90,
            position,
          });
        });
      }
    });

    return violations;
  }

  /**
   * Check for fake content violations
   */
  private checkFakeContent(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.fakeContentPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'fake_content',
            description: `Fake content indicators detected: "${match}"`,
            severity: 'medium',
            confidence: 70,
            position,
          });
        });
      }
    });

    return violations;
  }

  /**
   * Check for phishing violations
   */
  private checkPhishing(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.phishingPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'phishing',
            description: `Phishing attempt detected: "${match}"`,
            severity: 'critical',
            confidence: 85,
            position,
          });
        });
      }
    });

    return violations;
  }

  /**
   * Check for hate speech violations
   */
  private checkHateSpeech(content: string): ContentViolation[] {
    const violations: ContentViolation[] = [];
    
    this.hateSpeechPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const position = this.findPosition(content, match);
          violations.push({
            type: 'hate_speech',
            description: `Hate speech detected: "${match}"`,
            severity: 'critical',
            confidence: 95,
            position,
          });
        });
      }
    });

    return violations;
  }

  /**
   * Find position of a match in the content
   */
  private findPosition(content: string, match: string): { start: number; end: number; text: string } {
    const index = content.indexOf(match);
    return {
      start: index,
      end: index + match.length,
      text: match,
    };
  }

  /**
   * Get severity multiplier for scoring
   */
  private getSeverityMultiplier(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 5;
      default: return 1;
    }
  }

  /**
   * Update moderation configuration
   */
  updateConfig(newConfig: Partial<ModerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Content moderation configuration updated', { config: this.config });
  }

  /**
   * Get current moderation configuration
   */
  getConfig(): ModerationConfig {
    return { ...this.config };
  }

  /**
   * Analyze shop content comprehensively
   */
  async analyzeShopContent(shopData: {
    name?: string;
    description?: string;
    profile_content?: string;
  }): Promise<{
    overallResult: ContentAnalysisResult;
    individualResults: {
      name?: ContentAnalysisResult;
      description?: ContentAnalysisResult;
      profile_content?: ContentAnalysisResult;
    };
  }> {
    try {
      const individualResults: any = {};
      let totalScore = 0;
      let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let hasViolations = false;
      let maxConfidence = 0;
      let suggestedAction: 'allow' | 'flag' | 'block' | 'review' = 'allow';

      // Analyze each content type
      if (shopData.name) {
        individualResults.name = await this.analyzeContent(shopData.name, 'shop_name');
        totalScore += individualResults.name.score;
        maxConfidence = Math.max(maxConfidence, individualResults.name.confidence);
        if (individualResults.name.violations.length > 0) hasViolations = true;
        if (this.getSeverityValue(individualResults.name.severity) > this.getSeverityValue(maxSeverity)) {
          maxSeverity = individualResults.name.severity;
        }
      }

      if (shopData.description) {
        individualResults.description = await this.analyzeContent(shopData.description, 'shop_description');
        totalScore += individualResults.description.score;
        maxConfidence = Math.max(maxConfidence, individualResults.description.confidence);
        if (individualResults.description.violations.length > 0) hasViolations = true;
        if (this.getSeverityValue(individualResults.description.severity) > this.getSeverityValue(maxSeverity)) {
          maxSeverity = individualResults.description.severity;
        }
      }

      if (shopData.profile_content) {
        individualResults.profile_content = await this.analyzeContent(shopData.profile_content, 'profile_content');
        totalScore += individualResults.profile_content.score;
        maxConfidence = Math.max(maxConfidence, individualResults.profile_content.confidence);
        if (individualResults.profile_content.violations.length > 0) hasViolations = true;
        if (this.getSeverityValue(individualResults.profile_content.severity) > this.getSeverityValue(maxSeverity)) {
          maxSeverity = individualResults.profile_content.severity;
        }
      }

      // Calculate overall score
      const contentTypes = Object.keys(individualResults).length;
      const overallScore = contentTypes > 0 ? Math.round(totalScore / contentTypes) : 0;

      // Determine overall suggested action
      if (this.config.enableAutoBlock && overallScore >= this.config.thresholds.block && maxConfidence >= this.config.minConfidence) {
        suggestedAction = 'block';
      } else if (this.config.enableAutoFlag && overallScore >= this.config.thresholds.flag && maxConfidence >= this.config.minConfidence) {
        suggestedAction = 'flag';
      } else if (overallScore >= this.config.thresholds.low) {
        suggestedAction = 'review';
      }

      const overallResult: ContentAnalysisResult = {
        isAppropriate: !hasViolations || overallScore < this.config.thresholds.low,
        severity: maxSeverity,
        score: overallScore,
        violations: [], // Individual violations are in individual results
        suggestedAction,
        confidence: maxConfidence,
      };

      logger.info('Shop content analysis completed', {
        overallScore,
        maxSeverity,
        suggestedAction,
        contentTypes: Object.keys(individualResults),
      });

      return {
        overallResult,
        individualResults,
      };
    } catch (error) {
      logger.error('Error analyzing shop content', { error });
      throw new CustomError('Shop content analysis failed', 500);
    }
  }

  /**
   * Get numeric value for severity comparison
   */
  private getSeverityValue(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 1;
    }
  }
}

export const contentModerationService = new ContentModerationService();
