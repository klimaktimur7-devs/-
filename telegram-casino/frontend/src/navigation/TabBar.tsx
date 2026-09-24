import { OverlapCirclesIcon, SlidersIcon, StoreIcon, SunburstIcon, UserSparkleIcon } from '../icons/Icons';
import { hapticImpact } from '../telegram/haptics';

export type TabId = 'pvp' | 'solo' | 'shop' | 'profile' | 'admin';

interface Tab {
  id: TabId;
  label: string;
  Icon: typeof StoreIcon;
}

export const TABS: Tab[] = [
  { id: 'shop', label: 'Магазин', Icon: StoreIcon },
  { id: 'pvp', label: 'PvP', Icon: OverlapCirclesIcon },
  { id: 'solo', label: 'Solo', Icon: SunburstIcon },
  { id: 'profile', label: 'Профиль', Icon: UserSparkleIcon },
];

const ADMIN_TAB: Tab = { id: 'admin', label: 'Admin', Icon: SlidersIcon };

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  showAdmin?: boolean;
}

export function TabBar({ activeTab, onChange, showAdmin = false }: TabBarProps) {
  const tabs = showAdmin ? [...TABS, ADMIN_TAB] : TABS;
  return (
    <nav
      aria-label="Основная навигация"
      className="shrink-0 h-[72px] bg-surface/97 border-t border-white/[0.07] flex items-center justify-around pb-1.5 z-10"
    >
      {tabs.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => {
              if (!active) hapticImpact('light');
              onChange(id);
            }}
            aria-current={active ? 'page' : undefined}
            className="relative flex flex-col items-center gap-1 min-w-[56px] min-h-[44px] justify-center transition-transform duration-150 active:scale-90 outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            <Icon size={21} className="relative transition-colors duration-200" color={active ? '#fff' : '#5c5966'} />
            <span
              className={`relative text-[12px] leading-[14px] font-medium tracking-[-0.02em] transition-colors duration-200 ${
                active ? 'text-white' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
