const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const RealTimeGameEngine = require('./game-engine');

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

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

io.on('connection', (socket) => {
    console.log(`🔌 New WebSocket connection: ${socket.id}`);
    
    socket.emit('game-state', gameEngine.getGameState());
    
    socket.on('register-player', (playerData) => {
        console.log(`👤 Player registering: ${playerData.playerName}`);
        
        const player = gameEngine.addPlayer(socket.id, playerData);
        
        socket.emit('registration-confirmed', {
            playerId: player.id,
            playerName: player.name,
            gameState: gameEngine.getGameState()
        });
        
        io.emit('players-updated', {
            playerCount: gameEngine.gameState.players.size
        });
    });
    
    socket.on('select-card', (data) => {
        const result = gameEngine.selectCard(socket.id, data.cardNumber);
        
        if (result.success) {
            socket.emit('card-selected', result);
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
    
    socket.on('deselect-card', (data) => {
        const released = gameEngine.releaseCard(data.cardNumber);
        
        if (released) {
            socket.emit('card-deselected', { cardNumber: data.cardNumber });
            io.emit('card-released', {
                cardNumber: data.cardNumber,
                takenCards: gameEngine.gameState.takenCards
            });
        }
    });
    
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
    
    socket.on('disconnect', () => {
        console.log(`🔌 WebSocket disconnected: ${socket.id}`);
        gameEngine.removePlayer(socket.id);
        
        io.emit('players-updated', {
            playerCount: gameEngine.gameState.players.size
        });
    });
    
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

function startGameLifecycle() {
    console.log('🚀 Starting synchronized game lifecycle');
    
    const initialState = gameEngine.initializeNewGame();
    io.emit('game-state', initialState);
    
    gameEngine.startSelectionCountdown((event, data) => {
        io.emit(event, data);
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Real-time Bingo Server running on port ${PORT}`);
    console.log(`🌐 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🔄 Starting synchronized game...`);
    
    startGameLifecycle();
});