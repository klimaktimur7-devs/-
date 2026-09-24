import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// telegram_slug is unique only among non-deleted rows (a partial unique
// index — see ReplaceGiftsSlugUniqueWithPartialIndex1790553700000), so a
// TypeORM @Unique() decorator here would misrepresent the real constraint.
@Entity('gifts')
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
