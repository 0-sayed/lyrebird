import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              DATABASE_HOST: 'localhost',
              DATABASE_PORT: 5432,
              DATABASE_USER: 'test',
              DATABASE_PASSWORD: 'test',
              DATABASE_NAME: 'test',
            }),
          ],
        }),
      ],
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('db getter', () => {
    it('should return the drizzle instance after construction', () => {
      expect(service.db).toBeDefined();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with latency when SELECT 1 succeeds', async () => {
      const queryMock = jest
        .fn()
        .mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(112);

      (service as unknown as { pool: { query: typeof queryMock } }).pool.query =
        queryMock;

      await expect(service.getHealthStatus()).resolves.toEqual({
        healthy: true,
        latencyMs: 12,
      });
      expect(queryMock).toHaveBeenCalledWith('SELECT 1');

      dateNowSpy.mockRestore();
    });

    it('should return unhealthy status with latency and error when SELECT 1 fails', async () => {
      const error = new Error('database unavailable');
      const queryMock = jest.fn().mockRejectedValue(error);
      const loggerErrorMock = jest.fn();
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(200)
        .mockReturnValueOnce(225);

      (service as unknown as { pool: { query: typeof queryMock } }).pool.query =
        queryMock;
      (
        service as unknown as { logger: { error: typeof loggerErrorMock } }
      ).logger.error = loggerErrorMock;

      await expect(service.getHealthStatus()).resolves.toEqual({
        healthy: false,
        latencyMs: 25,
        error: 'database unavailable',
      });
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'Database health check failed',
        error,
      );

      dateNowSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should delegate to getHealthStatus and return the healthy flag', async () => {
      jest.spyOn(service, 'getHealthStatus').mockResolvedValue({
        healthy: false,
        latencyMs: 7,
        error: 'database unavailable',
      });

      await expect(service.healthCheck()).resolves.toBe(false);
      expect(service.getHealthStatus).toHaveBeenCalledTimes(1);
    });
  });
});
