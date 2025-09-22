/**
 * OpenAPI Configuration for Service APIs
 * 
 * Comprehensive OpenAPI documentation configuration specifically for customer-facing service endpoints
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

// Import shared components from main config
import { 
  API_SERVERS, 
  SECURITY_SCHEMES, 
  COMMON_RESPONSES, 
  COMMON_PARAMETERS, 
  DATABASE_SCHEMAS 
} from './openapi.config';

/**
 * Service API Information
 */
export const SERVICE_API_INFO: OpenAPIInfo = {
  title: '에뷰리띵 Service API',
  description: `
# 에뷰리띵 Service API

Customer-facing REST API for the beauty service booking platform.

## Core Features

- **User Management**: Registration, authentication, and profile management
- **Shop Discovery**: Location-based search and shop information
- **Booking System**: Real-time availability and reservation management  
- **Payment Processing**: Secure payments via TossPayments integration
- **Notifications**: Push notifications and real-time updates
- **Social Features**: Favorites, reviews, and social interactions

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

## 오류 처리

모든 API 응답은 일관된 오류 형식을 따르며 적절한 HTTP 상태 코드를 사용합니다.

## 데이터 형식

- 모든 타임스탬프는 ISO 8601 형식
- 좌표는 WGS84 십진도 사용
- 통화 금액은 한국 원화(KRW)
- 위치 데이터는 PostGIS Geography 타입 사용

## 실시간 기능

- WebSocket을 통한 실시간 예약 업데이트
- FCM을 통한 푸시 알림
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
 * Service API Tags
 */
export const SERVICE_API_TAGS: OpenAPITag[] = [
  // Core User-Facing APIs
  {
    name: '인증',
    description: '사용자 인증 및 권한 관리 API'
  },
  {
    name: '회원가입',
    description: '사용자 등록 및 온보딩 API'
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
    name: '샵 검색',
    description: '위치 기반 샵 검색 및 필터링 API'
  },
  {
    name: '샵 카테고리',
    description: '샵 카테고리 및 서비스 분류 API'
  },
  {
    name: '서비스 카탈로그',
    description: '뷰티 서비스 카탈로그 및 메뉴 API'
  },
  {
    name: '예약', 
    description: '예약 생성, 수정, 취소 API'
  },
  {
    name: '예약 재조정',
    description: '예약 일정 변경 및 재조정 API'
  },
  {
    name: '충돌 해결',
    description: '예약 충돌 감지 및 해결 API'
  },
  {
    name: '결제',
    description: '토스페이먼츠 연동 결제 API'
  },
  {
    name: '분할 결제',
    description: '그룹 결제 및 분할 결제 API'
  },
  {
    name: '포인트',
    description: '포인트 적립, 사용, 조회 API'
  },
  {
    name: '포인트 잔액',
    description: '포인트 잔액 조회 및 관리 API'
  },
  {
    name: '인플루언서 보너스',
    description: '인플루언서 보너스 및 리워드 API'
  },
  {
    name: '추천 코드',
    description: '추천 코드 생성 및 관리 API'
  },
  {
    name: '추천 관계',
    description: '사용자 추천 관계 관리 API'
  },
  {
    name: '추천 수익',
    description: '추천을 통한 수익 관리 API'
  },
  {
    name: '추천 분석',
    description: '추천 프로그램 분석 및 통계 API'
  },
  {
    name: '인플루언서 자격',
    description: '인플루언서 자격 관리 API'
  },
  {
    name: '알림',
    description: '푸시 알림 및 실시간 알림 API'
  },
  {
    name: '즐겨찾기',
    description: '사용자 즐겨찾기 관리 API'
  },
  {
    name: '피드',
    description: '소셜 피드 및 콘텐츠 API'
  },
  
  // Shop Owner APIs
  {
    name: '샵 소유자',
    description: '샵 소유자 전용 관리 API'
  },
  {
    name: '샵 등록',
    description: '새로운 샵 등록 및 온보딩 API'
  },
  {
    name: '샵 프로필',
    description: '샵 프로필 관리 API'
  },
  {
    name: '샵 서비스',
    description: '샵 서비스 메뉴 관리 API'
  },
  {
    name: '샵 운영시간',
    description: '샵 운영시간 설정 및 관리 API'
  },
  {
    name: '샵 대시보드',
    description: '샵 소유자 대시보드 API'
  },
  {
    name: '샵 연락처',
    description: '샵 연락처 정보 관리 API'
  },
  {
    name: '샵 리포팅',
    description: '샵 성과 리포팅 API'
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
    name: 'CDN',
    description: 'CDN 이미지 URL 생성 및 최적화 API'
  },
  {
    name: '이미지 메타데이터',
    description: '이미지 메타데이터 관리 API'
  },
  {
    name: '캐시',
    description: 'Redis 캐시 관리 API'
  },
  {
    name: '사용자 세션',
    description: '사용자 세션 관리 API'
  },
  {
    name: 'CSRF',
    description: 'CSRF 토큰 관리 API'
  },
  {
    name: '인증 분석',
    description: '인증 관련 분석 및 통계 API'
  }
];

/**
 * Service OpenAPI Generation Configuration
 */
export const SERVICE_OPENAPI_GENERATION_CONFIG: any = {
  definition: {
    openapi: '3.0.0',
    info: SERVICE_API_INFO,
    servers: API_SERVERS,
    tags: SERVICE_API_TAGS,
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
  // Exclude admin routes
  apis: [
    './src/routes/auth.routes.ts',
    './src/routes/registration.routes.ts',
    './src/routes/shop.routes.ts',
    './src/routes/shop-*.ts',
    './src/routes/reservation*.ts',
    './src/routes/payment*.ts',
    './src/routes/point*.ts',
    './src/routes/notification*.ts',
    './src/routes/websocket.routes.ts',
    './src/routes/storage.routes.ts',
    './src/routes/cdn.routes.ts',
    './src/routes/favorites.routes.ts',
    './src/routes/feed.routes.ts',
    './src/routes/user-*.ts',
    './src/routes/referral*.ts',
    './src/routes/influencer*.ts',
    './src/routes/service-catalog.routes.ts',
    './src/routes/conflict-resolution.routes.ts',
    './src/routes/split-payment.routes.ts',
    './src/routes/image-metadata.routes.ts',
    './src/routes/cache.routes.ts',
    './src/routes/csrf.routes.ts',
    './src/routes/auth-analytics.routes.ts',
    './src/app.ts'
  ]
};

/**
 * Service OpenAPI UI Configuration
 */
export const SERVICE_OPENAPI_UI_CONFIG: any = {
  explorer: true,
  customCss: `
    /* Hide default topbar */
    .swagger-ui .topbar { display: none !important; }
    
    /* Custom header styling */
    .swagger-ui .info .title { 
      color: #059669; 
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(5, 150, 105, 0.1);
    }
    .swagger-ui .info .title:after { 
      content: " 🛍️ SERVICE"; 
      color: #059669; 
      font-weight: bold; 
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      margin-left: 1rem;
      font-size: 1rem;
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
    }
    
    /* Enhanced info section */
    .swagger-ui .info {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      padding: 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      border: 2px solid #a7f3d0;
      box-shadow: 0 4px 16px rgba(5, 150, 105, 0.1);
    }
    
    /* Improved tag sections */
    .swagger-ui .opblock-tag {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white !important;
      font-weight: 600;
      padding: 1rem 1.5rem;
      border-radius: 0.75rem;
      margin: 1rem 0;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
      border: none;
    }
    
    .swagger-ui .opblock-tag:hover {
      background: linear-gradient(135deg, #047857 0%, #065f46 100%);
      transform: translateY(-2px);
      transition: all 0.3s ease;
    }
    
    /* Enhanced operation blocks */
    .swagger-ui .opblock {
      border-radius: 0.75rem;
      margin: 1rem 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    
    /* Method color improvements */
    .swagger-ui .opblock.opblock-post { border-left: 4px solid #10b981; }
    .swagger-ui .opblock.opblock-get { border-left: 4px solid #3b82f6; }
    .swagger-ui .opblock.opblock-put { border-left: 4px solid #f59e0b; }
    .swagger-ui .opblock.opblock-delete { border-left: 4px solid #ef4444; }
    
    /* Better parameter styling */
    .swagger-ui .parameters-col_description {
      font-size: 0.9rem;
      line-height: 1.5;
    }
    
    /* Enhanced try it out button */
    .swagger-ui .btn.try-out__btn {
      background: #059669;
      color: white;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .swagger-ui .btn.try-out__btn:hover {
      background: #047857;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(5, 150, 105, 0.3);
    }
    
    /* Execute button styling */
    .swagger-ui .btn.execute {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
      border-radius: 0.5rem;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .swagger-ui .btn.execute:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(5, 150, 105, 0.4);
    }
    
    /* Improved response styling */
    .swagger-ui .responses-inner {
      border-radius: 0.5rem;
      overflow: hidden;
    }
    
    /* Success response highlighting */
    .swagger-ui .response-col_status {
      font-weight: 600;
    }
    
    .swagger-ui .response.response_200 {
      border-left: 4px solid #10b981;
      background-color: #f0fdf4;
    }
    
    .swagger-ui .response.response_201 {
      border-left: 4px solid #059669;
      background-color: #ecfdf5;
    }
    
    /* Error response highlighting */
    .swagger-ui .response.response_400 {
      border-left: 4px solid #f59e0b;
      background-color: #fffbeb;
    }
    
    .swagger-ui .response.response_401,
    .swagger-ui .response.response_403 {
      border-left: 4px solid #ef4444;
      background-color: #fef2f2;
    }
    
    .swagger-ui .response.response_500 {
      border-left: 4px solid #7c2d12;
      background-color: #fef2f2;
    }
    
    /* Better search/filter */
    .swagger-ui .filter-container {
      background: #f0fdf4;
      padding: 1rem;
      border-radius: 0.75rem;
      margin: 1rem 0;
      border: 1px solid #bbf7d0;
    }
    
    .swagger-ui .filter-container input {
      border: 2px solid #d1fae5;
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-size: 1rem;
      width: 100%;
      transition: border-color 0.3s ease;
    }
    
    .swagger-ui .filter-container input:focus {
      border-color: #059669;
      outline: none;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }
    
    /* Model/Schema styling */
    .swagger-ui .model-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
    }
    
    .swagger-ui .model .property {
      padding: 0.5rem 0;
      border-bottom: 1px solid #f3f4f6;
    }
    
    /* Scrollbar styling */
    .swagger-ui ::-webkit-scrollbar {
      width: 8px;
    }
    
    .swagger-ui ::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }
    
    .swagger-ui ::-webkit-scrollbar-thumb {
      background: #059669;
      border-radius: 4px;
    }
    
    .swagger-ui ::-webkit-scrollbar-thumb:hover {
      background: #047857;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .swagger-ui .info .title { 
        font-size: 1.8rem; 
      }
      .swagger-ui .info .title:after { 
        display: block;
        margin: 0.5rem 0 0 0;
        font-size: 0.9rem;
      }
      .swagger-ui .info { 
        padding: 1rem; 
      }
      .swagger-ui .opblock-tag {
        padding: 0.75rem 1rem;
      }
    }
    
    /* Loading states */
    .swagger-ui .loading-container {
      text-align: center;
      padding: 2rem;
      color: #059669;
    }
    
    /* Custom badges for different endpoint types */
    .swagger-ui .opblock-summary-method {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-radius: 0.25rem;
    }
  `,
  customSiteTitle: '🛍️ 에뷰리띵 Service API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 3,
    docExpansion: 'list',
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    tryItOutEnabled: true,
    validatorUrl: null,
    requestInterceptor: (req) => {
      // Add custom headers or modify requests
      req.headers['X-API-Source'] = 'Service-Docs';
      return req;
    }
  }
};

