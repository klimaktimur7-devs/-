import { ReactNode } from 'react';

interface ComingSoonScreenProps {
  title: string;
  icon: ReactNode;
}

export function ComingSoonScreen({ title, icon }: ComingSoonScreenProps) {
  return (
    <div className="relative min-h-full bg-bg text-white overflow-hidden">
      <div
        className="pointer-events-none absolute top-[140px] left-1/2 -translate-x-1/2 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.26), rgba(14,165,233,0) 72%)' }}
      />
      <div className="relative flex flex-col items-center justify-center min-h-full gap-4 py-16">
        <div className="w-[84px] h-[84px] rounded-full bg-gradient-to-br from-[#1a2c38] to-[#13202b] border border-deposit-light/30 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        <p className="text-[13px] text-gray-500">Раздел появится следующим</p>
      </div>
    </div>
  );
}
