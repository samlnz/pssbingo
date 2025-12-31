
import React, { useState, useEffect, useMemo } from 'react';
import { PlayerWinData, SYNC_CONFIG } from '../types';
import { cardGenerator } from '../services/cardGenerator';
import BingoCard from '../components/BingoCard';

interface GamePageProps {
  selectedCards: number[];
  playerName: string;
  playerId: string;
  onWin: (data: PlayerWinData) => void;
  globalTime: number;
  roundStartTime: number;
  roundId: number;
  activeParticipantCount: number;
}

const COLUMN_CONFIG = {
  'B': { text: 'text-white', bg: 'bg-cyan-600', shadow: 'shadow-cyan-500/40', border: 'border-cyan-500/20' },
  'I': { text: 'text-white', bg: 'bg-purple-600', shadow: 'shadow-purple-500/40', border: 'border-purple-500/20' },
  'N': { text: 'text-white', bg: 'bg-rose-600', shadow: 'shadow-rose-500/40', border: 'border-rose-500/20' },
  'G': { text: 'text-white', bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/40', border: 'border-emerald-500/20' },
  'O': { text: 'text-white', bg: 'bg-amber-600', shadow: 'shadow-amber-500/40', border: 'border-amber-500/20' }
};

const BET_AMOUNT = 10;

const GamePage: React.FC<GamePageProps> = ({ selectedCards, playerName, playerId, globalTime, roundStartTime, roundId, activeParticipantCount }) => {
  const [trackedCards, setTrackedCards] = useState<number[]>([]);
  const effectiveCards = selectedCards.length > 0 ? selectedCards : trackedCards;
  const isSpectator = selectedCards.length === 0;
  const isTracking = trackedCards.length > 0;
  
  const [marked, setMarked] = useState<{ [key: number]: Set<number> }>({});
  const [autoMark, setAutoMark] = useState(true);

  const timeInGame = Math.max(0, globalTime - roundStartTime);
  const prizePool = Math.floor(activeParticipantCount * BET_AMOUNT * 0.85);

  const globalCallSequence = useMemo(() => {
    const sequence: number[] = [];
    const available = Array.from({ length: 75 }, (_, i) => i + 1);
    let seed = roundId * 987654;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    while (available.length > 0) {
      sequence.push(available.splice(Math.floor(rng() * available.length), 1)[0]);
    }
    return sequence;
  }, [roundId]);

  const currentBallIndex = Math.floor(timeInGame / SYNC_CONFIG.CALL_INTERVAL);
  const calledNumbers = useMemo(() => globalCallSequence.slice(0, currentBallIndex + 1), [globalCallSequence, currentBallIndex]);
  const currentNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;
  const recentNumbers = useMemo(() => calledNumbers.slice(-6).reverse(), [calledNumbers]);

  const networkNodes = useMemo(() => {
    let botSeed = roundId * 12345;
    const botRng = () => {
      botSeed = (botSeed * 9301 + 49297) % 233280;
      return botSeed / 233280;
    };
    const nodes = [];
    for(let i=0; i<12; i++) {
      nodes.push({
        id: Math.floor(botRng() * 500) + 1,
        latency: Math.floor(botRng() * 100) + 20,
        status: botRng() > 0.1 ? 'active' : 'idle'
      });
    }
    return nodes;
  }, [roundId]);

  useEffect(() => {
    if (autoMark && calledNumbers.length > 0) {
      const latest = calledNumbers[calledNumbers.length - 1];
      effectiveCards.forEach(cid => {
        if (cardGenerator.generateCard(cid).numbers.includes(latest)) {
          setMarked(prev => {
            if (prev[cid]?.has(latest)) return prev;
            const next = new Set(prev[cid] || []);
            next.add(latest);
            return { ...prev, [cid]: next };
          });
        }
      });
    }
  }, [calledNumbers, autoMark, effectiveCards]);

  const getLetter = (n: number) => n <= 15 ? 'B' : n <= 30 ? 'I' : n <= 45 ? 'N' : n <= 60 ? 'G' : 'O';

  return (
    <div className="min-h-screen bg-[#050b1a] p-4 md:p-8 font-['Rajdhani'] transition-colors duration-1000">
      <div className="max-w-[1900px] mx-auto space-y-8">
        {/* Header Console */}
        <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-[3rem] p-8 flex flex-wrap justify-between items-center gap-8 shadow-2xl shadow-cyan-500/10 relative overflow-hidden">
          <div className="flex items-center gap-8 relative z-10">
            <div>
              <p className="text-cyan-400/60 text-[10px] font-bold uppercase tracking-[0.6em] mb-2">Network Protocol</p>
              <h2 className="text-5xl font-bold font-['Orbitron'] text-white">ROUND <span className="text-cyan-500">#{roundId}</span></h2>
              <div className="mt-2 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold">{activeParticipantCount} Active Nodes</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 z-10">
             <div className="bg-white/5 px-10 py-5 rounded-3xl border border-white/10 min-w-[200px]">
              <p className="text-[10px] text-white/30 uppercase font-bold tracking-[0.3em] mb-2">Next Call</p>
              <p className="text-xl font-bold text-white font-['Orbitron']">{SYNC_CONFIG.CALL_INTERVAL - (timeInGame % SYNC_CONFIG.CALL_INTERVAL)}s</p>
            </div>
            <div className="bg-white/5 px-10 py-5 rounded-3xl border border-white/10 min-w-[220px]">
              <p className="text-[10px] text-white/30 uppercase font-bold tracking-[0.3em] mb-2">Prize Pool</p>
              <p className="text-2xl font-bold text-emerald-400 font-['Orbitron']">{prizePool.toLocaleString()} Birr</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          {/* Global Ledger (Left) */}
          <div className="lg:col-span-4 bg-[#0f172a]/60 border border-white/10 rounded-[3.5rem] p-8 shadow-2xl backdrop-blur-3xl self-start">
            <h3 className="text-[11px] font-bold text-cyan-400 uppercase tracking-[0.5em] flex items-center gap-3 mb-6 px-1">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span> Global Ledger Protocol
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {(['B', 'I', 'N', 'G', 'O'] as const).map(letter => (
                <div key={letter} className="flex flex-col gap-3">
                  <div className={`text-center font-bold text-7xl py-6 rounded-2xl border-none ${COLUMN_CONFIG[letter].bg} text-white font-['Orbitron'] shadow-lg`}>
                    {letter}
                  </div>
                  {Array.from({ length: 15 }).map((_, i) => {
                    const n = (letter === 'B' ? 1 : letter === 'I' ? 16 : letter === 'N' ? 31 : letter === 'G' ? 46 : 61) + i;
                    const isCalled = calledNumbers.includes(n);
                    const isCurrent = n === currentNumber;
                    
                    return (
                      <div 
                        key={n} 
                        className={`
                          aspect-square flex items-center justify-center rounded-xl text-3xl md:text-5xl font-bold border transition-all duration-500
                          ${isCurrent 
                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] z-20 scale-105' 
                            : isCalled 
                              ? 'bg-orange-500 text-white border-orange-400 shadow-md' 
                              : `bg-white/10 text-white border-white/10 shadow-inner opacity-100 font-bold`}
                        `}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Right Section: Current Number Grid (Top) + Player Deck (Bottom) */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            {/* Current Number Grid (Horizontal Display) */}
            <div className="bg-[#0f172a]/90 border-2 border-cyan-500/50 rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <i className="fas fa-microchip text-9xl"></i>
              </div>
              
              <div className="flex flex-col items-center">
                <p className="text-[10px] text-cyan-400 uppercase font-bold tracking-[0.4em] mb-4">Live Ball</p>
                <div className={`w-40 h-40 md:w-56 md:h-56 rounded-[3rem] bg-black border-4 flex flex-col items-center justify-center transition-all relative ${currentNumber ? 'border-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.4)] animate-pulse' : 'border-white/10'}`}>
                  <span className={`text-7xl md:text-9xl font-bold font-['Orbitron'] ${currentNumber ? 'text-white' : 'text-white/10'}`}>
                    {currentNumber || '--'}
                  </span>
                  {currentNumber && (
                    <div className={`absolute -bottom-3 px-8 py-1.5 rounded-full font-bold text-lg tracking-widest text-white shadow-xl ${COLUMN_CONFIG[getLetter(currentNumber) as keyof typeof COLUMN_CONFIG].bg}`}>
                      {getLetter(currentNumber)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-grow w-full space-y-6">
                <div className="flex justify-between items-center px-2">
                  <p className="text-[10px] text-white/30 uppercase font-bold tracking-[0.3em]">Recent Sequence</p>
                  <div className="flex gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Streaming</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-4">
                  {recentNumbers.slice(1, 6).map((num, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 py-5 rounded-3xl flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition-colors">
                      <span className={`text-xs font-bold font-['Orbitron'] ${COLUMN_CONFIG[getLetter(num) as keyof typeof COLUMN_CONFIG].text}`}>{getLetter(num)}</span>
                      <span className="text-3xl font-bold text-white/60">{num}</span>
                    </div>
                  ))}
                  {recentNumbers.length < 6 && Array.from({ length: 6 - recentNumbers.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white/2 border border-dashed border-white/5 py-5 rounded-3xl flex items-center justify-center">
                       <span className="text-white/10 text-xl font-bold">--</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Player/Spectator Deck Grid */}
            <div className={`min-h-[500px] transition-all duration-500 rounded-[3rem] ${isSpectator && !isTracking ? 'bg-white/5 border-2 border-dashed border-white/10' : ''}`}>
              {isSpectator && !isTracking ? (
                <div className="h-full w-full flex flex-col lg:flex-row items-center justify-center p-8 gap-12 animate-fade-in">
                  <div className="text-center space-y-6 max-w-sm">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full"></div>
                      <i className="fas fa-satellite-dish text-8xl text-cyan-400/40 relative z-10 animate-pulse"></i>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-4xl font-bold font-['Orbitron'] text-white">Observer Mode</h3>
                      <p className="text-white/40 uppercase tracking-widest text-[10px] font-bold leading-relaxed">
                        Round #{roundId} is live. Follow any card from the network pool to track its progress.
                      </p>
                    </div>
                  </div>
                  
                  {/* Observer "Track Card" Grid */}
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 max-w-md w-full">
                    <h4 className="text-[10px] text-cyan-400 uppercase font-bold tracking-[0.4em] mb-4 text-center">Track a Card</h4>
                    <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {Array.from({ length: 500 }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setTrackedCards([i + 1])}
                          className="aspect-square bg-white/5 border border-white/10 rounded-lg text-sm font-bold hover:bg-cyan-500/20 hover:border-cyan-500 transition-all"
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in overflow-y-auto max-h-[100vh] custom-scrollbar pr-4">
                   {isTracking && isSpectator && (
                    <div className="col-span-full flex justify-between items-center bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-2xl mb-2">
                      <p className="text-cyan-400 font-bold text-xs uppercase tracking-widest flex items-center gap-3">
                        <i className="fas fa-search"></i> Tracking Protocol: Card #{trackedCards[0]}
                      </p>
                      <button onClick={() => setTrackedCards([])} className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-tighter">Discard Tracker</button>
                    </div>
                  )}
                  {effectiveCards.map(cid => (
                    <BingoCard 
                      key={cid} 
                      card={cardGenerator.generateCard(cid)} 
                      markedNumbers={marked[cid] || new Set()} 
                      onToggleMark={(num) => {
                        if (!autoMark) {
                          setMarked(prev => {
                            const next = new Set(prev[cid] || []);
                            if (next.has(num)) next.delete(num);
                            else if (calledNumbers.includes(num)) next.add(num);
                            return { ...prev, [cid]: next };
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Network Status Feed */}
            <div className="bg-[#0f172a]/60 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                 <h4 className="text-[10px] text-cyan-400 uppercase font-bold tracking-[0.4em] flex items-center gap-3">
                   <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Network Topology
                 </h4>
                 {effectiveCards.length > 0 && (
                   <button 
                     onClick={() => setAutoMark(!autoMark)}
                     className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${autoMark ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-red-500/20 border-red-500 text-red-400'}`}
                   >
                     {autoMark ? 'System Auto-Sync: ON' : 'Manual Triage Mode'}
                   </button>
                 )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {networkNodes.map((node, i) => (
                  <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-1 hover:border-white/20 transition-colors cursor-help">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-white/30 tracking-tighter">NODE-{node.id}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'active' ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
                    </div>
                    <span className="text-[10px] text-cyan-400 font-bold font-['Orbitron']">{node.latency}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
