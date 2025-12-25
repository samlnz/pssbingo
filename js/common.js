// Common utility functions for the Bingo game

class GameState {
    constructor() {
        this.selectedCards = [];
        this.playerName = 'Telegram User';
        this.playerId = '0000';
        this.gameTime = 0;
        this.calledNumbers = new Set();
        this.markedNumbers = { card1: new Set(), card2: new Set() };
        this.winningLines = { card1: [], card2: [] };
        this.activePlayers = 0;
        this.isAudioEnabled = true;
        this.isAutoMark = true;
    }

    saveToSession() {
        sessionStorage.setItem('bingoGameState', JSON.stringify({
            selectedCards: this.selectedCards,
            playerName: this.playerName,
            playerId: this.playerId,
            gameTime: this.gameTime,
            calledNumbers: Array.from(this.calledNumbers),
            markedNumbers: {
                card1: Array.from(this.markedNumbers.card1),
                card2: Array.from(this.markedNumbers.card2)
            },
            winningLines: this.winningLines,
            activePlayers: this.activePlayers,
            isAudioEnabled: this.isAudioEnabled,
            isAutoMark: this.isAutoMark
        }));
    }

    loadFromSession() {
        const saved = sessionStorage.getItem('bingoGameState');
        if (saved) {
            const data = JSON.parse(saved);
            this.selectedCards = data.selectedCards || [];
            this.playerName = data.playerName || 'Telegram User';
            this.playerId = data.playerId || '0000';
            this.gameTime = data.gameTime || 0;
            this.calledNumbers = new Set(data.calledNumbers || []);
            this.markedNumbers = {
                card1: new Set(data.markedNumbers?.card1 || []),
                card2: new Set(data.markedNumbers?.card2 || [])
            };
            this.winningLines = data.winningLines || { card1: [], card2: [] };
            this.activePlayers = data.activePlayers || 0;
            this.isAudioEnabled = data.isAudioEnabled !== undefined ? data.isAudioEnabled : true;
            this.isAutoMark = data.isAutoMark !== undefined ? data.isAutoMark : true;
        }
    }

    clearSession() {
        sessionStorage.removeItem('bingoGameState');
    }
}

class BingoUtils {
    static BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
    
    static BINGO_RANGES = {
        'B': { min: 1, max: 15 },
        'I': { min: 16, max: 30 },
        'N': { min: 31, max: 45 },
        'G': { min: 46, max: 60 },
        'O': { min: 61, max: 75 }
    };

    static getLetterForNumber(number) {
        for (const [letter, range] of Object.entries(this.BINGO_RANGES)) {
            if (number >= range.min && number <= range.max) {
                return letter;
            }
        }
        return '';
    }

    static generateRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static generateUniqueNumbers(count, min, max, exclude = new Set()) {
        const numbers = new Set();
        while (numbers.size < count) {
            const num = this.generateRandomNumber(min, max);
            if (!exclude.has(num)) {
                numbers.add(num);
            }
        }
        return Array.from(numbers);
    }

    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    static playAudio(audioElement, volume = 1) {
        if (audioElement && gameState.isAudioEnabled) {
            audioElement.volume = volume;
            audioElement.currentTime = 0;
            audioElement.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    static showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    static createLoadingOverlay(text = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${text}</div>
        `;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
        
        return {
            hide: () => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 500);
            },
            updateText: (newText) => {
                overlay.querySelector('.loading-text').textContent = newText;
            }
        };
    }

    static navigateTo(url, transition = true) {
        if (transition) {
            const transitionOverlay = document.createElement('div');
            transitionOverlay.className = 'page-transition';
            document.body.appendChild(transitionOverlay);
            
            setTimeout(() => {
                transitionOverlay.classList.add('active');
                setTimeout(() => {
                    window.location.href = url;
                }, 800);
            }, 100);
        } else {
            window.location.href = url;
        }
    }

    // NEW: Deterministic card number generation for first card
    static generateDeterministicBingoCardNumbers(cardNumber) {
        const seed = cardNumber;
        const numbers = [];
        
        const columnRanges = [
            {min: 1, max: 15},
            {min: 16, max: 30},
            {min: 31, max: 45},
            {min: 46, max: 60},
            {min: 61, max: 75}
        ];
        
        // For deterministic first card
        columnRanges.forEach((range, colIndex) => {
            const colNumbers = [];
            for (let row = 0; row < 5; row++) {
                // Use a deterministic algorithm based on card number
                const hash = (seed * 1000) + (colIndex * 100) + (row * 10) + 1;
                const num = (hash % (range.max - range.min + 1)) + range.min;
                
                // Ensure uniqueness within column
                let uniqueNum = num;
                let attempts = 0;
                while (colNumbers.includes(uniqueNum) && attempts < 100) {
                    uniqueNum = ((uniqueNum + 7) % (range.max - range.min + 1)) + range.min;
                    attempts++;
                }
                colNumbers.push(uniqueNum);
            }
            colNumbers.sort((a, b) => a - b);
            numbers.push(...colNumbers);
        });
        
        return numbers;
    }

    // NEW: Randomized card number generation for second card
    static generateRandomBingoCardNumbers(cardNumber) {
        const numbers = [];
        
        const columnRanges = [
            {min: 1, max: 15},
            {min: 16, max: 30},
            {min: 31, max: 45},
            {min: 46, max: 60},
            {min: 61, max: 75}
        ];
        
        // For randomized second card
        columnRanges.forEach((range) => {
            const colNumbers = new Set();
            
            // Generate 5 unique random numbers for this column
            while (colNumbers.size < 5) {
                const num = this.generateRandomNumber(range.min, range.max);
                colNumbers.add(num);
            }
            
            // Convert to array and sort
            const sortedNumbers = Array.from(colNumbers).sort((a, b) => a - b);
            numbers.push(...sortedNumbers);
        });
        
        return numbers;
    }
}

// Initialize global game state
const gameState = new GameState();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState, BingoUtils, gameState };
}