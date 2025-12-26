// Index page
class IndexPage {
    constructor() {
        this.gameState = gameState;
        this.server = serverClient;
        this.startGameBtn = document.getElementById('startGameBtn');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupServerListeners();
    }

    setupEventListeners() {
        if (this.startGameBtn) {
            this.startGameBtn.addEventListener('click', () => {
                this.handleStartGame();
            });
        }
    }
    
    setupServerListeners() {
        this.server.on('connected', () => {
            console.log('Connected to server from index page');
        });
        
        this.server.on('card-taken', (data) => {
            if (document.getElementById('cardsTaken')) {
                document.getElementById('cardsTaken').textContent = data.takenCards.length;
            }
            if (document.getElementById('currentPlayers')) {
                document.getElementById('currentPlayers').textContent = data.playerCount || 0;
            }
        });
    }

    handleStartGame() {
        // Show loading
        this.startGameBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> LOADING...';
        this.startGameBtn.disabled = true;
        
        // Navigate to card selection
        setTimeout(() => {
            window.location.href = 'choose-cards.html';
        }, 500);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new IndexPage();
});