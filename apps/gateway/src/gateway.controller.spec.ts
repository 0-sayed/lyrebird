import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

describe('GatewayController', () => {
  let gatewayController: GatewayController;

  beforeEach(async () => {
    const mockGatewayService = {
      createJob: jest.fn(),
      getJob: jest.fn(),
      listJobs: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        {
          provide: GatewayService,
          useValue: mockGatewayService,
        },
      ],
    }).compile();

    gatewayController = app.get<GatewayController>(GatewayController);
  });

  describe('controller', () => {
    it('should be defined', () => {
      expect(gatewayController).toBeDefined();
    });
  });
});
