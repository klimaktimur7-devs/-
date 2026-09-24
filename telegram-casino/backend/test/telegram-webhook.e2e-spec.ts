import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { LedgerService, userAccount } from '../src/ledger/ledger.service';

describe('Telegram webhook (e2e)', () => {
  let app: INestApplication;
  let ledgerService: LedgerService;
  const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET as string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    ledgerService = moduleFixture.get(LedgerService);
    await app.init();
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: true }) }) as any;
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('rejects requests without a valid secret token', async () => {
    await request(app.getHttpServer())
      .post('/telegram/webhook')
      .send({ message: { successful_payment: {} } })
      .expect(401);
  });

  it('answers pre_checkout_query and does not touch the ledger', async () => {
    await request(app.getHttpServer())
      .post('/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', WEBHOOK_SECRET)
      .send({
        pre_checkout_query: { id: 'pcq-1', from: { id: 1 }, total_amount: 100, invoice_payload: 'user-1' },
      })
      .expect(201)
      .expect({ ok: true });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('answerPreCheckoutQuery'),
      expect.anything(),
    );
  });

  it('credits the ledger on successful_payment and is idempotent on retry', async () => {
    const userId = randomUUID();
    const chargeId = `charge-${Date.now()}`;
    const update = {
      message: {
        successful_payment: {
          total_amount: 250,
          invoice_payload: userId,
          telegram_payment_charge_id: chargeId,
        },
      },
    };

    await request(app.getHttpServer())
      .post('/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', WEBHOOK_SECRET)
      .send(update)
      .expect(201);

    const balanceAfterFirst = await ledgerService.getBalance(userAccount(userId));
    expect(balanceAfterFirst).toBe(BigInt(25000));

    await request(app.getHttpServer())
      .post('/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', WEBHOOK_SECRET)
      .send(update)
      .expect(201);

    const balanceAfterRetry = await ledgerService.getBalance(userAccount(userId));
    expect(balanceAfterRetry).toBe(BigInt(25000));
  });
});
