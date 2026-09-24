import { useMemo, useState } from 'react';
import { ChevronDownIcon, CircleXIcon, GemIcon, PlusIcon, SearchIcon, SortIcon } from '../../icons/Icons';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { hapticImpact } from '../../telegram/haptics';

export interface MarketGift {
  id: string;
  editionNumber: number;
  name: string;
  imageUrl: string;
  backdropColor: string;
  backdropName: string;
  model: string;
  symbol: string;
  priceTon: number;
}

interface MarketScreenProps {
  balanceGram: number;
  onDepositClick: () => void;
  gifts?: MarketGift[];
}

type FilterKey = 'type' | 'model' | 'backdropName';

interface FilterDef {
  key: FilterKey;
  label: string;
  sheetTitle: string;
  getValue: (gift: MarketGift) => string;
}

const FILTER_DEFS: FilterDef[] = [
  { key: 'type', label: 'Тип', sheetTitle: 'тип', getValue: (g) => g.name },
  { key: 'model', label: 'Скин', sheetTitle: 'скин', getValue: (g) => g.model },
  { key: 'backdropName', label: 'Фон', sheetTitle: 'фон', getValue: (g) => g.backdropName },
];

export function MarketScreen({ balanceGram, onDepositClick, gifts = [] }: MarketScreenProps) {
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<MarketGift | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, string | null>>({
    type: null,
    model: null,
    backdropName: null,
  });
  const [openFilter, setOpenFilter] = useState<FilterDef | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  function showComingSoon(label: string) {
    hapticImpact('light');
    setComingSoonLabel(label);
    window.setTimeout(() => setComingSoonLabel(null), 1800);
  }

  const backdropColorsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const gift of gifts) {
      if (!map.has(gift.backdropName)) map.set(gift.backdropName, gift.backdropColor);
    }
    return map;
  }, [gifts]);

  const optionsByFilter = useMemo(() => {
    const result: Record<FilterKey, string[]> = { type: [], model: [], backdropName: [] };
    for (const def of FILTER_DEFS) {
      result[def.key] = Array.from(new Set(gifts.map(def.getValue))).sort((a, b) => a.localeCompare(b));
    }
    return result;
  }, [gifts]);

  const filteredGifts = useMemo(() => {
    return gifts.filter((gift) =>
      FILTER_DEFS.every((def) => !activeFilters[def.key] || def.getValue(gift) === activeFilters[def.key]),
    );
  }, [gifts, activeFilters]);

  const hasAnyFilter = FILTER_DEFS.some((def) => activeFilters[def.key]);

  function openFilterSheet(def: FilterDef) {
    hapticImpact('light');
    setFilterSearch('');
    setOpenFilter(def);
  }

  function pickFilterValue(def: FilterDef, value: string) {
    hapticImpact('light');
    setActiveFilters((prev) => ({ ...prev, [def.key]: prev[def.key] === value ? null : value }));
    setOpenFilter(null);
  }

  return (
    <div className="min-h-full bg-bg text-white">
      <div className="relative bg-hero-teal px-5 pt-5 pb-4 flex items-center justify-between">
        <h2 className="relative text-[38px] leading-[38px] font-medium tracking-[-0.02em]">Магазин</h2>
        <div className="relative flex items-center gap-2">
          <span className="flex items-center gap-1 h-9 rounded-pill px-3 bg-white/10 text-[12px] leading-[14px] font-medium tracking-[-0.02em] tabular-nums">
            <GemIcon size={14} color="#fff" />
            <AnimatedNumber value={balanceGram} />
          </span>
          <button
            onClick={() => {
              hapticImpact('light');
              onDepositClick();
            }}
            aria-label="Пополнить"
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-150 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <PlusIcon size={16} color="#fff" />
          </button>
        </div>
      </div>

      <div className="h-11 flex items-center px-5 border-b border-white/[0.07]">
        <span className="text-[14px] leading-[18px] font-medium tracking-[-0.02em] border-b-2 border-white h-11 flex items-center">
          Gifts
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => showComingSoon('Сортировка скоро появится')}
            aria-label="Сортировка"
            className="w-10 h-10 shrink-0 rounded-2xl bg-white/5 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
          >
            <SortIcon size={16} color="#9ca3af" />
          </button>
          {FILTER_DEFS.map((def) => {
            const value = activeFilters[def.key];
            const hasOptions = optionsByFilter[def.key].length > 0;
            return (
              <button
                key={def.key}
                onClick={() => hasOptions && openFilterSheet(def)}
                disabled={!hasOptions}
                className={`h-10 shrink-0 rounded-2xl px-3 flex items-center gap-1.5 text-[14px] leading-[18px] font-medium tracking-[-0.02em] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-deposit-light disabled:opacity-40 ${
                  value ? 'bg-deposit-light/20 text-deposit-light' : 'bg-white/5 text-white'
                }`}
              >
                <span className="max-w-[92px] truncate">{value ?? def.label}</span>
                <ChevronDownIcon size={13} color={value ? '#38BDF8' : '#9ca3af'} />
              </button>
            );
          })}
          {hasAnyFilter && (
            <button
              onClick={() => {
                hapticImpact('light');
                setActiveFilters({ type: null, model: null, backdropName: null });
              }}
              className="h-10 shrink-0 rounded-2xl bg-white/5 px-3 flex items-center text-[14px] leading-[18px] font-medium tracking-[-0.02em] text-gray-400 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            >
              Сбросить
            </button>
          )}
        </div>

        {gifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="text-[13px] text-gray-500 max-w-[220px]">Пока нет подарков в продаже. Загляни позже.</p>
          </div>
        ) : filteredGifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="text-[13px] text-gray-500 max-w-[220px]">Ничего не найдено по этим фильтрам.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredGifts.map((gift) => (
              <button
                key={gift.id}
                onClick={() => {
                  hapticImpact('light');
                  setSelectedGift(gift);
                }}
                className="relative rounded-3xl aspect-[117/198] min-h-[175px] flex flex-col justify-between overflow-hidden transition-transform duration-150 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
                style={{ backgroundColor: gift.backdropColor }}
              >
                <img src={gift.imageUrl} alt={gift.name} className="w-full aspect-square object-contain p-3" />
                <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
                  <div className="text-left">
                    <div className="text-[12px] leading-[14px] font-medium tracking-[-0.02em] text-white truncate">
                      {gift.name}
                    </div>
                    <div className="text-[10px] leading-[12px] text-white/50">#{gift.editionNumber}</div>
                  </div>
                  <span className="h-[34px] px-1.5 rounded-2xl flex items-center justify-center gap-[3px] text-[12px] leading-[14px] font-medium tracking-[-0.02em] bg-[#007AFF] text-white">
                    {gift.priceTon} <GemIcon size={13} color="#fff" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {comingSoonLabel && (
          <div role="status" className="mt-4 text-center text-[11.5px] font-semibold text-gray-400">
            {comingSoonLabel}
          </div>
        )}
      </div>

      {selectedGift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/75"
            onClick={() => setSelectedGift(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-[390px] px-5 pb-7">
            <div
              className="relative rounded-3xl aspect-square flex flex-col items-center justify-center gap-2 overflow-hidden"
              style={{ backgroundColor: selectedGift.backdropColor }}
            >
              <button
                onClick={() => setSelectedGift(null)}
                aria-label="Закрыть"
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <CircleXIcon size={16} color="#fff" />
              </button>
              <img src={selectedGift.imageUrl} alt={selectedGift.name} className="w-[130px] h-[130px] object-contain" />
              <div className="text-center">
                <div className="text-[28px] leading-[31px] font-semibold tracking-[-0.01em] text-white">
                  {selectedGift.name}
                </div>
                <div className="text-[14px] leading-[18px] font-medium tracking-[-0.02em] text-white/60">
                  #{selectedGift.editionNumber}
                </div>
              </div>
            </div>

            <div className="mt-3.5 bg-surface2 border border-white/[0.06] rounded-[18px] overflow-hidden">
              <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
                <span className="text-[12px] leading-[14px] font-medium tracking-[-0.02em] text-gray-500">
                  Модель
                </span>
                <span className="text-[12px] leading-[14px] font-medium tracking-[-0.02em]">{selectedGift.model}</span>
              </div>
              <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
                <span className="text-[12px] leading-[14px] font-medium tracking-[-0.02em] text-gray-500">
                  Фон
                </span>
                <span className="text-[12px] leading-[14px] font-medium tracking-[-0.02em]">
                  {selectedGift.backdropName}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 h-12">
                <span className="text-[12px] leading-[14px] font-medium tracking-[-0.02em] text-gray-500">
                  Символ
                </span>
                <span className="text-[12px] leading-[14px] font-medium tracking-[-0.02em]">{selectedGift.symbol}</span>
              </div>
            </div>

            <p className="mt-2.5 text-center text-[11px] text-gray-600 break-all">Gift ID: {selectedGift.id}</p>

            <button
              onClick={() => showComingSoon('Покупка подарков скоро появится')}
              className="mt-3 w-full h-[58px] rounded-3xl bg-[#34CDEF] text-[#101010] text-[16px] leading-[19px] font-medium tracking-[-0.03em] transition-transform duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            >
              Купить за {selectedGift.priceTon} TON
            </button>
          </div>
        </div>
      )}

      {openFilter && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setOpenFilter(null)} aria-hidden="true" />
          <div className="relative w-full max-w-[390px] max-h-[80vh] flex flex-col bg-[#18191b]/95 backdrop-blur-xl rounded-t-[28px] sm:rounded-[28px] px-5 pt-5 pb-7 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[28px] leading-[31px] font-semibold tracking-[-0.01em]">
                Выбери {openFilter.sheetTitle} подарка
              </h3>
              <button
                onClick={() => setOpenFilter(null)}
                aria-label="Закрыть"
                className="w-9 h-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <CircleXIcon size={16} color="#fff" />
              </button>
            </div>

            <div className="relative mb-3 shrink-0">
              <label htmlFor="market-filter-search" className="sr-only">Поиск</label>
              <SearchIcon
                size={15}
                color="#6b7280"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="market-filter-search"
                type="text"
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                placeholder="Поиск"
                className="w-full h-11 rounded-2xl bg-white/5 pl-10 pr-3 text-[13px] leading-[14px] font-medium tracking-[-0.02em] text-white placeholder:text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
              />
            </div>

            <div className="overflow-y-auto flex flex-col gap-1.5 -mx-1 px-1">
              {optionsByFilter[openFilter.key]
                .filter((value) => value.toLowerCase().includes(filterSearch.trim().toLowerCase()))
                .map((value) => {
                  const isSelected = activeFilters[openFilter.key] === value;
                  const swatch = openFilter.key === 'backdropName' ? backdropColorsByName.get(value) : undefined;
                  return (
                    <button
                      key={value}
                      onClick={() => pickFilterValue(openFilter, value)}
                      className="h-[52px] shrink-0 rounded-2xl bg-white/5 px-3 flex items-center justify-between outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
                    >
                      <span className="flex items-center gap-2.5 text-[12px] leading-[14px] font-medium tracking-[-0.02em] text-white">
                        {swatch && (
                          <span
                            className="w-6 h-6 rounded-full shrink-0"
                            style={{ backgroundColor: swatch }}
                            aria-hidden="true"
                          />
                        )}
                        {value}
                      </span>
                      <span
                        className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                          isSelected ? 'border-deposit-light bg-deposit-light' : 'border-white/25'
                        }`}
                      />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
