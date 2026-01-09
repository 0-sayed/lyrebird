import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Database dialect
  dialect: 'postgresql',

  // Path to your schema files
  schema: './libs/database/src/schema/index.ts',

  // Output directory for migrations
  out: './libs/database/migrations',

  // Database connection
  dbCredentials: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'lyrebird',
    ssl: false,
  },

  // Migration settings
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
    prefix: 'timestamp',
  },

  // Useful for debugging
  verbose: true,
  strict: true,
});
