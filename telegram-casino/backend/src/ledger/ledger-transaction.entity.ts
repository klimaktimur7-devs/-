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
