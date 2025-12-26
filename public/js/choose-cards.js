// REAL-TIME SYNCHRONIZED CARD SELECTION
class RealTimeChooseCards {
    constructor() {
        this.rtClient = realTimeClient;
        this.gameState = gameState;
        
        // DOM Elements
        this.elements = {};
        
        // State
        this.selectedCards = [];
        this.takenCards = new Set();
        this.totalCards = 500;
        
        this.init();
    }
    
    async init() {
        await this.setupDOM();
        this.setupEventListeners();
        this.setupRealTimeListeners();
        
        // Register player with server
        this.registerPlayer();
    }
    
    async setupDOM() {
        // Get all DOM elements
        const ids = [
            'cardsGrid', 'card1Number', 'card2Number', 'card1Preview', 'card2Preview',
            'cardsSelected', 'totalCardsTaken', 'activePlayers', 'selectionProgress',
            'selectionTimer', 'randomSelectBtn', 'clearSelectionBtn', 'loadingOverlay',
            'loadingText', 'playerName', 'playerId', 'playerAvatar'
        ];
        
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        
        // Set player info
        if (this.elements.playerName) {
            this.elements.playerName.textContent = this.gameState.playerName;
        }
        if (this.elements.playerId) {
            this.elements.playerId.textContent = this.gameState.playerId;
        }
        if (this.elements.playerAvatar) {
            this.elements.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
        }
        
        // Create card grid
        this.createCardGrid();
    }
    
    registerPlayer() {
        if (!this.rtClient.getConnectionStatus()) {
            console.warn('Waiting for connection...');
            setTimeout(() => this.registerPlayer(), 1000);
            return;
        }
        
        const registered = this.rtClient.registerPlayer(
            this.gameState.playerName,
            this.gameState.playerId
        );
        
        if (!registered) {
            console.error('Failed to register player');
            setTimeout(() => this.registerPlayer(), 2000);
        }
    }
    
    setupRealTimeListeners() {
        // When game state updates from server
        this.rtClient.on('game-state', (state) => {
            console.log('Game state synchronized:', state.phase);
            this.handleGameState(state);
        });
        
        // When card is taken by another player
        this.rtClient.on('card-taken', (data) => {
            console.log('Card taken remotely:', data.cardNumber);
            this.takenCards.add(data.cardNumber);
            this.updateCardGrid();
            this.updateDisplays();
            
            // Remove from selection if it was ours
            if (this.selectedCards.includes(data.cardNumber)) {
                this.removeCardFromSelection(data.cardNumber);
            }
        });
        
        // When card is released
        this.rtClient.on('card-released', (data) => {
            console.log('Card released remotely:', data.cardNumber);
            this.takenCards.delete(data.cardNumber);
            this.updateCardGrid();
            this.updateDisplays();
        });
        
        // When our selection is confirmed
        this.rtClient.on('card-selected', (data) => {
            if (data.success && !this.selectedCards.includes(data.cardNumber)) {
                this.selectedCards.push(data.cardNumber);
                this.updateSelectedCardsDisplay();
            }
        });
        
        // When card is unavailable
        this.rtClient.on('card-unavailable', (data) => {
            console.log('Card unavailable:', data.cardNumber);
            this.removeCardFromSelection(data.cardNumber);
            this.showNotification(`Card #${data.cardNumber} is already taken!`, 'error');
        });
        
        // Selection countdown
        this.rtClient.on('selection-countdown', (data) => {
            this.updateTimerDisplay(data.seconds);
            
            if (data.seconds <= 10) {
                this.elements.selectionTimer.classList.add('animate-shake');
                if ([10, 5, 3, 2, 1].includes(data.seconds)) {
                    this.showNotification(`${data.seconds} seconds left!`, 'warning');
                }
            } else {
                this.elements.selectionTimer.classList.remove('animate-shake');
            }
            
            if (data.seconds <= 0) {
                this.handleSelectionEnd();
            }
        });
        
        // Game phase changes
        this.rtClient.on('game-phase', (data) => {
            this.handleGamePhase(data.phase);
        });
        
        // Ready countdown
        this.rtClient.on('ready-countdown', (seconds) => {
            this.showNotification(`Game starts in ${seconds}...`, 'info');
        });
        
        // Players updated
        this.rtClient.on('players-updated', (data) => {
            if (this.elements.activePlayers) {
                this.elements.activePlayers.textContent = data.playerCount;
            }
        });
        
        // When connected
        this.rtClient.on('connected', () => {
            console.log('Real-time client connected');
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.classList.remove('active');
            }
        });
        
        // When disconnected
        this.rtClient.on('disconnected', () => {
            console.log('Real-time client disconnected');
            this.showNotification('Lost connection to server. Reconnecting...', 'warning');
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.classList.add('active');
            }
        });
    }
    
    handleGameState(state) {
        // Update taken cards from server
        this.takenCards = new Set(state.takenCards || []);
        this.updateCardGrid();
        this.updateDisplays();
        
        // Update timer
        if (state.selectionTimeLeft !== undefined) {
            this.updateTimerDisplay(state.selectionTimeLeft);
        }
        
        // Handle current phase
        this.handleGamePhase(state.phase);
    }
    
    handleGamePhase(phase) {
        console.log('Game phase changed to:', phase);
        
        switch(phase) {
            case 'selection':
                // Normal operation
                break;
                
            case 'ready':
                this.handleReadyPhase();
                break;
                
            case 'playing':
                this.handleGameStart();
                break;
                
            case 'ended':
                // Game ended, will restart automatically
                break;
        }
    }
    
    handleReadyPhase() {
        this.showNotification('Game starting in 3 seconds...', 'info');
        
        // Auto-select random cards if none selected
        if (this.selectedCards.length === 0) {
            this.randomSelectCards();
        }
    }
    
    handleGameStart() {
        // Save selected cards
        this.gameState.selectedCards = [...this.selectedCards];
        this.gameState.saveToSession();
        
        // Redirect to game page
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1000);
    }
    
    handleSelectionEnd() {
        if (this.selectedCards.length === 0) {
            this.randomSelectCards();
        }
        this.showNotification('Selection time ended!', 'warning');
    }
    
    createCardGrid() {
        if (!this.elements.cardsGrid) return;
        
        this.elements.cardsGrid.innerHTML = '';
        
        for (let i = 1; i <= this.totalCards; i++) {
            const card = document.createElement('div');
            card.className = 'card-number';
            card.textContent = i;
            card.dataset.cardNumber = i;
            
            if (this.takenCards.has(i)) {
                card.classList.add('taken');
                card.title = 'Taken by another player';
            } else {
                card.addEventListener('click', () => this.selectCard(i));
            }
            
            if (this.selectedCards.includes(i)) {
                card.classList.add('selected');
            }
            
            this.elements.cardsGrid.appendChild(card);
        }
    }
    
    updateCardGrid() {
        const cards = this.elements.cardsGrid?.querySelectorAll('.card-number');
        if (!cards) return;
        
        cards.forEach(card => {
            const cardNum = parseInt(card.dataset.cardNumber);
            
            if (this.takenCards.has(cardNum)) {
                card.classList.add('taken');
                card.title = 'Taken by another player';
                card.onclick = null;
            } else {
                card.classList.remove('taken');
                card.title = 'Click to select';
                card.onclick = () => this.selectCard(cardNum);
            }
            
            if (this.selectedCards.includes(cardNum)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }
    
    selectCard(cardNumber) {
        // Check if already selected
        if (this.selectedCards.includes(cardNumber)) {
            this.deselectCard(cardNumber);
            return;
        }
        
        // Check max cards
        if (this.selectedCards.length >= 2) {
            this.showNotification('You can only select 2 cards', 'warning');
            return;
        }
        
        // Send to server
        if (this.rtClient.getConnectionStatus()) {
            this.rtClient.selectCard(cardNumber);
            
            // Optimistically add to selection
            this.selectedCards.push(cardNumber);
            this.updateSelectedCardsDisplay();
            this.updateDisplays();
            
            this.showNotification(`Selected card #${cardNumber}`, 'success');
        } else {
            this.showNotification('Not connected to server', 'error');
        }
    }
    
    deselectCard(cardNumber) {
        if (this.rtClient.getConnectionStatus()) {
            this.rtClient.deselectCard(cardNumber);
        }
        
        this.removeCardFromSelection(cardNumber);
        this.showNotification(`Deselected card #${cardNumber}`, 'info');
    }
    
    removeCardFromSelection(cardNumber) {
        const index = this.selectedCards.indexOf(cardNumber);
        if (index > -1) {
            this.selectedCards.splice(index, 1);
            this.updateSelectedCardsDisplay();
            this.updateDisplays();
        }
    }
    
    updateSelectedCardsDisplay() {
        if (this.elements.card1Number) {
            this.elements.card1Number.textContent = this.selectedCards[0] || '--';
        }
        if (this.elements.card2Number) {
            this.elements.card2Number.textContent = this.selectedCards[1] || '--';
        }
        
        // Update previews
        this.updateCardPreview(1, this.selectedCards[0]);
        this.updateCardPreview(2, this.selectedCards[1]);
        
        // Update progress
        if (this.elements.selectionProgress) {
            const progress = (this.selectedCards.length / 2) * 100;
            this.elements.selectionProgress.style.width = `${progress}%`;
        }
        
        // Update counter
        if (this.elements.cardsSelected) {
            this.elements.cardsSelected.textContent = this.selectedCards.length;
        }
    }
    
    updateCardPreview(cardIndex, cardNumber) {
        const previewElement = cardIndex === 1 ? 
            this.elements.card1Preview : this.elements.card2Preview;
        if (!previewElement || !cardNumber) return;
        
        const cardNumbers = BingoUtils.generateBingoCardNumbers(cardNumber);
        previewElement.innerHTML = '';
        
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            
            const row = Math.floor(i / 5);
            const col = i % 5;
            
            if (row === 2 && col === 2) {
                cell.textContent = 'FREE';
                cell.classList.add('free');
            } else {
                const numberIndex = col * 5 + row;
                cell.textContent = cardNumbers[numberIndex] || '';
            }
            
            previewElement.appendChild(cell);
        }
    }
    
    updateDisplays() {
        if (this.elements.totalCardsTaken) {
            this.elements.totalCardsTaken.textContent = this.takenCards.size;
        }
    }
    
    updateTimerDisplay(seconds) {
        if (!this.elements.selectionTimer) return;
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.elements.selectionTimer.textContent = 
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Color coding
        if (seconds <= 10) {
            this.elements.selectionTimer.style.color = '#ff4b4b';
        } else if (seconds <= 30) {
            this.elements.selectionTimer.style.color = '#ff9e00';
        } else {
            this.elements.selectionTimer.style.color = '#00b4d8';
        }
    }
    
    randomSelectCards() {
        const availableCards = [];
        for (let i = 1; i <= this.totalCards; i++) {
            if (!this.takenCards.has(i)) {
                availableCards.push(i);
            }
        }
        
        if (availableCards.length === 0) {
            this.showNotification('No cards available!', 'error');
            return;
        }
        
        // Shuffle
        for (let i = availableCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
        }
        
        // Select cards
        const toSelect = Math.min(2, availableCards.length);
        for (let i = 0; i < toSelect; i++) {
            if (this.rtClient.getConnectionStatus()) {
                this.rtClient.selectCard(availableCards[i]);
            }
            this.selectedCards.push(availableCards[i]);
        }
        
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
        
        this.showNotification(`Randomly selected: ${this.selectedCards.join(', ')}`, 'success');
    }
    
    setupEventListeners() {
        if (this.elements.randomSelectBtn) {
            this.elements.randomSelectBtn.addEventListener('click', () => this.randomSelectCards());
        }
        
        if (this.elements.clearSelectionBtn) {
            this.elements.clearSelectionBtn.addEventListener('click', () => {
                this.selectedCards.forEach(card => this.deselectCard(card));
            });
        }
    }
    
    showNotification(message, type = 'info') {
        BingoUtils.showNotification(message, type);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new RealTimeChooseCards();
});