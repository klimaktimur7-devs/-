import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// Dev-only convenience: visit http://localhost:5173/?mock=1 to preview the UI
// in a normal browser without opening it inside Telegram. Signs initData with
// the same TELEGRAM_BOT_TOKEN as backend/.env.example so /auth/telegram
// actually accepts it. Never active in production builds.
async function installDevTelegramMock(): Promise<void> {
  const BOT_TOKEN = 'test-bot-token-123456:ABCDEF';
  const encoder = new TextEncoder();

  async function hmacSha256Hex(keyBytes: Uint8Array<ArrayBuffer>, message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function hmacSha256Bytes(keyBytes: Uint8Array<ArrayBuffer>, message: string): Promise<Uint8Array<ArrayBuffer>> {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return new Uint8Array(signature);
  }

  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: 424242, username: 'devuser', first_name: 'Alex' }),
  };
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKeyBytes = await hmacSha256Bytes(encoder.encode('WebAppData'), BOT_TOKEN);
  const hash = await hmacSha256Hex(secretKeyBytes, dataCheckString);

  const initData = new URLSearchParams({ ...fields, hash }).toString();

  window.Telegram = {
    WebApp: {
      initData,
      initDataUnsafe: {},
      ready: () => {},
      expand: () => {},
      HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
      openInvoice: (_url, callback) => callback('paid'),
    },
  };
}

async function bootstrap(): Promise<void> {
  if (
    import.meta.env.DEV &&
    !window.Telegram?.WebApp?.initData &&
    new URLSearchParams(location.search).get('mock') === '1'
  ) {
    await installDevTelegramMock();
  }

  window.Telegram?.WebApp.ready();
  window.Telegram?.WebApp.expand();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
