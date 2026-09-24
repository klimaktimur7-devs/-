import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { UserEntity } from './users/user.entity';
import { LedgerTransactionEntity } from './ledger/ledger-transaction.entity';
import { LedgerEntryEntity } from './ledger/ledger-entry.entity';
import { GiftEntity } from './gifts/gift.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { TelegramModule } from './telegram/telegram.module';
import { DepositsModule } from './deposits/deposits.module';
import { MeModule } from './me/me.module';
import { GiftsModule } from './gifts/gifts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [UserEntity, LedgerTransactionEntity, LedgerEntryEntity, GiftEntity],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    LedgerModule,
    TelegramModule,
    DepositsModule,
    MeModule,
    GiftsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
