import { useState } from 'react';
import { CircleXIcon, FrownIcon, GemIcon } from '../icons/Icons';
import { hapticImpact } from '../telegram/haptics';
import { useModalA11y } from '../hooks/useModalA11y';

interface InventoryModalProps {
  balanceGram: number;
  onClose: () => void;
  onOpenShop: () => void;
}

type InventoryTab = 'all' | 'gifts' | 'lootboxes' | 'upgrades';

const TABS: { id: InventoryTab; label: string; emptyText: string; cta: string }[] = [
  { id: 'all', label: 'Все', emptyText: 'У тебя пока нет айтемов. Время купить!', cta: 'Открыть магазин' },
  { id: 'gifts', label: 'Гифты', emptyText: 'У тебя пока нет гифтов. Время купить!', cta: 'Отправить гифты' },
  { id: 'lootboxes', label: 'Лутпаки', emptyText: 'У тебя пока нет лутпаков. Время купить!', cta: 'Открыть магазин' },
  { id: 'upgrades', label: 'Апгрейды', emptyText: 'У тебя пока нет апгрейдов. Время купить!', cta: 'Открыть магазин' },
];

export function InventoryModal({ balanceGram, onClose, onOpenShop }: InventoryModalProps) {
  const sheetRef = useModalA11y<HTMLDivElement>(onClose);
  const [tab, setTab] = useState<InventoryTab>('all');
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);

  function handleClose() {
    hapticImpact('light');
    onClose();
  }

  function handleCta() {
    hapticImpact('light');
    if (tab === 'gifts') {
      setComingSoonLabel('Отправка гифтов скоро появится');
      window.setTimeout(() => setComingSoonLabel(null), 1800);
      return;
    }
    onOpenShop();
  }

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-bg flex flex-col outline-none"
    >
      <div className="relative shrink-0 bg-hero-teal px-5 pt-[22px] pb-4 flex items-center justify-between">
        <h2 id="inventory-modal-title" className="relative text-[26px] font-extrabold tracking-tight">
          Инвентарь
        </h2>
        <div className="relative flex items-center gap-2">
          <span className="flex items-center gap-1 h-9 rounded-pill px-3 bg-white/10 text-sm font-extrabold tabular-nums">
            <GemIcon size={14} color="#fff" />
            {balanceGram.toFixed(2)}
          </span>
          <button
            onClick={handleClose}
            aria-label="Закрыть"
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-150 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <CircleXIcon size={16} color="#fff" />
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Категории инвентаря" className="shrink-0 flex gap-5 px-5 border-b border-white/[0.07]">
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                hapticImpact('light');
                setTab(id);
              }}
              className={`h-11 text-[14px] font-bold border-b-2 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light ${
                active ? 'border-deposit-light text-white' : 'border-transparent text-gray-500'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 px-8 text-center">
        <FrownIcon size={64} color="#fff" />
        <p className="text-[15px] font-bold text-white max-w-[240px]">{activeTab.emptyText}</p>
      </div>

      <div className="shrink-0 p-5 pt-0 flex flex-col gap-2">
        {comingSoonLabel && (
          <div role="status" className="text-center text-[11.5px] font-semibold text-gray-400">
            {comingSoonLabel}
          </div>
        )}
        <button
          onClick={handleCta}
          className="w-full h-14 rounded-2xl bg-deposit-gradient text-[#062B45] font-extrabold text-base shadow-[0_10px_28px_rgba(14,165,233,0.5)] transition-transform duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {activeTab.cta}
        </button>
      </div>
    </div>
  );
}
