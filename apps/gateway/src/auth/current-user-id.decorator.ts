import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
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
    const userId = request.session?.user?.id;
    if (!userId) {
      throw new UnauthorizedException('No authenticated user');
    }
    return userId;
  },
);
