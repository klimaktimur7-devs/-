# Ядро платформы — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Telegram Mini App casino's foundation — Telegram-ID auth, an auditable internal-currency ledger, a 5-tab navigation shell, and a working Telegram Stars deposit flow.

**Architecture:** Monorepo (`frontend/` Vite+React+TS+Tailwind, `backend/` NestJS+PostgreSQL). Backend exposes a REST API; auth is via signed Telegram `initData` exchanged for a JWT; money movements are double-entry ledger transactions, never a mutable balance column.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL 16, Jest/Supertest (backend); Vite 5, React 18, TypeScript 5, Tailwind 3, Vitest + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-09-21-core-platform-design.md`

---

## Prerequisites

- Node.js 20+, npm, Docker (for local Postgres) installed on the machine.
- Run all backend commands from `backend/`, all frontend commands from `frontend/`, unless noted.

---

## Task 1: Backend scaffold + health check

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/health/health.controller.ts`
- Test: `backend/test/health.e2e-spec.ts`
- Test: `backend/test/jest-e2e.json`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "telegram-casino-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "typeorm": "typeorm-ts-node-commonjs",
    "migration:run": "npm run typeorm -- migration:run -d src/data-source.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/data-source.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/typeorm": "^10.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "dotenv": "^16.4.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.11.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.14.0",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.5.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node"
  }
}
```

Run: `npm install` (inside `backend/`)

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 3: Create `backend/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 4: Create `backend/.gitignore`**

```
node_modules/
dist/
coverage/
.env
```

- [ ] **Step 5: Create `backend/.env.example`, then copy it to `.env`**

```
DATABASE_URL=postgres://postgres:postgres@localhost:5433/telegram_casino
JWT_SECRET=dev-secret-change-me
TELEGRAM_BOT_TOKEN=test-bot-token-123456:ABCDEF
TELEGRAM_WEBHOOK_SECRET=test-webhook-secret
STARS_TO_GRAM_RATE=1
DEPOSITS_ENABLED=true
PORT=3000
```

Run: `cp .env.example .env` (inside `backend/`). These placeholder values are fine for local dev/tests; `TELEGRAM_BOT_TOKEN` must be a real bot token before going live.

- [ ] **Step 6: Create `backend/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

- [ ] **Step 7: Create `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 8: Create `backend/src/app.module.ts` (minimal, no DB yet)**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

- [ ] **Step 9: Write the failing e2e test — `backend/test/health.e2e-spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

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

  it('GET /health returns status ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `404 Not Found` for `GET /health`.

- [ ] **Step 11: Create `backend/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 12: Register it — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold NestJS project with health check"
```

---

## Task 2: PostgreSQL schema — users, ledger_transactions, ledger_entries

**Files:**
- Create: `docker-compose.yml` (repo root)
- Create: `backend/src/users/user.entity.ts`
- Create: `backend/src/ledger/ledger-transaction.entity.ts`
- Create: `backend/src/ledger/ledger-entry.entity.ts`
- Create: `backend/src/data-source.ts`
- Create: `backend/src/migrations/1700000000000-InitSchema.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/database.e2e-spec.ts`

- [ ] **Step 1: Create `docker-compose.yml` at the repo root**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: telegram_casino
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Run: `docker compose up -d postgres` (from repo root)

- [ ] **Step 2: Create `backend/src/users/user.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('users')
@Unique(['telegramId'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'telegram_id', type: 'bigint' })
  telegramId: string;

  @Column({ name: 'username', type: 'varchar', nullable: true })
  username: string | null;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ name: 'language_code', type: 'varchar', nullable: true })
  languageCode: string | null;

  @Column({ name: 'consent_accepted_at', type: 'timestamptz', nullable: true })
  consentAcceptedAt: Date | null;

  @Column({ name: 'consent_version', type: 'varchar', nullable: true })
  consentVersion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 3: Create `backend/src/ledger/ledger-transaction.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type LedgerTransactionType = 'stars_deposit';

@Entity('ledger_transactions')
@Index(['type', 'externalRef'], { unique: true, where: '"external_ref" IS NOT NULL' })
export class LedgerTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'type', type: 'varchar' })
  type: LedgerTransactionType;

  @Column({ name: 'external_ref', type: 'varchar', nullable: true })
  externalRef: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 4: Create `backend/src/ledger/ledger-entry.entity.ts`**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ledger_entries')
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ name: 'account', type: 'varchar' })
  account: string;

  @Column({ name: 'amount_gram_cents', type: 'bigint' })
  amountGramCents: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

No `@ManyToOne` relation to `LedgerTransactionEntity` — a plain FK column is
enough since nothing navigates `entry.transaction`, and a `@ManyToOne`
without an explicit `@JoinColumn` makes TypeORM create its own
`transactionId` join column, colliding with the `transaction_id` column
from the migration.

- [ ] **Step 5: Create `backend/src/data-source.ts`**

```typescript
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
```

- [ ] **Step 6: Create `backend/src/migrations/1700000000000-InitSchema.ts`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegram_id" bigint NOT NULL,
        "username" varchar,
        "first_name" varchar,
        "language_code" varchar,
        "consent_accepted_at" timestamptz,
        "consent_version" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_telegram_id" UNIQUE ("telegram_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar NOT NULL,
        "external_ref" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ledger_transactions_type_external_ref"
      ON "ledger_transactions" ("type", "external_ref")
      WHERE "external_ref" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL REFERENCES "ledger_transactions"("id"),
        "account" varchar NOT NULL,
        "amount_gram_cents" bigint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_entries_account" ON "ledger_entries" ("account")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TABLE "ledger_transactions"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

- [ ] **Step 7: Write the failing e2e test — `backend/test/database.e2e-spec.ts`**

```typescript
import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { UserEntity } from '../src/users/user.entity';

describe('Database schema (e2e)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await AppDataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('persists a user and enforces unique telegram_id', async () => {
    const repo = dataSource.getRepository(UserEntity);
    const user = await repo.save(repo.create({ telegramId: '9999001' }));
    expect(user.id).toBeDefined();

    await expect(repo.save(repo.create({ telegramId: '9999001' }))).rejects.toThrow();

    await repo.delete({ telegramId: '9999001' });
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `relation "users" does not exist`.

- [ ] **Step 9: Apply the migration**

Run: `npm run migration:run`
Expected: log line confirming `InitSchema1700000000000` migration applied.

- [ ] **Step 10: Wire TypeORM into the app — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
      synchronize: false,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 11: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add docker-compose.yml backend/
git commit -m "feat(backend): add Postgres schema for users and double-entry ledger"
```

---

## Task 3: Telegram initData validation + UsersService

**Files:**
- Create: `backend/src/testing/build-init-data.ts`
- Create: `backend/src/auth/telegram-init-data.util.ts`
- Test: `backend/src/auth/telegram-init-data.util.spec.ts`
- Create: `backend/src/users/users.service.ts`
- Test: `backend/src/users/users.service.spec.ts`
- Create: `backend/src/users/users.module.ts`

- [ ] **Step 1: Create the shared test helper — `backend/src/testing/build-init-data.ts`**

```typescript
import { createHmac } from 'crypto';

export function buildValidTelegramInitData(
  botToken: string,
  overrides: Record<string, string> = {},
  authDate: number = Math.floor(Date.now() / 1000),
): string {
  const user =
    overrides.user ??
    JSON.stringify({ id: 42, username: 'alex', first_name: 'Alex', language_code: 'ru' });
  const fields: Record<string, string> = {
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    ...overrides,
    user,
  };

  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}
```

- [ ] **Step 2: Write the failing test — `backend/src/auth/telegram-init-data.util.spec.ts`**

```typescript
import { validateTelegramInitData } from './telegram-init-data.util';
import { buildValidTelegramInitData } from '../testing/build-init-data';

const BOT_TOKEN = 'test-bot-token-123456:ABCDEF';

describe('validateTelegramInitData', () => {
  it('accepts correctly signed initData and returns the user', () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN);
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(42);
    expect(result?.user.username).toBe('alex');
  });

  it('rejects initData with a tampered field', () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN);
    const tampered = initData.replace('alex', 'mallory');
    const result = validateTelegramInitData(tampered, BOT_TOKEN);
    expect(result).toBeNull();
  });

  it('rejects initData signed with a different bot token', () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN);
    const result = validateTelegramInitData(initData, 'different-token');
    expect(result).toBeNull();
  });

  it('rejects initData older than 24 hours', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    const initData = buildValidTelegramInitData(BOT_TOKEN, {}, oldAuthDate);
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- telegram-init-data.util`
Expected: FAIL — `Cannot find module './telegram-init-data.util'`.

- [ ] **Step 4: Create `backend/src/auth/telegram-init-data.util.ts`**

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export interface TelegramInitDataUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user: TelegramInitDataUser;
  authDate: number;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): ValidatedInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const hashBuffer = Buffer.from(hash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');
  if (hashBuffer.length !== computedBuffer.length || !timingSafeEqual(hashBuffer, computedBuffer)) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) {
    return null;
  }

  const userRaw = params.get('user');
  if (!userRaw) return null;
  const user = JSON.parse(userRaw) as TelegramInitDataUser;
  if (!user.id) return null;

  return { user, authDate };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- telegram-init-data.util`
Expected: PASS (all 4 cases)

- [ ] **Step 6: Write the failing test — `backend/src/users/users.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserEntity } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;
  const repoMock = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'generated-id', ...data })),
    findOneByOrFail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(UserEntity), useValue: repoMock }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('creates a new user when telegramId is not found', async () => {
    repoMock.findOne.mockResolvedValue(null);
    const user = await service.findOrCreateByTelegramProfile({ telegramId: '42', username: 'alex' });
    expect(user.id).toBe('generated-id');
    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '42', username: 'alex' }),
    );
  });

  it('updates and returns the existing user when telegramId is found', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'existing-id', telegramId: '42', username: 'old' });
    const user = await service.findOrCreateByTelegramProfile({ telegramId: '42', username: 'new' });
    expect(user.id).toBe('existing-id');
    expect(user.username).toBe('new');
  });

  it('records consent acceptance with a timestamp', async () => {
    repoMock.findOneByOrFail.mockResolvedValue({ id: 'existing-id', consentAcceptedAt: null });
    const user = await service.acceptConsent('existing-id', 'v1');
    expect(user.consentVersion).toBe('v1');
    expect(user.consentAcceptedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- users.service`
Expected: FAIL — `Cannot find module './users.service'`.

- [ ] **Step 8: Create `backend/src/users/users.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export interface TelegramProfile {
  telegramId: string;
  username?: string;
  firstName?: string;
  languageCode?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findOrCreateByTelegramProfile(profile: TelegramProfile): Promise<UserEntity> {
    const existing = await this.usersRepository.findOne({
      where: { telegramId: profile.telegramId },
    });
    if (existing) {
      existing.username = profile.username ?? existing.username;
      existing.firstName = profile.firstName ?? existing.firstName;
      existing.languageCode = profile.languageCode ?? existing.languageCode;
      return this.usersRepository.save(existing);
    }

    const created = this.usersRepository.create({
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      languageCode: profile.languageCode ?? null,
      consentAcceptedAt: null,
      consentVersion: null,
    });
    return this.usersRepository.save(created);
  }

  async acceptConsent(userId: string, consentVersion: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOneByOrFail({ id: userId });
    user.consentAcceptedAt = new Date();
    user.consentVersion = consentVersion;
    return this.usersRepository.save(user);
  }

  async findById(userId: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id: userId } });
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- users.service`
Expected: PASS (all 3 cases)

- [ ] **Step 10: Create `backend/src/users/users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 11: Commit**

```bash
git add backend/src/testing backend/src/auth backend/src/users
git commit -m "feat(backend): validate Telegram initData and add UsersService"
```

---

## Task 4: Auth module — POST /auth/telegram

**Files:**
- Create: `backend/src/auth/jwt.strategy.ts`
- Create: `backend/src/auth/jwt-auth.guard.ts`
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/auth.e2e-spec.ts`

- [ ] **Step 1: Create `backend/src/auth/jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  telegramId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
```

- [ ] **Step 2: Create `backend/src/auth/jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: Create `backend/src/auth/auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { validateTelegramInitData } from './telegram-init-data.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async loginWithInitData(initData: string): Promise<{ accessToken: string; userId: string }> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const validated = validateTelegramInitData(initData, botToken);
    if (!validated) {
      throw new UnauthorizedException('Invalid Telegram initData');
    }

    const user = await this.usersService.findOrCreateByTelegramProfile({
      telegramId: String(validated.user.id),
      username: validated.user.username,
      firstName: validated.user.first_name,
      languageCode: validated.user.language_code,
    });

    const accessToken = this.jwtService.sign({ sub: user.id, telegramId: user.telegramId });
    return { accessToken, userId: user.id };
  }
}
```

- [ ] **Step 4: Create `backend/src/auth/auth.controller.ts`**

```typescript
import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  @MinLength(1)
  initData: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async loginWithTelegram(@Body() dto: LoginDto) {
    try {
      return await this.authService.loginWithInitData(dto.initData);
    } catch {
      throw new UnauthorizedException('Invalid Telegram initData');
    }
  }
}
```

- [ ] **Step 5: Create `backend/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
```

- [ ] **Step 6: Wire it in — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Write the failing e2e test — `backend/test/auth.e2e-spec.ts`**

```typescript
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
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `Cannot find module './jwt.strategy'` (or similar, since the module didn't exist before this task started — confirms the new test file is exercising the new code path once created; if it already passes here something is wrong, double check Steps 1-6 were saved).

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS (both cases)

- [ ] **Step 10: Commit**

```bash
git add backend/src/auth backend/src/app.module.ts backend/test/auth.e2e-spec.ts
git commit -m "feat(backend): JWT login via Telegram initData"
```

---

## Task 5: Ledger module — recordTransaction + getBalance

**Files:**
- Create: `backend/src/ledger/ledger.service.ts`
- Create: `backend/src/ledger/ledger.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/ledger.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e test — `backend/test/ledger.e2e-spec.ts`**

```typescript
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { LedgerService, userAccount, DuplicateLedgerTransactionError } from '../src/ledger/ledger.service';

describe('LedgerService (e2e)', () => {
  let dataSource: DataSource;
  let ledgerService: LedgerService;
  const testUserId = randomUUID();

  beforeAll(async () => {
    dataSource = await AppDataSource.initialize();
    ledgerService = new LedgerService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('records a balanced transaction and updates the balance', async () => {
    await ledgerService.recordTransaction({
      type: 'stars_deposit',
      externalRef: `test-charge-${Date.now()}`,
      legs: [
        { account: 'system:stars_deposits', amountGramCents: BigInt(-1000) },
        { account: userAccount(testUserId), amountGramCents: BigInt(1000) },
      ],
    });

    const balance = await ledgerService.getBalance(userAccount(testUserId));
    expect(balance).toBe(BigInt(1000));
  });

  it('rejects legs that do not sum to zero', async () => {
    await expect(
      ledgerService.recordTransaction({
        type: 'stars_deposit',
        legs: [
          { account: 'system:stars_deposits', amountGramCents: BigInt(-1000) },
          { account: userAccount(testUserId), amountGramCents: BigInt(999) },
        ],
      }),
    ).rejects.toThrow('Ledger legs must sum to zero');
  });

  it('rejects a second transaction with the same type and externalRef', async () => {
    const externalRef = `test-charge-dup-${Date.now()}`;
    const legs = [
      { account: 'system:stars_deposits', amountGramCents: BigInt(-500) },
      { account: userAccount(testUserId), amountGramCents: BigInt(500) },
    ];

    await ledgerService.recordTransaction({ type: 'stars_deposit', externalRef, legs });

    await expect(
      ledgerService.recordTransaction({ type: 'stars_deposit', externalRef, legs }),
    ).rejects.toThrow(DuplicateLedgerTransactionError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `Cannot find module '../src/ledger/ledger.service'`.

- [ ] **Step 3: Create `backend/src/ledger/ledger.service.ts`**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LedgerTransactionEntity, LedgerTransactionType } from './ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger-entry.entity';

export interface LedgerLeg {
  account: string;
  amountGramCents: bigint;
}

export interface RecordTransactionInput {
  type: LedgerTransactionType;
  externalRef?: string;
  legs: LedgerLeg[];
}

export class DuplicateLedgerTransactionError extends Error {}

export function userAccount(userId: string): string {
  return `user:${userId}`;
}

@Injectable()
export class LedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async recordTransaction(input: RecordTransactionInput): Promise<LedgerTransactionEntity> {
    const sum = input.legs.reduce((total, leg) => total + leg.amountGramCents, BigInt(0));
    if (sum !== BigInt(0)) {
      throw new BadRequestException('Ledger legs must sum to zero');
    }
    if (input.legs.length < 2) {
      throw new BadRequestException('A transaction needs at least two legs');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const transaction = await manager.save(
          manager.create(LedgerTransactionEntity, {
            type: input.type,
            externalRef: input.externalRef ?? null,
          }),
        );

        for (const leg of input.legs) {
          await manager.save(
            manager.create(LedgerEntryEntity, {
              transactionId: transaction.id,
              account: leg.account,
              amountGramCents: leg.amountGramCents.toString(),
            }),
          );
        }

        return transaction;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new DuplicateLedgerTransactionError(
          `Transaction ${input.type}:${input.externalRef} already recorded`,
        );
      }
      throw error;
    }
  }

  async getBalance(account: string): Promise<bigint> {
    const result = await this.dataSource
      .getRepository(LedgerEntryEntity)
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.amount_gram_cents), 0)', 'total')
      .where('entry.account = :account', { account })
      .getRawOne<{ total: string }>();

    return BigInt(result?.total ?? '0');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Create `backend/src/ledger/ledger.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
```

- [ ] **Step 6: Wire it in — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    LedgerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/ledger backend/src/app.module.ts backend/test/ledger.e2e-spec.ts
git commit -m "feat(backend): double-entry ledger service with idempotent transactions"
```

---

## Task 6: Telegram Bot API client

**Files:**
- Create: `backend/src/telegram/telegram-bot-api.client.ts`
- Test: `backend/src/telegram/telegram-bot-api.client.spec.ts`
- Create: `backend/src/telegram/telegram.module.ts`

- [ ] **Step 1: Write the failing test — `backend/src/telegram/telegram-bot-api.client.spec.ts`**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- telegram-bot-api.client`
Expected: FAIL — `Cannot find module './telegram-bot-api.client'`.

- [ ] **Step 3: Create `backend/src/telegram/telegram-bot-api.client.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- telegram-bot-api.client`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Create `backend/src/telegram/telegram.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TelegramBotApiClient } from './telegram-bot-api.client';

@Module({
  providers: [TelegramBotApiClient],
  exports: [TelegramBotApiClient],
})
export class TelegramModule {}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/telegram
git commit -m "feat(backend): Telegram Bot API client for Stars invoices"
```

---

## Task 7: Telegram webhook — pre_checkout_query + successful_payment

**Files:**
- Create: `backend/src/telegram/telegram-webhook.controller.ts`
- Modify: `backend/src/telegram/telegram.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/telegram-webhook.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e test — `backend/test/telegram-webhook.e2e-spec.ts`**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `Cannot POST /telegram/webhook` (404), since the controller doesn't exist yet.

- [ ] **Step 3: Create `backend/src/telegram/telegram-webhook.controller.ts`**

```typescript
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
```

- [ ] **Step 4: Wire it in — replace `backend/src/telegram/telegram.module.ts` entirely with**

```typescript
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
```

- [ ] **Step 5: Register the module — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    LedgerModule,
    TelegramModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS (all 3 cases)

- [ ] **Step 7: Commit**

```bash
git add backend/src/telegram backend/src/app.module.ts backend/test/telegram-webhook.e2e-spec.ts
git commit -m "feat(backend): handle Telegram Stars webhook with idempotent crediting"
```

---

## Task 8: POST /deposits/stars/invoice

**Files:**
- Create: `backend/src/auth/current-user.decorator.ts`
- Create: `backend/src/deposits/deposits.controller.ts`
- Create: `backend/src/deposits/deposits.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/deposits.e2e-spec.ts`

- [ ] **Step 1: Create `backend/src/auth/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt.strategy';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as JwtPayload;
});
```

- [ ] **Step 2: Write the failing e2e test — `backend/test/deposits.e2e-spec.ts`**

```typescript
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

  it('rejects users who have not accepted consent', async () => {
    const { token } = await loginAndGetToken(700001);

    await request(app.getHttpServer())
      .post('/deposits/stars/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountStars: 100 })
      .expect(403);
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `Cannot POST /deposits/stars/invoice` (404).

- [ ] **Step 4: Create `backend/src/deposits/deposits.controller.ts`**

```typescript
import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import { TelegramBotApiClient } from '../telegram/telegram-bot-api.client';

class CreateStarsInvoiceDto {
  @IsInt()
  @Min(1)
  amountStars: number;
}

@Controller('deposits/stars')
@UseGuards(JwtAuthGuard)
export class DepositsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly botApiClient: TelegramBotApiClient,
  ) {}

  @Post('invoice')
  async createInvoice(@CurrentUser() currentUser: JwtPayload, @Body() dto: CreateStarsInvoiceDto) {
    const depositsEnabled = (this.configService.get<string>('DEPOSITS_ENABLED') ?? 'true') === 'true';
    if (!depositsEnabled) {
      throw new ServiceUnavailableException('Deposits are temporarily disabled');
    }

    const user = await this.usersService.findById(currentUser.sub);
    if (!user?.consentAcceptedAt) {
      throw new ForbiddenException('Accept the platform rules before depositing');
    }

    const invoiceLink = await this.botApiClient.createStarsInvoiceLink({
      title: 'Пополнение баланса',
      description: `${dto.amountStars} Stars`,
      payload: user.id,
      amountStars: dto.amountStars,
    });

    return { invoiceLink };
  }
}
```

- [ ] **Step 5: Create `backend/src/deposits/deposits.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [UsersModule, TelegramModule],
  controllers: [DepositsController],
})
export class DepositsModule {}
```

- [ ] **Step 6: Register the module — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { TelegramModule } from './telegram/telegram.module';
import { DepositsModule } from './deposits/deposits.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    LedgerModule,
    TelegramModule,
    DepositsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS (all 4 cases)

- [ ] **Step 8: Commit**

```bash
git add backend/src/auth/current-user.decorator.ts backend/src/deposits backend/src/app.module.ts backend/test/deposits.e2e-spec.ts
git commit -m "feat(backend): POST /deposits/stars/invoice with consent and kill-switch checks"
```

---

## Task 9: GET /me, GET /me/balance, POST /me/consent

**Files:**
- Create: `backend/src/me/me.controller.ts`
- Create: `backend/src/me/me.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/me.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e test — `backend/test/me.e2e-spec.ts`**

```typescript
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
    const token = await login(800001);

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
    const token = await login(800002);

    const response = await request(app.getHttpServer())
      .get('/me/balance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.balanceGram).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL — `Cannot GET /me` (404).

- [ ] **Step 3: Create `backend/src/me/me.controller.ts`**

```typescript
import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import { LedgerService, userAccount } from '../ledger/ledger.service';

class AcceptConsentDto {
  @IsString()
  @MinLength(1)
  consentVersion: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ledgerService: LedgerService,
  ) {}

  @Get()
  async getProfile(@CurrentUser() currentUser: JwtPayload) {
    const user = await this.usersService.findById(currentUser.sub);
    if (!user) throw new ForbiddenException();

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      hasAcceptedConsent: !!user.consentAcceptedAt,
    };
  }

  @Get('balance')
  async getBalance(@CurrentUser() currentUser: JwtPayload) {
    const balanceGramCents = await this.ledgerService.getBalance(userAccount(currentUser.sub));
    return { balanceGram: Number(balanceGramCents) / 100 };
  }

  @Post('consent')
  async acceptConsent(@CurrentUser() currentUser: JwtPayload, @Body() dto: AcceptConsentDto) {
    const user = await this.usersService.acceptConsent(currentUser.sub, dto.consentVersion);
    return { hasAcceptedConsent: !!user.consentAcceptedAt };
  }
}
```

- [ ] **Step 4: Create `backend/src/me/me.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { UsersModule } from '../users/users.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [UsersModule, LedgerModule],
  controllers: [MeController],
})
export class MeModule {}
```

- [ ] **Step 5: Register the module — replace `backend/src/app.module.ts` entirely with**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { TelegramModule } from './telegram/telegram.module';
import { DepositsModule } from './deposits/deposits.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    LedgerModule,
    TelegramModule,
    DepositsModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS (all cases across the whole e2e suite)

- [ ] **Step 7: Commit**

```bash
git add backend/src/me backend/src/app.module.ts backend/test/me.e2e-spec.ts
git commit -m "feat(backend): profile, balance and consent endpoints"
```

This completes the backend. From here, the frontend consumes: `POST /auth/telegram`, `GET /me`, `GET /me/balance`, `POST /me/consent`, `POST /deposits/stars/invoice`.

---

## Task 10: Frontend scaffold — Vite + React + TS + Tailwind

**Files:**
- Create: `frontend/.gitignore`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/index.css`
- Create: `frontend/src/test-setup.ts`
- Create: `frontend/src/telegram/telegram-webapp.d.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "telegram-casino-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

Run: `npm install` (inside `frontend/`)

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
  },
});
```

- [ ] **Step 5: Create `frontend/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Telegram Casino</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D0D0D',
        surface: '#111118',
        accent: { DEFAULT: '#7C3AED', light: '#A855F7' },
        gold: { DEFAULT: '#F59E0B', light: '#FBBF24' },
        danger: '#EF4444',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #7C3AED, #A855F7)',
        'gold-gradient': 'linear-gradient(135deg, #F59E0B, #FBBF24)',
      },
      borderRadius: {
        card: '16px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 8: Create `frontend/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Create `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0D0D0D;
  color: #FFFFFF;
  font-family: -apple-system, 'SF Pro Display', Inter, Roboto, sans-serif;
}
```

- [ ] **Step 10: Create `frontend/src/telegram/telegram-webapp.d.ts`**

```typescript
export interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  ready(): void;
  expand(): void;
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
  openInvoice(url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
```

- [ ] **Step 11: Write the failing test — `frontend/src/App.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the app shell', () => {
    render(<App />);
    expect(screen.getByText('Telegram Casino')).toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './App'`.

- [ ] **Step 13: Create `frontend/src/App.tsx`**

```typescript
export function App() {
  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center">
      <p>Telegram Casino</p>
    </div>
  );
}
```

- [ ] **Step 14: Create `frontend/src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

window.Telegram?.WebApp.ready();
window.Telegram?.WebApp.expand();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 15: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 16: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Vite/React/Tailwind Telegram Mini App"
```

---

## Task 11: Auth flow — exchange initData for a JWT

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/auth/useTelegramAuth.ts`
- Test: `frontend/src/auth/useTelegramAuth.test.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `frontend/src/api/client.ts`**

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

- [ ] **Step 2: Write the failing test — `frontend/src/auth/useTelegramAuth.test.ts`**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useTelegramAuth } from './useTelegramAuth';

describe('useTelegramAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('authenticates using Telegram initData', async () => {
    window.Telegram = {
      WebApp: {
        initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc',
        initDataUnsafe: {},
        ready: vi.fn(),
        expand: vi.fn(),
        HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
        openInvoice: vi.fn(),
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'jwt-token', userId: 'user-1' }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTelegramAuth());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.userId).toBe('user-1');
  });

  it('reports an error when not running inside Telegram', async () => {
    window.Telegram = undefined;

    const { result } = renderHook(() => useTelegramAuth());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Not running inside Telegram');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './useTelegramAuth'`.

- [ ] **Step 4: Create `frontend/src/auth/useTelegramAuth.ts`**

```typescript
import { useEffect, useState } from 'react';
import { apiFetch, setAccessToken } from '../api/client';

export interface AuthState {
  status: 'loading' | 'authenticated' | 'error';
  userId: string | null;
  error: string | null;
}

interface LoginResponse {
  accessToken: string;
  userId: string;
}

export function useTelegramAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading', userId: null, error: null });

  useEffect(() => {
    const initData = window.Telegram?.WebApp.initData;
    if (!initData) {
      setState({ status: 'error', userId: null, error: 'Not running inside Telegram' });
      return;
    }

    apiFetch<LoginResponse>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    })
      .then((response) => {
        setAccessToken(response.accessToken);
        setState({ status: 'authenticated', userId: response.userId, error: null });
      })
      .catch((error: Error) => {
        setState({ status: 'error', userId: null, error: error.message });
      });
  }, []);

  return state;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (both cases)

- [ ] **Step 6: Wire it into the shell — replace `frontend/src/App.tsx` entirely with**

```typescript
import { useTelegramAuth } from './auth/useTelegramAuth';

export function App() {
  const auth = useTelegramAuth();

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-4 text-center">
        <p>Не удалось войти: {auth.error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center">
      <p>Telegram Casino</p>
    </div>
  );
}
```

- [ ] **Step 7: Update the shell test — replace `frontend/src/App.test.tsx` entirely with**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the app shell once authenticated', async () => {
    window.Telegram = {
      WebApp: {
        initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc',
        initDataUnsafe: {},
        ready: vi.fn(),
        expand: vi.fn(),
        HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
        openInvoice: vi.fn(),
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'jwt-token', userId: 'user-1' }),
    }) as unknown as typeof fetch;

    render(<App />);

    await waitFor(() => expect(screen.getByText('Telegram Casino')).toBeInTheDocument());
  });
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api frontend/src/auth frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): authenticate via Telegram initData"
```

---

## Task 12: Consent gate (18+ / rules)

**Files:**
- Create: `frontend/src/api/me.ts`
- Create: `frontend/src/consent/ConsentGate.tsx`
- Test: `frontend/src/consent/ConsentGate.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `frontend/src/api/me.ts`**

```typescript
import { apiFetch } from './client';

export interface MeProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  hasAcceptedConsent: boolean;
}

export function fetchMe(): Promise<MeProfile> {
  return apiFetch<MeProfile>('/me');
}

export function acceptConsent(consentVersion: string): Promise<{ hasAcceptedConsent: boolean }> {
  return apiFetch('/me/consent', {
    method: 'POST',
    body: JSON.stringify({ consentVersion }),
  });
}
```

- [ ] **Step 2: Write the failing test — `frontend/src/consent/ConsentGate.test.tsx`**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsentGate } from './ConsentGate';
import * as meApi from '../api/me';

describe('ConsentGate', () => {
  it('calls onAccepted after successfully submitting consent', async () => {
    vi.spyOn(meApi, 'acceptConsent').mockResolvedValue({ hasAcceptedConsent: true });
    const onAccepted = vi.fn();

    render(<ConsentGate onAccepted={onAccepted} />);
    fireEvent.click(screen.getByText('Мне есть 18, принимаю правила'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
  });

  it('shows an error message when the request fails', async () => {
    vi.spyOn(meApi, 'acceptConsent').mockRejectedValue(new Error('network error'));

    render(<ConsentGate onAccepted={vi.fn()} />);
    fireEvent.click(screen.getByText('Мне есть 18, принимаю правила'));

    await waitFor(() =>
      expect(screen.getByText('Не удалось сохранить согласие, попробуйте ещё раз')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './ConsentGate'`.

- [ ] **Step 4: Create `frontend/src/consent/ConsentGate.tsx`**

```typescript
import { useState } from 'react';
import { acceptConsent } from '../api/me';

export const CONSENT_VERSION = 'v1';

interface ConsentGateProps {
  onAccepted: () => void;
}

export function ConsentGate({ onAccepted }: ConsentGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      await acceptConsent(CONSENT_VERSION);
      onAccepted();
    } catch {
      setError('Не удалось сохранить согласие, попробуйте ещё раз');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-white flex flex-col items-center justify-center px-6 text-center gap-4">
      <h1 className="text-xl font-bold">Платформа для лиц 18+</h1>
      <p className="text-sm text-gray-400">
        Продолжая, вы подтверждаете, что вам есть 18 лет и вы согласны с правилами платформы.
      </p>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button
        onClick={handleAccept}
        disabled={submitting}
        className="bg-accent-gradient rounded-card h-14 px-8 font-bold disabled:opacity-50"
      >
        {submitting ? 'Сохранение…' : 'Мне есть 18, принимаю правила'}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (both cases)

- [ ] **Step 6: Wire it into the shell — replace `frontend/src/App.tsx` entirely with**

```typescript
import { useEffect, useState } from 'react';
import { useTelegramAuth } from './auth/useTelegramAuth';
import { fetchMe, MeProfile } from './api/me';
import { ConsentGate } from './consent/ConsentGate';

export function App() {
  const auth = useTelegramAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      fetchMe().then(setProfile).catch(() => setProfile(null));
    }
  }, [auth.status]);

  if (auth.status === 'loading' || (auth.status === 'authenticated' && !profile)) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-4 text-center">
        <p>Не удалось войти: {auth.error}</p>
      </div>
    );
  }

  if (profile && !profile.hasAcceptedConsent) {
    return <ConsentGate onAccepted={() => setProfile({ ...profile, hasAcceptedConsent: true })} />;
  }

  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center">
      <p>Telegram Casino</p>
    </div>
  );
}
```

- [ ] **Step 7: Update the shell test — replace `frontend/src/App.test.tsx` entirely with**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

function mockTelegramWebApp() {
  window.Telegram = {
    WebApp: {
      initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc',
      initDataUnsafe: {},
      ready: vi.fn(),
      expand: vi.fn(),
      HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
      openInvoice: vi.fn(),
    },
  };
}

function mockAuthenticatedFetch(hasAcceptedConsent: boolean) {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/auth/telegram')) {
      return Promise.resolve({ ok: true, json: async () => ({ accessToken: 'jwt', userId: 'user-1' }) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: 'user-1', username: 'alex', firstName: 'Alex', hasAcceptedConsent }),
    });
  }) as unknown as typeof fetch;
}

describe('App', () => {
  it('renders the app shell once authenticated and consent is already accepted', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Telegram Casino')).toBeInTheDocument());
  });

  it('shows the consent gate when the profile has not accepted consent yet', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(false);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Мне есть 18, принимаю правила')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test`
Expected: PASS (both cases)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api/me.ts frontend/src/consent frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): 18+/rules consent gate"
```

---

## Task 13: TabBar navigation shell (5 tabs, 4 stubs)

**Files:**
- Create: `frontend/src/navigation/TabBar.tsx`
- Create: `frontend/src/navigation/ComingSoonScreen.tsx`
- Test: `frontend/src/navigation/TabBar.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing test — `frontend/src/navigation/TabBar.test.tsx`**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders all five tabs and highlights the active one', () => {
    render(<TabBar activeTab="profile" onChange={vi.fn()} />);
    expect(screen.getByText('Профиль')).toHaveClass('text-accent-light');
    expect(screen.getByText('ПвП')).toHaveClass('text-gray-500');
  });

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn();
    render(<TabBar activeTab="profile" onChange={onChange} />);
    fireEvent.click(screen.getByText('Соло'));
    expect(onChange).toHaveBeenCalledWith('solo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './TabBar'`.

- [ ] **Step 3: Create `frontend/src/navigation/TabBar.tsx`**

```typescript
export type TabId = 'pvp' | 'solo' | 'shop' | 'rewards' | 'profile';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

export const TABS: Tab[] = [
  { id: 'pvp', label: 'ПвП', icon: '⚔️' },
  { id: 'solo', label: 'Соло', icon: '🎮' },
  { id: 'shop', label: 'Магазин', icon: '🛍️' },
  { id: 'rewards', label: 'Награды', icon: '🎁' },
  { id: 'profile', label: 'Профиль', icon: '👤' },
];

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 flex justify-around py-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex flex-col items-center gap-1 text-xs ${
            activeTab === tab.id ? 'text-accent-light' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (both cases)

- [ ] **Step 5: Create `frontend/src/navigation/ComingSoonScreen.tsx`**

```typescript
interface ComingSoonScreenProps {
  title: string;
}

export function ComingSoonScreen({ title }: ComingSoonScreenProps) {
  return (
    <div className="min-h-screen bg-bg text-white flex flex-col items-center justify-center pb-20">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <p className="text-gray-500">Скоро</p>
    </div>
  );
}
```

- [ ] **Step 6: Wire it into the shell — replace `frontend/src/App.tsx` entirely with**

```typescript
import { useEffect, useState } from 'react';
import { useTelegramAuth } from './auth/useTelegramAuth';
import { fetchMe, MeProfile } from './api/me';
import { ConsentGate } from './consent/ConsentGate';
import { TabBar, TabId } from './navigation/TabBar';
import { ComingSoonScreen } from './navigation/ComingSoonScreen';

const TAB_TITLES: Record<Exclude<TabId, 'profile'>, string> = {
  pvp: 'ПвП',
  solo: 'Соло',
  shop: 'Магазин',
  rewards: 'Награды',
};

export function App() {
  const auth = useTelegramAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('pvp');

  useEffect(() => {
    if (auth.status === 'authenticated') {
      fetchMe().then(setProfile).catch(() => setProfile(null));
    }
  }, [auth.status]);

  if (auth.status === 'loading' || (auth.status === 'authenticated' && !profile)) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-4 text-center">
        <p>Не удалось войти: {auth.error}</p>
      </div>
    );
  }

  if (profile && !profile.hasAcceptedConsent) {
    return <ConsentGate onAccepted={() => setProfile({ ...profile, hasAcceptedConsent: true })} />;
  }

  return (
    <>
      {activeTab === 'profile' ? (
        <div className="min-h-screen bg-bg text-white flex items-center justify-center pb-20">
          <p>Telegram Casino</p>
        </div>
      ) : (
        <ComingSoonScreen title={TAB_TITLES[activeTab]} />
      )}
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
    </>
  );
}
```

- [ ] **Step 7: Update the shell test — replace `frontend/src/App.test.tsx` entirely with**

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

function mockTelegramWebApp() {
  window.Telegram = {
    WebApp: {
      initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc',
      initDataUnsafe: {},
      ready: vi.fn(),
      expand: vi.fn(),
      HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
      openInvoice: vi.fn(),
    },
  };
}

function mockAuthenticatedFetch(hasAcceptedConsent: boolean) {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/auth/telegram')) {
      return Promise.resolve({ ok: true, json: async () => ({ accessToken: 'jwt', userId: 'user-1' }) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: 'user-1', username: 'alex', firstName: 'Alex', hasAcceptedConsent }),
    });
  }) as unknown as typeof fetch;
}

describe('App', () => {
  it('shows the PvP coming-soon screen by default after authentication', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Скоро')).toBeInTheDocument());
    expect(screen.getByText('ПвП', { selector: 'h2' })).toBeInTheDocument();
  });

  it('shows the consent gate when the profile has not accepted consent yet', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(false);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Мне есть 18, принимаю правила')).toBeInTheDocument(),
    );
  });

  it('navigates to the Profile tab and shows the app shell', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Скоро')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Профиль'));

    expect(screen.getByText('Telegram Casino')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 3 cases)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/navigation frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): tabbar navigation shell with coming-soon placeholders"
```

---

## Task 14: Header + balance + Stars deposit modal

**Files:**
- Create: `frontend/src/api/balance.ts`
- Create: `frontend/src/api/deposits.ts`
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/DepositModal.tsx`
- Test: `frontend/src/components/DepositModal.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `frontend/src/api/balance.ts`**

```typescript
import { apiFetch } from './client';

export interface BalanceResponse {
  balanceGram: number;
}

export function fetchBalance(): Promise<BalanceResponse> {
  return apiFetch<BalanceResponse>('/me/balance');
}
```

- [ ] **Step 2: Create `frontend/src/api/deposits.ts`**

```typescript
import { apiFetch } from './client';

export interface CreateStarsInvoiceResponse {
  invoiceLink: string;
}

export function createStarsInvoice(amountStars: number): Promise<CreateStarsInvoiceResponse> {
  return apiFetch<CreateStarsInvoiceResponse>('/deposits/stars/invoice', {
    method: 'POST',
    body: JSON.stringify({ amountStars }),
  });
}
```

- [ ] **Step 3: Write the failing test — `frontend/src/components/DepositModal.test.tsx`**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DepositModal } from './DepositModal';
import * as depositsApi from '../api/deposits';

describe('DepositModal', () => {
  it('opens the Telegram invoice and calls onDeposited when paid', async () => {
    vi.spyOn(depositsApi, 'createStarsInvoice').mockResolvedValue({
      invoiceLink: 'https://t.me/invoice/xyz',
    });
    const openInvoice = vi.fn((_url: string, callback: (status: string) => void) => callback('paid'));
    window.Telegram = {
      WebApp: {
        initData: '',
        initDataUnsafe: {},
        ready: vi.fn(),
        expand: vi.fn(),
        HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
        openInvoice,
      },
    };

    const onDeposited = vi.fn();
    const onClose = vi.fn();
    render(<DepositModal onClose={onClose} onDeposited={onDeposited} />);

    fireEvent.click(screen.getByText('⭐ 500'));
    fireEvent.click(screen.getByText('Оплатить ⭐ 500'));

    await waitFor(() => expect(onDeposited).toHaveBeenCalled());
    expect(openInvoice).toHaveBeenCalledWith('https://t.me/invoice/xyz', expect.any(Function));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error when invoice creation fails', async () => {
    vi.spyOn(depositsApi, 'createStarsInvoice').mockRejectedValue(new Error('network error'));

    render(<DepositModal onClose={vi.fn()} onDeposited={vi.fn()} />);
    fireEvent.click(screen.getByText('Оплатить ⭐ 100'));

    await waitFor(() =>
      expect(screen.getByText('Не удалось создать счёт, попробуйте ещё раз')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './DepositModal'`.

- [ ] **Step 5: Create `frontend/src/components/DepositModal.tsx`**

```typescript
import { useState } from 'react';
import { createStarsInvoice } from '../api/deposits';

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

interface DepositModalProps {
  onClose: () => void;
  onDeposited: () => void;
}

export function DepositModal({ onClose, onDeposited }: DepositModalProps) {
  const [amount, setAmount] = useState(QUICK_AMOUNTS[0]);
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');

  async function handlePay() {
    setStatus('creating');
    try {
      const { invoiceLink } = await createStarsInvoice(amount);
      window.Telegram?.WebApp.openInvoice(invoiceLink, (invoiceStatus) => {
        if (invoiceStatus === 'paid') {
          onDeposited();
          onClose();
        } else {
          setStatus('idle');
        }
      });
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
      <div className="bg-surface rounded-t-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">Пополнить баланс</h2>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              onClick={() => setAmount(value)}
              className={`h-12 rounded-card border ${
                amount === value ? 'border-accent bg-accent/20' : 'border-white/10'
              }`}
            >
              ⭐ {value}
            </button>
          ))}
        </div>
        {status === 'error' && (
          <p className="text-danger text-sm">Не удалось создать счёт, попробуйте ещё раз</p>
        )}
        <button
          onClick={handlePay}
          disabled={status === 'creating'}
          className="bg-accent-gradient rounded-card h-14 font-bold disabled:opacity-50"
        >
          {status === 'creating' ? 'Открываем оплату…' : `Оплатить ⭐ ${amount}`}
        </button>
        <button onClick={onClose} className="text-gray-500 text-sm">
          Закрыть
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (both cases)

- [ ] **Step 7: Create `frontend/src/components/Header.tsx`**

```typescript
interface HeaderProps {
  balanceGram: number;
  onDepositClick: () => void;
}

export function Header({ balanceGram, onDepositClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-surface/90 backdrop-blur flex items-center justify-between px-4 py-3 z-40">
      <span className="font-bold">{balanceGram.toFixed(2)} Gram</span>
      <button
        onClick={onDepositClick}
        className="bg-accent-gradient rounded-pill px-4 py-2 text-sm font-bold flex items-center gap-1"
      >
        + Пополнить
      </button>
    </header>
  );
}
```

- [ ] **Step 8: Wire it into the shell — replace `frontend/src/App.tsx` entirely with**

```typescript
import { useEffect, useState } from 'react';
import { useTelegramAuth } from './auth/useTelegramAuth';
import { fetchMe, MeProfile } from './api/me';
import { fetchBalance } from './api/balance';
import { ConsentGate } from './consent/ConsentGate';
import { TabBar, TabId } from './navigation/TabBar';
import { ComingSoonScreen } from './navigation/ComingSoonScreen';
import { Header } from './components/Header';
import { DepositModal } from './components/DepositModal';

const TAB_TITLES: Record<Exclude<TabId, 'profile'>, string> = {
  pvp: 'ПвП',
  solo: 'Соло',
  shop: 'Магазин',
  rewards: 'Награды',
};

export function App() {
  const auth = useTelegramAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [balanceGram, setBalanceGram] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('pvp');
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      fetchMe().then(setProfile).catch(() => setProfile(null));
    }
  }, [auth.status]);

  useEffect(() => {
    if (profile?.hasAcceptedConsent) {
      fetchBalance().then((response) => setBalanceGram(response.balanceGram));
    }
  }, [profile?.hasAcceptedConsent]);

  if (auth.status === 'loading' || (auth.status === 'authenticated' && !profile)) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-4 text-center">
        <p>Не удалось войти: {auth.error}</p>
      </div>
    );
  }

  if (profile && !profile.hasAcceptedConsent) {
    return <ConsentGate onAccepted={() => setProfile({ ...profile, hasAcceptedConsent: true })} />;
  }

  return (
    <>
      <Header balanceGram={balanceGram} onDepositClick={() => setDepositModalOpen(true)} />
      <div className="pt-16">
        {activeTab === 'profile' ? (
          <div className="min-h-screen bg-bg text-white flex items-center justify-center pb-20">
            <p>Telegram Casino</p>
          </div>
        ) : (
          <ComingSoonScreen title={TAB_TITLES[activeTab]} />
        )}
      </div>
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      {depositModalOpen && (
        <DepositModal
          onClose={() => setDepositModalOpen(false)}
          onDeposited={() => fetchBalance().then((response) => setBalanceGram(response.balanceGram))}
        />
      )}
    </>
  );
}
```

- [ ] **Step 9: Update the shell test — replace `frontend/src/App.test.tsx` entirely with**

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

function mockTelegramWebApp() {
  window.Telegram = {
    WebApp: {
      initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc',
      initDataUnsafe: {},
      ready: vi.fn(),
      expand: vi.fn(),
      HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
      openInvoice: vi.fn(),
    },
  };
}

function mockAuthenticatedFetch(hasAcceptedConsent: boolean) {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/auth/telegram')) {
      return Promise.resolve({ ok: true, json: async () => ({ accessToken: 'jwt', userId: 'user-1' }) });
    }
    if (url.includes('/me/balance')) {
      return Promise.resolve({ ok: true, json: async () => ({ balanceGram: 42.5 }) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: 'user-1', username: 'alex', firstName: 'Alex', hasAcceptedConsent }),
    });
  }) as unknown as typeof fetch;
}

describe('App', () => {
  it('shows the PvP coming-soon screen and balance by default after authentication', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Скоро')).toBeInTheDocument());
    expect(screen.getByText('ПвП', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('42.50 Gram')).toBeInTheDocument());
  });

  it('shows the consent gate when the profile has not accepted consent yet', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(false);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Мне есть 18, принимаю правила')).toBeInTheDocument(),
    );
  });

  it('opens the deposit modal from the header', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);
    await waitFor(() => expect(screen.getByText('+ Пополнить')).toBeInTheDocument());

    fireEvent.click(screen.getByText('+ Пополнить'));

    expect(screen.getByText('Пополнить баланс')).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 3 cases)

- [ ] **Step 11: Commit**

```bash
git add frontend/src/api/balance.ts frontend/src/api/deposits.ts frontend/src/components frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): header balance and Stars deposit modal"
```

---

## Task 15: Profile screen

**Files:**
- Create: `frontend/src/screens/ProfileScreen.tsx`
- Test: `frontend/src/screens/ProfileScreen.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing test — `frontend/src/screens/ProfileScreen.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileScreen } from './ProfileScreen';

describe('ProfileScreen', () => {
  it('renders the display name, balance, and empty stats', () => {
    render(
      <ProfileScreen
        profile={{ id: '1', username: 'alex', firstName: 'Alex', hasAcceptedConsent: true }}
        balanceGram={123.45}
      />,
    );

    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('@alex')).toBeInTheDocument();
    expect(screen.getByText('123.45 Gram')).toBeInTheDocument();
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './ProfileScreen'`.

- [ ] **Step 3: Create `frontend/src/screens/ProfileScreen.tsx`**

```typescript
import { MeProfile } from '../api/me';

interface ProfileScreenProps {
  profile: MeProfile;
  balanceGram: number;
}

export function ProfileScreen({ profile, balanceGram }: ProfileScreenProps) {
  return (
    <div className="min-h-screen bg-bg text-white px-4 pb-24 flex flex-col gap-6">
      <section className="flex items-center gap-3 mt-2">
        <div className="w-14 h-14 rounded-full bg-accent-gradient flex items-center justify-center font-bold text-lg">
          {(profile.firstName ?? profile.username ?? '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold">{profile.firstName ?? profile.username ?? 'Игрок'}</p>
          {profile.username && <p className="text-gray-500 text-sm">@{profile.username}</p>}
        </div>
      </section>

      <section className="bg-surface rounded-card p-4">
        <p className="text-gray-500 text-sm">Баланс</p>
        <p className="text-2xl font-bold">{balanceGram.toFixed(2)} Gram</p>
      </section>

      <section className="bg-surface rounded-card p-4">
        <p className="font-bold mb-2">Статистика</p>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
          <p>Выигрышей: 0</p>
          <p>Проигрышей: 0</p>
          <p>Лучший множитель: —</p>
          <p>Всего игр: 0</p>
        </div>
      </section>

      <section className="bg-surface rounded-card p-4">
        <p className="font-bold mb-2">Инвентарь</p>
        <p className="text-gray-500 text-sm">Пока пусто</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Use it in the shell — replace `frontend/src/App.tsx` entirely with**

```typescript
import { useEffect, useState } from 'react';
import { useTelegramAuth } from './auth/useTelegramAuth';
import { fetchMe, MeProfile } from './api/me';
import { fetchBalance } from './api/balance';
import { ConsentGate } from './consent/ConsentGate';
import { TabBar, TabId } from './navigation/TabBar';
import { ComingSoonScreen } from './navigation/ComingSoonScreen';
import { Header } from './components/Header';
import { DepositModal } from './components/DepositModal';
import { ProfileScreen } from './screens/ProfileScreen';

const TAB_TITLES: Record<Exclude<TabId, 'profile'>, string> = {
  pvp: 'ПвП',
  solo: 'Соло',
  shop: 'Магазин',
  rewards: 'Награды',
};

export function App() {
  const auth = useTelegramAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [balanceGram, setBalanceGram] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('pvp');
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      fetchMe().then(setProfile).catch(() => setProfile(null));
    }
  }, [auth.status]);

  useEffect(() => {
    if (profile?.hasAcceptedConsent) {
      fetchBalance().then((response) => setBalanceGram(response.balanceGram));
    }
  }, [profile?.hasAcceptedConsent]);

  if (auth.status === 'loading' || (auth.status === 'authenticated' && !profile)) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-4 text-center">
        <p>Не удалось войти: {auth.error}</p>
      </div>
    );
  }

  if (profile && !profile.hasAcceptedConsent) {
    return <ConsentGate onAccepted={() => setProfile({ ...profile, hasAcceptedConsent: true })} />;
  }

  if (!profile) return null;

  return (
    <>
      <Header balanceGram={balanceGram} onDepositClick={() => setDepositModalOpen(true)} />
      <div className="pt-16">
        {activeTab === 'profile' ? (
          <ProfileScreen profile={profile} balanceGram={balanceGram} />
        ) : (
          <ComingSoonScreen title={TAB_TITLES[activeTab]} />
        )}
      </div>
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      {depositModalOpen && (
        <DepositModal
          onClose={() => setDepositModalOpen(false)}
          onDeposited={() => fetchBalance().then((response) => setBalanceGram(response.balanceGram))}
        />
      )}
    </>
  );
}
```

- [ ] **Step 6: Update the shell test — modify `frontend/src/App.test.tsx`, replacing the third test (`'opens the deposit modal from the header'`) with two tests that also cover Profile navigation**

Replace the last `it(...)` block in the file with:

```typescript
  it('opens the deposit modal from the header', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);
    await waitFor(() => expect(screen.getByText('+ Пополнить')).toBeInTheDocument());

    fireEvent.click(screen.getByText('+ Пополнить'));

    expect(screen.getByText('Пополнить баланс')).toBeInTheDocument();
  });

  it('navigates to the Profile tab and shows profile details', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Скоро')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Профиль'));

    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('@alex')).toBeInTheDocument();
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all 4 cases)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/screens frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): real Profile screen with balance, stats and inventory stubs"
```

---

## Self-Review

**Spec coverage** — checked against `docs/superpowers/specs/2026-09-21-core-platform-design.md`:
- A. Repo structure → Task 1, 10.
- B. Auth (initData HMAC → JWT) → Task 3, 4, 11.
- C. Single internal currency, double-entry ledger → Task 2, 5.
- D. Stars deposit v1, idempotent → Task 6, 7, 8, 14.
- E. Navigation (5 tabs, only Profile functional) + deposit button always visible → Task 13, 14, 15.
- F. 18+/rules consent gate, kill-switch, ledger auditability → Task 8 (kill-switch), 9/12 (consent).
- G. Testing (auth validation, deposit idempotency, ledger invariant) → present throughout; idempotency explicitly covered in Task 7's third test case.

**Placeholder scan** — no TBD/TODO/"add error handling" left; every step has concrete code or an exact command.

**Type consistency** — `JwtPayload { sub, telegramId }` used identically in `jwt.strategy.ts`, `current-user.decorator.ts`, `deposits.controller.ts`, `me.controller.ts`. `userAccount()` and `LedgerService` method names match across Tasks 5, 7, 9. `MeProfile` shape matches between `api/me.ts` and `ProfileScreen.tsx` across Tasks 12 and 15.

**Not in this plan** (per spec's "Вне рамок"): TON Connect/Gifts/@CryptoBot, the six in-house games, NFT shop, staking, referrals, leaderboard, slots/live aggregator, admin panel, real IP-based geo-block — each is its own future subproject.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-21-core-platform.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
