// ====================================================
// GAME.JS - SIMPLE SERVER-CONTROLLED VERSION
// ====================================================

class GamePage {
    constructor() {
        this.initializeElements();
        this.initializeState();
        this.initializeSocket();
        this.initializeGame();
    }
    
    initializeElements() {
        // Game elements
        this.currentNumberElement = document.getElementById('currentNumber');
        this.numberLetterElement = document.getElementById('numberLetter');
        this.currentNumberDisplay = document.getElementById('currentNumberDisplay');
        this.numbersCalledElement = document.getElementById('numbersCalled');
        this.gameTimeElement = document.getElementById('gameTime');
        this.activePlayersElement = document.getElementById('activePlayers');
        this.nextCallTimerElement = document.getElementById('nextCallTimer');
        this.playerCardsContainer = document.getElementById('playerCardsContainer');
        this.playerNameElement = document.getElementById('playerName');
        this.playerAvatarElement = document.getElementById('playerAvatar');
        this.autoMarkBtn = document.getElementById('autoMarkBtn');
        this.bingoBtn = document.getElementById('bingoBtn');
        this.audioToggle = document.getElementById('audioToggle');
        
        // Audio
        this.numberCallAudio = document.getElementById('numberCallAudio');
        this.bingoAudio = document.getElementById('bingoAudio');
        this.backgroundMusic = document.getElementById('backgroundMusic');
    }
    
    initializeState() {
        this.gameState = {
            selectedCards: [],
            calledNumbers: new Set(),
            markedNumbers: { card1: new Set(), card2: new Set() },
            winningLines: { card1: [], card2: [] },
            isAudioEnabled: true,
            isAutoMark: true
        };
        
        // Try to load from session storage
        this.loadFromSession();
        
        // Bingo card data
        this.bingoNumbers = {};
        this.isGameActive = false;
        this.gameStartTime = null;
        this.lastNumberTime = null;
    }
    
    initializeSocket() {
        // Connect to server
        const serverUrl = window.location.origin.replace(/^http/, 'ws');
        this.socket = io(serverUrl);
        
        // Setup event listeners
        this.setupSocketEvents();
    }
    
    setupSocketEvents() {
        // Initial state
        this.socket.on('initial-state', (data) => {
            this.handleInitialState(data);
        });
        
        // Game state updates
        this.socket.on('game-state-update', (data) => {
            this.handleGameStateUpdate(data);
        });
        
        // Player registered
        this.socket.on('player-registered', (data) => {
            console.log('Player registered:', data);
        });
        
        // Selection timer
        this.socket.on('selection-timer', (data) => {
            console.log('Selection time left:', data.seconds);
        });
        
        // Game active
        this.socket.on('game-active', (data) => {
            this.handleGameActive(data);
        });
        
        // Card events
        this.socket.on('card-selected', (data) => {
            console.log('Card selected:', data);
        });
        
        this.socket.on('card-taken', (data) => {
            console.log('Card taken by someone else:', data);
        });
        
        // Winner declared
        this.socket.on('winner-declared', (winner) => {
            this.handleWinner(winner);
        });
    }
    
    handleInitialState(data) {
        console.log('Initial game state:', data.gameState);
        
        // Update local state with server state
        const serverState = data.gameState;
        
        // Update called numbers
        if (serverState.calledNumbers) {
            serverState.calledNumbers.forEach(num => {
                this.gameState.calledNumbers.add(num);
                this.markNumberOnCards(num);
            });
        }
        
        // Update player count
        if (serverState.playerCount !== undefined) {
            this.activePlayersElement.textContent = serverState.playerCount;
        }
        
        // Update game status
        if (serverState.phase === 'playing' && serverState.gameActive) {
            this.startGame();
            
            if (serverState.gameStartTime) {
                this.gameStartTime = serverState.gameStartTime;
                this.updateGameTimer();
            }
        }
        
        // Update called numbers display
        this.updateCalledNumbersDisplay();
        this.numbersCalledElement.textContent = this.gameState.calledNumbers.size;
    }
    
    handleGameStateUpdate(data) {
        const serverState = data.gameState;
        
        // Update player count
        if (serverState.playerCount !== undefined) {
            this.activePlayersElement.textContent = serverState.playerCount;
        }
        
        // Check for new called numbers
        if (serverState.calledNumbers && serverState.currentNumber) {
            const newNumber = serverState.currentNumber;
            
            if (!this.gameState.calledNumbers.has(newNumber)) {
                // New number called
                this.gameState.calledNumbers.add(newNumber);
                this.handleNewNumberCalled(newNumber, serverState.calledNumbers.length);
            }
        }
        
        // Update game phase
        if (serverState.phase === 'playing' && !this.isGameActive) {
            this.startGame();
        }
    }
    
    handleGameActive(data) {
        this.updateGameTimer();
    }
    
    handleNewNumberCalled(number, totalCalled) {
        console.log('New number called:', number);
        
        // Update display
        this.updateNumberDisplay(number);
        
        // Update called numbers count
        this.numbersCalledElement.textContent = totalCalled;
        
        // Update called numbers grid
        this.updateCalledNumbersDisplay();
        
        // Auto-mark on cards if enabled
        if (this.gameState.isAutoMark) {
            this.autoMarkNumber(number);
        }
        
        // Play sound
        this.playNumberSound();
        
        // Update last number time
        this.lastNumberTime = Date.now();
    }
    
    handleWinner(winner) {
        console.log('Winner declared:', winner);
        
        // Stop game
        this.isGameActive = false;
        
        // Save winner data
        this.saveWinnerData(winner);
        
        // Redirect to winner page
        setTimeout(() => {
            window.location.href = 'winner.html';
        }, 2000);
    }
    
    initializeGame() {
        // Set up user info
        this.setupUserInfo();
        
        // Generate bingo cards
        this.generateBingoCards();
        
        // Set up called numbers grid
        this.createCalledNumbersGrid();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start game timer if game is active
        if (this.isGameActive) {
            this.startGameTimer();
        }
    }
    
    setupUserInfo() {
        // Get player name from session or default
        const playerName = sessionStorage.getItem('playerName') || 'Player';
        this.playerNameElement.textContent = playerName;
        this.playerAvatarElement.textContent = playerName.charAt(0).toUpperCase();
    }
    
    generateBingoCards() {
        this.playerCardsContainer.innerHTML = '';
        
        // Get selected cards from session
        const selectedCards = JSON.parse(sessionStorage.getItem('selectedCards')) || [];
        this.gameState.selectedCards = selectedCards;
        
        selectedCards.forEach((cardNumber, index) => {
            const cardId = `card${index + 1}`;
            const bingoNumbers = BingoUtils.generateBingoCardNumbers(cardNumber);
            this.bingoNumbers[cardId] = bingoNumbers;
            
            const cardElement = this.createBingoCard(cardNumber, cardId, bingoNumbers);
            this.playerCardsContainer.appendChild(cardElement);
        });
    }
    
    createBingoCard(cardNumber, cardId, bingoNumbers) {
        const cardElement = document.createElement('div');
        cardElement.className = 'bingo-card';
        cardElement.id = cardId;
        
        const cardHTML = `
            <div class="card-header">
                <h3 class="card-title">
                    <i class="fas fa-dice-${cardId === 'card1' ? 'one' : 'two'}"></i>
                    CARD #${cardNumber}
                </h3>
                <div class="card-number">#${cardNumber}</div>
            </div>
            
            <div class="bingo-grid">
                ${['B', 'I', 'N', 'G', 'O'].map(letter => 
                    `<div class="grid-header">${letter}</div>`
                ).join('')}
                
                ${Array.from({ length: 25 }, (_, i) => {
                    const row = Math.floor(i / 5);
                    const col = i % 5;
                    const numberIndex = col * 5 + row;
                    const number = bingoNumbers[numberIndex];
                    const isFreeSpace = number === 0;
                    
                    return `
                        <div class="grid-cell ${isFreeSpace ? 'free marked' : ''}" 
                             data-card="${cardId}" 
                             data-number="${isFreeSpace ? 'FREE' : number}"
                             data-row="${row}" 
                             data-col="${col}"
                             data-index="${i}">
                            ${isFreeSpace ? 'FREE' : number}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="card-stats">
                <div class="stat">
                    <div class="stat-value" id="${cardId}-marked">0</div>
                    <div class="stat-label">Marked</div>
                </div>
                <div class="stat">
                    <div class="stat-value" id="${cardId}-needed">5</div>
                    <div class="stat-label">To Win</div>
                </div>
                <div class="stat">
                    <div class="stat-value" id="${cardId}-lines">0</div>
                    <div class="stat-label">Lines</div>
                </div>
            </div>
        `;
        
        cardElement.innerHTML = cardHTML;
        
        // Add click handlers to cells
        const cells = cardElement.querySelectorAll('.grid-cell:not(.free)');
        cells.forEach(cell => {
            cell.addEventListener('click', () => {
                this.toggleNumberMark(cell);
            });
        });
        
        return cardElement;
    }
    
    createCalledNumbersGrid() {
        // This would create the grid of 75 numbers
        // Implementation similar to previous version
    }
    
    startGame() {
        if (this.isGameActive) return;
        
        this.isGameActive = true;
        this.gameStartTime = Date.now();
        
        console.log('Game started');
        
        // Start game timer
        this.startGameTimer();
        
        // Enable bingo button
        if (this.bingoBtn) {
            this.bingoBtn.disabled = false;
        }
    }
    
    startGameTimer() {
        setInterval(() => {
            this.updateGameTimer();
        }, 1000);
    }
    
    updateGameTimer() {
        if (this.gameStartTime && this.isGameActive) {
            const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.gameTimeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    updateNumberDisplay(number) {
        const letter = this.getLetterForNumber(number);
        const letterColors = {
            'B': '#FF0000', 'I': '#00FF00', 'N': '#0000FF', 
            'G': '#FFFF00', 'O': '#FF00FF'
        };
        
        // Animate number display
        this.currentNumberElement.style.transform = 'scale(0.5)';
        this.currentNumberElement.style.opacity = '0';
        
        setTimeout(() => {
            this.currentNumberElement.textContent = number.toString().padStart(2, '0');
            this.numberLetterElement.textContent = letter;
            this.currentNumberDisplay.textContent = `${letter}-${number}`;
            
            if (letterColors[letter]) {
                this.currentNumberElement.style.color = letterColors[letter];
                this.numberLetterElement.style.color = letterColors[letter];
            }
            
            this.currentNumberElement.style.transform = 'scale(1)';
            this.currentNumberElement.style.opacity = '1';
        }, 300);
    }
    
    getLetterForNumber(number) {
        if (number <= 15) return 'B';
        if (number <= 30) return 'I';
        if (number <= 45) return 'N';
        if (number <= 60) return 'G';
        return 'O';
    }
    
    updateCalledNumbersDisplay() {
        // Update the called numbers grid
        this.gameState.calledNumbers.forEach(number => {
            const element = document.querySelector(`.called-number[data-number="${number}"]`);
            if (element) {
                element.classList.add('called');
            }
        });
    }
    
    autoMarkNumber(number) {
        if (!this.gameState.calledNumbers.has(number)) return;
        
        Object.keys(this.bingoNumbers).forEach(cardId => {
            const bingoNumbers = this.bingoNumbers[cardId];
            
            if (bingoNumbers.includes(number)) {
                const cells = document.querySelectorAll(`[data-card="${cardId}"]`);
                cells.forEach(cell => {
                    if (parseInt(cell.dataset.number) === number) {
                        this.gameState.markedNumbers[cardId].add(number);
                        cell.classList.add('marked');
                        this.checkForWinningLine(cardId);
                    }
                });
            }
        });
    }
    
    markNumberOnCards(number) {
        Object.keys(this.bingoNumbers).forEach(cardId => {
            const bingoNumbers = this.bingoNumbers[cardId];
            
            if (bingoNumbers.includes(number)) {
                const cells = document.querySelectorAll(`[data-card="${cardId}"]`);
                cells.forEach(cell => {
                    if (parseInt(cell.dataset.number) === number) {
                        this.gameState.markedNumbers[cardId].add(number);
                        cell.classList.add('marked');
                    }
                });
            }
        });
    }
    
    toggleNumberMark(cell) {
        if (!this.isGameActive) return;
        
        const cardId = cell.dataset.card;
        const number = parseInt(cell.dataset.number);
        
        if (this.gameState.markedNumbers[cardId].has(number)) {
            this.gameState.markedNumbers[cardId].delete(number);
            cell.classList.remove('marked');
        } else {
            this.gameState.markedNumbers[cardId].add(number);
            cell.classList.add('marked');
        }
        
        this.checkForWinningLine(cardId);
        this.updateCardStats(cardId);
    }
    
    checkForWinningLine(cardId) {
        // Check for winning patterns
        const patterns = this.getWinningPatterns();
        const markedNumbers = this.gameState.markedNumbers[cardId];
        
        patterns.forEach((pattern, patternIndex) => {
            let isComplete = true;
            
            pattern.forEach(([row, col]) => {
                const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
                if (!cell) return;
                
                const number = cell.dataset.number;
                if (number !== 'FREE' && !markedNumbers.has(parseInt(number))) {
                    isComplete = false;
                }
            });
            
            if (isComplete && pattern.length === 5) {
                this.handleWinningLine(cardId, patternIndex, pattern);
            }
        });
    }
    
    getWinningPatterns() {
        return [
            // Rows
            [[0,0], [0,1], [0,2], [0,3], [0,4]],
            [[1,0], [1,1], [1,2], [1,3], [1,4]],
            [[2,0], [2,1], [2,2], [2,3], [2,4]],
            [[3,0], [3,1], [3,2], [3,3], [3,4]],
            [[4,0], [4,1], [4,2], [4,3], [4,4]],
            // Columns
            [[0,0], [1,0], [2,0], [3,0], [4,0]],
            [[0,1], [1,1], [2,1], [3,1], [4,1]],
            [[0,2], [1,2], [2,2], [3,2], [4,2]],
            [[0,3], [1,3], [2,3], [3,3], [4,3]],
            [[0,4], [1,4], [2,4], [3,4], [4,4]],
            // Diagonals
            [[0,0], [1,1], [2,2], [3,3], [4,4]],
            [[0,4], [1,3], [2,2], [3,1], [4,0]]
        ];
    }
    
    handleWinningLine(cardId, patternIndex, pattern) {
        // Check if this winning line is already recorded
        const patternName = this.getPatternName(patternIndex);
        
        if (!this.gameState.winningLines[cardId].includes(patternName)) {
            this.gameState.winningLines[cardId].push(patternName);
            
            // Highlight winning cells
            pattern.forEach(([row, col]) => {
                const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add('winning');
                }
            });
            
            this.updateCardStats(cardId);
            this.checkForBingo();
        }
    }
    
    getPatternName(patternIndex) {
        if (patternIndex < 5) return `Row ${patternIndex + 1}`;
        if (patternIndex < 10) return `Column ${String.fromCharCode(65 + (patternIndex - 5))}`;
        if (patternIndex === 10) return 'Diagonal (\\\\)';
        return 'Diagonal (/)';
    }
    
    updateCardStats(cardId) {
        const markedCount = this.gameState.markedNumbers[cardId].size + 1; // +1 for FREE
        const linesCount = this.gameState.winningLines[cardId].length;
        
        document.getElementById(`${cardId}-marked`).textContent = markedCount;
        document.getElementById(`${cardId}-lines`).textContent = linesCount;
        
        // Update bingo button
        this.updateBingoButton();
    }
    
    checkForBingo() {
        const totalLines = this.gameState.winningLines.card1.length + 
                         this.gameState.winningLines.card2.length;
        
        if (totalLines > 0 && this.bingoBtn) {
            this.bingoBtn.disabled = false;
            this.bingoBtn.innerHTML = `<i class="fas fa-trophy"></i> BINGO! (${totalLines} Line${totalLines > 1 ? 's' : ''})`;
        }
    }
    
    updateBingoButton() {
        const totalLines = this.gameState.winningLines.card1.length + 
                         this.gameState.winningLines.card2.length;
        
        if (this.bingoBtn) {
            this.bingoBtn.disabled = totalLines === 0;
            
            if (totalLines > 0) {
                this.bingoBtn.innerHTML = `<i class="fas fa-trophy"></i> BINGO! (${totalLines} Line${totalLines > 1 ? 's' : ''})`;
            }
        }
    }
    
    playNumberSound() {
        if (this.numberCallAudio && this.gameState.isAudioEnabled) {
            this.numberCallAudio.currentTime = 0;
            this.numberCallAudio.play().catch(e => console.log('Audio play failed:', e));
        }
    }
    
    setupEventListeners() {
        // Auto-mark toggle
        if (this.autoMarkBtn) {
            this.autoMarkBtn.addEventListener('click', () => {
                this.gameState.isAutoMark = !this.gameState.isAutoMark;
                
                this.autoMarkBtn.innerHTML = this.gameState.isAutoMark ? 
                    `<i class="fas fa-robot"></i> AUTO-MARK: ON` :
                    `<i class="fas fa-robot"></i> AUTO-MARK: OFF`;
                
                this.autoMarkBtn.style.background = this.gameState.isAutoMark ?
                    'linear-gradient(135deg, #4CAF50, #2E7D32)' :
                    'linear-gradient(135deg, #f44336, #c62828)';
                
                this.saveToSession();
            });
        }
        
        // Bingo button
        if (this.bingoBtn) {
            this.bingoBtn.addEventListener('click', () => {
                this.claimBingo();
            });
        }
        
        // Audio toggle
        if (this.audioToggle) {
            this.audioToggle.addEventListener('click', () => {
                this.gameState.isAudioEnabled = !this.gameState.isAudioEnabled;
                
                if (this.gameState.isAudioEnabled) {
                    this.audioToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
                    this.audioToggle.style.color = '#00b4d8';
                } else {
                    this.audioToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
                    this.audioToggle.style.color = '#ff4b4b';
                    
                    if (this.backgroundMusic) {
                        this.backgroundMusic.pause();
                    }
                }
                
                this.saveToSession();
            });
        }
    }
    
    claimBingo() {
        // Get winning card data
        const winningCardId = this.gameState.winningLines.card1.length > 0 ? 'card1' : 'card2';
        const cardNumber = this.gameState.selectedCards[winningCardId === 'card1' ? 0 : 1];
        
        const winnerData = {
            playerName: this.playerNameElement.textContent,
            playerId: sessionStorage.getItem('playerId') || '0000',
            cardNumbers: this.gameState.selectedCards,
            winningLines: {
                card1: this.gameState.winningLines.card1,
                card2: this.gameState.winningLines.card2
            },
            totalLines: this.gameState.winningLines.card1.length + 
                       this.gameState.winningLines.card2.length,
            gameTime: this.gameStartTime ? Math.floor((Date.now() - this.gameStartTime) / 1000) : 0,
            calledNumbers: this.gameState.calledNumbers.size,
            cardData: {
                card1: {
                    numbers: this.bingoNumbers.card1 || [],
                    markedNumbers: Array.from(this.gameState.markedNumbers.card1),
                    winningLines: this.gameState.winningLines.card1
                },
                card2: {
                    numbers: this.bingoNumbers.card2 || [],
                    markedNumbers: Array.from(this.gameState.markedNumbers.card2),
                    winningLines: this.gameState.winningLines.card2
                }
            }
        };
        
        // Save winner data
        this.saveWinnerData(winnerData);
        
        // Send win claim to server
        if (this.socket && cardNumber) {
            this.socket.emit('claim-win', {
                playerId: winnerData.playerId,
                playerName: winnerData.playerName,
                cardNumber: cardNumber,
                pattern: winnerData.winningLines[winningCardId][0] || 'Line'
            });
        }
        
        // Redirect to winner page
        setTimeout(() => {
            window.location.href = 'winner.html';
        }, 1500);
    }
    
    saveWinnerData(winnerData) {
        try {
            sessionStorage.setItem('bingoWinner', JSON.stringify(winnerData));
        } catch (error) {
            console.error('Error saving winner data:', error);
        }
    }
    
    loadFromSession() {
        try {
            const saved = sessionStorage.getItem('bingoGameState');
            if (saved) {
                const data = JSON.parse(saved);
                Object.assign(this.gameState, data);
            }
        } catch (error) {
            console.error('Error loading from session:', error);
        }
    }
    
    saveToSession() {
        try {
            sessionStorage.setItem('bingoGameState', JSON.stringify(this.gameState));
        } catch (error) {
            console.error('Error saving to session:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GamePage();
});