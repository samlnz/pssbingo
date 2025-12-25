// Game page functionality - UPDATED WITH READY ANIMATION

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
        this.isGameActive = false; // Start inactive
        this.winDetected = false;
        this.readyAnimationActive = true; // New: Track ready animation
        
        // Track winning pattern details
        this.winningPatternData = {
            card1: { winningCells: [], winningLines: [], winningPatterns: [] },
            card2: { winningCells: [], winningLines: [], winningPatterns: [] }
        };
        
        this.init();
    }

    init() {
        this.loadGameState();
        this.setupUserInfo();
        this.generateBingoCards();
        this.initializeDisplays();
        this.startReadyAnimation(); // NEW: Start with ready animation
        this.setupAudio();
        this.checkForExistingCalls();
        this.setupEventListeners();
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
            
            // Get fixed card numbers
            const bingoNumbers = BingoUtils.getCardNumbers(cardNumber);
            
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
                    const isFreeSpace = row === 2 && col === 2;
                    
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
                if (!this.isGameActive) return;
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

    updateCardStats(cardId) {
        const markedCount = this.gameState.markedNumbers[cardId].size + 1; // +1 for FREE space
        const linesCount = this.gameState.winningLines[cardId].length;
        
        document.getElementById(`${cardId}-marked`).textContent = markedCount;
        document.getElementById(`${cardId}-lines`).textContent = linesCount;
        
        this.updateBingoButton();
    }

    // UPDATED: More accurate winning line detection
    checkForWinningLine(cardId) {
        if (this.winDetected) return;
        
        const winningLines = [];
        const allMarked = new Set(this.gameState.markedNumbers[cardId]);
        allMarked.add('FREE');
        
        // Store patterns for winner page
        const patterns = [];
        
        // Check rows
        for (let row = 0; row < 5; row++) {
            let isComplete = true;
            let rowCells = [];
            let rowPattern = [];
            
            for (let col = 0; col < 5; col++) {
                const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
                const number = cell.dataset.number;
                rowCells.push(cell);
                rowPattern.push(cell.dataset.index);
                
                if (!allMarked.has(number === 'FREE' ? 'FREE' : parseInt(number))) {
                    isComplete = false;
                }
            }
            
            if (isComplete && !this.gameState.winningLines[cardId].includes(`row${row}`)) {
                winningLines.push(`row${row}`);
                patterns.push({
                    type: 'row',
                    index: row,
                    cells: rowPattern
                });
                
                rowCells.forEach(cell => {
                    const cellIndex = parseInt(cell.dataset.index);
                    if (!this.winningPatternData[cardId].winningCells.includes(cellIndex)) {
                        this.winningPatternData[cardId].winningCells.push(cellIndex);
                        cell.classList.add('winning');
                    }
                });
            }
        }
        
        // Check columns
        for (let col = 0; col < 5; col++) {
            let isComplete = true;
            let colCells = [];
            let colPattern = [];
            
            for (let row = 0; row < 5; row++) {
                const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
                const number = cell.dataset.number;
                colCells.push(cell);
                colPattern.push(cell.dataset.index);
                
                if (!allMarked.has(number === 'FREE' ? 'FREE' : parseInt(number))) {
                    isComplete = false;
                }
            }
            
            if (isComplete && !this.gameState.winningLines[cardId].includes(`col${col}`)) {
                winningLines.push(`col${col}`);
                patterns.push({
                    type: 'column',
                    index: col,
                    cells: colPattern
                });
                
                colCells.forEach(cell => {
                    const cellIndex = parseInt(cell.dataset.index);
                    if (!this.winningPatternData[cardId].winningCells.includes(cellIndex)) {
                        this.winningPatternData[cardId].winningCells.push(cellIndex);
                        cell.classList.add('winning');
                    }
                });
            }
        }
        
        // Check diagonal (top-left to bottom-right)
        let diagonal1Complete = true;
        let diag1Cells = [];
        let diag1Pattern = [];
        for (let i = 0; i < 5; i++) {
            const cell = document.querySelector(`[data-card="${cardId}"][data-row="${i}"][data-col="${i}"]`);
            const number = cell.dataset.number;
            diag1Cells.push(cell);
            diag1Pattern.push(cell.dataset.index);
            
            if (!allMarked.has(number === 'FREE' ? 'FREE' : parseInt(number))) {
                diagonal1Complete = false;
            }
        }
        if (diagonal1Complete && !this.gameState.winningLines[cardId].includes('diag1')) {
            winningLines.push('diag1');
            patterns.push({
                type: 'diagonal',
                direction: 'top-left to bottom-right',
                cells: diag1Pattern
            });
            
            diag1Cells.forEach(cell => {
                const cellIndex = parseInt(cell.dataset.index);
                if (!this.winningPatternData[cardId].winningCells.includes(cellIndex)) {
                    this.winningPatternData[cardId].winningCells.push(cellIndex);
                    cell.classList.add('winning');
                }
            });
        }
        
        // Check diagonal (top-right to bottom-left)
        let diagonal2Complete = true;
        let diag2Cells = [];
        let diag2Pattern = [];
        for (let i = 0; i < 5; i++) {
            const cell = document.querySelector(`[data-card="${cardId}"][data-row="${i}"][data-col="${4 - i}"]`);
            const number = cell.dataset.number;
            diag2Cells.push(cell);
            diag2Pattern.push(cell.dataset.index);
            
            if (!allMarked.has(number === 'FREE' ? 'FREE' : parseInt(number))) {
                diagonal2Complete = false;
            }
        }
        if (diagonal2Complete && !this.gameState.winningLines[cardId].includes('diag2')) {
            winningLines.push('diag2');
            patterns.push({
                type: 'diagonal',
                direction: 'top-right to bottom-left',
                cells: diag2Pattern
            });
            
            diag2Cells.forEach(cell => {
                const cellIndex = parseInt(cell.dataset.index);
                if (!this.winningPatternData[cardId].winningCells.includes(cellIndex)) {
                    this.winningPatternData[cardId].winningCells.push(cellIndex);
                    cell.classList.add('winning');
                }
            });
        }
        
        // Check four corners
        let cornersComplete = true;
        const corners = [
            [0, 0],
            [0, 4],
            [4, 0],
            [4, 4]
        ];
        let cornerCells = [];
        let cornerPattern = [];
        
        corners.forEach(([row, col]) => {
            const cell = document.querySelector(`[data-card="${cardId}"][data-row="${row}"][data-col="${col}"]`);
            const number = cell.dataset.number;
            cornerCells.push(cell);
            cornerPattern.push(cell.dataset.index);
            
            if (!allMarked.has(number === 'FREE' ? 'FREE' : parseInt(number))) {
                cornersComplete = false;
            }
        });
        
        if (cornersComplete && !this.gameState.winningLines[cardId].includes('corners')) {
            winningLines.push('corners');
            patterns.push({
                type: 'four-corners',
                cells: cornerPattern
            });
            
            cornerCells.forEach(cell => {
                const cellIndex = parseInt(cell.dataset.index);
                if (!this.winningPatternData[cardId].winningCells.includes(cellIndex)) {
                    this.winningPatternData[cardId].winningCells.push(cellIndex);
                    cell.classList.add('winning-corner');
                }
            });
        }
        
        // Save patterns for winner page
        if (patterns.length > 0) {
            this.winningPatternData[cardId].winningPatterns.push(...patterns);
        }
        
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
        
        clearInterval(this.callIntervalId);
        clearInterval(this.gameTimerId);
        clearInterval(this.nextCallTimerId);
        
        this.callIntervalId = null;
        this.gameTimerId = null;
        this.nextCallTimerId = null;
        
        this.bingoBtn.disabled = true;
        this.autoMarkBtn.disabled = true;
        
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
        if (!this.isGameActive) return;
        
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

    checkForExistingCalls() {
        // Don't generate initial calls - wait for ready animation
    }

    // NEW: Start with ready animation
    startReadyAnimation() {
        this.showReadyMessage();
        
        // After 3 seconds, start the game
        setTimeout(() => {
            this.startGame();
        }, 3000);
    }

    // NEW: Show "READY" animation
    showReadyMessage() {
        const currentNumberDisplay = document.querySelector('.current-number-display');
        const currentNumber = document.getElementById('currentNumber');
        const numberLetter = document.getElementById('numberLetter');
        
        if (currentNumberDisplay && currentNumber && numberLetter) {
            // Show "READY" animation
            currentNumber.textContent = 'READY';
            numberLetter.textContent = '';
            this.currentNumberDisplay.textContent = 'GET READY!';
            
            // Style for ready animation
            currentNumber.style.fontSize = '3.5rem';
            currentNumber.style.color = '#4CAF50';
            currentNumber.style.textShadow = '0 0 20px rgba(76, 175, 80, 0.8)';
            currentNumber.style.animation = 'pulse 1s infinite';
            
            // Update timer display
            this.nextCallTimer.textContent = '03';
            
            // Countdown from 3
            let count = 3;
            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    this.nextCallTimer.textContent = count.toString().padStart(2, '0');
                } else {
                    clearInterval(countdownInterval);
                    this.nextCallTimer.textContent = '05';
                }
            }, 1000);
        }
    }

    // NEW: Start game after ready animation
    startGame() {
        this.isGameActive = true;
        this.readyAnimationActive = false;
        
        // Reset number display
        const currentNumber = document.getElementById('currentNumber');
        if (currentNumber) {
            currentNumber.style.fontSize = '4rem';
            currentNumber.style.animation = 'none';
            currentNumber.textContent = '00';
            currentNumber.style.color = '#00b4d8';
        }
        
        this.startTimers();
        
        // Generate initial calls
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
        
        BingoUtils.showNotification('Game Started! Numbers will be called every 5 seconds.', 'success');
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
        // Start calling numbers immediately after ready
        this.callNextNumber();
        
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
                    winningPatterns: this.winningPatternData.card1.winningPatterns
                },
                card2: {
                    numbers: card2Numbers,
                    markedNumbers: markedNumbers2,
                    winningCells: this.winningPatternData.card2.winningCells,
                    winningLines: this.winningPatternData.card2.winningLines,
                    winningPatterns: this.winningPatternData.card2.winningPatterns
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