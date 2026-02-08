import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { LoggingModule } from '@aty/logging';

@Module({
  imports: [LoggingModule],
  controllers: [HealthController],
})
export class AppModule {}
