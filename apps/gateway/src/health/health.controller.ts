import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly heapLimitBytes: number;
  private readonly rssLimitBytes: number;

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private configService: ConfigService,
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
  ready() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
