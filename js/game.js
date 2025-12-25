// Game page functionality

class GamePage {
    constructor() {
        this.gameState = gameState;
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
        
        // NEW: Ready animation elements
        this.readyOverlay = null;
        this.readyText = null;
        
        // Audio elements
        this.numberCallAudio = document.getElementById('numberCallAudio');
        this.bingoAudio = document.getElementById('bingoAudio');
        this.backgroundMusic = document.getElementById('backgroundMusic');
        
        // Game state
        this.bingoNumbers = {};
        this.nextCallTime = 5;
        this.callIntervalId = null;
        this.gameTimerId = null;
        this.nextCallTimerId = null;
        this.callInterval = 5000;
        this.isGameActive = true;
        this.winDetected = false;
        this.isReadyPhase = true; // NEW: Ready phase flag
        
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
        this.generateBingoCards();
        this.initializeDisplays();
        this.setupAudio();
        this.checkForExistingCalls();
        this.setupEventListeners();
        
        // NEW: Start with READY animation
        this.startReadyAnimation();
    }

    // NEW: Ready animation method
    startReadyAnimation() {
        // Create ready overlay
        this.readyOverlay = document.createElement('div');
        this.readyOverlay.className = 'ready-overlay';
        this.readyOverlay.innerHTML = `
            <div class="ready-container">
                <div class="ready-text animate-pulse">READY</div>
                <div class="ready-subtext">Game starting in 3 seconds...</div>
            </div>
        `;
        document.querySelector('.game-container').appendChild(this.readyOverlay);
        
        this.readyText = this.readyOverlay.querySelector('.ready-text');
        
        // Animate READY text
        let count = 3;
        const countdownInterval = setInterval(() => {
            if (count > 1) {
                this.readyText.textContent = `${count - 1}`;
                this.readyText.classList.add('animate-number-pop');
                setTimeout(() => {
                    this.readyText.classList.remove('animate-number-pop');
                }, 500);
                count--;
            } else {
                clearInterval(countdownInterval);
                this.readyText.textContent = "GO!";
                this.readyText.classList.add('animate-glow');
                
                // Remove overlay and start game after 1 second
                setTimeout(() => {
                    this.readyOverlay.remove();
                    this.isReadyPhase = false;
                    this.startTimers();
                    BingoUtils.showNotification('Game Started! Numbers will be called every 5 seconds', 'success');
                }, 1000);
            }
        }, 1000);
    }

    loadGameState() {
        this.gameState.loadFromSession();
    }

    setupUserInfo() {
        this.playerName.textContent = this.gameState.playerName;
        this.playerAvatar.textContent = this.gameState.playerName.charAt(0).toUpperCase();
    }

    generateBingoCards() {
        this.playerCardsContainer.innerHTML = '';
        
        // Generate cards based on selection
        this.gameState.selectedCards.forEach((cardNumber, index) => {
            const cardId = `card${index + 1}`;
            
            // ALWAYS use persistent card generation
            const bingoNumbers = BingoUtils.generatePersistentBingoCard(cardNumber);
            
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
                    <span class="card-type">(PERSISTENT)</span>
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
                    const isFreeSpace = row === 2 && col === 2;
                    
                    return `
                        <div class="grid-cell ${isFreeSpace ? 'free marked' : ''}" 
                             data-card="${cardId}" 
                             data-number="${isFreeSpace ? 'FREE' : number}"
                             data-row="${row}" 
                             data-col="${col}"
                             data-index="${i}"
                             data-called="${this.gameState.calledNumbers.has(number) ? 'true' : 'false'}">
                            ${isFreeSpace ? 'FREE' : number}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="card-stats">
                <div class="stat">
                    <div class="stat-value" id="${cardId}-marked">1</div>
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
                if (this.isReadyPhase) return;
                const cardId = cell.dataset.card;
                const number = parseInt(cell.dataset.number);
                this.toggleNumberMark(cardId, number, cell);
            });
        });
        
        return cardElement;
    }

    toggleNumberMark(cardId, number, cell) {
        if (!this.isGameActive || this.isReadyPhase) return;
        
        const markedNumbers = this.gameState.markedNumbers[cardId];
        
        if (markedNumbers.has(number)) {
            markedNumbers.delete(number);
            cell.classList.remove('marked');
        } else {
            // Only allow marking if number has been called
            if (!this.gameState.calledNumbers.has(number)) {
                BingoUtils.showNotification(`Number ${number} hasn't been called yet!`, 'warning');
                return;
            }
            
            markedNumbers.add(number);
            cell.classList.add('marked');
            
            this.checkForWinningLine(cardId);
        }
        
        this.updateCardStats(cardId);
    }

    updateCardStats(cardId) {
        const markedCount = this.gameState.markedNumbers[cardId].size + 1; // +1 for free space
        const linesCount = this.gameState.winningLines[cardId].length;
        
        document.getElementById(`${cardId}-marked`).textContent = markedCount;
        document.getElementById(`${cardId}-lines`).textContent = linesCount;
        
        this.updateBingoButton();
    }

    // UPDATED: Improved winning pattern detection
    checkForWinningLine(cardId) {
        if (this.winDetected || this.isReadyPhase) return;
        
        const winningLines = [];
        const markedNumbers = this.gameState.markedNumbers[cardId];
        
        // Check all possible winning patterns
        const patterns = this.getWinningPatterns();
        
        patterns.forEach(pattern => {
            if (this.isPatternComplete(cardId, pattern, markedNumbers)) {
                winningLines.push(pattern.name);
                
                // Store winning cells
                pattern.cells.forEach(cellIndex => {
                    if (!this.winningPatternData[cardId].winningCells.includes(cellIndex)) {
                        this.winningPatternData[cardId].winningCells.push(cellIndex);
                        
                        // Highlight winning cell
                        const cell = document.querySelector(`[data-card="${cardId}"][data-index="${cellIndex}"]`);
                        if (cell) {
                            cell.classList.add('winning');
                            cell.classList.add('animate-pulse');
                        }
                    }
                });
                
                if (!this.winningPatternData[cardId].winningLines.includes(pattern.name)) {
                    this.winningPatternData[cardId].winningLines.push(pattern.name);
                }
            }
        });
        
        winningLines.forEach(line => {
            if (!this.gameState.winningLines[cardId].includes(line)) {
                this.gameState.winningLines[cardId].push(line);
            }
        });
        
        if (winningLines.length > 0) {
            this.checkForAutoWin();
        }
        
        this.updateCardStats(cardId);
    }

    // NEW: Get all possible winning patterns
    getWinningPatterns() {
        return [
            // Rows
            { name: 'row1', cells: [0, 1, 2, 3, 4] },
            { name: 'row2', cells: [5, 6, 7, 8, 9] },
            { name: 'row3', cells: [10, 11, 12, 13, 14] },
            { name: 'row4', cells: [15, 16, 17, 18, 19] },
            { name: 'row5', cells: [20, 21, 22, 23, 24] },
            
            // Columns
            { name: 'colB', cells: [0, 5, 10, 15, 20] },
            { name: 'colI', cells: [1, 6, 11, 16, 21] },
            { name: 'colN', cells: [2, 7, 12, 17, 22] },
            { name: 'colG', cells: [3, 8, 13, 18, 23] },
            { name: 'colO', cells: [4, 9, 14, 19, 24] },
            
            // Diagonals
            { name: 'diag1', cells: [0, 6, 12, 18, 24] },
            { name: 'diag2', cells: [4, 8, 12, 16, 20] },
            
            // Four Corners
            { name: 'corners', cells: [0, 4, 20, 24] }
        ];
    }

    // NEW: Check if a pattern is complete
    isPatternComplete(cardId, pattern, markedNumbers) {
        const freeSpaceIndex = 12; // Center is free
        
        for (const cellIndex of pattern.cells) {
            if (cellIndex === freeSpaceIndex) continue; // Free space is always marked
            
            const cell = document.querySelector(`[data-card="${cardId}"][data-index="${cellIndex}"]`);
            if (!cell) return false;
            
            const number = parseInt(cell.dataset.number);
            
            // For four corners pattern, check only corners
            if (pattern.name === 'corners') {
                if (![0, 4, 20, 24].includes(cellIndex)) continue;
            }
            
            // Number must be called AND marked
            if (!this.gameState.calledNumbers.has(number) || !markedNumbers.has(number)) {
                return false;
            }
        }
        
        return true;
    }

    checkForAutoWin() {
        const totalLines = this.gameState.winningLines.card1.length + this.gameState.winningLines.card2.length;
        
        if (totalLines > 0 && !this.winDetected) {
            this.winDetected = true;
            this.stopGame();
            
            // Wait 2 seconds to show the winning pattern, then go to winner page
            setTimeout(() => {
                this.claimBingo();
            }, 2000);
        }
    }

    stopGame() {
        this.isGameActive = false;
        
        if (this.callIntervalId) clearInterval(this.callIntervalId);
        if (this.gameTimerId) clearInterval(this.gameTimerId);
        if (this.nextCallTimerId) clearInterval(this.nextCallTimerId);
        
        this.callIntervalId = null;
        this.gameTimerId = null;
        this.nextCallTimerId = null;
        
        this.bingoBtn.disabled = true;
        this.autoMarkBtn.disabled = true;
        
        BingoUtils.playAudio(this.bingoAudio, 0.8);
        BingoUtils.showNotification('BINGO! Game stopped. Preparing winner announcement...', 'success');
    }

    updateBingoButton() {
        const hasWinningLine = this.gameState.winningLines.card1.length > 0 || this.gameState.winningLines.card2.length > 0;
        this.bingoBtn.disabled = !hasWinningLine;
        
        if (hasWinningLine) {
            const totalLines = this.gameState.winningLines.card1.length + this.gameState.winningLines.card2.length;
            this.bingoBtn.innerHTML = `<i class="fas fa-trophy"></i> BINGO! (${totalLines} Line${totalLines > 1 ? 's' : ''})`;
        } else {
            this.bingoBtn.innerHTML = `<i class="fas fa-trophy"></i> BINGO! I HAVE A LINE!`;
        }
    }

    initializeDisplays() {
        this.createCalledNumbersGrid();
        this.updateDisplays();
    }

    createCalledNumbersGrid() {
        // Keep existing called numbers grid code
        // ... (existing code remains the same)
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
        this.activePlayers.textContent = this.gameState.activePlayers;
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
        if (!this.isGameActive || this.isReadyPhase) return;
        
        const number = this.generateNextNumber();
        if (!number) {
            this.endGame();
            return;
        }
        
        this.gameState.calledNumbers.add(number);
        
        this.updateNumberDisplay(number);
        this.updateCalledNumbersDisplay();
        
        if (this.gameState.isAutoMark) {
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
        if (!this.gameState.calledNumbers.has(number) || this.isReadyPhase) return;
        
        this.gameState.selectedCards.forEach((_, index) => {
            const cardId = `card${index + 1}`;
            const bingoNumbers = this.bingoNumbers[cardId];
            
            if (bingoNumbers.includes(number)) {
                const cells = document.querySelectorAll(`[data-card="${cardId}"]`);
                cells.forEach(cell => {
                    if (parseInt(cell.dataset.number) === number) {
                        this.gameState.markedNumbers[cardId].add(number);
                        cell.classList.add('marked');
                        cell.dataset.called = 'true';
                        
                        this.checkForWinningLine(cardId);
                    }
                });
            }
        });
    }

    checkForExistingCalls() {
        // Don't generate initial calls during ready phase
        if (this.isReadyPhase) return;
        
        const initialCalls = 5;
        for (let i = 0; i < initialCalls; i++) {
            const number = this.generateNextNumber();
            if (number) {
                this.gameState.calledNumbers.add(number);
                
                if (this.gameState.isAutoMark) {
                    this.autoMarkNumbers(number);
                }
            }
        }
        
        this.updateCalledNumbersDisplay();
        this.numbersCalled.textContent = this.gameState.calledNumbers.size;
    }

    startTimers() {
        this.startGameTimer();
        this.startCaller();
    }

    startGameTimer() {
        this.gameTimerId = setInterval(() => {
            this.gameState.gameTime++;
            
            const minutes = Math.floor(this.gameState.gameTime / 60);
            const seconds = this.gameState.gameTime % 60;
            this.gameTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    startCaller() {
        // Start calling numbers immediately after ready phase
        setTimeout(() => this.callNextNumber(), 1000);
        
        this.callIntervalId = setInterval(() => {
            this.callNextNumber();
        }, this.callInterval);
        
        this.startNextCallTimer();
    }

    startNextCallTimer() {
        this.nextCallTimerId = setInterval(() => {
            this.nextCallTime--;
            this.updateNextCallTimer();
            
            if (this.nextCallTime <= 0) {
                this.nextCallTime = 5;
            }
        }, 1000);
    }

    updateNextCallTimer() {
        this.nextCallTimer.textContent = this.nextCallTime.toString().padStart(2, '0');
    }

    setupAudio() {
        if (this.numberCallAudio) this.numberCallAudio.volume = 0.7;
        if (this.bingoAudio) this.bingoAudio.volume = 0.8;
        if (this.backgroundMusic) this.backgroundMusic.volume = 0.3;
        
        if (this.gameState.isAudioEnabled && this.backgroundMusic) {
            this.backgroundMusic.play().catch(e => console.log('Background music play failed:', e));
        }
    }

    endGame() {
        this.stopGame();
        BingoUtils.showNotification('All numbers have been called! Game over.', 'info');
    }

    setupEventListeners() {
        this.autoMarkBtn.addEventListener('click', () => {
            if (!this.isGameActive || this.isReadyPhase) return;
            
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
            if (this.bingoBtn.disabled || !this.isGameActive || this.isReadyPhase) return;
            
            this.stopGame();
            this.claimBingo();
        });
        
        this.audioToggle.addEventListener('click', () => {
            this.gameState.isAudioEnabled = !this.gameState.isAudioEnabled;
            
            if (this.gameState.isAudioEnabled) {
                this.audioToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
                this.audioToggle.style.color = '#00b4d8';
                this.audioToggle.style.borderColor = '#00b4d8';
                
                if (this.backgroundMusic) {
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
                if (this.gameState.isAudioEnabled && this.backgroundMusic) {
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
            // Save detailed winning pattern data
            winningPatternData: this.winningPatternData,
            // Save card data for displaying on winner page
            cardData: {
                card1: {
                    numbers: card1Numbers,
                    markedNumbers: markedNumbers1,
                    winningCells: this.winningPatternData.card1.winningCells,
                    winningLines: this.winningPatternData.card1.winningLines,
                    // Add called numbers for verification
                    calledNumbers: Array.from(this.gameState.calledNumbers)
                },
                card2: {
                    numbers: card2Numbers,
                    markedNumbers: markedNumbers2,
                    winningCells: this.winningPatternData.card2.winningCells,
                    winningLines: this.winningPatternData.card2.winningLines,
                    calledNumbers: Array.from(this.gameState.calledNumbers)
                }
            }
        };
        
        console.log('Saving winner data to sessionStorage:', winnerData);
        
        // Save to sessionStorage
        try {
            sessionStorage.setItem('bingoWinner', JSON.stringify(winnerData));
            console.log('Winner data saved successfully');
        } catch (error) {
            console.error('Error saving winner data:', error);
        }
        
        this.sendWinData(winnerData);
        
        // Redirect immediately to winner page
        console.log('Redirecting to winner page...');
        setTimeout(() => {
            window.location.href = 'winner.html';
        }, 500);
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