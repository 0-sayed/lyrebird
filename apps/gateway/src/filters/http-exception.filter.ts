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

    let errorMessage: string;
    let errors: string[] | undefined;

    if (typeof message === 'string') {
      errorMessage = message;
    } else if (typeof message === 'object' && message !== null) {
      const errorObject = message as {
        error?: string;
        message?: string | string[];
      };
      errorMessage = errorObject.error || 'Internal Server Error';
      if (Array.isArray(errorObject.message)) {
        errors = errorObject.message;
      } else if (typeof errorObject.message === 'string') {
        errors = [errorObject.message];
      }
    } else {
      errorMessage = 'Internal Server Error';
    }

    const correlationIdHeader = request.headers['x-correlation-id'];
    const correlationId = Array.isArray(correlationIdHeader)
      ? correlationIdHeader[0]
      : correlationIdHeader || 'unknown';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: errorMessage,
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
