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
