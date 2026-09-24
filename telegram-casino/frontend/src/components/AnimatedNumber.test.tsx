import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatedNumber } from './AnimatedNumber';

describe('AnimatedNumber', () => {
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCallback = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the initial value immediately without animating', () => {
    render(<AnimatedNumber value={128.5} />);
    expect(screen.getByText('128.50')).toBeInTheDocument();
    expect(rafCallback).toBeNull();
  });

  it('animates to the new value when the prop changes', () => {
    const { rerender: rr } = render(<AnimatedNumber value={100} />);
    expect(screen.getByText('100.00')).toBeInTheDocument();

    rr(<AnimatedNumber value={250} />);
    expect(rafCallback).not.toBeNull();

    // First frame establishes the animation's start time...
    act(() => rafCallback!(0));
    // ...second frame is far enough past it that progress clamps to 1.
    act(() => rafCallback!(10_000));

    expect(screen.getByText('250.00')).toBeInTheDocument();
  });
});
