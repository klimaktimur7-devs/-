import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserEntity } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;
  const repoMock = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'generated-id', ...data })),
    findOneByOrFail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(UserEntity), useValue: repoMock }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('creates a new user when telegramId is not found', async () => {
    repoMock.findOne.mockResolvedValue(null);
    const user = await service.findOrCreateByTelegramProfile({ telegramId: '42', username: 'alex' });
    expect(user.id).toBe('generated-id');
    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '42', username: 'alex' }),
    );
  });

  it('updates and returns the existing user when telegramId is found', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'existing-id', telegramId: '42', username: 'old' });
    const user = await service.findOrCreateByTelegramProfile({ telegramId: '42', username: 'new' });
    expect(user.id).toBe('existing-id');
    expect(user.username).toBe('new');
  });

  it('records consent acceptance with a timestamp', async () => {
    repoMock.findOneByOrFail.mockResolvedValue({ id: 'existing-id', consentAcceptedAt: null });
    const user = await service.acceptConsent('existing-id', 'v1');
    expect(user.consentVersion).toBe('v1');
    expect(user.consentAcceptedAt).toBeInstanceOf(Date);
  });
});
