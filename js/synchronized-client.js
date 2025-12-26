// synchronized-client.js - Client-side synchronization with server
class SynchronizedGameClient {
  constructor(serverUrl = 'https://intuitive-comfort-production-e6fc.up.railway.app') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.gameState = null;
    this.syncInterval = null;
    this.lastSyncTime = 0;
    this.syncIntervalMs = 2000; // Sync every 2 seconds
    this.isConnected = false;
    
    // Callbacks
    this.onGameUpdate = null;
    this.onNumberCalled = null;
    this.onWinnerDeclared = null;
    
    this.init();
  }

  async init() {
    await this.connectToServer();
    this.startSyncLoop();
  }

  async connectToServer() {
    try {
      // First, get initial game state via REST API
      const response = await fetch(`${this.serverUrl}/api/game/sync`);
      const syncData = await response.json();
      
      this.gameState = {
        serverTime: syncData.serverTime,
        gameId: syncData.gameId,
        gamePhase: syncData.gamePhase,
        lastUpdate: Date.now()
      };
      
      console.log('Connected to synchronized game server:', this.gameState);
      this.isConnected = true;
      
      // Setup WebSocket connection for real-time updates
      this.setupWebSocket();
      
    } catch (error) {
      console.error('Failed to connect to game server:', error);
      this.isConnected = false;
      
      // Fallback to local timing if server is unavailable
      this.setupLocalFallback();
    }
  }

  setupWebSocket() {
    try {
      this.socket = io(this.serverUrl);
      
      this.socket.on('connect', () => {
        console.log('WebSocket connected to game server');
      });
      
      this.socket.on('gameUpdate', (gameData) => {
        this.handleGameUpdate(gameData);
      });
      
      this.socket.on('numberCalled', (numberData) => {
        if (this.onNumberCalled) {
          this.onNumberCalled(numberData);
        }
      });
      
      this.socket.on('winnerDeclared', (winnerData) => {
        if (this.onWinnerDeclared) {
          this.onWinnerDeclared(winnerData);
        }
      });
      
      this.socket.on('cardTakenUpdate', (cardData) => {
        // Update local taken cards state
        if (this.onCardTakenUpdate) {
          this.onCardTakenUpdate(cardData);
        }
      });
      
      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected from game server');
      });
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }

  async startSyncLoop() {
    this.syncInterval = setInterval(async () => {
      await this.syncWithServer();
    }, this.syncIntervalMs);
  }

  async syncWithServer() {
    if (!this.isConnected) return;
    
    try {
      const response = await fetch(`${this.serverUrl}/api/game/state?playerId=${this.getPlayerId()}`);
      const serverState = await response.json();
      
      this.gameState = {
        ...serverState,
        lastUpdate: Date.now(),
        serverTimeDiff: Date.now() - serverState.serverTime
      };
      
      this.lastSyncTime = Date.now();
      
      if (this.onGameUpdate) {
        this.onGameUpdate(this.gameState);
      }
      
    } catch (error) {
      console.error('Sync with server failed:', error);
      
      // If sync fails too many times, switch to fallback
      if (Date.now() - this.lastSyncTime > 10000) { // 10 seconds
        this.isConnected = false;
        this.setupLocalFallback();
      }
    }
  }

  setupLocalFallback() {
    console.log('Switching to local fallback mode');
    
    // Create a local game cycle based on system time
    const cycleDuration = (300 + 30) * 1000; // 5.5 minutes
    const now = Date.now();
    const gameStart = Math.floor(now / cycleDuration) * cycleDuration;
    const elapsed = (now - gameStart) / 1000;
    
    this.gameState = {
      gameId: Math.floor(gameStart / cycleDuration),
      gamePhase: this.getGamePhaseFromElapsed(elapsed),
      currentPhaseTime: this.getPhaseTime(elapsed),
      timeToNextPhase: this.getTimeToNextPhase(elapsed),
      currentNumber: null,
      calledNumbers: [],
      totalCalled: 0,
      serverTime: now,
      lastUpdate: now,
      isFallback: true
    };
    
    // Simulate number calling in fallback mode
    if (this.gameState.gamePhase === 'active') {
      const gameElapsed = elapsed - 60; // Subtract selection time
      const numbersCalled = Math.min(Math.floor(gameElapsed / 5), 75);
      
      this.gameState.totalCalled = numbersCalled;
      // Generate called numbers for fallback
      this.gameState.calledNumbers = this.generateCalledNumbers(numbersCalled);
      
      if (numbersCalled > 0) {
        this.gameState.currentNumber = this.gameState.calledNumbers[this.gameState.calledNumbers.length - 1];
      }
    }
  }

  getGamePhaseFromElapsed(elapsed) {
    if (elapsed < 0) return 'waiting';
    if (elapsed < 60) return 'selection';
    if (elapsed < 360) return 'active'; // 60 + 300
    return 'finished';
  }

  getPhaseTime(elapsed) {
    if (elapsed < 0) return Math.abs(elapsed);
    if (elapsed < 60) return elapsed;
    if (elapsed < 360) return elapsed - 60;
    return elapsed - 360;
  }

  getTimeToNextPhase(elapsed) {
    if (elapsed < 0) return Math.abs(elapsed);
    if (elapsed < 60) return 60 - elapsed;
    if (elapsed < 360) return 360 - elapsed;
    return (330 * 2) - elapsed; // Next game cycle
  }

  generateCalledNumbers(count) {
    const numbers = new Set();
    while (numbers.size < Math.min(count, 75)) {
      numbers.add(Math.floor(Math.random() * 75) + 1);
    }
    return Array.from(numbers);
  }

  // Player methods
  async joinGame(playerId, playerName) {
    try {
      const response = await fetch(`${this.serverUrl}/api/player/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to join game:', error);
      return { success: false, isFallback: true };
    }
  }

  async takeCard(cardNumber, playerId) {
    try {
      const response = await fetch(`${this.serverUrl}/api/cards/take`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber, playerId })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to take card:', error);
      return { success: false, message: 'Server unavailable' };
    }
  }

  async declareWin(playerData) {
    try {
      const response = await fetch(`${this.serverUrl}/api/game/declare-win`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerData)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to declare win:', error);
      return { success: false };
    }
  }

  async getAvailableCards() {
    try {
      const response = await fetch(`${this.serverUrl}/api/cards/available`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get available cards:', error);
      return { takenCards: [], totalCards: 500 };
    }
  }

  // Utility methods
  getPlayerId() {
    return localStorage.getItem('playerId') || 'anonymous_' + Math.random().toString(36).substr(2, 9);
  }

  getCurrentGameState() {
    return this.gameState;
  }

  isGamePhase(phase) {
    return this.gameState && this.gameState.gamePhase === phase;
  }

  getTimeUntilNextGame() {
    if (!this.gameState) return 0;
    
    if (this.gameState.gamePhase === 'finished') {
      return this.gameState.timeToNextPhase;
    } else if (this.gameState.gamePhase === 'waiting') {
      return this.gameState.timeToNextPhase;
    }
    
    // Calculate based on current phase
    const phaseDurations = {
      selection: 60,
      active: 300,
      finished: 30
    };
    
    return phaseDurations[this.gameState.gamePhase] - this.gameState.currentPhaseTime;
  }

  disconnect() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.isConnected = false;
  }
}

// Create global synchronized game client
const synchronizedGame = new SynchronizedGameClient();