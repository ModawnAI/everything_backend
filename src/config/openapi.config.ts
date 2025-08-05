/**
 * OpenAPI Configuration
 * 
 * Comprehensive OpenAPI documentation configuration for the beauty service platform
 * including schemas, security definitions, and automatic documentation generation
 */

import { config } from './environment';
import {
  OpenAPIDocument,
  OpenAPIInfo,
  OpenAPIServer,
  OpenAPITag,
  OpenAPIComponents,
  OpenAPISecurityRequirement,
  OpenAPIGenerationConfig,
  OpenAPIUIConfig,
  OpenAPICommonParameters,
  OpenAPISchema,
  OpenAPIResponse,
  OpenAPIParameter
} from '../types/openapi.types';

/**
 * API Information
 */
export const API_INFO: OpenAPIInfo = {
  title: '에뷰리띵 Beauty Service Platform API',
  description: `
# 에뷰리띵 Beauty Service Platform API

뷰티 서비스 예약 플랫폼을 위한 종합적인 REST API입니다. 고객과 뷰티 전문가를 연결하는 플랫폼입니다.

## 주요 기능

- **사용자 관리**: 회원가입, 인증, 프로필 관리
- **샵 관리**: 뷰티샵 목록, 서비스, 예약 관리
- **예약 시스템**: 실시간 가용성을 통한 예약 관리
- **결제 처리**: 토스페이먼츠 연동을 통한 안전한 결제
- **위치 서비스**: PostGIS 기반 위치 검색 및 매핑
- **알림**: FCM을 통한 푸시 알림
- **리뷰 및 평점**: 고객 피드백 및 평점 시스템
- **관리자 패널**: 완전한 관리자 제어 기능
- **실시간 모니터링**: 시스템 상태 및 성능 모니터링
- **캐싱 시스템**: Redis 기반 고성능 캐싱
- **그레이스풀 셧다운**: 안전한 서버 종료 처리

## 인증

이 API는 인증을 위해 JWT(JSON Web Tokens)를 사용합니다. Authorization 헤더에 토큰을 포함하세요:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## 속도 제한

API 엔드포인트는 사용자 역할에 따라 속도 제한이 적용됩니다:
- 게스트 사용자: 15분당 50회 요청
- 인증된 사용자: 15분당 200회 요청
- 샵 소유자: 15분당 500회 요청
- 관리자: 15분당 1000회 요청

## 오류 처리

모든 API 응답은 일관된 오류 형식을 따르며 적절한 HTTP 상태 코드를 사용합니다.

## 데이터 형식

- 모든 타임스탬프는 ISO 8601 형식
- 좌표는 WGS84 십진도 사용
- 통화 금액은 한국 원화(KRW)
- 위치 데이터는 PostGIS Geography 타입 사용

## 데이터베이스 스키마

이 API는 Supabase PostgreSQL 데이터베이스를 사용하며 다음 주요 테이블을 포함합니다:

- **users**: 사용자 정보 및 인증
- **shops**: 뷰티샵 정보 및 위치
- **reservations**: 예약 정보
- **payments**: 결제 정보
- **point_transactions**: 포인트 거래 내역
- **notifications**: 알림 정보
- **user_favorites**: 즐겨찾기 정보

## 실시간 기능

- WebSocket을 통한 실시간 예약 업데이트
- FCM을 통한 푸시 알림
- 실시간 시스템 모니터링
- 실시간 알림 및 메시징

## 보안

- JWT 기반 인증
- 역할 기반 접근 제어(RBAC)
- 요청 검증 및 위조 방지
- 결제 보안 및 사기 탐지
- 데이터 암호화 및 안전한 전송
  `,
  version: '1.0.0',
  termsOfService: 'https://ebeautything.com/terms',
  contact: {
    name: '에뷰리띵 API 지원팀',
    email: 'api-support@ebeautything.com',
    url: 'https://ebeautything.com/support'
  },
  license: {
    name: 'Proprietary',
    url: 'https://ebeautything.com/license'
  }
};

/**
 * API Servers
 */
export const API_SERVERS: OpenAPIServer[] = [
  {
    url: 'https://api.ebeautything.com',
    description: '프로덕션 서버'
  },
  {
    url: 'https://staging-api.ebeautything.com',
    description: '스테이징 서버'
  },
  {
    url: 'http://localhost:3000',
    description: '개발 서버'
  }
];

/**
 * API Tags
 */
export const API_TAGS: OpenAPITag[] = [
  {
    name: '인증',
    description: '사용자 인증 및 권한 관리 API'
  },
  {
    name: '사용자',
    description: '사용자 프로필 및 계정 관리 API'
  },
  {
    name: '샵',
    description: '뷰티샵 정보 및 서비스 관리 API'
  },
  {
    name: '예약',
    description: '예약 생성, 수정, 취소 API'
  },
  {
    name: '결제',
    description: '토스페이먼츠 연동 결제 API'
  },
  {
    name: '포인트',
    description: '포인트 적립, 사용, 조회 API'
  },
  {
    name: '알림',
    description: '푸시 알림 및 실시간 알림 API'
  },
  {
    name: '관리자',
    description: '관리자 전용 API'
  },
  {
    name: '웹소켓',
    description: '실시간 통신을 위한 WebSocket API'
  },
  {
    name: '스토리지',
    description: '파일 업로드 및 관리 API'
  },
  {
    name: '모니터링',
    description: '시스템 모니터링 및 성능 지표 API'
  },
  {
    name: '캐시',
    description: 'Redis 캐시 관리 API'
  },
  {
    name: '셧다운',
    description: '그레이스풀 셧다운 관리 API'
  },
  {
    name: '건강 체크',
    description: '시스템 상태 확인 API'
  }
];

/**
 * Security Schemes
 */
export const SECURITY_SCHEMES = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT 토큰을 사용한 인증. Authorization 헤더에 "Bearer <token>" 형식으로 포함하세요.'
  },
  apiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: '관리자 API용 API 키'
  }
};

/**
 * Common Responses
 */
export const COMMON_RESPONSES = {
  '200': {
    description: '요청이 성공적으로 처리되었습니다.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  '201': {
    description: '리소스가 성공적으로 생성되었습니다.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  '400': {
    description: '잘못된 요청입니다. 요청 데이터를 확인해주세요.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  },
  '401': {
    description: '인증이 필요합니다. 유효한 JWT 토큰을 제공해주세요.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'AUTH_1001' },
                message: { type: 'string', example: '인증이 필요합니다' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  },
  '403': {
    description: '접근이 거부되었습니다. 필요한 권한이 없습니다.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'AUTH_2001' },
                message: { type: 'string', example: '접근 권한이 없습니다' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  },
  '404': {
    description: '요청한 리소스를 찾을 수 없습니다.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string', example: '리소스를 찾을 수 없습니다' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  },
  '429': {
    description: '요청이 너무 많습니다. 속도 제한을 초과했습니다.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                message: { type: 'string', example: '요청이 너무 많습니다' },
                retryAfter: { type: 'number', description: '재시도 가능 시간(초)' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  },
  '500': {
    description: '서버 내부 오류가 발생했습니다.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
                message: { type: 'string', example: '서버 내부 오류가 발생했습니다' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }
};

/**
 * Common Parameters
 */
export const COMMON_PARAMETERS = {
  page: {
    name: 'page',
    in: 'query',
    description: '페이지 번호 (기본값: 1)',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 }
  },
  limit: {
    name: 'limit',
    in: 'query',
    description: '페이지당 항목 수 (기본값: 10, 최대: 100)',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
  },
  sortBy: {
    name: 'sortBy',
    in: 'query',
    description: '정렬 기준 필드',
    required: false,
    schema: { type: 'string' }
  },
  sortOrder: {
    name: 'sortOrder',
    in: 'query',
    description: '정렬 순서 (asc 또는 desc)',
    required: false,
    schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
  },
  search: {
    name: 'search',
    in: 'query',
    description: '검색어',
    required: false,
    schema: { type: 'string' }
  },
  status: {
    name: 'status',
    in: 'query',
    description: '상태 필터',
    required: false,
    schema: { type: 'string' }
  }
};

/**
 * Database Schemas (Supabase Schema 기반)
 */
export const DATABASE_SCHEMAS = {
  // 사용자 관련 스키마
  User: {
    type: 'object',
    description: '사용자 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '사용자 고유 ID' },
      email: { type: 'string', format: 'email', description: '이메일 주소' },
      phone_number: { type: 'string', description: '전화번호 (PASS 본인인증)' },
      phone_verified: { type: 'boolean', description: '전화번호 인증 완료 여부' },
      name: { type: 'string', description: '실명' },
      nickname: { type: 'string', description: '닉네임' },
      gender: { 
        type: 'string', 
        enum: ['male', 'female', 'other', 'prefer_not_to_say'],
        description: '성별'
      },
      birth_date: { type: 'string', format: 'date', description: '생년월일' },
      profile_image_url: { type: 'string', description: '프로필 이미지 URL' },
      user_role: { 
        type: 'string', 
        enum: ['user', 'shop_owner', 'admin', 'influencer'],
        description: '사용자 역할'
      },
      user_status: { 
        type: 'string', 
        enum: ['active', 'inactive', 'suspended', 'deleted'],
        description: '계정 상태'
      },
      is_influencer: { type: 'boolean', description: '인플루언서 자격 여부' },
      influencer_qualified_at: { type: 'string', format: 'date-time', description: '인플루언서 자격 획득 일시' },
      social_provider: { 
        type: 'string', 
        enum: ['kakao', 'apple', 'google', 'email'],
        description: '소셜 로그인 제공자'
      },
      social_provider_id: { type: 'string', description: '소셜 로그인 고유 ID' },
      referral_code: { type: 'string', description: '개인 추천 코드' },
      referred_by_code: { type: 'string', description: '가입 시 입력한 추천인 코드' },
      total_points: { type: 'integer', description: '총 적립 포인트' },
      available_points: { type: 'integer', description: '사용 가능한 포인트' },
      total_referrals: { type: 'integer', description: '총 추천한 친구 수' },
      successful_referrals: { type: 'integer', description: '결제까지 완료한 추천 친구 수' },
      last_login_at: { type: 'string', format: 'date-time', description: '마지막 로그인 시간' },
      terms_accepted_at: { type: 'string', format: 'date-time', description: '이용약관 동의 일시' },
      privacy_accepted_at: { type: 'string', format: 'date-time', description: '개인정보처리방침 동의 일시' },
      marketing_consent: { type: 'boolean', description: '마케팅 정보 수신 동의' },
      created_at: { type: 'string', format: 'date-time', description: '생성 시간' },
      updated_at: { type: 'string', format: 'date-time', description: '수정 시간' }
    },
    required: ['id', 'name', 'user_role', 'user_status']
  },

  // 샵 관련 스키마
  Shop: {
    type: 'object',
    description: '뷰티샵 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '샵 고유 ID' },
      owner_id: { type: 'string', format: 'uuid', description: '샵 소유자 ID' },
      name: { type: 'string', description: '샵명' },
      description: { type: 'string', description: '샵 소개' },
      phone_number: { type: 'string', description: '샵 전화번호' },
      email: { type: 'string', format: 'email', description: '샵 이메일' },
      address: { type: 'string', description: '주소' },
      detailed_address: { type: 'string', description: '상세주소' },
      postal_code: { type: 'string', description: '우편번호' },
      latitude: { type: 'number', description: '위도' },
      longitude: { type: 'number', description: '경도' },
      shop_type: { 
        type: 'string', 
        enum: ['partnered', 'non_partnered'],
        description: '입점/비입점 구분'
      },
      shop_status: { 
        type: 'string', 
        enum: ['active', 'inactive', 'pending_approval', 'suspended', 'deleted'],
        description: '샵 운영 상태'
      },
      verification_status: { 
        type: 'string', 
        enum: ['pending', 'verified', 'rejected'],
        description: '인증 상태'
      },
      business_license_number: { type: 'string', description: '사업자등록번호' },
      business_license_image_url: { type: 'string', description: '사업자등록증 이미지 URL' },
      main_category: { 
        type: 'string', 
        enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'],
        description: '주 서비스 카테고리'
      },
      sub_categories: { 
        type: 'array', 
        items: { 
          type: 'string', 
          enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair']
        },
        description: '부가 서비스 카테고리들'
      },
      operating_hours: { type: 'object', description: '영업시간 (JSONB)' },
      payment_methods: { 
        type: 'array', 
        items: { 
          type: 'string', 
          enum: ['toss_payments', 'kakao_pay', 'naver_pay', 'card', 'bank_transfer']
        },
        description: '지원하는 결제 수단들'
      },
      kakao_channel_url: { type: 'string', description: '카카오톡 채널 연결 URL' },
      total_bookings: { type: 'integer', description: '총 예약 수' },
      partnership_started_at: { type: 'string', format: 'date-time', description: '입점 시작일' },
      featured_until: { type: 'string', format: 'date-time', description: '추천샵 노출 종료일' },
      is_featured: { type: 'boolean', description: '추천샵 여부' },
      commission_rate: { type: 'number', description: '수수료율 (%)' },
      created_at: { type: 'string', format: 'date-time', description: '생성 시간' },
      updated_at: { type: 'string', format: 'date-time', description: '수정 시간' }
    },
    required: ['id', 'name', 'address', 'main_category']
  },

  // 예약 관련 스키마
  Reservation: {
    type: 'object',
    description: '예약 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '예약 고유 ID' },
      user_id: { type: 'string', format: 'uuid', description: '사용자 ID' },
      shop_id: { type: 'string', format: 'uuid', description: '샵 ID' },
      reservation_date: { type: 'string', format: 'date', description: '예약 날짜' },
      reservation_time: { type: 'string', format: 'time', description: '예약 시간' },
      reservation_datetime: { type: 'string', format: 'date-time', description: '예약 날짜+시간' },
      status: { 
        type: 'string', 
        enum: ['requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show'],
        description: '예약 상태'
      },
      total_amount: { type: 'integer', description: '총 서비스 금액' },
      deposit_amount: { type: 'integer', description: '결제한 예약금' },
      remaining_amount: { type: 'integer', description: '현장에서 결제할 잔금' },
      points_used: { type: 'integer', description: '사용한 포인트' },
      points_earned: { type: 'integer', description: '적립될 포인트' },
      special_requests: { type: 'string', description: '특별 요청사항' },
      cancellation_reason: { type: 'string', description: '취소 사유' },
      no_show_reason: { type: 'string', description: '노쇼 사유' },
      confirmed_at: { type: 'string', format: 'date-time', description: '예약 확정 시간' },
      completed_at: { type: 'string', format: 'date-time', description: '서비스 완료 시간' },
      cancelled_at: { type: 'string', format: 'date-time', description: '취소된 시간' },
      created_at: { type: 'string', format: 'date-time', description: '생성 시간' },
      updated_at: { type: 'string', format: 'date-time', description: '수정 시간' }
    },
    required: ['id', 'user_id', 'shop_id', 'reservation_date', 'reservation_time', 'total_amount', 'deposit_amount']
  },

  // 결제 관련 스키마
  Payment: {
    type: 'object',
    description: '결제 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '결제 고유 ID' },
      reservation_id: { type: 'string', format: 'uuid', description: '예약 ID' },
      user_id: { type: 'string', format: 'uuid', description: '사용자 ID' },
      payment_method: { 
        type: 'string', 
        enum: ['toss_payments', 'kakao_pay', 'naver_pay', 'card', 'bank_transfer'],
        description: '결제 수단'
      },
      payment_status: { 
        type: 'string', 
        enum: ['pending', 'deposit_paid', 'fully_paid', 'refunded', 'partially_refunded', 'failed'],
        description: '결제 상태'
      },
      amount: { type: 'integer', description: '결제 금액 (원)' },
      currency: { type: 'string', description: '통화', default: 'KRW' },
      payment_provider: { type: 'string', description: '결제 제공사' },
      provider_transaction_id: { type: 'string', description: '결제사 거래 ID' },
      provider_order_id: { type: 'string', description: '결제사 주문 ID' },
      is_deposit: { type: 'boolean', description: '예약금 여부' },
      paid_at: { type: 'string', format: 'date-time', description: '결제 완료 시간' },
      refunded_at: { type: 'string', format: 'date-time', description: '환불 처리 시간' },
      refund_amount: { type: 'integer', description: '환불 금액' },
      failure_reason: { type: 'string', description: '결제 실패 사유' },
      metadata: { type: 'object', description: '결제사별 추가 데이터' },
      created_at: { type: 'string', format: 'date-time', description: '생성 시간' },
      updated_at: { type: 'string', format: 'date-time', description: '수정 시간' }
    },
    required: ['id', 'reservation_id', 'user_id', 'payment_method', 'amount']
  },

  // 포인트 거래 스키마
  PointTransaction: {
    type: 'object',
    description: '포인트 거래 내역',
    properties: {
      id: { type: 'string', format: 'uuid', description: '거래 고유 ID' },
      user_id: { type: 'string', format: 'uuid', description: '사용자 ID' },
      reservation_id: { type: 'string', format: 'uuid', description: '예약 ID (서비스 연관 적립)' },
      transaction_type: { 
        type: 'string', 
        enum: ['earned_service', 'earned_referral', 'used_service', 'expired', 'adjusted', 'influencer_bonus'],
        description: '거래 유형'
      },
      amount: { type: 'integer', description: '포인트 금액 (적립=양수, 사용=음수)' },
      description: { type: 'string', description: '거래 설명' },
      status: { 
        type: 'string', 
        enum: ['pending', 'available', 'used', 'expired'],
        description: '포인트 상태'
      },
      available_from: { type: 'string', format: 'date-time', description: '사용 가능 시작일 (적립 후 7일)' },
      expires_at: { type: 'string', format: 'date-time', description: '포인트 만료일' },
      related_user_id: { type: 'string', format: 'uuid', description: '추천 관련 포인트의 경우 추천한 사용자' },
      metadata: { type: 'object', description: '추가 거래 정보' },
      created_at: { type: 'string', format: 'date-time', description: '생성 시간' }
    },
    required: ['id', 'user_id', 'transaction_type', 'amount']
  },

  // 알림 스키마
  Notification: {
    type: 'object',
    description: '알림 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '알림 고유 ID' },
      user_id: { type: 'string', format: 'uuid', description: '사용자 ID' },
      notification_type: { 
        type: 'string', 
        enum: ['reservation_confirmed', 'reservation_cancelled', 'point_earned', 'referral_success', 'system'],
        description: '알림 유형'
      },
      title: { type: 'string', description: '알림 제목' },
      message: { type: 'string', description: '알림 내용' },
      status: { 
        type: 'string', 
        enum: ['unread', 'read', 'deleted'],
        description: '읽음 상태'
      },
      related_id: { type: 'string', format: 'uuid', description: '관련 엔티티 ID' },
      action_url: { type: 'string', description: '딥링크 URL' },
      scheduled_for: { type: 'string', format: 'date-time', description: '예약 알림 발송 시간' },
      sent_at: { type: 'string', format: 'date-time', description: '실제 발송 시간' },
      read_at: { type: 'string', format: 'date-time', description: '읽은 시간' },
      created_at: { type: 'string', format: 'date-time', description: '생성 시간' }
    },
    required: ['id', 'user_id', 'notification_type', 'title', 'message']
  },

  // 모니터링 스키마
  MetricValue: {
    type: 'object',
    description: '메트릭 값',
    properties: {
      value: { type: 'number', description: '메트릭 값' },
      timestamp: { type: 'number', description: '타임스탬프 (밀리초)' },
      labels: { type: 'object', description: '선택적 라벨' }
    },
    required: ['value', 'timestamp']
  },

  Metric: {
    type: 'object',
    description: '메트릭 정보',
    properties: {
      name: { type: 'string', description: '메트릭 이름' },
      type: { 
        type: 'string', 
        enum: ['counter', 'gauge', 'histogram', 'summary'],
        description: '메트릭 타입'
      },
      description: { type: 'string', description: '메트릭 설명' },
      values: { 
        type: 'array', 
        items: { $ref: '#/components/schemas/MetricValue' },
        description: '메트릭 값들'
      }
    },
    required: ['name', 'type', 'description']
  },

  AlertRule: {
    type: 'object',
    description: '알림 규칙',
    properties: {
      id: { type: 'string', description: '알림 규칙 ID' },
      name: { type: 'string', description: '알림 규칙 이름' },
      description: { type: 'string', description: '알림 규칙 설명' },
      condition: { type: 'string', description: '알림 조건 표현식' },
      threshold: { type: 'number', description: '알림 임계값' },
      severity: { 
        type: 'string', 
        enum: ['low', 'medium', 'high', 'critical'],
        description: '알림 심각도'
      },
      enabled: { type: 'boolean', description: '규칙 활성화 여부' },
      cooldown: { type: 'number', description: '쿨다운 기간 (초)' }
    },
    required: ['id', 'name', 'condition', 'threshold', 'severity']
  },

  Alert: {
    type: 'object',
    description: '알림 정보',
    properties: {
      id: { type: 'string', description: '알림 ID' },
      rule_id: { type: 'string', description: '관련 알림 규칙 ID' },
      severity: { 
        type: 'string', 
        enum: ['low', 'medium', 'high', 'critical'],
        description: '알림 심각도'
      },
      message: { type: 'string', description: '알림 메시지' },
      timestamp: { type: 'number', description: '알림 타임스탬프' },
      resolved: { type: 'boolean', description: '해결 여부' },
      resolved_at: { type: 'number', description: '해결 타임스탬프' },
      metadata: { type: 'object', description: '추가 알림 메타데이터' }
    },
    required: ['id', 'rule_id', 'severity', 'message', 'timestamp']
  },

  // 캐시 스키마
  CacheStats: {
    type: 'object',
    description: '캐시 통계',
    properties: {
      hits: { type: 'integer', description: '캐시 히트 수' },
      misses: { type: 'integer', description: '캐시 미스 수' },
      keys: { type: 'integer', description: '캐시된 키 수' },
      memory: { type: 'integer', description: '사용된 메모리 (바이트)' },
      hitRate: { type: 'number', description: '히트율 (%)' }
    }
  },

  // 셧다운 스키마
  ShutdownStatus: {
    type: 'object',
    description: '셧다운 상태',
    properties: {
      isShuttingDown: { type: 'boolean', description: '셧다운 진행 중 여부' },
      startTime: { type: 'number', description: '셧다운 시작 시간' },
      completedSteps: { 
        type: 'array', 
        items: { type: 'string' },
        description: '완료된 셧다운 단계들'
      },
      remainingSteps: { 
        type: 'array', 
        items: { type: 'string' },
        description: '남은 셧다운 단계들'
      },
      error: { type: 'string', description: '오류 메시지' }
    },
    required: ['isShuttingDown', 'completedSteps', 'remainingSteps']
  }
};

/**
 * Create OpenAPI Document
 */
export const createOpenAPIDocument = (): any => ({
  openapi: '3.0.0',
  info: API_INFO,
  servers: API_SERVERS,
  tags: API_TAGS,
  components: {
    securitySchemes: SECURITY_SCHEMES as any,
    responses: COMMON_RESPONSES as any,
    parameters: COMMON_PARAMETERS as any,
    schemas: DATABASE_SCHEMAS as any
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {} // Empty paths object for compatibility
});

/**
 * OpenAPI Generation Configuration
 */
export const OPENAPI_GENERATION_CONFIG: any = {
  definition: {
    openapi: '3.0.0',
    info: API_INFO,
    servers: API_SERVERS,
    tags: API_TAGS,
    components: {
      securitySchemes: SECURITY_SCHEMES,
      responses: COMMON_RESPONSES,
      parameters: COMMON_PARAMETERS,
      schemas: DATABASE_SCHEMAS
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/app.ts']
};

/**
 * OpenAPI UI Configuration
 */
export const OPENAPI_UI_CONFIG: any = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '에뷰리띵 API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}; 