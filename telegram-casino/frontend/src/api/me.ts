import { apiFetch } from './client';

export interface MeProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  hasAcceptedConsent: boolean;
  isAdmin: boolean;
}

export function fetchMe(): Promise<MeProfile> {
  return apiFetch<MeProfile>('/me');
}

export function acceptConsent(consentVersion: string): Promise<{ hasAcceptedConsent: boolean }> {
  return apiFetch('/me/consent', {
    method: 'POST',
    body: JSON.stringify({ consentVersion }),
  });
}
