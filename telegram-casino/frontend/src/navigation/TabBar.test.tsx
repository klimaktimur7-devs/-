import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders all five tabs and highlights the active one', () => {
    render(<TabBar activeTab="profile" onChange={vi.fn()} />);
    expect(screen.getByText('Профиль')).toHaveClass('text-white');
    expect(screen.getByText('PvP')).toHaveClass('text-gray-500');
  });

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn();
    render(<TabBar activeTab="profile" onChange={onChange} />);
    fireEvent.click(screen.getByText('Solo'));
    expect(onChange).toHaveBeenCalledWith('solo');
  });
});
