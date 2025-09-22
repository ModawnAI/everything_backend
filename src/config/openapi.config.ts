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

A comprehensive REST API for the beauty service booking platform connecting customers with beauty professionals.

## Core Features

- **User Management**: Registration, authentication, and profile management
- **Shop Discovery**: Location-based search and shop information
- **Booking System**: Real-time availability and reservation management  
- **Payment Processing**: Secure payments via TossPayments integration
- **Notifications**: Push notifications and real-time updates
- **Admin Panel**: Complete administrative control and analytics

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
  // Core User-Facing APIs
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
  
  // Admin APIs
  {
    name: '관리자',
    description: '관리자 전용 API'
  },
  
  // System APIs
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
  
  // Additional categories that appear in routes
  {
    name: 'CDN',
    description: 'CDN 이미지 URL 생성 및 최적화 API'
  },
  {
    name: 'Favorites',
    description: '사용자 즐겨찾기 관리 API'
  },
  {
    name: 'Shop Image Metadata',
    description: '샵 이미지 메타데이터 관리 API'
  },
  {
    name: 'Shop Contact Methods',
    description: '샵 연락처 방법 관리 API'
  },
  {
    name: '셧다운',
    description: '그레이스풀 셧다운 관리 API'
  },
  {
    name: '건강 체크',
    description: '시스템 상태 확인 API'
  },
  {
    name: 'Shop Categories',
    description: '샵 카테고리 및 서비스 카탈로그 관리 API'
  },
  {
    name: 'Service Catalog',
    description: '서비스 카탈로그 및 메타데이터 관리 API'
  },
  {
    name: 'Reservations',
    description: 'Reservation management and booking endpoints'
  },
  {
    name: 'Shop Operating Hours',
    description: 'Shop operating hours management operations for shop owners'
  },
  {
    name: 'Shop Profile',
    description: 'Shop profile management operations for shop owners'
  },
  {
    name: 'Shop Search',
    description: 'Advanced shop search and filtering operations'
  },
  {
    name: 'Shop Services',
    description: 'Shop service catalog management operations for shop owners'
  },
  {
    name: 'Shops',
    description: 'Shop management and discovery endpoints'
  },
  {
    name: 'Admin Analytics',
    description: 'Admin analytics and reporting APIs'
  },
  {
    name: 'Admin Moderation',
    description: 'Admin moderation and content management APIs'
  },
  {
    name: 'Admin Payments',
    description: 'Admin payment management and oversight APIs'
  },
  {
    name: 'Authentication',
    description: 'Authentication and authorization endpoints'
  },
  {
    name: 'Image Metadata',
    description: 'Image metadata management APIs'
  },
  {
    name: 'Notifications',
    description: 'Push notification and messaging APIs'
  },
  {
    name: 'Shop Dashboard',
    description: 'Shop owner dashboard and management APIs'
  },
  {
    name: 'Shop Registration',
    description: 'Shop registration and onboarding APIs'
  },
  {
    name: 'Shop Reporting',
    description: 'Shop reporting and moderation APIs'
  },
  {
    name: 'WebSocket',
    description: 'Real-time WebSocket communication APIs'
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
  },

  // Request/Response 스키마들
  LoginRequest: {
    type: 'object',
    description: '로그인 요청',
    properties: {
      email: { 
        type: 'string', 
        format: 'email', 
        description: '이메일 주소',
        example: 'user@example.com'
      },
      password: { 
        type: 'string', 
        minLength: 8,
        description: '비밀번호 (최소 8자)',
        example: 'password123'
      }
    },
    required: ['email', 'password']
  },

  LoginResponse: {
    type: 'object',
    description: '로그인 응답',
    properties: {
      success: { type: 'boolean', example: true },
      user: { $ref: '#/components/schemas/User' },
      token: { 
        type: 'string', 
        description: 'JWT 액세스 토큰',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      refreshToken: { 
        type: 'string', 
        description: 'JWT 리프레시 토큰',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    },
    required: ['success', 'user', 'token']
  },

  PaymentPrepareRequest: {
    type: 'object',
    description: '결제 준비 요청',
    properties: {
      reservationId: {
        type: 'string',
        format: 'uuid',
        description: '예약 ID',
        example: '123e4567-e89b-12d3-a456-426614174000'
      },
      amount: {
        type: 'number',
        minimum: 100,
        description: '결제 금액 (원)',
        example: 50000
      },
      isDeposit: {
        type: 'boolean',
        default: true,
        description: '예약금 여부',
        example: true
      },
      successUrl: {
        type: 'string',
        format: 'uri',
        description: '결제 성공 시 리다이렉트 URL',
        example: 'https://app.reviewthing.com/payment/success'
      },
      failUrl: {
        type: 'string',
        format: 'uri',
        description: '결제 실패 시 리다이렉트 URL',
        example: 'https://app.reviewthing.com/payment/fail'
      }
    },
    required: ['reservationId', 'amount']
  },

  PaymentPrepareResponse: {
    type: 'object',
    description: '결제 준비 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          paymentId: {
            type: 'string',
            format: 'uuid',
            description: '내부 결제 ID',
            example: 'pay_123e4567-e89b-12d3-a456-426614174000'
          },
          orderId: {
            type: 'string',
            description: 'TossPayments 주문 ID',
            example: 'order_20240115_123456'
          },
          amount: {
            type: 'number',
            description: '결제 금액',
            example: 50000
          },
          customerName: {
            type: 'string',
            description: '고객명',
            example: '홍길동'
          }
        }
      }
    },
    required: ['success', 'data']
  },

  ReservationCreateRequest: {
    type: 'object',
    description: '예약 생성 요청',
    properties: {
      shopId: {
        type: 'string',
        format: 'uuid',
        description: '샵 ID',
        example: '123e4567-e89b-12d3-a456-426614174000'
      },
      serviceIds: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        },
        description: '서비스 ID 목록',
        example: ['service-1', 'service-2']
      },
      reservationDate: {
        type: 'string',
        format: 'date',
        description: '예약 날짜',
        example: '2024-03-15'
      },
      reservationTime: {
        type: 'string',
        pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
        description: '예약 시간 (HH:MM)',
        example: '14:30'
      },
      specialRequests: {
        type: 'string',
        description: '특별 요청사항',
        example: '알레르기가 있어서 천연 제품 사용 부탁드립니다.'
      },
      pointsToUse: {
        type: 'number',
        minimum: 0,
        description: '사용할 포인트',
        example: 5000
      }
    },
    required: ['shopId', 'serviceIds', 'reservationDate', 'reservationTime']
  },

  ShopSearchResult: {
    type: 'object',
    description: '검색된 샵 정보',
    properties: {
      id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
      name: { type: 'string', example: '네일아트 전문점' },
      description: { type: 'string', example: '프리미엄 네일아트 서비스를 제공합니다' },
      address: { type: 'string', example: '서울시 강남구 테헤란로 123' },
      detailedAddress: { type: 'string', example: '2층 201호' },
      latitude: { type: 'number', example: 37.5665 },
      longitude: { type: 'number', example: 126.9780 },
      distance: { type: 'number', description: '거리 (km)', example: 1.2 },
      shopType: { 
        type: 'string', 
        enum: ['partnered', 'non_partnered'],
        example: 'partnered' 
      },
      shopStatus: { 
        type: 'string', 
        enum: ['active', 'inactive', 'pending_approval', 'suspended'],
        example: 'active' 
      },
      mainCategory: { 
        type: 'string', 
        enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'],
        example: 'nail' 
      },
      subCategories: {
        type: 'array',
        items: { 
          type: 'string', 
          enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'] 
        },
        example: ['nail', 'eyelash']
      },
      isFeatured: { type: 'boolean', example: true },
      featuredUntil: { type: 'string', format: 'date-time', nullable: true },
      partnershipStartedAt: { type: 'string', format: 'date-time', nullable: true },
      phoneNumber: { type: 'string', example: '02-1234-5678' },
      operatingHours: {
        type: 'object',
        description: '영업시간 정보',
        additionalProperties: {
          type: 'object',
          properties: {
            open: { type: 'string', example: '09:00' },
            close: { type: 'string', example: '21:00' },
            isOpen: { type: 'boolean', example: true }
          }
        }
      },
      paymentMethods: {
        type: 'array',
        items: { 
          type: 'string',
          enum: ['cash', 'card', 'transfer', 'mobile_pay', 'point']
        },
        example: ['card', 'mobile_pay']
      },
      totalBookings: { type: 'integer', example: 1250 },
      commissionRate: { type: 'number', example: 10.5 },
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            imageUrl: { type: 'string', format: 'uri' },
            altText: { type: 'string' },
            isPrimary: { type: 'boolean' },
            displayOrder: { type: 'integer' }
          }
        }
      },
      services: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            category: { type: 'string' },
            priceMin: { type: 'number' },
            priceMax: { type: 'number' },
            duration: { type: 'integer' },
            isAvailable: { type: 'boolean' }
          }
        }
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'name', 'address', 'latitude', 'longitude', 'shopType', 'shopStatus', 'mainCategory']
  },

  ShopSearchMetadata: {
    type: 'object',
    description: '검색 메타데이터',
    properties: {
      query: { type: 'string', example: '네일아트' },
      filters: {
        type: 'object',
        description: '적용된 필터',
        properties: {
          category: { type: 'string' },
          shopType: { type: 'string' },
          status: { type: 'string' },
          onlyFeatured: { type: 'boolean' },
          onlyOpen: { type: 'boolean' },
          priceRange: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' }
            }
          },
          rating: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' }
            }
          },
          location: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              radiusKm: { type: 'number' }
            }
          },
          bounds: {
            type: 'object',
            properties: {
              northEast: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              },
              southWest: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              }
            }
          },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string' },
          limit: { type: 'integer' },
          offset: { type: 'integer' }
        }
      },
      executionTime: { type: 'number', description: '실행 시간 (ms)', example: 45.2 },
      searchType: { 
        type: 'string', 
        enum: ['text', 'location', 'bounds', 'filter', 'hybrid'],
        example: 'hybrid' 
      },
      sortedBy: { type: 'string', example: 'relevance desc' },
      cacheMetrics: {
        type: 'object',
        description: '캐시 성능 메트릭',
        properties: {
          hit: { type: 'boolean', example: true },
          key: { type: 'string', example: 'shop_search:a1b2c3d4...' },
          ttl: { type: 'integer', description: 'TTL (초)', example: 600 }
        },
        required: ['hit']
      }
    },
    required: ['executionTime', 'searchType', 'sortedBy', 'cacheMetrics']
  },

  ShopSearchResponse: {
    type: 'object',
    description: '샵 검색 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          shops: {
            type: 'array',
            items: { $ref: '#/components/schemas/ShopSearchResult' }
          },
          totalCount: {
            type: 'integer',
            description: '총 검색 결과 수',
            example: 45
          },
          hasMore: {
            type: 'boolean',
            description: '더 많은 결과 존재 여부',
            example: true
          },
          currentPage: {
            type: 'integer',
            description: '현재 페이지',
            example: 1
          },
          totalPages: {
            type: 'integer',
            description: '총 페이지 수',
            example: 3
          },
          searchMetadata: { $ref: '#/components/schemas/ShopSearchMetadata' }
        },
        required: ['shops', 'totalCount', 'hasMore', 'currentPage', 'totalPages', 'searchMetadata']
      },
      message: {
        type: 'string',
        example: '네일아트 검색 결과 45개를 찾았습니다.'
      }
    },
    required: ['success', 'data']
  },

  ShopService: {
    type: 'object',
    description: '샵 서비스 정보',
    properties: {
      id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
      name: { type: 'string', example: '젤네일' },
      category: { 
        type: 'string', 
        enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'],
        example: 'nail' 
      },
      price_min: { type: 'number', example: 30000 },
      price_max: { type: 'number', example: 50000 },
      duration: { type: 'integer', description: '소요 시간 (분)', example: 60 },
      description: { type: 'string', example: '고품질 젤네일 서비스' },
      is_available: { type: 'boolean', example: true },
      display_order: { type: 'integer', example: 1 },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'name', 'category', 'price_min', 'price_max', 'duration', 'is_available']
  },

  ShopImage: {
    type: 'object',
    description: '샵 이미지 정보',
    properties: {
      id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
      image_url: { type: 'string', format: 'uri', example: 'https://example.com/images/shop1.jpg' },
      alt_text: { type: 'string', example: '샵 내부 전경' },
      is_primary: { type: 'boolean', example: true },
      display_order: { type: 'integer', example: 1 },
      created_at: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'image_url', 'is_primary', 'display_order']
  },

  TimeSlot: {
    type: 'object',
    description: '시간 슬롯',
    properties: {
      startTime: {
        type: 'string',
        pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
        description: '시작 시간',
        example: '10:00'
      },
      endTime: {
        type: 'string',
        pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
        description: '종료 시간',
        example: '10:30'
      },
      available: {
        type: 'boolean',
        description: '예약 가능 여부',
        example: true
      },
      capacity: {
        type: 'integer',
        minimum: 1,
        description: '수용 인원',
        example: 2
      },
      booked: {
        type: 'integer',
        minimum: 0,
        description: '예약된 인원',
        example: 0
      }
    },
    required: ['startTime', 'endTime', 'available']
  },

  AvailableSlotsResponse: {
    type: 'object',
    description: '예약 가능 시간 조회 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          shopId: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          date: {
            type: 'string',
            format: 'date',
            example: '2024-03-15'
          },
          availableSlots: {
            type: 'array',
            items: { $ref: '#/components/schemas/TimeSlot' }
          },
          totalSlots: {
            type: 'integer',
            description: '총 시간 슬롯 수',
            example: 16
          },
          availableCount: {
            type: 'integer',
            description: '예약 가능한 슬롯 수',
            example: 12
          }
        }
      }
    },
    required: ['success', 'data']
  },

  ErrorResponse: {
    type: 'object',
    description: '에러 응답',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '에러 코드',
            example: 'VALIDATION_ERROR'
          },
          message: {
            type: 'string',
            description: '에러 메시지',
            example: '입력 데이터가 유효하지 않습니다.'
          },
          details: {
            type: 'string',
            description: '상세 에러 정보',
            example: '필수 필드가 누락되었습니다.'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: '에러 발생 시간',
            example: '2024-01-15T10:30:00Z'
          }
        },
        required: ['code', 'message']
      }
    },
    required: ['success', 'error']
  },

  SuccessResponse: {
    type: 'object',
    description: '성공 응답',
    properties: {
      success: { type: 'boolean', example: true },
      message: {
        type: 'string',
        description: '성공 메시지',
        example: '작업이 성공적으로 완료되었습니다.'
      },
      data: {
        type: 'object',
        description: '응답 데이터 (선택적)'
      }
    },
    required: ['success']
  },

  // User Management Schemas
  UserProfile: {
    type: 'object',
    description: '사용자 프로필 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '사용자 고유 ID' },
      email: { type: 'string', format: 'email', description: '이메일 주소' },
      name: { type: 'string', description: '사용자 이름' },
      nickname: { type: 'string', description: '닉네임' },
      phoneNumber: { type: 'string', description: '전화번호' },
      phoneVerified: { type: 'boolean', description: '전화번호 인증 여부' },
      birthDate: { type: 'string', format: 'date', description: '생년월일' },
      gender: { 
        type: 'string', 
        enum: ['male', 'female', 'other', 'prefer_not_to_say'],
        description: '성별'
      },
      profileImageUrl: { type: 'string', description: '프로필 이미지 URL' },
      userRole: { 
        type: 'string', 
        enum: ['user', 'shop_owner', 'admin', 'influencer'],
        description: '사용자 역할'
      },
      userStatus: { 
        type: 'string', 
        enum: ['active', 'inactive', 'suspended', 'deleted'],
        description: '계정 상태'
      },
      isInfluencer: { type: 'boolean', description: '인플루언서 여부' },
      referralCode: { type: 'string', description: '개인 추천 코드' },
      totalPoints: { type: 'integer', description: '총 포인트' },
      availablePoints: { type: 'integer', description: '사용 가능한 포인트' },
      marketingConsent: { type: 'boolean', description: '마케팅 정보 수신 동의' },
      createdAt: { type: 'string', format: 'date-time', description: '가입일' },
      updatedAt: { type: 'string', format: 'date-time', description: '수정일' }
    },
    required: ['id', 'name', 'userRole', 'userStatus']
  },

  UserSettings: {
    type: 'object',
    description: '사용자 설정 정보',
    properties: {
      userId: { type: 'string', format: 'uuid', description: '사용자 ID' },
      pushNotificationsEnabled: { type: 'boolean', description: '푸시 알림 활성화' },
      reservationNotifications: { type: 'boolean', description: '예약 관련 알림' },
      eventNotifications: { type: 'boolean', description: '이벤트 알림' },
      marketingNotifications: { type: 'boolean', description: '마케팅 알림' },
      locationTrackingEnabled: { type: 'boolean', description: '위치 추적 허용' },
      languagePreference: { 
        type: 'string', 
        enum: ['ko', 'en'],
        default: 'ko',
        description: '언어 설정'
      },
      currencyPreference: { 
        type: 'string', 
        enum: ['KRW', 'USD'],
        default: 'KRW',
        description: '통화 설정'
      },
      themePreference: { 
        type: 'string', 
        enum: ['light', 'dark', 'auto'],
        default: 'light',
        description: '테마 설정'
      },
      createdAt: { type: 'string', format: 'date-time', description: '생성일' },
      updatedAt: { type: 'string', format: 'date-time', description: '수정일' }
    },
    required: ['userId']
  },

  UserStatistics: {
    type: 'object',
    description: '사용자 통계 정보',
    properties: {
      totalUsers: { type: 'integer', description: '총 사용자 수' },
      activeUsers: { type: 'integer', description: '활성 사용자 수' },
      newUsersToday: { type: 'integer', description: '오늘 신규 가입자 수' },
      newUsersThisWeek: { type: 'integer', description: '이번 주 신규 가입자 수' },
      newUsersThisMonth: { type: 'integer', description: '이번 달 신규 가입자 수' },
      usersByRole: {
        type: 'object',
        properties: {
          user: { type: 'integer' },
          shop_owner: { type: 'integer' },
          admin: { type: 'integer' },
          influencer: { type: 'integer' }
        }
      },
      usersByStatus: {
        type: 'object',
        properties: {
          active: { type: 'integer' },
          inactive: { type: 'integer' },
          suspended: { type: 'integer' },
          deleted: { type: 'integer' }
        }
      },
      averagePointsPerUser: { type: 'number', description: '사용자당 평균 포인트' },
      totalReferrals: { type: 'integer', description: '총 추천 수' },
      phoneVerificationRate: { type: 'number', description: '전화번호 인증률 (%)' }
    }
  },

  NotificationSettings: {
    type: 'object',
    description: '알림 설정 정보',
    properties: {
      userId: { type: 'string', format: 'uuid', description: '사용자 ID' },
      pushEnabled: { type: 'boolean', description: '푸시 알림 활성화' },
      emailEnabled: { type: 'boolean', description: '이메일 알림 활성화' },
      smsEnabled: { type: 'boolean', description: 'SMS 알림 활성화' },
      reservationUpdates: { type: 'boolean', description: '예약 업데이트 알림' },
      paymentNotifications: { type: 'boolean', description: '결제 관련 알림' },
      promotionalMessages: { type: 'boolean', description: '프로모션 메시지' },
      systemAlerts: { type: 'boolean', description: '시스템 알림' },
      userManagementAlerts: { type: 'boolean', description: '사용자 관리 알림' },
      securityAlerts: { type: 'boolean', description: '보안 알림' },
      profileUpdateConfirmations: { type: 'boolean', description: '프로필 업데이트 확인' },
      adminActionNotifications: { type: 'boolean', description: '관리자 액션 알림' },
      updatedAt: { type: 'string', format: 'date-time', description: '수정일' }
    },
    required: ['userId']
  },

  // CDN 관련 스키마
  CDNResult: {
    type: 'object',
    description: 'CDN URL 결과',
    properties: {
      url: { type: 'string', format: 'uri', description: '원본 URL' },
      cdnUrl: { type: 'string', format: 'uri', description: 'CDN URL' },
      transformations: { type: 'object', description: '이미지 변환 옵션' },
      cacheHeaders: { type: 'object', description: '캐시 헤더' },
      expiresAt: { type: 'string', format: 'date-time', description: '만료 시간' }
    },
    required: ['url', 'cdnUrl', 'cacheHeaders']
  },

  CDNConfig: {
    type: 'object',
    description: 'CDN 설정',
    properties: {
      enabled: { type: 'boolean', description: 'CDN 활성화 여부' },
      baseUrl: { type: 'string', format: 'uri', description: 'CDN 기본 URL' },
      fallbackUrl: { type: 'string', format: 'uri', description: '폴백 URL' },
      cacheHeaders: {
        type: 'object',
        properties: {
          maxAge: { type: 'integer', description: '최대 캐시 시간 (초)' },
          sMaxAge: { type: 'integer', description: '공유 캐시 최대 시간 (초)' },
          staleWhileRevalidate: { type: 'integer', description: '재검증 중 오래된 캐시 허용 시간 (초)' }
        }
      },
      imageTransformation: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: '이미지 변환 활성화' },
          quality: { type: 'integer', minimum: 1, maximum: 100, description: '이미지 품질' },
          format: { type: 'string', enum: ['auto', 'webp', 'jpeg', 'png'], description: '이미지 포맷' },
          progressive: { type: 'boolean', description: '프로그레시브 JPEG 사용' }
        }
      },
      onDemandResizing: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: '온디맨드 리사이징 활성화' },
          maxWidth: { type: 'integer', description: '최대 너비' },
          maxHeight: { type: 'integer', description: '최대 높이' },
          quality: { type: 'integer', minimum: 1, maximum: 100, description: '리사이징 품질' }
        }
      }
    },
    required: ['enabled', 'baseUrl', 'fallbackUrl']
  },

  ImageTransformationOptions: {
    type: 'object',
    description: '이미지 변환 옵션',
    properties: {
      width: { type: 'integer', minimum: 1, maximum: 4000, description: '너비' },
      height: { type: 'integer', minimum: 1, maximum: 4000, description: '높이' },
      quality: { type: 'integer', minimum: 1, maximum: 100, description: '품질' },
      format: { type: 'string', enum: ['webp', 'jpeg', 'png', 'auto'], description: '포맷' },
      fit: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'], description: '피팅 방식' },
      position: { type: 'string', description: '위치' },
      background: { type: 'string', description: '배경색' },
      blur: { type: 'number', minimum: 0, maximum: 100, description: '블러 강도' },
      sharpen: { type: 'number', minimum: 0, maximum: 100, description: '샤프닝 강도' },
      brightness: { type: 'number', minimum: -100, maximum: 100, description: '밝기' },
      contrast: { type: 'number', minimum: -100, maximum: 100, description: '대비' },
      saturation: { type: 'number', minimum: -100, maximum: 100, description: '채도' },
      hue: { type: 'number', minimum: -180, maximum: 180, description: '색조' },
      gamma: { type: 'number', minimum: 0.1, maximum: 3, description: '감마' },
      progressive: { type: 'boolean', description: '프로그레시브 JPEG' },
      stripMetadata: { type: 'boolean', description: '메타데이터 제거' }
    }
  },

  ResponsiveImageUrls: {
    type: 'object',
    description: '반응형 이미지 URL',
    properties: {
      srcSet: { type: 'string', description: 'srcset 속성 값' },
      sizes: { type: 'string', description: 'sizes 속성 값' },
      urls: { type: 'object', description: '각 브레이크포인트별 URL' }
    },
    required: ['srcSet', 'sizes', 'urls']
  },

  WebPUrls: {
    type: 'object',
    description: 'WebP URL과 폴백 URL',
    properties: {
      webp: { $ref: '#/components/schemas/CDNResult' },
      fallback: { $ref: '#/components/schemas/CDNResult' }
    },
    required: ['webp', 'fallback']
  },

  OptimizedCDNUrls: {
    type: 'object',
    description: '최적화된 CDN URL',
    properties: {
      original: { $ref: '#/components/schemas/CDNResult' },
      thumbnail: { $ref: '#/components/schemas/CDNResult' },
      medium: { $ref: '#/components/schemas/CDNResult' },
      large: { $ref: '#/components/schemas/CDNResult' },
      webp: {
        type: 'object',
        properties: {
          original: { $ref: '#/components/schemas/CDNResult' },
          thumbnail: { $ref: '#/components/schemas/CDNResult' },
          medium: { $ref: '#/components/schemas/CDNResult' },
          large: { $ref: '#/components/schemas/CDNResult' }
        }
      },
      responsive: { $ref: '#/components/schemas/ResponsiveImageUrls' }
    },
    required: ['original', 'thumbnail', 'medium', 'large']
  },

  // 즐겨찾기 관련 스키마
  UserFavorites: {
    type: 'object',
    description: '사용자 즐겨찾기 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '즐겨찾기 고유 ID' },
      user_id: { type: 'string', format: 'uuid', description: '사용자 ID' },
      shop_id: { type: 'string', format: 'uuid', description: '샵 ID' },
      created_at: { type: 'string', format: 'date-time', description: '즐겨찾기 추가 시간' }
    },
    required: ['id', 'user_id', 'shop_id', 'created_at']
  },

  FavoriteShop: {
    type: 'object',
    description: '즐겨찾기한 샵 정보',
    properties: {
      id: { type: 'string', format: 'uuid', description: '즐겨찾기 고유 ID' },
      shopId: { type: 'string', format: 'uuid', description: '샵 ID' },
      shop: {
        $ref: '#/components/schemas/Shop'
      },
      addedAt: { type: 'string', format: 'date-time', description: '즐겨찾기 추가 시간' }
    },
    required: ['id', 'shopId', 'shop', 'addedAt']
  },

  FavoritesStats: {
    type: 'object',
    description: '즐겨찾기 통계 정보',
    properties: {
      totalFavorites: { type: 'integer', description: '총 즐겨찾기 수' },
      favoriteCategories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', description: '카테고리명' },
            count: { type: 'integer', description: '해당 카테고리의 즐겨찾기 수' }
          },
          required: ['category', 'count']
        },
        description: '카테고리별 즐겨찾기 통계'
      },
      recentlyAdded: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            shopId: { type: 'string', format: 'uuid', description: '샵 ID' },
            shopName: { type: 'string', description: '샵 이름' },
            addedAt: { type: 'string', format: 'date-time', description: '즐겨찾기 추가 시간' }
          },
          required: ['shopId', 'shopName', 'addedAt']
        },
        description: '최근 추가된 즐겨찾기 목록'
      }
    },
    required: ['totalFavorites', 'favoriteCategories', 'recentlyAdded']
  },

  BulkFavoritesRequest: {
    type: 'object',
    description: '대량 즐겨찾기 요청',
    properties: {
      shopIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 100,
        description: '샵 ID 배열'
      },
      action: {
        type: 'string',
        enum: ['add', 'remove'],
        description: '수행할 작업 (추가 또는 제거)'
      }
    },
    required: ['shopIds', 'action']
  },

  BulkFavoritesResponse: {
    type: 'object',
    description: '대량 즐겨찾기 응답',
    properties: {
      added: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: '추가된 샵 ID 배열'
      },
      removed: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: '제거된 샵 ID 배열'
      },
      failed: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            shopId: { type: 'string', format: 'uuid', description: '샵 ID' },
            reason: { type: 'string', description: '실패 사유' }
          },
          required: ['shopId', 'reason']
        },
        description: '실패한 작업 목록'
      },
      summary: {
        type: 'object',
        properties: {
          total: { type: 'integer', description: '총 요청 수' },
          successful: { type: 'integer', description: '성공한 작업 수' },
          failed: { type: 'integer', description: '실패한 작업 수' }
        },
        required: ['total', 'successful', 'failed']
      }
    },
    required: ['added', 'removed', 'failed', 'summary']
  },

  // Shop Contact Methods Schemas
  ContactMethod: {
    type: 'object',
    description: '연락처 방법 정보',
    properties: {
      method_type: {
        type: 'string',
        enum: ['phone', 'email', 'kakao_channel', 'instagram', 'facebook', 'website', 'other'],
        description: '연락처 방법 유형'
      },
      value: {
        type: 'string',
        description: '연락처 정보 (전화번호, 이메일, URL 등)'
      },
      description: {
        type: 'string',
        maxLength: 255,
        description: '연락처 방법에 대한 선택적 설명'
      },
      is_primary: {
        type: 'boolean',
        description: '해당 유형의 주요 연락처 방법인지 여부'
      },
      display_order: {
        type: 'integer',
        minimum: 0,
        description: '연락처 방법이 표시되어야 하는 순서'
      },
      is_active: {
        type: 'boolean',
        description: '연락처 방법이 현재 활성화되어 있는지 여부'
      }
    },
    required: ['method_type', 'value']
  },

  ShopContactMethod: {
    type: 'object',
    description: '샵 연락처 방법 정보',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: '연락처 방법 고유 ID'
      },
      shop_id: {
        type: 'string',
        format: 'uuid',
        description: '이 연락처 방법이 속한 샵의 ID'
      },
      method_type: {
        type: 'string',
        enum: ['phone', 'email', 'kakao_channel', 'instagram', 'facebook', 'website', 'other'],
        description: '연락처 방법 유형'
      },
      value: {
        type: 'string',
        description: '연락처 정보'
      },
      description: {
        type: 'string',
        description: '연락처 방법에 대한 선택적 설명'
      },
      is_primary: {
        type: 'boolean',
        description: '해당 유형의 주요 연락처 방법인지 여부'
      },
      display_order: {
        type: 'integer',
        description: '표시 순서'
      },
      is_active: {
        type: 'boolean',
        description: '연락처 방법이 현재 활성화되어 있는지 여부'
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        description: '연락처 방법이 생성된 시점'
      },
      updated_at: {
        type: 'string',
        format: 'date-time',
        description: '연락처 방법이 마지막으로 업데이트된 시점'
      }
    },
    required: ['id', 'shop_id', 'method_type', 'value', 'is_primary', 'display_order', 'is_active', 'created_at', 'updated_at']
  },

  ContactMethodsUpdateRequest: {
    type: 'object',
    description: '샵 연락처 방법 업데이트 요청',
    required: ['contactMethods'],
    properties: {
      contactMethods: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ContactMethod'
        },
        description: '업데이트할 연락처 방법 배열'
      }
    }
  },

  ContactMethodsResponse: {
    type: 'object',
    description: '샵 연락처 방법 응답',
    properties: {
      success: {
        type: 'boolean',
        description: '요청이 성공했는지 여부'
      },
      message: {
        type: 'string',
        description: '성공 또는 오류 메시지'
      },
      data: {
        type: 'object',
        properties: {
          contactMethods: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ShopContactMethod'
            },
            description: '연락처 방법 배열'
          }
        }
      }
    },
    required: ['success', 'message', 'data']
  },

  // Shop Categories 관련 스키마
  CategoryMetadata: {
    type: 'object',
    description: '카테고리 메타데이터',
    properties: {
      id: { 
        type: 'string', 
        enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'],
        description: '카테고리 ID' 
      },
      displayName: { type: 'string', description: '표시 이름' },
      description: { type: 'string', description: '카테고리 설명' },
      icon: { type: 'string', description: '아이콘 이모지' },
      color: { type: 'string', description: '카테고리 색상' },
      subcategories: {
        type: 'array',
        items: { 
          type: 'string',
          enum: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair']
        },
        description: '하위 카테고리 목록'
      },
      isActive: { type: 'boolean', description: '활성 상태' },
      sortOrder: { type: 'integer', description: '정렬 순서' },
      serviceTypes: {
        type: 'array',
        items: { $ref: '#/components/schemas/ServiceTypeInfo' },
        description: '서비스 타입 목록'
      }
    },
    required: ['id', 'displayName', 'description', 'isActive', 'sortOrder', 'serviceTypes']
  },

  ServiceTypeInfo: {
    type: 'object',
    description: '서비스 타입 정보',
    properties: {
      id: { type: 'string', description: '서비스 타입 ID' },
      name: { type: 'string', description: '서비스 이름' },
      description: { type: 'string', description: '서비스 설명' },
      priceRange: {
        type: 'object',
        description: '가격 범위',
        properties: {
          min: { type: 'number', description: '최소 가격' },
          max: { type: 'number', description: '최대 가격' }
        },
        required: ['min', 'max']
      },
      durationMinutes: { type: 'integer', description: '소요 시간 (분)' },
      isPopular: { type: 'boolean', description: '인기 서비스 여부' },
      requirements: {
        type: 'array',
        items: { type: 'string' },
        description: '서비스 요구사항'
      },
      benefits: {
        type: 'array',
        items: { type: 'string' },
        description: '서비스 혜택'
      }
    },
    required: ['id', 'name', 'description', 'priceRange', 'durationMinutes', 'isPopular']
  },

  CategoriesResponse: {
    type: 'object',
    description: '카테고리 목록 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: { $ref: '#/components/schemas/CategoryMetadata' }
          },
          total: { type: 'integer', description: '총 카테고리 수' },
          metadata: {
            type: 'object',
            properties: {
              includeInactive: { type: 'boolean' },
              withServiceTypes: { type: 'boolean' },
              categoryFilter: { type: 'string', nullable: true }
            }
          }
        },
        required: ['categories', 'total', 'metadata']
      }
    },
    required: ['success', 'data']
  },

  CategoryDetailsResponse: {
    type: 'object',
    description: '카테고리 상세 정보 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          category: { $ref: '#/components/schemas/CategoryMetadata' }
        },
        required: ['category']
      }
    },
    required: ['success', 'data']
  },

  ServiceTypesResponse: {
    type: 'object',
    description: '서비스 타입 목록 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          serviceTypes: {
            type: 'array',
            items: { $ref: '#/components/schemas/ServiceTypeInfo' }
          },
          total: { type: 'integer' }
        },
        required: ['categoryId', 'serviceTypes', 'total']
      }
    },
    required: ['success', 'data']
  },

  CategorySearchResponse: {
    type: 'object',
    description: '카테고리 검색 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { $ref: '#/components/schemas/CategoryMetadata' },
                serviceTypes: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ServiceTypeInfo' }
                },
                matchType: { 
                  type: 'string',
                  enum: ['category', 'service']
                }
              }
            }
          },
          total: { type: 'integer' }
        },
        required: ['query', 'results', 'total']
      }
    },
    required: ['success', 'data']
  },

  PopularServicesResponse: {
    type: 'object',
    description: '인기 서비스 목록 응답',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          services: {
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/ServiceTypeInfo' },
                {
                  type: 'object',
                  properties: {
                    categoryId: { type: 'string' }
                  },
                  required: ['categoryId']
                }
              ]
            }
          },
          total: { type: 'integer' },
          limit: { type: 'integer' }
        },
        required: ['services', 'total', 'limit']
      }
    },
    required: ['success', 'data']
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
  paths: {
    // Admin User Management API Endpoints
    '/api/admin/users': {
      get: {
        tags: ['관리자'],
        summary: '사용자 목록 조회 (고급 검색)',
        description: '관리자용 사용자 목록을 고급 검색 및 필터링 옵션과 함께 조회합니다.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: '이름, 이메일, 전화번호로 검색',
            schema: { type: 'string' }
          },
          {
            name: 'role',
            in: 'query',
            description: '사용자 역할 필터',
            schema: { 
              type: 'string', 
              enum: ['user', 'shop_owner', 'admin', 'influencer'] 
            }
          },
          {
            name: 'status',
            in: 'query',
            description: '계정 상태 필터',
            schema: { 
              type: 'string', 
              enum: ['active', 'inactive', 'suspended', 'deleted'] 
            }
          },
          {
            name: 'page',
            in: 'query',
            description: '페이지 번호',
            schema: { type: 'integer', minimum: 1, default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: '페이지당 항목 수',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        ],
        responses: {
          '200': {
            description: '사용자 목록 조회 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        users: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/User' }
                        },
                        totalCount: { type: 'integer', example: 150 },
                        hasMore: { type: 'boolean', example: true },
                        currentPage: { type: 'integer', example: 1 },
                        totalPages: { type: 'integer', example: 8 }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/401' },
          '403': { $ref: '#/components/responses/403' },
          '500': { $ref: '#/components/responses/500' }
        }
      }
    }
  } // End of paths
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