// index.js - Express + Socket.IO server with procedural maps
// Place in: server/index.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const LobbyManager = require('./lobby/LobbyManager');
const GameState = require('./game/GameState');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  // Increase max buffer for map data
  maxHttpBufferSize: 1e7 // 10MB
});

// Serve static files in production
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const lobbyManager = new LobbyManager();
const games = new Map();

// Game loop interval references
const gameLoops = new Map();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ============================================
  // LOBBY EVENTS
  // ============================================

  socket.on('getLobbies', (callback) => {
    callback(lobbyManager.getPublicLobbies());
  });

  socket.on('createLobby', (playerName, callback) => {
    const lobby = lobbyManager.createLobby(socket.id, playerName);
    socket.join(lobby.id);
    callback(lobby);
    io.emit('lobbiesUpdated', lobbyManager.getPublicLobbies());
  });

  socket.on('joinLobby', ({ lobbyId, playerName }, callback) => {
    const result = lobbyManager.joinLobby(lobbyId, socket.id, playerName);
    if (result.success) {
      socket.join(lobbyId);
      io.to(lobbyId).emit('lobbyUpdated', result.lobby);
      io.emit('lobbiesUpdated', lobbyManager.getPublicLobbies());
    }
    callback(result);
  });

  socket.on('leaveLobby', (lobbyId) => {
    const lobby = lobbyManager.leaveLobby(lobbyId, socket.id);
    socket.leave(lobbyId);
    if (lobby) {
      io.to(lobbyId).emit('lobbyUpdated', lobby);
    }
    io.emit('lobbiesUpdated', lobbyManager.getPublicLobbies());
  });

  socket.on('setReady', ({ lobbyId, ready }) => {
    const lobby = lobbyManager.setReady(lobbyId, socket.id, ready);
    if (lobby) {
      io.to(lobbyId).emit('lobbyUpdated', lobby);
    }
  });

  socket.on('startGame', (lobbyId) => {
    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || lobby.hostId !== socket.id) return;
    
    // Check all non-host players are ready
    const allReady = lobby.players.every(p => p.isHost || p.ready);
    if (!allReady) return;

    // Create game state with procedural map
    const gameId = lobbyId;
    const gameState = new GameState(gameId, lobby.players);
    games.set(gameId, gameState);

    lobby.status = 'playing';
    
    // Send game started with full map data
    io.to(lobbyId).emit('gameStarted', {
      gameId,
      players: gameState.getPlayersData(),
      worldSeed: gameState.worldSeed,
      level: gameState.level,
      levelName: gameState.getLevelName(),
      // NEW: Send full map data for client rendering
      mapData: gameState.getMapData(),
      objectives: gameState.getObjectivesData(),
      lootContainers: gameState.getLootContainersData()
    });

    io.emit('lobbiesUpdated', lobbyManager.getPublicLobbies());

    // Start game loop (30 tick rate)
    const gameLoop = setInterval(() => {
      const game = games.get(gameId);
      if (!game) {
        clearInterval(gameLoop);
        gameLoops.delete(gameId);
        return;
      }

      game.update();

      // Check for level up
      if (game.checkLevelUp()) {
        io.to(gameId).emit('levelUp', {
          level: game.level,
          levelName: game.getLevelName()
        });
      }

      // Check game over
      const alivePlayers = game.getAlivePlayers();
      if (alivePlayers.length === 0) {
        io.to(gameId).emit('gameOver', {
          reason: 'All players eliminated',
          stats: game.getGameStats()
        });
        
        // Cleanup
        game.shutdown(); // NEW: Shutdown pathfinding worker
        clearInterval(gameLoop);
        gameLoops.delete(gameId);
        games.delete(gameId);
        lobbyManager.deleteLobby(gameId);
        return;
      }

      // Broadcast game state (includes new data)
      io.to(gameId).emit('gameState', {
        players: game.getPlayersData(),
        enemies: game.getEnemiesData(),
        pickups: game.getPickupsData(),
        bullets: game.getBulletsData(),
        projectiles: game.getProjectilesData(),
        pings: game.getPingsData(),
        chatMessages: game.getChatMessages(),
        level: game.level,
        totalKills: game.totalKills,
        // NEW: Send objective and loot container states
        objectives: game.getObjectivesData(),
        lootContainerStates: game.getLootContainersData()
      });

    }, 1000 / 30); // 30 FPS

    gameLoops.set(gameId, gameLoop);
  });

  // ============================================
  // GAME INPUT EVENTS
  // ============================================

  socket.on('playerInput', ({ gameId, input }) => {
    const game = games.get(gameId);
    if (!game) return;
    game.handlePlayerInput(socket.id, input);
  });

  socket.on('playerShoot', ({ gameId, position, direction, weapon, damage }) => {
    const game = games.get(gameId);
    if (!game) return;

    const bullet = game.createBullet(socket.id, position, direction, weapon, damage);
    if (bullet) {
      io.to(gameId).emit('bulletCreated', bullet);
    }
  });

  socket.on('meleeAttack', ({ gameId, position, direction, weapon, damage, range }) => {
    const game = games.get(gameId);
    if (!game) return;

    const hits = game.handleMeleeAttack(socket.id, position, direction, weapon, damage, range);
    
    hits.forEach(hit => {
      io.to(gameId).emit('enemyHit', {
        enemyId: hit.enemyId,
        damage: hit.damage,
        isHeadshot: hit.isHeadshot,
        position: hit.position
      });
    });
  });

  socket.on('playerHit', ({ gameId, damage, source }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.getPlayerData(socket.id);
    if (!player) return;

    const result = game.handlePlayerDamage(socket.id, damage, player.position, source);
    
    if (result) {
      if (result.isDowned) {
        io.to(gameId).emit('playerDowned', {
          playerId: socket.id,
          playerName: player.name
        });
      } else {
        socket.emit('playerDamaged', {
          playerId: socket.id,
          damage: result.damage,
          sourcePosition: result.sourcePosition,
          currentHealth: result.health
        });
      }
    }
  });

  socket.on('revivePlayer', ({ gameId, targetId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const success = game.revivePlayer(socket.id, targetId);
    if (success) {
      const target = game.getPlayerData(targetId);
      io.to(gameId).emit('playerRevived', {
        playerId: targetId,
        playerName: target ? target.name : 'Unknown',
        reviverId: socket.id
      });
    }
  });

  socket.on('pickupCollected', ({ gameId, pickupId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const pickup = game.pickups.get(pickupId);
    if (!pickup) return;

    const player = game.getPlayerData(socket.id);
    if (!player) return;

    // Apply pickup effect
    let effect = null;
    if (['pistol', 'shotgun', 'smg', 'rifle', 'bat', 'pipe'].includes(pickup.type)) {
      player.weapons[1] = pickup.type;
      effect = { weapon: pickup.type };
    } else {
      switch (pickup.type) {
        case 'ammo':
          player.ammo += 15;
          effect = { stat: 'ammo', amount: 15 };
          break;
        case 'food':
          player.hunger = Math.min(100, player.hunger + 25);
          effect = { stat: 'hunger', amount: 25 };
          break;
        case 'medicine':
          player.health = Math.min(player.maxHealth, player.health + 20);
          effect = { stat: 'health', amount: 20 };
          break;
        case 'blanket':
          player.warmth = Math.min(100, player.warmth + 30);
          effect = { stat: 'warmth', amount: 30 };
          break;
        case 'water':
          player.hunger = Math.min(100, player.hunger + 15);
          player.energy = Math.min(100, player.energy + 20);
          effect = { stat: 'water', amount: 15 };
          break;
      }
    }

    game.pickups.delete(pickupId);

    io.to(gameId).emit('pickupCollected', {
      pickupId,
      playerId: socket.id,
      playerName: player.name,
      type: pickup.type,
      effect
    });
  });

  // NEW: Loot container interaction
  socket.on('lootContainer', ({ gameId, containerId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const loot = game.lootContainer(socket.id, containerId);
    
    io.to(gameId).emit('containerLooted', {
      containerId,
      playerId: socket.id,
      loot
    });
  });

  // NEW: Collect objective item
  socket.on('collectObjective', ({ gameId, objectiveId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const success = game.collectObjective(socket.id, objectiveId);
    
    if (success) {
      io.to(gameId).emit('objectiveCollected', {
        objectiveId,
        playerId: socket.id,
        objectives: game.getObjectivesData()
      });
    }
  });

  // NEW: Player trying to escape
  socket.on('attemptEscape', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const objectives = game.getObjectivesData();
    
    if (objectives.escapeActive) {
      const player = game.getPlayerData(socket.id);
      if (!player) return;

      // Check if player is in escape zone
      const escapeZone = objectives.escapeZone;
      const dx = player.position.x - escapeZone.position.x;
      const dz = player.position.z - escapeZone.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= escapeZone.radius) {
        // Player escaped successfully!
        io.to(gameId).emit('playerEscaped', {
          playerId: socket.id,
          playerName: player.name
        });

        // Check if all alive players escaped
        // For now, just end the game on first escape
        io.to(gameId).emit('gameOver', {
          reason: 'Escaped successfully!',
          stats: game.getGameStats(),
          victory: true
        });

        game.shutdown();
        const gameLoop = gameLoops.get(gameId);
        if (gameLoop) {
          clearInterval(gameLoop);
          gameLoops.delete(gameId);
        }
        games.delete(gameId);
        lobbyManager.deleteLobby(gameId);
      }
    }
  });

  socket.on('perkSelected', ({ gameId, perkId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.getPlayerData(socket.id);
    if (!player) return;

    // Add perk if not already have it
    if (!player.perks.find(p => p.id === perkId)) {
      player.perks.push({ id: perkId });
      socket.emit('perkApplied', { perkId });
    }
  });

  socket.on('ping', ({ gameId, position, type }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.getPlayerData(socket.id);
    if (!player) return;

    const ping = {
      id: require('uuid').v4(),
      playerId: socket.id,
      playerName: player.name,
      playerColor: player.color,
      position,
      type: type || 'default',
      createdAt: Date.now()
    };

    game.pings.push(ping);
    io.to(gameId).emit('ping', ping);
  });

  // NEW: Glass break with map tracking
  socket.on('glassBreak', ({ gameId, glassId, position }) => {
    const game = games.get(gameId);
    if (!game) return;

    // Update glass state
    if (glassId) {
      game.breakGlass(glassId);
    }

    // Alert nearby enemies
    for (const enemy of game.enemies.values()) {
      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < 15 && !enemy.aggroed) {
        enemy.aggroed = true;
        io.to(gameId).emit('enemyAggro', {
          enemyId: enemy.id,
          type: enemy.type,
          position: enemy.position
        });
      }
    }

    io.to(gameId).emit('glassBroken', { glassId, position });
  });

  // Chat message handling
  socket.on('chatMessage', ({ gameId, message }) => {
    const game = games.get(gameId);
    if (!game) return;

    const chatMsg = game.addChatMessage(socket.id, message);
    if (chatMsg) {
      io.to(gameId).emit('chatMessage', chatMsg);
    }
  });

  // ============================================
  // DISCONNECT
  // ============================================

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Remove from any lobby
    const lobby = lobbyManager.findPlayerLobby(socket.id);
    if (lobby) {
      const updatedLobby = lobbyManager.leaveLobby(lobby.id, socket.id);
      if (updatedLobby) {
        io.to(lobby.id).emit('lobbyUpdated', updatedLobby);
      }
      io.emit('lobbiesUpdated', lobbyManager.getPublicLobbies());
    }

    // Remove from any game
    for (const [gameId, game] of games) {
      if (game.hasPlayer(socket.id)) {
        game.removePlayer(socket.id);
        io.to(gameId).emit('playerLeft', socket.id);

        // End game if no players left
        if (game.getPlayerCount() === 0) {
          game.shutdown(); // NEW: Cleanup pathfinding
          const gameLoop = gameLoops.get(gameId);
          if (gameLoop) {
            clearInterval(gameLoop);
            gameLoops.delete(gameId);
          }
          games.delete(gameId);
          lobbyManager.deleteLobby(gameId);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Local network access: http://YOUR_LOCAL_IP:${PORT}`);
});
