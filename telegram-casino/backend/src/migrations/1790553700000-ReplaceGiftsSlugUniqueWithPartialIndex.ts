import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceGiftsSlugUniqueWithPartialIndex1790553700000 implements MigrationInterface {
  name = 'ReplaceGiftsSlugUniqueWithPartialIndex1790553700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gifts" DROP CONSTRAINT "UQ_gifts_telegram_slug"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_gifts_telegram_slug_active"
      ON "gifts" ("telegram_slug")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_gifts_telegram_slug_active"`);
    await queryRunner.query(`
      ALTER TABLE "gifts" ADD CONSTRAINT "UQ_gifts_telegram_slug" UNIQUE ("telegram_slug")
    `);
  }
}
