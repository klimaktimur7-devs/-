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
