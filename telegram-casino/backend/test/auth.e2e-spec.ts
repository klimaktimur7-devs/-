import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildValidTelegramInitData } from '../src/testing/build-init-data';

describe('Auth (e2e)', () => {
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

  it('logs in with valid initData and returns a JWT', async () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN, {
      user: JSON.stringify({ id: 555111, username: 'newplayer', first_name: 'New' }),
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram')
      .send({ initData })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.userId).toEqual(expect.any(String));
  });

  it('rejects login with tampered initData', async () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN).replace('alex', 'mallory');

    await request(app.getHttpServer())
      .post('/auth/telegram')
      .send({ initData })
      .expect(401);
  });

  it('logs in with initData signed by the dev mock token outside production', async () => {
    const devMockToken = process.env.TELEGRAM_DEV_MOCK_TOKEN as string;
    const initData = buildValidTelegramInitData(devMockToken, {
      user: JSON.stringify({ id: 555222, username: 'mockuser', first_name: 'Mock' }),
    });

    const response = await request(app.getHttpServer())
      .post('/auth/telegram')
      .send({ initData })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
  });
});
