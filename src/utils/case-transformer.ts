/**
 * Case Transformation Utility
 *
 * Provides automatic transformation between snake_case (database) and camelCase (frontend)
 * for consistent API responses while maintaining database naming conventions.
 *
 * @module case-transformer
 */

/**
 * Convert snake_case string to camelCase
 * @example snakeToCamel('user_id') => 'userId'
 * @example snakeToCamel('reservation_date') => 'reservationDate'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 * @example camelToSnake('userId') => 'user_id'
 * @example camelToSnake('reservationDate') => 'reservation_date'
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Check if a value is a plain object (not Array, Date, null, etc.)
 */
function isPlainObject(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Fields that should be excluded from transformation
 * These are already in the correct format or should not be transformed
 */
const EXCLUDED_FIELDS = new Set([
  'id',
  'email',
  'phone',
  'name',
  'address',
  'description',
  'notes',
  'reason',
  'message',
  'error',
  'success',
  'data',
  'status',
  'code',
]);

/**
 * Transform object keys from snake_case to camelCase recursively
 *
 * @param obj - Object with snake_case keys
 * @returns New object with camelCase keys
 *
 * @example
 * transformKeysToCamel({
 *   user_id: '123',
 *   reservation_date: '2025-01-01',
 *   shop_services: [{ service_name: 'Haircut' }]
 * })
 * // Returns:
 * // {
 * //   userId: '123',
 * //   reservationDate: '2025-01-01',
 * //   shopServices: [{ serviceName: 'Haircut' }]
 * // }
 */
export function transformKeysToCamel<T = any>(obj: any): T {
  // Handle null, undefined, or non-object values
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays - transform each element
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToCamel(item)) as any;
  }

  // Handle plain objects - transform keys recursively
  if (isPlainObject(obj)) {
    const transformed: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Transform the key unless it's excluded
      const transformedKey = EXCLUDED_FIELDS.has(key) ? key : snakeToCamel(key);

      // Recursively transform the value
      transformed[transformedKey] = transformKeysToCamel(value);
    }

    return transformed;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Transform object keys from camelCase to snake_case recursively
 * Used for request bodies that need to match database schema
 *
 * @param obj - Object with camelCase keys
 * @returns New object with snake_case keys
 *
 * @example
 * transformKeysToSnake({
 *   userId: '123',
 *   reservationDate: '2025-01-01',
 *   shopServices: [{ serviceName: 'Haircut' }]
 * })
 * // Returns:
 * // {
 * //   user_id: '123',
 * //   reservation_date: '2025-01-01',
 * //   shop_services: [{ service_name: 'Haircut' }]
 * // }
 */
export function transformKeysToSnake<T = any>(obj: any): T {
  // Handle null, undefined, or non-object values
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays - transform each element
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToSnake(item)) as any;
  }

  // Handle plain objects - transform keys recursively
  if (isPlainObject(obj)) {
    const transformed: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Transform the key unless it's excluded
      const transformedKey = EXCLUDED_FIELDS.has(key) ? key : camelToSnake(key);

      // Recursively transform the value
      transformed[transformedKey] = transformKeysToSnake(value);
    }

    return transformed;
  }

  // Return primitive values as-is
  return obj;
}

/**
 * Transform API response data to camelCase
 * This is the main function to be used in controllers/response formatter
 *
 * @param data - Response data with snake_case keys
 * @returns Transformed data with camelCase keys
 *
 * @example
 * transformResponse({
 *   success: true,
 *   data: {
 *     reservations: [{ user_id: '123', shop_id: '456' }],
 *     pagination: { total_count: 100, current_page: 1 }
 *   }
 * })
 */
export function transformResponse<T = any>(data: any): T {
  return transformKeysToCamel<T>(data);
}

/**
 * Transform request body to snake_case
 * This is the main function to be used for incoming request validation
 *
 * @param data - Request body with camelCase keys
 * @returns Transformed data with snake_case keys
 */
export function transformRequest<T = any>(data: any): T {
  return transformKeysToSnake<T>(data);
}

/**
 * Middleware to automatically transform request bodies from camelCase to snake_case
 * Apply this before validation middleware to ensure request data matches database schema
 */
export function transformRequestMiddleware(req: any, res: any, next: any) {
  if (req.body && Object.keys(req.body).length > 0) {
    req.body = transformKeysToSnake(req.body);
  }

  if (req.query && Object.keys(req.query).length > 0) {
    req.query = transformKeysToSnake(req.query);
  }

  next();
}

/**
 * Middleware to automatically transform ALL JSON responses from snake_case to camelCase
 * This intercepts res.json() calls and transforms the data before sending
 *
 * Apply this middleware EARLY in the middleware chain to catch all responses
 */
export function transformResponseMiddleware(req: any, res: any, next: any) {
  // Store original res.json method
  const originalJson = res.json.bind(res);

  // Override res.json to transform data before sending
  res.json = function (data: any) {
    // Transform the data from snake_case to camelCase
    const transformedData = transformKeysToCamel(data);

    // Call original json method with transformed data
    return originalJson(transformedData);
  };

  next();
}
