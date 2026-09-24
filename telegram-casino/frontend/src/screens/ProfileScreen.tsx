import { useState } from 'react';
import { MeProfile } from '../api/me';
import { CopyIcon, DotsGridIcon, GemIcon, GiftIcon, PlusIcon, SlidersIcon, StarIcon, UsersIcon } from '../icons/Icons';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { hapticImpact } from '../telegram/haptics';
import { SettingsModal } from '../components/SettingsModal';
import { InventoryModal } from '../components/InventoryModal';

interface ProfileScreenProps {
  profile: MeProfile;
  balanceGram: number;
  onDepositClick: () => void;
  onOpenShop: () => void;
}

export function ProfileScreen({ profile, balanceGram, onDepositClick, onOpenShop }: ProfileScreenProps) {
  const displayName = profile.firstName ?? profile.username ?? 'Игрок';
  const initial = displayName.charAt(0).toUpperCase();
  const photoUrl = window.Telegram?.WebApp.initDataUnsafe.user?.photo_url;
  const [photoFailed, setPhotoFailed] = useState(false);
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  function handleDepositClick() {
    hapticImpact('light');
    onDepositClick();
  }

  function handleComingSoon(label: string) {
    hapticImpact('light');
    setComingSoonLabel(label);
    window.setTimeout(() => setComingSoonLabel(null), 1800);
  }

  return (
    <div className="relative min-h-full bg-bg text-white">
      <div className="relative bg-hero-teal px-5 pt-[22px] pb-6 overflow-hidden">
        <div
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[280px] h-[160px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(255,255,255,0.18), transparent 70%)' }}
        />
        <div className="relative text-center text-[13px] font-medium text-white/50">Игровой баланс</div>
        <div className="relative flex items-center justify-center gap-2 mt-1.5">
          <span className="text-[34px] font-extrabold tracking-tight tabular-nums text-white">
            <AnimatedNumber value={balanceGram} />
          </span>
          <GemIcon size={22} color="#fff" />
        </div>

        <div className="relative flex gap-2.5 mt-4">
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
            <button
              onClick={handleDepositClick}
              aria-label="Пополнить Stars"
              className="w-full h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center transition-transform duration-150 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <StarIcon size={18} color="#fff" />
            </button>
            <span className="text-[10px] font-bold text-white whitespace-nowrap">Пополнить Stars</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
            <button
              onClick={() => handleComingSoon('Пополнение TON скоро появится')}
              aria-label="Пополнить TON"
              className="w-full h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center transition-transform duration-150 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <GemIcon size={18} color="#fff" />
            </button>
            <span className="text-[10px] font-bold text-white whitespace-nowrap">Пополнить TON</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
            <button
              onClick={() => handleComingSoon('Отправка гифтов скоро появится')}
              aria-label="Отправить гифты"
              className="w-full h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center transition-transform duration-150 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <GiftIcon size={18} color="#fff" />
            </button>
            <span className="text-[10px] font-bold text-white whitespace-nowrap">Отправить гифты</span>
          </div>
        </div>

        {comingSoonLabel && (
          <div role="status" className="relative mt-2.5 text-center text-[11.5px] font-semibold text-white/70">
            {comingSoonLabel}
          </div>
        )}
      </div>

      <div className="relative -mt-4 rounded-t-[24px] bg-bg pb-8 flex flex-col gap-3.5">
        <div className="sticky top-0 z-10 bg-bg px-5 pt-5 pb-3.5 flex items-center gap-3.5">
          <div className="w-[52px] h-[52px] rounded-full border border-white/10 overflow-hidden shrink-0">
            {photoUrl && !photoFailed ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="w-full h-full bg-[#16131f] flex items-center justify-center text-lg font-extrabold">
                {initial}
              </div>
            )}
          </div>
          <div className="flex-1 text-[17px] font-extrabold tracking-tight">
            {profile.username ? `@${profile.username}` : displayName}
          </div>
          <button
            onClick={() => {
              hapticImpact('light');
              setSettingsOpen(true);
            }}
            aria-label="Настройки"
            className="w-10 h-10 rounded-full bg-surface2 border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-150 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            <SlidersIcon size={17} color="#9ca3af" />
          </button>
        </div>

        <div className="mx-5 bg-surface2 border border-white/[0.06] rounded-[18px] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">Мой Инвентарь</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              0 Айтемов · 0 <GemIcon size={11} color="#9ca3af" />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="aspect-square rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <GiftIcon size={20} color="#4b5563" />
            </div>
            <div className="aspect-square rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <GiftIcon size={20} color="#4b5563" />
            </div>
            <button
              onClick={() => {
                hapticImpact('light');
                setInventoryOpen(true);
              }}
              className="aspect-square rounded-2xl bg-white/[0.04] flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-gray-400 transition-transform duration-150 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            >
              <DotsGridIcon size={16} color="#9ca3af" />
              Все Айтемы
            </button>
          </div>
        </div>

        <div className="mx-5 bg-surface2 border border-white/[0.08] rounded-pill px-4 h-11 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-deposit-light">У тебя пока нет айтемов.</span>
          <button
            onClick={() => handleComingSoon('Отправка гифтов скоро появится')}
            className="text-[12.5px] font-bold text-deposit-light outline-none focus-visible:ring-2 focus-visible:ring-deposit-light rounded"
          >
            Отправить гифт ›
          </button>
        </div>

        <div className="relative mx-5 bg-surface2 border border-white/[0.06] rounded-[18px] p-4 overflow-hidden">
          <div
            className="pointer-events-none absolute -top-6 -right-10 w-[160px] h-[160px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.28), transparent 70%)' }}
          />
          <div className="pointer-events-none absolute top-3 right-4 w-20 h-16">
            <div
              className="absolute top-0 left-3 w-9 h-9 rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #BBF7D0, #4ADE80 55%, #16A34A 100%)',
                boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
              }}
            />
            <PlusIcon size={17} color="#4ADE80" className="absolute top-1 right-0 -rotate-6" />
            <div
              className="absolute bottom-0 left-0 w-16 h-8 rounded-full -rotate-6"
              style={{
                background: 'radial-gradient(circle at 30% 20%, #BBF7D0, #4ADE80 60%, #16A34A 100%)',
                boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
              }}
            />
          </div>
          <div className="relative text-[15px] font-bold leading-snug max-w-[220px]">
            Приглашай рефералов и получай{' '}
            <span className="inline-flex items-center rounded-pill bg-[#4ADE80]/20 text-[#4ADE80] text-[12px] font-extrabold px-1.5 py-0.5 align-middle">
              10%
            </span>{' '}
            от их игровых комиссий
          </div>
          <div className="relative flex gap-2 mt-3.5">
            <button
              onClick={() => handleComingSoon('Реферальная программа скоро появится')}
              className="flex-1 h-12 rounded-2xl bg-white text-[#0A0A0F] font-bold text-sm transition-transform duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            >
              Пригласить друзей
            </button>
            <button
              onClick={() => handleComingSoon('Реферальная программа скоро появится')}
              aria-label="Скопировать реферальную ссылку"
              className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-150 active:scale-[0.94] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            >
              <CopyIcon size={17} color="#9ca3af" />
            </button>
          </div>
        </div>

        <div className="mx-5 bg-surface2 border border-white/[0.06] rounded-[18px] p-4">
          <div className="text-[22px] font-extrabold tracking-tight">0 TON</div>
          <div className="text-[12.5px] text-gray-500 mt-0.5">Доступно к зачислению</div>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="bg-white/[0.04] rounded-2xl px-3 py-2.5 flex items-center gap-2">
              <UsersIcon size={15} color="#9ca3af" />
              <div>
                <div className="text-[13px] font-bold leading-tight">0</div>
                <div className="text-[10.5px] text-gray-500 leading-tight">Твои рефералы</div>
              </div>
            </div>
            <div className="bg-white/[0.04] rounded-2xl px-3 py-2.5 flex items-center gap-2">
              <GemIcon size={13} color="#9ca3af" />
              <div>
                <div className="text-[13px] font-bold leading-tight">0</div>
                <div className="text-[10.5px] text-gray-500 leading-tight">Всего зачислено</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleComingSoon('Реферальная программа скоро появится')}
            className="mt-3 w-full h-12 rounded-2xl bg-[#2A7A85] text-[#062B45] font-bold text-sm transition-transform duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            Зачислить
          </button>
        </div>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {inventoryOpen && (
        <InventoryModal
          balanceGram={balanceGram}
          onClose={() => setInventoryOpen(false)}
          onOpenShop={() => {
            setInventoryOpen(false);
            onOpenShop();
          }}
        />
      )}
    </div>
  );
}
