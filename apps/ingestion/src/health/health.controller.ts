import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';
import { DatabaseService } from '@app/database';
import { JetstreamManagerService } from '../jetstream/jetstream-manager.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime: Date;

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly databaseService: DatabaseService,
    private readonly jetstreamManager: JetstreamManagerService,
  ) {
    this.startTime = new Date();
  }

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'ingestion',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
    };
  }

  @Get('ready')
  async getReadiness() {
    const jetstreamStatus = this.jetstreamManager.getStatus();

    let rabbitmqHealthy = false;
    try {
      const rabbitmq = await this.rabbitmqService.getHealthStatus();
      rabbitmqHealthy = rabbitmq.healthy;
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    let databaseHealthy = false;
    try {
      const database = await this.databaseService.getHealthStatus();
      databaseHealthy = database.healthy;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    const jetstreamReady = jetstreamStatus.connectionStatus !== 'exhausted';
    const isReady = jetstreamReady && rabbitmqHealthy && databaseHealthy;

    const responseBody = {
      status: isReady ? 'ready' : 'not_ready',
      service: 'ingestion',
      timestamp: new Date().toISOString(),
      checks: {
        jetstream: { status: jetstreamStatus.connectionStatus },
        rabbitmq: { status: rabbitmqHealthy ? 'connected' : 'disconnected' },
        database: { status: databaseHealthy ? 'connected' : 'disconnected' },
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
      service: 'ingestion',
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
