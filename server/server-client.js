// Server client for real-time communication
class ServerClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.eventHandlers = {
            'game-state': [],
            'cards-updated': [],
            'selection-countdown': [],
            'number-called': [],
            'game-started': [],
            'winner-declared': []
        };
    }
    
    connect() {
        try {
            // Use relative URL for socket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            this.socket = io(`${protocol}//${host}`);
            
            this.socket.on('connect', () => {
                console.log('Connected to game server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.isConnected = false;
                this.attemptReconnect();
            });
            
            this.socket.on('game-state', (state) => {
                this.triggerEvent('game-state', state);
            });
            
            this.socket.on('cards-updated', (data) => {
                this.triggerEvent('cards-updated', data);
            });
            
            this.socket.on('selection-countdown', (seconds) => {
                this.triggerEvent('selection-countdown', seconds);
            });
            
            this.socket.on('urgent-countdown', (seconds) => {
                this.triggerEvent('urgent-countdown', seconds);
            });
            
            this.socket.on('game-started', (data) => {
                this.triggerEvent('game-started', data);
            });
            
            this.socket.on('number-called', (numberData) => {
                this.triggerEvent('number-called', numberData);
            });
            
            this.socket.on('winner-declared', (winnerData) => {
                this.triggerEvent('winner-declared', winnerData);
            });
            
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            
            setTimeout(() => {
                this.connect();
            }, 2000 * this.reconnectAttempts); // Exponential backoff
        }
    }
    
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
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
    
    selectCards(playerId, playerName, cardNumbers) {
        if (this.isConnected && this.socket) {
            this.socket.emit('select-cards', {
                playerId,
                playerName,
                cardNumbers
            });
        } else {
            console.warn('Not connected to server');
            // Fallback to local storage
            localStorage.setItem('selectedCards', JSON.stringify(cardNumbers));
        }
    }
    
    claimWin(playerId, cardNumber, pattern, markedNumbers) {
        if (this.isConnected && this.socket) {
            this.socket.emit('claim-win', {
                playerId,
                cardNumber,
                pattern,
                markedNumbers
            });
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Create global instance
const serverClient = new ServerClient();

// Connect when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        serverClient.connect();
    }, 1000);
});