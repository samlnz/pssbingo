// Global server client
class ServerClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.eventHandlers = {};
        
        // Game state from server
        this.serverGameState = {
            phase: 'waiting',
            selectionTimeLeft: 60,
            currentNumber: null,
            calledNumbers: [],
            takenCards: [],
            players: {}
        };
        
        this.connect();
    }
    
    connect() {
        // Auto-detect server URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';
        const port = window.location.port || 3000;
        const serverUrl = `${protocol}//${host}:${port}`;
        
        console.log('Connecting to server:', serverUrl);
        
        try {
            this.socket = io(serverUrl, {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to connect to server:', error);
            setTimeout(() => this.connect(), 3000);
        }
    }
    
    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('✅ Connected to game server');
            this.connected = true;
            this.triggerEvent('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.connected = false;
            this.triggerEvent('disconnected');
        });
        
        this.socket.on('game-state', (state) => {
            console.log('📊 Game state update:', state.phase);
            this.serverGameState = state;
            this.triggerEvent('game-state', state);
        });
        
        this.socket.on('selection-countdown', (seconds) => {
            this.triggerEvent('selection-countdown', seconds);
        });
        
        this.socket.on('urgent-warning', (seconds) => {
            this.triggerEvent('urgent-warning', seconds);
        });
        
        this.socket.on('game-phase-change', (phase) => {
            console.log('🔄 Game phase change:', phase);
            this.triggerEvent('game-phase-change', phase);
        });
        
        this.socket.on('number-called', (numberData) => {
            this.triggerEvent('number-called', numberData);
        });
        
        this.socket.on('card-taken', (data) => {
            this.triggerEvent('card-taken', data);
        });
        
        this.socket.on('card-released', (data) => {
            this.triggerEvent('card-released', data);
        });
        
        this.socket.on('card-selected', (data) => {
            this.triggerEvent('card-selected', data);
        });
        
        this.socket.on('card-unavailable', (cardNumber) => {
            this.triggerEvent('card-unavailable', cardNumber);
        });
        
        this.socket.on('winner-declared', (winner) => {
            this.triggerEvent('winner-declared', winner);
        });
    }
    
    // Send card selection to server
    selectCard(cardNumber) {
        if (!this.connected) {
            console.warn('Not connected to server');
            return false;
        }
        
        this.socket.emit('select-card', {
            cardNumber: cardNumber,
            playerId: gameState.playerId,
            playerName: gameState.playerName
        });
        
        return true;
    }
    
    // Clear card selection
    clearSelection(cardNumber) {
        if (!this.connected) return false;
        
        this.socket.emit('clear-selection', {
            cardNumber: cardNumber,
            playerId: gameState.playerId
        });
        
        return true;
    }
    
    // Claim win
    claimWin(cardNumber, pattern) {
        if (!this.connected) return false;
        
        this.socket.emit('claim-win', {
            playerId: gameState.playerId,
            playerName: gameState.playerName,
            cardNumber: cardNumber,
            pattern: pattern,
            timestamp: Date.now()
        });
        
        return true;
    }
    
    // Event handling
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }
    
    triggerEvent(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }
    
    isConnected() {
        return this.connected;
    }
    
    getTakenCards() {
        return this.serverGameState.takenCards || [];
    }
    
    getGamePhase() {
        return this.serverGameState.phase || 'waiting';
    }
    
    getSelectionTime() {
        return this.serverGameState.selectionTimeLeft || 60;
    }
}

// Create global instance
const serverClient = new ServerClient();