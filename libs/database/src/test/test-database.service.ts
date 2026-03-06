import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { config } from 'dotenv';
import * as path from 'path';
import * as schema from '../schema';

// Load test environment
config({ path: path.resolve(process.cwd(), '.env.test') });

/**
 * Lightweight DatabaseService implementation for integration tests.
 * Mimics the interface that repositories expect from DatabaseService.
 *
 * Migrations are NOT run here — they run once externally:
 *   - Locally: `DATABASE_NAME=lyrebird_test pnpm db:migrate`
 *   - CI: `pnpm db:migrate` step in test-integration job
 */
export class TestDatabaseService {
  private pool: Pool | null = null;
  private _db: NodePgDatabase<typeof schema> | null = null;

  /**
   * Initialize database connection.
   * Assumes migrations have already been applied externally.
   */
  connect(): void {
    if (this._db) return;

    this.pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'lyrebird_test',
      max: 5, // Limit connections in tests
    });

    // Match production DatabaseService init style: drizzle(pool, { schema })
    this._db = drizzle(this.pool, { schema });
  }

  /**
   * Close the database connection pool.
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this._db = null;
    }
  }

  /**
   * Get Drizzle database instance.
   * Matches DatabaseService.db getter signature.
   */
  get db(): NodePgDatabase<typeof schema> {
    if (!this._db) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return this._db;
  }

  /**
   * Truncate all tables between tests.
   * sentiment_data first (FK dep on jobs), then jobs.
   */
  async cleanTables(): Promise<void> {
    if (!this._db) return;
    await this._db.execute(sql`TRUNCATE TABLE sentiment_data, jobs CASCADE`);
  }
}

// Singleton instance for test files
let testDbService: TestDatabaseService | null = null;

export function getTestDatabaseService(): TestDatabaseService {
  if (!testDbService) {
    testDbService = new TestDatabaseService();
  }
  return testDbService;
}
