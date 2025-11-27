// GameState.js - Server-side game logic with procedural map and pathfinding
// Place in: server/game/GameState.js

const { v4: uuidv4 } = require('uuid');
const MapManager = require('./MapManager');
const CollisionSystem = require('./CollisionSystem');
const PathfindingSystem = require('./PathfindingSystem');

// Name generation data
const FIRST_NAMES_MALE = [
  'Thomas', 'James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Charles', 'Daniel',
  'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin',
  'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
  'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
  'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron',
  'Jose', 'Adam', 'Nathan', 'Henry', 'Douglas', 'Zachary', 'Peter', 'Kyle', 'Noah', 'Ethan'
];

const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
  'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
  'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather',
  'Diane', 'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia', 'Victoria', 'Kelly', 'Lauren', 'Christina'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'
];

const LEVEL_CONFIG = [
  { name: 'Skid Row', areaId: 'skid_row', maxEnemies: 12, spawnRate: 180, killsToAdvance: 15, isMilestone: false },
  { name: 'The Tunnels', areaId: 'the_tunnels', maxEnemies: 15, spawnRate: 150, killsToAdvance: 35, isMilestone: false },
  { name: 'Industrial Wasteland', areaId: 'industrial_wasteland', maxEnemies: 18, spawnRate: 120, killsToAdvance: 60, isMilestone: true },
  { name: 'The Camps', areaId: 'the_camps', maxEnemies: 20, spawnRate: 100, killsToAdvance: 90, isMilestone: false },
  { name: 'Downtown Ruins', areaId: 'downtown_ruins', maxEnemies: 25, spawnRate: 80, killsToAdvance: 130, isMilestone: false },
  { name: 'The Depths', areaId: 'the_depths', maxEnemies: 30, spawnRate: 60, killsToAdvance: 999, isMilestone: true }
];

const ENEMY_TYPES = {
  normal: { 
    health: 30, speed: 0.04, damage: 8, 
    spawnWeight: 50, headMultiplier: 2 
  },
  runner: { 
    health: 15, speed: 0.075, damage: 6, 
    spawnWeight: 25, headMultiplier: 2.5 
  },
  brute: { 
    health: 90, speed: 0.025, damage: 16, 
    spawnWeight: 15, headMultiplier: 1.5 
  },
  thrower: { 
    health: 22, speed: 0.035, damage: 15, 
    spawnWeight: 10, headMultiplier: 2, 
    ranged: true, throwCooldown: 180, throwRange: 20 
  },
  boss: { 
    health: 300, speed: 0.03, damage: 25, 
    spawnWeight: 0, headMultiplier: 1.2, isBoss: true 
  }
};

const PICKUP_TYPES = {
  consumables: ['food', 'medicine', 'ammo', 'blanket', 'water'],
  weapons: ['pistol', 'shotgun', 'smg', 'rifle', 'bat', 'pipe']
};

const WEAPON_STATS = {
  knife: { damage: 35, type: 'melee' },
  bat: { damage: 50, type: 'melee' },
  pipe: { damage: 45, type: 'melee' },
  pistol: { damage: 25, type: 'ranged' },
  shotgun: { damage: 15, type: 'ranged', pellets: 6 },
  smg: { damage: 12, type: 'ranged' },
  rifle: { damage: 45, type: 'ranged' }
};

class GameState {
  constructor(gameId, lobbyPlayers) {
    this.gameId = gameId;
    this.worldSeed = Math.floor(Math.random() * 1000000);
    this.level = 1;
    this.totalKills = 0;
    this.frameCount = 0;
    this.playerCount = lobbyPlayers.length;
    this.gameTime = Date.now();
    
    // Difficulty scaling based on player count
    this.difficultyMult = 1 + (this.playerCount - 1) * 0.3;
    
    // Initialize map manager with procedural generation
    const levelConfig = this.getLevelConfig();
    this.mapManager = new MapManager(levelConfig.areaId || 'skid_row', this.worldSeed);
    this.mapData = this.mapManager.generate();
    
    // Initialize collision system
    this.collisionSystem = new CollisionSystem(this.mapManager);
    
    // Initialize pathfinding system
    this.pathfindingSystem = new PathfindingSystem(this.mapManager);
    
    // Initialize players
    this.players = new Map();
    const spawnPoints = this.mapData.spawnPoints.players;
    
    lobbyPlayers.forEach((p, index) => {
      const spawnPoint = spawnPoints[index % spawnPoints.length];
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        position: {
          x: spawnPoint.x + (Math.random() - 0.5) * 2,
          y: 1.6,
          z: spawnPoint.z + (Math.random() - 0.5) * 2
        },
        rotation: { yaw: 0, pitch: 0 },
        health: 100,
        maxHealth: 100,
        hunger: 100,
        warmth: 100,
        energy: 100,
        ammo: 30,
        score: 0,
        kills: 0,
        headshots: 0,
        damageDealt: 0,
        revives: 0,
        alive: true,
        isDowned: false,
        downedTimer: 0,
        weapons: ['knife', null],
        activeSlot: 0,
        perks: [],
        color: this.getPlayerColor(index),
        isInsideBuilding: false
      });
    });
    
    // Initialize enemies
    this.enemies = new Map();
    this.spawnInitialEnemies();
    
    // Initialize pickups
    this.pickups = new Map();
    this.spawnInitialPickups();
    
    // Bullets
    this.bullets = new Map();
    
    // Projectiles (thrown by enemies)
    this.projectiles = new Map();
    
    // Pings
    this.pings = [];
    
    // Boss tracking
    this.bossSpawned = false;
    this.bossKilled = false;
    
    // Chat messages (combat log + player chat)
    this.chatMessages = [];
    
    // Objectives tracking
    this.objectives = {
      items: new Map(), // itemId -> { collected: false, collectedBy: null }
      escapeActive: false
    };
    
    // Initialize objectives from map data
    for (const obj of this.mapData.objectives) {
      if (obj.type === 'collect') {
        this.objectives.items.set(obj.id, { collected: false, collectedBy: null });
      }
    }
    
    // Glass zones state (synced with map data)
    this.glassZones = new Map();
    for (const prop of this.mapData.props) {
      if (prop.type === 'glass_zone') {
        this.glassZones.set(prop.id, { broken: false });
      }
    }
    
    // Loot containers state
    this.lootContainers = new Map();
    for (const container of this.mapData.lootContainers) {
      this.lootContainers.set(container.id, { looted: false, loot: container.loot });
    }
    
    console.log(`[GameState] Created game ${gameId} with seed ${this.worldSeed}`);
    console.log(`[GameState] Map: ${this.mapManager.area.name}, Players: ${this.playerCount}`);
  }

  // Generate a random identity for an enemy
  generateEnemyIdentity() {
    const isMale = Math.random() > 0.5;
    const firstName = isMale 
      ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)]
      : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const age = 18 + Math.floor(Math.random() * 55); // 18-72
    const netWorth = Math.round((Math.random() * 10) * 100) / 100; // 0.00 - 10.00
    
    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      gender: isMale ? 'Male' : 'Female',
      age,
      netWorth
    };
  }

  getPlayerColor(index) {
    const colors = [0x4a9eff, 0xff4a4a, 0x4aff4a, 0xffff4a, 0xff4aff, 0x4affff, 0xffaa4a, 0xaa4aff];
    return colors[index % colors.length];
  }

  getLevelConfig() {
    return LEVEL_CONFIG[Math.min(this.level - 1, LEVEL_CONFIG.length - 1)];
  }

  getLevelName() {
    return this.getLevelConfig().name;
  }

  // ============================================
  // SPAWNING
  // ============================================

  spawnInitialEnemies() {
    const config = this.getLevelConfig();
    const initialCount = Math.min(6, Math.floor(config.maxEnemies * this.difficultyMult / 2));
    for (let i = 0; i < initialCount; i++) {
      this.spawnEnemy();
    }
  }

  spawnInitialPickups() {
    // Pickups are now handled by the map's loot containers
    // But we can still spawn some additional floating pickups
    for (let i = 0; i < 5; i++) {
      this.spawnPickup('consumable');
    }
    for (let i = 0; i < 2; i++) {
      this.spawnPickup('weapon');
    }
  }

  selectEnemyType() {
    const config = this.getLevelConfig();
    
    // Adjust weights based on level
    const weights = { ...ENEMY_TYPES };
    if (this.level < 2) {
      weights.runner.spawnWeight = 0;
      weights.brute.spawnWeight = 0;
      weights.thrower.spawnWeight = 0;
    } else if (this.level < 3) {
      weights.brute.spawnWeight = 5;
      weights.thrower.spawnWeight = 5;
    }
    
    const totalWeight = Object.values(weights).reduce((sum, t) => sum + (t.spawnWeight || 0), 0);
    let random = Math.random() * totalWeight;
    
    for (const [type, data] of Object.entries(weights)) {
      random -= data.spawnWeight || 0;
      if (random <= 0) return type;
    }
    
    return 'normal';
  }

  spawnEnemy(forceType = null) {
    const type = forceType || this.selectEnemyType();
    const typeData = ENEMY_TYPES[type];
    const id = uuidv4();
    
    // Generate identity for this enemy
    const identity = this.generateEnemyIdentity();
    
    // Get player positions for spawn calculation
    const playerPositions = Array.from(this.players.values())
      .filter(p => p.alive)
      .map(p => p.position);
    
    // Find spawn position using map manager
    const spawnPos = this.mapManager.getEnemySpawnPosition(playerPositions, 25, 80);
    
    if (!spawnPos) {
      // Fallback to simple spawn if map manager can't find position
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 30;
      spawnPos = {
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist
      };
    }
    
    const scaledHealth = typeData.health * (1 + (this.level - 1) * 0.15);
    
    this.enemies.set(id, {
      id,
      type,
      identity,
      position: { x: spawnPos.x, y: 0, z: spawnPos.z },
      rotation: 0,
      health: scaledHealth,
      maxHealth: scaledHealth,
      speed: typeData.speed * (0.9 + Math.random() * 0.2) * (1 + (this.level - 1) * 0.05),
      damage: typeData.damage * (1 + (this.level - 1) * 0.1),
      headMultiplier: typeData.headMultiplier,
      attackCooldown: 0,
      throwCooldown: typeData.throwCooldown || 0,
      ranged: typeData.ranged || false,
      throwRange: typeData.throwRange || 0,
      isBoss: typeData.isBoss || false,
      aggroed: false,
      targetPlayerId: null,
      // Pathfinding state
      pathfindingState: 'idle', // idle, chasing, patrolling, waiting
      patrolTarget: null,
      lastPathRequest: 0,
      stuckTimer: 0
    });
    
    return id;
  }

  spawnBoss() {
    if (this.bossSpawned) return;
    
    const id = this.spawnEnemy('boss');
    this.bossSpawned = true;
    
    return id;
  }

  spawnPickup(category = 'consumable') {
    const id = uuidv4();
    let type;
    
    if (category === 'weapon') {
      const weapons = [...PICKUP_TYPES.weapons];
      if (this.level < 2) {
        const rareIndex = weapons.indexOf('rifle');
        if (rareIndex > -1) weapons.splice(rareIndex, 1);
      }
      type = weapons[Math.floor(Math.random() * weapons.length)];
    } else {
      type = PICKUP_TYPES.consumables[Math.floor(Math.random() * PICKUP_TYPES.consumables.length)];
    }
    
    // Find valid spawn position
    let position;
    for (let attempt = 0; attempt < 20; attempt++) {
      const bounds = this.mapManager.area.bounds;
      const x = (Math.random() - 0.5) * (bounds.maxX - bounds.minX) * 0.8;
      const z = (Math.random() - 0.5) * (bounds.maxZ - bounds.minZ) * 0.8;
      
      if (!this.mapManager.isBlocked(x, z)) {
        position = { x, y: 0.5, z };
        break;
      }
    }
    
    if (!position) {
      position = { x: 0, y: 0.5, z: 0 };
    }
    
    this.pickups.set(id, {
      id,
      type,
      position,
      rotation: 0
    });
    
    return id;
  }

  // ============================================
  // PLAYER ACTIONS
  // ============================================

  handlePlayerInput(playerId, input) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;
    
    if (input.position) {
      // Validate movement with collision system
      const newPos = this.collisionSystem.movePlayer(player.position, input.position);
      
      // Clamp to map bounds
      const clamped = this.collisionSystem.clampToMap(newPos.x, newPos.z);
      player.position = {
        x: clamped.x,
        y: input.position.y || player.position.y,
        z: clamped.z
      };
      
      // Check if player is inside a building
      const interior = this.collisionSystem.isInInterior(player.position.x, player.position.z);
      player.isInsideBuilding = !!interior;
      player.currentInterior = interior ? interior.id : null;
    }
    
    if (input.rotation) {
      player.rotation = input.rotation;
    }
    
    if (input.stats) {
      if (input.stats.energy !== undefined) player.energy = input.stats.energy;
      // Warmth is now calculated server-side based on position
    }
  }

  createBullet(playerId, position, direction, weapon, damage) {
    const player = this.players.get(playerId);
    if (!player) return null;
    
    const id = uuidv4();
    const bullet = {
      id,
      ownerId: playerId,
      weapon: weapon || 'pistol',
      damage: damage || WEAPON_STATS[weapon]?.damage || 25,
      position: { ...position },
      velocity: {
        x: direction.x * 1.5,
        y: direction.y * 1.5,
        z: direction.z * 1.5
      },
      createdAt: Date.now()
    };
    
    this.bullets.set(id, bullet);
    return bullet;
  }

  handleMeleeAttack(playerId, position, direction, weapon, damage, range) {
    const player = this.players.get(playerId);
    if (!player) return [];
    
    const hits = [];
    
    for (const [enemyId, enemy] of this.enemies) {
      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist > range) continue;
      
      // Check if enemy is in front of player (within ~90 degree cone)
      const enemyDir = { x: dx / dist, z: dz / dist };
      const dot = direction.x * enemyDir.x + direction.z * enemyDir.z;
      
      if (dot > 0.3) { // Roughly 70 degree cone
        const actualDamage = damage;
        enemy.health -= actualDamage;
        player.damageDealt += actualDamage;
        
        hits.push({
          enemyId,
          damage: actualDamage,
          isHeadshot: false,
          position: enemy.position
        });
        
        if (enemy.health <= 0) {
          this.handleEnemyDeath(enemyId, playerId, weapon, false);
        }
      }
    }
    
    return hits;
  }

  // ============================================
  // DAMAGE & DEATH
  // ============================================

  handleBulletHit(bulletId, enemyId, isHeadshot = false) {
    const bullet = this.bullets.get(bulletId);
    const enemy = this.enemies.get(enemyId);
    
    if (!bullet || !enemy) return null;
    
    const player = this.players.get(bullet.ownerId);
    
    let damage = bullet.damage;
    if (isHeadshot) {
      damage *= enemy.headMultiplier || 2;
      if (player) {
        player.headshots++;
        const headshotPerk = player.perks.find(p => p.id === 'headshot_boost');
        if (headshotPerk) {
          damage *= 1.25;
        }
      }
    }
    
    enemy.health -= damage;
    if (player) {
      player.damageDealt += damage;
    }
    
    this.bullets.delete(bulletId);
    
    if (enemy.health <= 0) {
      this.handleEnemyDeath(enemyId, bullet.ownerId, bullet.weapon, isHeadshot);
    }
    
    return {
      damage,
      isHeadshot,
      killed: enemy.health <= 0,
      position: enemy.position
    };
  }

  handleEnemyDeath(enemyId, killerId, weapon, isHeadshot) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) return;
    
    const killer = this.players.get(killerId);
    
    // Award score and kills
    if (killer) {
      const baseScore = enemy.isBoss ? 500 : 50;
      const headshotBonus = isHeadshot ? 25 : 0;
      killer.score += baseScore + headshotBonus;
      killer.kills++;
    }
    
    this.totalKills++;
    
    // Create kill message for chat
    const killerName = killer ? killer.name : 'Unknown';
    const identity = enemy.identity;
    const killMessage = {
      id: uuidv4(),
      type: 'kill',
      timestamp: Date.now(),
      text: `${identity.fullName}, Age ${identity.age}, net worth $${identity.netWorth.toFixed(2)} - Killed by ${killerName}${isHeadshot ? ' (HEADSHOT)' : ''}`,
      killer: killerName,
      victim: identity,
      weapon: weapon,
      isHeadshot
    };
    
    this.chatMessages.push(killMessage);
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    
    // Boss tracking
    if (enemy.isBoss) {
      this.bossKilled = true;
    }
    
    // Clear pathfinding for this enemy
    this.pathfindingSystem.clearPath(enemyId);
    
    // Remove enemy
    this.enemies.delete(enemyId);
    
    // Chance to spawn pickup at death location
    if (Math.random() < 0.2) {
      const pickupId = uuidv4();
      const type = Math.random() < 0.3 
        ? PICKUP_TYPES.weapons[Math.floor(Math.random() * PICKUP_TYPES.weapons.length)]
        : PICKUP_TYPES.consumables[Math.floor(Math.random() * PICKUP_TYPES.consumables.length)];
      
      this.pickups.set(pickupId, {
        id: pickupId,
        type,
        position: { x: enemy.position.x, y: 0.5, z: enemy.position.z },
        rotation: 0
      });
    }
  }

  handlePlayerDamage(playerId, damage, sourcePosition, sourceType) {
    const player = this.players.get(playerId);
    if (!player || !player.alive || player.isDowned) return null;
    
    // Apply perks
    const defensePerk = player.perks.find(p => p.id === 'defense_boost');
    if (defensePerk) {
      damage *= 0.85;
    }
    
    player.health -= damage;
    
    if (player.health <= 0) {
      player.health = 0;
      player.isDowned = true;
      player.downedTimer = 900; // 15 seconds at 60fps
    }
    
    return {
      damage,
      health: player.health,
      isDowned: player.isDowned,
      sourcePosition,
      sourceType
    };
  }

  revivePlayer(reviverId, targetId) {
    const reviver = this.players.get(reviverId);
    const target = this.players.get(targetId);
    
    if (!reviver || !target || !reviver.alive || !target.isDowned) return false;
    
    target.isDowned = false;
    target.health = 30;
    target.downedTimer = 0;
    reviver.revives++;
    reviver.score += 100;
    
    return true;
  }

  // ============================================
  // GAME UPDATE
  // ============================================

  update() {
    this.frameCount++;
    const currentTime = Date.now();
    
    const config = this.getLevelConfig();
    
    // Spawn enemies
    const effectiveSpawnRate = Math.floor(config.spawnRate / this.difficultyMult);
    if (this.frameCount % effectiveSpawnRate === 0) {
      const maxEnemies = Math.floor(config.maxEnemies * this.difficultyMult);
      if (this.enemies.size < maxEnemies) {
        this.spawnEnemy();
      }
    }
    
    // Spawn boss at milestone
    if (config.isMilestone && !this.bossSpawned && this.totalKills >= config.killsToAdvance - 5) {
      this.spawnBoss();
    }
    
    // Spawn pickups
    const pickupRate = 300 - this.level * 15;
    if (this.frameCount % pickupRate === 0 && this.pickups.size < 12 + this.playerCount * 2) {
      this.spawnPickup(Math.random() < 0.1 ? 'weapon' : 'consumable');
    }
    
    // Update pathfinding system
    this.pathfindingSystem.update(currentTime);
    
    // Update enemies AI
    this.updateEnemies();
    
    // Update bullets
    this.updateBullets();
    
    // Update projectiles
    this.updateProjectiles();
    
    // Update player survival stats
    this.updatePlayerStats();
    
    // Update downed players
    this.updateDownedPlayers();
    
    // Check objectives
    this.updateObjectives();
    
    // Rotate pickups
    for (const pickup of this.pickups.values()) {
      pickup.rotation += 0.03;
    }
    
    // Clean up old pings
    this.pings = this.pings.filter(p => Date.now() - p.createdAt < 5000);
    
    // Check level up
    this.checkLevelUp();
  }

  updateEnemies() {
    const currentTime = Date.now();
    
    for (const [enemyId, enemy] of this.enemies) {
      // Find nearest alive, non-downed player
      let nearestPlayer = null;
      let nearestDist = Infinity;
      
      for (const player of this.players.values()) {
        if (!player.alive || player.isDowned) continue;
        
        const dx = player.position.x - enemy.position.x;
        const dz = player.position.z - enemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayer = player;
        }
      }
      
      if (!nearestPlayer) continue;
      
      // Aggro check
      if (!enemy.aggroed && nearestDist < 18) {
        enemy.aggroed = true;
        enemy.targetPlayerId = nearestPlayer.id;
      }
      
      const dx = nearestPlayer.position.x - enemy.position.x;
      const dz = nearestPlayer.position.z - enemy.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      // Check line of sight
      const hasLOS = this.collisionSystem.hasLineOfSight(
        enemy.position.x, enemy.position.z,
        nearestPlayer.position.x, nearestPlayer.position.z
      );
      
      // Ranged enemy behavior (throwers)
      if (enemy.ranged && dist < enemy.throwRange && hasLOS) {
        // Stay at range and throw
        if (dist < 8) {
          // Back away
          const newPos = this.collisionSystem.moveEnemy(
            enemy.position,
            {
              x: enemy.position.x - (dx / dist) * enemy.speed * 0.5,
              y: 0,
              z: enemy.position.z - (dz / dist) * enemy.speed * 0.5
            }
          );
          enemy.position.x = newPos.x;
          enemy.position.z = newPos.z;
        }
        
        // Throw projectile
        if (enemy.throwCooldown <= 0) {
          this.createProjectile(enemy, nearestPlayer);
          enemy.throwCooldown = ENEMY_TYPES.thrower.throwCooldown;
        }
        
        enemy.pathfindingState = 'attacking';
      } else if (hasLOS && dist < 20) {
        // Direct line of sight - move directly toward player
        if (dist > 1.5) {
          const moveSpeed = enemy.speed;
          const newPos = this.collisionSystem.moveEnemy(
            enemy.position,
            {
              x: enemy.position.x + (dx / dist) * moveSpeed,
              y: 0,
              z: enemy.position.z + (dz / dist) * moveSpeed
            }
          );
          
          // Check if actually moved
          const movedDist = Math.sqrt(
            Math.pow(newPos.x - enemy.position.x, 2) + 
            Math.pow(newPos.z - enemy.position.z, 2)
          );
          
          if (movedDist < moveSpeed * 0.3) {
            enemy.stuckTimer++;
          } else {
            enemy.stuckTimer = 0;
          }
          
          enemy.position.x = newPos.x;
          enemy.position.z = newPos.z;
        }
        
        enemy.pathfindingState = 'chasing';
      } else {
        // No line of sight or far away - use pathfinding
        
        // Request new path periodically
        if (currentTime - enemy.lastPathRequest > 1000 || !this.pathfindingSystem.hasPath(enemyId)) {
          this.pathfindingSystem.requestPath(
            enemyId,
            enemy.position,
            nearestPlayer.position
          );
          enemy.lastPathRequest = currentTime;
        }
        
        // Follow path
        const moveDir = this.pathfindingSystem.getMoveDirection(enemyId, enemy.position);
        
        if (moveDir && dist > 1.5) {
          const moveSpeed = enemy.speed;
          const newPos = this.collisionSystem.moveEnemy(
            enemy.position,
            {
              x: enemy.position.x + moveDir.x * moveSpeed,
              y: 0,
              z: enemy.position.z + moveDir.z * moveSpeed
            }
          );
          enemy.position.x = newPos.x;
          enemy.position.z = newPos.z;
          enemy.pathfindingState = 'pathfinding';
        } else if (this.pathfindingSystem.pathFailed(enemyId)) {
          // Path failed - patrol nearby or wait
          if (enemy.ranged) {
            // Ranged enemies shoot if they have LOS, even if path failed
            enemy.pathfindingState = 'waiting';
          } else {
            // Melee enemies patrol
            if (!enemy.patrolTarget || Math.random() < 0.02) {
              // Pick new patrol point
              const patrolAngle = Math.random() * Math.PI * 2;
              const patrolDist = 5 + Math.random() * 10;
              enemy.patrolTarget = {
                x: enemy.position.x + Math.cos(patrolAngle) * patrolDist,
                z: enemy.position.z + Math.sin(patrolAngle) * patrolDist
              };
            }
            
            // Move toward patrol target
            const pdx = enemy.patrolTarget.x - enemy.position.x;
            const pdz = enemy.patrolTarget.z - enemy.position.z;
            const pdist = Math.sqrt(pdx * pdx + pdz * pdz);
            
            if (pdist > 1) {
              const newPos = this.collisionSystem.moveEnemy(
                enemy.position,
                {
                  x: enemy.position.x + (pdx / pdist) * enemy.speed * 0.5,
                  y: 0,
                  z: enemy.position.z + (pdz / pdist) * enemy.speed * 0.5
                }
              );
              enemy.position.x = newPos.x;
              enemy.position.z = newPos.z;
            }
            
            enemy.pathfindingState = 'patrolling';
          }
        }
      }
      
      enemy.rotation = Math.atan2(dx, dz);
      
      // Melee attack
      if (enemy.attackCooldown > 0) {
        enemy.attackCooldown--;
      } else if (dist < 1.8) {
        this.handlePlayerDamage(nearestPlayer.id, enemy.damage, enemy.position, 'enemy');
        enemy.attackCooldown = 60;
      }
      
      if (enemy.throwCooldown > 0) {
        enemy.throwCooldown--;
      }
    }
  }

  createProjectile(enemy, targetPlayer) {
    const id = uuidv4();
    const dx = targetPlayer.position.x - enemy.position.x;
    const dy = 1.5 - 0.5;
    const dz = targetPlayer.position.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    const speed = 0.3;
    
    this.projectiles.set(id, {
      id,
      ownerId: enemy.id,
      position: { 
        x: enemy.position.x, 
        y: 1.5, 
        z: enemy.position.z 
      },
      velocity: {
        x: (dx / dist) * speed,
        y: 0.15 + dy * 0.02,
        z: (dz / dist) * speed
      },
      damage: enemy.damage,
      createdAt: Date.now()
    });
  }

  updateBullets() {
    const bulletsToRemove = [];
    
    for (const [bulletId, bullet] of this.bullets) {
      // Move bullet
      const prevPos = { ...bullet.position };
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      bullet.position.z += bullet.velocity.z;
      
      // Check collision with walls
      if (this.mapManager.isBlocked(bullet.position.x, bullet.position.z)) {
        bulletsToRemove.push(bulletId);
        continue;
      }
      
      // Check enemy collision
      for (const [enemyId, enemy] of this.enemies) {
        const dx = bullet.position.x - enemy.position.x;
        const dz = bullet.position.z - enemy.position.z;
        const distXZ = Math.sqrt(dx * dx + dz * dz);
        
        if (distXZ > 1) continue;
        
        const enemyHeight = enemy.isBoss ? 2.2 : 1.2;
        const headY = enemyHeight + 0.15;
        const isHeadshot = Math.abs(bullet.position.y - headY) < 0.3;
        
        const bodyHit = bullet.position.y > 0 && bullet.position.y < enemyHeight + 0.5;
        
        if (isHeadshot || bodyHit) {
          this.handleBulletHit(bulletId, enemyId, isHeadshot);
          bulletsToRemove.push(bulletId);
          break;
        }
      }
      
      // Remove old bullets
      if (Date.now() - bullet.createdAt > 3000) {
        bulletsToRemove.push(bulletId);
      }
    }
    
    bulletsToRemove.forEach(id => this.bullets.delete(id));
  }

  updateProjectiles() {
    const toRemove = [];
    
    for (const [projId, proj] of this.projectiles) {
      proj.velocity.y -= 0.01;
      
      proj.position.x += proj.velocity.x;
      proj.position.y += proj.velocity.y;
      proj.position.z += proj.velocity.z;
      
      if (proj.position.y <= 0) {
        toRemove.push(projId);
        continue;
      }
      
      // Check wall collision
      if (this.mapManager.isBlocked(proj.position.x, proj.position.z)) {
        toRemove.push(projId);
        continue;
      }
      
      // Check player collision
      for (const player of this.players.values()) {
        if (!player.alive || player.isDowned) continue;
        
        const dx = proj.position.x - player.position.x;
        const dy = proj.position.y - player.position.y;
        const dz = proj.position.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist < 1) {
          this.handlePlayerDamage(player.id, proj.damage, proj.position, 'projectile');
          toRemove.push(projId);
          break;
        }
      }
      
      if (Date.now() - proj.createdAt > 5000) {
        toRemove.push(projId);
      }
    }
    
    toRemove.forEach(id => this.projectiles.delete(id));
  }

  updatePlayerStats() {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      
      // Hunger decay
      const hungerPerk = player.perks.find(p => p.id === 'hunger_boost');
      const hungerRate = hungerPerk ? 150 : 120;
      if (this.frameCount % hungerRate === 0) {
        player.hunger = Math.max(0, player.hunger - 1);
        if (player.hunger <= 0 && !player.isDowned) {
          this.handlePlayerDamage(player.id, 2, player.position, 'starvation');
        }
      }
      
      // Warmth decay (modified by interior and barrel fires)
      const warmthPerk = player.perks.find(p => p.id === 'warmth_boost');
      let warmthRate = warmthPerk ? 140 : 100;
      
      // Check if near barrel fire
      const nearFire = this.collisionSystem.getNearbyBarrelFire(player.position.x, player.position.z);
      if (nearFire) {
        // Near fire = gain warmth
        if (this.frameCount % 60 === 0) {
          player.warmth = Math.min(100, player.warmth + 2 * nearFire.warmthFactor);
        }
      } else if (player.isInsideBuilding) {
        // Inside building = slower warmth loss
        warmthRate *= 1.5; // 50% slower decay
        if (this.frameCount % warmthRate === 0) {
          player.warmth = Math.max(0, player.warmth - 1);
        }
      } else {
        // Outside = normal decay
        if (this.frameCount % warmthRate === 0) {
          player.warmth = Math.max(0, player.warmth - 1);
          if (player.warmth <= 20 && !player.isDowned) {
            this.handlePlayerDamage(player.id, 1, player.position, 'cold');
          }
        }
      }
      
      // Energy recovery
      if (this.frameCount % 60 === 0) {
        player.energy = Math.min(100, player.energy + 0.5);
      }
    }
  }

  updateDownedPlayers() {
    for (const player of this.players.values()) {
      if (!player.isDowned) continue;
      
      player.downedTimer--;
      
      if (player.downedTimer <= 0) {
        player.alive = false;
        player.isDowned = false;
      }
    }
  }

  updateObjectives() {
    // Check if all items collected
    let allCollected = true;
    for (const [itemId, itemState] of this.objectives.items) {
      if (!itemState.collected) {
        allCollected = false;
        break;
      }
    }
    
    // Activate escape zone when all items collected
    if (allCollected && !this.objectives.escapeActive) {
      this.objectives.escapeActive = true;
      this.addSystemMessage('🚗 Escape vehicle is ready! Get to the extraction point!');
    }
  }

  // Collect an objective item
  collectObjective(playerId, objectiveId) {
    const itemState = this.objectives.items.get(objectiveId);
    if (!itemState || itemState.collected) return false;
    
    itemState.collected = true;
    itemState.collectedBy = playerId;
    
    const player = this.players.get(playerId);
    const playerName = player ? player.name : 'Unknown';
    
    // Find objective info
    const objInfo = this.mapData.objectives.find(o => o.id === objectiveId);
    const itemName = objInfo ? objInfo.name : 'Objective Item';
    
    this.addSystemMessage(`📦 ${playerName} collected ${itemName}!`);
    
    return true;
  }

  // ============================================
  // LEVEL PROGRESSION
  // ============================================

  checkLevelUp() {
    const config = this.getLevelConfig();
    
    if (config.isMilestone) {
      if (this.bossKilled && this.totalKills >= config.killsToAdvance) {
        return this.advanceLevel();
      }
    } else if (this.totalKills >= config.killsToAdvance && this.level < LEVEL_CONFIG.length) {
      return this.advanceLevel();
    }
    
    return false;
  }

  advanceLevel() {
    this.level++;
    this.bossSpawned = false;
    this.bossKilled = false;
    
    // Potentially transition to new area
    // For now, stay in same area but increase difficulty
    
    return true;
  }

  // ============================================
  // UTILITY
  // ============================================

  isNearPlayer(pos, minDist) {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      const dx = player.position.x - pos.x;
      const dz = player.position.z - pos.z;
      if (Math.sqrt(dx * dx + dz * dz) < minDist) {
        return true;
      }
    }
    return false;
  }

  hasPlayer(playerId) {
    return this.players.has(playerId);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  getPlayerCount() {
    return this.players.size;
  }

  getAlivePlayers() {
    return Array.from(this.players.values()).filter(p => p.alive);
  }

  getPlayersData() {
    return Array.from(this.players.values());
  }

  getPlayerData(playerId) {
    return this.players.get(playerId);
  }

  getEnemiesData() {
    return Array.from(this.enemies.values());
  }

  getPickupsData() {
    return Array.from(this.pickups.values());
  }

  getBulletsData() {
    return Array.from(this.bullets.values());
  }

  getProjectilesData() {
    return Array.from(this.projectiles.values());
  }

  getPingsData() {
    return this.pings;
  }

  // Get map data for client
  getMapData() {
    return this.mapManager.toClientData();
  }

  // Get loot container states
  getLootContainersData() {
    return Array.from(this.lootContainers.entries()).map(([id, state]) => ({
      id,
      ...state
    }));
  }

  // Get objectives data
  getObjectivesData() {
    return {
      items: Array.from(this.objectives.items.entries()).map(([id, state]) => ({
        id,
        ...state,
        // Include position from map data
        ...this.mapData.objectives.find(o => o.id === id)
      })),
      escapeActive: this.objectives.escapeActive,
      escapeZone: this.mapData.objectives.find(o => o.type === 'escape')
    };
  }

  getGameStats() {
    return {
      level: this.level,
      levelName: this.getLevelName(),
      totalKills: this.totalKills,
      players: Array.from(this.players.values()).map(p => ({
        name: p.name,
        score: p.score,
        kills: p.kills,
        headshots: p.headshots,
        damageDealt: Math.floor(p.damageDealt),
        revives: p.revives,
        alive: p.alive
      }))
    };
  }

  // Chat methods
  addChatMessage(playerId, text) {
    const player = this.players.get(playerId);
    if (!player || !text || text.trim().length === 0) return null;
    
    const message = {
      id: uuidv4(),
      type: 'chat',
      timestamp: Date.now(),
      playerId,
      playerName: player.name,
      playerColor: player.color,
      text: text.trim().substring(0, 200)
    };
    
    this.chatMessages.push(message);
    
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    
    return message;
  }

  addSystemMessage(text) {
    const message = {
      id: uuidv4(),
      type: 'system',
      timestamp: Date.now(),
      text
    };
    
    this.chatMessages.push(message);
    
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    
    return message;
  }

  getChatMessages() {
    return this.chatMessages;
  }

  // Interact with loot container
  lootContainer(playerId, containerId) {
    const container = this.lootContainers.get(containerId);
    if (!container || container.looted) return null;
    
    container.looted = true;
    
    if (container.loot) {
      // Create pickup at container location
      const containerData = this.mapData.lootContainers.find(c => c.id === containerId);
      if (containerData) {
        const pickupId = uuidv4();
        this.pickups.set(pickupId, {
          id: pickupId,
          type: container.loot,
          position: { 
            x: containerData.position.x, 
            y: 0.5, 
            z: containerData.position.z 
          },
          rotation: 0
        });
        
        return container.loot;
      }
    }
    
    return null;
  }

  // Break glass zone
  breakGlass(glassId) {
    const glass = this.glassZones.get(glassId);
    if (glass && !glass.broken) {
      glass.broken = true;
      
      // Update prop state
      const prop = this.mapData.props.find(p => p.id === glassId);
      if (prop) {
        prop.broken = true;
      }
      
      return true;
    }
    return false;
  }

  // Shutdown (cleanup)
  shutdown() {
    if (this.pathfindingSystem) {
      this.pathfindingSystem.shutdown();
    }
  }
}

module.exports = GameState;
