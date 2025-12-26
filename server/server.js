const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
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
    phase: 'waiting', // waiting, selection, ready, playing, ended
    selectionTimeLeft: 60,
    currentNumber: null,
    calledNumbers: [],
    takenCards: [],
    players: {},
    gameActive: false,
    gameStartTime: null,
    nextCallTime: 5
};

// Timers
let selectionTimer = null;
let numberCallTimer = null;

// Generate unique BINGO numbers
function generateBingoNumber() {
    if (gameState.calledNumbers.length >= 75) return null;
    
    let number;
    do {
        number = Math.floor(Math.random() * 75) + 1;
    } while (gameState.calledNumbers.includes(number));
    
    return number;
}

// Get BINGO letter for number
function getLetterForNumber(num) {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
}

// Start new game cycle
function startNewGame() {
    console.log('🚀 Starting new game cycle');
    
    // Reset game state
    gameState = {
        phase: 'selection',
        selectionTimeLeft: 60,
        currentNumber: null,
        calledNumbers: [],
        takenCards: [],
        players: {},
        gameActive: true,
        gameStartTime: Date.now() + 60000,
        nextCallTime: 5
    };
    
    // Clear old timers
    if (selectionTimer) clearInterval(selectionTimer);
    if (numberCallTimer) clearInterval(numberCallTimer);
    
    // Broadcast new game to all
    io.emit('game-state', gameState);
    
    // Start selection countdown
    startSelectionCountdown();
}

// Start selection countdown
function startSelectionCountdown() {
    let timeLeft = 60;
    
    selectionTimer = setInterval(() => {
        timeLeft--;
        gameState.selectionTimeLeft = timeLeft;
        
        // Broadcast countdown to all
        io.emit('selection-countdown', timeLeft);
        
        // Broadcast urgent warning
        if (timeLeft <= 10) {
            io.emit('urgent-warning', timeLeft);
        }
        
        // End selection phase
        if (timeLeft <= 0) {
            clearInterval(selectionTimer);
            startGamePlay();
        }
    }, 1000);
}

// Start game play
function startGamePlay() {
    console.log('🎮 Starting game play');
    gameState.phase = 'ready';
    io.emit('game-phase-change', 'ready');
    
    // 3-second READY animation
    setTimeout(() => {
        gameState.phase = 'playing';
        io.emit('game-phase-change', 'playing');
        startNumberCalling();
    }, 3000);
}

// Start calling numbers
function startNumberCalling() {
    console.log('🔊 Starting number calling');
    
    // Call first number immediately
    callNextNumber();
    
    // Then every 5 seconds
    numberCallTimer = setInterval(() => {
        if (gameState.calledNumbers.length >= 75) {
            endGame();
            return;
        }
        callNextNumber();
    }, 5000);
}

// Call next number
function callNextNumber() {
    const number = generateBingoNumber();
    if (!number) {
        endGame();
        return;
    }
    
    gameState.currentNumber = number;
    gameState.calledNumbers.push(number);
    
    const numberData = {
        number: number,
        letter: getLetterForNumber(number),
        full: `${getLetterForNumber(number)}-${number}`,
        timestamp: Date.now()
    };
    
    console.log(`🔔 Called: ${numberData.full}`);
    
    // Broadcast to all clients
    io.emit('number-called', numberData);
    io.emit('game-state', gameState);
}

// End game
function endGame(winner = null) {
    console.log('🏁 Game ended');
    
    if (selectionTimer) clearInterval(selectionTimer);
    if (numberCallTimer) clearInterval(numberCallTimer);
    
    gameState.phase = 'ended';
    gameState.gameActive = false;
    
    if (winner) {
        io.emit('winner-declared', winner);
        console.log(`🏆 Winner: ${winner.playerName}`);
    }
    
    // Start new game in 30 seconds
    setTimeout(() => {
        startNewGame();
    }, 30000);
}

// Handle winner claim
function handleWinClaim(data) {
    console.log('🎯 Win claimed:', data);
    
    // For now, accept any win claim
    // In production, verify the win pattern
    
    const winner = {
        playerId: data.playerId,
        playerName: data.playerName,
        cardNumber: data.cardNumber,
        pattern: data.pattern,
        timestamp: Date.now(),
        calledNumbers: gameState.calledNumbers.length
    };
    
    endGame(winner);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('👤 New connection:', socket.id);
    
    // Send current game state to new client
    socket.emit('game-state', gameState);
    
    // Handle card selection
    socket.on('select-card', (data) => {
        const { cardNumber, playerId, playerName } = data;
        
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
        
        gameState.players[playerId].selectedCards.push(cardNumber);
        
        // Broadcast update to all clients
        io.emit('card-taken', {
            cardNumber: cardNumber,
            playerId: playerId,
            takenCards: gameState.takenCards
        });
        
        socket.emit('card-selected', {
            success: true,
            cardNumber: cardNumber
        });
    });
    
    // Handle clear selection
    socket.on('clear-selection', (data) => {
        const { playerId, cardNumber } = data;
        
        if (gameState.players[playerId]) {
            const player = gameState.players[playerId];
            const index = player.selectedCards.indexOf(cardNumber);
            if (index > -1) {
                player.selectedCards.splice(index, 1);
                
                // Remove from taken cards
                const takenIndex = gameState.takenCards.indexOf(cardNumber);
                if (takenIndex > -1) {
                    gameState.takenCards.splice(takenIndex, 1);
                }
                
                // Broadcast update
                io.emit('card-released', {
                    cardNumber: cardNumber,
                    playerId: playerId,
                    takenCards: gameState.takenCards
                });
            }
        }
    });
    
    // Handle win claim
    socket.on('claim-win', (data) => {
        handleWinClaim(data);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('👤 Disconnected:', socket.id);
    });
});

// Start the game cycle
startNewGame();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`⏰ Games start every minute automatically`);
    console.log(`🌐 All players sync to the same game`);
});