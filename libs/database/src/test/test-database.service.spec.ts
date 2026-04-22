import { TestDatabaseService } from './test-database.service';

describe('TestDatabaseService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
      DATABASE_USER: 'postgres',
      DATABASE_PASSWORD: 'postgres',
      DATABASE_NAME: 'lyrebird_test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('refuses to connect when DATABASE_NAME is not a test database', () => {
    process.env.DATABASE_NAME = 'lyrebird';

    const service = new TestDatabaseService();

    expect(() => service.connect()).toThrow(
      'Refusing to use a non-test database configuration.',
    );
  });

  it('refuses to truncate tables when NODE_ENV is not test', async () => {
    process.env.NODE_ENV = 'development';
    const execute = jest.fn().mockResolvedValue(undefined);
    const service = new TestDatabaseService();

    (service as unknown as { _db: { execute: typeof execute } })._db = {
      execute,
    };

    await expect(service.cleanTables()).rejects.toThrow(
      'Refusing to use a non-test database configuration.',
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
