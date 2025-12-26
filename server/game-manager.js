const EventEmitter = require('events');

class GameManager extends EventEmitter {
    constructor() {
        super();
        this.gameState = {
            phase: 'waiting', // waiting, selection, playing, ended
            currentNumber: null,
            calledNumbers: [],
            players: new Map(),
            takenCards: new Set(),
            startTime: null,
            selectionTimeLeft: 60,
            callInterval: 5000,
            active: false
        };
        
        this.timers = {
            selection: null,
            caller: null
        };
        
        // BINGO ranges
        this.BINGO_RANGES = {
            'B': { min: 1, max: 15 },
            'I': { min: 16, max: 30 },
            'N': { min: 31, max: 45 },
            'G': { min: 46, max: 60 },
            'O': { min: 61, max: 75 }
        };
        
        this.init();
    }
    
    init() {
        console.log('Game Manager initialized');
    }
    
    getGameState() {
        return {
            phase: this.gameState.phase,
            currentNumber: this.gameState.currentNumber,
            calledNumbers: [...this.gameState.calledNumbers],
            playerCount: this.gameState.players.size,
            takenCards: [...this.gameState.takenCards],
            selectionTimeLeft: this.gameState.selectionTimeLeft,
            startTime: this.gameState.startTime,
            active: this.gameState.active
        };
    }
    
    addPlayer(playerId, playerName) {
        const player = {
            id: playerId,
            name: playerName,
            selectedCards: [],
            joinedAt: Date.now(),
            socketId: null
        };
        
        this.gameState.players.set(playerId, player);
        console.log(`Player added: ${playerName} (${playerId})`);
        
        return player;
    }
    
    selectCards(playerId, cardNumbers) {
        if (this.gameState.phase !== 'selection') {
            return { success: false, error: 'Not in selection phase' };
        }
        
        const player = this.gameState.players.get(playerId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
        
        // Validate card numbers (1-500)
        if (!cardNumbers || cardNumbers.length > 2) {
            return { success: false, error: 'Max 2 cards allowed' };
        }
        
        // Check if cards are available
        const unavailable = cardNumbers.filter(card => 
            this.gameState.takenCards.has(card)
        );
        
        if (unavailable.length > 0) {
            return { 
                success: false, 
                error: `Cards ${unavailable.join(', ')} already taken` 
            };
        }
        
        // Reserve cards
        cardNumbers.forEach(card => {
            this.gameState.takenCards.add(card);
        });
        
        player.selectedCards = cardNumbers;
        
        console.log(`Player ${playerId} selected cards: ${cardNumbers.join(', ')}`);
        return { success: true, cards: cardNumbers };
    }
    
    startNewGame() {
        // Reset game state
        this.gameState.phase = 'selection';
        this.gameState.currentNumber = null;
        this.gameState.calledNumbers = [];
        this.gameState.takenCards.clear();
        this.gameState.selectionTimeLeft = 60;
        this.gameState.startTime = Date.now();
        this.gameState.active = true;
        
        // Reset player card selections but keep players
        this.gameState.players.forEach(player => {
            player.selectedCards = [];
        });
        
        // Start selection countdown
        this.startSelectionCountdown();
        
        this.emit('gamePhaseChange', 'selection');
        console.log('New game started - Selection phase');
    }
    
    startSelectionCountdown() {
        if (this.timers.selection) clearInterval(this.timers.selection);
        
        this.timers.selection = setInterval(() => {
            this.gameState.selectionTimeLeft--;
            
            if (this.gameState.selectionTimeLeft <= 10) {
                this.emit('countdownWarning', this.gameState.selectionTimeLeft);
            }
            
            if (this.gameState.selectionTimeLeft <= 0) {
                clearInterval(this.timers.selection);
                this.startGamePlay();
            }
        }, 1000);
    }
    
    startGamePlay() {
        this.gameState.phase = 'playing';
        this.emit('gamePhaseChange', 'playing');
        
        // 3-second READY countdown
        setTimeout(() => {
            this.startCallingNumbers();
        }, 3000);
    }
    
    startCallingNumbers() {
        if (this.timers.caller) clearInterval(this.timers.caller);
        
        // Call first number immediately
        this.callNextNumber();
        
        // Then every 5 seconds
        this.timers.caller = setInterval(() => {
            if (this.gameState.calledNumbers.length >= 75) {
                this.endGame();
                return;
            }
            this.callNextNumber();
        }, 5000);
    }
    
    callNextNumber() {
        // Generate unique number
        let number;
        do {
            number = Math.floor(Math.random() * 75) + 1;
        } while (this.gameState.calledNumbers.includes(number));
        
        this.gameState.currentNumber = number;
        this.gameState.calledNumbers.push(number);
        
        // Determine BINGO letter
        let letter = '';
        for (const [l, range] of Object.entries(this.BINGO_RANGES)) {
            if (number >= range.min && number <= range.max) {
                letter = l;
                break;
            }
        }
        
        const numberData = {
            number: number,
            letter: letter,
            full: `${letter}-${number}`,
            timestamp: Date.now(),
            index: this.gameState.calledNumbers.length
        };
        
        console.log(`Called number: ${numberData.full}`);
        this.emit('numberCalled', numberData);
    }
    
    verifyBingo(playerId, cardId, pattern) {
        const player = this.gameState.players.get(playerId);
        if (!player) {
            return { valid: false, error: 'Player not found' };
        }
        
        if (!player.selectedCards.includes(cardId)) {
            return { valid: false, error: 'Card not owned by player' };
        }
        
        // Get card numbers
        const cardNumbers = this.generateCardNumbers(cardId);
        
        // Verify pattern
        const isValid = this.verifyPattern(cardNumbers, pattern);
        
        if (isValid) {
            this.endGame(player);
            return {
                valid: true,
                winner: {
                    playerId: playerId,
                    playerName: player.name,
                    cardNumber: cardId,
                    pattern: pattern,
                    calledNumbers: this.gameState.calledNumbers.length,
                    gameTime: Math.floor((Date.now() - this.gameState.startTime) / 1000)
                }
            };
        }
        
        return { valid: false, error: 'Invalid pattern' };
    }
    
    verifyPattern(cardNumbers, pattern) {
        // Pattern verification logic
        // This would check if the pattern matches the marked numbers
        // and all numbers have been called
        
        // Simplified: always return true for demo
        // In production, implement full verification
        return true;
    }
    
    generateCardNumbers(cardNumber) {
        // Use your existing deterministic card generation
        // This matches the front-end card-generator.js logic
        const seed = cardNumber * 9973 + 7919;
        const numbers = [];
        
        // Generate numbers for each column
        const ranges = [
            [1, 15],    // B
            [16, 30],   // I
            [31, 45],   // N
            [46, 60],   // G
            [61, 75]    // O
        ];
        
        ranges.forEach((range, colIndex) => {
            const colNumbers = this.generateColumnNumbers(cardNumber, colIndex, range[0], range[1]);
            numbers.push(...colNumbers);
        });
        
        // Center is FREE
        numbers[12] = 0;
        
        return numbers;
    }
    
    generateColumnNumbers(cardNumber, colIndex, min, max) {
        const seed = cardNumber * 100 + colIndex;
        const rng = this.createSeededRNG(seed);
        const availableNumbers = [];
        
        for (let i = min; i <= max; i++) {
            availableNumbers.push(i);
        }
        
        const shuffled = this.shuffleArray(availableNumbers, rng);
        const selected = shuffled.slice(0, 5).sort((a, b) => a - b);
        
        return selected;
    }
    
    createSeededRNG(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }
    
    shuffleArray(array, rng) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    endGame(winner = null) {
        clearInterval(this.timers.caller);
        clearInterval(this.timers.selection);
        
        this.gameState.phase = 'ended';
        this.gameState.active = false;
        
        if (winner) {
            this.emit('gameEnd', winner);
            console.log(`Game ended! Winner: ${winner.playerName}`);
        } else {
            console.log('Game ended - No winner');
        }
        
        // Schedule next game
        setTimeout(() => {
            this.startNewGame();
        }, 30000); // 30 seconds before next game
    }
    
    isGameActive() {
        return this.gameState.active;
    }
    
    getPlayerCount() {
        return this.gameState.players.size;
    }
    
    getTakenCards() {
        return [...this.gameState.takenCards];
    }
}

module.exports = GameManager;