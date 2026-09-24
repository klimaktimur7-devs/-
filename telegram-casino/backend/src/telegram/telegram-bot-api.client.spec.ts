import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramBotApiClient } from './telegram-bot-api.client';

describe('TelegramBotApiClient', () => {
  let client: TelegramBotApiClient;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TelegramBotApiClient,
        { provide: ConfigService, useValue: { get: () => 'test-bot-token' } },
      ],
    }).compile();
    client = moduleRef.get(TelegramBotApiClient);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the invoice link on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: true, result: 'https://t.me/invoice/abc' }),
    });

    const link = await client.createStarsInvoiceLink({
      title: 'Deposit',
      description: '100 Stars',
      payload: 'user-id-123',
      amountStars: 100,
    });

    expect(link).toBe('https://t.me/invoice/abc');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/createInvoiceLink',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when Telegram responds with ok:false', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ ok: false, description: 'Bad Request: invalid payload' }),
    });

    await expect(
      client.createStarsInvoiceLink({
        title: 'Deposit',
        description: '100 Stars',
        payload: 'user-id-123',
        amountStars: 100,
      }),
    ).rejects.toThrow('createInvoiceLink failed: Bad Request: invalid payload');
  });

  it('answers pre-checkout query with ok:true', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ json: async () => ({ ok: true }) });

    await client.answerPreCheckoutQuery('query-1', true);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/answerPreCheckoutQuery',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
