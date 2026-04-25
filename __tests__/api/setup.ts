/**
 * Global setup for API integration tests.
 * Resets all mocks between tests and sets required env vars.
 */

// Ensure JWT_SECRET is stable across tests
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.NODE_ENV = 'test';

beforeEach(() => {
  jest.clearAllMocks();
});
