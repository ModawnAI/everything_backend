/**
 * OpenAPI Configuration for Admin APIs
 * 
 * Comprehensive OpenAPI documentation configuration specifically for administrative endpoints
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
 * Admin API Information
 */
export const ADMIN_API_INFO: OpenAPIInfo = {
  title: '에뷰리띵 Admin API',
  description: `
# 에뷰리띵 Admin API

Administrative interface for the beauty service platform management.

## Admin Features

- **User Management**: User account administration and moderation
- **Shop Management**: Shop approval, verification, and oversight
- **Reservation Management**: Reservation monitoring and intervention
- **Payment Administration**: Payment processing oversight and reconciliation
- **Analytics & Reporting**: Business intelligence and performance metrics
- **Security Management**: Security monitoring and threat response
- **System Administration**: System health, monitoring, and configuration

## 인증

관리자 API는 관리자 권한이 있는 JWT 토큰이 필요합니다:

\`\`\`
Authorization: Bearer <admin-jwt-token>
\`\`\`

## 접근 권한

관리자 API는 다음 역할에만 접근 가능합니다:
- **SUPER_ADMIN**: 모든 관리 기능 접근
- **ADMIN**: 일반 관리 기능 접근
- **MODERATOR**: 제한된 관리 기능 접근

## 속도 제한

관리자 API는 높은 속도 제한이 적용됩니다:
- 관리자: 15분당 1000회 요청
- 슈퍼 관리자: 15분당 2000회 요청

## 보안

- 관리자 전용 JWT 토큰 검증
- 역할 기반 접근 제어 (RBAC)
- 모든 관리 작업 감사 로그
- IP 화이트리스트 및 지리적 제한
- 다단계 인증 (MFA) 지원
  `,
  version: '1.0.0',
  termsOfService: 'https://ebeautything.com/admin/terms',
  contact: {
    name: '에뷰리띵 Admin API 지원팀',
    email: 'admin-api-support@ebeautything.com',
    url: 'https://ebeautything.com/admin/support'
  },
  license: {
    name: 'Proprietary - Admin Only',
    url: 'https://ebeautything.com/admin/license'
  }
};

/**
 * Admin API Tags
 */
export const ADMIN_API_TAGS: OpenAPITag[] = [
  {
    name: '관리자 인증',
    description: '관리자 인증 및 권한 관리'
  },
  {
    name: '사용자 관리',
    description: '사용자 계정 관리 및 조정'
  },
  {
    name: '샵 관리',
    description: '샵 승인, 검증 및 감독'
  },
  {
    name: '예약 관리',
    description: '예약 모니터링 및 개입'
  },
  {
    name: '결제 관리',
    description: '결제 처리 감독 및 정산'
  },
  {
    name: '포인트 관리',
    description: '포인트 시스템 관리 및 조정'
  },
  {
    name: '분석 및 리포팅',
    description: '비즈니스 인텔리전스 및 성과 지표'
  },
  {
    name: '보안 관리',
    description: '보안 모니터링 및 위협 대응'
  },
  {
    name: '시스템 관리',
    description: '시스템 상태, 모니터링 및 구성'
  },
  {
    name: '콘텐츠 관리',
    description: '콘텐츠 검토 및 조정'
  },
  {
    name: '재무 관리',
    description: '재무 데이터 및 거래 관리'
  },
  {
    name: 'IP 차단',
    description: 'IP 주소 차단 및 보안 관리'
  }
];

/**
 * Admin OpenAPI Generation Configuration
 */
export const ADMIN_OPENAPI_GENERATION_CONFIG: any = {
  definition: {
    openapi: '3.0.0',
    info: ADMIN_API_INFO,
    servers: API_SERVERS,
    tags: ADMIN_API_TAGS,
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
  // Only include admin routes
  apis: [
    './src/routes/admin*.ts',
    './src/routes/admin/*.ts',
    './src/routes/admin-*.ts',
    './src/routes/user-status.routes.ts', // Admin user status management
    './src/routes/monitoring*.ts',
    './src/routes/security.routes.ts',
    './src/app.ts'
  ]
};

/**
 * Admin OpenAPI UI Configuration
 */
export const ADMIN_OPENAPI_UI_CONFIG: any = {
  explorer: true,
  customCss: `
    /* Hide default topbar */
    .swagger-ui .topbar { display: none !important; }
    
    /* Custom header styling */
    .swagger-ui .info .title { 
      color: #dc2626; 
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(220, 38, 38, 0.1);
    }
    .swagger-ui .info .title:after { 
      content: " 🔒 ADMIN"; 
      color: #dc2626; 
      font-weight: bold; 
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      margin-left: 1rem;
      font-size: 1rem;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
    }
    
    /* Enhanced info section */
    .swagger-ui .info {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      padding: 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      border: 2px solid #fecaca;
      box-shadow: 0 4px 16px rgba(220, 38, 38, 0.1);
    }
    
    /* Improved tag sections */
    .swagger-ui .opblock-tag {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white !important;
      font-weight: 600;
      padding: 1rem 1.5rem;
      border-radius: 0.75rem;
      margin: 1rem 0;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
      border: none;
    }
    
    .swagger-ui .opblock-tag:hover {
      background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
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
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .swagger-ui .btn.try-out__btn:hover {
      background: #b91c1c;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
    }
    
    /* Improved response styling */
    .swagger-ui .responses-inner {
      border-radius: 0.5rem;
      overflow: hidden;
    }
    
    /* Better search/filter */
    .swagger-ui .filter-container {
      background: #f9fafb;
      padding: 1rem;
      border-radius: 0.75rem;
      margin: 1rem 0;
    }
    
    .swagger-ui .filter-container input {
      border: 2px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-size: 1rem;
      width: 100%;
      transition: border-color 0.3s ease;
    }
    
    .swagger-ui .filter-container input:focus {
      border-color: #dc2626;
      outline: none;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
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
      background: #dc2626;
      border-radius: 4px;
    }
    
    .swagger-ui ::-webkit-scrollbar-thumb:hover {
      background: #b91c1c;
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
    }
  `,
  customSiteTitle: '🔒 에뷰리띵 Admin API Documentation',
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
    requestInterceptor: (req) => {
      // Add custom headers or modify requests
      req.headers['X-API-Source'] = 'Admin-Docs';
      return req;
    }
  }
};

