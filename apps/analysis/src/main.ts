import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AnalysisModule } from './analysis.module';

async function bootstrap() {
  const logger = new Logger('AnalysisBootstrap');
  const app = await NestFactory.create(AnalysisModule);
  const port = process.env.ANALYSIS_PORT || 3002;
  await app.listen(port);

  logger.log(
    JSON.stringify({
      event: 'service_started',
      service: 'analysis',
      port: Number(port),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      pid: process.pid,
    }),
  );
}

bootstrap().catch((err) => {
  const logger = new Logger('AnalysisBootstrap');
  logger.error(
    'Failed to start Analysis service',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
