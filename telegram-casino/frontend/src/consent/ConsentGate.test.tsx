import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsentGate } from './ConsentGate';
import * as meApi from '../api/me';

describe('ConsentGate', () => {
  it('calls onAccepted after successfully submitting consent', async () => {
    vi.spyOn(meApi, 'acceptConsent').mockResolvedValue({ hasAcceptedConsent: true });
    const onAccepted = vi.fn();

    render(<ConsentGate onAccepted={onAccepted} />);
    fireEvent.click(screen.getByText('Мне есть 18, принимаю правила'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
  });

  it('shows an error message when the request fails', async () => {
    vi.spyOn(meApi, 'acceptConsent').mockRejectedValue(new Error('network error'));

    render(<ConsentGate onAccepted={vi.fn()} />);
    fireEvent.click(screen.getByText('Мне есть 18, принимаю правила'));

    await waitFor(() =>
      expect(screen.getByText('Не удалось сохранить согласие, попробуйте ещё раз')).toBeInTheDocument(),
    );
  });
});
