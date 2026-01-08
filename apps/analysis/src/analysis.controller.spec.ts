import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import {
  TransientError,
  PermanentError,
  IngestionCompleteMessage,
  RawDataMessage,
} from '@app/shared-types';
import type { RmqContext } from '@nestjs/microservices';
import type { Message } from 'amqplib';

describe('AnalysisController', () => {
  let analysisController: AnalysisController;
  let mockAnalysisService: {
    processRawData: jest.Mock;
    handleIngestionComplete: jest.Mock;
  };
  let mockChannel: {
    ack: jest.Mock;
    nack: jest.Mock;
  };
  let mockMessage: Message;
  let mockContext: RmqContext;

  beforeEach(async () => {
    mockAnalysisService = {
      processRawData: jest.fn(),
      handleIngestionComplete: jest.fn(),
    };

    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };

    mockMessage = {
      properties: { correlationId: 'test-correlation-id' },
    } as unknown as Message;

    mockContext = {
      getChannelRef: jest.fn().mockReturnValue(mockChannel),
      getMessage: jest.fn().mockReturnValue(mockMessage),
    } as unknown as RmqContext;

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockAnalysisService,
        },
      ],
    }).compile();

    analysisController = app.get<AnalysisController>(AnalysisController);
  });

  describe('controller', () => {
    it('should be defined', () => {
      expect(analysisController).toBeDefined();
    });

    it('should have handleIngestionComplete method', () => {
      expect(typeof analysisController.handleIngestionComplete).toBe(
        'function',
      );
    });
  });

  describe('handleIngestionComplete', () => {
    const validPayload: IngestionCompleteMessage = {
      jobId: 'test-job-123',
      totalItems: 10,
      completedAt: new Date(),
    };

    it('should validate required fields and ack invalid messages', async () => {
      const invalidPayload = {
        jobId: '',
        totalItems: undefined,
        completedAt: new Date(),
      } as unknown as IngestionCompleteMessage;

      await analysisController.handleIngestionComplete(
        invalidPayload,
        mockContext,
      );

      expect(
        mockAnalysisService.handleIngestionComplete,
      ).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should call service with correct parameters on valid message', async () => {
      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      expect(mockAnalysisService.handleIngestionComplete).toHaveBeenCalledWith(
        validPayload,
        'test-correlation-id',
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should acknowledge message after successful processing', async () => {
      mockAnalysisService.handleIngestionComplete.mockResolvedValue(undefined);

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should use jobId as correlationId when correlationId not in message properties', async () => {
      const messageWithoutCorrelationId = {
        properties: {},
      } as unknown as Message;
      const contextWithoutCorrelationId = {
        getChannelRef: jest.fn().mockReturnValue(mockChannel),
        getMessage: jest.fn().mockReturnValue(messageWithoutCorrelationId),
      } as unknown as RmqContext;

      await analysisController.handleIngestionComplete(
        validPayload,
        contextWithoutCorrelationId,
      );

      expect(mockAnalysisService.handleIngestionComplete).toHaveBeenCalledWith(
        validPayload,
        'test-job-123', // Falls back to jobId
      );
    });

    it('should requeue message on TransientError', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        new TransientError('Service temporarily unavailable'),
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should not requeue message on PermanentError', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        new PermanentError('Invalid data format'),
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should requeue message on unknown errors (fail-safe)', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        new Error('Unknown error'),
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });
  });

  describe('handleRawData', () => {
    const validRawDataPayload: RawDataMessage = {
      jobId: 'test-job-456',
      textContent: 'Sample text content for analysis',
      source: 'test-source',
      publishedAt: new Date(),
      collectedAt: new Date(),
    };

    it('should validate required fields and ack invalid messages', async () => {
      const invalidPayload = {
        jobId: '',
        textContent: '',
        source: 'test',
        publishedAt: new Date(),
        collectedAt: new Date(),
      } as RawDataMessage;

      await analysisController.handleRawData(invalidPayload, mockContext);

      expect(mockAnalysisService.processRawData).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should call service with correct parameters', async () => {
      await analysisController.handleRawData(validRawDataPayload, mockContext);

      expect(mockAnalysisService.processRawData).toHaveBeenCalledWith(
        validRawDataPayload,
        'test-correlation-id',
      );
    });

    it('should requeue on TransientError', async () => {
      mockAnalysisService.processRawData.mockRejectedValue(
        new TransientError('Connection timeout'),
      );

      await analysisController.handleRawData(validRawDataPayload, mockContext);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });

    it('should not requeue on PermanentError', async () => {
      mockAnalysisService.processRawData.mockRejectedValue(
        new PermanentError('Validation failed: invalid date'),
      );

      await analysisController.handleRawData(validRawDataPayload, mockContext);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });
  });

  describe('shouldRequeue (via error handling)', () => {
    const validPayload: IngestionCompleteMessage = {
      jobId: 'test-job-789',
      totalItems: 5,
      completedAt: new Date(),
    };

    it('should return true for TransientError', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        new TransientError('Temporary failure'),
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      // nack with requeue=true
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });

    it('should return false for PermanentError', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        new PermanentError('Data validation failed'),
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      // nack with requeue=false
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });

    it('should return true for unknown Error types (fail-safe)', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        new TypeError('Unexpected type error'),
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      // Unknown errors should be requeued for safety
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });

    it('should return true for non-Error thrown values', async () => {
      mockAnalysisService.handleIngestionComplete.mockRejectedValue(
        'String error message',
      );

      await analysisController.handleIngestionComplete(
        validPayload,
        mockContext,
      );

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });
  });
});
