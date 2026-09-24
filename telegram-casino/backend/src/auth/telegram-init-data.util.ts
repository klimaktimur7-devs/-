import { createHmac, timingSafeEqual } from 'crypto';

export interface TelegramInitDataUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user: TelegramInitDataUser;
  authDate: number;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): ValidatedInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const hashBuffer = Buffer.from(hash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');
  if (hashBuffer.length !== computedBuffer.length || !timingSafeEqual(hashBuffer, computedBuffer)) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) {
    return null;
  }

  const userRaw = params.get('user');
  if (!userRaw) return null;
  const user = JSON.parse(userRaw) as TelegramInitDataUser;
  if (!user.id) return null;

  return { user, authDate };
}
