const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const GameManager = require('./game-manager');

class BingoServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.gameManager = new GameManager();
        this.port = process.env.PORT || 3000;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startGameCycle();
    }
    
    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, '../public')));
        this.app.use(express.json());
    }
    
    setupRoutes() {
        // API endpoints
        this.app.get('/api/game/state', (req, res) => {
            res.json(this.gameManager.getGameState());
        });
        
        this.app.post('/api/player/join', (req, res) => {
            const { playerId, playerName } = req.body;
            const player = this.gameManager.addPlayer(playerId, playerName);
            res.json(player);
        });
        
        this.app.post('/api/cards/select', (req, res) => {
            const { playerId, cardNumbers } = req.body;
            const result = this.gameManager.selectCards(playerId, cardNumbers);
            res.json(result);
        });
        
        this.app.post('/api/game/bingo', (req, res) => {
            const { playerId, cardId, pattern } = req.body;
            const result = this.gameManager.verifyBingo(playerId, cardId, pattern);
            
            if (result.valid) {
                // Broadcast winner to all
                this.io.emit('winner', {
                    winner: result.winner,
                    pattern: pattern,
                    timestamp: Date.now()
                });
            }
            
            res.json(result);
        });
        
        // Serve main page
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
    }
    
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`New connection: ${socket.id}`);
            
            // Send current game state to new connection
            socket.emit('gameState', this.gameManager.getGameState());
            
            // Listen for player actions
            socket.on('playerJoin', (data) => {
                const player = this.gameManager.addPlayer(data.playerId, data.playerName);
                socket.emit('playerJoined', player);
                this.io.emit('playerCount', this.gameManager.getPlayerCount());
            });
            
            socket.on('cardSelection', (data) => {
                const result = this.gameManager.selectCards(data.playerId, data.cardNumbers);
                socket.emit('selectionResult', result);
                
                // Update all clients about taken cards
                this.io.emit('cardsUpdate', {
                    takenCards: this.gameManager.getTakenCards(),
                    players: this.gameManager.getPlayerCount()
                });
            });
            
            socket.on('markNumber', (data) => {
                // For auto-mark feature
                socket.emit('numberMarked', data);
            });
            
            socket.on('disconnect', () => {
                console.log(`Disconnected: ${socket.id}`);
                this.io.emit('playerCount', this.gameManager.getPlayerCount());
            });
        });
        
        // Broadcast game events
        this.gameManager.on('numberCalled', (number) => {
            this.io.emit('newNumber', number);
        });
        
        this.gameManager.on('gamePhaseChange', (phase) => {
            this.io.emit('gamePhase', phase);
        });
        
        this.gameManager.on('gameEnd', (winner) => {
            this.io.emit('gameEnd', winner);
        });
    }
    
    startGameCycle() {
        // Auto-start new game every 10 minutes
        setInterval(() => {
            if (!this.gameManager.isGameActive()) {
                console.log('Starting new game cycle...');
                this.gameManager.startNewGame();
                
                // Countdown to game start
                let countdown = 60;
                const countdownInterval = setInterval(() => {
                    this.io.emit('countdown', countdown);
                    countdown--;
                    
                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        this.gameManager.startCallingNumbers();
                    }
                }, 1000);
            }
        }, 600000); // 10 minutes
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`Bingo Server running on port ${this.port}`);
            console.log(`Global game will start at next scheduled time`);
        });
    }
}

// Start server
const server = new BingoServer();
server.start();