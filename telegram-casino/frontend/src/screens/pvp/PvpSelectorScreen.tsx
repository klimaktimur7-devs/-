export type PvpGame = 'ice' | 'race';

interface PvpSelectorScreenProps {
  onSelectGame: (game: PvpGame) => void;
}

const GAMES: {
  id: PvpGame;
  title: string;
  description: string;
  gradient: string;
}[] = [
  {
    id: 'ice',
    title: 'Ice Arena',
    description: 'Ледяная битва за гифты, TON и Stars',
    gradient: 'linear-gradient(135deg, #1E3A8A 0%, #0008ED 55%, #16A34A 130%)',
  },
  {
    id: 'race',
    title: 'Ball Race',
    description: 'Классическая гонка шаров',
    gradient: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 55%, #C026D3 130%)',
  },
];

export function PvpSelectorScreen({ onSelectGame }: PvpSelectorScreenProps) {
  return (
    <div className="min-h-full bg-bg text-white">
      <h2 className="text-[38px] font-medium tracking-tight px-[26px] pt-5">PvP</h2>
      <div className="flex flex-col gap-4 px-[18px] pt-4">
        {GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className="relative w-full aspect-[1.73] rounded-3xl overflow-hidden ring ring-inset ring-white/[0.13] shadow-[0_0_7.2px_4px_rgba(255,255,255,0.12)_inset] text-left transition-transform duration-150 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-deposit-light"
            style={{ background: game.gradient }}
          >
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="text-[19px] font-bold">{game.title}</div>
              <div className="text-[12.5px] text-white/70 mt-0.5">{game.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
