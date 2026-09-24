import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateStarsInvoiceParams {
  title: string;
  description: string;
  payload: string;
  amountStars: number;
}

@Injectable()
export class TelegramBotApiClient {
  constructor(private readonly configService: ConfigService) {}

  private get botToken(): string {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    return token;
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }

  async createStarsInvoiceLink(params: CreateStarsInvoiceParams): Promise<string> {
    const response = await fetch(this.apiUrl('createInvoiceLink'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        payload: params.payload,
        currency: 'XTR',
        prices: [{ label: params.title, amount: params.amountStars }],
      }),
    });

    const data = (await response.json()) as { ok: boolean; result?: string; description?: string };
    if (!data.ok || !data.result) {
      throw new Error(`createInvoiceLink failed: ${data.description ?? 'unknown error'}`);
    }
    return data.result;
  }

  async answerPreCheckoutQuery(
    preCheckoutQueryId: string,
    ok: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const response = await fetch(this.apiUrl('answerPreCheckoutQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: preCheckoutQueryId,
        ok,
        error_message: errorMessage,
      }),
    });

    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      throw new Error(`answerPreCheckoutQuery failed: ${data.description ?? 'unknown error'}`);
    }
  }
}
