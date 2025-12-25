import { Controller, Get } from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';

@Controller('health')
export class HealthController {
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
  async getReadiness() {
    // Check if RabbitMQ is connected by performing an actual health check
    let rabbitmqHealthy = false;
    try {
      // Use the service's health check which attempts a real message operation
      rabbitmqHealthy = await this.rabbitmqService.healthCheck();
    } catch {
      rabbitmqHealthy = false;
    }

    const isReady = rabbitmqHealthy;

    return {
      status: isReady ? 'ready' : 'not_ready',
      service: 'ingestion',
      timestamp: new Date().toISOString(),
      checks: {
        rabbitmq: rabbitmqHealthy ? 'connected' : 'disconnected',
      },
    };
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
