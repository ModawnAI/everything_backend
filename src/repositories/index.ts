// Repositories barrel export
// Export all repositories here for clean imports

// Base repository
export { BaseRepository } from './base.repository';

// Unified authentication repositories
export { SessionRepository } from './session.repository';
export { LoginAttemptRepository } from './login-attempt.repository';
export { AccountSecurityRepository } from './account-security.repository';
export { SecurityLogRepository } from './security-log.repository';

// Example future repositories:
// export { UserRepository } from './user.repository';
// export { ShopRepository } from './shop.repository';
// export { ReservationRepository } from './reservation.repository';
// export { PaymentRepository } from './payment.repository';
// export { PointRepository } from './point.repository';
