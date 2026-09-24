import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { GiftEntity } from './gifts/gift.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity, GiftEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
