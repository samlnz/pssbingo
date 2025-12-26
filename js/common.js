// common.js - Updated with synchronized timing
class GameState {
  constructor() {
    this.selectedCards = [];
    this.playerName = 'Telegram User';
    this.playerId = '0000';
    this.markedNumbers = { card1: new Set(), card2: new Set() };
    this.winningLines = { card1: [], card2: [] };
    this.isAudioEnabled = true;
    this.isAutoMark = true;
    this.isObserver = false;
    
    // Synchronized game state
    this.syncState = {
      gamePhase: 'waiting',
      currentPhaseTime: 0,
      timeToNextPhase: 0,
      currentNumber: null,
      calledNumbers: new Set(),
      totalCalled: 0,
      gameId: null,
      isConnected: false
    };
  }

  saveToSession() {
    sessionStorage.setItem('bingoGameState', JSON.stringify({
      selectedCards: this.selectedCards,
      playerName: this.playerName,
      playerId: this.playerId,
      markedNumbers: {
        card1: Array.from(this.markedNumbers.card1),
        card2: Array.from(this.markedNumbers.card2)
      },
      winningLines: this.winningLines,
      isAudioEnabled: this.isAudioEnabled,
      isAutoMark: this.isAutoMark,
      isObserver: this.isObserver
    }));
  }

  loadFromSession() {
    const saved = sessionStorage.getItem('bingoGameState');
    if (saved) {
      const data = JSON.parse(saved);
      this.selectedCards = data.selectedCards || [];
      this.playerName = data.playerName || 'Telegram User';
      this.playerId = data.playerId || '0000';
      this.markedNumbers = {
        card1: new Set(data.markedNumbers?.card1 || []),
        card2: new Set(data.markedNumbers?.card2 || [])
      };
      this.winningLines = data.winningLines || { card1: [], card2: [] };
      this.isAudioEnabled = data.isAudioEnabled !== undefined ? data.isAudioEnabled : true;
      this.isAutoMark = data.isAutoMark !== undefined ? data.isAutoMark : true;
      this.isObserver = data.isObserver !== undefined ? data.isObserver : false;
    }
  }

  clearSession() {
    sessionStorage.removeItem('bingoGameState');
  }

  // Synchronized methods
  updateSyncState(syncData) {
    this.syncState = {
      ...this.syncState,
      ...syncData,
      calledNumbers: new Set(syncData.calledNumbers || [])
    };
  }

  getGamePhase() {
    return this.syncState.gamePhase;
  }

  getTimeToNextPhase() {
    return this.syncState.timeToNextPhase;
  }

  getCurrentNumber() {
    return this.syncState.currentNumber;
  }

  getCalledNumbers() {
    return this.syncState.calledNumbers;
  }

  getTotalCalled() {
    return this.syncState.totalCalled;
  }

  isNumberCalled(number) {
    return this.syncState.calledNumbers.has(number);
  }

  isGameActive() {
    return this.syncState.gamePhase === 'active';
  }

  isSelectionPhase() {
    return this.syncState.gamePhase === 'selection';
  }

  isWaitingPhase() {
    return this.syncState.gamePhase === 'waiting';
  }
}

class BingoUtils {
  static BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
  
  static BINGO_RANGES = {
    'B': { min: 1, max: 15 },
    'I': { min: 16, max: 30 },
    'N': { min: 31, max: 45 },
    'G': { min: 46, max: 60 },
    'O': { min: 61, max: 75 }
  };

  static getLetterForNumber(number) {
    for (const [letter, range] of Object.entries(this.BINGO_RANGES)) {
      if (number >= range.min && number <= range.max) {
        return letter;
      }
    }
    return '';
  }

  static formatTime(seconds) {
    if (seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  static playAudio(audioElement, volume = 1) {
    if (audioElement && gameState.isAudioEnabled) {
      audioElement.volume = volume;
      audioElement.currentTime = 0;
      audioElement.play().catch(e => console.log('Audio play failed:', e));
    }
  }

  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  static generateBingoCardNumbers(cardNumber) {
    const card = cardGenerator.generateCard(cardNumber);
    return card.numbers;
  }

  static getCardGrid(cardNumber) {
    const card = cardGenerator.generateCard(cardNumber);
    return cardGenerator.numbersToGrid(card.numbers);
  }
}

// Initialize global instances
const gameState = new GameState();