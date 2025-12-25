import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

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

    // Add to response headers
    response.setHeader('X-Correlation-Id', correlationId);

    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
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
