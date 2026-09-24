import { useState } from 'react';
import { acceptConsent } from '../api/me';
import { GemIcon } from '../icons/Icons';
import { hapticImpact } from '../telegram/haptics';

export const CONSENT_VERSION = 'v1';

interface ConsentGateProps {
  onAccepted: () => void;
}

export function ConsentGate({ onAccepted }: ConsentGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    hapticImpact('light');
    setSubmitting(true);
    setError(null);
    try {
      await acceptConsent(CONSENT_VERSION);
      onAccepted();
    } catch {
      setError('Не удалось сохранить согласие, попробуйте ещё раз');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-bg text-white overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.30), rgba(14,165,233,0) 72%)' }}
      />
      <GemIcon
        size={16}
        color="#38BDF8"
        className="absolute top-28 left-11 opacity-20"
      />
      <GemIcon
        size={12}
        color="#38BDF8"
        className="absolute bottom-40 right-12 opacity-15"
      />

      <div className="relative flex flex-col items-center justify-center min-h-screen px-8 gap-6 text-center">
        <div className="w-[88px] h-[88px] rounded-3xl bg-deposit-gradient flex items-center justify-center shadow-[0_16px_40px_rgba(14,165,233,0.5)]">
          <span className="text-3xl font-extrabold tracking-tight text-[#062B45]">18+</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Платформа для лиц 18+</h1>
        <p className="text-sm leading-relaxed text-gray-400 max-w-[280px]">
          Продолжая, вы подтверждаете, что вам есть 18 лет и вы согласны с правилами платформы.
        </p>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <button
          onClick={handleAccept}
          disabled={submitting}
          aria-busy={submitting}
          className="w-full max-w-[300px] h-14 rounded-2xl bg-deposit-gradient text-[#062B45] font-bold text-base shadow-[0_8px_24px_rgba(14,165,233,0.45)] disabled:opacity-50 mt-2 transition-transform duration-150 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {submitting ? 'Сохранение…' : 'Мне есть 18, принимаю правила'}
        </button>
        <span className="text-xs text-gray-500">Правила платформы · {CONSENT_VERSION}</span>
      </div>
    </div>
  );
}
