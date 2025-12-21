import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'path';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private _db: NodePgDatabase<typeof schema>;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize database connection on module startup
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing database connection pool...');

      // Create PostgreSQL pool
      this.pool = new Pool({
        host: this.configService.get('DATABASE_HOST'),
        port: parseInt(this.configService.get('DATABASE_PORT') || '5432', 10),
        user: this.configService.get('DATABASE_USER'),
        password: this.configService.get('DATABASE_PASSWORD'),
        database: this.configService.get('DATABASE_NAME'),
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
        connectionTimeoutMillis: 2000, // How long to wait before timing out when connecting a new client
      });

      // Test connection
      await this.pool.query('SELECT 1');
      this.logger.log('Database pool connected successfully');

      // Initialize Drizzle ORM with schema
      this._db = drizzle(this.pool, { schema });

      // Note: Run migrations manually via 'pnpm db:migrate' to avoid race conditions
      // when multiple services start simultaneously
      // await this.runMigrations();

      this.logger.log('Database service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database pool', error);
      throw error;
    }
  }

  /**
   * Close database connection on module shutdown
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Closing database connection pool...');
      await this.pool.end();
      this.logger.log('Database connection pool closed');
    } catch (error) {
      this.logger.error('Error closing database connection pool', error);
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      this.logger.log('Running database migrations...');
      await migrate(this._db, {
        migrationsFolder: path.join(
          __dirname,
          '../../../libs/database/migrations',
        ),
      });
      this.logger.log('Migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed', error);
      throw error;
    }
  }

  /**
   * Get Drizzle database instance
   */
  get db(): NodePgDatabase<typeof schema> {
    if (!this._db) {
      throw new Error('Database not initialized');
    }
    return this._db;
  }

  /**
   * Health check - test database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}
