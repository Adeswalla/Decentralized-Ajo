import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  projects: [
    // UI / component tests — browser-like environment
    {
      displayName: 'ui',
      testMatch: ['<rootDir>/components/**/*.test.[jt]s?(x)', '<rootDir>/app/**/*.test.[jt]s?(x)'],
      transform: {
        '^.+\\.[tj]sx?$': [
          'ts-jest',
          {
            tsconfig: {
              jsx: 'react-jsx',
              module: 'CommonJS',
              moduleResolution: 'node',
              esModuleInterop: true,
            },
          },
        ],
      },
      testEnvironment: 'jest-environment-jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
        '^.+\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      clearMocks: true,
    },
    // Accessibility tests — browser-like environment
    {
      displayName: 'accessibility',
      testMatch: ['<rootDir>/__tests__/accessibility/**/*.test.[jt]s?(x)'],
      transform: { '^.+\\.[tj]sx?$': 'ts-jest' },
      testEnvironment: 'jest-environment-jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
        '^.+\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      clearMocks: true,
    },
    // API integration tests — Node environment (no DOM needed)
    {
      displayName: 'api',
      testMatch: ['<rootDir>/__tests__/api/**/*.test.[jt]s'],
      transform: {
        '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/__tests__/tsconfig.json' }],
      },
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/__tests__/api/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      moduleFileExtensions: ['ts', 'js', 'json', 'node'],
      clearMocks: true,
    },
    // Real-DB Integration tests
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/__tests__/api/integration/**/*.test.[jt]s'],
      transform: {
        '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/__tests__/tsconfig.json' }],
      },
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/__tests__/api/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      moduleFileExtensions: ['ts', 'js', 'json', 'node'],
      clearMocks: false, // Don't clear mocks automatically so we can control them
    },
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/.next/', '/contracts/'],
}

export default config
