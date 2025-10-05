/**
 * API Endpoints Configuration
 * Maps all backend and frontend API endpoints for testing
 */

export const BACKEND_ENDPOINTS = {
  // Authentication
  auth: {
    socialLogin: '/api/auth/social-login',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    sendVerification: '/api/auth/send-verification-code',
    verifyPhone: '/api/auth/verify-phone'
  },

  // Admin Authentication
  admin: {
    auth: {
      login: '/api/admin/auth/login',
      logout: '/api/admin/auth/logout',
      refresh: '/api/admin/auth/refresh',
      validate: '/api/admin/auth/validate',
      profile: '/api/admin/auth/profile',
      changePassword: '/api/admin/auth/change-password'
    },
    shops: {
      list: '/api/admin/shops',
      get: (id: string) => `/api/admin/shops/${id}`,
      approve: (id: string) => `/api/admin/shops/${id}/approve`,
      reject: (id: string) => `/api/admin/shops/${id}/reject`,
      search: '/api/admin/shops/search'
    },
    users: {
      list: '/api/admin/users',
      get: (id: string) => `/api/admin/users/${id}`,
      ban: (id: string) => `/api/admin/users/${id}/ban`,
      restore: (id: string) => `/api/admin/users/${id}/restore`,
      updateRole: (id: string) => `/api/admin/users/${id}/role`
    },
    reservations: {
      list: '/api/admin/reservations',
      get: (id: string) => `/api/admin/reservations/${id}`,
      cancel: (id: string) => `/api/admin/reservations/${id}/cancel`
    },
    analytics: {
      dashboard: '/api/admin/analytics/dashboard',
      revenue: '/api/admin/analytics/revenue',
      users: '/api/admin/analytics/users',
      shops: '/api/admin/analytics/shops'
    },
    payments: {
      list: '/api/admin/payments',
      reconciliation: '/api/admin/payments/reconciliation',
      refund: (id: string) => `/api/admin/payments/${id}/refund`
    }
  },

  // User APIs
  shops: {
    list: '/api/shops',
    get: (id: string) => `/api/shops/${id}`,
    search: '/api/shops/search',
    favorites: '/api/favorites'
  },

  reservations: {
    create: '/api/reservations',
    list: '/api/reservations',
    get: (id: string) => `/api/reservations/${id}`,
    cancel: (id: string) => `/api/reservations/${id}/cancel`,
    reschedule: (id: string) => `/api/reservations/${id}/reschedule`
  },

  payments: {
    create: '/api/payments',
    verify: (id: string) => `/api/payments/${id}/verify`,
    webhook: '/api/webhooks/toss'
  },

  points: {
    balance: '/api/points/balance',
    history: '/api/points/history',
    earn: '/api/points/earn',
    spend: '/api/points/spend'
  },

  referral: {
    code: '/api/referral-codes',
    validate: '/api/referral-codes/validate',
    earnings: '/api/referral-earnings',
    analytics: '/api/referral-analytics'
  },

  // Health and monitoring
  health: '/health',
  monitoring: {
    dashboard: '/api/monitoring/dashboard',
    metrics: '/api/monitoring/metrics'
  }
};

export const ADMIN_FRONTEND_ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  users: '/dashboard/users',
  shops: '/dashboard/system/shops',
  reservations: '/dashboard/orders',  // Maps to orders page
  analytics: '/dashboard/analytics',
  settings: '/dashboard/settings'
};

export const TEST_CREDENTIALS = {
  superAdmin: {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@ebeautything.com',
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || 'super123'
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@ebeautything.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin123!@#'
  },
  manager: {
    email: 'manager@ebeautything.com',
    password: 'manager123'
  }
};

export const API_HEADERS = {
  default: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withAuth: (token: string) => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`
  })
};

export const EXPECTED_RESPONSE_FORMATS = {
  success: {
    success: true,
    data: {},
    message: ''
  },
  error: {
    success: false,
    error: {
      code: '',
      message: '',
      details: {}
    }
  },
  paginated: {
    success: true,
    data: {
      items: [],
      pagination: {
        page: 1,
        perPage: 10,
        total: 0,
        totalPages: 0
      }
    }
  }
};
