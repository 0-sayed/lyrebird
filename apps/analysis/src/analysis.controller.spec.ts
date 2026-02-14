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
import {
  createMockRabbitMqContext,
  assertMessageAcked,
  assertMessageNacked,
  type MockRabbitMqContext,
} from '@app/testing';
import {
  createMockRawDataMessage,
  createMockIngestionCompleteMessage,
  resetMessageCounter,
} from '../../../test/fixtures';

/**
 * Creates a mock AnalysisService for testing
 */
function createMockAnalysisService() {
  return {
    processRawData: jest.fn().mockResolvedValue(undefined),
    handleIngestionComplete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let mockService: ReturnType<typeof createMockAnalysisService>;
  let ctx: MockRabbitMqContext;

  beforeEach(async () => {
    resetMessageCounter();
    mockService = createMockAnalysisService();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = app.get<AnalysisController>(AnalysisController);
    ctx = createMockRabbitMqContext();
  });

  describe('handleIngestionComplete', () => {
    let validPayload: IngestionCompleteMessage;

    beforeEach(() => {
      validPayload = createMockIngestionCompleteMessage();
    });

    describe('message validation', () => {
      it.each([
        ['empty jobId', { jobId: '', totalItems: 10 }],
        ['undefined totalItems', { jobId: 'test-job', totalItems: undefined }],
        ['null jobId', { jobId: null, totalItems: 10 }],
      ] as const)(
        'should ack and skip processing when %s',
        async (_description, payload) => {
          await controller.handleIngestionComplete(
            payload as unknown as IngestionCompleteMessage,
            ctx as unknown as RmqContext,
          );

          expect(mockService.handleIngestionComplete).not.toHaveBeenCalled();
          assertMessageAcked(ctx);
        },
      );

      it('should process valid messages', async () => {
        await controller.handleIngestionComplete(
          validPayload,
          ctx as unknown as RmqContext,
        );

        expect(mockService.handleIngestionComplete).toHaveBeenCalledWith(
          validPayload,
          expect.any(String),
        );
        assertMessageAcked(ctx);
      });
    });

    describe('correlation ID extraction', () => {
      it('should use correlationId from message properties when available', async () => {
        const customCtx = createMockRabbitMqContext({
          properties: { correlationId: 'custom-correlation-id' },
        });

        await controller.handleIngestionComplete(
          validPayload,
          customCtx as unknown as RmqContext,
        );

        expect(mockService.handleIngestionComplete).toHaveBeenCalledWith(
          validPayload,
          'custom-correlation-id',
        );
      });

      it('should fall back to jobId when correlationId not in message properties', async () => {
        const ctxWithoutCorrelation = createMockRabbitMqContext({
          properties: { correlationId: '' },
        });
        const payload = createMockIngestionCompleteMessage({
          jobId: 'fallback-job-id',
        });

        await controller.handleIngestionComplete(
          payload,
          ctxWithoutCorrelation as unknown as RmqContext,
        );

        expect(mockService.handleIngestionComplete).toHaveBeenCalledWith(
          payload,
          'fallback-job-id',
        );
      });
    });

    describe('error handling', () => {
      it('should requeue message on TransientError', async () => {
        mockService.handleIngestionComplete.mockRejectedValue(
          new TransientError('Service temporarily unavailable'),
        );

        await controller.handleIngestionComplete(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, true);
        expect(ctx._channel.ack).not.toHaveBeenCalled();
      });

      it('should not requeue message on PermanentError', async () => {
        mockService.handleIngestionComplete.mockRejectedValue(
          new PermanentError('Invalid data format'),
        );

        await controller.handleIngestionComplete(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, false);
        expect(ctx._channel.ack).not.toHaveBeenCalled();
      });

      it('should requeue message on unknown Error types (fail-safe)', async () => {
        mockService.handleIngestionComplete.mockRejectedValue(
          new TypeError('Unexpected type error'),
        );

        await controller.handleIngestionComplete(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, true);
      });

      it('should requeue message when non-Error value is thrown', async () => {
        mockService.handleIngestionComplete.mockRejectedValue(
          'String error message',
        );

        await controller.handleIngestionComplete(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, true);
      });
    });
  });

  describe('handleRawData', () => {
    let validPayload: RawDataMessage;

    beforeEach(() => {
      validPayload = createMockRawDataMessage();
    });

    describe('message validation', () => {
      it.each([
        ['empty jobId', { jobId: '', textContent: 'content' }],
        ['empty textContent', { jobId: 'test-job', textContent: '' }],
        ['null jobId', { jobId: null, textContent: 'content' }],
        [
          'undefined textContent',
          { jobId: 'test-job', textContent: undefined },
        ],
      ] as const)(
        'should ack and skip processing when %s',
        async (_description, payload) => {
          const fullPayload = {
            ...payload,
            source: 'bluesky',
            publishedAt: new Date(),
            collectedAt: new Date(),
          } as unknown as RawDataMessage;

          await controller.handleRawData(
            fullPayload,
            ctx as unknown as RmqContext,
          );

          expect(mockService.processRawData).not.toHaveBeenCalled();
          assertMessageAcked(ctx);
        },
      );

      it('should process valid messages', async () => {
        await controller.handleRawData(
          validPayload,
          ctx as unknown as RmqContext,
        );

        expect(mockService.processRawData).toHaveBeenCalledWith(
          validPayload,
          expect.any(String),
        );
        assertMessageAcked(ctx);
      });
    });

    describe('correlation ID extraction', () => {
      it('should use correlationId from message properties when available', async () => {
        const customCtx = createMockRabbitMqContext({
          properties: { correlationId: 'raw-data-correlation-id' },
        });

        await controller.handleRawData(
          validPayload,
          customCtx as unknown as RmqContext,
        );

        expect(mockService.processRawData).toHaveBeenCalledWith(
          validPayload,
          'raw-data-correlation-id',
        );
      });

      it('should fall back to jobId when correlationId is empty', async () => {
        const ctxWithoutCorrelation = createMockRabbitMqContext({
          properties: { correlationId: '' },
        });
        const payload = createMockRawDataMessage({ jobId: 'raw-data-job-id' });

        await controller.handleRawData(
          payload,
          ctxWithoutCorrelation as unknown as RmqContext,
        );

        expect(mockService.processRawData).toHaveBeenCalledWith(
          payload,
          'raw-data-job-id',
        );
      });
    });

    describe('error handling', () => {
      it('should requeue message on TransientError', async () => {
        mockService.processRawData.mockRejectedValue(
          new TransientError('Connection timeout'),
        );

        await controller.handleRawData(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, true);
        expect(ctx._channel.ack).not.toHaveBeenCalled();
      });

      it('should not requeue message on PermanentError', async () => {
        mockService.processRawData.mockRejectedValue(
          new PermanentError('Validation failed: invalid date'),
        );

        await controller.handleRawData(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, false);
        expect(ctx._channel.ack).not.toHaveBeenCalled();
      });

      it('should requeue on unknown errors (fail-safe)', async () => {
        mockService.processRawData.mockRejectedValue(
          new Error('Database connection lost'),
        );

        await controller.handleRawData(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, true);
      });
    });
  });

  describe('shouldRequeue behavior (via error classification)', () => {
    const validPayload = createMockIngestionCompleteMessage();

    it.each([
      ['TransientError', new TransientError('Temporary failure'), true],
      ['PermanentError', new PermanentError('Data validation failed'), false],
      ['TypeError', new TypeError('Unexpected type'), true],
      ['RangeError', new RangeError('Out of bounds'), true],
      ['generic Error', new Error('Unknown error'), true],
    ] as const)(
      'should requeue=%s for %s',
      async (_errorType, error, expectedRequeue) => {
        mockService.handleIngestionComplete.mockRejectedValue(error);

        await controller.handleIngestionComplete(
          validPayload,
          ctx as unknown as RmqContext,
        );

        assertMessageNacked(ctx, expectedRequeue);
      },
    );

    it('should handle non-Error thrown values with fail-safe requeue', async () => {
      const nonErrorValues = [
        'string error',
        42,
        null,
        undefined,
        { message: 'object error' },
      ];

      for (const [index, value] of nonErrorValues.entries()) {
        // Each iteration needs a unique message to avoid retry count collision
        const freshCtx = createMockRabbitMqContext({
          message: { iteration: index },
        });
        mockService.handleIngestionComplete.mockRejectedValue(value);

        await controller.handleIngestionComplete(
          validPayload,
          freshCtx as unknown as RmqContext,
        );

        assertMessageNacked(freshCtx, true);
      }
    });
  });
});
