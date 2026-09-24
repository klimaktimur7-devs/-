import { apiFetch } from './client';
import { MarketGift } from '../screens/market/MarketScreen';

export interface GiftPreview {
  name: string;
  editionNumber: number;
  model: string;
  symbol: string;
  backdropName: string;
  backdropColor: string;
  imageUrl: string | null;
  telegramSlug: string;
}

export function fetchAdminGifts(): Promise<MarketGift[]> {
  return apiFetch<MarketGift[]>('/admin/gifts');
}

export function resolveGiftLink(link: string): Promise<GiftPreview> {
  return apiFetch<GiftPreview>('/admin/gifts/resolve', {
    method: 'POST',
    body: JSON.stringify({ link }),
  });
}

export function createGift(input: GiftPreview & { priceTon: number }): Promise<MarketGift> {
  return apiFetch<MarketGift>('/admin/gifts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteGift(id: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/admin/gifts/${id}`, { method: 'DELETE' });
}
