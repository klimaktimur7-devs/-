import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from './client';

describe('apiFetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws an ApiError carrying the response status on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    await expect(apiFetch('/whatever')).rejects.toMatchObject({ status: 503 });
    await expect(apiFetch('/whatever')).rejects.toBeInstanceOf(ApiError);
  });
});
