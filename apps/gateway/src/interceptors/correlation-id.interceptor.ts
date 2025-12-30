import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate or use existing correlation ID
    const correlationIdHeader = request.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(correlationIdHeader)
        ? correlationIdHeader[0]
        : correlationIdHeader) || uuidv4();

    // Add to request for downstream use
    request.correlationId = correlationId;

    // Check if this is an SSE endpoint by Accept header
    const acceptHeader = request.headers['accept'];
    const isSSE = Array.isArray(acceptHeader)
      ? acceptHeader.some((value: string) =>
          value.includes('text/event-stream'),
        )
      : typeof acceptHeader === 'string' &&
        acceptHeader.includes('text/event-stream');

    // Safely set correlation ID header with try-catch to handle race conditions
    if (!response.headersSent) {
      try {
        response.setHeader('X-Correlation-Id', correlationId);
      } catch {
        // Headers already sent - likely a streaming response
        this.logger.debug(
          `[${correlationId}] Could not set correlation header - headers already sent`,
        );
      }
    }

    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          // Don't log SSE responses as they are long-lived streams
          if (isSSE) return;
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${correlationId}] ${method} ${url} - ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${correlationId}] ${method} ${url} - Error - ${duration}ms`,
            error.stack,
          );
        },
      }),
    );
  }
}
