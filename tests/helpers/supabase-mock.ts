/**
 * Supabase Mock Helper
 *
 * 체이닝 메서드를 완벽하게 지원하는 Supabase 클라이언트 모킹 헬퍼
 *
 * @example
 * ```typescript
 * import { createSupabaseMock } from '../helpers/supabase-mock';
 *
 * const mockSupabase = createSupabaseMock({ data: { id: '123' }, error: null });
 * (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
 *
 * // 특정 테이블 응답 설정
 * mockSupabase.mockTable('reservations', { data: [...], error: null });
 * ```
 */

import { jest } from '@jest/globals';

export interface SupabaseResponse<T = any> {
  data: T | null;
  error: { message: string; code?: string; details?: any; hint?: string } | null;
  count?: number;
}

export interface MockSupabaseClient {
  from: jest.Mock;
  rpc: jest.Mock;
  auth: {
    getUser: jest.Mock;
    signIn: jest.Mock;
    signOut: jest.Mock;
    signInWithPassword: jest.Mock;
    signUp: jest.Mock;
    getSession: jest.Mock;
  };
  storage: {
    from: jest.Mock;
  };
  // 테이블별 응답 설정 헬퍼
  mockTable: (tableName: string, response: SupabaseResponse) => MockSupabaseClient;
  mockTableChain: (tableName: string, chainConfig: ChainConfig) => MockSupabaseClient;
  mockRpc: (funcName: string, response: SupabaseResponse) => MockSupabaseClient;
  // 전역 응답 설정
  setDefaultResponse: (response: SupabaseResponse) => MockSupabaseClient;
  // 모킹 초기화
  reset: () => void;
}

export interface ChainConfig {
  select?: SupabaseResponse;
  insert?: SupabaseResponse;
  update?: SupabaseResponse;
  delete?: SupabaseResponse;
  upsert?: SupabaseResponse;
  single?: SupabaseResponse;
  maybeSingle?: SupabaseResponse;
}

/**
 * 체이닝을 지원하는 Supabase query builder 생성
 */
function createChainableQuery(response: SupabaseResponse = { data: null, error: null }): any {
  const createChainable = (overrideResponse?: SupabaseResponse): any => {
    const finalResponse = overrideResponse || response;

    const chainable: any = {
      // Select/Query 메서드
      select: jest.fn(() => chainable),

      // 필터 메서드
      eq: jest.fn(() => chainable),
      neq: jest.fn(() => chainable),
      gt: jest.fn(() => chainable),
      gte: jest.fn(() => chainable),
      lt: jest.fn(() => chainable),
      lte: jest.fn(() => chainable),
      like: jest.fn(() => chainable),
      ilike: jest.fn(() => chainable),
      is: jest.fn(() => chainable),
      in: jest.fn(() => chainable),
      contains: jest.fn(() => chainable),
      containedBy: jest.fn(() => chainable),
      rangeGt: jest.fn(() => chainable),
      rangeGte: jest.fn(() => chainable),
      rangeLt: jest.fn(() => chainable),
      rangeLte: jest.fn(() => chainable),
      rangeAdjacent: jest.fn(() => chainable),
      overlaps: jest.fn(() => chainable),
      textSearch: jest.fn(() => chainable),
      match: jest.fn(() => chainable),
      not: jest.fn(() => chainable),
      or: jest.fn(() => chainable),
      and: jest.fn(() => chainable),
      filter: jest.fn(() => chainable),

      // 정렬/제한 메서드
      order: jest.fn(() => chainable),
      limit: jest.fn(() => chainable),
      range: jest.fn(() => chainable),
      offset: jest.fn(() => chainable),

      // 수정 메서드
      insert: jest.fn(() => chainable),
      upsert: jest.fn(() => chainable),
      update: jest.fn(() => chainable),
      delete: jest.fn(() => chainable),

      // 종료 메서드 (Promise 반환)
      single: jest.fn(() => Promise.resolve(finalResponse)),
      maybeSingle: jest.fn(() => Promise.resolve(finalResponse)),

      // 모든 체인은 Promise를 반환
      then: jest.fn((resolve: any, reject?: any) => {
        if (finalResponse.error && reject) {
          return reject(finalResponse.error);
        }
        return resolve ? resolve(finalResponse) : finalResponse;
      }),

      // 커스텀 응답 설정 (체이닝 중간에서)
      mockResponse: (newResponse: SupabaseResponse) => {
        return createChainable(newResponse);
      },

      // AbortSignal 지원
      abortSignal: jest.fn(() => chainable),

      // RLS 우회 (테스트용)
      throwOnError: jest.fn(() => chainable),

      // csv/returns 관련
      csv: jest.fn(() => chainable),
      returns: jest.fn(() => chainable),

      // count 관련
      count: jest.fn(() => chainable),
    };

    // Promise-like behavior
    chainable.catch = jest.fn((handler: any) => {
      if (finalResponse.error) {
        return Promise.resolve(handler(finalResponse.error));
      }
      return Promise.resolve(finalResponse);
    });

    chainable.finally = jest.fn((handler: any) => {
      handler?.();
      return Promise.resolve(finalResponse);
    });

    return chainable;
  };

  return createChainable();
}

/**
 * Supabase 클라이언트 모킹 헬퍼 생성
 *
 * @param defaultResponse 기본 응답 값
 * @returns 모킹된 Supabase 클라이언트
 */
export function createSupabaseMock(
  defaultResponse: SupabaseResponse = { data: null, error: null }
): MockSupabaseClient {
  const tableResponses: Map<string, SupabaseResponse | ChainConfig> = new Map();
  const rpcResponses: Map<string, SupabaseResponse> = new Map();
  let currentDefaultResponse = defaultResponse;

  const mockSupabase: MockSupabaseClient = {
    from: jest.fn((tableName: string) => {
      const tableConfig = tableResponses.get(tableName);

      if (tableConfig) {
        // ChainConfig인 경우
        if ('select' in tableConfig || 'insert' in tableConfig ||
            'update' in tableConfig || 'delete' in tableConfig) {
          const chain = createChainableQuery(currentDefaultResponse);
          const config = tableConfig as ChainConfig;

          if (config.select) {
            chain.single.mockResolvedValue(config.select);
            chain.maybeSingle.mockResolvedValue(config.select);
          }
          if (config.single) {
            chain.single.mockResolvedValue(config.single);
          }
          if (config.maybeSingle) {
            chain.maybeSingle.mockResolvedValue(config.maybeSingle);
          }

          return chain;
        }
        // 단순 SupabaseResponse인 경우
        return createChainableQuery(tableConfig as SupabaseResponse);
      }

      return createChainableQuery(currentDefaultResponse);
    }),

    rpc: jest.fn((funcName: string, params?: any) => {
      const rpcResponse = rpcResponses.get(funcName);
      if (rpcResponse) {
        return Promise.resolve(rpcResponse);
      }
      return Promise.resolve(currentDefaultResponse);
    }),

    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: null },
        error: null
      })),
      signIn: jest.fn(() => Promise.resolve({
        data: null,
        error: null
      })),
      signOut: jest.fn(() => Promise.resolve({
        error: null
      })),
      signInWithPassword: jest.fn(() => Promise.resolve({
        data: { user: null, session: null },
        error: null
      })),
      signUp: jest.fn(() => Promise.resolve({
        data: { user: null, session: null },
        error: null
      })),
      getSession: jest.fn(() => Promise.resolve({
        data: { session: null },
        error: null
      })),
    },

    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
        download: jest.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
        list: jest.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test-url.com' } })),
      })),
    },

    mockTable: function(tableName: string, response: SupabaseResponse) {
      tableResponses.set(tableName, response);
      return this;
    },

    mockTableChain: function(tableName: string, chainConfig: ChainConfig) {
      tableResponses.set(tableName, chainConfig);
      return this;
    },

    mockRpc: function(funcName: string, response: SupabaseResponse) {
      rpcResponses.set(funcName, response);
      return this;
    },

    setDefaultResponse: function(response: SupabaseResponse) {
      currentDefaultResponse = response;
      return this;
    },

    reset: function() {
      tableResponses.clear();
      rpcResponses.clear();
      currentDefaultResponse = defaultResponse;
      jest.clearAllMocks();
    },
  };

  return mockSupabase;
}

/**
 * 성공 응답 헬퍼
 */
export function successResponse<T>(data: T, count?: number): SupabaseResponse<T> {
  return { data, error: null, count };
}

/**
 * 에러 응답 헬퍼
 */
export function errorResponse(
  message: string,
  code?: string,
  details?: any
): SupabaseResponse<null> {
  return {
    data: null,
    error: { message, code, details }
  };
}

/**
 * 빈 결과 응답 헬퍼
 */
export function emptyResponse(): SupabaseResponse<[]> {
  return { data: [], error: null, count: 0 };
}

/**
 * 페이지네이션 응답 헬퍼
 */
export function paginatedResponse<T>(
  data: T[],
  total: number
): SupabaseResponse<T[]> {
  return { data, error: null, count: total };
}

/**
 * database.ts 모킹을 위한 헬퍼
 *
 * @example
 * ```typescript
 * jest.mock('../../src/config/database', () => ({
 *   getSupabaseClient: jest.fn(),
 * }));
 *
 * const mockSupabase = createSupabaseMock();
 * setupDatabaseMock(mockSupabase);
 * ```
 */
export function setupDatabaseMock(mockSupabase: MockSupabaseClient): void {
  const { getSupabaseClient } = require('../../src/config/database');
  (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
}

/**
 * 일반적인 테스트 시나리오를 위한 사전 설정된 모킹
 */
export const mockScenarios = {
  /**
   * 예약 생성 성공 시나리오
   */
  reservationSuccess: () => createSupabaseMock(successResponse({
    id: 'reservation-123',
    shop_id: 'shop-123',
    user_id: 'user-123',
    reservation_date: '2024-03-15',
    reservation_time: '10:00',
    status: 'confirmed',
    total_amount: 50000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),

  /**
   * 인증 성공 시나리오
   */
  authSuccess: (userId: string = 'user-123') => {
    const mock = createSupabaseMock();
    mock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: userId,
          email: 'test@example.com',
          role: 'authenticated',
        }
      },
      error: null,
    });
    return mock;
  },

  /**
   * 데이터베이스 오류 시나리오
   */
  databaseError: (message: string = 'Database connection failed') =>
    createSupabaseMock(errorResponse(message, 'PGRST000')),

  /**
   * 권한 없음 시나리오
   */
  unauthorized: () =>
    createSupabaseMock(errorResponse('Unauthorized', '401')),

  /**
   * 리소스 없음 시나리오
   */
  notFound: () =>
    createSupabaseMock(successResponse(null)),
};

export default createSupabaseMock;
