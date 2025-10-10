# Admin Edit System - Validation Rules & Error Handling Guide

## Overview
This document provides comprehensive validation rules, error handling patterns, and implementation guidelines for the admin edit system.

## Table of Contents
1. [Validation Architecture](#validation-architecture)
2. [User Edit Validation](#user-edit-validation)
3. [Service Edit Validation](#service-edit-validation)
4. [Reservation Edit Validation](#reservation-edit-validation)
5. [Bulk Operations Validation](#bulk-operations-validation)
6. [Error Response Patterns](#error-response-patterns)
7. [Frontend Validation Implementation](#frontend-validation-implementation)
8. [Security Considerations](#security-considerations)

## Validation Architecture

### Multi-Layer Validation
```typescript
// 1. Express Validator (Request Level)
export const validateUserEdit = [
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone('ko-KR'),
  // ... field validations
];

// 2. Business Logic Validation (Service Level)
export class UserEditService {
  async validateBusinessRules(userId: string, data: UserEditRequest): Promise<ValidationResult> {
    const conflicts = await this.checkConflicts(data);
    const permissions = await this.checkPermissions(userId);
    return { isValid: conflicts.length === 0, errors: conflicts };
  }
}

// 3. Database Constraints (Data Level)
// Handled by Supabase with proper error mapping
```

### Validation Response Format
```typescript
interface ValidationError {
  field: string;
  code: string;
  message: string;
  details?: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}
```

## User Edit Validation

### Required Fields
```typescript
const userRequiredFields = {
  email: {
    required: true,
    type: 'email',
    maxLength: 255,
    unique: true
  },
  phone: {
    required: true,
    type: 'phone',
    format: 'ko-KR',
    unique: true
  },
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50
  },
  birth_date: {
    required: false,
    type: 'date',
    min: '1900-01-01',
    max: 'today-13years' // Minimum age 13
  }
};
```

### Business Rules Validation
```typescript
export const userBusinessRules = {
  emailUniqueness: async (email: string, currentUserId: string) => {
    const existing = await User.findByEmail(email);
    if (existing && existing.id !== currentUserId) {
      return {
        field: 'email',
        code: 'EMAIL_ALREADY_EXISTS',
        message: '이미 사용 중인 이메일입니다.'
      };
    }
  },

  phoneUniqueness: async (phone: string, currentUserId: string) => {
    const existing = await User.findByPhone(phone);
    if (existing && existing.id !== currentUserId) {
      return {
        field: 'phone',
        code: 'PHONE_ALREADY_EXISTS',
        message: '이미 사용 중인 전화번호입니다.'
      };
    }
  },

  rolePermissions: async (role: UserRole, adminId: string) => {
    const admin = await User.findById(adminId);
    if (role === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return {
        field: 'role',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: '슈퍼 관리자만 슈퍼 관리자 권한을 부여할 수 있습니다.'
      };
    }
  },

  reservationConflicts: async (userId: string, isActive: boolean) => {
    if (!isActive) {
      const activeReservations = await Reservation.findActiveByUserId(userId);
      if (activeReservations.length > 0) {
        return {
          field: 'is_active',
          code: 'HAS_ACTIVE_RESERVATIONS',
          message: '활성 예약이 있는 사용자는 비활성화할 수 없습니다.',
          details: { reservationCount: activeReservations.length }
        };
      }
    }
  }
};
```

## Service Edit Validation

### Service Field Validation
```typescript
const serviceValidationRules = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[가-힣a-zA-Z0-9\s\-_]+$/
  },
  price: {
    required: true,
    type: 'number',
    min: 1000,
    max: 1000000,
    multipleOf: 1000 // Price must be in thousands
  },
  duration: {
    required: true,
    type: 'number',
    min: 15,
    max: 480,
    multipleOf: 15 // Duration in 15-minute increments
  },
  category_id: {
    required: true,
    type: 'uuid',
    exists: 'categories.id'
  },
  shop_id: {
    required: true,
    type: 'uuid',
    exists: 'shops.id',
    permission: 'admin_can_manage_shop'
  }
};
```

### Service Business Rules
```typescript
export const serviceBusinessRules = {
  categoryCompatibility: async (categoryId: string, shopId: string) => {
    const category = await Category.findById(categoryId);
    const shop = await Shop.findById(shopId);

    if (!category.shop_ids.includes(shopId)) {
      return {
        field: 'category_id',
        code: 'CATEGORY_SHOP_MISMATCH',
        message: '선택한 카테고리는 해당 샵에서 사용할 수 없습니다.'
      };
    }
  },

  priceReasonableness: async (price: number, categoryId: string) => {
    const avgPrice = await Service.getAveragePriceByCategory(categoryId);
    const deviation = Math.abs(price - avgPrice) / avgPrice;

    if (deviation > 0.5) { // 50% deviation warning
      return {
        field: 'price',
        code: 'PRICE_DEVIATION_WARNING',
        message: `카테고리 평균 가격(${avgPrice.toLocaleString()}원)과 차이가 큽니다.`,
        severity: 'warning'
      };
    }
  },

  activeReservationImpact: async (serviceId: string, isActive: boolean) => {
    if (!isActive) {
      const futureReservations = await Reservation.findFutureByServiceId(serviceId);
      if (futureReservations.length > 0) {
        return {
          field: 'is_active',
          code: 'HAS_FUTURE_RESERVATIONS',
          message: '향후 예약이 있는 서비스는 비활성화할 수 없습니다.',
          details: {
            reservationCount: futureReservations.length,
            nextReservationDate: futureReservations[0].reservation_date
          }
        };
      }
    }
  }
};
```

## Reservation Edit Validation

### Reservation Validation Rules
```typescript
const reservationValidationRules = {
  reservation_date: {
    required: true,
    type: 'datetime',
    min: 'now+1hour',
    businessHours: true,
    notHoliday: true
  },
  status: {
    required: true,
    enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    transition: 'validateStatusTransition'
  },
  total_price: {
    required: true,
    type: 'number',
    min: 0,
    max: 10000000,
    calculated: true // Must match service prices
  }
};
```

### Reservation Business Rules
```typescript
export const reservationBusinessRules = {
  statusTransition: async (currentStatus: string, newStatus: string, reservationDate: Date) => {
    const validTransitions: Record<string, string[]> = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': [],
      'NO_SHOW': []
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return {
        field: 'status',
        code: 'INVALID_STATUS_TRANSITION',
        message: `${currentStatus}에서 ${newStatus}로 변경할 수 없습니다.`
      };
    }

    // Time-based restrictions
    const now = new Date();
    const reservationTime = new Date(reservationDate);

    if (newStatus === 'IN_PROGRESS' && reservationTime > now) {
      return {
        field: 'status',
        code: 'CANNOT_START_FUTURE_RESERVATION',
        message: '예약 시간이 되지 않아 진행 중으로 변경할 수 없습니다.'
      };
    }
  },

  timeSlotAvailability: async (serviceId: string, newDate: Date, excludeReservationId: string) => {
    const service = await Service.findById(serviceId);
    const conflictingReservations = await Reservation.findConflicting(
      serviceId,
      newDate,
      service.duration,
      excludeReservationId
    );

    if (conflictingReservations.length > 0) {
      return {
        field: 'reservation_date',
        code: 'TIME_SLOT_CONFLICT',
        message: '선택한 시간에 이미 다른 예약이 있습니다.',
        details: { conflictingReservations }
      };
    }
  },

  priceCalculation: async (serviceIds: string[], reservationDate: Date) => {
    const services = await Service.findByIds(serviceIds);
    const expectedTotal = services.reduce((sum, service) => {
      const price = service.getDiscountedPrice(reservationDate);
      return sum + price;
    }, 0);

    return expectedTotal;
  }
};
```

## Bulk Operations Validation

### Bulk Edit Validation
```typescript
interface BulkEditValidation {
  maxBatchSize: 100;
  timeoutMs: 30000;
  rollbackOnError: true;

  validateBatch: async (operation: BulkEditOperation) => {
    // 1. Batch size validation
    if (operation.targetIds.length > maxBatchSize) {
      throw new ValidationError('BATCH_TOO_LARGE', `최대 ${maxBatchSize}개까지 일괄 수정 가능합니다.`);
    }

    // 2. Permission validation for all targets
    const permissionChecks = await Promise.all(
      operation.targetIds.map(id => checkEditPermission(operation.entityType, id, operation.adminId))
    );

    const deniedIds = permissionChecks
      .filter(check => !check.allowed)
      .map(check => check.entityId);

    if (deniedIds.length > 0) {
      throw new ValidationError('INSUFFICIENT_PERMISSIONS', '일부 항목에 대한 수정 권한이 없습니다.', {
        deniedIds
      });
    }

    // 3. Business rule validation
    const businessRuleResults = await Promise.all(
      operation.targetIds.map(id =>
        validateEntityBusinessRules(operation.entityType, id, operation.changes)
      )
    );

    const errors = businessRuleResults.filter(result => !result.isValid);
    if (errors.length > 0) {
      throw new ValidationError('BUSINESS_RULE_VIOLATIONS', '일괄 수정 중 비즈니스 규칙 위반이 발견되었습니다.', {
        violations: errors
      });
    }
  }
};
```

## Error Response Patterns

### Standard Error Response
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string; // For field-specific errors
    timestamp: string;
    requestId: string;
  };
  validationErrors?: ValidationError[]; // For multiple field errors
}
```

### Common Error Codes
```typescript
export const ERROR_CODES = {
  // Validation Errors (400)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',

  // Business Rule Errors (422)
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',

  // Permission Errors (403)
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',

  // Conflict Errors (409)
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',

  // Server Errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};
```

### Error Response Examples
```typescript
// Field validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력 값이 유효하지 않습니다.",
    "field": "email",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  },
  "validationErrors": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "올바른 이메일 형식이 아닙니다."
    }
  ]
}

// Business rule violation
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "이미 사용 중인 이메일입니다.",
    "field": "email",
    "details": {
      "conflictingUserId": "user_987654321"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}

// Bulk operation error
{
  "success": false,
  "error": {
    "code": "BULK_OPERATION_FAILED",
    "message": "일괄 수정 중 오류가 발생했습니다.",
    "details": {
      "processedCount": 45,
      "totalCount": 100,
      "failedIds": ["user_1", "user_5", "user_23"],
      "rollbackCompleted": true
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

## Frontend Validation Implementation

### Real-time Field Validation Hook
```typescript
interface UseFieldValidationOptions {
  debounceMs?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  serverValidation?: boolean;
}

export const useFieldValidation = (
  fieldName: string,
  value: any,
  rules: ValidationRule[],
  options: UseFieldValidationOptions = {}
) => {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const debouncedValidate = useMemo(
    () => debounce(async (val: any) => {
      setIsValidating(true);
      try {
        // Client-side validation
        const clientErrors = validateClientSide(val, rules);
        if (clientErrors.length > 0) {
          setError(clientErrors[0].message);
          setIsValid(false);
          return;
        }

        // Server-side validation if enabled
        if (options.serverValidation) {
          const serverValidation = await validateOnServer(fieldName, val);
          if (!serverValidation.isValid) {
            setError(serverValidation.error);
            setIsValid(false);
            return;
          }
        }

        setError(null);
        setIsValid(true);
      } catch (err) {
        setError('검증 중 오류가 발생했습니다.');
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }, options.debounceMs || 300),
    [fieldName, rules, options.serverValidation]
  );

  useEffect(() => {
    if (value && options.validateOnChange) {
      debouncedValidate(value);
    }
  }, [value, debouncedValidate, options.validateOnChange]);

  const validateOnBlur = useCallback(() => {
    if (options.validateOnBlur) {
      debouncedValidate(value);
    }
  }, [value, debouncedValidate, options.validateOnBlur]);

  return {
    isValidating,
    error,
    isValid,
    validateOnBlur,
    validate: () => debouncedValidate(value)
  };
};
```

### Form-level Validation
```typescript
export const useFormValidation = <T extends Record<string, any>>(
  initialData: T,
  validationSchema: ValidationSchema<T>
) => {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<keyof T, string>>({} as Record<keyof T, string>);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const validateField = useCallback(async (
    fieldName: keyof T,
    value: any
  ): Promise<ValidationResult> => {
    const fieldRules = validationSchema[fieldName];
    if (!fieldRules) return { isValid: true, errors: [] };

    const clientResult = validateClientSide(value, fieldRules.client || []);
    if (!clientResult.isValid) {
      return clientResult;
    }

    if (fieldRules.server) {
      return await validateOnServer(String(fieldName), value);
    }

    return { isValid: true, errors: [] };
  }, [validationSchema]);

  const validateForm = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    const validationPromises = Object.keys(data).map(async (key) => {
      const result = await validateField(key as keyof T, data[key]);
      return { field: key, result };
    });

    const results = await Promise.all(validationPromises);
    const newErrors: Record<keyof T, string> = {} as Record<keyof T, string>;
    let formIsValid = true;

    results.forEach(({ field, result }) => {
      if (!result.isValid && result.errors.length > 0) {
        newErrors[field as keyof T] = result.errors[0].message;
        formIsValid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(formIsValid);
    setIsValidating(false);

    return formIsValid;
  }, [data, validateField]);

  const setFieldValue = useCallback((fieldName: keyof T, value: any) => {
    setData(prev => ({ ...prev, [fieldName]: value }));

    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  }, [errors]);

  return {
    data,
    errors,
    isValidating,
    isValid,
    setFieldValue,
    validateField,
    validateForm,
    setData
  };
};
```

### Error Display Components
```typescript
interface FieldErrorProps {
  error?: string;
  warning?: string;
  isValidating?: boolean;
}

export const FieldError: React.FC<FieldErrorProps> = ({
  error,
  warning,
  isValidating
}) => {
  if (isValidating) {
    return (
      <div className="flex items-center text-gray-500 text-sm mt-1">
        <Spinner className="w-3 h-3 mr-1" />
        검증 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center text-red-600 text-sm mt-1">
        <AlertCircle className="w-4 h-4 mr-1" />
        {error}
      </div>
    );
  }

  if (warning) {
    return (
      <div className="flex items-center text-yellow-600 text-sm mt-1">
        <AlertTriangle className="w-4 h-4 mr-1" />
        {warning}
      </div>
    );
  }

  return null;
};

interface ValidationSummaryProps {
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  warnings = []
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-4 rounded-lg border">
      {errors.length > 0 && (
        <div className="mb-3">
          <h4 className="text-red-700 font-medium flex items-center mb-2">
            <AlertCircle className="w-4 h-4 mr-1" />
            입력 오류 ({errors.length}개)
          </h4>
          <ul className="text-red-600 text-sm space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h4 className="text-yellow-700 font-medium flex items-center mb-2">
            <AlertTriangle className="w-4 h-4 mr-1" />
            주의사항 ({warnings.length}개)
          </h4>
          <ul className="text-yellow-600 text-sm space-y-1">
            {warnings.map((warning, index) => (
              <li key={index}>• {warning.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

## Security Considerations

### Input Sanitization
```typescript
export const sanitizeInput = (input: any, type: string): any => {
  switch (type) {
    case 'string':
      return DOMPurify.sanitize(String(input));
    case 'email':
      return normalizeEmail(String(input));
    case 'phone':
      return input.replace(/[^\d-+()]/g, '');
    case 'number':
      return Number(input);
    case 'boolean':
      return Boolean(input);
    default:
      return input;
  }
};
```

### Permission Validation
```typescript
export const validateEditPermission = async (
  adminId: string,
  entityType: 'user' | 'service' | 'reservation',
  entityId: string,
  action: 'read' | 'update' | 'delete'
): Promise<PermissionResult> => {
  const admin = await User.findById(adminId);
  const entity = await getEntity(entityType, entityId);

  // Super admin can edit everything
  if (admin.role === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  // Shop admin can only edit entities in their shops
  if (admin.role === 'SHOP_ADMIN') {
    const adminShopIds = await getAdminShopIds(adminId);
    const entityShopId = getEntityShopId(entity);

    if (!adminShopIds.includes(entityShopId)) {
      return {
        allowed: false,
        reason: 'SHOP_ACCESS_DENIED',
        message: '다른 샵의 데이터는 수정할 수 없습니다.'
      };
    }
  }

  // Additional role-based checks
  return validateRoleBasedPermissions(admin.role, entityType, action);
};
```

### Audit Logging
```typescript
export const logEditAction = async (
  adminId: string,
  entityType: string,
  entityId: string,
  action: string,
  changes: Record<string, any>,
  result: 'success' | 'failure',
  error?: string
) => {
  await AuditLog.create({
    admin_id: adminId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    changes: sanitizeLogData(changes),
    result,
    error: error ? sanitizeLogData(error) : null,
    ip_address: getClientIP(),
    user_agent: getUserAgent(),
    timestamp: new Date()
  });
};

const sanitizeLogData = (data: any): any => {
  const sensitiveFields = ['password', 'token', 'secret', 'key'];

  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  return data;
};
```

This comprehensive validation guide provides the foundation for building a robust, secure, and user-friendly admin edit system with proper error handling and validation at all levels.