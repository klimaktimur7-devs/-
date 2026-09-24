import { apiFetch } from './client';

export interface CreateStarsInvoiceResponse {
  invoiceLink: string;
}

export function createStarsInvoice(amountStars: number): Promise<CreateStarsInvoiceResponse> {
  return apiFetch<CreateStarsInvoiceResponse>('/deposits/stars/invoice', {
    method: 'POST',
    body: JSON.stringify({ amountStars }),
  });
}
