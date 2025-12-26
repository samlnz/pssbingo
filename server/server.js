const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Global game state
let gameState = {
    phase: 'selection', // selection, ready, playing, ended
    selectionTimeLeft: 60,
    currentNumber: null,
    calledNumbers: [],
    takenCards: [],
    players: {},
    gameActive: true,
    gameStartTime: null
};

// Timers
let timers = {
    selection: null,
    ready: null,
    calling: null
};

// Initialize game
function initializeGame() {
    console.log('🎮 Initializing Bingo Game...');
    
    // Reset state
    gameState = {
        phase: 'selection',
        selectionTimeLeft: 60,
        currentNumber: null,
        calledNumbers: [],
        takenCards: [],
        players: {},
        gameActive: true,
        gameStartTime: Date.now() + 60000
    };
    
    // Start selection countdown
    startSelectionCountdown();
    
    // Broadcast initial state
    io.emit('game-state', gameState);
    console.log('✅ Game initialized. Phase: selection');
}

// Start selection countdown
function startSelectionCountdown() {
    if (timers.selection) clearInterval(timers.selection);
    
    timers.selection = setInterval(() => {
        gameState.selectionTimeLeft--;
        
        // Broadcast countdown to all clients
        io.emit('selection-countdown', {
            seconds: gameState.selectionTimeLeft,
            phase: gameState.phase
        });
        
        // Handle end of selection
        if (gameState.selectionTimeLeft <= 0) {
            clearInterval(timers.selection);
            startReadyPhase();
        }
    }, 1000);
}

// Start ready phase (3-second countdown)
function startReadyPhase() {
    console.log('⏳ Starting ready phase...');
    gameState.phase = 'ready';
    io.emit('game-phase-change', 'ready');
    
    let readyCountdown = 3;
    
    // Countdown 3...2...1...GO!
    timers.ready = setInterval(() => {
        io.emit('ready-countdown', readyCountdown);
        readyCountdown--;
        
        if (readyCountdown < 0) {
            clearInterval(timers.ready);
            startGamePhase();
        }
    }, 1000);
}

// Start game phase
function startGamePhase() {
    console.log('🎲 Starting game phase...');
    gameState.phase = 'playing';
    io.emit('game-phase-change', 'playing');
    
    // Start calling numbers every 5 seconds
    startNumberCalling();
}

// Start calling numbers
function startNumberCalling() {
    if (timers.calling) clearInterval(timers.calling);
    
    // First number immediately
    setTimeout(() => callNextNumber(), 1000);
    
    // Then every 5 seconds
    timers.calling = setInterval(() => {
        if (gameState.calledNumbers.length >= 75) {
            endGame();
            return;
        }
        callNextNumber();
    }, 5000);
}

// Call next BINGO number
function callNextNumber() {
    let number;
    do {
        number = Math.floor(Math.random() * 75) + 1;
    } while (gameState.calledNumbers.includes(number));
    
    gameState.currentNumber = number;
    gameState.calledNumbers.push(number);
    
    const letter = getLetterForNumber(number);
    
    const numberData = {
        number: number,
        letter: letter,
        full: `${letter}-${number}`,
        calledNumbers: gameState.calledNumbers,
        timestamp: Date.now()
    };
    
    console.log(`🔊 Called: ${numberData.full}`);
    
    // Broadcast to all clients
    io.emit('number-called', numberData);
}

// Get BINGO letter for number
function getLetterForNumber(num) {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
}

// End game
function endGame(winner = null) {
    console.log('🏁 Game ended');
    
    // Clear all timers
    Object.values(timers).forEach(timer => {
        if (timer) clearInterval(timer);
    });
    
    gameState.phase = 'ended';
    gameState.gameActive = false;
    
    if (winner) {
        io.emit('winner-declared', winner);
    }
    
    // Restart game in 30 seconds
    setTimeout(() => {
        initializeGame();
    }, 30000);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`👤 New player connected: ${socket.id}`);
    
    // Send current game state
    socket.emit('game-state', gameState);
    
    // Handle card selection
    socket.on('select-card', (data) => {
        const { cardNumber, playerId, playerName } = data;
        
        console.log(`🎴 Card selection: ${playerName} wants card ${cardNumber}`);
        
        // Check if card already taken
        if (gameState.takenCards.includes(cardNumber)) {
            socket.emit('card-unavailable', cardNumber);
            return;
        }
        
        // Add card to taken cards
        gameState.takenCards.push(cardNumber);
        
        // Update player info
        if (!gameState.players[playerId]) {
            gameState.players[playerId] = {
                id: playerId,
                name: playerName,
                selectedCards: [],
                connectedAt: Date.now()
            };
        }
        
        // Add card to player
        gameState.players[playerId].selectedCards.push(cardNumber);
        
        // Broadcast to all clients
        io.emit('card-taken', {
            cardNumber: cardNumber,
            playerId: playerId,
            takenCards: gameState.takenCards,
            playerCount: Object.keys(gameState.players).length
        });
        
        // Confirm to player
        socket.emit('card-selected', {
            success: true,
            cardNumber: cardNumber
        });
    });
    
    // Handle card deselection
    socket.on('deselect-card', (data) => {
        const { cardNumber, playerId } = data;
        
        // Remove from player's cards
        if (gameState.players[playerId]) {
            const index = gameState.players[playerId].selectedCards.indexOf(cardNumber);
            if (index > -1) {
                gameState.players[playerId].selectedCards.splice(index, 1);
            }
        }
        
        // Remove from taken cards
        const takenIndex = gameState.takenCards.indexOf(cardNumber);
        if (takenIndex > -1) {
            gameState.takenCards.splice(takenIndex, 1);
        }
        
        // Broadcast update
        io.emit('card-released', {
            cardNumber: cardNumber,
            takenCards: gameState.takenCards,
            playerCount: Object.keys(gameState.players).length
        });
    });
    
    // Handle win claim
    socket.on('claim-win', (data) => {
        console.log('🏆 Win claimed:', data);
        
        // Verify win (simplified for now)
        const winner = {
            playerId: data.playerId,
            playerName: data.playerName,
            cardNumber: data.cardNumber,
            pattern: data.pattern,
            timestamp: Date.now(),
            calledNumbers: gameState.calledNumbers.length
        };
        
        endGame(winner);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`👤 Player disconnected: ${socket.id}`);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🔄 Game will auto-start on connection`);
    
    // Initialize game
    initializeGame();
});