import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { validateTelegramInitData } from './telegram-init-data.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async loginWithInitData(initData: string): Promise<{ accessToken: string; userId: string }> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    let validated = validateTelegramInitData(initData, botToken);

    if (!validated && process.env.NODE_ENV !== 'production') {
      const devMockToken = this.configService.get<string>('TELEGRAM_DEV_MOCK_TOKEN');
      if (devMockToken) {
        validated = validateTelegramInitData(initData, devMockToken);
      }
    }

    if (!validated) {
      throw new UnauthorizedException('Invalid Telegram initData');
    }

    const user = await this.usersService.findOrCreateByTelegramProfile({
      telegramId: String(validated.user.id),
      username: validated.user.username,
      firstName: validated.user.first_name,
      languageCode: validated.user.language_code,
    });

    const accessToken = this.jwtService.sign({ sub: user.id, telegramId: user.telegramId });
    return { accessToken, userId: user.id };
  }
}
