import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  GatewayTimeoutException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsPositive, IsString, Matches, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GiftsService, DuplicateGiftSlugError } from './gifts.service';
import {
  GiftResolverClient,
  GiftNotFoundError,
  GiftResolverTimeoutError,
  GiftResolverUnavailableError,
} from './gift-resolver.client';
import { extractGiftSlug } from './gift-link.util';
import { GiftEntity } from './gift.entity';

class ResolveGiftLinkDto {
  @IsString()
  @MinLength(1)
  link: string;
}

class CreateGiftDto {
  @IsNumber()
  @Min(0)
  editionNumber: number;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  model: string;

  @IsString()
  @MinLength(1)
  symbol: string;

  @IsString()
  @MinLength(1)
  backdropName: string;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  backdropColor: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsString()
  @MinLength(1)
  telegramSlug: string;

  @IsNumber()
  @IsPositive()
  priceTon: number;
}

class UpdateGiftDto {
  @IsOptional() @IsNumber() @Min(0) editionNumber?: number;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) model?: string;
  @IsOptional() @IsString() @MinLength(1) symbol?: string;
  @IsOptional() @IsString() @MinLength(1) backdropName?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) backdropColor?: string;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsNumber() @IsPositive() priceTon?: number;
}

function toPublicDto(gift: GiftEntity) {
  return {
    id: gift.id,
    editionNumber: gift.editionNumber,
    name: gift.name,
    imageUrl: gift.imageUrl ?? '',
    backdropColor: gift.backdropColor,
    backdropName: gift.backdropName,
    model: gift.model,
    symbol: gift.symbol,
    priceTon: Number(gift.priceTon),
  };
}

@Controller()
export class GiftsController {
  constructor(
    private readonly giftsService: GiftsService,
    private readonly resolverClient: GiftResolverClient,
  ) {}

  @Get('gifts')
  async listPublic() {
    return (await this.giftsService.findAllActive()).map(toPublicDto);
  }

  @Get('admin/gifts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAdmin() {
    return (await this.giftsService.findAllActive()).map(toPublicDto);
  }

  @Post('admin/gifts/resolve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resolve(@Body() dto: ResolveGiftLinkDto) {
    const slug = extractGiftSlug(dto.link);
    if (!slug) throw new BadRequestException('Не нашёл подарок по этой ссылке');

    try {
      return await this.resolverClient.resolve(slug);
    } catch (error) {
      if (error instanceof GiftNotFoundError) {
        throw new BadRequestException('Не нашёл подарок по этой ссылке');
      }
      if (error instanceof GiftResolverTimeoutError) {
        throw new GatewayTimeoutException('Поиск подарка занял слишком много времени');
      }
      if (error instanceof GiftResolverUnavailableError) {
        throw new ServiceUnavailableException('Сервис поиска подарков временно недоступен');
      }
      throw error;
    }
  }

  @Post('admin/gifts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() dto: CreateGiftDto) {
    try {
      return toPublicDto(await this.giftsService.create({ ...dto, imageUrl: dto.imageUrl ?? null }));
    } catch (error) {
      if (error instanceof DuplicateGiftSlugError) {
        throw new ConflictException('Этот подарок уже есть в магазине');
      }
      throw error;
    }
  }

  @Patch('admin/gifts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateGiftDto) {
    return toPublicDto(await this.giftsService.update(id, dto));
  }

  @Delete('admin/gifts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    await this.giftsService.softDelete(id);
    return { deleted: true };
  }
}
