import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RabbitmqHealthStatus, RabbitmqService } from '@app/rabbitmq';
import { DatabaseService, PostgresHealthStatus } from '@app/database';
import { BertSentimentService } from '../services/bert-sentiment.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime: Date;

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly databaseService: DatabaseService,
    private readonly bertSentimentService: BertSentimentService,
  ) {
    this.startTime = new Date();
  }

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'analysis',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
    };
  }

  @Get('ready')
  async getReadiness() {
    let rabbitmq: RabbitmqHealthStatus = {
      healthy: false,
      connected: false,
      initializedQueues: [],
    };
    try {
      rabbitmq = await this.rabbitmqService.getHealthStatus();
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    let database: PostgresHealthStatus = {
      healthy: false,
      latencyMs: 0,
    };
    try {
      database = await this.databaseService.getHealthStatus();
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    // Check BERT model status (not required for ready status)
    const bertStatus = this.bertSentimentService.getStatus();

    const isReady = rabbitmq.healthy && database.healthy;

    const responseBody = {
      status: isReady ? 'ready' : 'not_ready',
      service: 'analysis',
      timestamp: new Date().toISOString(),
      checks: {
        rabbitmq,
        database,
        bert: {
          ready: bertStatus.ready,
          provider: bertStatus.provider,
          modelLoaded: bertStatus.modelLoaded,
          modelName: bertStatus.modelName,
          quantization: bertStatus.quantization,
          error: bertStatus.error,
        },
      },
    };

    if (!isReady) {
      throw new HttpException(responseBody, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return responseBody;
  }

  @Get('live')
  getLiveness() {
    return {
      status: 'alive',
      service: 'analysis',
      timestamp: new Date().toISOString(),
    };
  }

  private getUptime(): string {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startTime.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
}
