import { NestFactory } from '@nestjs/core';
import { AnalysisModule } from './analysis.module';

async function bootstrap() {
  const app = await NestFactory.create(AnalysisModule);
  const port = process.env.ANALYSIS_PORT || 3002;
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
