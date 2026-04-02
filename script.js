// ===== GAME STATE AND CONFIG =====
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SOUND_ENABLED = true;

let gameState = {
    playerName: localStorage.getItem('playerName') || '',
    currentMode: null,
    level: 1,
    sequence: [],
    userSequence: [],
    playing: false,
    score: 0,
    // Multiplayer state
    player1Score: 0,
    player2Score: 0,
    player1Clicks: [],
    player2Clicks: [],
    currentPlayer: 1,
    // Dual mode state
    dualPhase: 'p1Setting', // 'p1Setting', 'p1Playing', 'p2Setting', 'p2Playing'
    dualLevel: 1,
    p1Pattern: [],
    p2Pattern: [],
    p1DualScore: 0,
    p2DualScore: 0,
};

// ===== INITIALIZATION =====
window.addEventListener('DOMContentLoaded', () => {
    if (gameState.playerName) {
        showModeScreen();
    }
});

// ===== PLAYER NAME MANAGEMENT =====
function setPlayerName() {
    const name = document.getElementById('playerName').value.trim();
    if (name.length > 0) {
        gameState.playerName = name;
        localStorage.setItem('playerName', name);
        document.getElementById('nameModal').classList.add('hidden');
        showModeScreen();
    } else {
        alert('Please enter a valid name!');
    }
}

function changePlayerName() {
    document.getElementById('playerName').value = gameState.playerName;
    document.getElementById('nameModal').classList.remove('hidden');
}

// ===== SCREEN NAVIGATION =====
function showModeScreen() {
    document.getElementById('modeScreen').classList.remove('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.add('hidden');
    document.getElementById('displayName').textContent = gameState.playerName;
    resetGameState();
}

function backToMode() {
    showModeScreen();
    stopSounds();
}

function selectMode(mode) {
    gameState.currentMode = mode;
    document.getElementById('modeScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    document.getElementById('leaderboardScreen').classList.add('hidden');
    
    resetGameState();
    
    if (mode === 'solo') {
        document.getElementById('modeTitle').textContent = '🎮 Solo Mode';
        document.getElementById('playerDisplay').textContent = `Player: ${gameState.playerName}`;
        document.getElementById('standardGameView').classList.remove('hidden');
        document.getElementById('dualGameView').classList.add('hidden');
        document.getElementById('multiplayerView').classList.add('hidden');
        initSoloGame();
    } else if (mode === 'multiplayer') {
        document.getElementById('modeTitle').textContent = '⚡ Multiplayer Mode';
        document.getElementById('playerDisplay').textContent = 'Competing against Player 2';
        document.getElementById('standardGameView').classList.remove('hidden');
        document.getElementById('dualGameView').classList.add('hidden');
        document.getElementById('multiplayerView').classList.remove('hidden');
        initMultiplayerGame();
    } else if (mode === 'dual') {
        document.getElementById('modeTitle').textContent = '🎯 Dual Mode';
        document.getElementById('playerDisplay').textContent = `Player: ${gameState.playerName}`;
        document.getElementById('standardGameView').classList.add('hidden');
        document.getElementById('dualGameView').classList.remove('hidden');
        document.getElementById('multiplayerView').classList.add('hidden');
        initDualGame();
    }
}

function showLeaderboard() {
    document.getElementById('modeScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.remove('hidden');
    switchLeaderboard('solo');
}

// ===== CORE GAME FUNCTIONS =====
function flash(color) {
    const box = document.querySelector(gameState.currentMode === 'dual' ? 
        `#dualBoard [data-color="${color}"]` : 
        `#gameBoard [data-color="${color}"]`);
    
    if (!box) return;
    
    box.classList.add('active');
    
    if (SOUND_ENABLED) {
        try {
            const sound = new Audio(`sounds/${color}.wav`);
            sound.volume = 0.5;
            sound.play().catch(() => {});
        } catch (e) {}
    }
    
    setTimeout(() => {
        box.classList.remove('active');
    }, 500);
}

function stopSounds() {
    const sounds = document.querySelectorAll('audio');
    sounds.forEach(sound => sound.pause());
}

// ===== SOLO MODE =====
function initSoloGame() {
    gameState.level = 1;
    gameState.sequence = [];
    gameState.userSequence = [];
    gameState.score = 0;
    gameState.playing = false;
    updateSoloUI();
    document.getElementById('startBtn').textContent = 'Start Game';
    document.getElementById('message').textContent = '';
    document.getElementById('instruction').textContent = 'Watch the boxes!';
}

function updateSoloUI() {
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('score').textContent = gameState.score;
}

function playSoloSequence() {
    gameState.playing = false;
    gameState.sequence = [];
    
    for (let i = 0; i < gameState.level; i++) {
        gameState.sequence.push(COLORS[Math.floor(Math.random() * 4)]);
    }
    
    document.getElementById('instruction').textContent = `Watch ${gameState.level} boxes!`;
    document.getElementById('startBtn').disabled = true;
    
    let i = 0;
    function showNext() {
        if (i < gameState.sequence.length) {
            flash(gameState.sequence[i]);
            i++;
            setTimeout(showNext, 600);
        } else {
            gameState.userSequence = [];
            gameState.playing = true;
            document.getElementById('instruction').textContent = 'Your turn! Click in order';
            document.getElementById('startBtn').disabled = false;
        }
    }
    showNext();
}

function attachSoloBoxListeners() {
    const boxes = document.querySelectorAll('#gameBoard .box');
    boxes.forEach(box => {
        box.removeEventListener('click', soloBoxClickHandler);
        box.addEventListener('click', soloBoxClickHandler);
    });
}

function soloBoxClickHandler(e) {
    if (!gameState.playing || gameState.currentMode !== 'solo') return;
    
    const color = e.target.getAttribute('data-color');
    gameState.userSequence.push(color);
    flash(color);
    
    const lastUserColor = gameState.userSequence[gameState.userSequence.length - 1];
    const expectedColor = gameState.sequence[gameState.userSequence.length - 1];
    
    if (lastUserColor !== expectedColor) {
        gameover(gameState.score);
        return;
    }
    
    if (gameState.userSequence.length === gameState.sequence.length) {
        gameState.level++;
        gameState.score += 10 * gameState.level;
        updateSoloUI();
        document.getElementById('message').textContent = 'Correct! Next level...';
        document.getElementById('message').classList.remove('error');
        gameState.playing = false;
        setTimeout(playSoloSequence, 1000);
    }
}

function gameover(score) {
    document.getElementById('message').textContent = '❌ Wrong! Game Over!';
    document.getElementById('message').classList.add('error');
    gameState.playing = false;
    gameState.score = score;
    
    saveScore('solo', score, gameState.playerName);
    
    setTimeout(() => {
        if (confirm(`Game Over!\nYour Score: ${score}\n\nPlay Again?`)) {
            initSoloGame();
        } else {
            showModeScreen();
        }
    }, 1500);
}

// ===== MULTIPLAYER MODE =====
function initMultiplayerGame() {
    gameState.level = 1;
    gameState.sequence = [];
    gameState.userSequence = [];
    gameState.player1Score = 0;
    gameState.player2Score = 0;
    gameState.player1Clicks = [];
    gameState.player2Clicks = [];
    gameState.currentPlayer = 1;
    gameState.playing = false;
    
    document.getElementById('p1Name').textContent = gameState.playerName;
    document.getElementById('p2Name').textContent = 'Player 2 (AI)';
    document.getElementById('p1Score').textContent = 'Score: 0';
    document.getElementById('p2Score').textContent = 'Score: 0';
    document.getElementById('p1View').textContent = '';
    document.getElementById('p2View').textContent = '';
    document.getElementById('startBtn').textContent = 'Start Game';
    document.getElementById('message').textContent = '';
    document.getElementById('instruction').textContent = 'Watch the boxes!';
}

function playMultiplayerSequence() {
    gameState.playing = false;
    gameState.sequence = [];
    gameState.userSequence = [];
    gameState.player1Clicks = [];
    gameState.player2Clicks = [];
    gameState.currentPlayer = 1;
    
    for (let i = 0; i < gameState.level; i++) {
        gameState.sequence.push(COLORS[Math.floor(Math.random() * 4)]);
    }
    
    document.getElementById('instruction').textContent = `Both players watch ${gameState.level} boxes!`;
    document.getElementById('startBtn').disabled = true;
    
    let i = 0;
    function showNext() {
        if (i < gameState.sequence.length) {
            flash(gameState.sequence[i]);
            i++;
            setTimeout(showNext, 600);
        } else {
            gameState.currentPlayer = 1;
            gameState.userSequence = [];
            gameState.playing = true;
            document.getElementById('instruction').textContent = 'Player 1\'s Turn!';
            document.getElementById('startBtn').disabled = false;
        }
    }
    showNext();
}

function attachMultiplayerBoxListeners() {
    const boxes = document.querySelectorAll('#gameBoard .box');
    boxes.forEach(box => {
        box.removeEventListener('click', multiplayerBoxClickHandler);
        box.addEventListener('click', multiplayerBoxClickHandler);
    });
}

function multiplayerBoxClickHandler(e) {
    if (!gameState.playing || gameState.currentMode !== 'multiplayer') return;
    
    const color = e.target.getAttribute('data-color');
    gameState.userSequence.push(color);
    
    if (gameState.currentPlayer === 1) {
        gameState.player1Clicks.push(color);
        document.getElementById('p1View').textContent = `Clicked: ${gameState.player1Clicks.join(' → ')}`;
    } else {
        gameState.player2Clicks.push(color);
        document.getElementById('p2View').textContent = `Clicked: ${gameState.player2Clicks.join(' → ')}`;
    }
    
    flash(color);
    
    const lastUserColor = gameState.userSequence[gameState.userSequence.length - 1];
    const expectedColor = gameState.sequence[gameState.userSequence.length - 1];
    
    if (lastUserColor !== expectedColor) {
        const loser = gameState.currentPlayer === 1 ? gameState.playerName : 'Player 2';
        document.getElementById('message').textContent = `❌ ${loser} made a mistake!`;
        document.getElementById('message').classList.add('error');
        gameState.playing = false;
        
        if (gameState.currentPlayer === 2) {
            gameState.player1Score += gameState.level * 10;
        } else {
            gameState.player2Score += gameState.level * 10;
        }
        
        updateMultiplayerUI();
        saveScore('multiplayer', Math.max(gameState.player1Score, gameState.player2Score), gameState.playerName);
        
        setTimeout(() => {
            if (confirm('Level Complete!\nPlay Next Level?')) {
                gameState.level++;
                playMultiplayerSequence();
            } else {
                showModeScreen();
            }
        }, 1500);
        return;
    }
    
    if (gameState.userSequence.length === gameState.sequence.length) {
        document.getElementById('message').textContent = 'Both players completed it!';
        document.getElementById('message').classList.remove('error');
        gameState.playing = false;
        gameState.player1Score += gameState.level * 5;
        gameState.player2Score += gameState.level * 5;
        updateMultiplayerUI();
        
        setTimeout(() => {
            gameState.level++;
            playMultiplayerSequence();
        }, 1000);
        return;
    }
    
    if (gameState.currentPlayer === 1 && gameState.userSequence.length === gameState.sequence.length) {
        gameState.currentPlayer = 2;
        gameState.userSequence = [];
        document.getElementById('instruction').textContent = 'Player 2\'s Turn!';
    }
}

function updateMultiplayerUI() {
    document.getElementById('p1Score').textContent = `Score: ${gameState.player1Score}`;
    document.getElementById('p2Score').textContent = `Score: ${gameState.player2Score}`;
}

// ===== DUAL MODE =====
function initDualGame() {
    gameState.dualLevel = 1;
    gameState.dualPhase = 'p1Setting';
    gameState.p1Pattern = [];
    gameState.p2Pattern = [];
    gameState.p1DualScore = 0;
    gameState.p2DualScore = 0;
    gameState.userSequence = [];
    
    document.getElementById('p1DualName').textContent = gameState.playerName;
    document.getElementById('p2DualName').textContent = 'Player 2 (AI)';
    document.getElementById('p1DualScore').textContent = '0';
    document.getElementById('p2DualScore').textContent = '0';
    document.getElementById('dualMessage').textContent = '';
    
    startDualPhase();
}

function startDualPhase() {
    const clicksNeeded = gameState.dualLevel;
    
    if (gameState.dualPhase === 'p1Setting') {
        document.getElementById('dualTitle').textContent = `Level ${gameState.dualLevel} - ${gameState.playerName} Setting Pattern`;
        document.getElementById('dualInstruction').textContent = 'Click the boxes in the order you want Player 2 to repeat';
        document.getElementById('clicksNeeded').textContent = clicksNeeded;
        document.getElementById('clicksDone').textContent = '0';
        document.getElementById('dualStartBtn').disabled = false;
        gameState.p1Pattern = [];
        gameState.userSequence = [];
        attachDualBoxListeners();
    } else if (gameState.dualPhase === 'p1Playing') {
        document.getElementById('dualTitle').textContent = `Level ${gameState.dualLevel} - ${gameState.playerName} Playing`;
        document.getElementById('dualInstruction').textContent = 'Repeat the pattern set by Player 2';
        document.getElementById('clicksNeeded').textContent = gameState.p2Pattern.length;
        document.getElementById('clicksDone').textContent = '0';
        document.getElementById('dualStartBtn').textContent = 'Player 2 Set Pattern';
        document.getElementById('dualStartBtn').disabled = true;
        playDualPattern();
    } else if (gameState.dualPhase === 'p2Setting') {
        document.getElementById('dualTitle').textContent = `Level ${gameState.dualLevel} - Player 2 Setting Pattern`;
        document.getElementById('dualInstruction').textContent = 'Player 2 (AI) is setting the pattern...';
        document.getElementById('dualStartBtn').disabled = true;
        gameState.p2Pattern = [];
        setTimeout(() => {
            for (let i = 0; i < gameState.dualLevel; i++) {
                gameState.p2Pattern.push(COLORS[Math.floor(Math.random() * 4)]);
            }
            gameState.dualPhase = 'p2Playing';
            startDualPhase();
        }, 2000);
    } else if (gameState.dualPhase === 'p2Playing') {
        document.getElementById('dualTitle').textContent = `Level ${gameState.dualLevel} - Player 2 (AI) Playing`;
        document.getElementById('dualInstruction').textContent = 'Watching Player 2 complete the pattern...';
        document.getElementById('clicksNeeded').textContent = gameState.p1Pattern.length;
        document.getElementById('clicksDone').textContent = '0';
        document.getElementById('dualStartBtn').disabled = true;
        playDualPatternForPlayer2();
    }
}

function attachDualBoxListeners() {
    const boxes = document.querySelectorAll('#dualBoard .box');
    boxes.forEach(box => {
        box.removeEventListener('click', dualPatternClickHandler);
        box.addEventListener('click', dualPatternClickHandler);
    });
}

function dualPatternClickHandler(e) {
    if (gameState.dualPhase !== 'p1Setting' && gameState.dualPhase !== 'p1Playing') return;
    
    const color = e.target.getAttribute('data-color');
    
    if (gameState.dualPhase === 'p1Setting') {
        if (gameState.p1Pattern.length < gameState.dualLevel) {
            gameState.p1Pattern.push(color);
            flash(color);
            document.getElementById('clicksDone').textContent = gameState.p1Pattern.length;
            
            if (gameState.p1Pattern.length === gameState.dualLevel) {
                document.getElementById('dualStartBtn').textContent = 'Pattern Set! Continue';
                document.getElementById('dualMessage').textContent = `✓ Pattern set: ${gameState.p1Pattern.join(' → ')}`;
                document.getElementById('dualStartBtn').disabled = false;
            }
        }
    } else if (gameState.dualPhase === 'p1Playing') {
        gameState.userSequence.push(color);
        flash(color);
        document.getElementById('clicksDone').textContent = gameState.userSequence.length;
        
        if (gameState.userSequence[gameState.userSequence.length - 1] !== 
            gameState.p2Pattern[gameState.userSequence.length - 1]) {
            document.getElementById('dualMessage').textContent = '❌ Wrong pattern!';
            document.getElementById('dualMessage').classList.add('error');
            setTimeout(() => {
                gameState.dualPhase = 'p2Setting';
                startDualPhase();
            }, 1500);
            return;
        }
        
        if (gameState.userSequence.length === gameState.p2Pattern.length) {
            gameState.p1DualScore += gameState.dualLevel * 10;
            document.getElementById('dualMessage').textContent = '✓ Correct!';
            document.getElementById('dualMessage').classList.remove('error');
            document.getElementById('p1DualScore').textContent = gameState.p1DualScore;
            
            setTimeout(() => {
                gameState.dualLevel++;
                gameState.dualPhase = 'p2Setting';
                startDualPhase();
            }, 1500);
        }
    }
}

function playDualPattern() {
    gameState.userSequence = [];
    let i = 0;
    function showNext() {
        if (i < gameState.p2Pattern.length) {
            flash(gameState.p2Pattern[i]);
            i++;
            setTimeout(showNext, 600);
        } else {
            gameState.dualPhase = 'p1Playing';
            document.getElementById('dualInstruction').textContent = 'Repeat the pattern!';
            document.getElementById('dualStartBtn').disabled = true;
            attachDualBoxListeners();
        }
    }
    showNext();
}

function playDualPatternForPlayer2() {
    gameState.userSequence = [];
    let i = 0;
    function showNext() {
        if (i < gameState.p1Pattern.length) {
            flash(gameState.p1Pattern[i]);
            i++;
            setTimeout(showNext, 600);
        } else {
            gameState.p2DualScore += gameState.dualLevel * 10;
            document.getElementById('dualMessage').textContent = '✓ Player 2 completed it!';
            document.getElementById('p2DualScore').textContent = gameState.p2DualScore;
            document.getElementById('dualStartBtn').disabled = false;
            
            setTimeout(() => {
                gameState.dualLevel++;
                gameState.dualPhase = 'p1Setting';
                startDualPhase();
            }, 1500);
        }
    }
    showNext();
}

// ===== LEADERBOARD =====
function saveScore(mode, score, playerName) {
    const key = `leaderboard_${mode}`;
    let leaderboard = JSON.parse(localStorage.getItem(key)) || [];
    
    leaderboard.push({
        name: playerName,
        score: score,
        date: new Date().toLocaleDateString()
    });
    
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    
    localStorage.setItem(key, JSON.stringify(leaderboard));
}

function switchLeaderboard(mode) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const key = `leaderboard_${mode}`;
    const leaderboard = JSON.parse(localStorage.getItem(key)) || [];
    
    const tbody = document.getElementById('leaderboardBody');
    const emptyMsg = document.getElementById('emptyMessage');
    
    if (leaderboard.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        tbody.innerHTML = leaderboard.map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${entry.name}</td>
                <td>${entry.score}</td>
                <td>${entry.date}</td>
            </tr>
        `).join('');
    }
}

// ===== EVENT LISTENERS =====
document.getElementById('startBtn').addEventListener('click', () => {
    if (gameState.currentMode === 'solo') {
        playSoloSequence();
        attachSoloBoxListeners();
    } else if (gameState.currentMode === 'multiplayer') {
        playMultiplayerSequence();
        attachMultiplayerBoxListeners();
    }
});

document.getElementById('dualStartBtn').addEventListener('click', () => {
    if (gameState.dualPhase === 'p1Setting') {
        gameState.dualPhase = 'p1Playing';
        startDualPhase();
        attachDualBoxListeners();
    }
});
