import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '@app/shared-types';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // pino-http middleware already extracted the correlation ID from the
    // X-Correlation-ID header or generated a new UUID — reuse it so
    // logs, response headers, and downstream code all share one ID.
    const correlationId = String(request.id ?? randomUUID());

    // Add to request for downstream use
    request.correlationId = correlationId;

    // Safely set correlation ID header with try-catch to handle race conditions
    if (!response.headersSent) {
      try {
        response.setHeader(CORRELATION_ID_HEADER, correlationId);
      } catch {
        // Headers already sent - likely a streaming response
        this.logger.debug(
          `[${correlationId}] Could not set correlation header - headers already sent`,
        );
      }
    }

    // No request/response logging here — pino-http handles structured logging
    return next.handle();
  }
}
