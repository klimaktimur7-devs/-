import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildValidTelegramInitData } from '../src/testing/build-init-data';
import { UsersService } from '../src/users/users.service';

describe('Deposits - Stars invoice (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    usersService = moduleFixture.get(UsersService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAndGetToken(telegramId: number): Promise<{ token: string; userId: string }> {
    const initData = buildValidTelegramInitData(BOT_TOKEN, {
      user: JSON.stringify({ id: telegramId, username: `user${telegramId}` }),
    });
    const response = await request(app.getHttpServer()).post('/auth/telegram').send({ initData });
    return { token: response.body.accessToken, userId: response.body.userId };
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/deposits/stars/invoice')
      .send({ amountStars: 100 })
      .expect(401);
  });

  it('creates an invoice link for a user with no recorded consent', async () => {
    const { token, userId } = await loginAndGetToken(700001);

    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: 'https://t.me/invoice/abc' }),
    }) as any;

    const response = await request(app.getHttpServer())
      .post('/deposits/stars/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountStars: 100 })
      .expect(201);

    expect(response.body.invoiceLink).toBe('https://t.me/invoice/abc');
    const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sentBody.payload).toBe(userId);
  });

  it('creates an invoice link for a consenting user', async () => {
    const { token, userId } = await loginAndGetToken(700002);
    await usersService.acceptConsent(userId, 'v1');

    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true, result: 'https://t.me/invoice/xyz' }),
    }) as any;

    const response = await request(app.getHttpServer())
      .post('/deposits/stars/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountStars: 100 })
      .expect(201);

    expect(response.body.invoiceLink).toBe('https://t.me/invoice/xyz');
    jest.restoreAllMocks();
  });

  it('rejects deposits when DEPOSITS_ENABLED is false', async () => {
    const { token, userId } = await loginAndGetToken(700003);
    await usersService.acceptConsent(userId, 'v1');
    process.env.DEPOSITS_ENABLED = 'false';

    await request(app.getHttpServer())
      .post('/deposits/stars/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountStars: 100 })
      .expect(503);

    process.env.DEPOSITS_ENABLED = 'true';
  });
});
