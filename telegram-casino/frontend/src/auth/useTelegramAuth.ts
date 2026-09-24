import { useEffect, useState } from 'react';
import { apiFetch, setAccessToken } from '../api/client';

export interface AuthState {
  status: 'loading' | 'authenticated' | 'error';
  userId: string | null;
  error: string | null;
}

interface LoginResponse {
  accessToken: string;
  userId: string;
}

export function useTelegramAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading', userId: null, error: null });

  useEffect(() => {
    const initData = window.Telegram?.WebApp.initData;
    if (!initData) {
      setState({ status: 'error', userId: null, error: 'Not running inside Telegram' });
      return;
    }

    apiFetch<LoginResponse>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    })
      .then((response) => {
        setAccessToken(response.accessToken);
        setState({ status: 'authenticated', userId: response.userId, error: null });
      })
      .catch((error: Error) => {
        setState({ status: 'error', userId: null, error: error.message });
      });
  }, []);

  return state;
}
