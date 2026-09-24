import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminGiftsScreen } from './AdminGiftsScreen';

const existingGift = {
  id: 'gift-1',
  editionNumber: 33564,
  name: 'Vice Cream',
  imageUrl: '/gift-assets/ViceCream-33564.webp',
  backdropColor: '#75944d',
  backdropName: 'Camo Green',
  model: 'Vanilla',
  symbol: 'Pickaxe',
  priceTon: 150,
};

function mockFetch({
  resolvePreview = null as unknown,
  resolveStatus = 400,
  createResult = null as unknown,
  createStatus = 409,
} = {}) {
  globalThis.fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/admin/gifts/resolve')) {
      if (!resolvePreview) {
        return Promise.resolve({ ok: false, status: resolveStatus });
      }
      return Promise.resolve({ ok: true, json: async () => resolvePreview });
    }
    if (url.includes('/admin/gifts/') && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: async () => ({ deleted: true }) });
    }
    if (url.endsWith('/admin/gifts') && init?.method === 'POST') {
      if (!createResult) {
        return Promise.resolve({ ok: false, status: createStatus });
      }
      return Promise.resolve({ ok: true, json: async () => createResult });
    }
    if (url.endsWith('/admin/gifts')) {
      return Promise.resolve({ ok: true, json: async () => [existingGift] });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  }) as unknown as typeof fetch;
}

describe('AdminGiftsScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing gifts on load', async () => {
    mockFetch();
    render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Vice Cream')).toBeInTheDocument());
    expect(screen.getByText(/150\.00/)).toBeInTheDocument();
  });

  it('resolves a link and shows an editable preview before saving', async () => {
    const preview = {
      name: 'Vice Cream',
      editionNumber: 33564,
      model: 'Vanilla',
      symbol: 'Pickaxe',
      backdropName: 'Camo Green',
      backdropColor: '#75944d',
      imageUrl: '/gift-assets/ViceCream-33564.webp',
      telegramSlug: 'ViceCream-33564',
    };
    mockFetch({ resolvePreview: preview });
    render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => screen.getByLabelText('Добавить подарок'));

    fireEvent.click(screen.getByLabelText('Добавить подарок'));
    fireEvent.change(screen.getByPlaceholderText('t.me/nft/...'), {
      target: { value: 'https://t.me/nft/ViceCream-33564' },
    });
    fireEvent.click(screen.getByText('Найти'));

    await waitFor(() => expect(screen.getByDisplayValue('Vanilla')).toBeInTheDocument());
  });

  it('shows a service-unavailable message when the resolver returns 503, distinct from a not-found link', async () => {
    mockFetch({ resolveStatus: 503 });
    render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => screen.getByLabelText('Добавить подарок'));

    fireEvent.click(screen.getByLabelText('Добавить подарок'));
    fireEvent.change(screen.getByPlaceholderText('t.me/nft/...'), {
      target: { value: 'https://t.me/nft/Whatever-1' },
    });
    fireEvent.click(screen.getByText('Найти'));

    await waitFor(() =>
      expect(screen.getByText('Сервис поиска подарков временно недоступен')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Не нашёл подарок по этой ссылке')).not.toBeInTheDocument();
  });

  async function saveAndGetErrorMessage(createStatus: number): Promise<string> {
    const preview = {
      name: 'Vice Cream',
      editionNumber: 33564,
      model: 'Vanilla',
      symbol: 'Pickaxe',
      backdropName: 'Camo Green',
      backdropColor: '#75944d',
      imageUrl: '/gift-assets/ViceCream-33564.webp',
      telegramSlug: 'ViceCream-33564',
    };
    mockFetch({ resolvePreview: preview, createStatus });
    const { unmount } = render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => screen.getByLabelText('Добавить подарок'));

    fireEvent.click(screen.getByLabelText('Добавить подарок'));
    fireEvent.change(screen.getByPlaceholderText('t.me/nft/...'), {
      target: { value: 'https://t.me/nft/ViceCream-33564' },
    });
    fireEvent.click(screen.getByText('Найти'));
    await waitFor(() => expect(screen.getByDisplayValue('Vanilla')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Цена (TON)'), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const message = screen.getByRole('alert').textContent ?? '';
    unmount();
    return message;
  }

  it('shows a distinct message for a duplicate slug (409) than for a generic save failure', async () => {
    const duplicateMessage = await saveAndGetErrorMessage(409);
    expect(duplicateMessage).toBe('Этот подарок уже есть в магазине');

    const genericMessage = await saveAndGetErrorMessage(500);
    expect(genericMessage).not.toBe('Этот подарок уже есть в магазине');
  });

  it('keeps Save disabled for a zero or blank price and enables it for a positive one', async () => {
    const preview = {
      name: 'Vice Cream',
      editionNumber: 33564,
      model: 'Vanilla',
      symbol: 'Pickaxe',
      backdropName: 'Camo Green',
      backdropColor: '#75944d',
      imageUrl: '/gift-assets/ViceCream-33564.webp',
      telegramSlug: 'ViceCream-33564',
    };
    mockFetch({ resolvePreview: preview });
    render(<AdminGiftsScreen onGiftsChanged={vi.fn()} />);
    await waitFor(() => screen.getByLabelText('Добавить подарок'));

    fireEvent.click(screen.getByLabelText('Добавить подарок'));
    fireEvent.change(screen.getByPlaceholderText('t.me/nft/...'), {
      target: { value: 'https://t.me/nft/ViceCream-33564' },
    });
    fireEvent.click(screen.getByText('Найти'));
    await waitFor(() => expect(screen.getByDisplayValue('Vanilla')).toBeInTheDocument());

    const saveButton = screen.getByText('Сохранить') as HTMLButtonElement;
    const priceInput = screen.getByLabelText('Цена (TON)');
    expect(saveButton.disabled).toBe(true);

    fireEvent.change(priceInput, { target: { value: '0' } });
    expect(saveButton.disabled).toBe(true);

    fireEvent.change(priceInput, { target: { value: '150' } });
    expect(saveButton.disabled).toBe(false);
  });

  it('calls onGiftsChanged after a successful delete', async () => {
    mockFetch();
    const onGiftsChanged = vi.fn();
    render(<AdminGiftsScreen onGiftsChanged={onGiftsChanged} />);
    await waitFor(() => expect(screen.getByText('Vice Cream')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Удалить Vice Cream'));
    fireEvent.click(screen.getByText('Да, удалить'));

    await waitFor(() => expect(onGiftsChanged).toHaveBeenCalled());
  });
});
