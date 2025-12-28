import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime: Date;

  constructor(private readonly rabbitmqService: RabbitmqService) {
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
  getReadiness() {
    let rabbitmqHealthy = false;
    try {
      rabbitmqHealthy = this.rabbitmqService.isInitialized();
    } catch (error) {
      this.logger.error(
        'Health check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    const responseBody = {
      status: rabbitmqHealthy ? 'ready' : 'not_ready',
      service: 'ingestion',
      timestamp: new Date().toISOString(),
      checks: {
        rabbitmq: rabbitmqHealthy ? 'connected' : 'disconnected',
      },
    };

    if (!rabbitmqHealthy) {
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
