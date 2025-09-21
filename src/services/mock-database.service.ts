/**
 * Mock Database Service
 * 
 * Simulates Supabase database responses for development when the real database is not available.
 * Provides realistic sample data for shops, categories, and other entities.
 */

import { logger } from '../utils/logger';

// Mock shop data
const MOCK_SHOPS = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: '네일아트 스튜디오',
    description: '전문 네일아트 서비스를 제공하는 프리미엄 네일샵입니다.',
    address: '서울시 강남구 테헤란로 123',
    latitude: 37.5665,
    longitude: 126.9780,
    phone_number: '02-1234-5678',
    email: 'info@nailstudio.com',
    main_category: 'nail',
    sub_categories: ['nail_art', 'gel_nail', 'nail_care'],
    shop_type: 'partnered',
    shop_status: 'active',
    is_featured: true,
    featured_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 4.8,
    total_reviews: 156,
    total_bookings: 1250,
    commission_rate: 15.0,
    payment_methods: ['card', 'mobile_pay', 'cash'],
    business_license_number: 'BL-2024-001',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-09-20T15:30:00Z',
    owner_id: '550e8400-e29b-41d4-a716-446655440011',
    shop_images: [
      {
        id: 'img-001',
        image_url: 'https://example.com/nail-studio-1.jpg',
        alt_text: '네일아트 스튜디오 내부',
        is_primary: true,
        display_order: 1
      }
    ],
    shop_services: [
      {
        id: 'svc-001',
        name: '젤네일',
        category: 'nail',
        price_min: 30000,
        price_max: 50000,
        duration: 90,
        is_available: true
      },
      {
        id: 'svc-002',
        name: '네일아트',
        category: 'nail',
        price_min: 40000,
        price_max: 80000,
        duration: 120,
        is_available: true
      }
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: '속눈썹 익스텐션 전문점',
    description: '자연스럽고 아름다운 속눈썹 연장 서비스',
    address: '서울시 서초구 강남대로 456',
    latitude: 37.4979,
    longitude: 127.0276,
    phone_number: '02-2345-6789',
    email: 'contact@lashstudio.com',
    main_category: 'eyelash',
    sub_categories: ['eyelash_extension', 'eyelash_perm'],
    shop_type: 'partnered',
    shop_status: 'active',
    is_featured: false,
    featured_until: null,
    rating: 4.6,
    total_reviews: 89,
    total_bookings: 650,
    commission_rate: 12.0,
    payment_methods: ['card', 'mobile_pay'],
    business_license_number: 'BL-2024-002',
    created_at: '2024-02-10T10:00:00Z',
    updated_at: '2024-09-19T14:20:00Z',
    owner_id: '550e8400-e29b-41d4-a716-446655440012',
    shop_images: [
      {
        id: 'img-002',
        image_url: 'https://example.com/lash-studio-1.jpg',
        alt_text: '속눈썹 익스텐션 전문점',
        is_primary: true,
        display_order: 1
      }
    ],
    shop_services: [
      {
        id: 'svc-003',
        name: '속눈썹 연장',
        category: 'eyelash',
        price_min: 80000,
        price_max: 120000,
        duration: 150,
        is_available: true
      }
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: '왁싱 & 스킨케어',
    description: '전신 왁싱과 피부관리 전문샵',
    address: '서울시 마포구 홍대입구로 789',
    latitude: 37.5563,
    longitude: 126.9236,
    phone_number: '02-3456-7890',
    email: 'info@waxingspa.com',
    main_category: 'waxing',
    sub_categories: ['body_waxing', 'facial_waxing'],
    shop_type: 'non_partnered',
    shop_status: 'active',
    is_featured: true,
    featured_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 4.4,
    total_reviews: 234,
    total_bookings: 890,
    commission_rate: 10.0,
    payment_methods: ['card', 'cash'],
    business_license_number: 'BL-2024-003',
    created_at: '2024-03-05T11:30:00Z',
    updated_at: '2024-09-18T16:45:00Z',
    owner_id: '550e8400-e29b-41d4-a716-446655440013',
    shop_images: [
      {
        id: 'img-003',
        image_url: 'https://example.com/waxing-spa-1.jpg',
        alt_text: '왁싱 & 스킨케어 샵',
        is_primary: true,
        display_order: 1
      }
    ],
    shop_services: [
      {
        id: 'svc-004',
        name: '전신 왁싱',
        category: 'waxing',
        price_min: 150000,
        price_max: 200000,
        duration: 180,
        is_available: true
      }
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: '눈썹 문신 전문',
    description: '자연스러운 눈썹 문신과 디자인',
    address: '서울시 용산구 이태원로 321',
    latitude: 37.5347,
    longitude: 126.9947,
    phone_number: '02-4567-8901',
    email: 'hello@browtattoo.com',
    main_category: 'eyebrow_tattoo',
    sub_categories: ['eyebrow_tattoo', 'eyebrow_design'],
    shop_type: 'partnered',
    shop_status: 'active',
    is_featured: false,
    featured_until: null,
    rating: 4.9,
    total_reviews: 67,
    total_bookings: 320,
    commission_rate: 18.0,
    payment_methods: ['card', 'mobile_pay', 'cash'],
    business_license_number: 'BL-2024-004',
    created_at: '2024-04-20T13:15:00Z',
    updated_at: '2024-09-17T12:10:00Z',
    owner_id: '550e8400-e29b-41d4-a716-446655440014',
    shop_images: [
      {
        id: 'img-004',
        image_url: 'https://example.com/brow-tattoo-1.jpg',
        alt_text: '눈썹 문신 전문점',
        is_primary: true,
        display_order: 1
      }
    ],
    shop_services: [
      {
        id: 'svc-005',
        name: '눈썹 문신',
        category: 'eyebrow_tattoo',
        price_min: 200000,
        price_max: 300000,
        duration: 240,
        is_available: true
      }
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: '헤어 살롱 & 스타일링',
    description: '트렌디한 헤어컷과 컬러링 전문',
    address: '서울시 송파구 잠실로 654',
    latitude: 37.5133,
    longitude: 127.1028,
    phone_number: '02-5678-9012',
    email: 'style@hairsalon.com',
    main_category: 'hair',
    sub_categories: ['hair_cut', 'hair_color', 'hair_perm'],
    shop_type: 'partnered',
    shop_status: 'active',
    is_featured: true,
    featured_until: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 4.7,
    total_reviews: 312,
    total_bookings: 1580,
    commission_rate: 14.0,
    payment_methods: ['card', 'mobile_pay'],
    business_license_number: 'BL-2024-005',
    created_at: '2024-01-08T08:30:00Z',
    updated_at: '2024-09-21T10:25:00Z',
    owner_id: '550e8400-e29b-41d4-a716-446655440015',
    shop_images: [
      {
        id: 'img-005',
        image_url: 'https://example.com/hair-salon-1.jpg',
        alt_text: '헤어 살롱 & 스타일링',
        is_primary: true,
        display_order: 1
      }
    ],
    shop_services: [
      {
        id: 'svc-006',
        name: '헤어컷',
        category: 'hair',
        price_min: 25000,
        price_max: 45000,
        duration: 60,
        is_available: true
      },
      {
        id: 'svc-007',
        name: '헤어컬러',
        category: 'hair',
        price_min: 80000,
        price_max: 150000,
        duration: 180,
        is_available: true
      }
    ]
  }
];

/**
 * Mock Database Service
 * Simulates Supabase client responses
 */
export class MockDatabaseService {
  private static instance: MockDatabaseService;
  private shops = MOCK_SHOPS;

  private constructor() {}

  static getInstance(): MockDatabaseService {
    if (!MockDatabaseService.instance) {
      MockDatabaseService.instance = new MockDatabaseService();
    }
    return MockDatabaseService.instance;
  }

  /**
   * Simulate Supabase from() method
   */
  from(table: string) {
    return new MockQueryBuilder(table, this.shops);
  }

  /**
   * Get all shops (for testing)
   */
  getAllShops() {
    return this.shops;
  }

  /**
   * Add a shop (for testing)
   */
  addShop(shop: any) {
    this.shops.push(shop);
  }
}

/**
 * Mock Query Builder
 * Simulates Supabase query builder methods
 */
class MockQueryBuilder {
  private table: string;
  private data: any[];
  private filters: any[] = [];
  private selectFields: string = '*';
  private rangeStart?: number;
  private rangeEnd?: number;
  private orderBy?: { column: string; ascending: boolean };

  constructor(table: string, data: any[]) {
    this.table = table;
    this.data = [...data];
  }

  /**
   * Select fields
   */
  select(fields: string) {
    this.selectFields = fields;
    return this;
  }

  /**
   * Equal filter
   */
  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  /**
   * In filter
   */
  in(column: string, values: any[]) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  /**
   * ilike filter (case-insensitive like)
   */
  ilike(column: string, pattern: string) {
    this.filters.push({ type: 'ilike', column, pattern });
    return this;
  }

  /**
   * Or filter
   */
  or(conditions: string) {
    // Parse conditions like "name.ilike.%term%,description.ilike.%term%"
    const orConditions = conditions.split(',').map(condition => {
      const parts = condition.split('.');
      if (parts.length >= 3) {
        const column = parts[0];
        const operator = parts[1];
        const value = parts.slice(2).join('.');
        return { column, operator, value };
      }
      return null;
    }).filter(Boolean);

    this.filters.push({ type: 'or', conditions: orConditions });
    return this;
  }

  /**
   * Greater than or equal
   */
  gte(column: string, value: any) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  /**
   * Less than or equal
   */
  lte(column: string, value: any) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  /**
   * Greater than
   */
  gt(column: string, value: any) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  /**
   * Not equal
   */
  not(column: string, operator: string, value: any) {
    this.filters.push({ type: 'not', column, operator, value });
    return this;
  }

  /**
   * Contains (for arrays)
   */
  contains(column: string, value: any[]) {
    this.filters.push({ type: 'contains', column, value });
    return this;
  }

  /**
   * Overlaps (for arrays)
   */
  overlaps(column: string, value: any[]) {
    this.filters.push({ type: 'overlaps', column, value });
    return this;
  }

  /**
   * Order by
   */
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? false };
    return this;
  }

  /**
   * Range (pagination)
   */
  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  /**
   * Execute query and return results
   */
  async then(resolve?: (value: any) => any, reject?: (reason: any) => any) {
    try {
      let filteredData = [...this.data];

      // Apply filters
      for (const filter of this.filters) {
        filteredData = this.applyFilter(filteredData, filter);
      }

      // Apply ordering
      if (this.orderBy) {
        filteredData.sort((a, b) => {
          const aVal = a[this.orderBy!.column];
          const bVal = b[this.orderBy!.column];
          
          let comparison = 0;
          if (aVal < bVal) comparison = -1;
          else if (aVal > bVal) comparison = 1;
          
          return this.orderBy!.ascending ? comparison : -comparison;
        });
      }

      // Apply pagination
      if (this.rangeStart !== undefined && this.rangeEnd !== undefined) {
        filteredData = filteredData.slice(this.rangeStart, this.rangeEnd + 1);
      }

      const result = {
        data: filteredData,
        error: null,
        count: filteredData.length
      };

      logger.info('Mock database query executed', {
        table: this.table,
        filters: this.filters.length,
        results: filteredData.length
      });

      return resolve ? resolve(result) : result;
    } catch (error) {
      const errorResult = {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        count: 0
      };
      return reject ? reject(errorResult) : errorResult;
    }
  }

  /**
   * Apply a single filter to the data
   */
  private applyFilter(data: any[], filter: any): any[] {
    switch (filter.type) {
      case 'eq':
        return data.filter(item => item[filter.column] === filter.value);
      
      case 'in':
        return data.filter(item => filter.values.includes(item[filter.column]));
      
      case 'ilike':
        const pattern = filter.pattern.replace(/%/g, '');
        return data.filter(item => {
          const value = item[filter.column];
          return value && value.toString().toLowerCase().includes(pattern.toLowerCase());
        });
      
      case 'or':
        return data.filter(item => {
          return filter.conditions.some((condition: any) => {
            if (condition.operator === 'ilike') {
              const pattern = condition.value.replace(/%/g, '');
              const value = item[condition.column];
              return value && value.toString().toLowerCase().includes(pattern.toLowerCase());
            }
            return false;
          });
        });
      
      case 'gte':
        return data.filter(item => item[filter.column] >= filter.value);
      
      case 'lte':
        return data.filter(item => item[filter.column] <= filter.value);
      
      case 'gt':
        return data.filter(item => item[filter.column] > filter.value);
      
      case 'not':
        if (filter.operator === 'is') {
          return data.filter(item => item[filter.column] !== filter.value);
        }
        return data;
      
      case 'contains':
        return data.filter(item => {
          const itemValue = item[filter.column];
          if (Array.isArray(itemValue) && Array.isArray(filter.value)) {
            return filter.value.every(val => itemValue.includes(val));
          }
          return false;
        });
      
      case 'overlaps':
        return data.filter(item => {
          const itemValue = item[filter.column];
          if (Array.isArray(itemValue) && Array.isArray(filter.value)) {
            return filter.value.some(val => itemValue.includes(val));
          }
          return false;
        });
      
      default:
        return data;
    }
  }
}

// Export singleton instance
export const mockDatabaseService = MockDatabaseService.getInstance();
