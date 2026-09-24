import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBotApiClient } from './telegram-bot-api.client';
import { LedgerService, userAccount, DuplicateLedgerTransactionError } from '../ledger/ledger.service';

interface TelegramUpdate {
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    total_amount: number;
    invoice_payload: string;
  };
  message?: {
    successful_payment?: {
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
}

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botApiClient: TelegramBotApiClient,
    private readonly ledgerService: LedgerService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expectedSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expectedSecret || secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (update.pre_checkout_query) {
      await this.botApiClient.answerPreCheckoutQuery(update.pre_checkout_query.id, true);
      return { ok: true };
    }

    const payment = update.message?.successful_payment;
    if (payment) {
      await this.creditStarsDeposit(payment);
      return { ok: true };
    }

    return { ok: true };
  }

  private async creditStarsDeposit(payment: {
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
  }): Promise<void> {
    const rate = Number(this.configService.get<string>('STARS_TO_GRAM_RATE') ?? '1');
    const gramCents = BigInt(Math.round(payment.total_amount * rate * 100));
    const userId = payment.invoice_payload;

    try {
      await this.ledgerService.recordTransaction({
        type: 'stars_deposit',
        externalRef: payment.telegram_payment_charge_id,
        legs: [
          { account: 'system:stars_deposits', amountGramCents: -gramCents },
          { account: userAccount(userId), amountGramCents: gramCents },
        ],
      });
    } catch (error) {
      if (error instanceof DuplicateLedgerTransactionError) {
        this.logger.warn(`Duplicate Stars payment webhook ignored: ${payment.telegram_payment_charge_id}`);
        return;
      }
      throw error;
    }
  }
}
