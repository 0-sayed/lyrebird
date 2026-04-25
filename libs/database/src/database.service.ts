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

export interface PostgresHealthStatus {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private _db: NodePgDatabase<typeof schema>;

  constructor(private configService: ConfigService) {
    // Pool and drizzle init are synchronous — safe to do here so that
    // `db` is available immediately when DI factory providers run,
    // before onModuleInit lifecycle hooks fire.
    this.pool = new Pool({
      host: this.configService.get('DATABASE_HOST'),
      port: parseInt(this.configService.get('DATABASE_PORT') || '5432', 10),
      user: this.configService.get('DATABASE_USER'),
      password: this.configService.get('DATABASE_PASSWORD'),
      database: this.configService.get('DATABASE_NAME'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this._db = drizzle(this.pool, { schema });
  }

  /**
   * Verify database connection on module startup
   */
  async onModuleInit() {
    try {
      this.logger.log('Verifying database connection...');
      await this.pool.query('SELECT 1');
      this.logger.log('Database connection verified');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
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
    return this._db;
  }

  /**
   * Health check - test database connection
   */
  async getHealthStatus(): Promise<PostgresHealthStatus> {
    const startedAt = Date.now();

    try {
      await this.pool.query('SELECT 1');
      return {
        healthy: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Database health check failed', error);
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        error: message,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return (await this.getHealthStatus()).healthy;
  }
}
