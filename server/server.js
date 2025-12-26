const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Game state
let game = {
  phase: 'waiting', // waiting, playing, ended
  currentNumber: null,
  calledNumbers: [],
  players: 0,
  startTime: null,
  isActive: false
};

let gameTimer = null;
let callTimer = null;

// Start the game sequence
function startGameSequence() {
  console.log('🎮 Starting new game');
  
  game = {
    phase: 'playing',
    currentNumber: null,
    calledNumbers: [],
    players: 0,
    startTime: Date.now() + 3000, // Game starts in 3 seconds
    isActive: false
  };
  
  // Clear any existing timers
  if (gameTimer) clearTimeout(gameTimer);
  if (callTimer) clearInterval(callTimer);
  
  // Broadcast waiting period
  io.emit('game-status', {
    phase: 'waiting',
    message: 'Game starting in 3 seconds...',
    gameStartTime: game.startTime
  });
  
  console.log('⏳ 3-second wait before starting...');
  
  // Wait 3 seconds, then start calling numbers
  gameTimer = setTimeout(() => {
    game.isActive = true;
    console.log('✅ Game active, starting number calling');
    
    io.emit('game-status', {
      phase: 'playing',
      message: 'Game started!'
    });
    
    // Call first number immediately
    callNumber();
    
    // Then call every 5 seconds
    callTimer = setInterval(() => {
      if (game.calledNumbers.length >= 75) {
        endGame();
        return;
      }
      callNumber();
    }, 5000);
  }, 3000);
}

function callNumber() {
  let number;
  do {
    number = Math.floor(Math.random() * 75) + 1;
  } while (game.calledNumbers.includes(number));
  
  // Get letter
  let letter = 'B';
  if (number <= 15) letter = 'B';
  else if (number <= 30) letter = 'I';
  else if (number <= 45) letter = 'N';
  else if (number <= 60) letter = 'G';
  else letter = 'O';
  
  game.currentNumber = number;
  game.calledNumbers.push(number);
  
  const numberData = {
    number: number,
    letter: letter,
    full: `${letter}-${number}`,
    totalCalled: game.calledNumbers.length,
    timestamp: Date.now()
  };
  
  console.log(`🔔 Called: ${numberData.full} (${numberData.totalCalled}/75)`);
  
  // Send to ALL connected clients
  io.emit('new-number', numberData);
}

function endGame() {
  console.log('🏁 Game ended - 75 numbers called');
  clearInterval(callTimer);
  game.isActive = false;
  game.phase = 'ended';
  
  io.emit('game-status', {
    phase: 'ended',
    message: 'Game over! All numbers called.'
  });
  
  // Restart in 30 seconds
  setTimeout(() => {
    startGameSequence();
  }, 30000);
}

// WebSocket handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  game.players++;
  
  // Send current game state to new client
  socket.emit('game-state', {
    currentNumber: game.currentNumber,
    calledNumbers: game.calledNumbers,
    totalCalled: game.calledNumbers.length,
    isActive: game.isActive,
    players: game.players,
    phase: game.phase
  });
  
  // Send player count to everyone
  io.emit('player-count', { count: game.players });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    game.players = Math.max(0, game.players - 1);
    io.emit('player-count', { count: game.players });
  });
  
  // Handle win claim
  socket.on('claim-win', (data) => {
    console.log(`🏆 Win claimed by ${data.playerName}`);
    io.emit('winner', {
      playerName: data.playerName,
      cardNumber: data.cardNumber,
      timestamp: Date.now()
    });
    endGame();
  });
});

// Serve static files
app.use(express.static('public'));

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('🎮 Starting game sequence...');
  startGameSequence();
});