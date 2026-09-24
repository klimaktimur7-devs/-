import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegram_id" bigint NOT NULL,
        "username" varchar,
        "first_name" varchar,
        "language_code" varchar,
        "consent_accepted_at" timestamptz,
        "consent_version" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_telegram_id" UNIQUE ("telegram_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar NOT NULL,
        "external_ref" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_ledger_transactions_type_external_ref"
      ON "ledger_transactions" ("type", "external_ref")
      WHERE "external_ref" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL REFERENCES "ledger_transactions"("id"),
        "account" varchar NOT NULL,
        "amount_gram_cents" bigint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_entries_account" ON "ledger_entries" ("account")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TABLE "ledger_transactions"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
