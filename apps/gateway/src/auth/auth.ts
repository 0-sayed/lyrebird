import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { DatabaseService } from '@app/database';
import * as schema from '@app/database/schema';

export function createAuth(databaseService: DatabaseService) {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(databaseService.db, {
      provider: 'pg',
      schema: { ...schema },
    }),
    trustedOrigins: [process.env.DASHBOARD_URL || 'http://localhost:5173'],
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
    },
  });
}
