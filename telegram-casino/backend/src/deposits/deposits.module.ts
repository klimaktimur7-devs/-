import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [DepositsController],
})
export class DepositsModule {}
