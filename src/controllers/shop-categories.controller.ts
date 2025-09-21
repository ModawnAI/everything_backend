/**
 * Shop Categories Controller
 * 
 * Handles shop category-related operations including:
 * - Category listing and metadata
 * - Service catalog management
 * - Category validation and filtering
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { shopCategoriesService } from '../services/shop-categories.service';
import { ServiceCategory } from '../types/database.types';

// Category metadata interface
export interface CategoryMetadata {
  id: ServiceCategory;
  displayName: string;
  description: string;
  icon?: string;
  color?: string;
  subcategories?: ServiceCategory[];
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
  requirements?: string[];
  benefits?: string[];
}

// Request interfaces
interface CategoriesRequest extends Request {
  query: {
    includeInactive?: string;
    withServiceTypes?: string;
    category?: ServiceCategory;
  };
}

interface CategoryDetailsRequest extends Request {
  params: {
    categoryId: ServiceCategory;
  };
}

class ShopCategoriesController {
  // Static category metadata - in a real app, this could be stored in database
  private readonly categoryMetadata: Record<ServiceCategory, CategoryMetadata> = {
    nail: {
      id: 'nail',
      displayName: '네일',
      description: '네일 아트, 젤 네일, 매니큐어, 페디큐어 서비스',
      icon: '💅',
      color: '#FF6B9D',
      subcategories: [],
      isActive: true,
      sortOrder: 1,
      serviceTypes: [
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
        },
        {
          id: 'manicure',
          name: '매니큐어',
          description: '손톱 관리 및 기본 네일 케어',
          priceRange: { min: 15000, max: 40000 },
          durationMinutes: 60,
          isPopular: false,
          requirements: ['손톱 정리'],
          benefits: ['깔끔한 손톱 관리', '기본 케어']
        },
        {
          id: 'pedicure',
          name: '페디큐어',
          description: '발톱 관리 및 발 케어 서비스',
          priceRange: { min: 25000, max: 60000 },
          durationMinutes: 90,
          isPopular: false,
          requirements: ['발 상태 확인'],
          benefits: ['발 건강 관리', '깔끔한 발톱']
        }
      ]
    },
    eyelash: {
      id: 'eyelash',
      displayName: '속눈썹',
      description: '속눈썹 연장, 리프트, 펌 서비스',
      icon: '👁️',
      color: '#8B5CF6',
      subcategories: [],
      isActive: true,
      sortOrder: 2,
      serviceTypes: [
        {
          id: 'eyelash_extension',
          name: '속눈썹 연장',
          description: '인조 속눈썹을 이용한 연장 서비스',
          priceRange: { min: 50000, max: 150000 },
          durationMinutes: 120,
          isPopular: true,
          requirements: ['속눈썹 상태 확인', '알레르기 테스트'],
          benefits: ['자연스러운 연장', '오래 지속']
        },
        {
          id: 'eyelash_lift',
          name: '속눈썹 리프트',
          description: '자연 속눈썹을 위로 말아주는 서비스',
          priceRange: { min: 40000, max: 80000 },
          durationMinutes: 90,
          isPopular: true,
          requirements: ['속눈썹 길이 확인'],
          benefits: ['자연스러운 볼륨', '관리 편리']
        },
        {
          id: 'eyelash_perm',
          name: '속눈썹 펌',
          description: '속눈썹을 영구적으로 말아주는 서비스',
          priceRange: { min: 30000, max: 70000 },
          durationMinutes: 60,
          isPopular: false,
          requirements: ['속눈썹 상태 확인'],
          benefits: ['영구적 효과', '자연스러운 모양']
        }
      ]
    },
    waxing: {
      id: 'waxing',
      displayName: '왁싱',
      description: '털 제거 및 관리 서비스',
      icon: '🪶',
      color: '#F59E0B',
      subcategories: [],
      isActive: true,
      sortOrder: 3,
      serviceTypes: [
        {
          id: 'body_waxing',
          name: '바디 왁싱',
          description: '전신 털 제거 서비스',
          priceRange: { min: 30000, max: 150000 },
          durationMinutes: 60,
          isPopular: true,
          requirements: ['털 길이 확인', '피부 상태 체크'],
          benefits: ['깔끔한 피부', '장기 지속']
        },
        {
          id: 'facial_waxing',
          name: '페이셜 왁싱',
          description: '얼굴 털 제거 서비스',
          priceRange: { min: 15000, max: 50000 },
          durationMinutes: 30,
          isPopular: false,
          requirements: ['피부 민감도 확인'],
          benefits: ['깔끔한 얼굴', '부드러운 피부']
        },
        {
          id: 'bikini_waxing',
          name: '비키니 왁싱',
          description: '비키니 라인 털 제거 서비스',
          priceRange: { min: 25000, max: 80000 },
          durationMinutes: 45,
          isPopular: true,
          requirements: ['털 길이 확인', '피부 상태 체크'],
          benefits: ['깔끔한 라인', '자신감 향상']
        }
      ]
    },
    eyebrow_tattoo: {
      id: 'eyebrow_tattoo',
      displayName: '눈썹 문신',
      description: '반영구 눈썹 문신 및 관리 서비스',
      icon: '✏️',
      color: '#10B981',
      subcategories: [],
      isActive: true,
      sortOrder: 4,
      serviceTypes: [
        {
          id: 'eyebrow_tattoo_basic',
          name: '기본 눈썹 문신',
          description: '자연스러운 눈썹 라인 문신',
          priceRange: { min: 100000, max: 300000 },
          durationMinutes: 180,
          isPopular: true,
          requirements: ['피부 타입 확인', '알레르기 테스트'],
          benefits: ['자연스러운 눈썹', '장기 지속']
        },
        {
          id: 'eyebrow_tattoo_ombre',
          name: '옴브레 눈썹 문신',
          description: '그라데이션 효과의 눈썹 문신',
          priceRange: { min: 150000, max: 400000 },
          durationMinutes: 240,
          isPopular: true,
          requirements: ['피부 타입 확인', '알레르기 테스트'],
          benefits: ['자연스러운 그라데이션', '고급스러운 효과']
        },
        {
          id: 'eyebrow_tattoo_touchup',
          name: '눈썹 문신 터치업',
          description: '기존 문신의 색상 보정 및 보완',
          priceRange: { min: 50000, max: 150000 },
          durationMinutes: 120,
          isPopular: false,
          requirements: ['기존 문신 상태 확인'],
          benefits: ['색상 보정', '효과 연장']
        }
      ]
    },
    hair: {
      id: 'hair',
      displayName: '헤어',
      description: '헤어 스타일링, 컷, 컬러링 서비스',
      icon: '💇‍♀️',
      color: '#EF4444',
      subcategories: [],
      isActive: true,
      sortOrder: 5,
      serviceTypes: [
        {
          id: 'hair_cut',
          name: '헤어 컷',
          description: '다양한 스타일의 헤어 컷 서비스',
          priceRange: { min: 20000, max: 100000 },
          durationMinutes: 60,
          isPopular: true,
          requirements: ['헤어 상태 확인', '원하는 스타일 상담'],
          benefits: ['새로운 스타일', '자신감 향상']
        },
        {
          id: 'hair_color',
          name: '헤어 컬러',
          description: '다양한 색상의 헤어 컬러링',
          priceRange: { min: 50000, max: 200000 },
          durationMinutes: 180,
          isPopular: true,
          requirements: ['헤어 상태 확인', '알레르기 테스트'],
          benefits: ['새로운 색상', '개성 표현']
        },
        {
          id: 'hair_perm',
          name: '헤어 펌',
          description: '컬, 스트레이트 등 헤어 펌 서비스',
          priceRange: { min: 40000, max: 150000 },
          durationMinutes: 240,
          isPopular: false,
          requirements: ['헤어 상태 확인', '알레르기 테스트'],
          benefits: ['영구적 스타일', '관리 편리']
        },
        {
          id: 'hair_treatment',
          name: '헤어 트리트먼트',
          description: '헤어 케어 및 치료 서비스',
          priceRange: { min: 30000, max: 120000 },
          durationMinutes: 90,
          isPopular: false,
          requirements: ['헤어 상태 진단'],
          benefits: ['건강한 헤어', '손상 복구']
        }
      ]
    }
  };

  /**
   * Get all available service categories
   */
  async getCategories(req: CategoriesRequest, res: Response): Promise<void> {
    try {
      logger.info('Getting shop categories', { 
        includeInactive: req.query.includeInactive,
        withServiceTypes: req.query.withServiceTypes 
      });

      const includeInactive = req.query.includeInactive === 'true';
      const withServiceTypes = req.query.withServiceTypes !== 'false'; // Default to true unless explicitly false
      const categoryFilter = req.query.category as ServiceCategory;


      const categories = await shopCategoriesService.getAllCategories({
        includeInactive,
        withServiceTypes,
        categoryFilter
      });

      logger.info('Shop categories retrieved successfully', { 
        count: categories.length,
        withServiceTypes 
      });

      res.status(200).json({
        success: true,
        data: {
          categories,
          total: categories.length,
          metadata: {
            includeInactive,
            withServiceTypes,
            categoryFilter: categoryFilter || null
          }
        }
      });

    } catch (error) {
      logger.error('Error getting shop categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shop categories',
        message: 'An error occurred while fetching categories'
      });
    }
  }

  /**
   * Get specific category details
   */
  async getCategoryById(req: CategoryDetailsRequest, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const withServiceTypes = req.query.withServiceTypes === 'true';

      logger.info('Getting category details', { categoryId, withServiceTypes });

      const category = await shopCategoriesService.getCategoryById(categoryId, withServiceTypes);

      if (!category) {
        res.status(404).json({
          success: false,
          error: 'Category not found',
          message: `Category '${categoryId}' does not exist`
        });
        return;
      }

      logger.info('Category details retrieved successfully', { categoryId });

      res.status(200).json({
        success: true,
        data: {
          category
        }
      });

    } catch (error) {
      logger.error('Error getting category details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        categoryId: req.params.categoryId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve category details',
        message: 'An error occurred while fetching category information'
      });
    }
  }

  /**
   * Get service types for a specific category
   */
  async getServiceTypes(req: CategoryDetailsRequest, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;

      logger.info('Getting service types for category', { categoryId });

      const serviceTypes = await shopCategoriesService.getServiceTypesForCategory(categoryId);

      logger.info('Service types retrieved successfully', { 
        categoryId, 
        count: serviceTypes.length 
      });

      res.status(200).json({
        success: true,
        data: {
          categoryId,
          serviceTypes,
          total: serviceTypes.length
        }
      });

    } catch (error) {
      logger.error('Error getting service types', {
        error: error instanceof Error ? error.message : 'Unknown error',
        categoryId: req.params.categoryId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service types',
        message: 'An error occurred while fetching service types'
      });
    }
  }

  /**
   * Search categories and service types
   */
  async searchCategories(req: Request, res: Response): Promise<void> {
    try {
      const { q: searchQuery, limit } = req.query;

      if (!searchQuery || typeof searchQuery !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query required',
          message: 'Please provide a search query'
        });
        return;
      }

      const searchLimit = parseInt(limit as string) || 10;

      logger.info('Searching categories', { searchQuery, limit: searchLimit });

      const results = await shopCategoriesService.searchCategories(searchQuery, searchLimit);

      logger.info('Category search completed', { 
        searchQuery, 
        resultCount: results.length 
      });

      res.status(200).json({
        success: true,
        data: {
          query: searchQuery,
          results,
          total: results.length
        }
      });

    } catch (error) {
      logger.error('Error searching categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to search categories',
        message: 'An error occurred while searching'
      });
    }
  }

  /**
   * Get popular service types across all categories
   */
  async getPopularServices(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      logger.info('Getting popular services', { limit });

      const popularServices = await shopCategoriesService.getPopularServices(limit);

      logger.info('Popular services retrieved successfully', { 
        count: popularServices.length,
        limit 
      });

      res.status(200).json({
        success: true,
        data: {
          services: popularServices,
          total: popularServices.length,
          limit
        }
      });

    } catch (error) {
      logger.error('Error getting popular services', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve popular services',
        message: 'An error occurred while fetching popular services'
      });
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting category statistics');

      const stats = await shopCategoriesService.getCategoryStats();

      logger.info('Category statistics retrieved successfully');

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting category statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve category statistics',
        message: 'An error occurred while fetching category statistics'
      });
    }
  }

  /**
   * Get category hierarchy
   */
  async getCategoryHierarchy(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting category hierarchy');

      const hierarchy = await shopCategoriesService.getCategoryHierarchy();

      logger.info('Category hierarchy retrieved successfully', { 
        count: hierarchy.length 
      });

      res.status(200).json({
        success: true,
        data: {
          categories: hierarchy,
          total: hierarchy.length
        }
      });

    } catch (error) {
      logger.error('Error getting category hierarchy', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve category hierarchy',
        message: 'An error occurred while fetching category hierarchy'
      });
    }
  }
}

export const shopCategoriesController = new ShopCategoriesController();
