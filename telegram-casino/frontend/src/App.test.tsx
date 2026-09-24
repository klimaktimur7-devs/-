import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

function mockTelegramWebApp() {
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
}

function mockAuthenticatedFetch(hasAcceptedConsent: boolean, isAdmin = false) {
  globalThis.fetch = vi.fn((url: string) => {
    if (url.includes('/auth/telegram')) {
      return Promise.resolve({ ok: true, json: async () => ({ accessToken: 'jwt', userId: 'user-1' }) });
    }
    if (url.includes('/me/balance')) {
      return Promise.resolve({ ok: true, json: async () => ({ balanceGram: 42.5 }) });
    }
    if (url.includes('/gifts')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: 'user-1', username: 'alex', firstName: 'Alex', hasAcceptedConsent, isAdmin }),
    });
  }) as unknown as typeof fetch;
}

describe('App', () => {
  it('shows the PvP coming-soon screen and balance by default after authentication', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Раздел появится следующим')).toBeInTheDocument());
    expect(screen.getByText('PvP', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('42.50')).toBeInTheDocument());
  });

  it('opens the app directly without a consent screen for a profile with no recorded consent', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(false);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Раздел появится следующим')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('42.50')).toBeInTheDocument());
    expect(screen.queryByText(/18/)).not.toBeInTheDocument();
  });

  it('opens the deposit modal from the header', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Пополнить')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Пополнить'));

    expect(screen.getByText('Пополнить баланс')).toBeInTheDocument();
  });

  it('navigates to the Profile tab and shows profile details', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Раздел появится следующим')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Профиль'));

    expect(screen.getByText('@alex')).toBeInTheDocument();
    expect(screen.getByText('Мой Инвентарь')).toBeInTheDocument();
  });

  it('shows the Admin tab only when the profile is an admin', async () => {
    mockTelegramWebApp();
    mockAuthenticatedFetch(true, false);
    const { unmount } = render(<App />);
    await waitFor(() => expect(screen.getByText('Раздел появится следующим')).toBeInTheDocument());
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    unmount();

    mockAuthenticatedFetch(true, true);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument());
  });
});
