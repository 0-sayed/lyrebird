/**
 * @fileoverview Structured logging module using nestjs-pino.
 *
 * Provides production-grade JSON logging with automatic request context,
 * correlation ID tracking, and environment-based configuration.
 *
 * @example Basic usage in an app module:
 * ```typescript
 * import { LoggerModule } from '@app/logger';
 *
 * @Module({
 *   imports: [LoggerModule],
 * })
 * export class AppModule {}
 * ```
 *
 * @example Using the logger in main.ts bootstrap:
 * ```typescript
 * import { Logger } from 'nestjs-pino';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule, { bufferLogs: true });
 *   app.useLogger(app.get(Logger));
 *   await app.listen(3000);
 * }
 * ```
 *
 * @example Injecting PinoLogger in a service:
 * ```typescript
 * import { PinoLogger, InjectPinoLogger } from '@app/logger';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(
 *     @InjectPinoLogger(MyService.name)
 *     private readonly logger: PinoLogger,
 *   ) {}
 *
 *   doWork() {
 *     this.logger.info({ userId: 123 }, 'Processing user request');
 *   }
 * }
 * ```
 *
 * @module @app/logger
 */
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule, Params } from 'nestjs-pino';
import * as crypto from 'crypto';
import { CORRELATION_ID_HEADER } from '@app/shared-types';

/**
 * Creates logger configuration for nestjs-pino at runtime.
 *
 * This factory is called after ConfigModule loads .env values,
 * ensuring environment variables are properly resolved.
 *
 * Configuration options:
 * - `level`: Log level threshold (trace/debug/info/warn/error/fatal)
 *   - Default: 'debug' in development, 'info' in production
 *   - Override with LOG_LEVEL environment variable
 *
 * - `transport`: Log formatting
 *   - Production (NODE_ENV=production): JSON output for log aggregators
 *   - Development: Pretty-printed colorized output via pino-pretty
 *
 * - `genReqId`: Correlation ID extraction/generation for request tracing
 *
 * - `customProps`: Attaches correlationId to every log entry
 *
 * - `redact`: Removes sensitive headers from logs (authorization, cookie)
 *
 * - `serializers`: Slims down req/res to essential fields (method, url, statusCode)
 *
 * - `customAttributeKeys`: Renames responseTime to duration
 *
 * - `renameContext`: Maps NestJS 'context' to 'service' in log output
 */
function createLoggerConfig(configService: ConfigService): Params {
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const isTest = configService.get<string>('NODE_ENV') === 'test';
  const logLevel = configService.get<string>('LOG_LEVEL');

  return {
    pinoHttp: {
      level: logLevel || (isTest ? 'warn' : isProd ? 'info' : 'debug'),

      // JSON in production, no transport in test, pretty in development
      transport:
        isProd || isTest
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss.l',
                ignore: 'pid,hostname',
                singleLine: false,
              },
            },

      /**
       * Extract correlation ID from incoming request header or generate a new one.
       *
       * This runs in the pino-http middleware layer, before NestJS interceptors.
       * The generated req.id is reused by CorrelationIdInterceptor to ensure
       * logs, response headers, and downstream code all share one ID.
       *
       * @see apps/gateway/src/interceptors/correlation-id.interceptor.ts
       */
      genReqId: (req) =>
        req.headers[CORRELATION_ID_HEADER]?.toString() || crypto.randomUUID(),

      // Attach correlation ID to all logs
      customProps: (req) => ({
        correlationId: req.id,
      }),

      // Only log essential request/response fields — no headers, cookies, etc.
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },

      // Redact sensitive information (defense-in-depth if serializers change)
      redact: ['req.headers.authorization', 'req.headers.cookie'],

      // Rename responseTime for readability
      customAttributeKeys: {
        responseTime: 'duration',
      },
    },

    // Rename 'context' to 'service' in logs
    renameContext: 'service',
  };
}

/**
 * Global logging module providing structured JSON logging via nestjs-pino.
 *
 * Features:
 * - Automatic correlation ID tracking from X-Correlation-ID header
 * - JSON output in production, pretty-printed in development
 * - Sensitive header redaction (authorization, cookie)
 * - Configurable log level via LOG_LEVEL environment variable
 * - NestJS Logger compatibility (existing Logger usage continues to work)
 *
 * Environment Variables:
 * - `NODE_ENV`: Set to 'production' for JSON output
 * - `LOG_LEVEL`: Override default log level (trace/debug/info/warn/error/fatal)
 *
 * This module is marked as @Global, so it only needs to be imported once
 * in the root app module to make the logger available throughout the application.
 *
 * Note: Uses forRootAsync to ensure environment variables from .env files
 * are loaded by ConfigModule before logger configuration is created.
 *
 * @see https://github.com/iamolegga/nestjs-pino
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createLoggerConfig,
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
