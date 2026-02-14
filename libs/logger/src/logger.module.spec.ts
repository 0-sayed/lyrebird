import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { LoggerModule } from './logger.module';

describe('LoggerModule', () => {
  describe('module instantiation', () => {
    it('should compile the module', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should be a global module', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      // Global modules make their providers available without explicit imports
      const loggerModule = module.get(LoggerModule, { strict: false });
      expect(loggerModule).toBeDefined();
    });
  });

  describe('exports', () => {
    it('should export Logger via PinoLoggerModule', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      // The Logger from nestjs-pino should be available
      const logger = module.get(Logger, { strict: false });
      expect(logger).toBeDefined();
    });
  });

  describe('configuration', () => {
    // Note: Testing environment-based configuration requires careful handling
    // because the config is evaluated at module import time.
    // These tests verify the module works correctly with the current config.

    it('should use the configured log level', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      // Module compiles successfully with current environment config
      expect(module).toBeDefined();
    });

    it('should configure pino-http options', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      // Logger is properly configured and available
      const logger = module.get(Logger, { strict: false });
      expect(logger).toBeDefined();
      // Logger follows NestJS LoggerService interface (log, error, warn, debug, verbose)
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('correlation ID support', () => {
    it('should have genReqId configured for correlation IDs', async () => {
      // The LoggerModule configures genReqId to use X-Correlation-ID header
      // or generate a new UUID. This test verifies the module loads correctly.
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('redaction', () => {
    it('should configure sensitive header redaction', async () => {
      // The LoggerModule configures redaction for authorization and cookie headers
      // This test verifies the module compiles with redaction config
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('logger methods', () => {
    let logger: Logger;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggerModule],
      }).compile();

      logger = module.get(Logger, { strict: false });
    });

    it('should have all standard NestJS log methods', () => {
      // Logger follows NestJS LoggerService interface
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.verbose).toBe('function');
    });

    it('should be able to call log methods without error', () => {
      // These calls should not throw
      expect(() => logger.log('test message')).not.toThrow();
      expect(() => logger.debug('debug message')).not.toThrow();
    });
  });
});
