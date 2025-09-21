import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';

export interface CategoryMetadata {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  subcategories: string[];
  isActive: boolean;
  sortOrder: number;
  serviceTypes: ServiceTypeInfo[];
}

export interface ServiceTypeInfo {
  id: string;
  name: string;
  description: string;
  priceRange: {
    min: number;
    max: number;
  };
  durationMinutes: number;
  isPopular: boolean;
  requirements: string[];
  benefits: string[];
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  totalServices: number;
  popularServices: number;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    serviceCount: number;
    averagePrice: number;
  }[];
}

export interface CategorySearchResult {
  category: CategoryMetadata;
  serviceTypes: ServiceTypeInfo[];
  matchType: 'category' | 'service';
}

export interface PopularService extends ServiceTypeInfo {
  categoryId: string;
}

class ShopCategoriesService {
  private supabase = getSupabaseClient();

  /**
   * Get all categories with optional filtering
   */
  async getAllCategories(options: {
    includeInactive?: boolean;
    withServiceTypes?: boolean;
    categoryFilter?: string;
  } = {}): Promise<CategoryMetadata[]> {
    try {
      const { includeInactive = false, withServiceTypes = true, categoryFilter } = options;

      // Create cache key based on options
      const cacheKey = `categories:${includeInactive}:${withServiceTypes}:${categoryFilter || 'all'}`;
      
      // Try to get from cache first
      const cachedResult = await cacheService.get<CategoryMetadata[]>(cacheKey);
      if (cachedResult) {
        logger.info('Categories retrieved from cache', { cacheKey });
        return cachedResult;
      }

      // Use static category data since shop_categories table doesn't exist yet
      const staticCategories: CategoryMetadata[] = [
        {
          id: 'nail',
          displayName: '네일',
          description: '네일 아트, 젤 네일, 매니큐어, 페디큐어 서비스',
          icon: '💅',
          color: '#FF6B9D',
          subcategories: [],
          isActive: true,
          sortOrder: 1,
          serviceTypes: withServiceTypes ? [
            {
              id: 'nail_art',
              name: '네일 아트',
              description: '다양한 디자인의 네일 아트 서비스',
              priceRange: { min: 20000, max: 80000 },
              durationMinutes: 90,
              isPopular: true,
              requirements: ['손톱 상태 확인', '알레르기 체크'],
              benefits: ['개성 있는 디자인', '장기 지속성']
            },
            {
              id: 'gel_nail',
              name: '젤 네일',
              description: '젤을 이용한 네일 연장 및 강화',
              priceRange: { min: 30000, max: 100000 },
              durationMinutes: 120,
              isPopular: true,
              requirements: ['손톱 길이 확인', '젤 알레르기 체크'],
              benefits: ['자연스러운 연장', '강한 내구성']
            }
          ] : []
        },
        {
          id: 'eyelash',
          displayName: '속눈썹',
          description: '속눈썹 연장, 리프트, 펌 서비스',
          icon: '👁️',
          color: '#8B5CF6',
          subcategories: [],
          isActive: true,
          sortOrder: 2,
          serviceTypes: withServiceTypes ? [
            {
              id: 'eyelash_extension',
              name: '속눈썹 연장',
              description: '인조 속눈썹을 이용한 연장 서비스',
              priceRange: { min: 50000, max: 150000 },
              durationMinutes: 120,
              isPopular: true,
              requirements: ['속눈썹 상태 확인', '알레르기 테스트'],
              benefits: ['자연스러운 연장', '오래 지속']
            }
          ] : []
        },
        {
          id: 'waxing',
          displayName: '왁싱',
          description: '털 제거 및 관리 서비스',
          icon: '🪶',
          color: '#F59E0B',
          subcategories: [],
          isActive: true,
          sortOrder: 3,
          serviceTypes: withServiceTypes ? [
            {
              id: 'body_waxing',
              name: '바디 왁싱',
              description: '전신 털 제거 서비스',
              priceRange: { min: 30000, max: 150000 },
              durationMinutes: 60,
              isPopular: true,
              requirements: ['털 길이 확인', '피부 상태 체크'],
              benefits: ['깔끔한 피부', '장기 지속']
            }
          ] : []
        },
        {
          id: 'eyebrow_tattoo',
          displayName: '눈썹 문신',
          description: '반영구 눈썹 문신 및 관리 서비스',
          icon: '✏️',
          color: '#10B981',
          subcategories: [],
          isActive: true,
          sortOrder: 4,
          serviceTypes: withServiceTypes ? [
            {
              id: 'eyebrow_tattoo_basic',
              name: '기본 눈썹 문신',
              description: '자연스러운 눈썹 라인 문신',
              priceRange: { min: 100000, max: 300000 },
              durationMinutes: 180,
              isPopular: true,
              requirements: ['피부 타입 확인', '알레르기 테스트'],
              benefits: ['자연스러운 눈썹', '장기 지속']
            }
          ] : []
        },
        {
          id: 'hair',
          displayName: '헤어',
          description: '헤어 스타일링, 컷, 컬러링 서비스',
          icon: '💇‍♀️',
          color: '#EF4444',
          subcategories: [],
          isActive: true,
          sortOrder: 5,
          serviceTypes: withServiceTypes ? [
            {
              id: 'hair_cut',
              name: '헤어 컷',
              description: '다양한 스타일의 헤어 컷 서비스',
              priceRange: { min: 20000, max: 100000 },
              durationMinutes: 60,
              isPopular: true,
              requirements: ['헤어 상태 확인', '원하는 스타일 상담'],
              benefits: ['새로운 스타일', '자신감 향상']
            }
          ] : []
        }
      ];

      // Filter by active status
      let categories = includeInactive ? staticCategories : staticCategories.filter(cat => cat.isActive);

      // Filter by specific category
      if (categoryFilter) {
        categories = categories.filter(cat => 
          cat.id === categoryFilter || 
          cat.subcategories.includes(categoryFilter)
        );
      }

      logger.info('Retrieved categories from static data', { 
        count: categories.length, 
        includeInactive, 
        withServiceTypes,
        categoryFilter 
      });

      // Cache the result for 1 hour (3600 seconds)
      await cacheService.set(cacheKey, categories, { ttl: 3600, prefix: 'categories' });
      logger.info('Categories cached successfully', { cacheKey });

      return categories;

    } catch (error) {
      logger.error('Error getting categories', { error });
      throw new Error('Failed to retrieve categories');
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: string, withServiceTypes: boolean = true): Promise<CategoryMetadata | null> {
    try {
      const { data: category, error } = await this.supabase
        .from('shop_categories')
        .select(`
          id,
          display_name,
          description,
          icon,
          color,
          subcategories,
          is_active,
          sort_order
        `)
        .eq('id', categoryId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.warn('Category not found', { categoryId });
          return null;
        }
        logger.error('Database error getting category by ID', { error, categoryId });
        throw new Error('Failed to retrieve category from database');
      }

      if (!category) {
        logger.warn('Category not found', { categoryId });
        return null;
      }

      const serviceTypes = withServiceTypes 
        ? await this.getServiceTypesForCategory(categoryId)
        : [];

      const formattedCategory: CategoryMetadata = {
        id: category.id,
        displayName: category.display_name,
        description: category.description,
        icon: category.icon || '',
        color: category.color || '',
        subcategories: category.subcategories || [],
        isActive: category.is_active,
        sortOrder: category.sort_order,
        serviceTypes
      };

      logger.info('Retrieved category by ID from database', { categoryId, withServiceTypes });
      return formattedCategory;

    } catch (error) {
      logger.error('Error getting category by ID', { error, categoryId });
      throw new Error('Failed to retrieve category');
    }
  }

  /**
   * Get service types for a specific category
   */
  async getServiceTypesForCategory(categoryId: string): Promise<ServiceTypeInfo[]> {
    try {
      const { data: serviceTypes, error } = await this.supabase
        .from('service_types')
        .select(`
          id,
          name,
          description,
          price_range,
          duration_minutes,
          is_popular,
          requirements,
          benefits,
          is_active,
          sort_order
        `)
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        logger.error('Database error getting service types for category', { error, categoryId });
        throw new Error('Failed to retrieve service types from database');
      }

      if (!serviceTypes) {
        return [];
      }

      // Convert database format to service format
      const formattedServiceTypes: ServiceTypeInfo[] = serviceTypes.map(st => ({
        id: st.id,
        name: st.name,
        description: st.description,
        priceRange: {
          min: st.price_range.min,
          max: st.price_range.max
        },
        durationMinutes: st.duration_minutes,
        isPopular: st.is_popular,
        requirements: st.requirements || [],
        benefits: st.benefits || []
      }));
      
      logger.info('Retrieved service types for category from database', { categoryId, count: formattedServiceTypes.length });
      return formattedServiceTypes;

    } catch (error) {
      logger.error('Error getting service types for category', { error, categoryId });
      throw new Error('Failed to retrieve service types');
    }
  }

  /**
   * Search categories and services
   */
  async searchCategories(query: string, limit: number = 10): Promise<CategorySearchResult[]> {
    try {
      // Create cache key for search results
      const cacheKey = `search:${query.toLowerCase()}:${limit}`;
      
      // Try to get from cache first
      const cachedResult = await cacheService.get<CategorySearchResult[]>(cacheKey);
      if (cachedResult) {
        logger.info('Search results retrieved from cache', { cacheKey, query });
        return cachedResult;
      }

      const categories = await this.getAllCategories({ withServiceTypes: true });
      const results: CategorySearchResult[] = [];
      const searchQuery = query.toLowerCase();

      // English to Korean keyword mapping for better search
      const keywordMap: { [key: string]: string[] } = {
        'nail': ['네일', 'nail'],
        'eyelash': ['속눈썹', 'eyelash'],
        'waxing': ['왁싱', 'waxing'],
        'eyebrow': ['눈썹', 'eyebrow'],
        'tattoo': ['문신', 'tattoo'],
        'hair': ['헤어', 'hair'],
        'beauty': ['뷰티', 'beauty'],
        'spa': ['스파', 'spa'],
        'massage': ['마사지', 'massage']
      };

      // Get expanded search terms
      const searchTerms = [searchQuery];
      for (const [english, koreanTerms] of Object.entries(keywordMap)) {
        if (searchQuery.includes(english)) {
          searchTerms.push(...koreanTerms);
        }
        if (koreanTerms.some(term => searchQuery.includes(term))) {
          searchTerms.push(english);
        }
      }

      for (const category of categories) {
        // Search in category name and description
        const categoryMatches = searchTerms.some(term => 
          category.displayName.toLowerCase().includes(term.toLowerCase()) || 
          category.description.toLowerCase().includes(term.toLowerCase()) ||
          category.id.toLowerCase().includes(term.toLowerCase())
        );

        if (categoryMatches) {
          results.push({
            category,
            serviceTypes: category.serviceTypes,
            matchType: 'category'
          });
        }

        // Search in service types
        for (const serviceType of category.serviceTypes) {
          const serviceMatches = searchTerms.some(term =>
            serviceType.name.toLowerCase().includes(term.toLowerCase()) || 
            serviceType.description.toLowerCase().includes(term.toLowerCase()) ||
            serviceType.id.toLowerCase().includes(term.toLowerCase())
          );

          if (serviceMatches) {
            results.push({
              category,
              serviceTypes: [serviceType],
              matchType: 'service'
            });
          }
        }
      }

      // Remove duplicates and limit results
      const uniqueResults = results.slice(0, limit);
      
      // Cache the search results for 30 minutes (1800 seconds)
      await cacheService.set(cacheKey, uniqueResults, { ttl: 1800, prefix: 'search' });
      logger.info('Search results cached successfully', { cacheKey, query });
      
      logger.info('Category search completed', { query, resultsCount: uniqueResults.length });
      return uniqueResults;

    } catch (error) {
      logger.error('Error searching categories', { error, query });
      throw new Error('Failed to search categories');
    }
  }

  /**
   * Get popular services across all categories
   */
  async getPopularServices(limit: number = 10): Promise<PopularService[]> {
    try {
      const categories = await this.getAllCategories({ withServiceTypes: true });
      const popularServices: PopularService[] = [];

      for (const category of categories) {
        const popularInCategory = category.serviceTypes
          .filter(service => service.isPopular)
          .map(service => ({
            ...service,
            categoryId: category.id
          }));
        
        popularServices.push(...popularInCategory);
      }

      // Sort by popularity (you could add more sophisticated sorting logic)
      popularServices.sort((a, b) => {
        // Sort by price range (lower prices first for popular services)
        return a.priceRange.min - b.priceRange.min;
      });

      const limitedResults = popularServices.slice(0, limit);
      
      logger.info('Retrieved popular services', { count: limitedResults.length, limit });
      return limitedResults;

    } catch (error) {
      logger.error('Error getting popular services', { error, limit });
      throw new Error('Failed to retrieve popular services');
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<CategoryStats> {
    try {
      // Use the database function for statistics
      const { data: stats, error } = await this.supabase.rpc('get_category_statistics');

      if (error) {
        logger.error('Database error getting category statistics', { error });
        throw new Error('Failed to retrieve category statistics from database');
      }

      if (!stats || stats.length === 0) {
        return {
          totalCategories: 0,
          activeCategories: 0,
          totalServices: 0,
          popularServices: 0,
          categoryBreakdown: []
        };
      }

      const stat = stats[0];
      const formattedStats: CategoryStats = {
        totalCategories: Number(stat.total_categories),
        activeCategories: Number(stat.active_categories),
        totalServices: Number(stat.total_services),
        popularServices: Number(stat.popular_services),
        categoryBreakdown: stat.average_price_per_category || []
      };

      logger.info('Retrieved category statistics from database', { stats: formattedStats });
      return formattedStats;

    } catch (error) {
      logger.error('Error getting category statistics', { error });
      throw new Error('Failed to retrieve category statistics');
    }
  }

  /**
   * Get category hierarchy
   */
  async getCategoryHierarchy(): Promise<CategoryMetadata[]> {
    try {
      // Use the database function for hierarchy
      const { data: hierarchy, error } = await this.supabase.rpc('get_category_hierarchy');

      if (error) {
        logger.error('Database error getting category hierarchy', { error });
        throw new Error('Failed to retrieve category hierarchy from database');
      }

      if (!hierarchy) {
        return [];
      }

      // Convert database format to service format
      const formattedHierarchy: CategoryMetadata[] = hierarchy.map((item: any) => ({
        id: item.category_id,
        displayName: item.display_name,
        description: '', // Not included in hierarchy function
        icon: '', // Not included in hierarchy function
        color: '', // Not included in hierarchy function
        subcategories: [], // Not included in hierarchy function
        isActive: true, // Only active categories are returned
        sortOrder: item.sort_order,
        serviceTypes: [] // Not included in hierarchy function
      }));
      
      logger.info('Retrieved category hierarchy from database', { count: formattedHierarchy.length });
      return formattedHierarchy;

    } catch (error) {
      logger.error('Error getting category hierarchy', { error });
      throw new Error('Failed to retrieve category hierarchy');
    }
  }
}

export const shopCategoriesService = new ShopCategoriesService();
