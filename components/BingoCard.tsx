
import React from 'react';
import { Card } from '../types';

interface BingoCardProps {
  card: Card;
  markedNumbers: Set<number>;
  winningCells?: number[];
  onToggleMark?: (num: number) => void;
  compact?: boolean;
}

const BingoCard: React.FC<BingoCardProps> = ({ card, markedNumbers, winningCells = [], onToggleMark, compact = false }) => {
  const colConfigs = [
    { label: 'B', color: 'cyan', text: 'text-cyan-400', bg: 'bg-cyan-500', lightBg: 'bg-cyan-500/10', ring: 'ring-cyan-400' },
    { label: 'I', color: 'purple', text: 'text-purple-400', bg: 'bg-purple-500', lightBg: 'bg-purple-500/10', ring: 'ring-purple-400' },
    { label: 'N', color: 'rose', text: 'text-rose-400', bg: 'bg-rose-500', lightBg: 'bg-rose-500/10', ring: 'ring-rose-400' },
    { label: 'G', color: 'emerald', text: 'text-emerald-400', bg: 'bg-emerald-500', lightBg: 'bg-emerald-500/10', ring: 'ring-emerald-400' },
    { label: 'O', color: 'amber', text: 'text-amber-400', bg: 'bg-amber-500', lightBg: 'bg-amber-500/10', ring: 'ring-amber-400' },
  ];

  return (
    <div className={`bg-[#0f172a]/90 rounded-[2.5rem] border-2 border-white/10 p-4 md:p-6 transition-all hover:border-cyan-500/40 shadow-xl ${compact ? 'scale-[0.9] origin-top' : ''}`}>
      <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
        <h3 className="text-white font-bold flex items-center gap-3 font-['Orbitron'] text-xs md:text-sm tracking-[0.2em]">
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
          SYNC SLOT #{card.id}
        </h3>
        <span className="text-[8px] md:text-[9px] bg-white/5 text-cyan-400 px-3 py-1 rounded-full border border-white/10 uppercase tracking-[0.3em] font-bold">Protocol Valid</span>
      </div>

      <div className="grid grid-cols-5 gap-2 md:gap-3 mb-8">
        {colConfigs.map(cfg => (
          <div key={cfg.label} className={`text-center py-2 md:py-4 font-bold ${cfg.text} ${cfg.lightBg} rounded-xl md:rounded-2xl text-xl md:text-3xl font-['Orbitron'] border border-white/5`}>
            {cfg.label}
          </div>
        ))}
        
        {Array.from({ length: 25 }).map((_, i) => {
          const row = Math.floor(i / 5);
          const col = i % 5;
          const numberIndex = col * 5 + row;
          const num = card.numbers[numberIndex];
          const isFree = num === 0;
          const isMarked = isFree || markedNumbers.has(num);
          const isWinning = winningCells.includes(i);

          return (
            <div
              key={i}
              onClick={() => !isFree && onToggleMark?.(num)}
              className={`
                aspect-square flex items-center justify-center rounded-xl md:rounded-2xl text-xl md:text-3xl font-bold cursor-pointer transition-all border-2
                ${isFree ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white text-[10px] border-orange-300 shadow-md' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'}
                ${isMarked && !isFree && !isWinning ? `bg-emerald-500 !text-white border-white/20 shadow-lg scale-[1.05] z-10 rotate-1` : ''}
                ${isWinning ? `!bg-orange-500 !text-white !border-orange-300 z-30 scale-[1.1] animate-pulse shadow-[0_0_25px_rgba(249,115,22,0.6)]` : ''}
              `}
            >
              {isFree ? 'FREE' : num}
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="flex justify-between border-t border-white/5 pt-6 text-[10px] md:text-[11px] text-white/30 font-bold uppercase tracking-[0.3em]">
          <div className="flex flex-col items-center gap-1 md:gap-2">
            <span className="text-white text-xl md:text-4xl font-['Orbitron']">{markedNumbers.size + 1}</span>
            <span>Synced</span>
          </div>
          <div className="flex flex-col items-center gap-1 md:gap-2">
            <span className="text-orange-500 text-xl md:text-4xl font-['Orbitron']">{Math.max(0, 5 - (markedNumbers.size + 1))}</span>
            <span>Required</span>
          </div>
          <div className="flex flex-col items-center gap-1 md:gap-2">
            <span className="text-cyan-400 text-xl md:text-4xl font-['Orbitron']">0</span>
            <span>Sectors</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoCard;
