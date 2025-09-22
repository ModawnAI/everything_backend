// Mock Firebase Admin SDK for testing
export const mockFirebaseAdmin = {
  apps: [], // Empty array to simulate no initialized apps
  initializeApp: jest.fn().mockReturnValue({
    auth: jest.fn(),
    messaging: jest.fn()
  }),
  credential: {
    applicationDefault: jest.fn().mockReturnValue({}),
    cert: jest.fn().mockReturnValue({})
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-user-id',
      email: 'test@example.com'
    }),
    createCustomToken: jest.fn().mockResolvedValue('test-custom-token'),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn().mockResolvedValue({
      uid: 'test-user-id',
      email: 'test@example.com'
    }),
    createUser: jest.fn().mockResolvedValue({
      uid: 'new-user-id',
      email: 'new@example.com'
    }),
    updateUser: jest.fn().mockResolvedValue({
      uid: 'updated-user-id',
      email: 'updated@example.com'
    }),
    deleteUser: jest.fn().mockResolvedValue(undefined)
  })),
  messaging: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    }),
    sendMulticast: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    }),
    sendToDevice: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    }),
    sendToDeviceGroup: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    }),
    sendToTopic: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    }),
    sendToCondition: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    }),
    subscribeToTopic: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0
    }),
    unsubscribeFromTopic: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0
    })
  }))
};

// Mock the entire firebase-admin module
jest.mock('firebase-admin', () => mockFirebaseAdmin);
