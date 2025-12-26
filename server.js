// server.js - Main server for synchronized Bingo games
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Game state management
class GlobalGameController {
  constructor() {
    this.gameState = {
      gameId: null,
      gameStartTime: null,
      gamePhase: 'waiting', // waiting, selection, active, finished
      selectionEndTime: null,
      gameDuration: 300, // 5 minutes = 300 seconds
      selectionDuration: 60, // 1 minute selection
      breakDuration: 30, // 30 seconds between games
      calledNumbers: new Set(),
      activePlayers: new Set(),
      takenCards: new Set(),
      winners: [],
      currentNumber: null,
      nextCallTime: null
    };
    
    this.initGameCycle();
  }

  initGameCycle() {
    // Calculate next game start based on 5.5 minute cycles
    const now = Date.now();
    const cycleDuration = (this.gameState.gameDuration + this.gameState.breakDuration) * 1000;
    const nextGameStart = Math.ceil(now / cycleDuration) * cycleDuration;
    
    this.gameState.gameStartTime = nextGameStart;
    this.gameState.gameId = Math.floor(nextGameStart / cycleDuration);
    this.gameState.gamePhase = 'waiting';
    
    console.log(`Game ${this.gameState.gameId} scheduled to start at: ${new Date(nextGameStart).toISOString()}`);
    
    // Start the game cycle
    this.startGameCycle();
  }

  startGameCycle() {
    setInterval(() => {
      this.updateGameState();
      this.broadcastGameState();
    }, 1000);
  }

  updateGameState() {
    const now = Date.now();
    const gameStart = this.gameState.gameStartTime;
    const elapsed = (now - gameStart) / 1000;
    
    if (elapsed < 0) {
      // Waiting for game to start
      this.gameState.gamePhase = 'waiting';
    } else if (elapsed < this.gameState.selectionDuration) {
      // Selection phase
      this.gameState.gamePhase = 'selection';
      this.gameState.selectionEndTime = gameStart + (this.gameState.selectionDuration * 1000);
      
      // Clear called numbers at start of selection
      if (elapsed < 2) {
        this.gameState.calledNumbers.clear();
        this.gameState.currentNumber = null;
        this.gameState.winners = [];
      }
    } else if (elapsed < this.gameState.selectionDuration + this.gameState.gameDuration) {
      // Game active phase
      this.gameState.gamePhase = 'active';
      
      // Calculate time into game phase
      const gameElapsed = elapsed - this.gameState.selectionDuration;
      
      // Call numbers every 5 seconds
      if (gameElapsed > 0 && Math.floor(gameElapsed) % 5 === 0 && 
          this.gameState.calledNumbers.size < 75) {
        this.callNextNumber();
      }
    } else {
      // Game finished, waiting for next cycle
      this.gameState.gamePhase = 'finished';
      
      // Reset for next game if break time is over
      if (elapsed >= this.gameState.selectionDuration + this.gameState.gameDuration + this.gameState.breakDuration) {
        this.initGameCycle();
      }
    }
  }

  callNextNumber() {
    if (this.gameState.calledNumbers.size >= 75) return;
    
    let number;
    do {
      number = Math.floor(Math.random() * 75) + 1;
    } while (this.gameState.calledNumbers.has(number));
    
    this.gameState.calledNumbers.add(number);
    this.gameState.currentNumber = number;
    this.gameState.nextCallTime = Date.now() + 5000;
    
    // Broadcast new number to all clients
    io.emit('numberCalled', {
      number: number,
      letter: this.getLetterForNumber(number),
      totalCalled: this.gameState.calledNumbers.size
    });
    
    console.log(`Called number: ${number}`);
  }

  getLetterForNumber(number) {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
  }

  broadcastGameState() {
    const gameData = {
      gameId: this.gameState.gameId,
      gamePhase: this.gameState.gamePhase,
      gameStartTime: this.gameState.gameStartTime,
      selectionEndTime: this.gameState.selectionEndTime,
      currentNumber: this.gameState.currentNumber,
      calledNumbers: Array.from(this.gameState.calledNumbers),
      totalCalled: this.gameState.calledNumbers.size,
      activePlayers: this.gameState.activePlayers.size,
      selectionDuration: this.gameState.selectionDuration,
      gameDuration: this.gameState.gameDuration,
      breakDuration: this.gameState.breakDuration,
      winners: this.gameState.winners,
      serverTime: Date.now()
    };
    
    io.emit('gameUpdate', gameData);
  }

  // Player management
  addPlayer(playerId, playerName) {
    this.gameState.activePlayers.add({ id: playerId, name: playerName });
    return this.getGameStateForPlayer(playerId);
  }

  removePlayer(playerId) {
    this.gameState.activePlayers.delete(playerId);
  }

  takeCard(cardNumber, playerId) {
    if (this.gameState.takenCards.has(cardNumber)) {
      return { success: false, message: 'Card already taken' };
    }
    
    this.gameState.takenCards.add({ card: cardNumber, player: playerId });
    return { success: true, card: cardNumber };
  }

  declareWinner(playerId, playerName, cardNumbers, winningLines) {
    this.gameState.winners.push({
      playerId,
      playerName,
      cardNumbers,
      winningLines,
      winTime: Date.now(),
      calledNumbers: this.gameState.calledNumbers.size
    });
    
    // Broadcast winner announcement
    io.emit('winnerDeclared', {
      playerName,
      cardNumbers,
      winningLines,
      winTime: Date.now()
    });
    
    return { success: true };
  }

  getGameStateForPlayer(playerId) {
    const now = Date.now();
    const gameStart = this.gameState.gameStartTime;
    const elapsed = (now - gameStart) / 1000;
    
    let timeToNextPhase = 0;
    let currentPhaseTime = 0;
    
    if (this.gameState.gamePhase === 'waiting') {
      timeToNextPhase = -elapsed;
    } else if (this.gameState.gamePhase === 'selection') {
      currentPhaseTime = elapsed;
      timeToNextPhase = this.gameState.selectionDuration - elapsed;
    } else if (this.gameState.gamePhase === 'active') {
      currentPhaseTime = elapsed - this.gameState.selectionDuration;
      timeToNextPhase = this.gameState.gameDuration - currentPhaseTime;
    }
    
    return {
      gameId: this.gameState.gameId,
      gamePhase: this.gameState.gamePhase,
      currentPhaseTime: Math.max(0, Math.floor(currentPhaseTime)),
      timeToNextPhase: Math.max(0, Math.floor(timeToNextPhase)),
      currentNumber: this.gameState.currentNumber,
      calledNumbers: Array.from(this.gameState.calledNumbers),
      totalCalled: this.gameState.calledNumbers.size,
      serverTime: now
    };
  }
}

// Initialize game controller
const gameController = new GlobalGameController();

// REST API Endpoints
app.get('/api/game/state', (req, res) => {
  const playerId = req.query.playerId || 'anonymous';
  const gameState = gameController.getGameStateForPlayer(playerId);
  res.json(gameState);
});

app.get('/api/game/sync', (req, res) => {
  res.json({
    serverTime: Date.now(),
    gameId: gameController.gameState.gameId,
    gamePhase: gameController.gameState.gamePhase
  });
});

app.post('/api/player/join', (req, res) => {
  const { playerId, playerName } = req.body;
  const gameState = gameController.addPlayer(playerId, playerName);
  res.json({ success: true, gameState });
});

app.post('/api/cards/take', (req, res) => {
  const { cardNumber, playerId } = req.body;
  const result = gameController.takeCard(cardNumber, playerId);
  res.json(result);
});

app.post('/api/game/declare-win', (req, res) => {
  const { playerId, playerName, cardNumbers, winningLines } = req.body;
  const result = gameController.declareWinner(playerId, playerName, cardNumbers, winningLines);
  res.json(result);
});

app.get('/api/cards/available', (req, res) => {
  // Return some taken cards for demonstration
  const takenCards = Array.from(gameController.gameState.takenCards).slice(0, 50);
  res.json({ takenCards, totalCards: 500 });
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('playerJoin', (data) => {
    const { playerId, playerName } = data;
    gameController.addPlayer(playerId, playerName);
    socket.join(`player_${playerId}`);
    socket.emit('gameState', gameController.getGameStateForPlayer(playerId));
  });
  
  socket.on('takeCard', (data) => {
    const { cardNumber, playerId } = data;
    const result = gameController.takeCard(cardNumber, playerId);
    socket.emit('cardTaken', result);
    
    if (result.success) {
      io.emit('cardTakenUpdate', { 
        cardNumber, 
        playerId,
        takenCards: gameController.gameState.takenCards.size 
      });
    }
  });
  
  socket.on('declareWin', (data) => {
    const { playerId, playerName, cardNumbers, winningLines } = data;
    const result = gameController.declareWinner(playerId, playerName, cardNumbers, winningLines);
    socket.emit('winDeclared', result);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Bingo Game Controller initialized`);
  console.log(`Games synchronized globally for all players`);
});