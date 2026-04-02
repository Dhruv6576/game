import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Serve static files from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDir = join(__dirname, '..');
app.use(express.static(parentDir));

// Game State
const players = new Map();
const rooms = new Map();
const matchmakingQueue = {
    multiplayer: [],
    dual: []
};

const gameConfig = {
    colors: ['red', 'blue', 'green', 'yellow']
};

class Player {
    constructor(id, name, socket) {
        this.id = id;
        this.name = name;
        this.socket = socket;
        this.mode = null;
        this.roomId = null;
        this.score = 0;
    }
}

class GameRoom {
    constructor(id, mode, player1) {
        this.id = id;
        this.mode = mode;
        this.players = [player1];
        this.gameState = {
            level: 1,
            sequence: [],
            currentPlayer: 1,
            player1Score: 0,
            player2Score: 0,
            player1Completed: false,
            player2Completed: false,
            player1MaxLevel: 0,  // Track max level reached by player 1
            player2MaxLevel: 0,  // Track max level reached by player 2
            sequenceGeneratedForLevel: 0,
            gameStarted: false,
            p1Pattern: [],
            p2Pattern: [],
            dualLevel: 1,
            dualPhase: 'p1Setting'
        };
        this.createdAt = Date.now();
    }

    addPlayer(player2) {
        this.players.push(player2);
        this.gameState.gameStarted = true;
    }

    isFull() {
        return this.players.length === 2;
    }
}

// ===== SOCKET.IO EVENTS =====
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Debug: catch any incoming event to see if levelComplete reaches server
    socket.onevent = ((f) => {
        return function(...args) {
            if (args[0] === 'levelComplete') {
                console.log('🔥🔥🔥 DEBUG: CAUGHT levelComplete event on socket!', args);
            }
            f.apply(this, args);
        };
    })(socket.onevent);

    socket.on('register', (data) => {
        const player = new Player(socket.id, data.name, socket);
        players.set(socket.id, player);
        
        console.log(`Player registered: ${data.name}`);
        
        // Broadcast online player count
        io.emit('onlineCount', {
            count: players.size
        });

        socket.emit('registered', {
            playerId: socket.id,
            onlineCount: players.size
        });
    });

    // ===== SOLO MODE =====
    socket.on('soloGameEnd', (data) => {
        const player = players.get(socket.id);
        if (player) {
            io.emit('scoreSaved', {
                playerName: player.name,
                score: data.score,
                mode: 'solo'
            });
        }
    });

    // ===== MULTIPLAYER & DUAL MODE MATCHMAKING =====
    socket.on('findMatch', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        player.mode = data.mode;
        const queue = matchmakingQueue[data.mode];

        socket.emit('matchmakingStatus', {
            status: 'searching',
            message: 'Finding player...'
        });

        if (queue.length > 0) {
            // Found a match!
            const opponent = queue.shift();
            const roomId = uuidv4();
            const room = new GameRoom(roomId, data.mode, opponent);
            room.addPlayer(player);

            rooms.set(roomId, room);
            opponent.roomId = roomId;
            player.roomId = roomId;

            // Notify both players
            io.to(opponent.id).emit('matchFound', {
                roomId: roomId,
                opponentName: player.name,
                mode: data.mode
            });

            socket.emit('matchFound', {
                roomId: roomId,
                opponentName: opponent.name,
                mode: data.mode
            });

            // Broadcast online count
            io.emit('onlineCount', { count: players.size });
        } else {
            // Add to queue
            queue.push(player);
            socket.emit('matchmakingStatus', {
                status: 'waiting',
                message: `Waiting in queue (${queue.length} players)`
            });
        }
    });

    socket.on('cancelMatchmaking', () => {
        const player = players.get(socket.id);
        if (!player) return;

        if (player.mode) {
            const queue = matchmakingQueue[player.mode];
            const index = queue.indexOf(player);
            if (index > -1) {
                queue.splice(index, 1);
            }
        }

        socket.emit('matchmakingCancelled');
    });

    // ===== GAME COMMUNICATION =====
    socket.on('gameAction', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room) return;

        const opponent = room.players.find(p => p.id !== socket.id);
        if (opponent) {
            io.to(opponent.id).emit('opponentAction', data);
        }

        // Update room state
        if (data.type === 'click') {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex === 0) {
                room.gameState.player1Score = data.score;
            } else {
                room.gameState.player2Score = data.score;
            }
        }
    });

    socket.on('gameEnd', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.get(player.roomId);
        if (!room) return;

        const opponent = room.players.find(p => p.id !== socket.id);
        if (opponent) {
            io.to(opponent.id).emit('opponentGameEnd', data);
        }

        rooms.delete(player.roomId);
        player.roomId = null;
        player.mode = null;
    });

    // Multiplayer: handle level completion
    socket.on('levelComplete', (data) => {
        console.log('🎯 SERVER RECEIVED: levelComplete event', { level: data.level, score: data.score, socketId: socket.id });
        
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('❌ levelComplete: Player not found or no roomId');
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room) {
            console.log('❌ levelComplete: Room not found');
            return;
        }

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        const isPlayer1 = playerIndex === 0;
        
        console.log(`✅ Player ${playerIndex + 1} completed level ${data.level}, score: ${data.score}`);
        console.log(`   Before: P1=${room.gameState.player1Completed}, P2=${room.gameState.player2Completed}`);

        // Mark this player as completed
        if (isPlayer1) {
            room.gameState.player1Completed = true;
            room.gameState.player1Score = data.score;
        } else {
            room.gameState.player2Completed = true;
            room.gameState.player2Score = data.score;
        }
        
        console.log(`   After: P1=${room.gameState.player1Completed}, P2=${room.gameState.player2Completed}`);

        // Notify opponent
        const opponent = room.players.find(p => p.id !== socket.id);
        if (opponent) {
            io.to(opponent.id).emit('opponentLevelComplete');
        }

        // Check if both players have completed
        const bothCompleted = room.gameState.player1Completed && room.gameState.player2Completed;
        console.log(`   Both completed? ${bothCompleted}`);

        if (bothCompleted) {
            console.log(`✨ BOTH PLAYERS COMPLETED! Sending bothPlayersReady to room`);
            room.gameState.level++;
            room.gameState.sequenceGeneratedForLevel = 0; // Reset for next level
            console.log(`   Level incremented to: ${room.gameState.level}`);
            
            // Send to both players
            room.players.forEach((p, idx) => {
                console.log(`   Sending bothPlayersReady to player ${idx + 1}`);
                io.to(p.id).emit('bothPlayersReady');
            });
            
            // Reset completion flags for next level
            room.gameState.player1Completed = false;
            room.gameState.player2Completed = false;
        }
    });

    // Multiplayer: handle player reaching max level
    socket.on('playerReachedMax', (data) => {
        console.log('🏆 SERVER RECEIVED: playerReachedMax event', { level: data.level, score: data.score, socketId: socket.id });
        
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('❌ playerReachedMax: Player not found or no roomId');
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room) {
            console.log('❌ playerReachedMax: Room not found');
            return;
        }

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        const isPlayer1 = playerIndex === 0;
        const opponent = room.players.find(p => p.id !== socket.id);

        // Store the max level for this player
        if (isPlayer1) {
            room.gameState.player1MaxLevel = data.level;
            room.gameState.player1Score = data.score;
        } else {
            room.gameState.player2MaxLevel = data.level;
            room.gameState.player2Score = data.score;
        }

        console.log(`✅ Player ${playerIndex + 1} reached max level ${data.level} with score ${data.score}`);

        // Check if we can determine a winner
        const p1Max = room.gameState.player1MaxLevel || 0;
        const p2Max = room.gameState.player2MaxLevel || 0;

        if (!opponent) {
            console.log('❌ Opponent not found');
            return;
        }

        // If both players have reached max level, notify about tie/win
        if (p1Max > 0 && p2Max > 0) {
            console.log(`✨ GAME OVER! P1 max: ${p1Max}, P2 max: ${p2Max}`);
            
            let isTie = p1Max === p2Max;
            let winnerIndex = p1Max > p2Max ? 0 : 1;
            let loserIndex = p1Max > p2Max ? 1 : 0;

            const winner = room.players[winnerIndex];
            const loser = room.players[loserIndex];
            const winnerScore = winnerIndex === 0 ? room.gameState.player1Score : room.gameState.player2Score;
            const loserScore = loserIndex === 0 ? room.gameState.player1Score : room.gameState.player2Score;

            const gameEndData = {
                winnerId: winner.id,
                winnerName: winner.name,
                winnerScore: winnerScore,
                loserName: loser.name,
                loserScore: loserScore,
                isTie: isTie
            };

            console.log(`📡 Sending gameEnded to both players:`, gameEndData);

            // Send to both players
            room.players.forEach((p) => {
                io.to(p.id).emit('gameEnded', gameEndData);
            });

            // Clean up room
            setTimeout(() => {
                rooms.delete(room.id);
                room.players.forEach(p => {
                    p.roomId = null;
                    p.mode = null;
                });
            }, 1000);
        } else {
            // First player to reach max level, notify opponent
            console.log(`📡 Notifying opponent that player ${playerIndex + 1} reached max`);
            io.to(opponent.id).emit('opponentReachedMax', {
                playerName: player.name,
                level: data.level,
                score: data.score
            });
        }
    });

    socket.on('generateSequence', () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) {
            console.log('❌ generateSequence: Invalid player or no roomId');
            return;
        }

        const room = rooms.get(player.roomId);
        if (!room) {
            console.log('❌ generateSequence: Room not found');
            return;
        }

        console.log(`🎯 generateSequence requested - Level: ${room.gameState.level}, Already generated: ${room.gameState.sequenceGeneratedForLevel}`);

        // Prevent generating duplicate sequences for the same level
        if (room.gameState.sequenceGeneratedForLevel === room.gameState.level) {
            console.log(`⚠️ Sequence already generated for level ${room.gameState.level}, ignoring request`);
            return;
        }

        // Prevent generating if players are in the middle of completing a level
        if (room.gameState.player1Completed || room.gameState.player2Completed) {
            console.log('⚠️ One or both players have completed, waiting for bothPlayersReady to be sent');
            return;
        }

        // Generate random sequence based on current level
        const sequence = [];
        const boxesToGenerate = room.gameState.level;
        console.log(`   Generating ${boxesToGenerate} box(es) for level ${room.gameState.level}`);
        
        for (let i = 0; i < boxesToGenerate; i++) {
            sequence.push(gameConfig.colors[Math.floor(Math.random() * 4)]);
        }

        room.gameState.sequence = sequence;
        room.gameState.sequenceGeneratedForLevel = room.gameState.level;
        console.log(`✅ Generated sequence: [${sequence.join(', ')}] (total: ${sequence.length} boxes)`);

        // Send to both players
        room.players.forEach((p, idx) => {
            console.log(`📤 Sending sequenceReady to player ${idx + 1} with ${sequence.length} boxes`);
            io.to(p.id).emit('sequenceReady', {
                sequence: sequence,
                level: room.gameState.level
            });
        });
    });

    // ===== DISCONNECT =====
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player) {
            // Remove from queue if in queue
            if (player.mode) {
                const queue = matchmakingQueue[player.mode];
                const index = queue.indexOf(player);
                if (index > -1) {
                    queue.splice(index, 1);
                }
            }

            // Notify opponent if in game
            if (player.roomId) {
                const room = rooms.get(player.roomId);
                if (room) {
                    const opponent = room.players.find(p => p.id !== socket.id);
                    if (opponent) {
                        io.to(opponent.id).emit('opponentDisconnected');
                    }
                    rooms.delete(player.roomId);
                }
            }

            players.delete(socket.id);
            console.log(`Player disconnected: ${player.name}`);
            
            // Broadcast online count
            io.emit('onlineCount', { count: players.size });
        }
    });
});

// ===== REST API =====
app.get('/api/players/online', (req, res) => {
    res.json({
        onlineCount: players.size,
        matchmakingQueues: {
            multiplayer: matchmakingQueue.multiplayer.length,
            dual: matchmakingQueue.dual.length
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🎮 Game server running on port ${PORT}`);
});
