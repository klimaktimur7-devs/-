import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftEntity } from './gift.entity';
import { GiftsService } from './gifts.service';
import { GiftResolverClient } from './gift-resolver.client';
import { GiftsController } from './gifts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GiftEntity])],
  providers: [GiftsService, GiftResolverClient],
  controllers: [GiftsController],
})
export class GiftsModule {}
