import { Module } from '@nestjs/common';
import { TelegramBotApiClient } from './telegram-bot-api.client';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [TelegramBotApiClient],
  controllers: [TelegramWebhookController],
  exports: [TelegramBotApiClient],
})
export class TelegramModule {}
