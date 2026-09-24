import { randomInt } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildValidTelegramInitData } from '../src/testing/build-init-data';
import { GiftResolverClient, GiftResolverUnavailableError } from '../src/gifts/gift-resolver.client';

describe('Gifts (e2e)', () => {
  let app: INestApplication;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
  const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID);
  const resolverMock = { resolve: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GiftResolverClient)
      .useValue(resolverMock)
      .compile();
    app = moduleFixture.createNestApplication();
    // Matches src/main.ts's bootstrap() exactly — createNestApplication() here
    // does not run main.ts, so DTO validation (e.g. priceTon positivity) would
    // otherwise silently not be enforced in these tests.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  async function login(telegramId: number): Promise<string> {
    const initData = buildValidTelegramInitData(BOT_TOKEN, {
      user: JSON.stringify({ id: telegramId, username: `user${telegramId}` }),
    });
    const response = await request(app.getHttpServer()).post('/auth/telegram').send({ initData });
    return response.body.accessToken as string;
  }

  it('lists gifts publicly without auth', async () => {
    await request(app.getHttpServer()).get('/gifts').expect(200).expect((res) => {
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  it('rejects admin routes for an unauthenticated caller', async () => {
    await request(app.getHttpServer()).get('/admin/gifts').expect(401);
  });

  it('rejects admin routes for a non-admin authenticated caller', async () => {
    const token = await login(randomInt(100_000_000, 999_999_999));
    await request(app.getHttpServer())
      .get('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('resolves, creates, lists, and soft-deletes a gift end to end as the admin', async () => {
    const token = await login(ADMIN_TELEGRAM_ID);
    const slug = `E2eGift-${randomInt(1, 1_000_000)}`;

    resolverMock.resolve.mockResolvedValue({
      name: 'E2E Gift',
      editionNumber: 1,
      model: 'Test Model',
      symbol: 'Test Symbol',
      backdropName: 'Test Backdrop',
      backdropColor: '#123456',
      imageUrl: null,
      telegramSlug: slug,
    });

    const resolveResponse = await request(app.getHttpServer())
      .post('/admin/gifts/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ link: `https://t.me/nft/${slug}` })
      .expect(201);
    expect(resolveResponse.body.telegramSlug).toBe(slug);

    const createResponse = await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...resolveResponse.body, priceTon: 42 })
      .expect(201);
    expect(createResponse.body.priceTon).toBe(42);
    const giftId = createResponse.body.id as string;

    const listResponse = await request(app.getHttpServer())
      .get('/gifts')
      .expect(200);
    expect(listResponse.body.some((gift: { id: string }) => gift.id === giftId)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/admin/gifts/${giftId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer()).get('/gifts').expect(200);
    expect(afterDelete.body.some((gift: { id: string }) => gift.id === giftId)).toBe(false);

    await request(app.getHttpServer())
      .delete(`/admin/gifts/${giftId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('allows re-adding a gift by the same slug after it was soft-deleted', async () => {
    const token = await login(ADMIN_TELEGRAM_ID);
    const slug = `ReaddGift-${randomInt(1, 1_000_000)}`;
    const payload = {
      editionNumber: 1,
      name: 'Readd',
      model: 'M',
      symbol: 'S',
      backdropName: 'B',
      backdropColor: '#123456',
      imageUrl: null,
      telegramSlug: slug,
      priceTon: 10,
    };

    const first = await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/admin/gifts/${first.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
  });

  it('returns 409 when creating a gift with a slug that already exists', async () => {
    const token = await login(ADMIN_TELEGRAM_ID);
    const slug = `DupGift-${randomInt(1, 1_000_000)}`;
    const payload = {
      editionNumber: 1,
      name: 'Dup',
      model: 'M',
      symbol: 'S',
      backdropName: 'B',
      backdropColor: '#123456',
      imageUrl: null,
      telegramSlug: slug,
      priceTon: 1,
    };

    await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(409);
  });

  it('rejects a zero or negative price with 400', async () => {
    const token = await login(ADMIN_TELEGRAM_ID);
    const basePayload = {
      editionNumber: 1,
      name: 'Free Gift',
      model: 'M',
      symbol: 'S',
      backdropName: 'B',
      backdropColor: '#123456',
      imageUrl: null,
    };

    await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, telegramSlug: `ZeroPrice-${randomInt(1, 1_000_000)}`, priceTon: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/admin/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload, telegramSlug: `NegPrice-${randomInt(1, 1_000_000)}`, priceTon: -5 })
      .expect(400);
  });

  it('returns 400 when the resolve link is not a gift link', async () => {
    const token = await login(ADMIN_TELEGRAM_ID);
    await request(app.getHttpServer())
      .post('/admin/gifts/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ link: 'https://example.com/not-a-gift' })
      .expect(400);
  });

  it('returns 503 when the resolver is unavailable', async () => {
    const token = await login(ADMIN_TELEGRAM_ID);
    resolverMock.resolve.mockRejectedValue(new GiftResolverUnavailableError('down'));

    await request(app.getHttpServer())
      .post('/admin/gifts/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ link: 'https://t.me/nft/Whatever-1' })
      .expect(503);
  });
});
