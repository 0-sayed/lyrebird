import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import * as schema from '../schema';

const TEST_DATABASE_NAME_PATTERN = /(^|_)test$/i;
const DEFAULT_TEST_DATABASE_NAME = 'lyrebird_test';
const TEST_ENV_PATH = path.resolve(process.cwd(), '.env.test');
const DEFAULT_TEST_USER_ID = 'test-user-id';

function loadTestEnvironment(envPath: string): void {
  if (!existsSync(envPath)) return;

  const envFile = readFileSync(envPath, 'utf8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = value;
  }
}

loadTestEnvironment(TEST_ENV_PATH);

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

  private assertSafeTestDatabaseConfig(): string {
    const nodeEnv = process.env.NODE_ENV;
    const databaseName =
      process.env.DATABASE_NAME || DEFAULT_TEST_DATABASE_NAME;

    if (nodeEnv !== 'test' || !TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
      throw new Error(
        `Refusing to use a non-test database configuration. NODE_ENV=${nodeEnv ?? 'undefined'}, DATABASE_NAME=${databaseName}`,
      );
    }

    return databaseName;
  }

  /**
   * Initialize database connection.
   * Assumes migrations have already been applied externally.
   */
  connect(): void {
    if (this._db) return;
    const databaseName = this.assertSafeTestDatabaseConfig();

    this.pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: databaseName,
      max: 5, // Limit connections in tests
    });

    // Match production DatabaseService init style: drizzle(pool, { schema })
    this._db = drizzle(this.pool, { schema });
  }

  private async ensureDefaultTestUser(): Promise<void> {
    if (!this._db) {
      throw new Error('Database not initialized. Call connect() first.');
    }

    await this._db
      .insert(schema.user)
      .values({
        id: DEFAULT_TEST_USER_ID,
        name: 'Test User',
        email: 'test-user@example.com',
        emailVerified: true,
        image: null,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
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
    this.assertSafeTestDatabaseConfig();
    await this._db.execute(sql`TRUNCATE TABLE sentiment_data, jobs CASCADE`);
    await this.ensureDefaultTestUser();
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
