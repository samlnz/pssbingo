// CHOOSE-CARDS.JS - Fixed with server synchronization
class ChooseCardsPage {
    constructor() {
        this.gameState = gameState;
        this.telegramManager = telegramManager;
        this.serverClient = serverClient;
        
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
        this.totalCards = 500;
        this.maxCards = 2;
        this.selectionTime = 60;
        this.localTimer = null;
        
        this.init();
    }

    init() {
        this.setupUserInfo();
        this.setupServerListeners();
        this.createCardGrid();
        this.updateDisplays();
        this.setupEventListeners();
        
        // Start local timer as fallback
        this.startLocalTimer();
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
        // Listen for server updates
        this.serverClient.on('cards-updated', (data) => {
            this.takenCards = new Set(data.takenCards);
            this.activePlayers.textContent = data.playerCount;
            this.updateCardGrid();
            this.updateDisplays();
        });
        
        this.serverClient.on('selection-countdown', (seconds) => {
            this.updateTimerDisplay(seconds);
        });
        
        this.serverClient.on('urgent-countdown', (seconds) => {
            this.handleUrgentCountdown(seconds);
        });
        
        this.serverClient.on('game-started', () => {
            this.handleGameStarted();
        });
        
        // Initial state
        setTimeout(() => {
            if (this.serverClient.isConnected) {
                this.fetchInitialState();
            }
        }, 1500);
    }

    fetchInitialState() {
        // Fetch taken cards from server
        fetch('/api/available-cards')
            .then(response => response.json())
            .then(data => {
                this.takenCards = new Set(data.taken);
                this.createCardGrid();
                this.updateDisplays();
            })
            .catch(error => {
                console.error('Failed to fetch initial state:', error);
                // Use local storage as fallback
                const savedTaken = localStorage.getItem('takenCards');
                if (savedTaken) {
                    this.takenCards = new Set(JSON.parse(savedTaken));
                    this.createCardGrid();
                }
            });
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
                cardElement.title = 'Already taken by another player';
            } else {
                cardElement.addEventListener('click', () => this.selectCard(i));
            }
            
            // Check if this card is already selected by player
            if (this.gameState.selectedCards.includes(i)) {
                cardElement.classList.add('selected');
            }
            
            this.cardsGrid.appendChild(cardElement);
        }
        
        this.updateSelectedCardsDisplay();
    }

    updateCardGrid() {
        document.querySelectorAll('.card-number').forEach(card => {
            const cardNum = parseInt(card.dataset.cardNumber);
            
            // Update taken status
            if (this.takenCards.has(cardNum) && !card.classList.contains('selected')) {
                card.classList.add('taken');
                card.title = 'Already taken by another player';
                card.onclick = null;
            } else if (!this.takenCards.has(cardNum)) {
                card.classList.remove('taken');
                card.title = '';
                card.onclick = () => this.selectCard(cardNum);
            }
        });
    }

    selectCard(cardNumber) {
        // Check if card is already taken
        if (this.takenCards.has(cardNumber)) {
            BingoUtils.showNotification(`Card #${cardNumber} is already taken`, 'warning');
            return;
        }
        
        // Check if card is already selected - if so, deselect it
        const index = this.gameState.selectedCards.indexOf(cardNumber);
        
        if (index > -1) {
            // Card is already selected - deselect it
            this.gameState.selectedCards.splice(index, 1);
            BingoUtils.showNotification(`Card #${cardNumber} deselected`, 'info');
        } else {
            // Check if max cards reached
            if (this.gameState.selectedCards.length >= this.maxCards) {
                BingoUtils.showNotification(`You can only select ${this.maxCards} cards maximum`, 'warning');
                return;
            }
            
            // Add card to selection
            this.gameState.selectedCards.push(cardNumber);
            BingoUtils.showNotification(`Card #${cardNumber} selected!`, 'success');
            
            // Send to server
            if (this.serverClient.isConnected) {
                this.serverClient.selectCards(
                    this.gameState.playerId,
                    this.gameState.playerName,
                    this.gameState.selectedCards
                );
            }
        }
        
        // Update UI
        this.updateCardElements();
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
        
        // Save to local storage
        this.gameState.saveToSession();
    }

    updateCardElements() {
        document.querySelectorAll('.card-number').forEach(card => {
            const cardNum = parseInt(card.dataset.cardNumber);
            
            // Remove selected class from all
            card.classList.remove('selected');
            
            // Add selected class to chosen cards
            if (this.gameState.selectedCards.includes(cardNum)) {
                card.classList.add('selected');
            }
        });
    }

    updateSelectedCardsDisplay() {
        // Update card numbers
        this.card1Number.textContent = this.gameState.selectedCards[0] || '--';
        this.card2Number.textContent = this.gameState.selectedCards[1] || '--';
        
        // Update previews
        this.updateCardPreview(1, this.gameState.selectedCards[0]);
        this.updateCardPreview(2, this.gameState.selectedCards[1]);
        
        // Update progress
        const progress = (this.gameState.selectedCards.length / this.maxCards) * 100;
        this.selectionProgress.style.width = `${progress}%`;
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
        this.cardsSelected.textContent = this.gameState.selectedCards.length;
        this.totalCardsTaken.textContent = this.takenCards.size;
    }

    startLocalTimer() {
        if (this.localTimer) {
            clearInterval(this.localTimer);
        }
        
        this.selectionTime = 60;
        this.updateTimerDisplay(this.selectionTime);
        
        this.localTimer = setInterval(() => {
            this.selectionTime--;
            this.updateTimerDisplay(this.selectionTime);
            
            if (this.selectionTime <= 0) {
                clearInterval(this.localTimer);
                this.handleTimerExpired();
            }
        }, 1000);
    }

    updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.selectionTimer.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Update timer color
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

    handleTimerExpired() {
        // Check if any cards are selected
        if (this.gameState.selectedCards.length === 0) {
            // No cards selected - auto select random cards
            BingoUtils.showNotification('Time expired! Selecting random cards...', 'info');
            this.randomSelectCards();
        }
        
        // Proceed to game after 2 seconds
        setTimeout(() => {
            this.confirmSelection();
        }, 2000);
    }

    handleGameStarted() {
        // Auto-proceed to game page when server starts game
        if (this.gameState.selectedCards.length === 0) {
            this.randomSelectCards();
        }
        
        setTimeout(() => {
            this.confirmSelection();
        }, 1000);
    }

    randomSelectCards() {
        // Clear any existing selection
        this.gameState.selectedCards = [];
        
        const availableCards = [];
        for (let i = 1; i <= this.totalCards; i++) {
            if (!this.takenCards.has(i)) {
                availableCards.push(i);
            }
        }
        
        if (availableCards.length === 0) {
            BingoUtils.showNotification('No available cards left!', 'error');
            return;
        }
        
        // Shuffle and select
        for (let i = availableCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
        }
        
        const cardsToSelect = Math.min(this.maxCards, availableCards.length);
        for (let i = 0; i < cardsToSelect; i++) {
            this.gameState.selectedCards.push(availableCards[i]);
        }
        
        // Update server if connected
        if (this.serverClient.isConnected) {
            this.serverClient.selectCards(
                this.gameState.playerId,
                this.gameState.playerName,
                this.gameState.selectedCards
            );
        }
        
        this.updateCardElements();
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
    }

    clearSelection() {
        this.gameState.selectedCards = [];
        this.updateCardElements();
        this.updateSelectedCardsDisplay();
        this.updateDisplays();
        BingoUtils.showNotification('Selection cleared!', 'info');
        
        // Clear from server if connected
        if (this.serverClient.isConnected) {
            this.serverClient.selectCards(
                this.gameState.playerId,
                this.gameState.playerName,
                []
            );
        }
    }

    confirmSelection() {
        if (this.gameState.selectedCards.length === 0) {
            this.randomSelectCards();
            setTimeout(() => this.confirmSelection(), 1000);
            return;
        }
        
        // Show loading
        this.loadingOverlay.classList.add('active');
        this.loadingText.textContent = 'Starting Game...';
        
        // Save to session
        this.gameState.saveToSession();
        
        // Redirect to game page
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    }

    setupEventListeners() {
        this.randomSelectBtn.addEventListener('click', () => this.randomSelectCards());
        this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        
        // Handle page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Card selection paused');
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChooseCardsPage();
});