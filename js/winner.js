// Winner Page - Improved with Accurate Pattern Highlighting
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
        console.log('Winner data loaded:', winnerData);
        
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

    getSampleData() {
        // Sample data with accurate patterns
        return {
            playerName: 'Telegram User',
            playerId: '1234',
            cardNumbers: [123, 456],
            winningLines: { card1: 2, card2: 0 },
            totalLines: 2,
            gameTime: 85,
            calledNumbers: 42,
            cardData: {
                card1: {
                    numbers: [
                        1, 16, 31, 46, 61,
                        2, 17, 32, 47, 62,
                        3, 18, 'FREE', 48, 63,
                        4, 19, 34, 49, 64,
                        5, 20, 35, 50, 65
                    ],
                    markedNumbers: [1, 16, 31, 46, 61, 2, 17, 32, 47, 3, 18, 4, 19, 34, 5],
                    winningCells: [0, 1, 2, 3, 4, 6, 12, 18, 24], // Row 1 + Diagonal
                    winningLines: ['Row 1', 'Diagonal (Top-Left to Bottom-Right)'],
                    winningPatterns: [
                        {
                            type: 'row',
                            index: 0,
                            cells: [0, 1, 2, 3, 4]
                        },
                        {
                            type: 'diagonal',
                            direction: 'top-left to bottom-right',
                            cells: [0, 6, 12, 18, 24]
                        }
                    ]
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
            
            // Try to play audio
            const playAudio = () => {
                this.winnerAudio.play().catch(e => {
                    console.log('Audio play failed:', e);
                });
            };
            
            playAudio();
            document.addEventListener('click', playAudio, { once: true });
        }
    }

    displayWinnerCard(winnerData) {
        console.log('Displaying winner card...');
        
        // Clear container
        this.winnerContainer.innerHTML = '';
        
        // Get winning patterns
        const winningPatterns = winnerData.cardData.card1?.winningPatterns || [];
        const patternDescriptions = this.getPatternDescriptions(winningPatterns);
        
        // Create the winner card HTML
        const html = `
            <div class="winner-header">
                <div class="winner-trophy">
                    <i class="fas fa-trophy"></i>
                </div>
                <h1 class="winner-title">BINGO VICTORY!</h1>
                <p class="winner-subtitle">Congratulations on your amazing win!</p>
            </div>
            
            <div class="player-info-section">
                <div class="player-display">
                    <div class="player-avatar-large">
                        ${winnerData.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div class="player-details">
                        <h2>${winnerData.playerName}</h2>
                        <p>Player ID: ${winnerData.playerId}</p>
                    </div>
                </div>
                
                <div class="stats-section">
                    <div class="stat-box">
                        <div class="stat-value">${winnerData.totalLines}</div>
                        <div class="stat-label">Winning Lines</div>
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
                
                ${patternDescriptions.length > 0 ? `
                    <div class="winning-pattern">
                        <h3><i class="fas fa-medal"></i> Winning Pattern${patternDescriptions.length > 1 ? 's' : ''}</h3>
                        <p>${patternDescriptions.join(', ')}</p>
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
        
        // Generate the bingo grid with accurate pattern highlighting
        this.generateBingoGrid(winnerData.cardData.card1);
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Winner card displayed successfully');
    }

    // NEW: Helper to get pattern descriptions
    getPatternDescriptions(patterns) {
        const descriptions = [];
        
        patterns.forEach(pattern => {
            switch(pattern.type) {
                case 'row':
                    descriptions.push(`Row ${pattern.index + 1}`);
                    break;
                case 'column':
                    const columnLetters = ['B', 'I', 'N', 'G', 'O'];
                    descriptions.push(`Column ${columnLetters[pattern.index]}`);
                    break;
                case 'diagonal':
                    descriptions.push(`Diagonal (${pattern.direction})`);
                    break;
                case 'four-corners':
                    descriptions.push('Four Corners');
                    break;
                default:
                    descriptions.push('Winning Pattern');
            }
        });
        
        return descriptions;
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
            cell.setAttribute('data-index', i);
            cell.setAttribute('data-col', col);
            
            // Get the number from cardData.numbers (column-major order)
            const numberIndex = col * 5 + row;
            let number = cardData.numbers[numberIndex];
            
            // Check if this is the free space
            const isFreeSpace = row === 2 && col === 2;
            
            if (isFreeSpace) {
                cell.textContent = 'FREE';
                cell.className += ' free marked';
            } else {
                cell.textContent = number;
                
                // Check if this number is marked
                const isMarked = cardData.markedNumbers && 
                                cardData.markedNumbers.includes(number);
                
                if (isMarked) {
                    cell.className += ' marked';
                }
                
                // Check if this cell is part of winning pattern
                if (cardData.winningCells && cardData.winningCells.includes(i)) {
                    cell.className += ' winning';
                    
                    // Add specific pattern class for better visualization
                    if (cardData.winningPatterns) {
                        cardData.winningPatterns.forEach(pattern => {
                            if (pattern.cells && pattern.cells.includes(i.toString())) {
                                cell.setAttribute('data-pattern', pattern.type);
                            }
                        });
                    }
                }
            }
            
            gridContainer.appendChild(cell);
        }
        
        // Add visual indicators for different patterns
        this.addPatternHighlights(gridContainer, cardData);
    }

    // NEW: Add visual highlights for different winning patterns
    addPatternHighlights(gridContainer, cardData) {
        if (!cardData.winningPatterns) return;
        
        const cells = gridContainer.querySelectorAll('.bingo-cell');
        
        cardData.winningPatterns.forEach((pattern, patternIndex) => {
            // Use different colors for different patterns
            const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63'];
            const color = colors[patternIndex % colors.length];
            
            pattern.cells.forEach(cellIndex => {
                const cell = cells[cellIndex];
                if (cell) {
                    // Add special styling for this pattern
                    cell.style.border = `3px solid ${color}`;
                    cell.style.boxShadow = `0 0 15px ${color}`;
                    
                    // Add pattern indicator
                    const indicator = document.createElement('div');
                    indicator.className = 'pattern-indicator';
                    indicator.style.background = color;
                    indicator.style.width = '20px';
                    indicator.style.height = '20px';
                    indicator.style.borderRadius = '50%';
                    indicator.style.position = 'absolute';
                    indicator.style.top = '5px';
                    indicator.style.right = '5px';
                    indicator.style.zIndex = '1';
                    
                    cell.style.position = 'relative';
                    cell.appendChild(indicator);
                }
            });
        });
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