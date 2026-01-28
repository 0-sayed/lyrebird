import { Test, TestingModule as NestTestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createMockRabbitmqService } from '../mocks/rabbitmq.mock';
import { createMockDatabaseService } from '../mocks/database.mock';
import { createMockJobsRepository } from '../mocks/repositories.mock';
import { Logger, Type, Provider } from '@nestjs/common';

/**
 * Default mock providers commonly used across tests
 */
export const DEFAULT_MOCK_PROVIDERS = {
  configService: {
    get: jest
      .fn()
      .mockImplementation(
        (key: string, defaultValue?: unknown) => defaultValue,
      ),
  },
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  },
};

/**
 * Options for creating a testing module
 */
export interface CreateTestingModuleOptions {
  /** Controllers to include in the module */
  controllers?: Type[];
  /** Providers to include (use useValue, useClass, or useFactory) */
  providers?: Provider[];
  /** Whether to include default mock providers (ConfigService, Logger) */
  includeDefaults?: boolean;
  /** Custom ConfigService mock (merged with defaults if includeDefaults is true) */
  configOverrides?: Record<string, unknown>;
  /** Whether to compile the module immediately */
  compile?: boolean;
}

/**
 * Result of createTestingModule when compile is true
 */
export interface CompiledTestingModule {
  module: NestTestingModule;
  mocks: {
    rabbitmq: ReturnType<typeof createMockRabbitmqService>;
    database: ReturnType<typeof createMockDatabaseService>;
    jobsRepository: ReturnType<typeof createMockJobsRepository>;
    configService: typeof DEFAULT_MOCK_PROVIDERS.configService;
  };
}

/**
 * Creates a configured NestJS testing module with common mock providers.
 *
 * This utility reduces boilerplate in tests by providing sensible defaults
 * for common services while allowing full customization.
 *
 * @example
 * // Basic usage - returns test builder for further customization
 * const testBuilder = createTestingModule({
 *   controllers: [MyController],
 *   providers: [MyService],
 * });
 * const module = await testBuilder.compile();
 *
 * @example
 * // With compile: true - returns compiled module and mocks
 * const { module, mocks } = await createTestingModule({
 *   controllers: [MyController],
 *   providers: [MyService],
 *   compile: true,
 * });
 * expect(mocks.rabbitmq.emit).toHaveBeenCalled();
 *
 * @example
 * // With config overrides
 * const testBuilder = createTestingModule({
 *   providers: [MyService],
 *   configOverrides: {
 *     JETSTREAM_MAX_DURATION_MS: 60000,
 *     DATABASE_HOST: 'localhost',
 *   },
 * });
 */
export function createTestingModule(
  options: CreateTestingModuleOptions & { compile: true },
): Promise<CompiledTestingModule>;
export function createTestingModule(
  options: CreateTestingModuleOptions & { compile?: false },
): ReturnType<typeof Test.createTestingModule>;
export function createTestingModule(
  options: CreateTestingModuleOptions,
):
  | ReturnType<typeof Test.createTestingModule>
  | Promise<CompiledTestingModule> {
  const {
    controllers = [],
    providers = [],
    includeDefaults = true,
    configOverrides = {},
    compile = false,
  } = options;

  const mockRabbitmq = createMockRabbitmqService();
  const mockDatabase = createMockDatabaseService();
  const mockJobsRepository = createMockJobsRepository();

  // Create ConfigService mock with overrides
  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      if (key in configOverrides) {
        return configOverrides[key];
      }
      return defaultValue;
    }),
  };

  const defaultProviders: Provider[] = includeDefaults
    ? [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: Logger, useValue: DEFAULT_MOCK_PROVIDERS.logger },
      ]
    : [];

  const testBuilder = Test.createTestingModule({
    controllers,
    providers: [...defaultProviders, ...providers],
  });

  if (compile) {
    return testBuilder.compile().then((module) => ({
      module,
      mocks: {
        rabbitmq: mockRabbitmq,
        database: mockDatabase,
        jobsRepository: mockJobsRepository,
        configService: mockConfigService,
      },
    }));
  }

  return testBuilder;
}

/**
 * Helper type to get mock providers for assertions
 */
export type MockProviders = CompiledTestingModule['mocks'];
