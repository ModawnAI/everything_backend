/**
 * Comprehensive Supabase mock for reservation system testing
 * Based on the actual database schema
 */

import { jest } from '@jest/globals';

// Mock data based on schema
const mockReservationData = {
  id: 'test-reservation-id',
  user_id: 'test-user-id',
  shop_id: 'test-shop-id',
  reservation_date: '2024-12-25',
  reservation_time: '14:00:00',
  reservation_datetime: '2024-12-25T14:00:00Z',
  status: 'requested',
  total_amount: 50000,
  deposit_amount: 10000,
  remaining_amount: 40000,
  points_used: 0,
  points_earned: 0,
  special_requests: 'Test request',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z'
};

const mockShopData = {
  id: 'test-shop-id',
  name: 'Test Beauty Shop',
  address: 'Test Address',
  latitude: 37.5665,
  longitude: 126.9780,
  shop_status: 'active',
  verification_status: 'verified',
  main_category: 'beauty',
  operating_hours: {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false }
  }
};

const mockServiceData = {
  id: 'test-service-id',
  shop_id: 'test-shop-id',
  name: 'Test Service',
  description: 'Test service description',
  category: 'hair',
  price_min: 30000,
  price_max: 50000,
  duration_minutes: 60,
  deposit_amount: 10000,
  deposit_percentage: 20,
  is_available: true
};

const mockUserData = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  phone_number: '+821012345678',
  user_status: 'active',
  total_points: 1000,
  available_points: 1000
};

/**
 * Creates a mock query builder that handles reservation system operations
 */
export const createReservationSupabaseMock = () => {
  const createQueryMock = (tableName?: string) => {
    const queryMock = {
      // Selection methods
      select: jest.fn().mockReturnThis(),
      
      // Insert/Update/Delete methods
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      
      // Filter methods
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      rangeGt: jest.fn().mockReturnThis(),
      rangeGte: jest.fn().mockReturnThis(),
      rangeLt: jest.fn().mockReturnThis(),
      rangeLte: jest.fn().mockReturnThis(),
      rangeAdjacent: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      textSearch: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      
      // Ordering and limiting
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      
      // Execution methods
      single: jest.fn().mockImplementation(() => {
        let data = null;
        
        switch (tableName) {
          case 'reservations':
            data = mockReservationData;
            break;
          case 'shops':
            data = mockShopData;
            break;
          case 'shop_services':
            data = mockServiceData;
            break;
          case 'users':
            data = mockUserData;
            break;
          default:
            data = {};
        }
        
        return Promise.resolve({ data, error: null });
      }),
      
      maybeSingle: jest.fn().mockImplementation(() => {
        let data = null;
        
        switch (tableName) {
          case 'reservations':
            data = mockReservationData;
            break;
          case 'shops':
            data = mockShopData;
            break;
          case 'shop_services':
            data = mockServiceData;
            break;
          case 'users':
            data = mockUserData;
            break;
          default:
            data = {};
        }
        
        return Promise.resolve({ data, error: null });
      }),
      
      // Promise-like methods for async operations
      then: jest.fn().mockImplementation((onResolve) => {
        const result = { data: [], error: null };
        return Promise.resolve(result).then(onResolve);
      }),
      
      catch: jest.fn().mockImplementation((onReject) => {
        const result = { data: [], error: null };
        return Promise.resolve(result).catch(onReject);
      })
    };
    
    // Make all methods return the query mock for chaining
    Object.keys(queryMock).forEach(key => {
      if (typeof queryMock[key] === 'function' && 
          !['single', 'maybeSingle', 'then', 'catch'].includes(key)) {
        queryMock[key] = jest.fn().mockReturnValue(queryMock);
      }
    });
    
    return queryMock;
  };

  const supabaseMock = {
    from: jest.fn().mockImplementation((tableName: string) => {
      return createQueryMock(tableName);
    }),
    
    rpc: jest.fn().mockImplementation((functionName: string, params?: any) => {
      let mockResult = { data: null, error: null };
      
      switch (functionName) {
        case 'create_reservation_with_lock':
          mockResult.data = { 
            reservation_id: 'new-reservation-id',
            success: true 
          };
          break;
        case 'reschedule_reservation':
          mockResult.data = { 
            success: true,
            reservation: { ...mockReservationData, id: 'rescheduled-reservation-id' }
          };
          break;
        case 'check_time_slot_availability':
          mockResult.data = { available: true };
          break;
        case 'get_available_time_slots':
          mockResult.data = [
            { date: '2024-12-25', time: '10:00', available: true },
            { date: '2024-12-25', time: '11:00', available: true },
            { date: '2024-12-25', time: '14:00', available: false }
          ];
          break;
        default:
          mockResult.data = {};
      }
      
      return Promise.resolve(mockResult);
    }),
    
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: mockUserData },
        error: null
      }),
      signUp: jest.fn().mockResolvedValue({
        data: { user: mockUserData },
        error: null
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: mockUserData },
        error: null
      }),
      signOut: jest.fn().mockResolvedValue({
        error: null
      }),
      updateUser: jest.fn().mockResolvedValue({
        data: { user: mockUserData },
        error: null
      })
    },
    
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'test-path' },
          error: null
        }),
        download: jest.fn().mockResolvedValue({
          data: new Blob(),
          error: null
        }),
        remove: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://test.com/image.jpg' }
        })
      })
    }
  };

  return supabaseMock;
};

// Create and export the default mock
export const mockReservationSupabase = createReservationSupabaseMock();

// Mock the database module for reservation tests
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockReservationSupabase),
}));

export default mockReservationSupabase;
