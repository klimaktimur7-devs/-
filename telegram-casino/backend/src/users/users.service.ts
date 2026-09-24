import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export interface TelegramProfile {
  telegramId: string;
  username?: string;
  firstName?: string;
  languageCode?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findOrCreateByTelegramProfile(profile: TelegramProfile): Promise<UserEntity> {
    const existing = await this.usersRepository.findOne({
      where: { telegramId: profile.telegramId },
    });
    if (existing) {
      existing.username = profile.username ?? existing.username;
      existing.firstName = profile.firstName ?? existing.firstName;
      existing.languageCode = profile.languageCode ?? existing.languageCode;
      return this.usersRepository.save(existing);
    }

    const created = this.usersRepository.create({
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      languageCode: profile.languageCode ?? null,
      consentAcceptedAt: null,
      consentVersion: null,
    });
    return this.usersRepository.save(created);
  }

  async acceptConsent(userId: string, consentVersion: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOneByOrFail({ id: userId });
    user.consentAcceptedAt = new Date();
    user.consentVersion = consentVersion;
    return this.usersRepository.save(user);
  }

  async findById(userId: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id: userId } });
  }
}
