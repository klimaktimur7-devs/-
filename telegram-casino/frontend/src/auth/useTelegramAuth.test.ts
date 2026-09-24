import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useTelegramAuth } from './useTelegramAuth';

describe('useTelegramAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('authenticates using Telegram initData', async () => {
    window.Telegram = {
      WebApp: {
        initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc',
        initDataUnsafe: {},
        ready: vi.fn(),
        expand: vi.fn(),
        HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
        openInvoice: vi.fn(),
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'jwt-token', userId: 'user-1' }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTelegramAuth());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.userId).toBe('user-1');
  });

  it('reports an error when not running inside Telegram', async () => {
    window.Telegram = undefined;

    const { result } = renderHook(() => useTelegramAuth());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Not running inside Telegram');
  });
});
