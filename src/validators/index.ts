// Validators barrel export
// Export all validation schemas here for clean imports

// User profile validators
export * from './user-profile.validators';

// Social authentication validators
export * from './social-auth.validators';

// Feed validators
export * from './feed.validators';

// Security validators
export * from './security.validators';

// Express validator schemas
export { 
  validateProfileUpdate,
  validateProfileQuery,
  handleValidationErrors as handleUserProfileValidationErrors
} from './user-profile.express-validator';

// User settings validators
export { 
  validateSettingsField as validateUserSettingsField
} from './user-settings.validators';
export { 
  validateUserSettingsUpdate,
  validateBulkSettingsUpdate as validateUserSettingsBulkUpdate,
  handleValidationErrors as handleUserSettingsValidationErrors
} from './user-settings.express-validator';
