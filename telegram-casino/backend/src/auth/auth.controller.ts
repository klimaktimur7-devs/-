import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  @MinLength(1)
  initData: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async loginWithTelegram(@Body() dto: LoginDto) {
    try {
      return await this.authService.loginWithInitData(dto.initData);
    } catch {
      throw new UnauthorizedException('Invalid Telegram initData');
    }
  }
}
