import { useState } from 'react';
import { createStarsInvoice } from '../api/deposits';
import { GiftIcon, GlossyTonCoin, PencilIcon, StarIcon, TonIcon } from '../icons/Icons';
import { hapticImpact } from '../telegram/haptics';
import { useModalA11y } from '../hooks/useModalA11y';

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 30000, 100000];

// Bigger packages show a denser cluster of coins purely as visual weight — decorative only.
// Each entry is [size, xOffsetPx, yOffsetPx] relative to the card's top-right coin slot.
const COIN_LAYOUTS: [number, number, number][][] = [
  [[40, 0, 0]],
  [[44, 0, 0]],
  [[34, 10, 6], [38, -8, -2]],
  [[30, 14, 14], [34, -4, 2], [36, 10, -10]],
  [[26, 16, 16], [30, 0, 4], [30, 12, -10], [34, -8, -2]],
  [[22, 18, 18], [26, 4, 10], [26, 16, -4], [28, -4, -2], [30, 10, -14], [32, -10, -10]],
];

// Mirrors backend STARS_TO_GRAM_RATE (see telegram-webhook.controller.ts) so the
// credited amount shown here matches what the ledger actually pays out.
const STARS_TO_GRAM_RATE = 1;

type DepositTab = 'stars' | 'ton' | 'gifts';

const TABS: { id: DepositTab; label: string; icon: (active: boolean) => JSX.Element }[] = [
  { id: 'stars', label: 'Stars', icon: (active) => <StarIcon size={13} color={active ? '#fff' : '#5c5966'} /> },
  { id: 'ton', label: 'TON', icon: (active) => <TonIcon size={13} color={active ? '#0098EA' : '#5c5966'} /> },
  { id: 'gifts', label: 'Гифты', icon: (active) => <GiftIcon size={13} color={active ? '#fff' : '#5c5966'} /> },
];

interface DepositModalProps {
  onClose: () => void;
  onDeposited: () => void;
}

export function DepositModal({ onClose, onDeposited }: DepositModalProps) {
  const [tab, setTab] = useState<DepositTab>('stars');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const sheetRef = useModalA11y<HTMLDivElement>(onClose);

  function handleCustomConfirm() {
    const parsed = Math.floor(Number(customValue));
    if (parsed > 0) handlePay(parsed);
  }

  async function handlePay(amount: number) {
    hapticImpact('medium');
    setStatus('creating');
    try {
      const { invoiceLink } = await createStarsInvoice(amount);
      window.Telegram?.WebApp.openInvoice(invoiceLink, (invoiceStatus) => {
        if (invoiceStatus === 'paid') {
          onDeposited();
          onClose();
        } else {
          setStatus('idle');
        }
      });
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-modal-title"
        tabIndex={-1}
        className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-y-auto bg-[#18191b]/90 backdrop-blur-xl rounded-t-[40px] p-5 pb-7 flex flex-col gap-4 shadow-[0_-16px_48px_rgba(0,0,0,0.55)] outline-none"
      >
        <div className="w-[70px] h-1 rounded-full bg-white mx-auto" aria-hidden="true" />
        <h2 id="deposit-modal-title" className="sr-only">
          Пополнить баланс
        </h2>

        <div role="tablist" aria-label="Способ пополнения" className="flex gap-5 border-b border-white/[0.07]">
          {TABS.map(({ id, label, icon }) => {
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
                className={`h-10 flex items-center gap-1.5 text-[16px] font-normal border-b-2 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light ${
                  active ? 'border-white text-white' : 'border-transparent text-white/50'
                }`}
              >
                {icon(active)}
                {label}
              </button>
            );
          })}
        </div>

        {tab === 'stars' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-[28px] leading-[31px] font-semibold tracking-tight">Выбери набор</h3>
              {status === 'creating' && <span className="text-xs font-semibold text-gray-400">Открываем оплату…</span>}
            </div>

            {status === 'error' && (
              <p role="alert" className="text-danger text-sm">
                Не удалось создать счёт, попробуйте ещё раз
              </p>
            )}

            {!customMode ? (
              <div role="group" aria-label="Сумма пополнения" className="grid grid-cols-2 gap-2.5">
                {QUICK_AMOUNTS.map((value, i) => (
                  <button
                    key={value}
                    onClick={() => handlePay(value)}
                    disabled={status === 'creating'}
                    aria-label={`Купить набор за ${value} Stars`}
                    className="relative h-[90px] rounded-3xl p-3.5 overflow-hidden text-left bg-white/5 bg-card-glass transition-all duration-150 active:scale-[0.96] disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
                  >
                    <div className="absolute right-0 top-0 w-[90px] h-[90px]">
                      {(COIN_LAYOUTS[i] ?? COIN_LAYOUTS[0]).map(([coinSize, dx, dy], coinIndex) => (
                        <GlossyTonCoin
                          key={coinIndex}
                          size={coinSize}
                          className="absolute drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
                          style={{
                            right: 8 - dx,
                            top: 45 - coinSize / 2 + dy,
                          }}
                        />
                      ))}
                    </div>
                    <span className="absolute left-3.5 top-3 text-[16px] font-medium text-white tabular-nums">
                      {(value * STARS_TO_GRAM_RATE).toFixed(2)}
                    </span>
                    <span className="absolute left-3.5 bottom-3 inline-flex items-center gap-1 rounded-full bg-[#FFC502]/10 text-[#FFC502] text-[16px] font-normal px-2 py-1">
                      <StarIcon size={14} />
                      {value}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  autoFocus
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Сколько Stars?"
                  aria-label="Своя сумма в Stars"
                  className="h-14 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[17px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
                />
                <button
                  onClick={handleCustomConfirm}
                  disabled={status === 'creating'}
                  className="h-[58px] rounded-3xl bg-white text-[#101010] font-medium text-[16px] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
                >
                  Оплатить
                </button>
              </div>
            )}

            <button
              onClick={() => {
                hapticImpact('light');
                setCustomMode((v) => !v);
              }}
              className="h-[58px] rounded-3xl bg-white text-[#101010] font-medium text-[16px] flex items-center justify-center gap-1.5 transition-transform duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            >
              {customMode ? (
                'Готовые наборы'
              ) : (
                <>
                  Своя <PencilIcon size={15} color="#101010" /> сумма
                </>
              )}
            </button>
          </>
        )}

        {tab !== 'stars' && (
          <div className="py-8 flex flex-col items-center gap-2.5 text-center">
            {tab === 'ton' ? <TonIcon size={30} color="#0098EA" /> : <GiftIcon size={30} color="#5c5966" />}
            <p className="text-sm font-bold text-gray-300">
              {tab === 'ton' ? 'Пополнение через TON скоро появится' : 'Отправка гифтов скоро появится'}
            </p>
            <p className="text-xs text-gray-500 max-w-[260px]">Пока доступно только пополнение через Telegram Stars</p>
          </div>
        )}
      </div>
    </div>
  );
}
