import { Module } from '@nestjs/common';
import { LoggingModule } from '@aty/logging';

@Module({
  imports: [LoggingModule],
})
export class WorkersModule {}
