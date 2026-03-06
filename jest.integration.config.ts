import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // ONLY run integration tests
  testRegex: '.*\\.integration\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/apps/dashboard/'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  // Run sequentially to avoid database conflicts
  maxWorkers: 1,
  // Longer timeout for DB operations
  testTimeout: 30000,
  roots: ['<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@app/rabbitmq(|/.*)$': '<rootDir>/libs/rabbitmq/src/$1',
    '^@app/shared-types(|/.*)$': '<rootDir>/libs/shared-types/src/$1',
    '^@app/bluesky(|/.*)$': '<rootDir>/libs/bluesky/src/$1',
    '^@app/testing(|/.*)$': '<rootDir>/libs/testing/src/$1',
    '^@app/logger(|/.*)$': '<rootDir>/libs/logger/src/$1',
  },
};

export default config;
