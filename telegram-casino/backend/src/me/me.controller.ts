import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import { LedgerService, userAccount } from '../ledger/ledger.service';

class AcceptConsentDto {
  @IsString()
  @MinLength(1)
  consentVersion: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ledgerService: LedgerService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getProfile(@CurrentUser() currentUser: JwtPayload) {
    const user = await this.usersService.findById(currentUser.sub);
    if (!user) throw new ForbiddenException();

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      hasAcceptedConsent: !!user.consentAcceptedAt,
      isAdmin: currentUser.telegramId === this.configService.get<string>('ADMIN_TELEGRAM_ID'),
    };
  }

  @Get('balance')
  async getBalance(@CurrentUser() currentUser: JwtPayload) {
    const balanceGramCents = await this.ledgerService.getBalance(userAccount(currentUser.sub));
    return { balanceGram: Number(balanceGramCents) / 100 };
  }

  @Post('consent')
  async acceptConsent(@CurrentUser() currentUser: JwtPayload, @Body() dto: AcceptConsentDto) {
    const user = await this.usersService.acceptConsent(currentUser.sub, dto.consentVersion);
    return { hasAcceptedConsent: !!user.consentAcceptedAt };
  }
}
