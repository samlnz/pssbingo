// Choose Cards Page - Fixed and Simplified
class ChooseCardsPage {
    constructor() {
        this.gameState = gameState;
        this.server = serverClient;
        
        this.takenCards = new Set();
        this.selectedCards = [];
        this.totalCards = 500;
        this.maxCards = 2;
        
        this.init();
    }
    
    init() {
        this.setupDOM();
        this.setupServerListeners();
        this.setupEventListeners();
        
        console.log('Choose Cards Page initialized');
    }
    
    setupDOM() {
        // Get DOM elements
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
        
        // Set player info
        document.getElementById('playerName').textContent = this.gameState.playerName;
        document.getElementById('playerId').textContent = this.gameState.playerId;
        document.getElementById('playerAvatar').textContent = this.gameState.playerName.charAt(0).toUpperCase();
        
        // Create card grid
        this.createCardGrid();
    }
    
    setupServerListeners() {
        // When server sends game state
        this.server.on('game-state', (state) => {
            console.log('Received game state:', state);
            this.takenCards = new Set(state.takenCards || []);
            this.updateCardGrid();
            this.updateDisplays();
        });
        
        // When card is taken by someone
        this.server.on('card-taken', (data) => {
            console.log('Card taken event:', data);
            this.takenCards.add(data.cardNumber);
            this.updateCardGrid();
            this.updateDisplays();
            
            // Remove from our selection if it was taken by someone else
            if (this.selectedCards.includes(data.cardNumber) && data.playerId !== this.gameState.playerId) {
                this.removeCardFromSelection(data.cardNumber);
            }
        });
        
        // When card is released
        this.server.on('card-released', (data) => {
            console.log('Card released event:', data);
            this.takenCards.delete(data.cardNumber);
            this.updateCardGrid();
            this.updateDisplays();
        });
        
        // When our card selection is confirmed
        this.server.on('card-selected', (data) => {
            console.log('Card selected confirmed:', data);
            if (data.success && !this.selectedCards.includes(data.cardNumber)) {
                this.selectedCards.push(data.cardNumber);
                this.updateSelectedCardsDisplay();
            }
        });
        
        // When card is unavailable
        this.server.on('card-unavailable', (cardNumber) => {
            console.log('Card unavailable:', cardNumber);
            BingoUtils.showNotification(`Card #${cardNumber} is already taken!`, 'error');
            this.removeCardFromSelection(cardNumber);
        });
        
        // Selection countdown
        this.server.on('selection-countdown', (data) => {
            console.log('Selection countdown:', data.seconds);
            this.updateTimerDisplay(data.seconds);
            
            if (data.seconds <= 10) {
                this.selectionTimer.classList.add('animate-shake');
            }
            
            if (data.seconds <= 0) {
                this.handleSelectionEnd();
            }
        });
        
        // Game phase changes
        this.server.on('game-phase-change', (phase) => {
            console.log('Game phase changed to:', phase);
            
            if (phase === 'ready') {
                this.handleReadyPhase();
            } else if (phase === 'playing') {
                this.handleGameStart();
            }
        });
        
        // Ready countdown
        this.server.on('ready-countdown', (seconds) => {
            console.log('Ready countdown:', seconds);
            BingoUtils.showNotification(`Game starts in ${seconds}...`, 'info');
        });
    }
    
    createCardGrid() {
        if (!this.cardsGrid) return;
        
        this.cardsGrid.innerHTML = '';
        
        for (let i = 1; i <= this.totalCards; i++) {
            const card = document.createElement('div');
            card.className = 'card-number';
            card.textContent = i;
            card.dataset.cardNumber = i;
            
            if (this.takenCards.has(i)) {
                card.classList.add('taken');
                card.title = 'Taken by another player';
            } else {
                card.addEventListener('click', () => this.handleCardClick(i));
            }
            
            if (this.selectedCards.includes(i)) {
                card.classList.add('selected');
            }
            
            this.cardsGrid.appendChild(card);
        }
    }
    
    updateCardGrid() {
        const cards = this.cardsGrid.querySelectorAll('.card-number');
        cards.forEach(card => {
            const cardNum = parseInt(card.dataset.cardNumber);
            
            if (this.takenCards.has(cardNum)) {
                card.classList.add('taken');
                card.title = 'Taken by another player';
                card.onclick = null;
            } else {
                card.classList.remove('taken');
                card.title = 'Click to select';
                card.onclick = () => this.handleCardClick(cardNum);
            }
            
            if (this.selectedCards.includes(cardNum)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }
    
    handleCardClick(cardNumber) {
        console.log('Card clicked:', cardNumber);
        
        // Check if already selected
        if (this.selectedCards.includes(cardNumber)) {
            this.deselectCard(cardNumber);
            return;
        }
        
        // Check max cards
        if (this.selectedCards.length >= this.maxCards) {
            BingoUtils.showNotification(`You can only select ${this.maxCards} cards`, 'warning');
            return;
        }
        
        // Select card
        this.selectCard(cardNumber);
    }
    
    selectCard(cardNumber) {
        console.log('Selecting card:', cardNumber);
        
        // Send to server
        this.server.selectCard(cardNumber);
        
        // Optimistically add to selection
        this.selectedCards.push(cardNumber);
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
        
        BingoUtils.showNotification(`Selected card #${cardNumber}`, 'success');
    }
    
    deselectCard(cardNumber) {
        console.log('Deselecting card:', cardNumber);
        
        // Send to server
        this.server.deselectCard(cardNumber);
        
        // Remove from selection
        this.removeCardFromSelection(cardNumber);
        
        BingoUtils.showNotification(`Deselected card #${cardNumber}`, 'info');
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
        if (this.card1Number) this.card1Number.textContent = this.selectedCards[0] || '--';
        if (this.card2Number) this.card2Number.textContent = this.selectedCards[1] || '--';
        
        // Update previews
        this.updateCardPreview(1, this.selectedCards[0]);
        this.updateCardPreview(2, this.selectedCards[1]);
        
        // Update progress
        if (this.selectionProgress) {
            const progress = (this.selectedCards.length / this.maxCards) * 100;
            this.selectionProgress.style.width = `${progress}%`;
        }
        
        // Update counters
        if (this.cardsSelected) this.cardsSelected.textContent = this.selectedCards.length;
    }
    
    updateCardPreview(cardIndex, cardNumber) {
        const previewElement = cardIndex === 1 ? this.card1Preview : this.card2Preview;
        if (!previewElement) return;
        
        if (!cardNumber) {
            previewElement.innerHTML = '';
            for (let i = 0; i < 25; i++) {
                const cell = document.createElement('div');
                cell.className = 'preview-cell';
                previewElement.appendChild(cell);
            }
            return;
        }
        
        // Get card numbers
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
        if (this.totalCardsTaken) this.totalCardsTaken.textContent = this.takenCards.size;
        if (this.activePlayers) {
            const playerCount = Math.ceil(this.takenCards.size / 2);
            this.activePlayers.textContent = playerCount;
        }
    }
    
    updateTimerDisplay(seconds) {
        if (!this.selectionTimer) return;
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.selectionTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (seconds <= 10) {
            this.selectionTimer.style.color = '#ff4b4b';
        } else if (seconds <= 30) {
            this.selectionTimer.style.color = '#ff9e00';
        } else {
            this.selectionTimer.style.color = '#00b4d8';
        }
    }
    
    handleReadyPhase() {
        // Auto-select cards if none selected
        if (this.selectedCards.length === 0) {
            this.randomSelectCards();
        }
        
        BingoUtils.showNotification('Game starting in 3 seconds...', 'info');
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
        // Auto-select cards if none selected
        if (this.selectedCards.length === 0) {
            this.randomSelectCards();
        }
        
        BingoUtils.showNotification('Selection time ended!', 'warning');
    }
    
    randomSelectCards() {
        console.log('Randomly selecting cards...');
        
        // Clear current selection
        this.selectedCards = [];
        
        // Find available cards
        const available = [];
        for (let i = 1; i <= this.totalCards; i++) {
            if (!this.takenCards.has(i)) {
                available.push(i);
            }
        }
        
        if (available.length === 0) {
            BingoUtils.showNotification('No cards available!', 'error');
            return;
        }
        
        // Shuffle and select
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }
        
        // Select cards
        const toSelect = Math.min(this.maxCards, available.length);
        for (let i = 0; i < toSelect; i++) {
            this.selectCard(available[i]);
        }
    }
    
    setupEventListeners() {
        if (this.randomSelectBtn) {
            this.randomSelectBtn.addEventListener('click', () => this.randomSelectCards());
        }
        
        if (this.clearSelectionBtn) {
            this.clearSelectionBtn.addEventListener('click', () => {
                this.selectedCards.forEach(card => this.deselectCard(card));
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new ChooseCardsPage();
    }, 500);
});