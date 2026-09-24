import { randomInt } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildValidTelegramInitData } from '../src/testing/build-init-data';

describe('Me (e2e)', () => {
  let app: INestApplication;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(telegramId: number) {
    const initData = buildValidTelegramInitData(BOT_TOKEN, {
      user: JSON.stringify({ id: telegramId, username: `user${telegramId}` }),
    });
    const response = await request(app.getHttpServer()).post('/auth/telegram').send({ initData });
    return response.body.accessToken as string;
  }

  it('reports hasAcceptedConsent=false for a new user, then true after accepting', async () => {
    const token = await login(randomInt(100_000_000, 999_999_999));

    const before = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body.hasAcceptedConsent).toBe(false);

    await request(app.getHttpServer())
      .post('/me/consent')
      .set('Authorization', `Bearer ${token}`)
      .send({ consentVersion: 'v1' })
      .expect(201)
      .expect({ hasAcceptedConsent: true });

    const after = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.hasAcceptedConsent).toBe(true);
  });

  it('returns balance as 0 for a brand-new user', async () => {
    const token = await login(randomInt(100_000_000, 999_999_999));

    const response = await request(app.getHttpServer())
      .get('/me/balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.balanceGram).toBe(0);
  });

  it('reports isAdmin=true only for the configured admin telegram id', async () => {
    const adminTelegramId = Number(process.env.ADMIN_TELEGRAM_ID);
    const adminToken = await login(adminTelegramId);
    const regularToken = await login(randomInt(100_000_000, 999_999_999));

    const adminResponse = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminResponse.body.isAdmin).toBe(true);

    const regularResponse = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);
    expect(regularResponse.body.isAdmin).toBe(false);
  });
});
