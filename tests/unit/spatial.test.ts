import {
  validateCoordinates,
  createPointGeometry,
  calculateDistance,
  findNearbyShops,
  getShopsInBounds,
  updateShopLocation,
  validatePostGISInstallation,
  convertDistance,
  DEFAULT_SRID,
  type Coordinates,
  type NearbyShopsParams
} from '../../src/utils/spatial';

// Mock database
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockNot = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockLimit = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Spatial Utilities Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock chain
    mockLimit.mockReturnValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ error: null });
    mockLte.mockReturnValue({ 
      gte: mockGte,
      lte: mockLte,
      data: [],
      error: null
    });
    mockGte.mockReturnValue({ 
      lte: mockLte,
      data: [],
      error: null
    });
    mockNot.mockReturnValue({ 
      not: mockNot,
      gte: mockGte,
      eq: mockEq,
      data: [],
      error: null
    });
    mockEq.mockReturnValue({ 
      not: mockNot,
      eq: mockEq,
      update: mockUpdate,
      data: [],
      error: null
    });
    mockSelect.mockReturnValue({ 
      eq: mockEq,
      not: mockNot,
      limit: mockLimit,
      data: [],
      error: null
    });
    mockFrom.mockReturnValue({ 
      select: mockSelect,
      update: mockUpdate
    });
  });

  describe('validateCoordinates', () => {
    test('should validate correct coordinates', () => {
      const validCoords: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
      expect(validateCoordinates(validCoords)).toBe(true);
    });

    test('should reject coordinates with invalid latitude', () => {
      const invalidCoords: Coordinates = { latitude: 91, longitude: -122.4194 };
      expect(validateCoordinates(invalidCoords)).toBe(false);
    });

    test('should reject coordinates with invalid longitude', () => {
      const invalidCoords: Coordinates = { latitude: 37.7749, longitude: 181 };
      expect(validateCoordinates(invalidCoords)).toBe(false);
    });

    test('should reject non-numeric coordinates', () => {
      const invalidCoords = { latitude: 'invalid' as any, longitude: -122.4194 };
      expect(validateCoordinates(invalidCoords)).toBe(false);
    });

    test('should reject NaN coordinates', () => {
      const invalidCoords: Coordinates = { latitude: NaN, longitude: -122.4194 };
      expect(validateCoordinates(invalidCoords)).toBe(false);
    });

    test('should reject Infinity coordinates', () => {
      const invalidCoords: Coordinates = { latitude: Infinity, longitude: -122.4194 };
      expect(validateCoordinates(invalidCoords)).toBe(false);
    });
  });

  describe('createPointGeometry', () => {
    test('should create valid PostGIS point geometry', () => {
      const coords: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
      const result = createPointGeometry(coords);
      
      expect(result).toBe(`ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), ${DEFAULT_SRID})`);
    });

    test('should throw error for invalid coordinates', () => {
      const invalidCoords: Coordinates = { latitude: 91, longitude: -122.4194 };
      
      expect(() => createPointGeometry(invalidCoords)).toThrow('Invalid coordinates provided');
    });
  });

  describe('calculateDistance', () => {
    test('should calculate distance between two points', async () => {
      const point1: Coordinates = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      const point2: Coordinates = { latitude: 34.0522, longitude: -118.2437 }; // Los Angeles
      
      const distance = await calculateDistance(point1, point2);
      
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1000); // Should be roughly 559 km
    });

    test('should return distance for same point as 0', async () => {
      const point: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
      
      const distance = await calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });

    test('should handle invalid coordinates', async () => {
      const validPoint: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
      const invalidPoint: Coordinates = { latitude: 91, longitude: -122.4194 };
      
      const distance = await calculateDistance(validPoint, invalidPoint);
      
      expect(distance).toBeNull();
    });
  });

  describe('findNearbyShops', () => {
    test('should find nearby shops successfully', async () => {
      const mockShops = [
        {
          id: '1',
          name: 'Test Shop 1',
          address: '123 Test St',
          latitude: 37.7749,
          longitude: -122.4194,
          shop_type: 'partnered',
          shop_status: 'active',
          main_category: 'nail',
          is_featured: true
        },
        {
          id: '2',
          name: 'Test Shop 2',
          address: '456 Test Ave',
          latitude: 37.7750,
          longitude: -122.4195,
          shop_type: 'non_partnered',
          shop_status: 'active',
          main_category: 'eyelash',
          is_featured: false
        }
      ];

      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              data: mockShops,
              error: null
            })
          })
        })
      });

      const params: NearbyShopsParams = {
        userLocation: { latitude: 37.7749, longitude: -122.4194 },
        radiusKm: 5
      };

      const result = await findNearbyShops(params);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('distance_km');
      expect(result[0]).toHaveProperty('distance_m');
    });

    test('should handle invalid user location', async () => {
      const params: NearbyShopsParams = {
        userLocation: { latitude: 91, longitude: -122.4194 },
        radiusKm: 5
      };

      const result = await findNearbyShops(params);

      expect(result).toEqual([]);
    });

    test('should handle invalid radius', async () => {
      const params: NearbyShopsParams = {
        userLocation: { latitude: 37.7749, longitude: -122.4194 },
        radiusKm: 150 // Too large
      };

      const result = await findNearbyShops(params);

      expect(result).toEqual([]);
    });
  });

  describe('getShopsInBounds', () => {
    test('should get shops within bounding box', async () => {
      const mockShops = [
        {
          id: '1',
          name: 'Test Shop 1',
          address: '123 Test St',
          latitude: 37.7749,
          longitude: -122.4194,
          shop_type: 'partnered',
          shop_status: 'active',
          main_category: 'nail',
          is_featured: true
        }
      ];

      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  gte: jest.fn().mockReturnValue({
                    lte: jest.fn().mockReturnValue({
                      data: mockShops,
                      error: null
                    })
                  })
                })
              })
            })
          })
        })
      });

      const northEast: Coordinates = { latitude: 37.8, longitude: -122.4 };
      const southWest: Coordinates = { latitude: 37.7, longitude: -122.5 };

      const result = await getShopsInBounds(northEast, southWest);

      expect(result).toHaveLength(1);
      expect(result[0].distance_km).toBe(0);
      expect(result[0].distance_m).toBe(0);
    });

    test('should handle invalid bounding box coordinates', async () => {
      const northEast: Coordinates = { latitude: 91, longitude: -122.4 };
      const southWest: Coordinates = { latitude: 37.7, longitude: -122.5 };

      const result = await getShopsInBounds(northEast, southWest);

      expect(result).toEqual([]);
    });
  });

  describe('updateShopLocation', () => {
    test('should update shop location successfully', async () => {
      // Mock the full chain: from().update().eq()
      const mockEqReturn = { error: null };
      const mockUpdateChain = {
        eq: jest.fn().mockReturnValue(mockEqReturn)
      };
      mockUpdate.mockReturnValue(mockUpdateChain);

      const coords: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
      const result = await updateShopLocation('shop-id', coords);

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: coords.latitude,
          longitude: coords.longitude,
          location: `POINT(${coords.longitude} ${coords.latitude})`,
        })
      );
      expect(mockUpdateChain.eq).toHaveBeenCalledWith('id', 'shop-id');
    });

    test('should handle invalid coordinates', async () => {
      const invalidCoords: Coordinates = { latitude: 91, longitude: -122.4194 };
      const result = await updateShopLocation('shop-id', invalidCoords);

      expect(result).toBe(false);
    });

    test('should handle database error', async () => {
      const mockEqReturn = { error: { message: 'Database error' } };
      const mockUpdateChain = {
        eq: jest.fn().mockReturnValue(mockEqReturn)
      };
      mockUpdate.mockReturnValue(mockUpdateChain);

      const coords: Coordinates = { latitude: 37.7749, longitude: -122.4194 };
      const result = await updateShopLocation('shop-id', coords);

      expect(result).toBe(false);
    });
  });

  describe('validatePostGISInstallation', () => {
    test('should validate database connectivity successfully', async () => {
      mockLimit.mockReturnValue({ data: [], error: null });

      const result = await validatePostGISInstallation();

      expect(result).toBe(true);
    });

    test('should handle database connection error', async () => {
      mockLimit.mockReturnValue({ data: null, error: { message: 'Connection failed' } });

      const result = await validatePostGISInstallation();

      expect(result).toBe(false);
    });
  });

  describe('convertDistance', () => {
    test('should convert kilometers to meters', () => {
      const result = convertDistance(5, 'km', 'm');
      expect(result).toBe(5000);
    });

    test('should convert meters to kilometers', () => {
      const result = convertDistance(5000, 'm', 'km');
      expect(result).toBe(5);
    });

    test('should convert kilometers to miles', () => {
      const result = convertDistance(1, 'km', 'mi');
      expect(result).toBeCloseTo(0.621371, 5);
    });

    test('should convert miles to kilometers', () => {
      const result = convertDistance(1, 'mi', 'km');
      expect(result).toBeCloseTo(1.609344, 5);
    });

    test('should return same value for same unit', () => {
      const result = convertDistance(100, 'km', 'km');
      expect(result).toBe(100);
    });

    test('should throw error for unknown source unit', () => {
      expect(() => convertDistance(100, 'invalid' as any, 'km')).toThrow('Unknown distance unit: invalid');
    });

    test('should throw error for unknown target unit', () => {
      expect(() => convertDistance(100, 'km', 'invalid' as any)).toThrow('Unknown distance unit: invalid');
    });
  });
}); 