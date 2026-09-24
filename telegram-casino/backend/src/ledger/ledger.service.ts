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
