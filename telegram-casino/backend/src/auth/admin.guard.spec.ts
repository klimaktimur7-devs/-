import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';

function contextWithUser(telegramId: string | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: telegramId ? { telegramId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  function guardWithAdminId(adminId: string) {
    const configService = { get: jest.fn().mockReturnValue(adminId) } as unknown as ConfigService;
    return new AdminGuard(configService);
  }

  it('allows the configured admin telegram id', () => {
    const guard = guardWithAdminId('6742434708');
    expect(guard.canActivate(contextWithUser('6742434708'))).toBe(true);
  });

  it('rejects a different telegram id', () => {
    const guard = guardWithAdminId('6742434708');
    expect(() => guard.canActivate(contextWithUser('111'))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user', () => {
    const guard = guardWithAdminId('6742434708');
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
