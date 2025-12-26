const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const RealTimeGameEngine = require('./game-engine');

// Initialize
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const gameEngine = new RealTimeGameEngine();

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);
    
    // Send initial game state to new connection
    const gameState = gameEngine.getGameState();
    socket.emit('initial-state', {
        gameState: gameState,
        timestamp: Date.now()
    });
    
    // Handle player registration
    socket.on('register-player', (playerData) => {
        console.log(`👤 Registering: ${playerData.playerName}`);
        
        const player = gameEngine.addPlayer(socket.id, playerData);
        
        // Confirm registration
        socket.emit('player-registered', {
            playerId: player.id,
            playerName: player.name,
            timestamp: Date.now()
        });
        
        // Broadcast updated player count
        io.emit('player-count-update', {
            playerCount: gameEngine.gameState.players.size
        });
    });
    
    // Handle card selection
    socket.on('select-card', (data) => {
        const result = gameEngine.selectCard(socket.id, data.cardNumber);
        
        if (result.success) {
            // Confirm to player
            socket.emit('card-selected', result);
            
            // Broadcast to all other players
            socket.broadcast.emit('card-taken', {
                cardNumber: data.cardNumber,
                takenCards: result.takenCards
            });
        } else {
            socket.emit('card-error', {
                cardNumber: data.cardNumber,
                error: result.error
            });
        }
    });
    
    // Handle win claim
    socket.on('claim-win', (data) => {
        const verification = gameEngine.verifyWinClaim(data, data.cardNumber, data.pattern);
        
        if (verification.valid) {
            // End game and declare winner
            const winner = gameEngine.endGame(verification.winner);
            
            // Broadcast winner to all
            io.emit('winner-declared', winner);
        } else {
            socket.emit('win-rejected', {
                error: verification.error
            });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        gameEngine.removePlayer(socket.id);
        
        io.emit('player-count-update', {
            playerCount: gameEngine.gameState.players.size
        });
    });
    
    // Handle ping (keep-alive)
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 WebSocket: ws://localhost:${PORT}`);
    
    // Initialize first game
    gameEngine.initializeNewGame();
    
    // Start broadcasting game state updates
    startGameBroadcast();
});

function startGameBroadcast() {
    setInterval(() => {
        const gameState = gameEngine.getGameState();
        
        // Broadcast game state updates
        io.emit('game-state-update', {
            gameState: gameState,
            timestamp: Date.now()
        });
        
        // If game is active, broadcast numbers
        if (gameState.gameActive && gameState.phase === 'playing') {
            io.emit('game-active', {
                gameTime: gameState.gameStartTime ? 
                    Math.floor((Date.now() - gameState.gameStartTime) / 1000) : 0,
                numbersCalled: gameState.calledNumbers.length
            });
        }
        
        // Broadcast selection timer updates
        if (gameState.phase === 'selection') {
            io.emit('selection-timer', {
                seconds: gameState.selectionTimeLeft
            });
        }
    }, 1000);
}