// CHOOSE-CARDS.JS - Fully synchronized with server
class ChooseCardsPage {
    constructor() {
        this.gameState = gameState;
        this.server = serverClient;
        
        // DOM elements
        this.cardsGrid = document.getElementById('cardsGrid');
        this.card1Number = document.getElementById('card1Number');
        this.card2Number = document.getElementById('card2Number');
        this.card1Preview = document.getElementById('card1Preview');
        this.card2Preview = document.getElementById('card2Preview');
        this.cardsSelected = document.getElementById('cardsSelected');
        this.totalCardsTaken = document.getElementById('totalCardsTaken');
        this.activePlayers = document.getElementById('activePlayers');
        this.selectionProgress = document.getElementById('selectionProgress');
        this.selectionTimer = document.getElementById('selectionTimer');
        this.randomSelectBtn = document.getElementById('randomSelectBtn');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.playerName = document.getElementById('playerName');
        this.playerId = document.getElementById('playerId');
        this.playerAvatar = document.getElementById('playerAvatar');
        
        // Game state
        this.takenCards = new Set();
        this.selectedCards = [];
        this.totalCards = 500;
        this.maxCards = 2;
        this.localTimer = null;
        
        this.init();
    }
    
    init() {
        this.setupUserInfo();
        this.setupServerListeners();
        this.createCardGrid();
        this.setupEventListeners();
        
        // Show loading while connecting
        if (!this.server.isConnected()) {
            this.loadingOverlay.classList.add('active');
            this.loadingText.textContent = 'Connecting to game server...';
        }
    }
    
    setupUserInfo() {
        this.playerName.textContent = this.gameState.playerName;
        this.playerId.textContent = this.gameState.playerId;
        this.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
        
        // Generate random avatar color
        const colors = ['#00b4d8', '#0077b6', '#0096c7', '#005f8a', '#03045e'];
        this.playerAvatar.style.background = colors[Math.floor(Math.random() * colors.length)];
    }
    
    setupServerListeners() {
        // When connected to server
        this.server.on('connected', () => {
            console.log('Connected to server');
            this.loadingOverlay.classList.remove('active');
            
            // Load initial game state
            this.takenCards = new Set(this.server.getTakenCards());
            this.updateCardGrid();
            this.updateDisplays();
        });
        
        // When disconnected
        this.server.on('disconnected', () => {
            console.warn('Disconnected from server');
            BingoUtils.showNotification('Lost connection to server. Trying to reconnect...', 'warning');
            this.loadingOverlay.classList.add('active');
            this.loadingText.textContent = 'Reconnecting...';
        });
        
        // Game state updates
        this.server.on('game-state', (state) => {
            console.log('Game state:', state.phase);
            this.handleGamePhase(state.phase);
        });
        
        // Selection countdown
        this.server.on('selection-countdown', (seconds) => {
            this.updateTimerDisplay(seconds);
            
            if (seconds <= 0) {
                this.handleSelectionEnd();
            }
        });
        
        // Urgent warning
        this.server.on('urgent-warning', (seconds) => {
            this.handleUrgentCountdown(seconds);
        });
        
        // Card taken by another player
        this.server.on('card-taken', (data) => {
            console.log('Card taken:', data.cardNumber);
            this.takenCards.add(data.cardNumber);
            this.updateCardGrid();
            this.totalCardsTaken.textContent = this.takenCards.size;
            
            // If this card was selected by current player, deselect it
            if (this.selectedCards.includes(data.cardNumber) && data.playerId !== this.gameState.playerId) {
                const index = this.selectedCards.indexOf(data.cardNumber);
                if (index > -1) {
                    this.selectedCards.splice(index, 1);
                    this.updateSelectedCardsDisplay();
                }
            }
        });
        
        // Card released
        this.server.on('card-released', (data) => {
            console.log('Card released:', data.cardNumber);
            this.takenCards.delete(data.cardNumber);
            this.updateCardGrid();
            this.totalCardsTaken.textContent = this.takenCards.size;
        });
        
        // Card selection confirmed
        this.server.on('card-selected', (data) => {
            if (data.success) {
                console.log('Card selection confirmed:', data.cardNumber);
                if (!this.selectedCards.includes(data.cardNumber)) {
                    this.selectedCards.push(data.cardNumber);
                    this.updateSelectedCardsDisplay();
                }
            }
        });
        
        // Card unavailable
        this.server.on('card-unavailable', (cardNumber) => {
            BingoUtils.showNotification(`Card #${cardNumber} is already taken!`, 'error');
            this.removeCardFromSelection(cardNumber);
        });
        
        // Game phase change
        this.server.on('game-phase-change', (phase) => {
            this.handleGamePhase(phase);
        });
    }
    
    handleGamePhase(phase) {
        console.log('Phase changed to:', phase);
        
        switch(phase) {
            case 'selection':
                // Game is in selection phase
                break;
                
            case 'ready':
                // 3-second READY animation starting
                this.handleReadyPhase();
                break;
                
            case 'playing':
                // Game has started, redirect to game page
                this.handleGameStart();
                break;
                
            case 'ended':
                // Game ended, show winner
                break;
        }
    }
    
    handleReadyPhase() {
        // Show notification
        BingoUtils.showNotification('Game starting in 3 seconds...', 'info');
        
        // Auto-select cards if none selected
        if (this.selectedCards.length === 0) {
            this.randomSelectCards();
        }
    }
    
    handleGameStart() {
        // Save selected cards to game state
        this.gameState.selectedCards = [...this.selectedCards];
        this.gameState.saveToSession();
        
        // Redirect to game page
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1000);
    }
    
    handleSelectionEnd() {
        // Auto-select cards if none selected
        if (this.selectedCards.length === 0) {
            this.randomSelectCards();
        }
        
        // Show notification
        BingoUtils.showNotification('Card selection ended! Game starting soon...', 'info');
    }
    
    createCardGrid() {
        this.cardsGrid.innerHTML = '';
        
        for (let i = 1; i <= this.totalCards; i++) {
            const cardElement = document.createElement('div');
            cardElement.className = 'card-number';
            cardElement.textContent = i;
            cardElement.dataset.cardNumber = i;
            
            if (this.takenCards.has(i)) {
                cardElement.classList.add('taken');
                cardElement.title = 'Taken by another player';
            } else {
                cardElement.addEventListener('click', () => this.selectCard(i));
            }
            
            if (this.selectedCards.includes(i)) {
                cardElement.classList.add('selected');
            }
            
            this.cardsGrid.appendChild(cardElement);
        }
        
        this.updateDisplays();
    }
    
    updateCardGrid() {
        document.querySelectorAll('.card-number').forEach(card => {
            const cardNum = parseInt(card.dataset.cardNumber);
            
            // Update taken status
            if (this.takenCards.has(cardNum)) {
                card.classList.add('taken');
                card.title = 'Taken by another player';
                card.onclick = null;
            } else {
                card.classList.remove('taken');
                card.title = 'Click to select';
                card.onclick = () => this.selectCard(cardNum);
            }
            
            // Update selected status
            if (this.selectedCards.includes(cardNum)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }
    
    selectCard(cardNumber) {
        console.log('Selecting card:', cardNumber);
        
        // Check if already selected
        if (this.selectedCards.includes(cardNumber)) {
            // Deselect card
            this.deselectCard(cardNumber);
            return;
        }
        
        // Check max cards
        if (this.selectedCards.length >= this.maxCards) {
            BingoUtils.showNotification(`You can only select ${this.maxCards} cards`, 'warning');
            return;
        }
        
        // Check if card is available
        if (this.takenCards.has(cardNumber)) {
            BingoUtils.showNotification(`Card #${cardNumber} is already taken`, 'error');
            return;
        }
        
        // Send selection to server
        if (this.server.isConnected()) {
            const success = this.server.selectCard(cardNumber);
            if (success) {
                this.selectedCards.push(cardNumber);
                this.updateSelectedCardsDisplay();
                this.updateDisplays();
                BingoUtils.showNotification(`Card #${cardNumber} selected!`, 'success');
            }
        } else {
            // Fallback: local selection
            this.selectedCards.push(cardNumber);
            this.updateSelectedCardsDisplay();
            this.updateDisplays();
            BingoUtils.showNotification(`Card #${cardNumber} selected (offline mode)`, 'info');
        }
    }
    
    deselectCard(cardNumber) {
        console.log('Deselecting card:', cardNumber);
        
        const index = this.selectedCards.indexOf(cardNumber);
        if (index > -1) {
            this.selectedCards.splice(index, 1);
            
            // Release card on server
            if (this.server.isConnected()) {
                this.server.clearSelection(cardNumber);
            }
            
            this.updateSelectedCardsDisplay();
            this.updateDisplays();
            BingoUtils.showNotification(`Card #${cardNumber} deselected`, 'info');
        }
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
        // Update card numbers
        this.card1Number.textContent = this.selectedCards[0] || '--';
        this.card2Number.textContent = this.selectedCards[1] || '--';
        
        // Update previews
        this.updateCardPreview(1, this.selectedCards[0]);
        this.updateCardPreview(2, this.selectedCards[1]);
        
        // Update progress bar
        const progress = (this.selectedCards.length / this.maxCards) * 100;
        this.selectionProgress.style.width = `${progress}%`;
        
        // Update counters
        this.cardsSelected.textContent = this.selectedCards.length;
    }
    
    updateCardPreview(cardIndex, cardNumber) {
        const previewElement = cardIndex === 1 ? this.card1Preview : this.card2Preview;
        
        if (!cardNumber) {
            previewElement.innerHTML = '';
            for (let i = 0; i < 25; i++) {
                const cell = document.createElement('div');
                cell.className = 'preview-cell';
                cell.textContent = '';
                previewElement.appendChild(cell);
            }
            return;
        }
        
        // Get deterministic card numbers
        const cardNumbers = BingoUtils.generateBingoCardNumbers(cardNumber);
        previewElement.innerHTML = '';
        
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            
            const row = Math.floor(i / 5);
            const col = i % 5;
            
            if (row === 2 && col === 2) { // Center is FREE
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
        this.cardsSelected.textContent = this.selectedCards.length;
        this.totalCardsTaken.textContent = this.takenCards.size;
        
        // Estimate active players (cards taken / max cards per player)
        const estimatedPlayers = Math.ceil(this.takenCards.size / 2);
        this.activePlayers.textContent = estimatedPlayers;
    }
    
    updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.selectionTimer.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Update color based on time
        if (seconds <= 10) {
            this.selectionTimer.style.color = '#ff4b4b';
            this.selectionTimer.classList.add('animate-shake');
        } else if (seconds <= 30) {
            this.selectionTimer.style.color = '#ff9e00';
            this.selectionTimer.classList.remove('animate-shake');
        } else {
            this.selectionTimer.style.color = '#00b4d8';
            this.selectionTimer.classList.remove('animate-shake');
        }
    }
    
    handleUrgentCountdown(seconds) {
        if (seconds <= 10) {
            BingoUtils.showNotification(`${seconds} seconds left!`, 'warning');
        }
    }
    
    randomSelectCards() {
        console.log('Randomly selecting cards...');
        
        // Clear current selection
        this.selectedCards = [];
        
        // Find available cards
        const availableCards = [];
        for (let i = 1; i <= this.totalCards; i++) {
            if (!this.takenCards.has(i)) {
                availableCards.push(i);
            }
        }
        
        if (availableCards.length === 0) {
            BingoUtils.showNotification('No available cards!', 'error');
            return;
        }
        
        // Shuffle and select
        for (let i = availableCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
        }
        
        // Select cards
        const cardsToSelect = Math.min(this.maxCards, availableCards.length);
        for (let i = 0; i < cardsToSelect; i++) {
            const cardNumber = availableCards[i];
            if (this.server.isConnected()) {
                this.server.selectCard(cardNumber);
            }
            this.selectedCards.push(cardNumber);
        }
        
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
        
        BingoUtils.showNotification(`Randomly selected cards: ${this.selectedCards.join(', ')}`, 'success');
    }
    
    clearSelection() {
        console.log('Clearing selection...');
        
        // Clear from server
        this.selectedCards.forEach(cardNumber => {
            if (this.server.isConnected()) {
                this.server.clearSelection(cardNumber);
            }
        });
        
        // Clear locally
        this.selectedCards = [];
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
        
        BingoUtils.showNotification('All cards deselected', 'info');
    }
    
    setupEventListeners() {
        this.randomSelectBtn.addEventListener('click', () => this.randomSelectCards());
        this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        
        // Handle page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden');
            } else {
                console.log('Page visible');
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChooseCardsPage();
});