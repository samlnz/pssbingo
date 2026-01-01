
import React from 'react';
import { cardGenerator } from '../services/cardGenerator';
import BingoCard from '../components/BingoCard';

interface SelectionPageProps {
  playerName: string;
  playerId: string;
  selectedCards: number[];
  onToggleCard: (id: number) => void;
  onRandomAssign: () => void;
  onClearSelection: () => void;
  globalTime: number;
  roundEndTime: number;
  roundId: number;
}

const SelectionPage: React.FC<SelectionPageProps> = ({ 
  playerName, 
  playerId, 
  selectedCards, 
  onToggleCard, 
  onRandomAssign, 
  onClearSelection, 
  globalTime, 
  roundEndTime, 
  roundId 
}) => {
  const timeLeft = Math.max(0, roundEndTime - globalTime);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden p-2 md:p-4">
      {/* Global Background Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-blue-400/10 to-cyan-300/20 pointer-events-none"></div>
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-gradient-to-r from-transparent via-cyan-100/20 to-transparent -skew-x-12 animate-shimmer"></div>
      
      <div className="max-w-[1900px] mx-auto space-y-3 relative z-10">
        <div className="bg-black/60 backdrop-blur-xl rounded-xl p-3 border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-lg font-bold">
              {playerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-white text-base font-bold font-['Orbitron'] leading-tight">{playerName}</h2>
              <p className="text-white/40 text-[9px]">ROUND: {roundId} | ID: {playerId}</p>
            </div>
          </div>

          <div className={`px-12 py-1.5 rounded-lg border-2 transition-all duration-300 ${timeLeft <= 10 ? 'border-red-500 bg-red-500/10 animate-pulse' : 'border-cyan-500/50 bg-cyan-500/5'}`}>
            <p className="text-[9px] uppercase tracking-widest text-white/40 text-center font-bold">SELECTION WINDOW CLOSES IN</p>
            <p className={`text-xl font-bold font-['Orbitron'] text-center ${timeLeft <= 10 ? 'text-red-500' : 'text-cyan-400'}`}>
              {formatTime(timeLeft)}
            </p>
          </div>

          <div className="flex gap-2">
            <div className="bg-white/5 px-6 py-2 rounded-lg border border-white/10 text-center min-w-[100px]">
              <p className="text-xl font-bold text-orange-500 font-['Orbitron']">{selectedCards.length}/2</p>
              <p className="text-[9px] uppercase text-white/40 font-bold tracking-tighter">CARDS TAGGED</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-3">
          {/* Main Card Pool Container */}
          <div className="lg:col-span-6 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/20 flex flex-col shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[12px] font-['Orbitron'] font-bold text-white flex items-center gap-3 uppercase tracking-[0.25em]">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                Protocol Pool #{roundId}
              </h2>
              <div className="text-[9px] text-cyan-400/60 uppercase font-bold tracking-widest italic">
                Commitment Protocol Active — Auto-Sync in {formatTime(timeLeft)}
              </div>
            </div>
            
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-8 xl:grid-cols-10 gap-2 overflow-y-auto max-h-[78vh] pr-2 custom-scrollbar">
              {Array.from({ length: 500 }).map((_, i) => {
                const num = i + 1;
                const isSelected = selectedCards.includes(num);
                return (
                  <button
                    key={num}
                    onClick={() => onToggleCard(num)}
                    className={`
                      aspect-square flex items-center justify-center font-bold text-3xl md:text-4xl transition-all relative border rounded-xl
                      ${isSelected 
                        ? 'bg-orange-500 border-white text-white shadow-[0_0_25px_rgba(249,115,22,1)] z-20 scale-105' 
                        : 'bg-black/40 border-white/10 text-white hover:bg-white/10 hover:border-orange-500/50'}
                    `}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="bg-black/40 backdrop-blur-md p-5 rounded-3xl border border-white/5 flex-grow">
              <h2 className="text-xs font-['Orbitron'] font-bold text-white/60 mb-4 uppercase tracking-wider flex justify-between items-center">
                <span>Verification Preview</span>
                <span className="bg-orange-500/20 text-orange-400 px-3 py-0.5 rounded-full text-[10px]">{selectedCards.length} / 2 Selected</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                {selectedCards.length === 0 ? (
                  <div className="col-span-full h-64 flex flex-col items-center justify-center text-white/10 border-2 border-dashed border-white/5 rounded-3xl text-center p-8">
                    <div className="text-4xl mb-4 opacity-20"><i className="fas fa-eye"></i></div>
                    <p className="text-base font-medium">No Cards Selected</p>
                    <p className="text-xs mt-2 opacity-50 tracking-tighter">Enter Round #{roundId} in Observer Mode if you do not select a card before the window closes.</p>
                  </div>
                ) : (
                  selectedCards.map((num) => (
                    <div key={num} className="bg-black/40 p-3 rounded-2xl border border-orange-500/20">
                       <BingoCard card={cardGenerator.generateCard(num)} markedNumbers={new Set()} compact />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onRandomAssign}
                className="py-5 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold hover:bg-orange-500/40 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-lg"
              >
                <i className="fas fa-random text-lg"></i> Random Assign
              </button>
              
              <button 
                onClick={onClearSelection}
                className="py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest text-sm"
              >
                Clear Choices
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectionPage;
