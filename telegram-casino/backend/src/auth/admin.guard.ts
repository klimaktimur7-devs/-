import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const adminTelegramId = this.configService.get<string>('ADMIN_TELEGRAM_ID');

    if (!user || !adminTelegramId || user.telegramId !== adminTelegramId) {
      throw new ForbiddenException();
    }
    return true;
  }
}
