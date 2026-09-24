import { apiFetch } from './client';

export interface BalanceResponse {
  balanceGram: number;
}

export function fetchBalance(): Promise<BalanceResponse> {
  return apiFetch<BalanceResponse>('/me/balance');
}
