import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import type { Response } from 'express';
import { DatabaseService } from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';

@ApiTags('health')
@AllowAnonymous()
@Controller('health')
export class HealthController {
  private readonly heapLimitBytes: number;
  private readonly rssLimitBytes: number;

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private configService: ConfigService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly databaseService: DatabaseService,
  ) {
    const heapLimitMB = this.configService.get<number>(
      'HEALTH_HEAP_LIMIT_MB',
      150,
    );
    const rssLimitMB = this.configService.get<number>(
      'HEALTH_RSS_LIMIT_MB',
      150,
    );

    this.heapLimitBytes = heapLimitMB * 1024 * 1024;
    this.rssLimitBytes = rssLimitMB * 1024 * 1024;
  }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', this.heapLimitBytes),
      () => this.memory.checkRSS('memory_rss', this.rssLimitBytes),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready(@Res({ passthrough: true }) response: Response) {
    const rabbitmq = await this.rabbitmqService.getHealthStatus();
    const database = await this.databaseService.getHealthStatus();
    const isReady = rabbitmq.healthy && database.healthy;

    const responseBody = {
      status: isReady ? 'ready' : 'not_ready',
      service: 'gateway',
      timestamp: new Date().toISOString(),
      checks: {
        rabbitmq,
        database,
      },
    };

    if (!isReady) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return responseBody;
  }
}
