// REAL-TIME SYNCHRONIZED CARD SELECTION
class SynchronizedCardSelection {
    constructor() {
        this.rtClient = realTimeClient;
        this.gameState = gameState;
        
        // State
        this.selectedCards = new Set(); // Local selection
        this.takenCards = new Set(); // All taken cards (from server)
        this.totalCards = 500;
        this.maxCards = 2;
        this.connectedPlayers = 0;
        
        // DOM Elements cache
        this.elements = {};
        
        // Connection indicators
        this.connectionIndicator = null;
        this.playerCountDisplay = null;
        
        this.init();
    }
    
    async init() {
        console.log('🎴 Initializing synchronized card selection...');
        
        // Wait for DOM to be ready
        await this.waitForDOM();
        
        // Initialize UI
        this.setupUI();
        
        // Setup WebSocket event handlers
        this.setupRealTimeHandlers();
        
        // Register player with server
        this.registerPlayer();
        
        // Start connection health check
        this.startConnectionMonitor();
        
        console.log('✅ Synchronized card selection ready');
    }
    
    async waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    setupUI() {
        // Cache DOM elements
        this.cacheElements();
        
        // Setup player info
        this.setupPlayerInfo();
        
        // Create card grid
        this.createCardGrid();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Create connection status indicator
        this.createConnectionIndicator();
    }
    
    cacheElements() {
        const elementIds = [
            'cardsGrid', 'card1Number', 'card2Number', 'card1Preview', 'card2Preview',
            'cardsSelected', 'totalCardsTaken', 'activePlayers', 'selectionProgress',
            'selectionTimer', 'randomSelectBtn', 'clearSelectionBtn', 'loadingOverlay',
            'loadingText', 'playerName', 'playerId', 'playerAvatar'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    setupPlayerInfo() {
        // Set player name and ID
        if (this.elements.playerName) {
            this.elements.playerName.textContent = this.gameState.playerName;
        }
        if (this.elements.playerId) {
            this.elements.playerId.textContent = this.gameState.playerId;
        }
        if (this.elements.playerAvatar) {
            this.elements.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
            
            // Random avatar color
            const colors = ['#00b4d8', '#0077b6', '#0096c7', '#005f8a', '#03045e'];
            this.elements.playerAvatar.style.background = 
                colors[Math.floor(Math.random() * colors.length)];
        }
        
        // Update selection counter
        if (this.elements.cardsSelected) {
            this.elements.cardsSelected.textContent = this.selectedCards.size;
        }
    }
    
    createCardGrid() {
        if (!this.elements.cardsGrid) return;
        
        this.elements.cardsGrid.innerHTML = '';
        
        // Create 500 cards
        for (let i = 1; i <= this.totalCards; i++) {
            const cardElement = this.createCardElement(i);
            this.elements.cardsGrid.appendChild(cardElement);
        }
        
        // Update previews
        this.updateCardPreviews();
    }
    
    createCardElement(cardNumber) {
        const card = document.createElement('div');
        card.className = 'card-number';
        card.textContent = cardNumber;
        card.dataset.cardNumber = cardNumber;
        card.dataset.state = 'available'; // available, taken, selected
        
        // Set initial state
        if (this.takenCards.has(cardNumber)) {
            card.classList.add('taken');
            card.dataset.state = 'taken';
            card.title = 'Taken by another player';
        } else {
            card.addEventListener('click', () => this.handleCardClick(cardNumber));
            card.title = 'Click to select';
            
            if (this.selectedCards.has(cardNumber)) {
                card.classList.add('selected');
                card.dataset.state = 'selected';
            }
        }
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            if (!card.classList.contains('taken')) {
                card.style.transform = 'translateY(-5px) scale(1.05)';
            }
        });
        
        card.addEventListener('mouseleave', () => {
            if (!card.classList.contains('taken')) {
                card.style.transform = '';
            }
        });
        
        return card;
    }
    
    updateCardGrid() {
        const cards = this.elements.cardsGrid.querySelectorAll('.card-number');
        
        cards.forEach(card => {
            const cardNumber = parseInt(card.dataset.cardNumber);
            
            // Clear all states
            card.classList.remove('selected', 'taken');
            card.dataset.state = 'available';
            
            // Update based on current state
            if (this.takenCards.has(cardNumber)) {
                card.classList.add('taken');
                card.dataset.state = 'taken';
                card.title = 'Taken by another player';
                card.onclick = null;
            } else {
                card.classList.remove('taken');
                card.dataset.state = 'available';
                card.title = 'Click to select';
                card.onclick = () => this.handleCardClick(cardNumber);
                
                if (this.selectedCards.has(cardNumber)) {
                    card.classList.add('selected');
                    card.dataset.state = 'selected';
                }
            }
        });
        
        // Update counters
        this.updateCounters();
    }
    
    setupRealTimeHandlers() {
        // Connection events
        this.rtClient.on('connected', () => {
            console.log('🔗 Connected to synchronization server');
            this.updateConnectionStatus(true);
            this.showNotification('Connected to game server', 'success');
        });
        
        this.rtClient.on('disconnected', () => {
            console.log('🔌 Disconnected from server');
            this.updateConnectionStatus(false);
            this.showNotification('Lost connection to server', 'warning');
        });
        
        // Game state synchronization
        this.rtClient.on('game-state', (state) => {
            console.log('🔄 Received synchronized game state:', state);
            this.handleGameStateUpdate(state);
        });
        
        // Card selection events
        this.rtClient.on('card-selected', (data) => {
            console.log('✅ Card selection confirmed:', data);
            this.handleCardSelectionConfirmation(data);
        });
        
        this.rtClient.on('card-taken', (data) => {
            console.log('🎴 Card taken by another player:', data);
            this.handleRemoteCardTaken(data);
        });
        
        this.rtClient.on('card-released', (data) => {
            console.log('🔄 Card released by another player:', data);
            this.handleRemoteCardReleased(data);
        });
        
        this.rtClient.on('card-unavailable', (data) => {
            console.log('❌ Card unavailable:', data);
            this.handleCardUnavailable(data);
        });
        
        // Timer synchronization
        this.rtClient.on('selection-countdown', (data) => {
            this.updateSynchronizedTimer(data.seconds);
        });
        
        // Game phase changes
        this.rtClient.on('game-phase', (data) => {
            this.handleGamePhaseChange(data.phase);
        });
        
        this.rtClient.on('ready-countdown', (seconds) => {
            this.handleReadyCountdown(seconds);
        });
        
        // Player count updates
        this.rtClient.on('players-updated', (data) => {
            this.updatePlayerCount(data.playerCount);
        });
        
        // Registration confirmation
        this.rtClient.on('registration-confirmed', (data) => {
            console.log('✅ Player registration confirmed:', data);
            this.handleRegistrationConfirmation(data);
        });
        
        // Winner declared
        this.rtClient.on('winner-declared', (winner) => {
            console.log('🏆 Winner declared:', winner);
            this.handleWinnerDeclaration(winner);
        });
    }
    
    handleGameStateUpdate(state) {
        // Update taken cards from server
        this.takenCards = new Set(state.takenCards || []);
        
        // Update player count
        this.connectedPlayers = state.playerCount || 0;
        
        // Update UI
        this.updateCardGrid();
        this.updateCounters();
        
        // Update timer if available
        if (state.selectionTimeLeft !== undefined) {
            this.updateSynchronizedTimer(state.selectionTimeLeft);
        }
        
        // Handle current phase
        if (state.phase) {
            this.handleGamePhaseChange(state.phase);
        }
        
        console.log('🔄 Game state synchronized');
    }
    
    handleCardSelectionConfirmation(data) {
        if (data.success) {
            const cardNumber = data.cardNumber;
            
            // Add to selected cards
            this.selectedCards.add(cardNumber);
            
            // Update local UI
            this.updateCardGrid();
            this.updateCardPreviews();
            this.updateCounters();
            
            // Show success message
            if (data.playerId === this.gameState.playerId) {
                this.showNotification(`Card #${cardNumber} selected!`, 'success');
            }
        }
    }
    
    handleRemoteCardTaken(data) {
        // Add to taken cards
        this.takenCards.add(data.cardNumber);
        
        // If we had this card selected, remove it
        if (this.selectedCards.has(data.cardNumber)) {
            this.selectedCards.delete(data.cardNumber);
            
            // Only show notification if it wasn't us
            if (data.playerId !== this.gameState.playerId) {
                this.showNotification(`Card #${data.cardNumber} was taken by another player`, 'warning');
            }
        }
        
        // Update UI
        this.updateCardGrid();
        this.updateCounters();
    }
    
    handleRemoteCardReleased(data) {
        // Remove from taken cards
        this.takenCards.delete(data.cardNumber);
        
        // Update UI
        this.updateCardGrid();
        this.updateCounters();
    }
    
    handleCardUnavailable(data) {
        const cardNumber = data.cardNumber;
        
        // Remove from our selection
        this.selectedCards.delete(cardNumber);
        
        // Update UI
        this.updateCardGrid();
        this.updateCardPreviews();
        this.updateCounters();
        
        // Show error
        this.showNotification(`Card #${cardNumber} is already taken!`, 'error');
    }
    
    handleGamePhaseChange(phase) {
        console.log('🔄 Game phase changed to:', phase);
        
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
                this.handleGameEnd();
                break;
        }
    }
    
    handleReadyPhase() {
        console.log('🎮 Ready phase started');
        
        this.showNotification('Game starting in 3 seconds...', 'info');
        
        // Auto-select random cards if none selected
        if (this.selectedCards.size === 0) {
            this.autoSelectRandomCards();
        }
    }
    
    handleReadyCountdown(seconds) {
        if (seconds > 0) {
            this.showNotification(`Game starts in ${seconds}...`, 'info');
        } else {
            this.showNotification('GO!', 'success');
        }
    }
    
    handleGameStart() {
        console.log('🚀 Game starting, redirecting...');
        
        // Save selected cards to session
        this.gameState.selectedCards = Array.from(this.selectedCards);
        this.gameState.saveToSession();
        
        // Show redirect notification
        this.showNotification('Game started! Redirecting...', 'success');
        
        // Redirect to game page
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    }
    
    handleGameEnd() {
        this.showNotification('Game ended. New game starting soon...', 'info');
    }
    
    handleWinnerDeclaration(winner) {
        // Check if we're the winner
        if (winner.playerId === this.gameState.playerId) {
            this.showNotification('🎉 YOU WIN! 🎉', 'success');
            
            // Save winner data
            sessionStorage.setItem('bingoWinner', JSON.stringify(winner));
            
            // Redirect to winner page
            setTimeout(() => {
                window.location.href = 'winner.html';
            }, 2000);
        } else {
            this.showNotification(`${winner.playerName} won the game!`, 'info');
        }
    }
    
    handleRegistrationConfirmation(data) {
        console.log('Player registered:', data.playerName);
        
        // Update player ID if needed
        if (data.playerId && data.playerId !== this.gameState.playerId) {
            this.gameState.playerId = data.playerId;
        }
        
        // Hide loading overlay
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('active');
        }
    }
    
    updateSynchronizedTimer(seconds) {
        if (!this.elements.selectionTimer) return;
        
        // Format time
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Update display
        this.elements.selectionTimer.textContent = timeString;
        
        // Visual urgency
        if (seconds <= 10) {
            this.elements.selectionTimer.style.color = '#ff4b4b';
            this.elements.selectionTimer.classList.add('animate-shake');
            
            // Audio/visual warnings
            if ([10, 5, 3, 2, 1].includes(seconds)) {
                this.showNotification(`${seconds} seconds left!`, 'warning');
                
                // Play sound for last 5 seconds
                if (seconds <= 5) {
                    this.playCountdownSound();
                }
            }
        } else if (seconds <= 30) {
            this.elements.selectionTimer.style.color = '#ff9e00';
            this.elements.selectionTimer.classList.remove('animate-shake');
        } else {
            this.elements.selectionTimer.style.color = '#00b4d8';
            this.elements.selectionTimer.classList.remove('animate-shake');
        }
        
        // Auto-select if time is almost up and no cards selected
        if (seconds === 5 && this.selectedCards.size === 0) {
            this.autoSelectRandomCards();
        }
    }
    
    playCountdownSound() {
        // Create audio element for countdown
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ');
        audio.volume = 0.3;
        audio.play().catch(() => {
            // Silent fail if audio can't play
        });
    }
    
    updateCounters() {
        // Update cards selected counter
        if (this.elements.cardsSelected) {
            this.elements.cardsSelected.textContent = this.selectedCards.size;
        }
        
        // Update total cards taken counter
        if (this.elements.totalCardsTaken) {
            this.elements.totalCardsTaken.textContent = this.takenCards.size;
        }
        
        // Update active players (estimate based on cards taken)
        if (this.elements.activePlayers) {
            const estimatedPlayers = Math.ceil(this.takenCards.size / 2);
            this.elements.activePlayers.textContent = estimatedPlayers;
        }
        
        // Update selection progress bar
        if (this.elements.selectionProgress) {
            const progress = (this.selectedCards.size / this.maxCards) * 100;
            this.elements.selectionProgress.style.width = `${progress}%`;
        }
    }
    
    updateCardPreviews() {
        const selectedCardsArray = Array.from(this.selectedCards);
        
        // Update card 1 preview
        if (this.elements.card1Number && this.elements.card1Preview) {
            const card1Number = selectedCardsArray[0];
            this.elements.card1Number.textContent = card1Number || '--';
            this.updateSingleCardPreview(this.elements.card1Preview, card1Number);
        }
        
        // Update card 2 preview
        if (this.elements.card2Number && this.elements.card2Preview) {
            const card2Number = selectedCardsArray[1];
            this.elements.card2Number.textContent = card2Number || '--';
            this.updateSingleCardPreview(this.elements.card2Preview, card2Number);
        }
    }
    
    updateSingleCardPreview(container, cardNumber) {
        if (!container) return;
        
        if (!cardNumber) {
            // Empty preview
            container.innerHTML = '';
            for (let i = 0; i < 25; i++) {
                const cell = document.createElement('div');
                cell.className = 'preview-cell';
                container.appendChild(cell);
            }
            return;
        }
        
        // Get card numbers
        const cardNumbers = BingoUtils.generateBingoCardNumbers(cardNumber);
        
        // Create preview grid
        container.innerHTML = '';
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
                const number = cardNumbers[numberIndex];
                cell.textContent = number || '';
                
                // Highlight if number is called (we don't have called numbers here yet)
                // This would be updated from game.js
            }
            
            container.appendChild(cell);
        }
    }
    
    handleCardClick(cardNumber) {
        console.log('Card clicked:', cardNumber);
        
        // Check if already selected
        if (this.selectedCards.has(cardNumber)) {
            this.deselectCard(cardNumber);
            return;
        }
        
        // Check max cards limit
        if (this.selectedCards.size >= this.maxCards) {
            this.showNotification(`You can only select ${this.maxCards} cards`, 'warning');
            return;
        }
        
        // Check if card is available
        if (this.takenCards.has(cardNumber)) {
            this.showNotification(`Card #${cardNumber} is already taken!`, 'error');
            return;
        }
        
        // Select card
        this.selectCard(cardNumber);
    }
    
    selectCard(cardNumber) {
        console.log('Selecting card:', cardNumber);
        
        // Optimistic UI update
        this.selectedCards.add(cardNumber);
        this.updateCardGrid();
        this.updateCardPreviews();
        this.updateCounters();
        
        // Send to server
        if (this.rtClient.isConnected) {
            this.rtClient.selectCard(cardNumber);
        } else {
            this.showNotification('Not connected to server. Selection not saved.', 'warning');
        }
        
        // Visual feedback
        this.animateCardSelection(cardNumber);
    }
    
    deselectCard(cardNumber) {
        console.log('Deselecting card:', cardNumber);
        
        // Remove from selection
        this.selectedCards.delete(cardNumber);
        
        // Update UI
        this.updateCardGrid();
        this.updateCardPreviews();
        this.updateCounters();
        
        // Send to server
        if (this.rtClient.isConnected) {
            this.rtClient.deselectCard(cardNumber);
        }
        
        this.showNotification(`Card #${cardNumber} deselected`, 'info');
    }
    
    animateCardSelection(cardNumber) {
        const cardElement = this.elements.cardsGrid?.querySelector(
            `[data-card-number="${cardNumber}"]`
        );
        
        if (cardElement) {
            // Pulse animation
            cardElement.classList.add('selected');
            
            // Add temporary highlight
            cardElement.style.animation = 'selectedPulse 0.5s ease';
            setTimeout(() => {
                cardElement.style.animation = '';
            }, 500);
        }
    }
    
    autoSelectRandomCards() {
        console.log('Auto-selecting random cards...');
        
        // Find available cards
        const availableCards = [];
        for (let i = 1; i <= this.totalCards; i++) {
            if (!this.takenCards.has(i)) {
                availableCards.push(i);
            }
        }
        
        if (availableCards.length === 0) {
            this.showNotification('No available cards left!', 'error');
            return;
        }
        
        // Clear current selection first
        this.selectedCards.clear();
        
        // Shuffle available cards
        for (let i = availableCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
        }
        
        // Select up to maxCards
        const cardsToSelect = Math.min(this.maxCards, availableCards.length);
        for (let i = 0; i < cardsToSelect; i++) {
            const cardNumber = availableCards[i];
            this.selectCard(cardNumber);
        }
        
        this.showNotification(`Auto-selected cards: ${Array.from(this.selectedCards).join(', ')}`, 'success');
    }
    
    clearAllSelections() {
        console.log('Clearing all selections...');
        
        // Deselect all cards
        this.selectedCards.forEach(cardNumber => {
            this.deselectCard(cardNumber);
        });
        
        this.showNotification('All cards deselected', 'info');
    }
    
    registerPlayer() {
        console.log('Registering player with server...');
        
        if (!this.rtClient.isConnected) {
            console.warn('Not connected to server, retrying...');
            setTimeout(() => this.registerPlayer(), 1000);
            return;
        }
        
        // Show loading
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('active');
            if (this.elements.loadingText) {
                this.elements.loadingText.textContent = 'Connecting to game...';
            }
        }
        
        // Register with server
        const success = this.rtClient.registerPlayer(
            this.gameState.playerName,
            this.gameState.playerId
        );
        
        if (!success) {
            console.error('Failed to register player');
            setTimeout(() => this.registerPlayer(), 2000);
        }
    }
    
    createConnectionIndicator() {
        // Create connection status indicator
        this.connectionIndicator = document.createElement('div');
        this.connectionIndicator.className = 'connection-indicator';
        this.connectionIndicator.innerHTML = `
            <div class="connection-dot"></div>
            <span class="connection-text">Connecting...</span>
        `;
        
        // Add to page
        document.body.appendChild(this.connectionIndicator);
        
        // Create player count display
        this.playerCountDisplay = document.createElement('div');
        this.playerCountDisplay.className = 'player-count-display';
        this.playerCountDisplay.innerHTML = `
            <i class="fas fa-users"></i>
            <span class="player-count">0</span>
            <span class="player-label">players</span>
        `;
        
        document.body.appendChild(this.playerCountDisplay);
    }
    
    updateConnectionStatus(connected) {
        if (!this.connectionIndicator) return;
        
        const dot = this.connectionIndicator.querySelector('.connection-dot');
        const text = this.connectionIndicator.querySelector('.connection-text');
        
        if (connected) {
            dot.className = 'connection-dot connected';
            text.textContent = 'Connected';
            this.connectionIndicator.classList.remove('disconnected');
            this.connectionIndicator.classList.add('connected');
        } else {
            dot.className = 'connection-dot disconnected';
            text.textContent = 'Disconnected';
            this.connectionIndicator.classList.remove('connected');
            this.connectionIndicator.classList.add('disconnected');
        }
    }
    
    updatePlayerCount(count) {
        this.connectedPlayers = count;
        
        if (this.playerCountDisplay) {
            const countElement = this.playerCountDisplay.querySelector('.player-count');
            if (countElement) {
                countElement.textContent = count;
            }
        }
        
        // Also update in the main UI if element exists
        if (this.elements.activePlayers) {
            this.elements.activePlayers.textContent = count;
        }
    }
    
    startConnectionMonitor() {
        // Ping server every 30 seconds to keep connection alive
        setInterval(() => {
            if (this.rtClient.isConnected) {
                // Send ping to server
                if (this.rtClient.socket) {
                    this.rtClient.socket.emit('ping', { timestamp: Date.now() });
                }
            }
        }, 30000);
    }
    
    setupEventListeners() {
        // Random selection button
        if (this.elements.randomSelectBtn) {
            this.elements.randomSelectBtn.addEventListener('click', () => {
                this.autoSelectRandomCards();
            });
        }
        
        // Clear selection button
        if (this.elements.clearSelectionBtn) {
            this.elements.clearSelectionBtn.addEventListener('click', () => {
                this.clearAllSelections();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // R for random selection
            if (e.key === 'r' && !e.ctrlKey) {
                this.autoSelectRandomCards();
            }
            // C for clear selection
            if (e.key === 'c' && !e.ctrlKey) {
                this.clearAllSelections();
            }
        });
        
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden - connection may be throttled');
            } else {
                console.log('Page visible - refreshing connection');
                // Refresh connection when page becomes visible
                if (!this.rtClient.isConnected) {
                    this.rtClient.connect();
                }
            }
        });
    }
    
    showNotification(message, type = 'info') {
        // Use existing BingoUtils or create simple notification
        if (typeof BingoUtils !== 'undefined' && BingoUtils.showNotification) {
            BingoUtils.showNotification(message, type);
        } else {
            // Fallback simple notification
            console.log(`${type.toUpperCase()}: ${message}`);
            
            const notification = document.createElement('div');
            notification.className = `sync-notification sync-${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 20px;
                border-radius: 10px;
                color: white;
                font-weight: bold;
                z-index: 9999;
                animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
            `;
            
            // Set color based on type
            const colors = {
                success: '#4CAF50',
                error: '#f44336',
                warning: '#ff9800',
                info: '#2196F3'
            };
            notification.style.background = colors[type] || colors.info;
            
            document.body.appendChild(notification);
            
            // Remove after 3 seconds
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }
}

// Initialize synchronized card selection
document.addEventListener('DOMContentLoaded', () => {
    // Wait for real-time client to be ready
    setTimeout(() => {
        new SynchronizedCardSelection();
    }, 500);
});