import { validateTelegramInitData } from './telegram-init-data.util';
import { buildValidTelegramInitData } from '../testing/build-init-data';

const BOT_TOKEN = 'test-bot-token-123456:ABCDEF';

describe('validateTelegramInitData', () => {
  it('accepts correctly signed initData and returns the user', () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN);
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(42);
    expect(result?.user.username).toBe('alex');
  });

  it('rejects initData with a tampered field', () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN);
    const tampered = initData.replace('alex', 'mallory');
    const result = validateTelegramInitData(tampered, BOT_TOKEN);
    expect(result).toBeNull();
  });

  it('rejects initData signed with a different bot token', () => {
    const initData = buildValidTelegramInitData(BOT_TOKEN);
    const result = validateTelegramInitData(initData, 'different-token');
    expect(result).toBeNull();
  });

  it('rejects initData older than 24 hours', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    const initData = buildValidTelegramInitData(BOT_TOKEN, {}, oldAuthDate);
    const result = validateTelegramInitData(initData, BOT_TOKEN);
    expect(result).toBeNull();
  });
});
