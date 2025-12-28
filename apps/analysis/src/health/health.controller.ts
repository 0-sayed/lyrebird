import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';
import { DatabaseService } from '@app/database';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime: Date;

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly databaseService: DatabaseService,
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
    let rabbitmqHealthy = false;
    try {
      rabbitmqHealthy = this.rabbitmqService.isInitialized();
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    let databaseHealthy = false;
    try {
      databaseHealthy = await this.databaseService.healthCheck();
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    const isReady = rabbitmqHealthy && databaseHealthy;

    const responseBody = {
      status: isReady ? 'ready' : 'not_ready',
      service: 'analysis',
      timestamp: new Date().toISOString(),
      checks: {
        rabbitmq: rabbitmqHealthy ? 'connected' : 'disconnected',
        database: databaseHealthy ? 'connected' : 'disconnected',
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
