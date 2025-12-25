// ====================================================
// GAME.JS - Updated with Global Sync and Grid READY
// ====================================================

class GamePage {
    constructor() {
        this.gameState = gameState;
        this.globalGameState = globalGameState;
        this.telegramManager = telegramManager;
        
        // BINGO ranges
        this.BINGO_RANGES = {
            'B': { min: 1, max: 15 },
            'I': { min: 16, max: 30 },
            'N': { min: 31, max: 45 },
            'G': { min: 46, max: 60 },
            'O': { min: 61, max: 75 }
        };
        
        // DOM elements
        this.currentNumberDisplay = document.getElementById('currentNumberDisplay');
        this.currentNumber = document.getElementById('currentNumber');
        this.numberLetter = document.getElementById('numberLetter');
        this.calledNumbersGrid = document.getElementById('calledNumbersGrid');
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
        this.readySound = document.getElementById('readySound');
        
        // Game state
        this.bingoNumbers = {};
        this.nextCallTime = 5;
        this.callIntervalId = null;
        this.gameTimerId = null;
        this.nextCallTimerId = null;
        this.callInterval = 5000;
        this.isGameActive = false;
        this.winDetected = false;
        this.isObserver = false;
        
        // Track winning pattern details
        this.winningPatternData = {
            card1: { winningCells: [], winningLines: [] },
            card2: { winningCells: [], winningLines: [] }
        };
        
        this.init();
    }

    init() {
        this.loadGameState();
        this.setupUserInfo();
        this.initializeDisplays();
        this.setupAudio();
        this.setupEventListeners();
        
        // Check game synchronization
        this.checkGameSynchronization();
    }

    loadGameState() {
        this.gameState.loadFromSession();
        this.isObserver = this.gameState.isObserver || this.gameState.selectedCards.length === 0;
    }

    setupUserInfo() {
        this.playerName.textContent = this.gameState.playerName;
        this.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
    }

    checkGameSynchronization() {
        const isGameActive = this.globalGameState.isGameActive();
        const gameElapsed = this.globalGameState.getGameTimeElapsed();
        
        if (isGameActive && gameElapsed > 0) {
            // Game is already in progress
            this.handleGameInProgress(gameElapsed);
        } else if (!isGameActive) {
            // Wait for next game
            this.handleWaitingForGame();
        } else {
            // Game should start now
            this.startNewGame();
        }
    }

    handleGameInProgress(elapsedTime) {
        if (this.isObserver) {
            this.setupObserverMode();
            BingoUtils.showNotification('Joined as observer. Game in progress!', 'info');
        } else {
            this.generateBingoCards();
            BingoUtils.showNotification('Game in progress! Joining now...', 'info');
        }
        
        // Start game with elapsed time
        this.startGameWithElapsedTime(elapsedTime);
    }

    handleWaitingForGame() {
        const timeToNext = this.globalGameState.getTimeToNextGame();
        
        if (this.isObserver) {
            this.setupObserverMode();
            this.showWaitingMessage(timeToNext);
        } else {
            this.generateBingoCards();
            this.showWaitingMessage(timeToNext);
        }
        
        // Start countdown to next game
        this.startNextGameCountdown(timeToNext);
    }

    startNewGame() {
        if (this.isObserver) {
            this.setupObserverMode();
        } else {
            this.generateBingoCards();
        }
        
        // Show READY animation in the called numbers grid
        this.showReadyInGrid();
        
        // Start game after READY animation
        setTimeout(() => {
            this.startGame();
        }, 3000); // 3 seconds for READY animation
    }

    // NEW: READY animation in the called numbers grid
    showReadyInGrid() {
        const readyOverlay = document.createElement('div');
        readyOverlay.className = 'grid-ready-overlay';
        readyOverlay.innerHTML = `
            <div class="ready-text">READY</div>
        `;
        
        this.calledNumbersGrid.appendChild(readyOverlay);
        
        // Blink 3 times
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            readyOverlay.classList.toggle('visible');
            blinkCount++;
            
            if (blinkCount >= 6) { // 3 blinks (on/off = 2 states per blink)
                clearInterval(blinkInterval);
                setTimeout(() => {
                    readyOverlay.remove();
                }, 500);
            }
        }, 500);
        
        // Play ready sound
        if (this.readySound) {
            this.readySound.play().catch(e => console.log('Ready sound play failed:', e));
        }
    }

    setupObserverMode() {
        this.playerCardsContainer.innerHTML = `
            <div class="observer-message">
                <div class="observer-icon">
                    <i class="fas fa-eye"></i>
                </div>
                <h3>OBSERVER MODE</h3>
                <p>You are observing this game</p>
                <div class="observer-info">
                    <p><i class="fas fa-users"></i> Watch other players compete</p>
                    <p><i class="fas fa-bullhorn"></i> Numbers called every 5 seconds</p>
                    <p><i class="fas fa-trophy"></i> First complete line wins!</p>
                </div>
                <div class="next-round-info" id="nextRoundInfo">
                    <i class="fas fa-clock"></i>
                    <span>Next round starts in: <span id="nextRoundTimer">--:--</span></span>
                </div>
            </div>
        `;
        
        // Disable game controls for observers
        this.bingoBtn.disabled = true;
        this.bingoBtn.innerHTML = '<i class="fas fa-eye"></i> OBSERVER MODE';
        this.bingoBtn.style.background = 'linear-gradient(135deg, #666, #333)';
        
        this.autoMarkBtn.disabled = true;
        this.autoMarkBtn.innerHTML = '<i class="fas fa-eye"></i> OBSERVER MODE';
        this.autoMarkBtn.style.background = 'linear-gradient(135deg, #666, #333)';
    }

    showWaitingMessage(timeToNext) {
        if (this.isObserver) {
            const nextRoundInfo = document.getElementById('nextRoundInfo');
            if (nextRoundInfo) {
                nextRoundInfo.innerHTML = `
                    <i class="fas fa-clock"></i>
                    <span>Waiting for next round: <span id="nextRoundTimer">${BingoUtils.formatTime(timeToNext)}</span></span>
                `;
            }
        } else {
            this.playerCardsContainer.innerHTML = `
                <div class="waiting-message">
                    <div class="waiting-icon">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <h3>WAITING FOR NEXT ROUND</h3>
                    <p>Next game starts in: <span id="nextGameTimer">${BingoUtils.formatTime(timeToNext)}</span></p>
                    <div class="waiting-info">
                        <p><i class="fas fa-cards"></i> You have selected cards: ${this.gameState.selectedCards.join(', ')}</p>
                        <p><i class="fas fa-users"></i> Join the next game automatically</p>
                        <p><i class="fas fa-trophy"></i> Get ready to win!</p>
                    </div>
                </div>
            `;
            
            // Disable game controls while waiting
            this.bingoBtn.disabled = true;
            this.autoMarkBtn.disabled = true;
        }
    }

    startNextGameCountdown(timeToNext) {
        const timerElement = this.isObserver ? 
            document.getElementById('nextRoundTimer') : 
            document.getElementById('nextGameTimer');
        
        if (!timerElement) return;
        
        let remaining = timeToNext;
        
        const countdownInterval = setInterval(() => {
            remaining--;
            
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                timerElement.textContent = 'Starting...';
                
                // Reload page to join new game
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                timerElement.textContent = BingoUtils.formatTime(remaining);
            }
        }, 1000);
    }

    generateBingoCards() {
        this.playerCardsContainer.innerHTML = '';
        
        if (this.gameState.selectedCards.length === 0) {
            this.setupObserverMode();
            return;
        }
        
        this.gameState.selectedCards.forEach((cardNumber, index) => {
            const cardId = `card${index + 1}`;
            
            // Get deterministic card numbers for this card number
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

    startGame() {
        this.isGameActive = true;
        
        // Generate 5 initial numbers for the game
        this.generateInitialNumbers();
        
        // Start timers
        this.startTimers();
        this.startCaller();
        
        // Start background music if enabled
        if (this.gameState.isAudioEnabled && this.backgroundMusic) {
            this.backgroundMusic.play().catch(e => console.log('Background music play failed:', e));
        }
        
        BingoUtils.showNotification('Game started! Numbers called every 5 seconds', 'success');
    }

    startGameWithElapsedTime(elapsedTime) {
        this.isGameActive = true;
        
        // Generate numbers that would have been called up to now
        this.generateNumbersForElapsedTime(elapsedTime);
        
        // Start timers with elapsed time
        this.gameState.gameTime = elapsedTime;
        this.startTimers();
        this.startCaller();
        
        // Start background music if enabled
        if (this.gameState.isAudioEnabled && this.backgroundMusic) {
            this.backgroundMusic.play().catch(e => console.log('Background music play failed:', e));
        }
        
        BingoUtils.showNotification('Joined game in progress!', 'info');
    }

    generateInitialNumbers() {
        // Generate 5 initial numbers
        for (let i = 0; i < 5; i++) {
            const number = this.generateNextNumber();
            if (number) {
                this.gameState.calledNumbers.add(number);
                
                if (this.gameState.isAutoMark && !this.isObserver) {
                    this.autoMarkNumbers(number);
                }
            }
        }
        
        this.updateCalledNumbersDisplay();
        this.numbersCalled.textContent = this.gameState.calledNumbers.size;
    }

    generateNumbersForElapsedTime(elapsedTime) {
        // Calculate how many numbers should have been called
        const numbersCalled = Math.min(Math.floor(elapsedTime / 5) + 5, 75);
        
        // Generate those numbers
        for (let i = 0; i < numbersCalled; i++) {
            const number = this.generateNextNumber();
            if (number) {
                this.gameState.calledNumbers.add(number);
                
                if (this.gameState.isAutoMark && !this.isObserver) {
                    this.autoMarkNumbers(number);
                }
            }
        }
        
        this.updateCalledNumbersDisplay();
        this.numbersCalled.textContent = this.gameState.calledNumbers.size;
    }

    // [Rest of the game.js methods remain the same as before - toggleNumberMark, checkForWinningLine, etc.]
    // Only showing changes above due to character limit

    initializeDisplays() {
        this.createCalledNumbersGrid();
        this.updateDisplays();
    }

    createCalledNumbersGrid() {
        this.calledNumbersGrid.innerHTML = '';
        
        const columns = [
            { letter: 'B', min: 1, max: 15, color: '#FF0000' },
            { letter: 'I', min: 16, max: 30, color: '#00FF00' },
            { letter: 'N', min: 31, max: 45, color: '#0000FF' },
            { letter: 'G', min: 46, max: 60, color: '#FFFF00' },
            { letter: 'O', min: 61, max: 75, color: '#FF00FF' }
        ];
        
        columns.forEach(col => {
            const columnDiv = document.createElement('div');
            columnDiv.className = 'bingo-column';
            columnDiv.id = `column-${col.letter}`;
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'column-header';
            headerDiv.textContent = col.letter;
            headerDiv.style.color = col.color;
            headerDiv.style.borderColor = col.color;
            columnDiv.appendChild(headerDiv);
            
            const numbersContainer = document.createElement('div');
            numbersContainer.className = 'column-numbers';
            numbersContainer.id = `numbers-${col.letter}`;
            
            for (let i = col.min; i <= col.max; i++) {
                const numberElement = document.createElement('div');
                numberElement.className = 'called-number';
                numberElement.textContent = i;
                numberElement.dataset.number = i;
                numberElement.dataset.column = col.letter;
                numbersContainer.appendChild(numberElement);
            }
            
            columnDiv.appendChild(numbersContainer);
            this.calledNumbersGrid.appendChild(columnDiv);
        });
    }

    updateCalledNumbersDisplay() {
        this.gameState.calledNumbers.forEach(number => {
            const element = document.querySelector(`.called-number[data-number="${number}"]`);
            if (element) {
                element.classList.add('called');
                element.style.backgroundColor = '#4CAF50';
                element.style.color = '#FFFFFF';
                element.style.fontWeight = 'bold';
                element.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
            }
        });
        
        this.numbersCalled.textContent = this.gameState.calledNumbers.size;
    }

    updateDisplays() {
        this.activePlayers.textContent = Math.floor(Math.random() * 100) + 50; // Simulated
    }

    generateNextNumber() {
        if (this.gameState.calledNumbers.size >= 75) {
            return null;
        }
        
        let number;
        do {
            number = Math.floor(Math.random() * 75) + 1;
        } while (this.gameState.calledNumbers.has(number));
        
        return number;
    }

    callNextNumber() {
        if (!this.isGameActive) return;
        
        const number = this.generateNextNumber();
        if (!number) {
            this.endGame();
            return;
        }
        
        this.gameState.calledNumbers.add(number);
        
        this.updateNumberDisplay(number);
        this.updateCalledNumbersDisplay();
        
        if (this.gameState.isAutoMark && !this.isObserver) {
            this.autoMarkNumbers(number);
        }
        
        BingoUtils.playAudio(this.numberCallAudio, 0.7);
        
        this.nextCallTime = 5;
        this.updateNextCallTimer();
        
        this.gameState.saveToSession();
    }

    updateNumberDisplay(number) {
        let letter = '';
        for (const [l, range] of Object.entries(this.BINGO_RANGES)) {
            if (number >= range.min && number <= range.max) {
                letter = l;
                break;
            }
        }
        
        const letterColors = {
            'B': '#FF0000',
            'I': '#00FF00',
            'N': '#0000FF',
            'G': '#FFFF00',
            'O': '#FF00FF'
        };
        
        this.currentNumber.style.transform = 'scale(0.5)';
        this.currentNumber.style.opacity = '0';
        
        setTimeout(() => {
            this.currentNumber.textContent = number.toString().padStart(2, '0');
            this.numberLetter.textContent = letter;
            this.currentNumberDisplay.textContent = `${letter}-${number}`;
            
            if (letterColors[letter]) {
                this.currentNumber.style.color = letterColors[letter];
                this.numberLetter.style.color = letterColors[letter];
            }
            
            this.currentNumber.style.transform = 'scale(1)';
            this.currentNumber.style.opacity = '1';
            this.currentNumber.classList.add('animate-number-pop');
            
            setTimeout(() => {
                this.currentNumber.classList.remove('animate-number-pop');
            }, 500);
        }, 300);
    }

    autoMarkNumbers(number) {
        if (!this.gameState.calledNumbers.has(number)) return;
        
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

    startTimers() {
        this.startGameTimer();
    }

    startGameTimer() {
        if (this.gameTimerId) clearInterval(this.gameTimerId);
        
        this.gameTimerId = setInterval(() => {
            this.gameState.gameTime++;
            
            const minutes = Math.floor(this.gameState.gameTime / 60);
            const seconds = this.gameState.gameTime % 60;
            this.gameTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Check if game should end (5 minutes)
            if (this.gameState.gameTime >= 300) {
                this.endGame();
            }
        }, 1000);
    }

    startCaller() {
        // First call immediately
        this.callNextNumber();
        
        // Then every 5 seconds
        this.callIntervalId = setInterval(() => {
            this.callNextNumber();
        }, this.callInterval);
        
        this.startNextCallTimer();
    }

    startNextCallTimer() {
        if (this.nextCallTimerId) clearInterval(this.nextCallTimerId);
        
        this.nextCallTimerId = setInterval(() => {
            this.nextCallTime--;
            this.updateNextCallTimer();
            
            if (this.nextCallTime <= 0) {
                this.nextCallTime = 5;
            }
        }, 1000);
    }

    updateNextCallTimer() {
        if (this.nextCallTimer) {
            this.nextCallTimer.textContent = this.nextCallTime.toString().padStart(2, '0');
        }
    }

    setupAudio() {
        if (this.numberCallAudio) this.numberCallAudio.volume = 0.7;
        if (this.bingoAudio) this.bingoAudio.volume = 0.8;
        if (this.backgroundMusic) this.backgroundMusic.volume = 0.3;
        if (this.readySound) this.readySound.volume = 0.5;
    }

    endGame() {
        this.stopGame();
        BingoUtils.showNotification('Game ended! Next round starts soon.', 'info');
        
        // Start countdown to next game
        setTimeout(() => {
            const timeToNext = this.globalGameState.getTimeToNextGame();
            this.showWaitingMessage(timeToNext);
            this.startNextGameCountdown(timeToNext);
        }, 2000);
    }

    stopGame() {
        this.isGameActive = false;
        
        clearInterval(this.callIntervalId);
        clearInterval(this.gameTimerId);
        clearInterval(this.nextCallTimerId);
        
        this.callIntervalId = null;
        this.gameTimerId = null;
        this.nextCallTimerId = null;
        
        if (!this.isObserver) {
            this.bingoBtn.disabled = true;
            this.autoMarkBtn.disabled = true;
        }
    }

    setupEventListeners() {
        if (!this.isObserver) {
            this.autoMarkBtn.addEventListener('click', () => {
                if (!this.isGameActive) return;
                
                this.gameState.isAutoMark = !this.gameState.isAutoMark;
                this.autoMarkBtn.innerHTML = this.gameState.isAutoMark ? 
                    `<i class="fas fa-robot"></i> AUTO-MARK: ON` :
                    `<i class="fas fa-robot"></i> AUTO-MARK: OFF`;
                this.autoMarkBtn.style.background = this.gameState.isAutoMark ?
                    'linear-gradient(135deg, #4CAF50, #2E7D32)' :
                    'linear-gradient(135deg, #f44336, #c62828)';
                
                this.gameState.saveToSession();
            });
            
            this.bingoBtn.addEventListener('click', () => {
                if (this.bingoBtn.disabled || !this.isGameActive) return;
                
                this.stopGame();
                this.claimBingo();
            });
        }
        
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

    claimBingo() {
        // Get all marked numbers for each card
        const markedNumbers1 = Array.from(this.gameState.markedNumbers.card1);
        const markedNumbers2 = Array.from(this.gameState.markedNumbers.card2);
        
        // Get card numbers
        const card1Numbers = this.bingoNumbers.card1;
        const card2Numbers = this.bingoNumbers.card2;
        
        const winnerData = {
            playerName: this.gameState.playerName,
            playerId: this.gameState.playerId,
            cardNumbers: this.gameState.selectedCards,
            winningLines: {
                card1: this.gameState.winningLines.card1.length,
                card2: this.gameState.winningLines.card2.length
            },
            totalLines: this.gameState.winningLines.card1.length + this.gameState.winningLines.card2.length,
            gameTime: this.gameState.gameTime,
            calledNumbers: this.gameState.calledNumbers.size,
            winningPatternData: this.winningPatternData,
            cardData: {
                card1: {
                    numbers: card1Numbers,
                    markedNumbers: markedNumbers1,
                    winningCells: this.winningPatternData.card1.winningCells,
                    winningLines: this.winningPatternData.card1.winningLines.map(wl => wl.name)
                },
                card2: {
                    numbers: card2Numbers,
                    markedNumbers: markedNumbers2,
                    winningCells: this.winningPatternData.card2.winningCells,
                    winningLines: this.winningPatternData.card2.winningLines.map(wl => wl.name)
                }
            }
        };
        
        console.log('VERIFIED WINNER DATA:', winnerData);
        
        // Save to sessionStorage
        try {
            sessionStorage.setItem('bingoWinner', JSON.stringify(winnerData));
            console.log('Winner data saved successfully');
        } catch (error) {
            console.error('Error saving winner data:', error);
        }
        
        this.sendWinData(winnerData);
        
        // Redirect to winner page
        setTimeout(() => {
            window.location.href = 'winner.html';
        }, 1500);
    }

    sendWinData(winnerData) {
        const winData = {
            action: 'player_win',
            ...winnerData,
            timestamp: Date.now(),
            platform: 'telegram'
        };
        
        console.log('Sending win data:', winData);
        
        if (this.telegramManager.isInitialized) {
            this.telegramManager.sendData(winData);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GamePage();
});