import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { UsersModule } from '../users/users.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [UsersModule, LedgerModule],
  controllers: [MeController],
})
export class MeModule {}
