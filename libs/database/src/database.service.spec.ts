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
    it('should throw error when database is not initialized', () => {
      expect(() => service.db).toThrow('Database not initialized');
    });
  });
});
