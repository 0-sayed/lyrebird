import { Controller, Get, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTestingModule } from './testing-module.util';

@Injectable()
class TestService {
  getValue(): string {
    return 'test-value';
  }
}

@Controller()
class TestController {
  constructor(private readonly testService: TestService) {}

  @Get()
  getValue(): string {
    return this.testService.getValue();
  }
}

describe('createTestingModule', () => {
  describe('basic module creation', () => {
    it('should create a test module builder', () => {
      const builder = createTestingModule({
        controllers: [TestController],
        providers: [TestService],
      });

      expect(builder).toBeDefined();
      expect(typeof builder.compile).toBe('function');
    });

    it('should compile to a valid testing module', async () => {
      const builder = createTestingModule({
        controllers: [TestController],
        providers: [TestService],
      });

      const module = await builder.compile();

      const controller = module.get<TestController>(TestController);
      expect(controller).toBeDefined();
      expect(controller.getValue()).toBe('test-value');

      await module.close();
    });
  });

  describe('with compile: true', () => {
    it('should return compiled module and mocks', async () => {
      const result = await createTestingModule({
        controllers: [TestController],
        providers: [TestService],
        compile: true,
      });

      expect(result.module).toBeDefined();
      expect(result.mocks).toBeDefined();
      expect(result.mocks.rabbitmq).toBeDefined();
      expect(result.mocks.database).toBeDefined();
      expect(result.mocks.jobsRepository).toBeDefined();
      expect(result.mocks.configService).toBeDefined();

      await result.module.close();
    });
  });

  describe('default providers', () => {
    it('should include ConfigService by default', async () => {
      const builder = createTestingModule({
        providers: [TestService],
        includeDefaults: true,
      });

      const module = await builder.compile();

      const configService = module.get<ConfigService>(ConfigService);
      expect(configService).toBeDefined();
      expect(typeof configService.get).toBe('function');

      await module.close();
    });

    it('should not include defaults when includeDefaults is false', async () => {
      const builder = createTestingModule({
        providers: [TestService],
        includeDefaults: false,
      });

      const module = await builder.compile();

      expect(() => module.get<ConfigService>(ConfigService)).toThrow();

      await module.close();
    });
  });

  describe('config overrides', () => {
    it('should use config overrides when provided', async () => {
      const builder = createTestingModule({
        providers: [TestService],
        configOverrides: {
          JETSTREAM_MAX_DURATION_MS: 60000,
          DATABASE_HOST: 'test-host',
        },
      });

      const module = await builder.compile();

      const configService = module.get<ConfigService>(ConfigService);
      expect(configService.get('JETSTREAM_MAX_DURATION_MS')).toBe(60000);
      expect(configService.get('DATABASE_HOST')).toBe('test-host');

      await module.close();
    });

    it('should return default value for non-overridden keys', async () => {
      const builder = createTestingModule({
        providers: [TestService],
        configOverrides: {
          CUSTOM_KEY: 'custom-value',
        },
      });

      const module = await builder.compile();

      const configService = module.get<ConfigService>(ConfigService);
      expect(configService.get('MISSING_KEY', 'default')).toBe('default');
      expect(configService.get('CUSTOM_KEY', 'default')).toBe('custom-value');

      await module.close();
    });
  });
});
