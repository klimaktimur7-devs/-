import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from './ProfileScreen';

describe('ProfileScreen', () => {
  it('renders the display name, balance, and empty stats', () => {
    render(
      <ProfileScreen
        profile={{ id: '1', username: 'alex', firstName: 'Alex', hasAcceptedConsent: true, isAdmin: false }}
        balanceGram={123.45}
        onDepositClick={vi.fn()}
        onOpenShop={vi.fn()}
      />,
    );

    expect(screen.getByText('@alex')).toBeInTheDocument();
    expect(screen.getByText('123.45')).toBeInTheDocument();
    expect(screen.getByText('Мой Инвентарь')).toBeInTheDocument();
    expect(screen.getByText('У тебя пока нет айтемов.')).toBeInTheDocument();
  });
});
