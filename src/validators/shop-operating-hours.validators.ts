/**
 * Shop Operating Hours Validation Schemas
 * 
 * Joi validation schemas for shop operating hours management endpoints
 */

import Joi from 'joi';

/**
 * Schema for a single day's operating hours
 */
const dayOperatingHoursSchema = Joi.object({
  open: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .when('closed', {
      is: true,
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.pattern.base': '시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요. (예: 09:00, 14:30)',
      'any.required': '영업 시작 시간은 필수입니다.'
    }),

  close: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .when('closed', {
      is: true,
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.pattern.base': '시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요. (예: 18:00, 22:30)',
      'any.required': '영업 종료 시간은 필수입니다.'
    }),

  closed: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': '휴무 여부는 true 또는 false여야 합니다.'
    }),

  break_start: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': '휴게 시작 시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요.'
    }),

  break_end: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': '휴게 종료 시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요.'
    })
})
.custom((value, helpers) => {
  // Skip validation if day is closed
  if (value.closed === true) {
    return value;
  }

  // Validate that both break times are provided together
  if ((value.break_start && !value.break_end) || (!value.break_start && value.break_end)) {
    return helpers.error('custom.breakTimesRequired', {
      message: '휴게 시간은 시작과 종료 시간을 모두 설정해야 합니다.'
    });
  }

  // Helper function to convert time to minutes
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Validate open/close time logic
  if (value.open && value.close) {
    const openMinutes = timeToMinutes(value.open);
    const closeMinutes = timeToMinutes(value.close);

    // Handle overnight hours (e.g., 22:00 - 02:00)
    if (closeMinutes <= openMinutes && closeMinutes < 12 * 60) {
      // This is likely overnight hours, which is valid
    } else if (closeMinutes <= openMinutes) {
      return helpers.error('custom.invalidTimeRange', {
        message: '종료 시간은 시작 시간보다 늦어야 합니다.'
      });
    }
  }

  // Validate break times
  if (value.break_start && value.break_end && value.open && value.close) {
    const breakStartMinutes = timeToMinutes(value.break_start);
    const breakEndMinutes = timeToMinutes(value.break_end);
    const openMinutes = timeToMinutes(value.open);
    const closeMinutes = timeToMinutes(value.close);

    // Break end must be after break start
    if (breakEndMinutes <= breakStartMinutes) {
      return helpers.error('custom.invalidBreakRange', {
        message: '휴게 종료 시간은 시작 시간보다 늦어야 합니다.'
      });
    }

    // Break times must be within operating hours (for regular hours only)
    if (closeMinutes > openMinutes) { // Not overnight hours
      if (breakStartMinutes < openMinutes || breakEndMinutes > closeMinutes) {
        return helpers.error('custom.breakOutsideOperatingHours', {
          message: '휴게 시간은 영업시간 내에 있어야 합니다.'
        });
      }
    }
  }

  return value;
})
.messages({
  'custom.breakTimesRequired': '{{#message}}',
  'custom.invalidTimeRange': '{{#message}}',
  'custom.invalidBreakRange': '{{#message}}',
  'custom.breakOutsideOperatingHours': '{{#message}}'
});

/**
 * Schema for weekly operating hours
 */
export const weeklyOperatingHoursSchema = Joi.object({
  monday: dayOperatingHoursSchema.optional(),
  tuesday: dayOperatingHoursSchema.optional(),
  wednesday: dayOperatingHoursSchema.optional(),
  thursday: dayOperatingHoursSchema.optional(),
  friday: dayOperatingHoursSchema.optional(),
  saturday: dayOperatingHoursSchema.optional(),
  sunday: dayOperatingHoursSchema.optional()
})
.min(1)
.messages({
  'object.min': '최소 하나의 요일에 대한 영업시간을 설정해주세요.'
});

/**
 * Schema for updating operating hours
 */
export const updateOperatingHoursSchema = Joi.object({
  operating_hours: weeklyOperatingHoursSchema.required().messages({
    'any.required': '영업시간 데이터는 필수입니다.',
    'object.base': '영업시간 데이터 형식이 올바르지 않습니다.'
  })
});

/**
 * Validation middleware for updating operating hours
 */
export const validateUpdateOperatingHours = (req: any, res: any, next: any) => {
  const { error, value } = updateOperatingHoursSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '영업시간 데이터가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.body = value;
  next();
};

/**
 * Additional business logic validation for operating hours
 * This provides more detailed validation beyond basic Joi schema validation
 */
export const validateOperatingHoursBusinessLogic = (operatingHours: Record<string, any>): Array<{ field: string; message: string }> => {
  const errors: Array<{ field: string; message: string }> = [];
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Helper function to convert time to minutes
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if at least one day is open
  const hasOpenDay = Object.entries(operatingHours).some(([day, hours]: [string, any]) => {
    return validDays.includes(day) && hours && hours.closed !== true && hours.open && hours.close;
  });

  if (!hasOpenDay) {
    errors.push({
      field: 'operating_hours',
      message: '최소 하나의 요일은 영업해야 합니다.'
    });
  }

  // Validate each day
  for (const [day, hours] of Object.entries(operatingHours)) {
    if (!validDays.includes(day)) {
      errors.push({
        field: day,
        message: `유효하지 않은 요일입니다: ${day}`
      });
      continue;
    }

    if (!hours || typeof hours !== 'object') {
      errors.push({
        field: day,
        message: `${day}의 영업시간 형식이 올바르지 않습니다.`
      });
      continue;
    }

    // Skip validation for closed days
    if (hours.closed === true) {
      continue;
    }

    const { open, close, break_start, break_end } = hours;

    // Validate required fields for open days
    if (!open || !close) {
      errors.push({
        field: `${day}.open`,
        message: `${day}의 영업 시작/종료 시간이 필요합니다.`
      });
      continue;
    }

    // Additional time validation
    try {
      const openMinutes = timeToMinutes(open);
      const closeMinutes = timeToMinutes(close);

      // Validate reasonable operating hours (not more than 24 hours)
      let operatingDuration: number;
      if (closeMinutes <= openMinutes && closeMinutes < 12 * 60) {
        // Overnight hours
        operatingDuration = (24 * 60 - openMinutes) + closeMinutes;
      } else {
        operatingDuration = closeMinutes - openMinutes;
      }

      if (operatingDuration > 18 * 60) { // More than 18 hours
        errors.push({
          field: `${day}.close`,
          message: `${day}의 영업시간이 너무 깁니다. 최대 18시간까지 가능합니다.`
        });
      }

      if (operatingDuration < 30) { // Less than 30 minutes
        errors.push({
          field: `${day}.close`,
          message: `${day}의 영업시간이 너무 짧습니다. 최소 30분 이상이어야 합니다.`
        });
      }

      // Validate break duration
      if (break_start && break_end) {
        const breakStartMinutes = timeToMinutes(break_start);
        const breakEndMinutes = timeToMinutes(break_end);
        const breakDuration = breakEndMinutes - breakStartMinutes;

        if (breakDuration > 3 * 60) { // More than 3 hours
          errors.push({
            field: `${day}.break_end`,
            message: `${day}의 휴게시간이 너무 깁니다. 최대 3시간까지 가능합니다.`
          });
        }

        if (breakDuration < 15) { // Less than 15 minutes
          errors.push({
            field: `${day}.break_end`,
            message: `${day}의 휴게시간이 너무 짧습니다. 최소 15분 이상이어야 합니다.`
          });
        }
      }

    } catch (error) {
      errors.push({
        field: `${day}.open`,
        message: `${day}의 시간 형식을 파싱할 수 없습니다.`
      });
    }
  }

  return errors;
};

/**
 * Comprehensive validation middleware that combines Joi validation with business logic
 */
export const validateOperatingHoursComprehensive = (req: any, res: any, next: any) => {
  // First, run Joi validation
  const { error, value } = updateOperatingHoursSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '영업시간 데이터가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  // Then, run business logic validation
  const businessLogicErrors = validateOperatingHoursBusinessLogic(value.operating_hours);
  if (businessLogicErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BUSINESS_LOGIC_ERROR',
        message: '영업시간 설정이 비즈니스 규칙에 맞지 않습니다.',
        details: businessLogicErrors
      }
    });
  }

  req.body = value;
  next();
};

/**
 * Utility function to validate a single time string
 */
export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Utility function to check if operating hours are valid for a specific day
 */
export const isValidDayOperatingHours = (dayHours: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!dayHours || typeof dayHours !== 'object') {
    return { valid: false, errors: ['영업시간 형식이 올바르지 않습니다.'] };
  }

  if (dayHours.closed === true) {
    return { valid: true, errors: [] };
  }

  if (!dayHours.open || !dayHours.close) {
    errors.push('영업 시작/종료 시간이 필요합니다.');
  }

  if (dayHours.open && !isValidTimeFormat(dayHours.open)) {
    errors.push('시작 시간 형식이 올바르지 않습니다.');
  }

  if (dayHours.close && !isValidTimeFormat(dayHours.close)) {
    errors.push('종료 시간 형식이 올바르지 않습니다.');
  }

  if (dayHours.break_start && !isValidTimeFormat(dayHours.break_start)) {
    errors.push('휴게 시작 시간 형식이 올바르지 않습니다.');
  }

  if (dayHours.break_end && !isValidTimeFormat(dayHours.break_end)) {
    errors.push('휴게 종료 시간 형식이 올바르지 않습니다.');
  }

  return { valid: errors.length === 0, errors };
};

