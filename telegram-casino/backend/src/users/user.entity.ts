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
