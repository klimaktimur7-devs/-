import { useState } from 'react';
import { CircleXIcon, EyeOffIcon, LanguagesIcon, VolumeXIcon } from '../icons/Icons';
import { hapticImpact } from '../telegram/haptics';
import { useModalA11y } from '../hooks/useModalA11y';

interface SettingsModalProps {
  onClose: () => void;
}

const ROWS = [
  { icon: VolumeXIcon, label: 'Звук', value: 'Выключено' },
  { icon: EyeOffIcon, label: 'Режим стримера', value: 'Выключено' },
  { icon: CircleXIcon, label: 'Анон-мод в PvP', value: 'Выключено' },
  { icon: LanguagesIcon, label: 'Язык', value: 'Русский' },
];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const sheetRef = useModalA11y<HTMLDivElement>(onClose);
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);

  function handleClose() {
    hapticImpact('light');
    onClose();
  }

  function handleRowClick(label: string) {
    hapticImpact('light');
    setComingSoonLabel(`«${label}» скоро появится`);
    window.setTimeout(() => setComingSoonLabel(null), 1800);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
        className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-[24px] border-t border-deposit-light/20 p-5 pb-7 flex flex-col gap-3 shadow-[0_-16px_48px_rgba(0,0,0,0.55)] outline-none"
      >
        <div className="w-9 h-1 rounded-full bg-white/15 mx-auto" aria-hidden="true" />

        <div className="flex items-center justify-between">
          <h2 id="settings-modal-title" className="text-[19px] font-extrabold tracking-tight">
            Настройки
          </h2>
          <button
            onClick={handleClose}
            aria-label="Закрыть"
            className="w-9 h-9 rounded-full bg-surface2 border border-white/10 flex items-center justify-center transition-transform duration-150 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            <CircleXIcon size={16} color="#9ca3af" />
          </button>
        </div>

        {ROWS.map(({ icon: Icon, label, value }) => (
          <button
            key={label}
            onClick={() => handleRowClick(label)}
            className="w-full h-14 rounded-2xl bg-surface2 border border-white/[0.06] px-4 flex items-center justify-center gap-2 text-[14px] font-semibold transition-transform duration-150 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            <Icon size={16} color="#9ca3af" />
            <span className="text-gray-300">{label}</span>
            <span className="ml-auto text-white font-bold">{value}</span>
          </button>
        ))}

        {comingSoonLabel && (
          <div role="status" className="text-center text-[11.5px] font-semibold text-white/70">
            {comingSoonLabel}
          </div>
        )}
      </div>
    </div>
  );
}
