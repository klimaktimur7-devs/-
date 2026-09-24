import { apiFetch } from './client';
import { MarketGift } from '../screens/market/MarketScreen';

export function fetchGifts(): Promise<MarketGift[]> {
  return apiFetch<MarketGift[]>('/gifts');
}
