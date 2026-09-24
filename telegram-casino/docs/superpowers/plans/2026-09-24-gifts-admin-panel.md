# Gifts Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the project owner (Telegram ID `6742434708`) add/remove real NFT gifts in the Магазин → Gifts screen by pasting a `t.me/nft/<slug>` link, with all trait data and the model's picture auto-filled and only price entered by hand.

**Architecture:** A new NestJS `GiftsModule` (entity + migration + service + controller) behind a new `AdminGuard`, backed by a Postgres `gifts` table. A small standalone Python/Telethon script (`services/gift-resolver/resolve_gift.py`, session already live on the VPS) does the actual Telegram lookup; the backend spawns it as a child process per request rather than running a persistent service. The frontend gets a real `GET /gifts` fetch (replacing the current hardcoded empty array) and a new admin-only 5th tab.

**Tech Stack:** Backend: NestJS 10, TypeORM 0.3, PostgreSQL, Jest+Supertest. Resolver: Python 3.10, Telethon 1.45 (already installed in a venv on the VPS). Frontend: React 18, TypeScript, Vite, Tailwind, Vitest+Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-gifts-admin-panel-design.md`

## Global Constraints

- Admin gate is `currentUser.telegramId === process.env.ADMIN_TELEGRAM_ID` — never hardcode the ID `6742434708` in source, only in `.env` (see `backend/.env.example` for the naming convention already used in this repo).
- No new npm/pip dependencies beyond what's already installed unless a task below says otherwise (this plan introduces zero new backend/frontend npm packages).
- Money field `priceTon` is entered by a human, never derived from Telegram data.
- Soft delete only (`deletedAt`) — never a hard `DELETE FROM gifts`.
- Follow existing file-naming and module-shape conventions exactly (see `backend/src/users/`, `backend/src/deposits/`, `backend/src/ledger/` and `backend/src/migrations/1700000000000-InitSchema.ts` for precedent — every task below references the exact file it mirrors).
- `frontend/src/screens/market/MarketScreen.tsx`'s exported `MarketGift` interface is NOT modified — the backend's public gift DTO must match it field-for-field.

## Review Focus

- A gift link that isn't a real `t.me/nft/<slug>` (typo, random URL) must produce a clear 400, not a 500 or a hang — exercised in Task 7's controller e2e tests.
- Two admins racing to add the same slug twice must not create two rows — exercised in Task 3's duplicate-slug unit test and Task 7's e2e 409 test.
- A non-admin, authenticated user hitting any `/admin/gifts*` route must get 403, not 401 or a silent empty list — exercised in Task 4 (guard unit test) and Task 7 (e2e).
- The resolver process hanging (Telegram down, flood-wait) must not hang the HTTP request forever — exercised in Task 5's timeout unit test via a fake `execFile` that never calls back before the timeout.
- Deleting a gift that was already soft-deleted (double-click, stale UI) must 404 cleanly, not silently "succeed" a second time — exercised in Task 3's unit test and Task 7's e2e test.

---

## Task 1: `/me` reports `isAdmin`

**Files:**
- Modify: `backend/src/me/me.controller.ts`
- Test: `backend/test/me.e2e-spec.ts`

**Interfaces:**
- Produces: `/me` response gains `isAdmin: boolean`, computed server-side from `ConfigService.get('ADMIN_TELEGRAM_ID')` compared to the caller's `telegramId`. No other task depends on this one; it's independently shippable.

- [ ] **Step 1: Write the failing e2e test**

Add to `backend/test/me.e2e-spec.ts` (inside the existing `describe('Me (e2e)', ...)` block, after the existing tests):

```ts
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
```

Add `ADMIN_TELEGRAM_ID=6742434708` to `backend/.env` (the real, untracked one) and to `backend/.env.example` with a placeholder value (`ADMIN_TELEGRAM_ID=123456789`), matching how `TELEGRAM_BOT_TOKEN` etc. are documented there.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm run test:e2e -- me.e2e-spec.ts`
Expected: FAIL — `adminResponse.body.isAdmin` is `undefined`, not `true`.

- [ ] **Step 3: Implement**

In `backend/src/me/me.controller.ts`, add `ConfigService` to the constructor and the field to the response:

```ts
import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
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
      isAdmin: currentUser.telegramId === this.configService.get<string>('ADMIN_TELEGRAM_ID'),
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:e2e -- me.e2e-spec.ts`
Expected: PASS (all tests in the file, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/me/me.controller.ts test/me.e2e-spec.ts .env.example
git commit -m "feat(me): report isAdmin based on ADMIN_TELEGRAM_ID"
```

---

## Task 2: `GiftEntity` + migration

**Files:**
- Create: `backend/src/gifts/gift.entity.ts`
- Create: `backend/src/migrations/1790553600000-CreateGifts.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/data-source.ts`

**Interfaces:**
- Produces: `GiftEntity` class with fields `id: string, editionNumber: number, name: string, model: string, symbol: string, backdropName: string, backdropColor: string, imageUrl: string | null, telegramSlug: string, priceTon: string, deletedAt: Date | null, createdAt: Date`. Task 3 (`GiftsService`) imports this directly.

- [ ] **Step 1: Create the entity**

`backend/src/gifts/gift.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('gifts')
@Unique(['telegramSlug'])
export class GiftEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'edition_number', type: 'int' })
  editionNumber: number;

  @Column({ name: 'name', type: 'varchar' })
  name: string;

  @Column({ name: 'model', type: 'varchar' })
  model: string;

  @Column({ name: 'symbol', type: 'varchar' })
  symbol: string;

  @Column({ name: 'backdrop_name', type: 'varchar' })
  backdropName: string;

  @Column({ name: 'backdrop_color', type: 'varchar', length: 7 })
  backdropColor: string;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'telegram_slug', type: 'varchar' })
  telegramSlug: string;

  @Column({ name: 'price_ton', type: 'numeric' })
  priceTon: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Create the migration**

`backend/src/migrations/1790553600000-CreateGifts.ts` (name/timestamp pattern copied from `1700000000000-InitSchema.ts`):

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGifts1790553600000 implements MigrationInterface {
  name = 'CreateGifts1790553600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "gifts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "edition_number" int NOT NULL,
        "name" varchar NOT NULL,
        "model" varchar NOT NULL,
        "symbol" varchar NOT NULL,
        "backdrop_name" varchar NOT NULL,
        "backdrop_color" varchar(7) NOT NULL,
        "image_url" varchar,
        "telegram_slug" varchar NOT NULL,
        "price_ton" numeric NOT NULL,
        "deleted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_gifts_telegram_slug" UNIQUE ("telegram_slug")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_gifts_deleted_at" ON "gifts" ("deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "gifts"`);
  }
}
```

- [ ] **Step 3: Register the entity in `app.module.ts` and `data-source.ts`**

In `backend/src/app.module.ts`, add the import and list it alongside the existing entities:

```ts
import { GiftEntity } from './gifts/gift.entity';
// ...
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity, GiftEntity],
      synchronize: false,
    }),
```

In `backend/src/data-source.ts`, the same:

```ts
import { GiftEntity } from './gifts/gift.entity';
// ...
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity, GiftEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
```

- [ ] **Step 4: Run the migration against the local dev database and verify the table exists**

Prerequisite: `docker compose up -d postgres` from the repo root if it isn't already running.

Run: `cd backend && npm run migration:run`
Expected: output includes `CreateGifts1790553600000` and no errors.

Verify: `docker compose exec postgres psql -U postgres -d telegram_casino -c "\d gifts"`
Expected: prints the `gifts` table with all 12 columns listed above.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/gifts/gift.entity.ts src/migrations/1790553600000-CreateGifts.ts src/app.module.ts src/data-source.ts
git commit -m "feat(gifts): add GiftEntity and gifts table migration"
```

---

## Task 3: `GiftsService`

**Files:**
- Create: `backend/src/gifts/gifts.service.ts`
- Test: `backend/src/gifts/gifts.service.spec.ts`

**Interfaces:**
- Consumes: `GiftEntity` from Task 2.
- Produces: `GiftsService` with `findAllActive(): Promise<GiftEntity[]>`, `create(input: CreateGiftInput): Promise<GiftEntity>`, `update(id: string, input: UpdateGiftInput): Promise<GiftEntity>`, `softDelete(id: string): Promise<void>`; exported types `CreateGiftInput`, `UpdateGiftInput`; exported error class `DuplicateGiftSlugError extends Error`. Task 7 (`GiftsController`) consumes all of these.

- [ ] **Step 1: Write the failing unit tests**

`backend/src/gifts/gifts.service.spec.ts` (mocked-repository pattern copied from `backend/src/users/users.service.spec.ts`):

```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GiftsService, DuplicateGiftSlugError } from './gifts.service';
import { GiftEntity } from './gift.entity';

describe('GiftsService', () => {
  let service: GiftsService;
  const repoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'generated-id', ...data })),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [GiftsService, { provide: getRepositoryToken(GiftEntity), useValue: repoMock }],
    }).compile();
    service = moduleRef.get(GiftsService);
  });

  const validInput = {
    editionNumber: 33564,
    name: 'Vice Cream',
    model: 'Vanilla',
    symbol: 'Pickaxe',
    backdropName: 'Camo Green',
    backdropColor: '#75944d',
    imageUrl: '/gift-assets/ViceCream-33564.jpg',
    telegramSlug: 'ViceCream-33564',
    priceTon: '150',
  };

  it('creates a gift', async () => {
    const gift = await service.create(validInput);
    expect(gift.id).toBe('generated-id');
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ telegramSlug: 'ViceCream-33564' }));
  });

  it('throws DuplicateGiftSlugError when the slug already exists', async () => {
    repoMock.save.mockRejectedValueOnce({ code: '23505' });
    await expect(service.create(validInput)).rejects.toBeInstanceOf(DuplicateGiftSlugError);
  });

  it('lists only non-deleted gifts', async () => {
    repoMock.find.mockResolvedValue([{ id: '1' }]);
    const gifts = await service.findAllActive();
    expect(gifts).toEqual([{ id: '1' }]);
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: expect.anything() }) }),
    );
  });

  it('updates an existing gift', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'gift-1', priceTon: '100' });
    const updated = await service.update('gift-1', { priceTon: '200' });
    expect(updated.priceTon).toBe('200');
  });

  it('throws NotFoundException when updating a missing gift', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.update('missing', { priceTon: '200' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes a gift by setting deletedAt', async () => {
    repoMock.update.mockResolvedValue({ affected: 1 });
    await service.softDelete('gift-1');
    expect(repoMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'gift-1' }),
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it('throws NotFoundException when soft-deleting an already-deleted or missing gift', async () => {
    repoMock.update.mockResolvedValue({ affected: 0 });
    await expect(service.softDelete('gone')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest gifts.service.spec.ts`
Expected: FAIL — `Cannot find module './gifts.service'`.

- [ ] **Step 3: Implement**

`backend/src/gifts/gifts.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GiftEntity } from './gift.entity';

export interface CreateGiftInput {
  editionNumber: number;
  name: string;
  model: string;
  symbol: string;
  backdropName: string;
  backdropColor: string;
  imageUrl: string | null;
  telegramSlug: string;
  priceTon: number | string;
}

export type UpdateGiftInput = Partial<CreateGiftInput>;

export class DuplicateGiftSlugError extends Error {}

@Injectable()
export class GiftsService {
  constructor(
    @InjectRepository(GiftEntity)
    private readonly giftsRepository: Repository<GiftEntity>,
  ) {}

  async findAllActive(): Promise<GiftEntity[]> {
    return this.giftsRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async create(input: CreateGiftInput): Promise<GiftEntity> {
    try {
      return await this.giftsRepository.save(this.giftsRepository.create(input));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new DuplicateGiftSlugError(`Gift with slug ${input.telegramSlug} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateGiftInput): Promise<GiftEntity> {
    const gift = await this.giftsRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!gift) throw new NotFoundException('Gift not found');
    Object.assign(gift, input);
    return this.giftsRepository.save(gift);
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.giftsRepository.update({ id, deletedAt: IsNull() }, { deletedAt: new Date() });
    if (result.affected === 0) throw new NotFoundException('Gift not found');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest gifts.service.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/gifts/gifts.service.ts src/gifts/gifts.service.spec.ts
git commit -m "feat(gifts): add GiftsService with CRUD and soft delete"
```

---

## Task 4: `AdminGuard`

**Files:**
- Create: `backend/src/auth/admin.guard.ts`
- Test: `backend/src/auth/admin.guard.spec.ts`

**Interfaces:**
- Consumes: `JwtPayload` from `backend/src/auth/jwt.strategy.ts` (already exists).
- Produces: `AdminGuard implements CanActivate`. Task 7 (`GiftsController`) uses it via `@UseGuards(JwtAuthGuard, AdminGuard)`.

- [ ] **Step 1: Write the failing unit test**

`backend/src/auth/admin.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';

function contextWithUser(telegramId: string | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: telegramId ? { telegramId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  function guardWithAdminId(adminId: string) {
    const configService = { get: jest.fn().mockReturnValue(adminId) } as unknown as ConfigService;
    return new AdminGuard(configService);
  }

  it('allows the configured admin telegram id', () => {
    const guard = guardWithAdminId('6742434708');
    expect(guard.canActivate(contextWithUser('6742434708'))).toBe(true);
  });

  it('rejects a different telegram id', () => {
    const guard = guardWithAdminId('6742434708');
    expect(() => guard.canActivate(contextWithUser('111'))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user', () => {
    const guard = guardWithAdminId('6742434708');
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest admin.guard.spec.ts`
Expected: FAIL — `Cannot find module './admin.guard'`.

- [ ] **Step 3: Implement**

`backend/src/auth/admin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const adminTelegramId = this.configService.get<string>('ADMIN_TELEGRAM_ID');

    if (!user || !adminTelegramId || user.telegramId !== adminTelegramId) {
      throw new ForbiddenException();
    }
    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest admin.guard.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/auth/admin.guard.ts src/auth/admin.guard.spec.ts
git commit -m "feat(auth): add AdminGuard gated by ADMIN_TELEGRAM_ID"
```

---

## Task 5: `GiftResolverClient`

**Files:**
- Create: `backend/src/gifts/gift-resolver.client.ts`
- Test: `backend/src/gifts/gift-resolver.client.spec.ts`

**Interfaces:**
- Produces: `GiftResolverClient` with `resolve(slug: string): Promise<GiftPreview>`; type `GiftPreview { name, editionNumber, model, symbol, backdropName, backdropColor, imageUrl, telegramSlug }`; error classes `GiftNotFoundError`, `GiftResolverUnavailableError`, `GiftResolverTimeoutError` (all `extends Error`). Task 7 (`GiftsController`) consumes all of these.
- This task mocks Node's `child_process.execFile` — no real Python process runs in this test.

- [ ] **Step 1: Write the failing unit tests**

`backend/src/gifts/gift-resolver.client.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import {
  GiftResolverClient,
  GiftNotFoundError,
  GiftResolverTimeoutError,
  GiftResolverUnavailableError,
} from './gift-resolver.client';

jest.mock('child_process');
const execFileMock = execFile as unknown as jest.Mock;

describe('GiftResolverClient', () => {
  const configService = { get: jest.fn() } as unknown as ConfigService;
  const client = new GiftResolverClient(configService);

  beforeEach(() => jest.clearAllMocks());

  it('parses a successful resolution', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(null, {
        stdout: JSON.stringify({
          name: 'Vice Cream',
          editionNumber: 33564,
          model: 'Vanilla',
          symbol: 'Pickaxe',
          backdropName: 'Camo Green',
          backdropColor: '#75944d',
          imageUrl: '/gift-assets/ViceCream-33564.jpg',
          telegramSlug: 'ViceCream-33564',
        }),
        stderr: '',
      });
    });

    const result = await client.resolve('ViceCream-33564');
    expect(result.name).toBe('Vice Cream');
    expect(result.backdropColor).toBe('#75944d');
  });

  it('throws GiftNotFoundError when the script reports gift_not_found', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      const error = Object.assign(new Error('exit 1'), { stderr: JSON.stringify({ error: 'gift_not_found' }) });
      callback(error);
    });

    await expect(client.resolve('bad-slug')).rejects.toBeInstanceOf(GiftNotFoundError);
  });

  it('throws GiftResolverUnavailableError on an unparseable/unexpected failure', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(Object.assign(new Error('boom'), { stderr: 'not json' }));
    });

    await expect(client.resolve('slug')).rejects.toBeInstanceOf(GiftResolverUnavailableError);
  });

  it('throws GiftResolverTimeoutError when the process is killed by the timeout', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(Object.assign(new Error('timeout'), { killed: true }));
    });

    await expect(client.resolve('slug')).rejects.toBeInstanceOf(GiftResolverTimeoutError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest gift-resolver.client.spec.ts`
Expected: FAIL — `Cannot find module './gift-resolver.client'`.

- [ ] **Step 3: Implement**

`backend/src/gifts/gift-resolver.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';

export interface GiftPreview {
  name: string;
  editionNumber: number;
  model: string;
  symbol: string;
  backdropName: string;
  backdropColor: string;
  imageUrl: string | null;
  telegramSlug: string;
}

export class GiftNotFoundError extends Error {}
export class GiftResolverUnavailableError extends Error {}
export class GiftResolverTimeoutError extends Error {}

interface ExecFileError extends Error {
  killed?: boolean;
  stderr?: string;
}

function execFileWithCallback(
  command: string,
  args: string[],
  options: { timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stderr }));
        return;
      }
      resolve({ stdout: stdout as string, stderr: stderr as string });
    });
  });
}

@Injectable()
export class GiftResolverClient {
  constructor(private readonly configService: ConfigService) {}

  async resolve(slug: string): Promise<GiftPreview> {
    const pythonPath = this.configService.get<string>('GIFT_RESOLVER_PYTHON') ?? 'python3';
    const scriptPath =
      this.configService.get<string>('GIFT_RESOLVER_SCRIPT') ?? 'services/gift-resolver/resolve_gift.py';

    try {
      const { stdout } = await execFileWithCallback(pythonPath, [scriptPath, slug], { timeout: 10_000 });
      return JSON.parse(stdout) as GiftPreview;
    } catch (error) {
      const execError = error as ExecFileError;
      if (execError.killed) {
        throw new GiftResolverTimeoutError(`Resolving ${slug} timed out`);
      }

      let parsedErrorCode: string | undefined;
      if (execError.stderr) {
        try {
          parsedErrorCode = (JSON.parse(execError.stderr) as { error?: string }).error;
        } catch {
          parsedErrorCode = undefined;
        }
      }

      if (parsedErrorCode === 'gift_not_found') {
        throw new GiftNotFoundError(`No gift found for slug ${slug}`);
      }
      throw new GiftResolverUnavailableError(`Gift resolver failed for slug ${slug}`);
    }
  }
}
```

Note: `execFile`'s real Node.js signature is `execFile(command, args, options, callback)`, and its callback gives `(error, stdout, stderr)` where `error` does NOT itself carry `.stderr` — that's why `execFileWithCallback` attaches `stderr` onto the rejected error object explicitly, so the mock in the test (which puts `stderr` directly on the error passed to `callback`) and the real implementation agree on the same shape.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest gift-resolver.client.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/gifts/gift-resolver.client.ts src/gifts/gift-resolver.client.spec.ts
git commit -m "feat(gifts): add GiftResolverClient wrapping the Python resolver"
```

---

## Task 6: `resolve_gift.py` production script

**Files:**
- Create: `services/gift-resolver/resolve_gift.py`
- Create: `services/gift-resolver/requirements.txt`
- Create: `services/gift-resolver/.gitignore`
- Create: `services/gift-resolver/README.md`

This task has no automated test (per the spec: "юнит-тестов на Python-часть не пишем, это тонкая обвязка вокруг одного внешнего вызова"). It's verified by running it against the real, already-logged-in session on the VPS.

**Interfaces:**
- Produces: a CLI script `resolve_gift.py <slug>` that, on success, prints exactly one line of JSON to stdout matching `GiftPreview` from Task 5 (same field names) and exits 0. On failure, prints `{"error": "gift_not_found"}` or `{"error": "resolver_error", "message": "..."}` to stderr and exits 1. Task 5's `GiftResolverClient` is the sole consumer of this contract.

- [ ] **Step 1: Write the script**

`services/gift-resolver/resolve_gift.py`:

```python
import asyncio
import json
import os
import sys

from telethon import TelegramClient
from telethon.tl import functions
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, ".env"))

api_id = int(os.environ["TG_API_ID"])
api_hash = os.environ["TG_API_HASH"]
assets_dir = os.environ.get("GIFT_ASSETS_DIR", os.path.join(SCRIPT_DIR, "gift-assets"))
session_path = os.path.join(SCRIPT_DIR, "gift_resolver")


def fail(error_code: str, message: str = "") -> None:
    payload = {"error": error_code}
    if message:
        payload["message"] = message
    print(json.dumps(payload), file=sys.stderr)
    sys.exit(1)


def attr_by_type(attributes, type_name):
    for attr in attributes:
        if type(attr).__name__ == type_name:
            return attr
    return None


async def main(slug: str) -> None:
    client = TelegramClient(session_path, api_id, api_hash)
    await client.connect()

    try:
        result = await client(functions.payments.GetUniqueStarGiftRequest(slug=slug))
    except Exception as error:  # noqa: BLE001 - any Telegram-side failure means "not found" to the caller
        fail("gift_not_found", str(error))
        return

    gift = result.gift
    model_attr = attr_by_type(gift.attributes, "StarGiftAttributeModel")
    pattern_attr = attr_by_type(gift.attributes, "StarGiftAttributePattern")
    backdrop_attr = attr_by_type(gift.attributes, "StarGiftAttributeBackdrop")

    if not (model_attr and pattern_attr and backdrop_attr):
        fail("gift_not_found", "missing expected attributes")
        return

    image_url = None
    try:
        os.makedirs(assets_dir, exist_ok=True)
        dest_path = os.path.join(assets_dir, f"{slug}.jpg")
        await client.download_media(model_attr.document, file=dest_path, thumb=0)
        image_url = f"/gift-assets/{slug}.jpg"
    except Exception:  # noqa: BLE001 - image download failing must not block the rest of the data
        image_url = None

    await client.disconnect()

    print(
        json.dumps(
            {
                "name": gift.title,
                "editionNumber": gift.num,
                "model": model_attr.name,
                "symbol": pattern_attr.name,
                "backdropName": backdrop_attr.name,
                "backdropColor": "#%06x" % backdrop_attr.center_color,
                "imageUrl": image_url,
                "telegramSlug": gift.slug,
            }
        )
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        fail("resolver_error", "usage: resolve_gift.py <slug>")
    asyncio.run(main(sys.argv[1]))
```

- [ ] **Step 2: Add the dependency list and gitignore**

`services/gift-resolver/requirements.txt`:

```
telethon==1.45.0
python-dotenv
```

`services/gift-resolver/.gitignore`:

```
venv/
.env
*.session
*.session-journal
gift-assets/
```

- [ ] **Step 3: Document the one-time setup**

`services/gift-resolver/README.md`:

```markdown
# gift-resolver

Resolves a Telegram NFT gift by its `t.me/nft/<slug>` slug into JSON, using
`payments.getUniqueStarGift` — an MTProto method available only to a logged-in
user session (not a bot token).

## One-time setup (already done on the production VPS as of 2026-09-24)

1. `python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`
2. Create `.env` next to this file:
   ```
   TG_API_ID=...
   TG_API_HASH=...
   GIFT_ASSETS_DIR=/opt/telegram-casino/gift-assets
   ```
3. Log in once (interactive — needs the phone's login code, and the 2FA
   password if one is set): run a Telethon `send_code_request` /
   `sign_in` flow against the `gift_resolver` session name in this directory.
   The resulting `gift_resolver.session` file is the credential — never
   commit it, back it up somewhere safe instead.

## Usage

```
./venv/bin/python resolve_gift.py <slug>
```
Prints JSON to stdout on success (exit 0), or `{"error": ...}` to stderr
(exit 1) on failure. See `backend/src/gifts/gift-resolver.client.ts` for the
exact contract this output is parsed against.
```

- [ ] **Step 4: Verify manually against the real, already-logged-in VPS session**

The venv, `.env`, and session already exist at
`/opt/telegram-casino/services/gift-resolver/` on `45.86.63.105` (set up
during the design spike). Upload this finished `resolve_gift.py` there
(replacing the ad-hoc spike scripts) and run:

```
cd /opt/telegram-casino/services/gift-resolver
./venv/bin/python resolve_gift.py 'ViceCream-33564'
```

Expected stdout (one line, `backdropColor` will match — this exact output
was already verified during the design spike):
```json
{"name": "Vice Cream", "editionNumber": 33564, "model": "Vanilla", "symbol": "Pickaxe", "backdropName": "Camo Green", "backdropColor": "#75944d", "imageUrl": "/gift-assets/ViceCream-33564.jpg", "telegramSlug": "ViceCream-33564"}
```

Also verify: `ls /opt/telegram-casino/gift-assets/ViceCream-33564.jpg` exists and is a valid jpg (`file` command should say `JPEG image data`).

Then verify the error path: `./venv/bin/python resolve_gift.py 'NotARealSlug-1'` — expect exit code 1 and `{"error": "gift_not_found", ...}` on stderr.

- [ ] **Step 5: Commit**

```bash
git add services/gift-resolver/resolve_gift.py services/gift-resolver/requirements.txt services/gift-resolver/.gitignore services/gift-resolver/README.md
git commit -m "feat(gift-resolver): add production slug-resolution script"
```

---

## Task 7: `GiftsController` + `GiftsModule`, wired into `AppModule`

**Files:**
- Create: `backend/src/gifts/gifts.controller.ts`
- Create: `backend/src/gifts/gifts.module.ts`
- Create: `backend/src/gifts/gift-link.util.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/gifts/gift-link.util.spec.ts`
- Test: `backend/test/gifts.e2e-spec.ts`

**Interfaces:**
- Consumes: `GiftsService`, `DuplicateGiftSlugError` (Task 3); `AdminGuard` (Task 4); `GiftResolverClient`, `GiftPreview`, `GiftNotFoundError`, `GiftResolverUnavailableError`, `GiftResolverTimeoutError` (Task 5); `GiftEntity` (Task 2).
- Produces: `GET /gifts`, `GET /admin/gifts`, `POST /admin/gifts/resolve`, `POST /admin/gifts`, `PATCH /admin/gifts/:id`, `DELETE /admin/gifts/:id`. Public gift DTO shape: `{ id, editionNumber, name, imageUrl, backdropColor, backdropName, model, symbol, priceTon }` — this exact shape is what Task 9's frontend `fetchGifts()` and Task 10's admin screen consume, and matches `MarketGift` in `frontend/src/screens/market/MarketScreen.tsx` field-for-field.

- [ ] **Step 1: Write the failing unit test for the slug-extraction helper**

`backend/src/gifts/gift-link.util.spec.ts`:

```ts
import { extractGiftSlug } from './gift-link.util';

describe('extractGiftSlug', () => {
  it('extracts the slug from a bare t.me link', () => {
    expect(extractGiftSlug('t.me/nft/ViceCream-33564')).toBe('ViceCream-33564');
  });

  it('extracts the slug from a full https link', () => {
    expect(extractGiftSlug('https://t.me/nft/ViceCream-33564')).toBe('ViceCream-33564');
  });

  it('trims surrounding whitespace', () => {
    expect(extractGiftSlug('  https://t.me/nft/ViceCream-33564  ')).toBe('ViceCream-33564');
  });

  it('returns null for an unrelated link', () => {
    expect(extractGiftSlug('https://example.com/whatever')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractGiftSlug('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest gift-link.util.spec.ts`
Expected: FAIL — `Cannot find module './gift-link.util'`.

- [ ] **Step 3: Implement the helper, the controller, and the module**

`backend/src/gifts/gift-link.util.ts`:

```ts
export function extractGiftSlug(link: string): string | null {
  const match = link.trim().match(/nft\/([A-Za-z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}
```

`backend/src/gifts/gifts.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  GatewayTimeoutException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GiftsService, DuplicateGiftSlugError } from './gifts.service';
import {
  GiftResolverClient,
  GiftNotFoundError,
  GiftResolverTimeoutError,
  GiftResolverUnavailableError,
} from './gift-resolver.client';
import { extractGiftSlug } from './gift-link.util';
import { GiftEntity } from './gift.entity';

class ResolveGiftLinkDto {
  @IsString()
  @MinLength(1)
  link: string;
}

class CreateGiftDto {
  @IsNumber()
  @Min(0)
  editionNumber: number;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  model: string;

  @IsString()
  @MinLength(1)
  symbol: string;

  @IsString()
  @MinLength(1)
  backdropName: string;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  backdropColor: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsString()
  @MinLength(1)
  telegramSlug: string;

  @IsNumber()
  @Min(0)
  priceTon: number;
}

class UpdateGiftDto {
  @IsOptional() @IsNumber() @Min(0) editionNumber?: number;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) model?: string;
  @IsOptional() @IsString() @MinLength(1) symbol?: string;
  @IsOptional() @IsString() @MinLength(1) backdropName?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) backdropColor?: string;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsNumber() @Min(0) priceTon?: number;
}

function toPublicDto(gift: GiftEntity) {
  return {
    id: gift.id,
    editionNumber: gift.editionNumber,
    name: gift.name,
    imageUrl: gift.imageUrl ?? '',
    backdropColor: gift.backdropColor,
    backdropName: gift.backdropName,
    model: gift.model,
    symbol: gift.symbol,
    priceTon: Number(gift.priceTon),
  };
}

@Controller()
export class GiftsController {
  constructor(
    private readonly giftsService: GiftsService,
    private readonly resolverClient: GiftResolverClient,
  ) {}

  @Get('gifts')
  async listPublic() {
    return (await this.giftsService.findAllActive()).map(toPublicDto);
  }

  @Get('admin/gifts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAdmin() {
    return (await this.giftsService.findAllActive()).map(toPublicDto);
  }

  @Post('admin/gifts/resolve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resolve(@Body() dto: ResolveGiftLinkDto) {
    const slug = extractGiftSlug(dto.link);
    if (!slug) throw new BadRequestException('Не нашёл подарок по этой ссылке');

    try {
      return await this.resolverClient.resolve(slug);
    } catch (error) {
      if (error instanceof GiftNotFoundError) {
        throw new BadRequestException('Не нашёл подарок по этой ссылке');
      }
      if (error instanceof GiftResolverTimeoutError) {
        throw new GatewayTimeoutException('Поиск подарка занял слишком много времени');
      }
      if (error instanceof GiftResolverUnavailableError) {
        throw new ServiceUnavailableException('Сервис поиска подарков временно недоступен');
      }
      throw error;
    }
  }

  @Post('admin/gifts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() dto: CreateGiftDto) {
    try {
      return toPublicDto(await this.giftsService.create(dto));
    } catch (error) {
      if (error instanceof DuplicateGiftSlugError) {
        throw new ConflictException('Этот подарок уже есть в магазине');
      }
      throw error;
    }
  }

  @Patch('admin/gifts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateGiftDto) {
    return toPublicDto(await this.giftsService.update(id, dto));
  }

  @Delete('admin/gifts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    await this.giftsService.softDelete(id);
    return { deleted: true };
  }
}
```

`backend/src/gifts/gifts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftEntity } from './gift.entity';
import { GiftsService } from './gifts.service';
import { GiftResolverClient } from './gift-resolver.client';
import { GiftsController } from './gifts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GiftEntity])],
  providers: [GiftsService, GiftResolverClient],
  controllers: [GiftsController],
})
export class GiftsModule {}
```

In `backend/src/app.module.ts`, import and register `GiftsModule` alongside the other feature modules:

```ts
import { GiftsModule } from './gifts/gifts.module';
// ...
    UsersModule,
    AuthModule,
    LedgerModule,
    TelegramModule,
    DepositsModule,
    MeModule,
    GiftsModule,
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd backend && npx jest gift-link.util.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing e2e test**

`backend/test/gifts.e2e-spec.ts` (login pattern copied from `backend/test/deposits.e2e-spec.ts`; `GiftResolverClient` is overridden with a mock so no real Python process runs):

```ts
import { randomInt } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
```

- [ ] **Step 6: Run the e2e test to verify it fails, then implement (already done in Step 3), then verify it passes**

Run: `cd backend && npm run test:e2e -- gifts.e2e-spec.ts`

First run (before Step 3's code exists, if following strict TDD order — since the controller/module code above was written in Step 3 already for readability, run this once now to confirm the whole suite is green):
Expected: PASS — 8 tests (1 public list, 1 unauthenticated 401, 1 non-admin 403, 1 full CRUD flow, 1 duplicate 409, 1 bad-link 400, 1 resolver-unavailable 503).

If anything fails, check: `ADMIN_TELEGRAM_ID` must be set in the shell/`.env` the test process reads, and must be a value `buildValidTelegramInitData`'s `user.id` can equal (Task 1 already added `ADMIN_TELEGRAM_ID=6742434708` to `.env`).

- [ ] **Step 7: Run the full backend test suite to confirm nothing else broke**

Run: `cd backend && npm test && npm run test:e2e`
Expected: PASS, all suites.

- [ ] **Step 8: Commit**

```bash
cd backend
git add src/gifts/gifts.controller.ts src/gifts/gifts.module.ts src/gifts/gift-link.util.ts src/gifts/gift-link.util.spec.ts src/app.module.ts test/gifts.e2e-spec.ts
git commit -m "feat(gifts): add GiftsController and wire GiftsModule into the app"
```

---

## Task 8: Frontend API clients

**Files:**
- Create: `frontend/src/api/gifts.ts`
- Create: `frontend/src/api/adminGifts.ts`

**Interfaces:**
- Consumes: `MarketGift` from `frontend/src/screens/market/MarketScreen.tsx` (already exists, unchanged); `apiFetch` from `frontend/src/api/client.ts` (already exists).
- Produces: `fetchGifts(): Promise<MarketGift[]>`; `GiftPreview` type, `fetchAdminGifts()`, `resolveGiftLink(link: string): Promise<GiftPreview>`, `createGift(input: GiftPreview & { priceTon: number }): Promise<MarketGift>`, `deleteGift(id: string): Promise<{ deleted: boolean }>`. Task 9 and Task 10 consume these.

No dedicated test file for this task — these are thin wrappers with the exact same shape as the already-tested `frontend/src/api/deposits.ts` / `frontend/src/api/me.ts`; they're exercised indirectly by Task 9's and Task 10's component tests (which mock `fetch`, not these functions).

- [ ] **Step 1: Implement**

`frontend/src/api/gifts.ts`:

```ts
import { apiFetch } from './client';
import { MarketGift } from '../screens/market/MarketScreen';

export function fetchGifts(): Promise<MarketGift[]> {
  return apiFetch<MarketGift[]>('/gifts');
}
```

`frontend/src/api/adminGifts.ts`:

```ts
import { apiFetch } from './client';
import { MarketGift } from '../screens/market/MarketScreen';

export interface GiftPreview {
  name: string;
  editionNumber: number;
  model: string;
  symbol: string;
  backdropName: string;
  backdropColor: string;
  imageUrl: string | null;
  telegramSlug: string;
}

export function fetchAdminGifts(): Promise<MarketGift[]> {
  return apiFetch<MarketGift[]>('/admin/gifts');
}

export function resolveGiftLink(link: string): Promise<GiftPreview> {
  return apiFetch<GiftPreview>('/admin/gifts/resolve', {
    method: 'POST',
    body: JSON.stringify({ link }),
  });
}

export function createGift(input: GiftPreview & { priceTon: number }): Promise<MarketGift> {
  return apiFetch<MarketGift>('/admin/gifts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteGift(id: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/admin/gifts/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/api/gifts.ts src/api/adminGifts.ts
git commit -m "feat(gifts): add frontend API clients for public and admin gifts"
```

---

## Task 9: Admin tab in `TabBar` + `App.tsx` wiring

**Files:**
- Modify: `frontend/src/navigation/TabBar.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `fetchGifts` (Task 8), `MeProfile.isAdmin` (needs adding — see Step 1).
- Produces: `TabId` gains `'admin'`; `TabBar` gains optional prop `showAdmin?: boolean`. Task 10's `AdminGiftsScreen` is rendered by `App.tsx` when `activeTab === 'admin'`.

- [ ] **Step 1: Add `isAdmin` to the frontend `MeProfile` type**

In `frontend/src/api/me.ts`, add the field:

```ts
export interface MeProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  hasAcceptedConsent: boolean;
  isAdmin: boolean;
}
```

- [ ] **Step 2: Write the failing frontend test**

Add to `frontend/src/App.test.tsx`. First, extend `mockAuthenticatedFetch` to accept an `isAdmin` flag and to answer `/gifts`, then add a new test:

```ts
function mockAuthenticatedFetch(hasAcceptedConsent: boolean, isAdmin = false) {
  globalThis.fetch = vi.fn((url: string) => {
    if (url.includes('/auth/telegram')) {
      return Promise.resolve({ ok: true, json: async () => ({ accessToken: 'jwt', userId: 'user-1' }) });
    }
    if (url.includes('/me/balance')) {
      return Promise.resolve({ ok: true, json: async () => ({ balanceGram: 42.5 }) });
    }
    if (url.includes('/gifts')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: 'user-1', username: 'alex', firstName: 'Alex', hasAcceptedConsent, isAdmin }),
    });
  }) as unknown as typeof fetch;
}
```

(This replaces the existing `mockAuthenticatedFetch` in the file — every existing call site like `mockAuthenticatedFetch(true)` keeps working since `isAdmin` defaults to `false`.)

Then add, inside `describe('App', ...)`:

```ts
  it('shows the Admin tab only when the profile is an admin', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true, false);
    const { unmount } = render(<App />);
    await waitFor(() => expect(screen.getByText('Раздел появится следующим')).toBeInTheDocument());
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    unmount();

    mockAuthenticatedFetch(true, true);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument());
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run App.test.tsx`
Expected: FAIL — `Admin` tab text never appears even when `isAdmin: true`.

- [ ] **Step 4: Implement — `TabBar`**

`frontend/src/navigation/TabBar.tsx`:

```tsx
import { OverlapCirclesIcon, SlidersIcon, StoreIcon, SunburstIcon, UserSparkleIcon } from '../icons/Icons';
import { hapticImpact } from '../telegram/haptics';

export type TabId = 'pvp' | 'solo' | 'shop' | 'profile' | 'admin';

interface Tab {
  id: TabId;
  label: string;
  Icon: typeof StoreIcon;
}

export const TABS: Tab[] = [
  { id: 'shop', label: 'Магазин', Icon: StoreIcon },
  { id: 'pvp', label: 'PvP', Icon: OverlapCirclesIcon },
  { id: 'solo', label: 'Solo', Icon: SunburstIcon },
  { id: 'profile', label: 'Профиль', Icon: UserSparkleIcon },
];

const ADMIN_TAB: Tab = { id: 'admin', label: 'Admin', Icon: SlidersIcon };

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  showAdmin?: boolean;
}

export function TabBar({ activeTab, onChange, showAdmin = false }: TabBarProps) {
  const tabs = showAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav
      aria-label="Основная навигация"
      className="shrink-0 h-[72px] bg-surface/97 border-t border-white/[0.07] flex items-center justify-around pb-1.5 z-10"
    >
      {tabs.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => {
              if (!active) hapticImpact('light');
              onChange(id);
            }}
            aria-current={active ? 'page' : undefined}
            className="relative flex flex-col items-center gap-1 min-w-[56px] min-h-[44px] justify-center transition-transform duration-150 active:scale-90 outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            <Icon size={21} className="relative transition-colors duration-200" color={active ? '#fff' : '#5c5966'} />
            <span
              className={`relative text-[10.5px] font-semibold transition-colors duration-200 ${
                active ? 'text-white' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

(`SlidersIcon` already exists in `frontend/src/icons/Icons.tsx` — no new icon needed.)

- [ ] **Step 5: Implement — `App.tsx`**

Full replacement of `frontend/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useTelegramAuth } from './auth/useTelegramAuth';
import { fetchMe, MeProfile } from './api/me';
import { fetchBalance } from './api/balance';
import { fetchGifts } from './api/gifts';
import { ConsentGate } from './consent/ConsentGate';
import { TabBar, TabId } from './navigation/TabBar';
import { ComingSoonScreen } from './navigation/ComingSoonScreen';
import { Header } from './components/Header';
import { DepositModal } from './components/DepositModal';
import { ProfileScreen } from './screens/ProfileScreen';
import { MarketScreen, MarketGift } from './screens/market/MarketScreen';
import { AdminGiftsScreen } from './screens/admin/AdminGiftsScreen';
import { OverlapCirclesIcon, SunburstIcon } from './icons/Icons';

const TAB_META: Record<Exclude<TabId, 'profile' | 'shop' | 'admin'>, { title: string; icon: JSX.Element }> = {
  pvp: { title: 'PvP', icon: <OverlapCirclesIcon size={34} color="#38BDF8" /> },
  solo: { title: 'Solo', icon: <SunburstIcon size={34} color="#38BDF8" /> },
};

const SCREENS_WITH_OWN_HEADER: TabId[] = ['profile', 'shop', 'admin'];

export function App() {
  const auth = useTelegramAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [balanceGram, setBalanceGram] = useState(0);
  const [gifts, setGifts] = useState<MarketGift[]>([]);
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

  useEffect(() => {
    if (profile?.hasAcceptedConsent && activeTab === 'shop') {
      fetchGifts().then(setGifts);
    }
  }, [profile?.hasAcceptedConsent, activeTab]);

  function refreshGifts() {
    fetchGifts().then(setGifts);
  }

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
    <div className="h-[100dvh] flex flex-col bg-bg text-white overflow-hidden">
      {!SCREENS_WITH_OWN_HEADER.includes(activeTab) && (
        <Header balanceGram={balanceGram} onDepositClick={() => setDepositModalOpen(true)} />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'profile' ? (
          <ProfileScreen
            profile={profile}
            balanceGram={balanceGram}
            onDepositClick={() => setDepositModalOpen(true)}
            onOpenShop={() => setActiveTab('shop')}
          />
        ) : activeTab === 'shop' ? (
          <MarketScreen balanceGram={balanceGram} onDepositClick={() => setDepositModalOpen(true)} gifts={gifts} />
        ) : activeTab === 'admin' ? (
          profile.isAdmin ? <AdminGiftsScreen onGiftsChanged={refreshGifts} /> : null
        ) : (
          <ComingSoonScreen title={TAB_META[activeTab].title} icon={TAB_META[activeTab].icon} />
        )}
      </div>
      <TabBar activeTab={activeTab} onChange={setActiveTab} showAdmin={profile.isAdmin} />
      {depositModalOpen && (
        <DepositModal
          onClose={() => setDepositModalOpen(false)}
          onDeposited={() => fetchBalance().then((response) => setBalanceGram(response.balanceGram))}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npx vitest run App.test.tsx`
Expected: PASS. (This will fail to even compile until Task 10 creates `AdminGiftsScreen` — if running this task before Task 10 exists, temporarily stub `frontend/src/screens/admin/AdminGiftsScreen.tsx` with a minimal `export function AdminGiftsScreen(_props: { onGiftsChanged: () => void }) { return null; }` so this task is independently testable, then let Task 10 replace it with the real implementation.)

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/navigation/TabBar.tsx src/App.tsx src/App.test.tsx src/api/me.ts
git commit -m "feat(admin): add admin-gated tab and wire real gifts fetch into MarketScreen"
```

---

## Task 10: `AdminGiftsScreen`

**Files:**
- Create: `frontend/src/screens/admin/AdminGiftsScreen.tsx`
- Create: `frontend/src/screens/admin/AdminGiftsScreen.test.tsx`

**Interfaces:**
- Consumes: `fetchAdminGifts`, `resolveGiftLink`, `createGift`, `deleteGift`, `GiftPreview` (Task 8); `MarketGift` (existing); `CircleXIcon`, `PlusIcon` (existing icons); `hapticImpact` (existing).
- Produces: `AdminGiftsScreen({ onGiftsChanged: () => void })` — matches the stub signature Task 9 already wired into `App.tsx`.
- Per the spec's UI section, this screen supports **list + delete + add-by-link**. It does not include an edit UI (the backend `PATCH` endpoint from Task 7 exists for future use but nothing here calls it — don't add an edit button.)

- [ ] **Step 1: Write the failing tests**

`frontend/src/screens/admin/AdminGiftsScreen.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminGiftsScreen } from './AdminGiftsScreen';

const existingGift = {
  id: 'gift-1',
  editionNumber: 33564,
  name: 'Vice Cream',
  imageUrl: '/gift-assets/ViceCream-33564.jpg',
  backdropColor: '#75944d',
  backdropName: 'Camo Green',
  model: 'Vanilla',
  symbol: 'Pickaxe',
  priceTon: 150,
};

function mockFetch({ resolvePreview = null as unknown, createResult = null as unknown } = {}) {
  globalThis.fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/admin/gifts/resolve')) {
      if (!resolvePreview) {
        return Promise.resolve({ ok: false, status: 400 });
      }
      return Promise.resolve({ ok: true, json: async () => resolvePreview });
    }
    if (url.includes('/admin/gifts/') && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: async () => ({ deleted: true }) });
    }
    if (url.endsWith('/admin/gifts') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => createResult });
    }
    if (url.endsWith('/admin/gifts')) {
      return Promise.resolve({ ok: true, json: async () => [existingGift] });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  }) as unknown as typeof fetch;
}

describe('AdminGiftsScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing gifts on load', async () => {
    mockFetch();
    render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Vice Cream')).toBeInTheDocument());
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('resolves a link and shows an editable preview before saving', async () => {
    const preview = {
      name: 'Vice Cream',
      editionNumber: 33564,
      model: 'Vanilla',
      symbol: 'Pickaxe',
      backdropName: 'Camo Green',
      backdropColor: '#75944d',
      imageUrl: '/gift-assets/ViceCream-33564.jpg',
      telegramSlug: 'ViceCream-33564',
    };
    mockFetch({ resolvePreview: preview });
    render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => screen.getByLabelText('Добавить подарок'));

    fireEvent.click(screen.getByLabelText('Добавить подарок'));
    fireEvent.change(screen.getByPlaceholderText('t.me/nft/...'), {
      target: { value: 'https://t.me/nft/ViceCream-33564' },
    });
    fireEvent.click(screen.getByText('Найти'));

    await waitFor(() => expect(screen.getByDisplayValue('Vanilla')).toBeInTheDocument());
  });

  it('calls onGiftsChanged after a successful delete', async () => {
    mockFetch();
    const onGiftsChanged = vi.fn();
    render(<AdminGiftsScreen onGiftsChanged={onGiftsChanged} />);
    await waitFor(() => expect(screen.getByText('Vice Cream')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Удалить Vice Cream'));
    fireEvent.click(screen.getByText('Да, удалить'));

    await waitFor(() => expect(onGiftsChanged).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run AdminGiftsScreen.test.tsx`
Expected: FAIL — module doesn't exist (or, if Task 9's stub is still in place, fails because the stub renders nothing).

- [ ] **Step 3: Implement**

`frontend/src/screens/admin/AdminGiftsScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { CircleXIcon, PlusIcon } from '../../icons/Icons';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { hapticImpact } from '../../telegram/haptics';
import { MarketGift } from '../market/MarketScreen';
import {
  GiftPreview,
  fetchAdminGifts,
  resolveGiftLink,
  createGift,
  deleteGift,
} from '../../api/adminGifts';

interface AdminGiftsScreenProps {
  onGiftsChanged: () => void;
}

export function AdminGiftsScreen({ onGiftsChanged }: AdminGiftsScreenProps) {
  const [gifts, setGifts] = useState<MarketGift[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [price, setPrice] = useState('');
  const [resolving, setResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketGift | null>(null);

  useEffect(() => {
    void loadGifts();
  }, []);

  async function loadGifts() {
    setGifts(await fetchAdminGifts());
  }

  async function handleFind() {
    setErrorMessage(null);
    setResolving(true);
    try {
      setPreview(await resolveGiftLink(link));
    } catch {
      setErrorMessage('Не нашёл подарок по этой ссылке');
    } finally {
      setResolving(false);
    }
  }

  async function handleSave() {
    if (!preview || !price) return;
    hapticImpact('light');
    try {
      await createGift({ ...preview, priceTon: Number(price) });
      setAddOpen(false);
      setLink('');
      setPreview(null);
      setPrice('');
      setErrorMessage(null);
      await loadGifts();
      onGiftsChanged();
    } catch {
      setErrorMessage('Этот подарок уже есть в магазине');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    hapticImpact('light');
    await deleteGift(deleteTarget.id);
    setDeleteTarget(null);
    await loadGifts();
    onGiftsChanged();
  }

  return (
    <div className="min-h-full bg-bg text-white">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h2 className="text-[28px] leading-[31px] font-medium tracking-tight">Admin · Gifts</h2>
        <button
          onClick={() => {
            hapticImpact('light');
            setAddOpen(true);
          }}
          aria-label="Добавить подарок"
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-150 active:scale-90"
        >
          <PlusIcon size={16} color="#fff" />
        </button>
      </div>

      <div className="px-5 flex flex-col gap-2.5">
        {gifts.map((gift) => (
          <div
            key={gift.id}
            className="h-16 rounded-2xl bg-white/5 px-4 flex items-center justify-between"
          >
            <div>
              <div className="text-[14px] font-bold">{gift.name}</div>
              <div className="text-[12px] text-white/50">
                #{gift.editionNumber} · <AnimatedNumber value={gift.priceTon} /> TON
              </div>
            </div>
            <button
              onClick={() => setDeleteTarget(gift)}
              aria-label={`Удалить ${gift.name}`}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <CircleXIcon size={16} color="#F87171" />
            </button>
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setAddOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-[390px] bg-[#18191b]/95 backdrop-blur-xl rounded-t-[28px] px-5 pt-5 pb-7">
            <h3 className="text-[20px] font-semibold mb-3">Добавить подарок</h3>

            <input
              type="text"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="t.me/nft/..."
              className="w-full h-11 rounded-2xl bg-white/5 px-3 text-[14px] text-white placeholder:text-gray-500 outline-none mb-2"
            />
            <button
              onClick={handleFind}
              disabled={resolving || !link}
              className="w-full h-11 rounded-2xl bg-white/10 text-[14px] font-bold disabled:opacity-40 mb-3"
            >
              {resolving ? 'Ищу…' : 'Найти'}
            </button>

            {errorMessage && <p className="text-[12px] text-danger mb-3">{errorMessage}</p>}

            {preview && (
              <div className="flex flex-col gap-2 mb-3">
                <label className="text-[12px] text-gray-500">
                  Модель
                  <input
                    value={preview.model}
                    onChange={(event) => setPreview({ ...preview, model: event.target.value })}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <label className="text-[12px] text-gray-500">
                  Фон
                  <input
                    value={preview.backdropName}
                    onChange={(event) => setPreview({ ...preview, backdropName: event.target.value })}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <label className="text-[12px] text-gray-500">
                  Символ
                  <input
                    value={preview.symbol}
                    onChange={(event) => setPreview({ ...preview, symbol: event.target.value })}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <label className="text-[12px] text-gray-500">
                  Цена (TON)
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <button
                  onClick={handleSave}
                  disabled={!price}
                  className="w-full h-12 rounded-2xl bg-[#0077FF] font-bold disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setDeleteTarget(null)} aria-hidden="true" />
          <div className="relative w-[300px] bg-[#18191b] rounded-3xl p-5 text-center">
            <p className="text-[14px] mb-4">Удалить «{deleteTarget.name}»?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-xl bg-white/10 text-[13px] font-bold"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 h-11 rounded-xl bg-danger text-[13px] font-bold"
              >
                Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run AdminGiftsScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full frontend test suite (including Task 9's App.test.tsx, now against the real component)**

Run: `cd frontend && npx vitest run`
Expected: PASS, all suites.

- [ ] **Step 6: Type-check and lint the whole frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/screens/admin/AdminGiftsScreen.tsx src/screens/admin/AdminGiftsScreen.test.tsx
git commit -m "feat(admin): add AdminGiftsScreen with add-by-link and delete flows"
```

---

## Task 11: Deploy to the VPS and smoke-test in real Telegram

**Files:** none new — this is an operational task against `45.86.63.105`.

- [ ] **Step 1: Add nginx static location for gift images**

SSH in and add a `location /gift-assets/ { alias /opt/telegram-casino/gift-assets/; }` block inside the existing `server { server_name 45-86-63-105.sslip.io; ... }` block (the same one that already has `root /opt/telegram-casino/frontend/dist;` and the `location /me { proxy_pass ... }` blocks — add this as a sibling location). Reload nginx: `nginx -t && systemctl reload nginx`.

- [ ] **Step 2: Deploy backend code and run the migration**

Push the branch, pull/rsync it onto `/opt/telegram-casino` on the VPS (same repo checkout already there), then on the VPS:
```
cd /opt/telegram-casino/backend
npm install
npm run build
npm run migration:run
```
Add `ADMIN_TELEGRAM_ID=6742434708`, `GIFT_RESOLVER_PYTHON=/opt/telegram-casino/services/gift-resolver/venv/bin/python3`, `GIFT_RESOLVER_SCRIPT=/opt/telegram-casino/services/gift-resolver/resolve_gift.py` to `/opt/telegram-casino/backend/.env`.
Add `GIFT_ASSETS_DIR=/opt/telegram-casino/gift-assets` to `/opt/telegram-casino/services/gift-resolver/.env` (it currently only has `TG_API_ID`/`TG_API_HASH`/`ADMIN_TELEGRAM_ID`).
Restart whatever process manager runs the backend (check how it's currently started — this project runs services manually per its established convention, so this is `pkill`+re-run the same way the backend is normally started, not a systemd unit).

- [ ] **Step 3: Deploy the frontend build**

`cd frontend && npm run build`, then package and upload `dist/` the same way the Gifts market screen deploy was done earlier (tar `frontend/dist`, upload to `/tmp`, extract over `/opt/telegram-casino/frontend/dist` on the VPS, preserving `.env.production`).

- [ ] **Step 4: Smoke-test in real Telegram**

Open the mini app as the admin account (Telegram ID `6742434708`) via the bot's "Open App" button. Confirm:
- A 5th "Admin" tab is visible.
- Tapping it shows the (empty, on first deploy) gifts list and an add button.
- Pasting `https://t.me/nft/ViceCream-33564`, tapping "Найти", shows the resolved preview with a real picture.
- Entering a price and saving shows it in the admin list.
- Switching to the Магазин tab shows the same gift as a real card (no longer the empty state).
- Deleting it from the admin tab removes it from Магазин too (after switching tabs, per Task 9's fetch-on-tab-activation).

Open the mini app as a non-admin account and confirm the Admin tab is absent.

- [ ] **Step 5: Report results to the user**

No commit — this task is a deploy/verification checklist, not a code change.
