// Server Client - Fixed for synchronization
class ServerClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        
        this.eventHandlers = {};
        this.gameState = {};
        
        this.connect();
    }
    
    connect() {
        try {
            // Connect to server
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to game server');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.triggerEvent('connected');
            });
            
            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.connected = false;
                this.triggerEvent('disconnected');
                this.attemptReconnect();
            });
            
            this.socket.on('game-state', (state) => {
                console.log('📊 Received game state:', state.phase);
                this.gameState = state;
                this.triggerEvent('game-state', state);
            });
            
            this.socket.on('selection-countdown', (data) => {
                console.log('⏰ Selection countdown:', data.seconds);
                this.triggerEvent('selection-countdown', data);
            });
            
            this.socket.on('game-phase-change', (phase) => {
                console.log('🔄 Game phase changed to:', phase);
                this.triggerEvent('game-phase-change', phase);
            });
            
            this.socket.on('ready-countdown', (seconds) => {
                console.log('🎮 Ready countdown:', seconds);
                this.triggerEvent('ready-countdown', seconds);
            });
            
            this.socket.on('number-called', (numberData) => {
                console.log('🔔 Number called:', numberData.full);
                this.triggerEvent('number-called', numberData);
            });
            
            this.socket.on('card-taken', (data) => {
                console.log('🎴 Card taken:', data.cardNumber);
                this.triggerEvent('card-taken', data);
            });
            
            this.socket.on('card-released', (data) => {
                console.log('🎴 Card released:', data.cardNumber);
                this.triggerEvent('card-released', data);
            });
            
            this.socket.on('card-selected', (data) => {
                console.log('✅ Card selected:', data.cardNumber);
                this.triggerEvent('card-selected', data);
            });
            
            this.socket.on('card-unavailable', (cardNumber) => {
                console.log('❌ Card unavailable:', cardNumber);
                this.triggerEvent('card-unavailable', cardNumber);
            });
            
            this.socket.on('winner-declared', (winner) => {
                console.log('🏆 Winner declared:', winner.playerName);
                this.triggerEvent('winner-declared', winner);
            });
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < 5) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectAttempts * 2000);
        }
    }
    
    selectCard(cardNumber) {
        if (!this.connected) {
            console.warn('Not connected to server');
            return false;
        }
        
        const data = {
            cardNumber: cardNumber,
            playerId: gameState.playerId,
            playerName: gameState.playerName
        };
        
        console.log('Sending card selection:', data);
        this.socket.emit('select-card', data);
        return true;
    }
    
    deselectCard(cardNumber) {
        if (!this.connected) return false;
        
        this.socket.emit('deselect-card', {
            cardNumber: cardNumber,
            playerId: gameState.playerId
        });
        
        return true;
    }
    
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
    
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
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
        return this.gameState.takenCards || [];
    }
    
    getGamePhase() {
        return this.gameState.phase || 'waiting';
    }
    
    getSelectionTime() {
        return this.gameState.selectionTimeLeft || 60;
    }
}

// Create global instance
const serverClient = new ServerClient();