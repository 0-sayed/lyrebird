import { sql } from 'drizzle-orm';
import {
  getTestDatabaseService,
  TestDatabaseService,
} from './test-database.service';

describe('Integration Test Infrastructure (smoke test)', () => {
  let testDb: TestDatabaseService;

  beforeAll(() => {
    testDb = getTestDatabaseService();
    testDb.connect();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  it('should connect to test database', async () => {
    const result = await testDb.db.execute(sql`SELECT 1 as connected`);
    expect(result).toBeDefined();
  });

  it('should clean all tables without error', async () => {
    await testDb.cleanTables();
  });
});
