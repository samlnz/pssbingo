const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
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
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`🔌 New WebSocket connection: ${socket.id}`);
    
    // Send current game state to new connection
    socket.emit('game-state', gameEngine.getGameState());
    
    // Handle player registration
    socket.on('register-player', (playerData) => {
        console.log(`👤 Player registering: ${playerData.playerName}`);
        
        const player = gameEngine.addPlayer(socket.id, playerData);
        
        // Confirm registration
        socket.emit('registration-confirmed', {
            playerId: player.id,
            playerName: player.name,
            gameState: gameEngine.getGameState()
        });
        
        // Broadcast updated player count
        io.emit('players-updated', {
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
                playerId: result.playerId,
                takenCards: result.takenCards
            });
        } else {
            socket.emit('card-unavailable', {
                cardNumber: data.cardNumber,
                error: result.error
            });
        }
    });
    
    // Handle card deselection
    socket.on('deselect-card', (data) => {
        const released = gameEngine.releaseCard(data.cardNumber);
        
        if (released) {
            socket.emit('card-deselected', { cardNumber: data.cardNumber });
            
            // Broadcast to all
            io.emit('card-released', {
                cardNumber: data.cardNumber,
                takenCards: gameEngine.gameState.takenCards
            });
        }
    });
    
    // Handle win claim
    socket.on('claim-win', (data) => {
        const verification = gameEngine.verifyWinClaim(
            data, 
            data.cardNumber, 
            data.pattern
        );
        
        if (verification.valid) {
            gameEngine.endGame(
                (event, data) => io.emit(event, data),
                verification.winner
            );
        } else {
            socket.emit('win-rejected', {
                error: verification.error,
                cardNumber: data.cardNumber
            });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔌 WebSocket disconnected: ${socket.id}`);
        gameEngine.removePlayer(socket.id);
        
        // Broadcast updated player count
        io.emit('players-updated', {
            playerCount: gameEngine.gameState.players.size
        });
    });
    
    // Keep-alive ping
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// Game lifecycle management
function startGameLifecycle() {
    console.log('🚀 Starting synchronized game lifecycle');
    
    // Initialize game
    const initialState = gameEngine.initializeNewGame();
    io.emit('game-state', initialState);
    
    // Start selection countdown with broadcast
    gameEngine.startSelectionCountdown((event, data) => {
        io.emit(event, data);
    });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Real-time Bingo Server running on port ${PORT}`);
    console.log(`🌐 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🔄 Starting synchronized game...`);
    
    // Start game lifecycle
    startGameLifecycle();
});