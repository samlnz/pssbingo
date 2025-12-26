// Real-time Game Engine - Server Controlled Synchronization
class RealTimeGameEngine {
    constructor() {
        this.resetGameState();
    }
    
    resetGameState() {
        this.gameState = {
            phase: 'selection', // selection, playing, ended
            selectionTimeLeft: 60,
            currentNumber: null,
            calledNumbers: [],
            takenCards: [],
            players: new Map(),
            gameActive: false,
            lastNumberTime: null,
            gameStartTime: null,
            nextNumberTime: null,
            gameTimer: null,
            numberInterval: null
        };
    }
    
    initializeNewGame() {
        console.log('🎮 Initializing new synchronized game session');
        
        this.resetGameState();
        
        // Start selection phase
        this.startSelectionPhase();
        
        return this.gameState;
    }
    
    startSelectionPhase() {
        console.log('⏳ Starting 60-second card selection phase');
        this.gameState.phase = 'selection';
        this.gameState.selectionTimeLeft = 60;
        
        // Start selection countdown
        this.gameState.selectionTimer = setInterval(() => {
            this.gameState.selectionTimeLeft--;
            
            if (this.gameState.selectionTimeLeft <= 0) {
                clearInterval(this.gameState.selectionTimer);
                this.startGamePhase();
            }
        }, 1000);
    }
    
    startGamePhase() {
        console.log('🎲 Game phase starting...');
        this.gameState.phase = 'playing';
        this.gameState.gameActive = true;
        
        // Wait 3 seconds before first number (SERVER CONTROLLED)
        setTimeout(() => {
            this.gameState.gameStartTime = Date.now();
            console.log('🔔 Starting number calling sequence');
            this.startNumberCalling();
        }, 3000);
    }
    
    startNumberCalling() {
        console.log('📞 Starting number calling (every 5 seconds)');
        
        // First call immediately after 3-second wait
        this.callNextNumber();
        
        // Subsequent calls every 5 seconds
        this.gameState.numberInterval = setInterval(() => {
            if (this.gameState.calledNumbers.length >= 75) {
                this.endGame();
                return;
            }
            this.callNextNumber();
        }, 5000);
    }
    
    callNextNumber() {
        // Generate unique number 1-75
        let number;
        do {
            number = Math.floor(Math.random() * 75) + 1;
        } while (this.gameState.calledNumbers.includes(number));
        
        const letter = this.getBingoLetter(number);
        
        this.gameState.currentNumber = number;
        this.gameState.calledNumbers.push(number);
        this.gameState.lastNumberTime = Date.now();
        
        console.log(`🔔 Called: ${letter}-${number}`);
        
        return {
            number: number,
            letter: letter,
            full: `${letter}-${number}`,
            timestamp: Date.now(),
            totalCalled: this.gameState.calledNumbers.length
        };
    }
    
    getBingoLetter(number) {
        if (number <= 15) return 'B';
        if (number <= 30) return 'I';
        if (number <= 45) return 'N';
        if (number <= 60) return 'G';
        return 'O';
    }
    
    // Player management methods
    addPlayer(socketId, playerData) {
        const player = {
            id: playerData.playerId || socketId,
            name: playerData.playerName || 'Player',
            socketId: socketId,
            selectedCards: [],
            connectedAt: Date.now(),
            lastSeen: Date.now()
        };
        
        this.gameState.players.set(socketId, player);
        console.log(`👤 Player joined: ${player.name}`);
        
        return player;
    }
    
    removePlayer(socketId) {
        const player = this.gameState.players.get(socketId);
        if (player) {
            console.log(`👤 Player left: ${player.name}`);
            this.gameState.players.delete(socketId);
        }
    }
    
    selectCard(socketId, cardNumber) {
        const player = this.gameState.players.get(socketId);
        if (!player) return { success: false, error: 'Player not found' };
        
        if (this.gameState.takenCards.includes(cardNumber)) {
            return { success: false, error: 'Card already taken' };
        }
        
        if (player.selectedCards.length >= 2) {
            return { success: false, error: 'Maximum 2 cards per player' };
        }
        
        this.gameState.takenCards.push(cardNumber);
        player.selectedCards.push(cardNumber);
        
        console.log(`🎴 Card ${cardNumber} selected by ${player.name}`);
        
        return { 
            success: true, 
            cardNumber,
            playerId: player.id,
            takenCards: [...this.gameState.takenCards]
        };
    }
    
    releaseCard(cardNumber) {
        const index = this.gameState.takenCards.indexOf(cardNumber);
        if (index > -1) {
            this.gameState.takenCards.splice(index, 1);
            
            this.gameState.players.forEach(player => {
                const cardIndex = player.selectedCards.indexOf(cardNumber);
                if (cardIndex > -1) {
                    player.selectedCards.splice(cardIndex, 1);
                }
            });
            
            return true;
        }
        return false;
    }
    
    verifyWinClaim(playerData, cardNumber, pattern) {
        const player = Array.from(this.gameState.players.values())
            .find(p => p.id === playerData.playerId);
        
        if (!player) return { valid: false, error: 'Player not found' };
        
        if (!player.selectedCards.includes(cardNumber)) {
            return { valid: false, error: 'Card not owned by player' };
        }
        
        const winner = {
            playerId: player.id,
            playerName: player.name,
            cardNumber: cardNumber,
            pattern: pattern,
            timestamp: Date.now(),
            calledNumbers: this.gameState.calledNumbers.length,
            gameDuration: Math.floor((Date.now() - this.gameState.gameStartTime) / 1000)
        };
        
        return { valid: true, winner };
    }
    
    endGame(winner = null) {
        console.log('🏁 Game ending');
        
        if (this.gameState.selectionTimer) {
            clearInterval(this.gameState.selectionTimer);
        }
        
        if (this.gameState.numberInterval) {
            clearInterval(this.gameState.numberInterval);
        }
        
        this.gameState.phase = 'ended';
        this.gameState.gameActive = false;
        
        if (winner) {
            console.log(`🏆 Winner: ${winner.playerName}`);
        }
        
        // Restart game in 30 seconds
        setTimeout(() => {
            console.log('🔄 Restarting game');
            this.initializeNewGame();
        }, 30000);
        
        return winner;
    }
    
    getGameState() {
        return {
            phase: this.gameState.phase,
            selectionTimeLeft: this.gameState.selectionTimeLeft,
            currentNumber: this.gameState.currentNumber,
            calledNumbers: [...this.gameState.calledNumbers],
            takenCards: [...this.gameState.takenCards],
            gameActive: this.gameState.gameActive,
            gameStartTime: this.gameState.gameStartTime,
            lastNumberTime: this.gameState.lastNumberTime,
            playerCount: this.gameState.players.size,
            players: Array.from(this.gameState.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                selectedCards: p.selectedCards
            }))
        };
    }
}

module.exports = RealTimeGameEngine;