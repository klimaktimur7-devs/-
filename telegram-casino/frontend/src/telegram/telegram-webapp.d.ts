export interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  ready(): void;
  expand(): void;
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
  openInvoice(url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
