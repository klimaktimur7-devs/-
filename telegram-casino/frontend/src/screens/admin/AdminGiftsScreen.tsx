import { useEffect, useState } from 'react';
import { CircleXIcon, PlusIcon } from '../../icons/Icons';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { hapticImpact } from '../../telegram/haptics';
import { ApiError } from '../../api/client';
import { MarketGift } from '../market/MarketScreen';
import {
  GiftPreview,
  fetchAdminGifts,
  resolveGiftLink,
  createGift,
  deleteGift,
} from '../../api/adminGifts';

interface AdminGiftsScreenProps {
  onGiftsChanged: () => void;
}

export function AdminGiftsScreen({ onGiftsChanged }: AdminGiftsScreenProps) {
  const [gifts, setGifts] = useState<MarketGift[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [price, setPrice] = useState('');
  const [resolving, setResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketGift | null>(null);

  useEffect(() => {
    void loadGifts();
  }, []);

  async function loadGifts() {
    setGifts(await fetchAdminGifts());
  }

  async function handleFind() {
    setErrorMessage(null);
    setResolving(true);
    try {
      setPreview(await resolveGiftLink(link));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 503 || error.status === 504)) {
        setErrorMessage('Сервис поиска подарков временно недоступен');
      } else {
        setErrorMessage('Не нашёл подарок по этой ссылке');
      }
    } finally {
      setResolving(false);
    }
  }

  async function handleSave() {
    if (!preview || !price || Number(price) <= 0) return;
    hapticImpact('light');
    try {
      await createGift({ ...preview, priceTon: Number(price) });
      setAddOpen(false);
      setLink('');
      setPreview(null);
      setPrice('');
      setErrorMessage(null);
      await loadGifts();
      onGiftsChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage('Этот подарок уже есть в магазине');
      } else {
        setErrorMessage('Не удалось сохранить подарок');
      }
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    hapticImpact('light');
    await deleteGift(deleteTarget.id);
    setDeleteTarget(null);
    await loadGifts();
    onGiftsChanged();
  }

  return (
    <div className="min-h-full bg-bg text-white">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h2 className="text-[28px] leading-[31px] font-medium tracking-tight">Admin · Gifts</h2>
        <button
          onClick={() => {
            hapticImpact('light');
            setAddOpen(true);
          }}
          aria-label="Добавить подарок"
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-150 active:scale-90"
        >
          <PlusIcon size={16} color="#fff" />
        </button>
      </div>

      <div className="px-5 flex flex-col gap-2.5">
        {gifts.map((gift) => (
          <div
            key={gift.id}
            className="h-16 rounded-2xl bg-white/5 px-4 flex items-center justify-between"
          >
            <div>
              <div className="text-[14px] font-bold">{gift.name}</div>
              <div className="text-[12px] text-white/50">
                #{gift.editionNumber} · <AnimatedNumber value={gift.priceTon} /> TON
              </div>
            </div>
            <button
              onClick={() => setDeleteTarget(gift)}
              aria-label={`Удалить ${gift.name}`}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <CircleXIcon size={16} color="#F87171" />
            </button>
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setAddOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-[390px] bg-[#18191b]/95 backdrop-blur-xl rounded-t-[28px] px-5 pt-5 pb-7">
            <h3 className="text-[20px] font-semibold mb-3">Добавить подарок</h3>

            <input
              type="text"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="t.me/nft/..."
              className="w-full h-11 rounded-2xl bg-white/5 px-3 text-[14px] text-white placeholder:text-gray-500 outline-none mb-2"
            />
            <button
              onClick={handleFind}
              disabled={resolving || !link}
              className="w-full h-11 rounded-2xl bg-white/10 text-[14px] font-bold disabled:opacity-40 mb-3"
            >
              {resolving ? 'Ищу…' : 'Найти'}
            </button>

            {errorMessage && (
              <p role="alert" className="text-[12px] text-danger mb-3">
                {errorMessage}
              </p>
            )}

            {preview && (
              <div className="flex flex-col gap-2 mb-3">
                <label className="text-[12px] text-gray-500">
                  Модель
                  <input
                    value={preview.model}
                    onChange={(event) => setPreview({ ...preview, model: event.target.value })}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <label className="text-[12px] text-gray-500">
                  Фон
                  <input
                    value={preview.backdropName}
                    onChange={(event) => setPreview({ ...preview, backdropName: event.target.value })}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <label className="text-[12px] text-gray-500">
                  Символ
                  <input
                    value={preview.symbol}
                    onChange={(event) => setPreview({ ...preview, symbol: event.target.value })}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <label className="text-[12px] text-gray-500">
                  Цена (TON)
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="w-full h-10 rounded-xl bg-white/5 px-3 text-[13px] text-white mt-1"
                  />
                </label>
                <button
                  onClick={handleSave}
                  disabled={!price || Number(price) <= 0}
                  className="w-full h-12 rounded-2xl bg-[#0077FF] font-bold disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setDeleteTarget(null)} aria-hidden="true" />
          <div className="relative w-[300px] bg-[#18191b] rounded-3xl p-5 text-center">
            <p className="text-[14px] mb-4">Удалить «{deleteTarget.name}»?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-xl bg-white/10 text-[13px] font-bold"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 h-11 rounded-xl bg-danger text-[13px] font-bold"
              >
                Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
