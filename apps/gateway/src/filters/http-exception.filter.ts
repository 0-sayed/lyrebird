import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    interface ErrorResponse {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    }

    const messageText =
      typeof message === 'string'
        ? message
        : (message as ErrorResponse).message || 'Internal server error';

    const errors =
      typeof message === 'object' && (message as ErrorResponse).message
        ? Array.isArray((message as ErrorResponse).message)
          ? (message as ErrorResponse).message
          : [(message as ErrorResponse).message as string]
        : undefined;

    const correlationIdHeader = request.headers['x-correlation-id'];
    const correlationId = Array.isArray(correlationIdHeader)
      ? correlationIdHeader[0]
      : correlationIdHeader || 'unknown';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: messageText,
      errors,
      correlationId,
    };

    // Log error for debugging
    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : 'Unknown error',
    );

    response.status(status).json(errorResponse);
  }
}
