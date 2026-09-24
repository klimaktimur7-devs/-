import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [UsersModule, TelegramModule],
  controllers: [DepositsController],
})
export class DepositsModule {}
