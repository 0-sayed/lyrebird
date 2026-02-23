import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts userId from the Better Auth session.
 * Reduces boilerplate vs @Session() + session.user.id in every method.
 *
 * Usage: @CurrentUserId() userId: string
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { session?: { user?: { id: string } } }>();
    return request.session?.user?.id as string;
  },
);
