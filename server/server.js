const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

class BingoServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIO(this.server);
        
        this.gameState = {
            phase: 'waiting',
            currentNumber: null,
            calledNumbers: [],
            takenCards: [],
            players: [],
            selectionTimeLeft: 60,
            isGameActive: false,
            gameStartTime: null
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
        this.scheduleGames();
    }
    
    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, '../public')));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }
    
    setupRoutes() {
        // API to get current game state
        this.app.get('/api/game-state', (req, res) => {
            res.json(this.gameState);
        });
        
        // API to select cards
        this.app.post('/api/select-cards', (req, res) => {
            const { playerId, playerName, cardNumbers } = req.body;
            
            // Validate card numbers (1-500)
            if (!cardNumbers || cardNumbers.length > 2) {
                return res.json({ success: false, error: 'Max 2 cards allowed' });
            }
            
            // Check if cards are already taken
            const unavailableCards = cardNumbers.filter(card => 
                this.gameState.takenCards.includes(card)
            );
            
            if (unavailableCards.length > 0) {
                return res.json({ 
                    success: false, 
                    error: `Cards ${unavailableCards.join(', ')} are already taken` 
                });
            }
            
            // Add to taken cards
            cardNumbers.forEach(card => {
                if (!this.gameState.takenCards.includes(card)) {
                    this.gameState.takenCards.push(card);
                }
            });
            
            // Update or add player
            const existingPlayer = this.gameState.players.find(p => p.id === playerId);
            if (existingPlayer) {
                existingPlayer.selectedCards = cardNumbers;
            } else {
                this.gameState.players.push({
                    id: playerId,
                    name: playerName,
                    selectedCards: cardNumbers,
                    joinedAt: Date.now()
                });
            }
            
            // Broadcast update to all clients
            this.io.emit('cards-updated', {
                takenCards: this.gameState.takenCards,
                playerCount: this.gameState.players.length
            });
            
            res.json({ 
                success: true, 
                takenCards: this.gameState.takenCards,
                playerCount: this.gameState.players.length 
            });
        });
        
        // API to get available cards
        this.app.get('/api/available-cards', (req, res) => {
            const allCards = Array.from({ length: 500 }, (_, i) => i + 1);
            const available = allCards.filter(card => 
                !this.gameState.takenCards.includes(card)
            );
            res.json({ available, taken: this.gameState.takenCards });
        });
        
        // API for winning claim
        this.app.post('/api/claim-win', (req, res) => {
            const { playerId, cardNumber, pattern, markedNumbers } = req.body;
            
            // In production, verify the win here
            const isValid = this.verifyWin(cardNumber, pattern, markedNumbers);
            
            if (isValid) {
                // Broadcast win to all
                this.io.emit('winner-declared', {
                    playerId,
                    cardNumber,
                    pattern,
                    timestamp: Date.now()
                });
                
                // Reset game after win
                setTimeout(() => this.resetGame(), 10000);
            }
            
            res.json({ success: isValid });
        });
        
        // Serve index
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
    }
    
    setupSocket() {
        this.io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);
            
            // Send current game state to new connection
            socket.emit('game-state', this.gameState);
            
            // Handle card selection via socket
            socket.on('select-cards', (data) => {
                const { playerId, playerName, cardNumbers } = data;
                
                // Validate and process
                const unavailable = cardNumbers.filter(card => 
                    this.gameState.takenCards.includes(card)
                );
                
                if (unavailable.length === 0) {
                    cardNumbers.forEach(card => {
                        this.gameState.takenCards.push(card);
                    });
                    
                    // Update player
                    const existingPlayer = this.gameState.players.find(p => p.id === playerId);
                    if (existingPlayer) {
                        existingPlayer.selectedCards = cardNumbers;
                    } else {
                        this.gameState.players.push({
                            id: playerId,
                            name: playerName,
                            selectedCards: cardNumbers,
                            joinedAt: Date.now()
                        });
                    }
                    
                    // Broadcast update
                    this.io.emit('cards-updated', {
                        takenCards: this.gameState.takenCards,
                        playerCount: this.gameState.players.length
                    });
                    
                    socket.emit('selection-success', cardNumbers);
                } else {
                    socket.emit('selection-failed', { unavailable });
                }
            });
            
            // Handle number calls during game
            socket.on('call-number', (number) => {
                if (this.gameState.isGameActive) {
                    this.gameState.calledNumbers.push(number);
                    this.io.emit('number-called', number);
                }
            });
            
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }
    
    scheduleGames() {
        // Start a new game every 10 minutes
        setInterval(() => {
            if (!this.gameState.isGameActive) {
                this.startNewGame();
            }
        }, 600000); // 10 minutes
        
        // Start first game
        setTimeout(() => this.startNewGame(), 5000);
    }
    
    startNewGame() {
        console.log('Starting new game...');
        
        // Reset game state
        this.gameState = {
            phase: 'selection',
            currentNumber: null,
            calledNumbers: [],
            takenCards: [],
            players: [],
            selectionTimeLeft: 60,
            isGameActive: false,
            gameStartTime: Date.now() + 60000 // 1 minute from now
        };
        
        // Broadcast new game
        this.io.emit('new-game', this.gameState);
        
        // Start selection countdown
        this.startSelectionCountdown();
    }
    
    startSelectionCountdown() {
        let countdown = 60;
        const countdownInterval = setInterval(() => {
            countdown--;
            this.gameState.selectionTimeLeft = countdown;
            this.io.emit('selection-countdown', countdown);
            
            if (countdown <= 10) {
                this.io.emit('urgent-countdown', countdown);
            }
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.startGame();
            }
        }, 1000);
    }
    
    startGame() {
        console.log('Starting BINGO game...');
        this.gameState.phase = 'playing';
        this.gameState.isGameActive = true;
        
        this.io.emit('game-started', {
            startTime: Date.now(),
            playerCount: this.gameState.players.length
        });
        
        // Start calling numbers every 5 seconds
        setTimeout(() => this.callNextNumber(), 3000); // 3-second READY animation
    }
    
    callNextNumber() {
        if (!this.gameState.isGameActive) return;
        
        // Generate unique number (1-75)
        let number;
        do {
            number = Math.floor(Math.random() * 75) + 1;
        } while (this.gameState.calledNumbers.includes(number));
        
        this.gameState.currentNumber = number;
        this.gameState.calledNumbers.push(number);
        
        // Broadcast to all
        this.io.emit('number-called', {
            number,
            letter: this.getLetterForNumber(number),
            calledNumbers: this.gameState.calledNumbers
        });
        
        // Schedule next call
        setTimeout(() => this.callNextNumber(), 5000);
    }
    
    getLetterForNumber(number) {
        if (number <= 15) return 'B';
        if (number <= 30) return 'I';
        if (number <= 45) return 'N';
        if (number <= 60) return 'G';
        return 'O';
    }
    
    verifyWin(cardNumber, pattern, markedNumbers) {
        // Simplified win verification
        // In production, implement full verification
        return true;
    }
    
    resetGame() {
        this.startNewGame();
    }
    
    start() {
        const PORT = process.env.PORT || 3000;
        this.server.listen(PORT, () => {
            console.log(`Bingo Server running on http://localhost:${PORT}`);
            console.log('Games will start every 10 minutes');
        });
    }
}

// Start the server
const server = new BingoServer();
server.start();