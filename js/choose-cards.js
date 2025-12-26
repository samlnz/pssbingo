// choose-cards.js - Synchronized with server
class ChooseCardsPage {
  constructor() {
    this.gameState = gameState;
    
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
    this.observerBtn = document.getElementById('observerBtn');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.getElementById('loadingText');
    this.playerName = document.getElementById('playerName');
    this.playerId = document.getElementById('playerId');
    this.playerAvatar = document.getElementById('playerAvatar');
    
    // Game state
    this.takenCards = new Set();
    this.totalCards = 500;
    this.maxCards = 2;
    this.syncInterval = null;
    
    this.init();
  }

  async init() {
    this.setupUserInfo();
    await this.loadTakenCards();
    this.createCardGrid();
    this.updateDisplays();
    this.setupEventListeners();
    this.startSyncUpdates();
    
    // Join the synchronized game
    await this.joinGame();
  }

  setupUserInfo() {
    this.playerName.textContent = this.gameState.playerName;
    this.playerId.textContent = this.gameState.playerId;
    this.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
    
    const colors = ['#00b4d8', '#0077b6', '#0096c7', '#005f8a', '#03045e'];
    this.playerAvatar.style.background = colors[Math.floor(Math.random() * colors.length)];
  }

  async joinGame() {
    try {
      // Join the synchronized game server
      await synchronizedGame.joinGame(this.gameState.playerId, this.gameState.playerName);
      
      // Setup game state updates
      synchronizedGame.onGameUpdate = (gameState) => {
        this.handleGameUpdate(gameState);
      };
      
    } catch (error) {
      console.error('Failed to join game:', error);
      BingoUtils.showNotification('Using fallback mode - Game not synchronized', 'warning');
    }
  }

  handleGameUpdate(gameState) {
    this.gameState.updateSyncState(gameState);
    
    // Update UI based on game phase
    this.updateGamePhaseUI();
    
    // Update timer display
    this.updateTimerDisplay();
    
    // Auto-proceed if selection time is up and game is active
    if (gameState.gamePhase === 'active' && this.gameState.selectedCards.length > 0) {
      setTimeout(() => {
        this.proceedToGame();
      }, 2000);
    }
  }

  updateGamePhaseUI() {
    const phase = this.gameState.getGamePhase();
    const timeLeft = this.gameState.getTimeToNextPhase();
    
    // Update selection timer display
    const timerElement = this.selectionTimer.parentElement;
    
    if (phase === 'waiting') {
      timerElement.innerHTML = `
        <div class="timer-label">
          <i class="fas fa-clock"></i>
          NEXT GAME STARTS IN
        </div>
        <div class="timer-display" id="selectionTimer">${BingoUtils.formatTime(timeLeft)}</div>
      `;
    } else if (phase === 'selection') {
      timerElement.innerHTML = `
        <div class="timer-label">
          <i class="fas fa-hourglass-half"></i>
          SELECTION TIME LEFT
        </div>
        <div class="timer-display" id="selectionTimer">${BingoUtils.formatTime(timeLeft)}</div>
      `;
      
      // Auto-start game when selection time ends
      if (timeLeft <= 0 && this.gameState.selectedCards.length > 0) {
        this.proceedToGame();
      }
    } else if (phase === 'active') {
      timerElement.innerHTML = `
        <div class="timer-label">
          <i class="fas fa-gamepad"></i>
          GAME IN PROGRESS
        </div>
        <div class="timer-display" id="selectionTimer">${BingoUtils.formatTime(timeLeft)}</div>
      `;
      
      // If player has cards, redirect to game
      if (this.gameState.selectedCards.length > 0) {
        setTimeout(() => {
          this.proceedToGame();
        }, 1000);
      }
    }
    
    this.selectionTimer = document.getElementById('selectionTimer');
    this.updateTimerColor(timeLeft);
  }

  async loadTakenCards() {
    try {
      const cardsData = await synchronizedGame.getAvailableCards();
      this.takenCards = new Set(cardsData.takenCards.map(c => c.card));
      this.totalCardsTaken.textContent = this.takenCards.size;
    } catch (error) {
      console.error('Failed to load taken cards:', error);
    }
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
      
      this.cardsGrid.appendChild(cardElement);
    }
  }

  async selectCard(cardNumber) {
    // Check if we're in selection phase
    if (!this.gameState.isSelectionPhase()) {
      BingoUtils.showNotification('Card selection is not available now', 'warning');
      return;
    }
    
    // Check if card is already selected
    const index = this.gameState.selectedCards.indexOf(cardNumber);
    
    if (index > -1) {
      // Deselect card
      this.gameState.selectedCards.splice(index, 1);
      BingoUtils.showNotification(`Card #${cardNumber} deselected`, 'info');
    } else {
      // Check max cards
      if (this.gameState.selectedCards.length >= this.maxCards) {
        BingoUtils.showNotification(`You can only select ${this.maxCards} cards maximum`, 'warning');
        return;
      }
      
      // Try to take card on server
      const result = await synchronizedGame.takeCard(cardNumber, this.gameState.playerId);
      
      if (result.success) {
        this.gameState.selectedCards.push(cardNumber);
        this.takenCards.add(cardNumber);
        BingoUtils.showNotification(`Card #${cardNumber} selected!`, 'success');
      } else {
        BingoUtils.showNotification(result.message || 'Card not available', 'error');
        return;
      }
    }
    
    this.updateCardElements();
    this.updateSelectedCardsDisplay();
    this.updateDisplays();
  }

  updateCardElements() {
    document.querySelectorAll('.card-number').forEach(card => {
      const cardNum = parseInt(card.dataset.cardNumber);
      card.classList.remove('selected');
      
      if (this.gameState.selectedCards.includes(cardNum)) {
        card.classList.add('selected');
      }
    });
  }

  updateSelectedCardsDisplay() {
    this.card1Number.textContent = this.gameState.selectedCards[0] || '--';
    this.card2Number.textContent = this.gameState.selectedCards[1] || '--';
    
    this.updateCardPreview(1, this.gameState.selectedCards[0]);
    this.updateCardPreview(2, this.gameState.selectedCards[1]);
    
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
        previewElement.appendChild(cell);
      }
      return;
    }
    
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
    this.cardsSelected.textContent = this.gameState.selectedCards.length;
    this.activePlayers.textContent = synchronizedGame.getCurrentGameState()?.activePlayers || 0;
  }

  updateTimerDisplay() {
    const timeLeft = this.gameState.getTimeToNextPhase();
    
    if (this.selectionTimer) {
      this.selectionTimer.textContent = BingoUtils.formatTime(timeLeft);
      this.updateTimerColor(timeLeft);
    }
  }

  updateTimerColor(timeLeft) {
    if (!this.selectionTimer) return;
    
    if (timeLeft <= 10) {
      this.selectionTimer.style.color = '#ff4b4b';
    } else if (timeLeft <= 30) {
      this.selectionTimer.style.color = '#ff9e00';
    } else {
      this.selectionTimer.style.color = '#00b4d8';
    }
  }

  startSyncUpdates() {
    this.syncInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
  }

  async proceedToGame() {
    if (this.gameState.selectedCards.length === 0) {
      // No cards selected - stay as observer
      return;
    }
    
    this.loadingOverlay.classList.add('active');
    this.loadingText.textContent = 'Joining Game...';
    
    // Save game state
    this.gameState.saveToSession();
    
    setTimeout(() => {
      window.location.href = 'game.html';
    }, 1500);
  }

  enterAsObserver() {
    this.gameState.isObserver = true;
    this.gameState.saveToSession();
    
    this.loadingOverlay.classList.add('active');
    this.loadingText.textContent = 'Entering as Observer...';
    
    setTimeout(() => {
      window.location.href = 'game.html';
    }, 1500);
  }

  setupEventListeners() {
    this.randomSelectBtn.addEventListener('click', () => this.randomSelectCards());
    this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
    
    if (this.observerBtn) {
      this.observerBtn.addEventListener('click', () => this.enterAsObserver());
    }
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('Page hidden - pausing updates');
      }
    });
  }

  randomSelectCards() {
    // Only allow random selection during selection phase
    if (!this.gameState.isSelectionPhase()) {
      BingoUtils.showNotification('Random selection only available during selection phase', 'warning');
      return;
    }
    
    // Clear existing selection
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
    
    this.updateCardElements();
    this.updateSelectedCardsDisplay();
    this.updateDisplays();
    
    const selectedCardsText = this.gameState.selectedCards.join(', ');
    BingoUtils.showNotification(`Randomly selected cards: ${selectedCardsText}`, 'success');
  }

  clearSelection() {
    this.gameState.selectedCards = [];
    this.updateCardElements();
    this.updateSelectedCardsDisplay();
    this.updateDisplays();
    BingoUtils.showNotification('Selection cleared!', 'info');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChooseCardsPage();
});