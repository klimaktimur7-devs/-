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
