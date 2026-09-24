import { GemIcon, PlusIcon } from '../icons/Icons';
import { AnimatedNumber } from './AnimatedNumber';
import { hapticImpact } from '../telegram/haptics';

interface HeaderProps {
  balanceGram: number;
  onDepositClick: () => void;
}

export function Header({ balanceGram, onDepositClick }: HeaderProps) {
  function handleDepositClick() {
    hapticImpact('light');
    onDepositClick();
  }

  return (
    <header className="shrink-0 h-16 bg-surface/90 backdrop-blur border-b border-white/[0.07] flex items-center justify-between px-5 z-20">
      <span
        className="flex items-center gap-1.5 min-h-9 rounded-pill pl-2.5 pr-3.5 bg-white/[0.04] border border-white/10 text-[12px] leading-[14px] font-medium tracking-[-0.02em] tabular-nums"
        aria-live="polite"
        aria-label={`Баланс: ${balanceGram.toFixed(2)} Gram`}
      >
        <GemIcon size={16} color="#38BDF8" />
        <AnimatedNumber value={balanceGram} />
      </span>
      <button
        onClick={handleDepositClick}
        className="flex items-center gap-1.5 min-h-11 rounded-pill px-[18px] py-2.5 bg-deposit-gradient text-sm font-bold text-[#062B45] shadow-[0_6px_18px_rgba(14,165,233,0.45)] transition-transform duration-150 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <PlusIcon size={15} color="#062B45" /> Пополнить
      </button>
    </header>
  );
}
