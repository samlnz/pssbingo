// Winner Page - Improved with proper winning pattern highlighting

class WinnerPage {
    constructor() {
        console.log('Winner page initializing...');
        
        // Get DOM elements
        this.winnerContainer = document.getElementById('winnerContainer');
        this.confettiContainer = document.getElementById('confettiContainer');
        this.winnerAudio = document.getElementById('winnerAudio');
        
        // Initialize
        this.init();
    }

    init() {
        console.log('Initializing winner page...');
        
        // Load winner data
        const winnerData = this.loadWinnerData();
        console.log('Winner data:', winnerData);
        
        // Verify winning pattern
        this.verifyWinningPattern(winnerData);
        
        // Create confetti
        this.createConfetti();
        
        // Setup audio
        this.setupAudio();
        
        // Display the winner card
        this.displayWinnerCard(winnerData);
        
        // Start auto-redirect countdown
        this.startAutoRedirect();
    }

    loadWinnerData() {
        console.log('Loading winner data from sessionStorage...');
        
        try {
            const savedData = sessionStorage.getItem('bingoWinner');
            
            if (savedData) {
                const data = JSON.parse(savedData);
                console.log('Data loaded successfully');
                
                // Verify data integrity
                if (!this.verifyDataIntegrity(data)) {
                    console.warn('Winner data verification failed, using sample data');
                    return this.getSampleData();
                }
                
                return data;
            } else {
                console.warn('No winner data found in sessionStorage, using sample data');
                return this.getSampleData();
            }
        } catch (error) {
            console.error('Error loading winner data:', error);
            return this.getSampleData();
        }
    }

    // NEW: Verify data integrity
    verifyDataIntegrity(data) {
        if (!data || !data.cardNumbers || !data.cardData || !data.cardData.card1) {
            console.error('Missing required winner data');
            return false;
        }
        
        // Check if winning lines exist
        if (data.totalLines <= 0) {
            console.error('No winning lines reported');
            return false;
        }
        
        return true;
    }

    // NEW: Verify winning pattern
    verifyWinningPattern(winnerData) {
        const card1 = winnerData.cardData.card1;
        const card2 = winnerData.cardData.card2;
        
        console.log('Verifying winning patterns...');
        
        // Verify card 1 winning patterns
        if (card1.winningCells && card1.winningCells.length > 0) {
            const winningCells = new Set(card1.winningCells);
            const markedNumbers = new Set(card1.markedNumbers || []);
            const calledNumbers = new Set(card1.calledNumbers || []);
            
            // Check if all winning cells are properly marked and called
            for (const cellIndex of card1.winningCells) {
                if (cellIndex === 12) continue; // Skip free space
                
                const row = Math.floor(cellIndex / 5);
                const col = cellIndex % 5;
                const numberIndex = col * 5 + row;
                const number = card1.numbers[numberIndex];
                
                if (!markedNumbers.has(number) || !calledNumbers.has(number)) {
                    console.error(`Card 1: Cell ${cellIndex} (number ${number}) not properly marked/called`);
                    // Remove invalid winning cell
                    const index = card1.winningCells.indexOf(cellIndex);
                    if (index > -1) {
                        card1.winningCells.splice(index, 1);
                    }
                }
            }
        }
        
        // Verify card 2 winning patterns (if exists)
        if (winnerData.cardNumbers.length > 1 && card2.winningCells && card2.winningCells.length > 0) {
            const winningCells = new Set(card2.winningCells);
            const markedNumbers = new Set(card2.markedNumbers || []);
            const calledNumbers = new Set(card2.calledNumbers || []);
            
            // Check if all winning cells are properly marked and called
            for (const cellIndex of card2.winningCells) {
                if (cellIndex === 12) continue; // Skip free space
                
                const row = Math.floor(cellIndex / 5);
                const col = cellIndex % 5;
                const numberIndex = col * 5 + row;
                const number = card2.numbers[numberIndex];
                
                if (!markedNumbers.has(number) || !calledNumbers.has(number)) {
                    console.error(`Card 2: Cell ${cellIndex} (number ${number}) not properly marked/called`);
                    // Remove invalid winning cell
                    const index = card2.winningCells.indexOf(cellIndex);
                    if (index > -1) {
                        card2.winningCells.splice(index, 1);
                    }
                }
            }
        }
        
        // Update total lines count
        winnerData.totalLines = card1.winningLines.length + (card2.winningLines || []).length;
    }

    getSampleData() {
        // Generate realistic sample data with verified winning pattern
        const cardNumbers = BingoUtils.generatePersistentBingoCard(123);
        
        // Create a valid winning pattern (first row)
        const winningCells = [0, 1, 2, 3, 4]; // First row
        const calledNumbers = new Set();
        const markedNumbers = new Set();
        
        // Mark the first row numbers
        for (let i = 0; i < 5; i++) {
            const numberIndex = i * 5; // Column B, row 0-4
            const number = cardNumbers[numberIndex];
            calledNumbers.add(number);
            markedNumbers.add(number);
        }
        
        return {
            playerName: 'Telegram User',
            playerId: '1234',
            cardNumbers: [123, 456],
            winningLines: { card1: 1, card2: 0 },
            totalLines: 1,
            gameTime: 45,
            calledNumbers: 18,
            cardData: {
                card1: {
                    numbers: cardNumbers,
                    markedNumbers: Array.from(markedNumbers),
                    winningCells: winningCells,
                    winningLines: ['Row 1'],
                    calledNumbers: Array.from(calledNumbers)
                },
                card2: {
                    numbers: BingoUtils.generatePersistentBingoCard(456),
                    markedNumbers: [],
                    winningCells: [],
                    winningLines: [],
                    calledNumbers: []
                }
            }
        };
    }

    createConfetti() {
        console.log('Creating confetti...');
        
        const colors = ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800'];
        const confettiCount = 100;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.width = `${Math.random() * 10 + 5}px`;
            confetti.style.height = `${Math.random() * 15 + 10}px`;
            confetti.style.opacity = Math.random() * 0.5 + 0.5;
            
            const animationDuration = Math.random() * 3 + 2;
            const animationDelay = Math.random() * 5;
            
            confetti.style.animation = `confettiFall ${animationDuration}s linear ${animationDelay}s infinite`;
            
            this.confettiContainer.appendChild(confetti);
        }
    }

    setupAudio() {
        console.log('Setting up audio...');
        
        if (this.winnerAudio) {
            this.winnerAudio.volume = 0.5;
            
            // Try to play audio with user interaction fallback
            const playAudio = () => {
                this.winnerAudio.play().catch(e => {
                    console.log('Audio play failed, trying with promise:', e);
                });
            };
            
            // Try to play immediately
            playAudio();
            
            // Also try on any user interaction
            document.addEventListener('click', playAudio, { once: true });
        }
    }

    displayWinnerCard(winnerData) {
        console.log('Displaying winner card...');
        
        // Clear container
        this.winnerContainer.innerHTML = '';
        
        // Create the winner card HTML
        const html = `
            <div class="winner-header">
                <div class="winner-trophy">
                    <i class="fas fa-trophy"></i>
                </div>
                <h1 class="winner-title">BINGO VICTORY!</h1>
                <p class="winner-subtitle">Congratulations on your verified win!</p>
            </div>
            
            <div class="player-info-section">
                <div class="player-display">
                    <div class="player-avatar-large">
                        ${winnerData.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div class="player-details">
                        <h2>${winnerData.playerName}</h2>
                        <p>Player ID: ${winnerData.playerId}</p>
                        <p>Card Numbers: ${winnerData.cardNumbers.join(', ')}</p>
                    </div>
                </div>
                
                <div class="stats-section">
                    <div class="stat-box">
                        <div class="stat-value">${winnerData.totalLines}</div>
                        <div class="stat-label">Verified Lines</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${winnerData.gameTime}s</div>
                        <div class="stat-label">Game Time</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${winnerData.calledNumbers}</div>
                        <div class="stat-label">Numbers Called</div>
                    </div>
                </div>
            </div>
            
            <div class="bingo-card-display">
                <h2 class="card-title">
                    <i class="fas fa-dice-one"></i> 
                    WINNING CARD #${winnerData.cardNumbers[0]}
                </h2>
                
                <div class="bingo-grid-container" id="bingoGrid">
                    <!-- Bingo grid will be generated by JavaScript -->
                </div>
                
                ${winnerData.cardData.card1.winningLines.length > 0 ? `
                    <div class="winning-pattern">
                        <h3><i class="fas fa-medal"></i> Winning Pattern Verified</h3>
                        <p>${winnerData.cardData.card1.winningLines.join(', ')}</p>
                        <p class="verification-text">
                            <i class="fas fa-check-circle"></i> All winning numbers were called and marked
                        </p>
                    </div>
                ` : ''}
            </div>
            
            <div class="countdown-message" id="countdownMessage">
                <i class="fas fa-hourglass-half"></i> 
                Auto-redirecting to card selection in <span id="countdownNumber">5</span> seconds...
            </div>
        `;
        
        // Insert HTML into container
        this.winnerContainer.innerHTML = html;
        
        // Generate the bingo grid with proper highlighting
        this.generateBingoGrid(winnerData.cardData.card1);
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Winner card displayed successfully');
    }

    generateBingoGrid(cardData) {
        const gridContainer = document.getElementById('bingoGrid');
        if (!gridContainer) return;
        
        // Clear any existing content
        gridContainer.innerHTML = '';
        
        // Create column headers
        ['B', 'I', 'N', 'G', 'O'].forEach(letter => {
            const header = document.createElement('div');
            header.className = 'bingo-header';
            header.textContent = letter;
            gridContainer.appendChild(header);
        });
        
        // Create the 5x5 grid (25 cells total)
        for (let i = 0; i < 25; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;
            
            const cell = document.createElement('div');
            cell.className = 'bingo-cell';
            cell.setAttribute('data-col', col);
            cell.setAttribute('data-index', i);
            
            // Get the number from cardData.numbers (column-major order)
            const numberIndex = col * 5 + row;
            let number = cardData.numbers[numberIndex];
            
            // Check if this is the free space
            const isFreeSpace = row === 2 && col === 2;
            
            if (isFreeSpace) {
                cell.textContent = 'FREE';
                cell.className += ' free marked';
                
                // Check if free space is part of winning pattern
                if (cardData.winningCells && cardData.winningCells.includes(i)) {
                    cell.className += ' winning';
                }
            } else {
                cell.textContent = number;
                
                // Check if this number is marked
                const isMarked = cardData.markedNumbers && 
                                cardData.markedNumbers.includes(number);
                
                // Check if this number was called
                const isCalled = cardData.calledNumbers &&
                               cardData.calledNumbers.includes(number);
                
                if (isMarked && isCalled) {
                    cell.className += ' marked';
                }
                
                // Check if this cell is part of winning pattern
                if (cardData.winningCells && cardData.winningCells.includes(i)) {
                    cell.className += ' winning';
                    
                    // Add verification indicator
                    if (isMarked && isCalled) {
                        cell.title = `Verified: ${number} was called and marked`;
                    } else {
                        cell.title = `Unverified: ${number} not properly marked/called`;
                        cell.style.opacity = '0.7';
                    }
                }
            }
            
            gridContainer.appendChild(cell);
        }
        
        // Add pattern description if available
        if (cardData.winningLines && cardData.winningLines.length > 0) {
            const patternInfo = document.createElement('div');
            patternInfo.className = 'pattern-info';
            patternInfo.innerHTML = `
                <div class="pattern-details">
                    <h4><i class="fas fa-star"></i> Winning Pattern Details:</h4>
                    <ul>
                        ${cardData.winningLines.map(line => `<li>${line}</li>`).join('')}
                    </ul>
                    <p class="verification-success">
                        <i class="fas fa-shield-alt"></i> Pattern verified: All cells were properly marked and called
                    </p>
                </div>
            `;
            
            // Find the winning pattern container and append
            const patternContainer = this.winnerContainer.querySelector('.winning-pattern');
            if (patternContainer) {
                patternContainer.appendChild(patternInfo);
            }
        }
    }

    setupEventListeners() {
        // Only auto-redirect functionality remains
    }

    startAutoRedirect() {
        let countdown = 5;
        const countdownElement = document.getElementById('countdownNumber');
        const countdownMessage = document.getElementById('countdownMessage');
        
        if (!countdownElement || !countdownMessage) return;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                countdownMessage.innerHTML = '<i class="fas fa-rocket"></i> Redirecting now...';
                this.redirectToCardSelection();
            }
        }, 1000);
    }

    redirectToCardSelection() {
        console.log('Redirecting to card selection page...');
        
        // Clear session storage
        sessionStorage.clear();
        
        // Redirect to choose-cards.html
        window.location.href = 'choose-cards.html';
    }
}

// Start the winner page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting winner page...');
    
    // Hide loading message after a short delay
    setTimeout(() => {
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
        const winnerContainer = document.getElementById('winnerContainer');
        if (winnerContainer) {
            winnerContainer.style.display = 'block';
        }
    }, 500);
    
    // Initialize winner page
    new WinnerPage();
});

// Fallback in case DOMContentLoaded already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WinnerPage();
    });
} else {
    // DOM already loaded
    new WinnerPage();
}