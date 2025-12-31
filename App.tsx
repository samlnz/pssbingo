
import React, { useState, useEffect, useMemo } from 'react';
import { GamePhase, PlayerWinData, SYNC_CONFIG } from './types';
import LobbyPage from './pages/LobbyPage';
import SelectionPage from './pages/SelectionPage';
import GamePage from './pages/GamePage';
import WinnerPage from './pages/WinnerPage';
import AdminPage from './pages/AdminPage';
import { cardGenerator } from './services/cardGenerator';

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [playerName, setPlayerName] = useState('SyncPlayer');
  const [playerId, setPlayerId] = useState('0000');
  const [globalTime, setGlobalTime] = useState(Math.floor(Date.now() / 1000));
  const [activeRoundId, setActiveRoundId] = useState<number | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    setPlayerId(randomId);
    setPlayerName(`User-${randomId}`);
    
    if ((window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setPlayerName(user.first_name + (user.last_name ? ` ${user.last_name}` : ''));
        setPlayerId(user.id.toString());
      }
    }

    const ticker = setInterval(() => {
      setGlobalTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  const roundInfo = useMemo(() => {
    const patterns = [
      // Horizontal
      [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
      // Vertical
      [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
      // Diagonal
      [0,6,12,18,24], [4,8,12,16,20],
      // Corners
      [0,4,20,24]
    ];

    let currentTime = Math.max(SYNC_CONFIG.GENESIS_EPOCH, Math.floor(globalTime / 3600) * 3600 - 3600);
    let roundId = Math.floor((currentTime - SYNC_CONFIG.GENESIS_EPOCH) / 300);

    while (true) {
      const sequence: number[] = [];
      const available = Array.from({ length: 75 }, (_, i) => i + 1);
      let seed = roundId * 987654;
      const rng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const tempAvailable = [...available];
      while (tempAvailable.length > 0) {
        sequence.push(tempAvailable.splice(Math.floor(rng() * tempAvailable.length), 1)[0]);
      }

      const participantIds = new Set<number>();
      
      // Include current user cards if they are in this round
      if (activeRoundId === roundId) {
        selectedCards.forEach(id => participantIds.add(id));
      }

      let botSeed = roundId * 12345;
      const botRng = () => {
        botSeed = (botSeed * 9301 + 49297) % 233280;
        return botSeed / 233280;
      };
      
      const MIN_COMPETITORS = 25;
      while (participantIds.size < MIN_COMPETITORS) {
        participantIds.add(Math.floor(botRng() * 500) + 1);
      }

      const ballMap = new Map();
      sequence.forEach((num, idx) => ballMap.set(num, idx));

      let earliestBallIndex = 75;
      let winnerCardId = -1;

      participantIds.forEach((cid) => {
        const card = cardGenerator.generateCard(cid);
        patterns.forEach((p) => {
          let maxIdx = 0;
          let possible = true;
          for (const cellIdx of p) {
            const num = card.numbers[cellIdx];
            if (num === 0) continue;
            const bIdx = ballMap.get(num);
            if (bIdx === undefined) { possible = false; break; }
            maxIdx = Math.max(maxIdx, bIdx);
          }
          if (possible && maxIdx < earliestBallIndex) {
            earliestBallIndex = maxIdx;
            winnerCardId = cid;
          }
        });
      });

      let winnerLines: string[] = [];
      let winnerCells: number[] = [];
      if (winnerCardId !== -1) {
        const card = cardGenerator.generateCard(winnerCardId);
        const combinedCells = new Set<number>();
        patterns.forEach((p, idx) => {
          let possible = true;
          for (const cellIdx of p) {
            const num = card.numbers[cellIdx];
            if (num === 0) continue;
            const bIdx = ballMap.get(num);
            if (bIdx === undefined || bIdx > earliestBallIndex) { possible = false; break; }
          }
          if (possible) {
            winnerLines.push(`Pattern ${idx + 1}`);
            p.forEach(cellIdx => combinedCells.add(cellIdx));
          }
        });
        winnerCells = Array.from(combinedCells);
      }

      const selectionEnd = currentTime + SYNC_CONFIG.SELECTION_DURATION;
      const playDuration = earliestBallIndex * SYNC_CONFIG.CALL_INTERVAL;
      const playEnd = selectionEnd + playDuration;
      const winnerEnd = playEnd + SYNC_CONFIG.WINNER_ANNOUNCEMENT_DURATION;

      if (globalTime < winnerEnd) {
        let phase = GamePhase.SELECTION;
        if (globalTime >= playEnd) phase = GamePhase.WINNER;
        else if (globalTime >= selectionEnd) phase = GamePhase.PLAYING;

        return {
          roundId,
          phase,
          startTime: currentTime,
          selectionEnd,
          playEnd,
          winnerEnd,
          activeParticipantCount: participantIds.size,
          winnerInfo: {
            ballIndex: earliestBallIndex,
            cardId: winnerCardId,
            lines: winnerLines,
            cells: winnerCells,
            sequence
          }
        };
      }
      
      currentTime = winnerEnd;
      roundId++;
    }
  }, [globalTime, selectedCards, activeRoundId]);

  // Handle round resets and automatic card preservation
  useEffect(() => {
    if (activeRoundId !== roundInfo.roundId) {
      setSelectedCards([]);
      setActiveRoundId(roundInfo.roundId);
    }
  }, [roundInfo.roundId, activeRoundId]);

  const winnerData = useMemo<PlayerWinData | null>(() => {
    if (roundInfo.phase !== GamePhase.WINNER) return null;

    const winInfo = roundInfo.winnerInfo;
    const winnerCard = cardGenerator.generateCard(winInfo.cardId);
    const isLocal = selectedCards.includes(winInfo.cardId);

    return {
      playerName: isLocal ? playerName : `Participant-${winInfo.cardId}`,
      playerId: isLocal ? playerId : `UID-${winInfo.cardId}`,
      cardNumbers: isLocal ? selectedCards : [winInfo.cardId],
      winningLines: { card1: winInfo.lines, card2: [] },
      totalLines: winInfo.lines.length,
      gameTime: roundInfo.playEnd - roundInfo.selectionEnd,
      calledNumbersCount: winInfo.ballIndex + 1,
      cardData: {
        card1: {
          numbers: winnerCard.numbers,
          markedNumbers: winInfo.sequence.slice(0, winInfo.ballIndex + 1),
          winningCells: winInfo.cells,
          winningLines: winInfo.lines
        },
        card2: { numbers: [], markedNumbers: [], winningCells: [], winningLines: [] }
      }
    };
  }, [roundInfo, selectedCards, playerName, playerId]);

  const handleToggleCard = (cardId: number) => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      if (prev.length < 2) return [...prev, cardId];
      return prev;
    });
  };

  const handleClearSelection = () => setSelectedCards([]);

  const handleRandomAssign = () => {
    const s: number[] = [];
    while(s.length < 2) {
      const r = Math.floor(Math.random() * 500) + 1;
      if(!s.includes(r)) s.push(r);
    }
    setSelectedCards(s);
  };

  if (!hasEntered) {
    return <LobbyPage onStart={() => setHasEntered(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] overflow-x-hidden selection:bg-cyan-500/30 font-['Rajdhani'] transition-colors duration-1000">
      {roundInfo.phase === GamePhase.SELECTION && (
        <SelectionPage 
          playerName={playerName} 
          playerId={playerId} 
          selectedCards={selectedCards}
          onToggleCard={handleToggleCard}
          onRandomAssign={handleRandomAssign}
          onClearSelection={handleClearSelection}
          globalTime={globalTime}
          roundEndTime={roundInfo.selectionEnd}
          roundId={roundInfo.roundId}
        />
      )}
      
      {roundInfo.phase === GamePhase.PLAYING && (
        <GamePage 
          selectedCards={selectedCards} 
          playerName={playerName}
          playerId={playerId}
          onWin={() => {}} 
          globalTime={globalTime}
          roundStartTime={roundInfo.selectionEnd}
          roundId={roundInfo.roundId}
          activeParticipantCount={roundInfo.activeParticipantCount}
        />
      )}
      
      {roundInfo.phase === GamePhase.WINNER && winnerData && (
        <WinnerPage 
          data={winnerData} 
          onRestart={() => {}} 
          currentPlayerId={playerId}
          userDidParticipate={selectedCards.length > 0}
        />
      )}

      {/* Admin floating button */}
      <button onClick={() => setShowAdmin(true)} className="fixed top-6 right-6 z-50 bg-white/6 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10">
        Admin
      </button>

      {showAdmin && <AdminPage onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

export default App;
