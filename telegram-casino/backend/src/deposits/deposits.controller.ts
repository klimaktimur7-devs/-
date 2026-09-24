import {
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { TelegramBotApiClient } from '../telegram/telegram-bot-api.client';

class CreateStarsInvoiceDto {
  @IsInt()
  @Min(1)
  amountStars: number;
}

@Controller('deposits/stars')
@UseGuards(JwtAuthGuard)
export class DepositsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botApiClient: TelegramBotApiClient,
  ) {}

  @Post('invoice')
  async createInvoice(@CurrentUser() currentUser: JwtPayload, @Body() dto: CreateStarsInvoiceDto) {
    const depositsEnabled = (this.configService.get<string>('DEPOSITS_ENABLED') ?? 'true') === 'true';
    if (!depositsEnabled) {
      throw new ServiceUnavailableException('Deposits are temporarily disabled');
    }

    const invoiceLink = await this.botApiClient.createStarsInvoiceLink({
      title: 'Пополнение баланса',
      description: `${dto.amountStars} Stars`,
      payload: currentUser.sub,
      amountStars: dto.amountStars,
    });

    return { invoiceLink };
  }
}
