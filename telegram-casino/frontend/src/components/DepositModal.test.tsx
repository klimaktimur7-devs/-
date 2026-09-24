import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DepositModal } from './DepositModal';
import * as depositsApi from '../api/deposits';

describe('DepositModal', () => {
  it('opens the Telegram invoice and calls onDeposited when paid', async () => {
    vi.spyOn(depositsApi, 'createStarsInvoice').mockResolvedValue({
      invoiceLink: 'https://t.me/invoice/xyz',
    });
    const openInvoice = vi.fn((_url: string, callback: (status: string) => void) => callback('paid'));
    window.Telegram = {
      WebApp: {
        initData: '',
        initDataUnsafe: {},
        ready: vi.fn(),
        expand: vi.fn(),
        HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
        openInvoice,
      },
    };

    const onDeposited = vi.fn();
    const onClose = vi.fn();
    render(<DepositModal onClose={onClose} onDeposited={onDeposited} />);

    fireEvent.click(screen.getByRole('button', { name: 'Купить набор за 500 Stars' }));

    await waitFor(() => expect(onDeposited).toHaveBeenCalled());
    expect(openInvoice).toHaveBeenCalledWith('https://t.me/invoice/xyz', expect.any(Function));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error when invoice creation fails', async () => {
    vi.spyOn(depositsApi, 'createStarsInvoice').mockRejectedValue(new Error('network error'));

    render(<DepositModal onClose={vi.fn()} onDeposited={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Купить набор за 500 Stars' }));

    await waitFor(() =>
      expect(screen.getByText('Не удалось создать счёт, попробуйте ещё раз')).toBeInTheDocument(),
    );
  });
});
