import { NestFactory } from '@nestjs/core';
import { IngestionModule } from './ingestion.module';

async function bootstrap() {
  const app = await NestFactory.create(IngestionModule);
  const port = process.env.INGESTION_PORT || 3001;
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
