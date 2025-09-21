/**
 * Enhanced Service Catalog Types
 * 
 * This file contains enhanced types for the service catalog system,
 * extending the basic ShopService interface with additional metadata
 * and functionality for a comprehensive service catalog.
 */

import { ServiceCategory } from './database.types';

// =============================================
// ENHANCED SERVICE CATALOG TYPES
// =============================================

/**
 * Service Type Metadata
 * Detailed information about specific service types within a category
 */
export interface ServiceTypeMetadata {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  durationMinutes: number;
  isPopular: boolean;
  requirements: string[];
  benefits: string[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  preparationTime?: number; // minutes
  recoveryTime?: number; // minutes
  ageRestrictions?: {
    min?: number;
    max?: number;
  };
  genderRestrictions?: ('male' | 'female' | 'all')[];
  seasonalAvailability?: {
    startMonth: number; // 1-12
    endMonth: number; // 1-12
  }[];
  equipment?: string[];
  materials?: string[];
  certifications?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Enhanced Service Catalog Entry
 * Extends the basic ShopService with additional catalog metadata
 */
export interface ServiceCatalogEntry {
  // Basic service information (from ShopService)
  id: string;
  shop_id: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  price_min?: number;
  price_max?: number;
  duration_minutes?: number;
  deposit_amount?: number;
  deposit_percentage?: number;
  is_available: boolean;
  booking_advance_days: number;
  cancellation_hours: number;
  display_order: number;
  created_at: string;
  updated_at: string;

  // Enhanced catalog metadata
  service_type_id?: string; // References service_type_metadata(id)
  service_type_metadata?: ServiceTypeMetadata;
  
  // Pricing and availability
  pricing_model: 'fixed' | 'range' | 'custom';
  base_price?: number;
  price_variations?: ServicePriceVariation[];
  seasonal_pricing?: SeasonalPricing[];
  
  // Service details
  service_level: 'basic' | 'premium' | 'luxury';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration_range: {
    min: number;
    max: number;
  };
  
  // Requirements and restrictions
  requirements: ServiceRequirement[];
  restrictions: ServiceRestriction[];
  
  // Media and presentation
  images: ServiceImage[];
  videos?: ServiceVideo[];
  before_after_images?: BeforeAfterImage[];
  
  // Popularity and performance metrics
  popularity_score: number;
  booking_count: number;
  rating_average: number;
  rating_count: number;
  last_booked_at?: string;
  
  // SEO and discovery
  search_keywords: string[];
  tags: string[];
  featured: boolean;
  trending: boolean;
  
  // Business logic
  max_daily_bookings?: number;
  requires_consultation: boolean;
  consultation_duration?: number; // minutes
  follow_up_required: boolean;
  follow_up_days?: number;
  
  // Metadata for future expansion
  metadata: Record<string, any>;
}

/**
 * Service Price Variation
 * Different pricing options for the same service
 */
export interface ServicePriceVariation {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes?: number;
  is_popular: boolean;
  conditions?: string[];
  availability?: {
    days_of_week?: number[]; // 0-6 (Sunday-Saturday)
    time_slots?: string[]; // "09:00-12:00", "14:00-18:00"
    date_range?: {
      start: string;
      end: string;
    };
  };
}

/**
 * Seasonal Pricing
 * Special pricing for different seasons or periods
 */
export interface SeasonalPricing {
  id: string;
  name: string;
  price_multiplier: number; // 1.0 = normal price, 1.2 = 20% increase
  start_date: string;
  end_date: string;
  conditions?: string[];
  is_active: boolean;
}

/**
 * Service Requirement
 * Requirements that customers must meet for this service
 */
export interface ServiceRequirement {
  id: string;
  type: 'age' | 'gender' | 'health' | 'preparation' | 'consultation' | 'document' | 'other';
  title: string;
  description: string;
  is_mandatory: boolean;
  validation_type?: 'number' | 'boolean' | 'text' | 'file' | 'date';
  validation_rules?: Record<string, any>;
  error_message?: string;
}

/**
 * Service Restriction
 * Restrictions that limit when or how the service can be booked
 */
export interface ServiceRestriction {
  id: string;
  type: 'time' | 'day' | 'age' | 'gender' | 'health' | 'booking_window' | 'capacity' | 'other';
  title: string;
  description: string;
  is_active: boolean;
  restriction_data: Record<string, any>;
}

/**
 * Service Image
 * Enhanced image information for services
 */
export interface ServiceImage {
  id: string;
  service_id: string;
  image_url: string;
  alt_text?: string;
  caption?: string;
  display_order: number;
  image_type: 'gallery' | 'before_after' | 'process' | 'result' | 'equipment';
  is_primary: boolean;
  metadata?: {
    width?: number;
    height?: number;
    file_size?: number;
    format?: string;
  };
  created_at: string;
}

/**
 * Service Video
 * Video content for services
 */
export interface ServiceVideo {
  id: string;
  service_id: string;
  video_url: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  duration_seconds?: number;
  display_order: number;
  video_type: 'process' | 'result' | 'tutorial' | 'testimonial';
  is_primary: boolean;
  created_at: string;
}

/**
 * Before/After Image
 * Specialized image type for showing service results
 */
export interface BeforeAfterImage {
  id: string;
  service_id: string;
  before_image_url: string;
  after_image_url: string;
  caption?: string;
  display_order: number;
  is_verified: boolean; // Whether this is verified by the shop
  created_at: string;
}

/**
 * Service Catalog Filter Options
 * Options for filtering and searching services
 */
export interface ServiceCatalogFilter {
  categories?: ServiceCategory[];
  price_range?: {
    min: number;
    max: number;
  };
  duration_range?: {
    min: number;
    max: number;
  };
  service_levels?: ('basic' | 'premium' | 'luxury')[];
  difficulty_levels?: ('beginner' | 'intermediate' | 'advanced')[];
  availability?: {
    date?: string;
    time_slots?: string[];
  };
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  tags?: string[];
  keywords?: string[];
  featured_only?: boolean;
  trending_only?: boolean;
  min_rating?: number;
  max_distance_km?: number;
}

/**
 * Service Catalog Search Result
 * Result structure for service catalog searches
 */
export interface ServiceCatalogSearchResult {
  services: ServiceCatalogEntry[];
  total_count: number;
  page: number;
  limit: number;
  has_more: boolean;
  filters_applied: ServiceCatalogFilter;
  search_metadata: {
    search_time_ms: number;
    search_query?: string;
    suggestions?: string[];
  };
}

/**
 * Service Catalog Statistics
 * Statistics about the service catalog
 */
export interface ServiceCatalogStats {
  total_services: number;
  services_by_category: Record<ServiceCategory, number>;
  services_by_level: Record<string, number>;
  average_price_by_category: Record<ServiceCategory, number>;
  most_popular_services: ServiceCatalogEntry[];
  trending_services: ServiceCatalogEntry[];
  recently_added: ServiceCatalogEntry[];
  total_bookings: number;
  average_rating: number;
  last_updated: string;
}

/**
 * Service Catalog Configuration
 * Configuration for the service catalog system
 */
export interface ServiceCatalogConfig {
  enable_advanced_search: boolean;
  enable_price_ranges: boolean;
  enable_seasonal_pricing: boolean;
  enable_service_requirements: boolean;
  enable_media_gallery: boolean;
  enable_before_after_images: boolean;
  enable_rating_system: boolean;
  enable_trending_services: boolean;
  max_images_per_service: number;
  max_videos_per_service: number;
  default_search_radius_km: number;
  max_search_radius_km: number;
  cache_duration_minutes: number;
  featured_services_limit: number;
  trending_services_limit: number;
}

// =============================================
// REQUEST/RESPONSE TYPES
// =============================================

/**
 * Create Service Catalog Entry Request
 */
export interface CreateServiceCatalogEntryRequest {
  shop_id: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  service_type_id?: string;
  pricing_model: 'fixed' | 'range' | 'custom';
  base_price?: number;
  price_min?: number;
  price_max?: number;
  duration_minutes: number;
  service_level: 'basic' | 'premium' | 'luxury';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  requirements?: Omit<ServiceRequirement, 'id'>[];
  restrictions?: Omit<ServiceRestriction, 'id'>[];
  search_keywords?: string[];
  tags?: string[];
  requires_consultation?: boolean;
  consultation_duration?: number;
  follow_up_required?: boolean;
  follow_up_days?: number;
  metadata?: Record<string, any>;
}

/**
 * Update Service Catalog Entry Request
 */
export interface UpdateServiceCatalogEntryRequest {
  name?: string;
  description?: string;
  category?: ServiceCategory;
  service_type_id?: string;
  pricing_model?: 'fixed' | 'range' | 'custom';
  base_price?: number;
  price_min?: number;
  price_max?: number;
  duration_minutes?: number;
  service_level?: 'basic' | 'premium' | 'luxury';
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  is_available?: boolean;
  booking_advance_days?: number;
  cancellation_hours?: number;
  display_order?: number;
  requirements?: Omit<ServiceRequirement, 'id'>[];
  restrictions?: Omit<ServiceRestriction, 'id'>[];
  search_keywords?: string[];
  tags?: string[];
  requires_consultation?: boolean;
  consultation_duration?: number;
  follow_up_required?: boolean;
  follow_up_days?: number;
  metadata?: Record<string, any>;
}

/**
 * Service Catalog Search Request
 */
export interface ServiceCatalogSearchRequest {
  query?: string;
  filters?: ServiceCatalogFilter;
  page?: number;
  limit?: number;
  sort_by?: 'price' | 'duration' | 'rating' | 'popularity' | 'distance' | 'newest';
  sort_order?: 'asc' | 'desc';
  include_unavailable?: boolean;
}

// =============================================
// UTILITY TYPES
// =============================================

/**
 * Service Catalog Entry Summary
 * Lightweight version for lists and search results
 */
export type ServiceCatalogEntrySummary = Pick<
  ServiceCatalogEntry,
  | 'id'
  | 'shop_id'
  | 'name'
  | 'description'
  | 'category'
  | 'price_min'
  | 'price_max'
  | 'duration_minutes'
  | 'service_level'
  | 'difficulty_level'
  | 'is_available'
  | 'popularity_score'
  | 'rating_average'
  | 'rating_count'
  | 'featured'
  | 'trending'
  | 'tags'
  | 'images'
  | 'created_at'
  | 'updated_at'
>;

/**
 * Service Type Metadata Summary
 * Lightweight version for category listings
 */
export type ServiceTypeMetadataSummary = Pick<
  ServiceTypeMetadata,
  | 'id'
  | 'name'
  | 'description'
  | 'category'
  | 'priceRange'
  | 'durationMinutes'
  | 'isPopular'
  | 'difficulty'
  | 'tags'
  | 'created_at'
>;
