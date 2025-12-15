import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  await app.listen(process.env.GATEWAY_PORT || 3000);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
