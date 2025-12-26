// GAME.JS - Fully synchronized with server
class GamePage {
    constructor() {
        this.gameState = gameState;
        this.server = serverClient;
        
        // DOM elements
        this.currentNumberDisplay = document.getElementById('currentNumberDisplay');
        this.currentNumber = document.getElementById('currentNumber');
        this.numberLetter = document.getElementById('numberLetter');
        this.numbersCalled = document.getElementById('numbersCalled');
        this.gameTime = document.getElementById('gameTime');
        this.activePlayers = document.getElementById('activePlayers');
        this.nextCallTimer = document.getElementById('nextCallTimer');
        this.playerCardsContainer = document.getElementById('playerCardsContainer');
        this.playerName = document.getElementById('playerName');
        this.playerAvatar = document.getElementById('playerAvatar');
        this.autoMarkBtn = document.getElementById('autoMarkBtn');
        this.bingoBtn = document.getElementById('bingoBtn');
        this.audioToggle = document.getElementById('audioToggle');
        
        // Audio elements
        this.numberCallAudio = document.getElementById('numberCallAudio');
        this.bingoAudio = document.getElementById('bingoAudio');
        this.backgroundMusic = document.getElementById('backgroundMusic');
        
        // Game state
        this.bingoNumbers = {};
        this.isGameActive = false;
        this.gameStartTime = Date.now();
        this.gameTimer = null;
        this.calledNumbers = new Set();
        
        // Check if we have cards
        if (!this.gameState.selectedCards || this.gameState.selectedCards.length === 0) {
            // Redirect back to card selection
            setTimeout(() => {
                BingoUtils.showNotification('No cards selected! Redirecting...', 'error');
                window.location.href = 'choose-cards.html';
            }, 2000);
            return;
        }
        
        this.init();
    }
    
    init() {
        console.log('Initializing game page...');
        
        this.setupUserInfo();
        this.generateBingoCards();
        this.setupAudio();
        this.setupServerListeners();
        this.setupEventListeners();
        
        // Show READY animation if game hasn't started yet
        const gamePhase = this.server.getGamePhase();
        if (gamePhase === 'ready' || gamePhase === 'playing') {
            this.showReadyAnimation();
        }
    }
    
    setupUserInfo() {
        this.playerName.textContent = this.gameState.playerName;
        this.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
        
        // Generate random avatar color
        const colors = ['#00b4d8', '#0077b6', '#0096c7', '#005f8a', '#03045e'];
        this.playerAvatar.style.background = colors[Math.floor(Math.random() * colors.length)];
    }
    
    setupServerListeners() {
        // When connected to server
        this.server.on('connected', () => {
            console.log('Game page connected to server');
        });
        
        // Game phase change
        this.server.on('game-phase-change', (phase) => {
            console.log('Game phase:', phase);
            this.handleGamePhase(phase);
        });
        
        // Number called
        this.server.on('number-called', (numberData) => {
            console.log('Number called:', numberData.full);
            this.handleNumberCalled(numberData);
        });
        
        // Winner declared
        this.server.on('winner-declared', (winner) => {
            console.log('Winner declared:', winner);
            this.handleWinner(winner);
        });
        
        // Initialize with current server state
        const serverState = this.server.serverGameState;
        if (serverState.calledNumbers && serverState.calledNumbers.length > 0) {
            serverState.calledNumbers.forEach(num => {
                this.calledNumbers.add(num);
                this.autoMarkNumbers(num);
            });
            this.numbersCalled.textContent = this.calledNumbers.size;
        }
    }
    
    handleGamePhase(phase) {
        switch(phase) {
            case 'ready':
                this.showReadyAnimation();
                break;
                
            case 'playing':
                this.startGame();
                break;
                
            case 'ended':
                this.stopGame();
                break;
        }
    }
    
    handleNumberCalled(numberData) {
        // Add to called numbers
        this.calledNumbers.add(numberData.number);
        this.numbersCalled.textContent = this.calledNumbers.size;
        
        // Update display
        this.updateNumberDisplay(numberData);
        
        // Auto-mark numbers
        if (this.gameState.isAutoMark) {
            this.autoMarkNumbers(numberData.number);
        }
        
        // Play audio
        BingoUtils.playAudio(this.numberCallAudio, 0.7);
        
        // Check for wins
        this.checkAllCardsForWin();
    }
    
    handleWinner(winner) {
        console.log('Game won by:', winner.playerName);
        
        // Stop game
        this.stopGame();
        
        // Check if this player is the winner
        if (winner.playerId === this.gameState.playerId) {
            // This player won!
            this.handlePlayerWin(winner);
        } else {
            // Another player won
            BingoUtils.showNotification(`${winner.playerName} won the game!`, 'info');
            
            // Redirect to card selection after delay
            setTimeout(() => {
                window.location.href = 'choose-cards.html';
            }, 5000);
        }
    }
    
    handlePlayerWin(winnerData) {
        // Save winner data
        const winnerInfo = {
            playerName: winnerData.playerName,
            playerId: winnerData.playerId,
            cardNumber: winnerData.cardNumber,
            pattern: winnerData.pattern,
            gameTime: Math.floor((Date.now() - this.gameStartTime) / 1000),
            calledNumbers: this.calledNumbers.size,
            timestamp: Date.now()
        };
        
        // Save to session storage
        try {
            sessionStorage.setItem('bingoWinner', JSON.stringify(winnerInfo));
        } catch (error) {
            console.error('Error saving winner data:', error);
        }
        
        // Play victory audio
        BingoUtils.playAudio(this.bingoAudio, 0.8);
        
        // Show victory message
        BingoUtils.showNotification('🎉 BINGO! YOU WIN! 🎉', 'success');
        
        // Redirect to winner page
        setTimeout(() => {
            window.location.href = 'winner.html';
        }, 2000);
    }
    
    showReadyAnimation() {
        // Create READY overlay
        const readyOverlay = document.createElement('div');
        readyOverlay.className = 'ready-overlay';
        readyOverlay.innerHTML = `
            <div class="ready-container">
                <div class="ready-text">READY</div>
                <div class="countdown">3</div>
            </div>
        `;
        
        document.body.appendChild(readyOverlay);
        
        // Animate READY text
        const readyText = readyOverlay.querySelector('.ready-text');
        const letters = readyText.textContent.split('');
        readyText.innerHTML = '';
        letters.forEach((letter, index) => {
            const span = document.createElement('span');
            span.textContent = letter;
            span.style.animationDelay = `${index * 0.1}s`;
            readyText.appendChild(span);
        });
        
        // Countdown from 3
        let countdown = 3;
        const countdownElement = readyOverlay.querySelector('.countdown');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                countdownElement.textContent = countdown;
                countdownElement.classList.add('pulse');
                setTimeout(() => countdownElement.classList.remove('pulse'), 300);
            } else {
                clearInterval(countdownInterval);
                countdownElement.textContent = 'GO!';
                countdownElement.classList.add('go-animation');
                
                // Remove overlay and start game
                setTimeout(() => {
                    readyOverlay.classList.add('fade-out');
                    setTimeout(() => {
                        document.body.removeChild(readyOverlay);
                        this.startGame();
                    }, 500);
                }, 1000);
            }
        }, 1000);
    }
    
    startGame() {
        console.log('Starting game...');
        
        this.isGameActive = true;
        this.gameStartTime = Date.now();
        
        // Start game timer
        this.startGameTimer();
        
        // Play background music if enabled
        if (this.gameState.isAudioEnabled && this.backgroundMusic) {
            this.backgroundMusic.volume = 0.3;
            this.backgroundMusic.play().catch(e => console.log('Audio play failed:', e));
        }
        
        BingoUtils.showNotification('Game started! Numbers will be called every 5 seconds', 'success');
    }
    
    stopGame() {
        console.log('Stopping game...');
        
        this.isGameActive = false;
        
        // Stop timers
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        // Stop background music
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
        }
        
        // Disable buttons
        if (this.bingoBtn) {
            this.bingoBtn.disabled = true;
        }
        if (this.autoMarkBtn) {
            this.autoMarkBtn.disabled = true;
        }
    }
    
    startGameTimer() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.gameTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.gameTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    generateBingoCards() {
        this.playerCardsContainer.innerHTML = '';
        
        this.gameState.selectedCards.forEach((cardNumber, index) => {
            const cardId = `card${index + 1}`;
            
            // Get deterministic card numbers
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
                    <span class="card-type">(Fixed Pattern)</span>
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
        
        // Add click handlers
        const cells = cardElement.querySelectorAll('.grid-cell:not(.free)');
        cells.forEach(cell => {
            cell.addEventListener('click', () => {
                const cardId = cell.dataset.card;
                const number = parseInt(cell.dataset.number);
                this.toggleNumberMark(cardId, number, cell);
            });
        });
        
        return cardElement;
    }
    
    toggleNumberMark(cardId, number, cell) {
        if (!this.isGameActive) return;
        
        const markedNumbers = this.gameState.markedNumbers[cardId];
        
        if (markedNumbers.has(number)) {
            markedNumbers.delete(number);
            cell.classList.remove('marked');
        } else {
            markedNumbers.add(number);
            cell.classList.add('marked');
            
            this.checkForWinningLine(cardId);
        }
        
        this.updateCardStats(cardId);
    }
    
    autoMarkNumbers(number) {
        if (!this.calledNumbers.has(number)) return;
        
        this.gameState.selectedCards.forEach((_, index) => {
            const cardId = `card${index + 1}`;
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
    
    updateNumberDisplay(numberData) {
        this.currentNumber.style.transform = 'scale(0.5)';
        this.currentNumber.style.opacity = '0';
        
        setTimeout(() => {
            this.currentNumber.textContent = numberData.number.toString().padStart(2, '0');
            this.numberLetter.textContent = numberData.letter;
            this.currentNumberDisplay.textContent = `${numberData.letter}-${numberData.number}`;
            
            // Set color based on letter
            const letterColors = {
                'B': '#FF0000',
                'I': '#00FF00',
                'N': '#0000FF',
                'G': '#FFFF00',
                'O': '#FF00FF'
            };
            
            if (letterColors[numberData.letter]) {
                this.currentNumber.style.color = letterColors[numberData.letter];
                this.numberLetter.style.color = letterColors[numberData.letter];
            }
            
            this.currentNumber.style.transform = 'scale(1)';
            this.currentNumber.style.opacity = '1';
            this.currentNumber.classList.add('animate-number-pop');
            
            setTimeout(() => {
                this.currentNumber.classList.remove('animate-number-pop');
            }, 500);
        }, 300);
    }
    
    checkForWinningLine(cardId) {
        if (!this.isGameActive) return;
        
        const markedNumbers = this.gameState.markedNumbers[cardId];
        const patterns = this.getWinningPatterns();
        
        patterns.forEach((pattern, patternIndex) => {
            let isComplete = true;
            let allNumbersCalled = true;
            
            pattern.forEach(([row, col]) => {
                const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
                if (!cell) return;
                
                const number = cell.dataset.number;
                
                if (number !== 'FREE' && !markedNumbers.has(parseInt(number))) {
                    isComplete = false;
                }
                
                if (number !== 'FREE' && !this.calledNumbers.has(parseInt(number))) {
                    allNumbersCalled = false;
                }
            });
            
            if (isComplete && allNumbersCalled) {
                const patternName = this.getPatternName(patternIndex);
                this.handleWinningPattern(cardId, pattern, patternName);
            }
        });
        
        this.updateCardStats(cardId);
    }
    
    checkAllCardsForWin() {
        this.gameState.selectedCards.forEach((_, index) => {
            const cardId = `card${index + 1}`;
            this.checkForWinningLine(cardId);
        });
    }
    
    handleWinningPattern(cardId, pattern, patternName) {
        // Check if this pattern is already recorded
        const existingIndex = this.gameState.winningLines[cardId].findIndex(
            line => line.name === patternName
        );
        
        if (existingIndex === -1) {
            // Add to winning lines
            this.gameState.winningLines[cardId].push({
                name: patternName,
                pattern: pattern
            });
            
            // Highlight cells
            pattern.forEach(([row, col]) => {
                const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add('winning');
                }
            });
            
            console.log(`Winning pattern on ${cardId}: ${patternName}`);
            this.updateBingoButton();
        }
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
            [[0,4], [1,3], [2,2], [3,1], [4,0]],
            // Four corners
            [[0,0], [0,4], [4,0], [4,4]]
        ];
    }
    
    getPatternName(patternIndex) {
        if (patternIndex < 5) return `Row ${patternIndex + 1}`;
        if (patternIndex < 10) return `Column ${String.fromCharCode(65 + (patternIndex - 5))}`;
        if (patternIndex === 10) return 'Diagonal (Top-Left to Bottom-Right)';
        if (patternIndex === 11) return 'Diagonal (Top-Right to Bottom-Left)';
        if (patternIndex === 12) return 'Four Corners';
        return `Pattern ${patternIndex + 1}`;
    }
    
    updateCardStats(cardId) {
        const markedCount = this.gameState.markedNumbers[cardId].size + 1; // +1 for free space
        const linesCount = this.gameState.winningLines[cardId].length;
        
        document.getElementById(`${cardId}-marked`).textContent = markedCount;
        document.getElementById(`${cardId}-lines`).textContent = linesCount;
        
        this.updateBingoButton();
    }
    
    updateBingoButton() {
        const hasWinningLine = 
            this.gameState.winningLines.card1.length > 0 || 
            this.gameState.winningLines.card2.length > 0;
        
        this.bingoBtn.disabled = !hasWinningLine;
        
        if (hasWinningLine) {
            const totalLines = 
                this.gameState.winningLines.card1.length + 
                this.gameState.winningLines.card2.length;
            
            this.bingoBtn.innerHTML = `<i class="fas fa-trophy"></i> BINGO! (${totalLines} Line${totalLines > 1 ? 's' : ''})`;
        } else {
            this.bingoBtn.innerHTML = `<i class="fas fa-trophy"></i> BINGO! I HAVE A LINE!`;
        }
    }
    
    setupAudio() {
        if (this.numberCallAudio) this.numberCallAudio.volume = 0.7;
        if (this.bingoAudio) this.bingoAudio.volume = 0.8;
        if (this.backgroundMusic) this.backgroundMusic.volume = 0.3;
    }
    
    setupEventListeners() {
        // Auto-mark toggle
        this.autoMarkBtn.addEventListener('click', () => {
            this.gameState.isAutoMark = !this.gameState.isAutoMark;
            this.autoMarkBtn.innerHTML = this.gameState.isAutoMark ? 
                `<i class="fas fa-robot"></i> AUTO-MARK: ON` :
                `<i class="fas fa-robot"></i> AUTO-MARK: OFF`;
            this.autoMarkBtn.style.background = this.gameState.isAutoMark ?
                'linear-gradient(135deg, #4CAF50, #2E7D32)' :
                'linear-gradient(135deg, #f44336, #c62828)';
            
            this.gameState.saveToSession();
        });
        
        // BINGO button
        this.bingoBtn.addEventListener('click', () => {
            if (this.bingoBtn.disabled || !this.isGameActive) return;
            
            // Find which card has winning pattern
            let winningCardId = null;
            let winningPattern = null;
            
            ['card1', 'card2'].forEach(cardId => {
                if (this.gameState.winningLines[cardId].length > 0) {
                    winningCardId = cardId;
                    winningPattern = this.gameState.winningLines[cardId][0].name;
                }
            });
            
            if (winningCardId && winningPattern) {
                const cardNumber = this.gameState.selectedCards[winningCardId === 'card1' ? 0 : 1];
                
                // Claim win on server
                this.server.claimWin(cardNumber, winningPattern);
                
                // Show confirmation
                BingoUtils.showNotification('Claiming BINGO win!', 'success');
            }
        });
        
        // Audio toggle
        this.audioToggle.addEventListener('click', () => {
            this.gameState.isAudioEnabled = !this.gameState.isAudioEnabled;
            
            if (this.gameState.isAudioEnabled) {
                this.audioToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
                this.audioToggle.style.color = '#00b4d8';
                this.audioToggle.style.borderColor = '#00b4d8';
                
                if (this.isGameActive && this.backgroundMusic) {
                    this.backgroundMusic.play().catch(e => console.log('Audio play failed:', e));
                }
            } else {
                this.audioToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
                this.audioToggle.style.color = '#ff4b4b';
                this.audioToggle.style.borderColor = '#ff4b4b';
                
                if (this.backgroundMusic) {
                    this.backgroundMusic.pause();
                }
            }
            
            this.gameState.saveToSession();
        });
        
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Game paused');
                if (this.backgroundMusic) {
                    this.backgroundMusic.pause();
                }
            } else {
                console.log('Game resumed');
                if (this.gameState.isAudioEnabled && this.backgroundMusic && this.isGameActive) {
                    this.backgroundMusic.play().catch(e => console.log('Audio play failed:', e));
                }
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GamePage();
});