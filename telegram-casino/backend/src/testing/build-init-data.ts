import { createHmac } from 'crypto';

export function buildValidTelegramInitData(
  botToken: string,
  overrides: Record<string, string> = {},
  authDate: number = Math.floor(Date.now() / 1000),
): string {
  const user =
    overrides.user ??
    JSON.stringify({ id: 42, username: 'alex', first_name: 'Alex', language_code: 'ru' });
  const fields: Record<string, string> = {
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    ...overrides,
    user,
  };

  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}
