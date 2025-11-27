// Game.jsx - Complete reimplementation with procedural map system
// Place in: client/src/components/Game.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import audioManager from '../game/AudioManager';
import HUD from './HUD';
import { MapRenderer } from '../game/MapRenderer';

const WEAPON_STATS = {
  knife: { damage: 35, range: 2.5, cooldown: 20, type: 'melee' },
  bat: { damage: 50, range: 3, cooldown: 30, type: 'melee' },
  pipe: { damage: 45, range: 2.8, cooldown: 25, type: 'melee' },
  pistol: { damage: 25, range: 80, cooldown: 15, type: 'ranged', ammo: 1 },
  shotgun: { damage: 15, range: 30, cooldown: 45, type: 'ranged', pellets: 6, ammo: 2 },
  smg: { damage: 12, range: 50, cooldown: 5, type: 'ranged', ammo: 1 },
  rifle: { damage: 45, range: 100, cooldown: 30, type: 'ranged', ammo: 1 }
};

const PERKS = [
  { id: 'health_boost', name: 'Vitality', desc: '+20 Max Health', icon: '❤️' },
  { id: 'speed_boost', name: 'Swift', desc: '+15% Move Speed', icon: '👟' },
  { id: 'damage_boost', name: 'Power', desc: '+20% Damage', icon: '💪' },
  { id: 'radar_boost', name: 'Scout', desc: '+50% Radar Range', icon: '📡' },
  { id: 'ammo_boost', name: 'Stockpile', desc: '+25% Ammo Pickups', icon: '📦' },
  { id: 'warmth_boost', name: 'Insulated', desc: '-30% Warmth Drain', icon: '🔥' },
  { id: 'hunger_boost', name: 'Efficient', desc: '-30% Hunger Drain', icon: '🍖' },
  { id: 'revive_boost', name: 'Medic', desc: '+50% Revive Speed', icon: '⚕️' },
  { id: 'melee_boost', name: 'Brawler', desc: '+30% Melee Damage', icon: '🗡️' },
  { id: 'headshot_boost', name: 'Precision', desc: '+25% Headshot Dmg', icon: '🎯' }
];

const PICKUP_CONFIG = {
  food: { color: 0x8a6a3a, icon: '🍞', name: 'Food' },
  medicine: { color: 0x4a8a4a, icon: '💊', name: 'Medicine' },
  ammo: { color: 0xaaaa4a, icon: '🔫', name: 'Ammo' },
  blanket: { color: 0x6a5a8a, icon: '🧥', name: 'Blanket' },
  water: { color: 0x4a7a9a, icon: '💧', name: 'Water' },
  pistol: { color: 0x555555, icon: '🔫', name: 'Pistol' },
  shotgun: { color: 0x654321, icon: '🔫', name: 'Shotgun' },
  smg: { color: 0x444444, icon: '🔫', name: 'SMG' },
  rifle: { color: 0x333333, icon: '🔫', name: 'Rifle' },
  bat: { color: 0x8b4513, icon: '🏏', name: 'Bat' },
  pipe: { color: 0x696969, icon: '🔧', name: 'Pipe' }
};

function Game({ socket, gameData, playerId, playerName, onQuit }) {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const mapRendererRef = useRef(null);
  const hudUpdateRef = useRef(null);
  const chatInputRef = useRef(null);
  
  const [isLocked, setIsLocked] = useState(false);
  const [hudState, setHudState] = useState(null);
  const [showPerkSelection, setShowPerkSelection] = useState(false);
  const [perkChoices, setPerkChoices] = useState([]);
  const [showEscapeMenu, setShowEscapeMenu] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [targetedEnemy, setTargetedEnemy] = useState(null);
  const [objectives, setObjectives] = useState({ items: [], escapeActive: false });
  
  const [settings, setSettings] = useState({
    masterVolume: 0.6,
    musicVolume: 0.25,
    sfxVolume: 0.5,
    brightness: 1.0
  });

  useEffect(() => {
    if (audioManager.masterGain) audioManager.masterGain.gain.value = settings.masterVolume;
    if (audioManager.musicGain) audioManager.musicGain.gain.value = settings.musicVolume;
    if (audioManager.sfxGain) audioManager.sfxGain.gain.value = settings.sfxVolume;
  }, [settings.masterVolume, settings.musicVolume, settings.sfxVolume]);

  const handleSelectPerk = useCallback((perk) => {
    if (!gameRef.current) return;
    gameRef.current.selectedPerks.push(perk);
    setShowPerkSelection(false);
    gameRef.current.notifications.push({ id: Date.now(), text: `${perk.name} acquired!`, icon: perk.icon, type: 'perk', expires: Date.now() + 3000 });
    socket.emit('perkSelected', { gameId: gameData.gameId, playerId, perkId: perk.id });
  }, [socket, gameData?.gameId, playerId]);

  const handleQuit = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    socket.emit('leaveLobby', gameData.gameId);
    if (onQuit) onQuit();
  }, [socket, gameData?.gameId, onQuit]);

  const sendChatMessage = useCallback(() => {
    if (chatInput.trim()) {
      socket.emit('chatMessage', { gameId: gameData.gameId, message: chatInput.trim() });
      setChatInput('');
    }
    setIsChatFocused(false);
    if (mountRef.current?.querySelector('canvas')) {
      mountRef.current.querySelector('canvas').requestPointerLock();
    }
  }, [chatInput, socket, gameData?.gameId]);

  useEffect(() => {
    if (!gameData || !mountRef.current) return;
    const mount = mountRef.current;

    // Get map data from gameData (sent by server on gameStarted)
    const mapData = gameData.mapData;
    if (!mapData) {
      console.error('[Game] No map data received from server!');
      return;
    }

    const scene = new THREE.Scene();
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    mount.appendChild(renderer.domElement);

    // Initialize map renderer with procedural map data
    mapRendererRef.current = new MapRenderer(scene, mapData);
    const mapObjects = mapRendererRef.current.render();

    // Store scene references
    sceneRef.current = { 
      scene, 
      mapObjects,
      bounds: mapData.bounds
    };

    // Adjust brightness based on settings
    if (mapObjects.lights) {
      mapObjects.lights.forEach(light => {
        if (light.intensity) light.intensity *= settings.brightness;
      });
    }

    // Create gun model
    const gunGroup = new THREE.Group();
    const createGunModel = (type) => {
      while (gunGroup.children.length) gunGroup.remove(gunGroup.children[0]);
      if (['knife', 'bat', 'pipe'].includes(type)) {
        const colors = { knife: 0x888888, bat: 0x8b4513, pipe: 0x555555 };
        const lengths = { knife: 0.25, bat: 0.6, pipe: 0.5 };
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, lengths[type]), new THREE.MeshLambertMaterial({ color: colors[type] }));
        blade.position.z = -lengths[type] / 2;
        gunGroup.add(blade);
      } else {
        const configs = { pistol: { bodyL: 0.2, barrelL: 0.15 }, shotgun: { bodyL: 0.3, barrelL: 0.4 }, smg: { bodyL: 0.25, barrelL: 0.2 }, rifle: { bodyL: 0.35, barrelL: 0.5 } };
        const cfg = configs[type] || configs.pistol;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, cfg.bodyL), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
        gunGroup.add(body);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, cfg.barrelL, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -(cfg.bodyL / 2 + cfg.barrelL / 2));
        gunGroup.add(barrel);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
        grip.position.set(0, -0.08, cfg.bodyL / 4);
        gunGroup.add(grip);
      }
    };
    createGunModel('knife');
    gunGroup.position.set(0.25, -0.2, -0.5);
    camera.add(gunGroup);
    scene.add(camera);

    const muzzleFlash = new THREE.PointLight(0xffaa00, 0, 5);
    muzzleFlash.position.set(0, 0, -0.6);
    gunGroup.add(muzzleFlash);

    // Raycaster for enemy targeting
    const raycaster = new THREE.Raycaster();
    raycaster.far = 50;

    // Game state
    const game = {
      position: new THREE.Vector3(0, 1.6, 0),
      yaw: 0, pitch: 0,
      health: 100, maxHealth: 100,
      hunger: 100, warmth: 100, energy: 100,
      ammo: 30, score: 0, kills: 0,
      weapons: ['knife', null],
      activeSlot: 0,
      isDowned: false,
      reviveProgress: 0,
      speedMult: 1, damageMult: 1, meleeMult: 1, radarRange: 50,
      level: 1, levelName: mapData.area?.name || 'Skid Row',
      allPlayers: [],
      selectedPerks: [],
      notifications: [],
      killFeed: [],
      damageIndicators: [],
      minimapData: { enemies: [], pickups: [], players: [], pings: [] },
      showLevelUp: false,
      enemies: new Map(),
      targetedEnemyId: null,
      isInsideBuilding: false,
      objectives: { items: [], escapeActive: false, escapeZone: null },
      lootContainerStates: new Map()
    };

    // Initialize player position from server data
    const myData = gameData.players.find(p => p.id === playerId);
    if (myData) game.position.set(myData.position.x, myData.position.y, myData.position.z);
    gameRef.current = game;

    // Initialize objectives from server data
    if (gameData.objectives) {
      game.objectives = gameData.objectives;
      setObjectives(gameData.objectives);
    }

    // Initialize loot container states
    if (gameData.lootContainers) {
      gameData.lootContainers.forEach(container => {
        game.lootContainerStates.set(container.id, container);
      });
    }

    // Mesh management
    const playerMeshes = new Map();
    const enemyMeshes = new Map();
    const pickupMeshes = new Map();
    const bulletMeshes = new Map();
    const pingMeshes = new Map();
    const objectiveMeshes = new Map();

    const playerBodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 1.2, 8);
    const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const pickupGeo = new THREE.OctahedronGeometry(0.3, 0);
    const bulletGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    // Input handling
    const keys = {};
    let shootCooldown = 0;
    let meleeCooldown = 0;
    let footstepTimer = 0;
    let escapeMenuOpen = false;
    let perkSelectionOpen = false;
    let chatFocused = false;

    // Simple client-side collision check using building data
    const checkCollision = (x, z) => {
      const bounds = mapData.bounds;
      // Check map bounds
      if (x < bounds.minX + 1 || x > bounds.maxX - 1 || z < bounds.minZ + 1 || z > bounds.maxZ - 1) {
        return true;
      }
      
      // Check buildings
      for (const building of mapData.buildings) {
        const halfW = building.dimensions.width / 2;
        const halfD = building.dimensions.depth / 2;
        const bx = building.position.x;
        const bz = building.position.z;
        
        // Simple AABB collision
        if (x >= bx - halfW - 0.4 && x <= bx + halfW + 0.4 &&
            z >= bz - halfD - 0.4 && z <= bz + halfD + 0.4) {
          
          // Check if building has accessible interior
          if (building.hasInterior) {
            // Find the interior data
            const interior = mapData.interiors.find(i => i.buildingId === building.id);
            if (interior && !interior.door.barricaded) {
              // Allow entry through door
              const door = interior.door;
              const doorRadius = 1.5;
              const distToDoor = Math.sqrt(Math.pow(x - door.position.x, 2) + Math.pow(z - door.position.z, 2));
              if (distToDoor < doorRadius) {
                return false; // Can pass through door
              }
            }
          }
          return true;
        }
      }
      
      // Check overpass pillars
      for (const overpass of mapData.overpasses) {
        for (const pillar of overpass.pillars) {
          const dist = Math.sqrt(Math.pow(x - pillar.position.x, 2) + Math.pow(z - pillar.position.z, 2));
          if (dist < 1.5) return true;
        }
      }
      
      // Check large vehicles
      for (const prop of mapData.props) {
        if (prop.type === 'vehicle') {
          const size = prop.subtype === 'bus' ? 5 : prop.subtype === 'truck' ? 3 : 2;
          const dx = Math.abs(x - prop.position.x);
          const dz = Math.abs(z - prop.position.z);
          if (dx < size + 0.4 && dz < 1.5 + 0.4) return true;
        } else if (prop.type === 'dumpster') {
          const dx = Math.abs(x - prop.position.x);
          const dz = Math.abs(z - prop.position.z);
          if (dx < 1.5 + 0.4 && dz < 1 + 0.4) return true;
        }
      }
      
      return false;
    };

    // Move with collision and wall sliding
    const moveWithCollision = (currentX, currentZ, desiredX, desiredZ) => {
      // Try full movement first
      if (!checkCollision(desiredX, desiredZ)) {
        return { x: desiredX, z: desiredZ };
      }
      
      // Try X-only movement (slide along Z wall)
      if (!checkCollision(desiredX, currentZ)) {
        return { x: desiredX, z: currentZ };
      }
      
      // Try Z-only movement (slide along X wall)
      if (!checkCollision(currentX, desiredZ)) {
        return { x: currentX, z: desiredZ };
      }
      
      // Can't move at all
      return { x: currentX, z: currentZ };
    };

    // Check if position is inside a building interior
    const checkInsideBuilding = (x, z) => {
      for (const interior of mapData.interiors) {
        if (x >= interior.bounds.minX && x <= interior.bounds.maxX &&
            z >= interior.bounds.minZ && z <= interior.bounds.maxZ) {
          return interior;
        }
      }
      return null;
    };

    // Check if near a barrel fire (for warmth)
    const checkNearBarrelFire = (x, z) => {
      for (const fire of mapData.barrelFires) {
        const dist = Math.sqrt(Math.pow(x - fire.position.x, 2) + Math.pow(z - fire.position.z, 2));
        if (dist <= fire.warmthRadius) {
          return { fire, warmthFactor: 1 - (dist / fire.warmthRadius) };
        }
      }
      return null;
    };

    // Check if near objective item
    const checkNearObjective = (x, z) => {
      if (!game.objectives.items) return null;
      for (const item of game.objectives.items) {
        if (item.collected) continue;
        const dist = Math.sqrt(Math.pow(x - item.position.x, 2) + Math.pow(z - item.position.z, 2));
        if (dist < 2) return item;
      }
      return null;
    };

    // Check if in escape zone
    const checkInEscapeZone = (x, z) => {
      if (!game.objectives.escapeActive || !game.objectives.escapeZone) return false;
      const zone = game.objectives.escapeZone;
      const dist = Math.sqrt(Math.pow(x - zone.position.x, 2) + Math.pow(z - zone.position.z, 2));
      return dist <= zone.radius;
    };

    // Check glass zones
    const checkGlassZone = (x, z) => {
      for (const prop of mapData.props) {
        if (prop.type === 'glass_zone' && !prop.broken) {
          const dist = Math.sqrt(Math.pow(x - prop.position.x, 2) + Math.pow(z - prop.position.z, 2));
          if (dist < prop.radius) return prop;
        }
      }
      return null;
    };

    // Find nearby loot container
    const checkNearLootContainer = (x, z) => {
      for (const container of mapData.lootContainers) {
        const state = game.lootContainerStates.get(container.id);
        if (state && state.looted) continue;
        const dist = Math.sqrt(Math.pow(x - container.position.x, 2) + Math.pow(z - container.position.z, 2));
        if (dist < 2.5) return container;
      }
      return null;
    };

    const handleKeyDown = (e) => {
      if (chatFocused) {
        if (e.code === 'Escape') {
          chatFocused = false;
          setIsChatFocused(false);
          if (mountRef.current?.querySelector('canvas')) {
            mountRef.current.querySelector('canvas').requestPointerLock();
          }
        }
        return;
      }
      
      if (e.code === 'KeyT' && !escapeMenuOpen && !perkSelectionOpen) {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        chatFocused = true;
        setIsChatFocused(true);
        setTimeout(() => chatInputRef.current?.focus(), 50);
        return;
      }
      
      if (perkSelectionOpen && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        const index = parseInt(e.code.replace('Digit', '')) - 1;
        const currentChoices = gameRef.current?.perkChoices || [];
        if (currentChoices[index]) {
          handleSelectPerk(currentChoices[index]);
          perkSelectionOpen = false;
        }
        return;
      }
      
      if (e.code === 'Escape') {
        if (perkSelectionOpen) return;
        escapeMenuOpen = !escapeMenuOpen;
        setShowEscapeMenu(escapeMenuOpen);
        if (escapeMenuOpen && document.pointerLockElement) document.exitPointerLock();
        return;
      }
      
      if (escapeMenuOpen || perkSelectionOpen) return;
      
      keys[e.code] = true;
      if (e.code === 'Digit1') { game.activeSlot = 0; createGunModel(game.weapons[0]); }
      if (e.code === 'Digit2' && game.weapons[1]) { game.activeSlot = 1; createGunModel(game.weapons[1]); }
      
      // E key for interactions
      if (e.code === 'KeyE') {
        // Check loot containers
        const nearContainer = checkNearLootContainer(game.position.x, game.position.z);
        if (nearContainer) {
          socket.emit('lootContainer', { gameId: gameData.gameId, containerId: nearContainer.id });
          audioManager.playPickup('weapon');
          return;
        }
        
        // Check objectives
        const nearObjective = checkNearObjective(game.position.x, game.position.z);
        if (nearObjective) {
          socket.emit('collectObjective', { gameId: gameData.gameId, objectiveId: nearObjective.id });
          audioManager.playPickup('generic');
          return;
        }
        
        // Check escape zone
        if (checkInEscapeZone(game.position.x, game.position.z)) {
          socket.emit('attemptEscape', { gameId: gameData.gameId });
          return;
        }
      }
    };
    
    const handleKeyUp = (e) => { 
      if (!chatFocused && !escapeMenuOpen && !perkSelectionOpen) keys[e.code] = false; 
    };

    const handleMouseDown = (e) => {
      if (chatFocused || escapeMenuOpen || perkSelectionOpen) return;
      
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }
      
      if (game.isDowned) return;
      
      if (e.button === 0) {
        const weapon = game.weapons[game.activeSlot];
        const stats = WEAPON_STATS[weapon];
        if (stats.type === 'melee') {
          if (meleeCooldown <= 0) {
            audioManager.playMelee(weapon);
            gunGroup.rotation.x = -0.5;
            meleeCooldown = stats.cooldown;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            socket.emit('meleeAttack', {
              gameId: gameData.gameId,
              position: { x: game.position.x, y: game.position.y, z: game.position.z },
              direction: { x: forward.x, y: forward.y, z: forward.z },
              weapon, damage: stats.damage * game.damageMult * game.meleeMult, range: stats.range
            });
          }
        } else if (game.ammo > 0 && shootCooldown <= 0) {
          const pellets = stats.pellets || 1;
          game.ammo -= stats.ammo || 1;
          audioManager.playGunshot(weapon);
          muzzleFlash.intensity = 2;
          setTimeout(() => muzzleFlash.intensity = 0, 50);
          gunGroup.rotation.x = -0.15;
          shootCooldown = stats.cooldown;
          for (let i = 0; i < pellets; i++) {
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (stats.pellets) { dir.x += (Math.random() - 0.5) * 0.15; dir.y += (Math.random() - 0.5) * 0.15; dir.normalize(); }
            socket.emit('playerShoot', {
              gameId: gameData.gameId,
              position: { x: game.position.x, y: game.position.y, z: game.position.z },
              direction: { x: dir.x, y: dir.y, z: dir.z },
              weapon, damage: stats.damage * game.damageMult
            });
          }
        }
      }
      
      if (e.button === 1) {
        e.preventDefault();
        audioManager.playPing();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const pingPos = game.position.clone().add(forward.multiplyScalar(25));
        socket.emit('ping', { gameId: gameData.gameId, playerId, position: { x: pingPos.x, y: 0, z: pingPos.z } });
      }
    };

    const handleMouseMove = (e) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      if (chatFocused || escapeMenuOpen || perkSelectionOpen) return;
      game.yaw -= e.movementX * 0.002;
      game.pitch -= e.movementY * 0.002;
      game.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, game.pitch));
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      setIsLocked(locked);
      if (locked) {
        audioManager.init().then(() => audioManager.startMusic());
        escapeMenuOpen = false;
        setShowEscapeMenu(false);
        chatFocused = false;
        setIsChatFocused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Socket handlers
    const handleGameState = (state) => {
      const myPlayer = state.players.find(p => p.id === playerId);
      if (myPlayer) {
        game.health = myPlayer.health;
        game.maxHealth = myPlayer.maxHealth || 100;
        game.hunger = myPlayer.hunger;
        game.warmth = myPlayer.warmth;
        game.energy = myPlayer.energy;
        game.ammo = myPlayer.ammo;
        game.score = myPlayer.score;
        game.kills = myPlayer.kills;
        game.isDowned = myPlayer.isDowned;
        if (myPlayer.weapons) game.weapons = myPlayer.weapons;
      }
      
      game.level = state.level;
      game.levelName = mapData.area?.name || 'Skid Row';
      game.allPlayers = state.players;
      
      // Update objectives
      if (state.objectives) {
        game.objectives = state.objectives;
        setObjectives(state.objectives);
        
        // Update map renderer if escape zone activated
        if (state.objectives.escapeActive && mapRendererRef.current) {
          mapRendererRef.current.activateEscapeZone();
        }
      }
      
      // Update loot container states
      if (state.lootContainerStates) {
        state.lootContainerStates.forEach(container => {
          game.lootContainerStates.set(container.id, container);
          if (container.looted && mapRendererRef.current) {
            mapRendererRef.current.updateLootContainer(container.id, true);
          }
        });
      }
      
      game.minimapData = {
        enemies: state.enemies.map(e => ({ x: e.position.x, z: e.position.z, type: e.type })),
        pickups: state.pickups.map(p => ({ x: p.position.x, z: p.position.z })),
        players: state.players.filter(p => p.id !== playerId).map(p => ({ x: p.position.x, z: p.position.z, color: p.color, isDowned: p.isDowned, alive: p.alive })),
        pings: state.pings || []
      };

      game.enemies.clear();
      state.enemies.forEach(e => game.enemies.set(e.id, e));

      if (state.chatMessages) {
        setChatMessages(state.chatMessages);
      }

      // Update player meshes
      const seenPlayers = new Set();
      state.players.forEach(p => {
        if (p.id === playerId) return;
        seenPlayers.add(p.id);
        let mesh = playerMeshes.get(p.id);
        if (!mesh) {
          mesh = new THREE.Group();
          const body = new THREE.Mesh(playerBodyGeo, new THREE.MeshLambertMaterial({ color: p.color || 0x4a9eff }));
          body.position.y = 0.6;
          mesh.add(body);
          const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xdec4a8 }));
          head.position.y = 1.35;
          mesh.add(head);
          playerMeshes.set(p.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(p.position.x, p.isDowned ? 0.3 : 0, p.position.z);
        mesh.rotation.z = p.isDowned ? Math.PI / 2 : 0;
        mesh.visible = p.alive;
      });
      for (const [id, mesh] of playerMeshes) {
        if (!seenPlayers.has(id)) { scene.remove(mesh); playerMeshes.delete(id); }
      }

      // Update enemy meshes
      const seenEnemies = new Set();
      state.enemies.forEach(e => {
        seenEnemies.add(e.id);
        let mesh = enemyMeshes.get(e.id);
        if (!mesh) {
          const colors = { normal: 0x5a4a3a, runner: 0x4a4a5a, brute: 0x3a3a3a, thrower: 0x5a5a4a, boss: 0x2a1a1a };
          const heights = { normal: 1.2, runner: 1.0, brute: 1.5, thrower: 1.1, boss: 2.2 };
          const widths = { normal: 0.3, runner: 0.25, brute: 0.5, thrower: 0.3, boss: 0.7 };
          const h = heights[e.type] || 1.2, w = widths[e.type] || 0.3;
          mesh = new THREE.Group();
          mesh.userData = { enemyId: e.id, height: h };
          const body = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.8, w, h, 8), new THREE.MeshLambertMaterial({ color: colors[e.type] || 0x5a4a3a }));
          body.position.y = h / 2;
          mesh.add(body);
          const head = new THREE.Mesh(new THREE.SphereGeometry(e.type === 'boss' ? 0.35 : 0.2, 8, 8), new THREE.MeshLambertMaterial({ color: 0x8a7a6a }));
          head.position.y = h + 0.15;
          mesh.add(head);
          if (e.type === 'boss') {
            const crown = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 5), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
            crown.position.y = h + 0.5;
            mesh.add(crown);
          }
          enemyMeshes.set(e.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(e.position.x, 0, e.position.z);
        mesh.rotation.y = e.rotation || 0;
      });
      for (const [id, mesh] of enemyMeshes) {
        if (!seenEnemies.has(id)) { scene.remove(mesh); enemyMeshes.delete(id); }
      }

      // Update pickup meshes
      const seenPickups = new Set();
      state.pickups.forEach(p => {
        seenPickups.add(p.id);
        let mesh = pickupMeshes.get(p.id);
        if (!mesh) {
          const cfg = PICKUP_CONFIG[p.type] || { color: 0xffffff };
          mesh = new THREE.Mesh(pickupGeo, new THREE.MeshLambertMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.2 }));
          pickupMeshes.set(p.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(p.position.x, 0.5 + Math.sin(Date.now() * 0.003 + p.position.x) * 0.1, p.position.z);
        mesh.rotation.y += 0.02;
      });
      for (const [id, mesh] of pickupMeshes) {
        if (!seenPickups.has(id)) { scene.remove(mesh); pickupMeshes.delete(id); }
      }

      // Update bullet meshes
      const seenBullets = new Set();
      (state.bullets || []).forEach(b => {
        seenBullets.add(b.id);
        let mesh = bulletMeshes.get(b.id);
        if (!mesh) { mesh = new THREE.Mesh(bulletGeo, bulletMat); bulletMeshes.set(b.id, mesh); scene.add(mesh); }
        mesh.position.set(b.position.x, b.position.y, b.position.z);
      });
      for (const [id, mesh] of bulletMeshes) {
        if (!seenBullets.has(id)) { scene.remove(mesh); bulletMeshes.delete(id); }
      }
    };

    const handleChatMessage = (msg) => {
      setChatMessages(prev => [...prev.slice(-49), msg]);
    };

    const handleLevelUp = (data) => {
      game.level = data.level;
      game.levelName = data.levelName;
      game.showLevelUp = true;
      audioManager.playLevelUp();
      setTimeout(() => {
        game.showLevelUp = false;
        const randomPerks = [...PERKS].sort(() => Math.random() - 0.5).slice(0, 3);
        game.perkChoices = randomPerks;
        setPerkChoices(randomPerks);
        setShowPerkSelection(true);
        perkSelectionOpen = true;
      }, 2500);
    };

    const handleKillFeed = (data) => {
      game.killFeed.push({ id: Date.now(), killer: data.killerName, victim: data.victimName, weapon: data.weapon, isHeadshot: data.isHeadshot, expires: Date.now() + 5000 });
    };

    const handlePickupCollected = (data) => {
      if (data.playerId === playerId) {
        audioManager.playPickup('generic');
        const cfg = PICKUP_CONFIG[data.type];
        game.notifications.push({ id: Date.now(), text: `+${cfg?.name || data.type}`, icon: cfg?.icon || '📦', type: 'pickup', expires: Date.now() + 3000 });
      }
    };

    const handleContainerLooted = (data) => {
      game.lootContainerStates.set(data.containerId, { looted: true });
      if (mapRendererRef.current) {
        mapRendererRef.current.updateLootContainer(data.containerId, true);
      }
      if (data.playerId === playerId && data.loot) {
        const cfg = PICKUP_CONFIG[data.loot];
        game.notifications.push({ id: Date.now(), text: `Found ${cfg?.name || data.loot}!`, icon: cfg?.icon || '📦', type: 'loot', expires: Date.now() + 3000 });
      }
    };

    const handleObjectiveCollected = (data) => {
      game.objectives = data.objectives;
      setObjectives(data.objectives);
      
      if (mapRendererRef.current) {
        mapRendererRef.current.updateObjectiveCollected(data.objectiveId);
        if (data.objectives.escapeActive) {
          mapRendererRef.current.activateEscapeZone();
        }
      }
      
      if (data.playerId === playerId) {
        game.notifications.push({ id: Date.now(), text: 'Objective collected!', icon: '📦', type: 'success', expires: Date.now() + 3000 });
      }
    };

    const handleGlassBroken = (data) => {
      if (mapRendererRef.current && data.glassId) {
        mapRendererRef.current.breakGlassZone(data.glassId);
      }
      // Update local prop state
      const prop = mapData.props.find(p => p.id === data.glassId);
      if (prop) prop.broken = true;
    };

    const handleEnemyHit = (data) => {
      audioManager.playImpact(data.isHeadshot);
      if (data.isHeadshot) {
        game.notifications.push({ id: Date.now(), text: 'HEADSHOT!', icon: '🎯', type: 'headshot', expires: Date.now() + 2000 });
      }
    };

    const handlePlayerDamaged = (data) => {
      if (data.playerId === playerId) {
        audioManager.playDamage();
        const dx = data.sourcePosition.x - game.position.x;
        const dz = data.sourcePosition.z - game.position.z;
        game.damageIndicators.push({ id: Date.now(), angle: Math.atan2(dx, dz) - game.yaw, expires: Date.now() + 300 });
      }
    };

    const handlePlayerDowned = (data) => {
      if (data.playerId === playerId) {
        audioManager.playDowned();
        game.notifications.push({ id: Date.now(), text: 'YOU ARE DOWN!', icon: '💀', type: 'danger', expires: Date.now() + 3000 });
      } else {
        game.notifications.push({ id: Date.now(), text: `${data.playerName} is down!`, icon: '⚠️', type: 'warning', expires: Date.now() + 3000 });
      }
    };

    const handlePlayerRevived = (data) => {
      if (data.playerId === playerId) {
        audioManager.playRevive();
        game.notifications.push({ id: Date.now(), text: 'You have been revived!', icon: '❤️', type: 'success', expires: Date.now() + 3000 });
      } else {
        game.notifications.push({ id: Date.now(), text: `${data.playerName} was revived!`, icon: '⚕️', type: 'success', expires: Date.now() + 3000 });
      }
    };

    const handlePing = (data) => {
      if (data.playerId !== playerId) audioManager.playPing();
      const pingGroup = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 16), new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      pingGroup.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 6), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 }));
      beam.position.y = 2;
      pingGroup.add(beam);
      pingGroup.position.set(data.position.x, 0, data.position.z);
      pingGroup.userData = { createdAt: Date.now() };
      scene.add(pingGroup);
      const pingId = Date.now() + Math.random();
      pingMeshes.set(pingId, pingGroup);
      setTimeout(() => { scene.remove(pingGroup); pingMeshes.delete(pingId); }, 5000);
    };

    const handleEnemyAggro = (data) => { audioManager.playEnemyAggro(data.type); };

    const handlePlayerEscaped = (data) => {
      if (data.playerId === playerId) {
        game.notifications.push({ id: Date.now(), text: 'YOU ESCAPED!', icon: '🎉', type: 'success', expires: Date.now() + 5000 });
      } else {
        game.notifications.push({ id: Date.now(), text: `${data.playerName} escaped!`, icon: '🚗', type: 'success', expires: Date.now() + 3000 });
      }
    };

    socket.on('gameState', handleGameState);
    socket.on('chatMessage', handleChatMessage);
    socket.on('levelUp', handleLevelUp);
    socket.on('killFeed', handleKillFeed);
    socket.on('pickupCollected', handlePickupCollected);
    socket.on('containerLooted', handleContainerLooted);
    socket.on('objectiveCollected', handleObjectiveCollected);
    socket.on('glassBroken', handleGlassBroken);
    socket.on('enemyHit', handleEnemyHit);
    socket.on('playerDamaged', handlePlayerDamaged);
    socket.on('playerDowned', handlePlayerDowned);
    socket.on('playerRevived', handlePlayerRevived);
    socket.on('ping', handlePing);
    socket.on('enemyAggro', handleEnemyAggro);
    socket.on('playerEscaped', handlePlayerEscaped);

    // HUD Update interval
    hudUpdateRef.current = setInterval(() => {
      const now = Date.now();
      game.notifications = game.notifications.filter(n => n.expires > now);
      game.killFeed = game.killFeed.filter(k => k.expires > now);
      game.damageIndicators = game.damageIndicators.filter(d => d.expires > now);
      
      setHudState({
        health: game.health, maxHealth: game.maxHealth,
        hunger: game.hunger, warmth: game.warmth, energy: game.energy,
        ammo: game.ammo, score: game.score, kills: game.kills,
        level: game.level, levelName: game.levelName,
        weapons: [...game.weapons], activeSlot: game.activeSlot,
        isDowned: game.isDowned, reviveProgress: game.reviveProgress,
        allPlayers: game.allPlayers,
        selectedPerks: [...game.selectedPerks],
        notifications: [...game.notifications],
        killFeed: [...game.killFeed],
        damageIndicators: [...game.damageIndicators],
        minimapData: { ...game.minimapData },
        showLevelUp: game.showLevelUp,
        playerPosition: game.position.clone(),
        playerYaw: game.yaw,
        radarRange: game.radarRange,
        isInsideBuilding: game.isInsideBuilding,
        objectives: game.objectives
      });
    }, 100);

    // Game loop
    let frameCount = 0;
    let animationId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      frameCount++;
      const elapsedTime = clock.getElapsedTime();

      if (!escapeMenuOpen && !perkSelectionOpen && !chatFocused) {
        const moveSpeed = game.isDowned ? 0.03 : 0.12 * game.speedMult;
        const moveVector = new THREE.Vector3();
        if (keys['KeyW'] || keys['ArrowUp']) moveVector.z -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveVector.z += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveVector.x -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveVector.x += 1;

        let finalSpeed = moveSpeed;
        const isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && !game.isDowned;
        if (isSprinting && moveVector.length() > 0 && game.energy > 0) {
          finalSpeed *= 1.5;
          game.energy = Math.max(0, game.energy - 0.1);
        }

        if (moveVector.length() > 0) {
          moveVector.normalize().multiplyScalar(finalSpeed);
          const cosYaw = Math.cos(game.yaw);
          const sinYaw = Math.sin(game.yaw);
          const desiredX = game.position.x + moveVector.x * cosYaw + moveVector.z * sinYaw;
          const desiredZ = game.position.z + -moveVector.x * sinYaw + moveVector.z * cosYaw;
          
          // Apply collision with wall sliding
          const newPos = moveWithCollision(game.position.x, game.position.z, desiredX, desiredZ);
          game.position.x = newPos.x;
          game.position.z = newPos.z;

          // Footstep sounds and glass breaking
          footstepTimer++;
          if (footstepTimer >= (isSprinting ? 15 : 25)) {
            footstepTimer = 0;
            const glassZone = checkGlassZone(game.position.x, game.position.z);
            if (glassZone) {
              if (!glassZone.broken) {
                glassZone.broken = true;
                audioManager.playGlassBreak();
                socket.emit('glassBreak', { gameId: gameData.gameId, glassId: glassZone.id, position: { x: glassZone.position.x, z: glassZone.position.z } });
              }
              audioManager.playFootstep(true);
            } else {
              audioManager.playFootstep(false);
            }
          }
        }

        // Weapon sway
        if (moveVector.length() > 0 && !game.isDowned) {
          gunGroup.position.y = -0.2 + Math.sin(frameCount * 0.15) * 0.015;
          gunGroup.position.x = 0.25 + Math.cos(frameCount * 0.075) * 0.008;
        }
        gunGroup.rotation.x *= 0.9;

        // Check if inside building (for warmth bonus indicator)
        const interior = checkInsideBuilding(game.position.x, game.position.z);
        game.isInsideBuilding = !!interior;

        // Check barrel fires for warmth
        const nearFire = checkNearBarrelFire(game.position.x, game.position.z);
        if (nearFire && frameCount % 60 === 0) {
          game.warmth = Math.min(100, game.warmth + 2 * nearFire.warmthFactor);
        }
        
        // Fire damage if too close
        if (nearFire && nearFire.warmthFactor > 0.8 && frameCount % 30 === 0) {
          socket.emit('playerHit', { gameId: gameData.gameId, damage: 5, source: 'fire' });
        }

        // Pickup collection
        for (const [pickupId] of pickupMeshes) {
          const mesh = pickupMeshes.get(pickupId);
          if (mesh && mesh.position.distanceTo(game.position) < 1.5) {
            socket.emit('pickupCollected', { gameId: gameData.gameId, pickupId, playerId });
          }
        }

        // Revive other players
        if (keys['KeyE'] && !game.isDowned) {
          let revivingPlayer = null;
          for (const p of game.allPlayers) {
            if (p.id !== playerId && p.isDowned && p.alive) {
              const mesh = playerMeshes.get(p.id);
              if (mesh && mesh.position.distanceTo(game.position) < 2) {
                revivingPlayer = p.id;
                break;
              }
            }
          }
          if (revivingPlayer) {
            const reviveSpeed = game.selectedPerks.some(p => p.id === 'revive_boost') ? 0.5 : 1;
            game.reviveProgress += 1 / (300 * reviveSpeed);
            if (game.reviveProgress >= 1) {
              socket.emit('revivePlayer', { gameId: gameData.gameId, targetId: revivingPlayer });
              game.reviveProgress = 0;
            }
          } else {
            game.reviveProgress = 0;
          }
        } else {
          game.reviveProgress = 0;
        }

        // Send position to server
        if (frameCount % 3 === 0) {
          socket.emit('playerInput', {
            gameId: gameData.gameId,
            input: {
              position: { x: game.position.x, y: game.position.y, z: game.position.z },
              rotation: { yaw: game.yaw, pitch: game.pitch }
            }
          });
        }

        if (shootCooldown > 0) shootCooldown--;
        if (meleeCooldown > 0) meleeCooldown--;

        // Enemy targeting raycasting
        if (frameCount % 5 === 0) {
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          const enemyMeshArray = Array.from(enemyMeshes.values());
          const intersects = raycaster.intersectObjects(enemyMeshArray, true);
          
          let foundEnemy = null;
          if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj.parent && !obj.userData.enemyId) obj = obj.parent;
            if (obj.userData.enemyId) {
              const enemyData = game.enemies.get(obj.userData.enemyId);
              if (enemyData) {
                foundEnemy = {
                  ...enemyData,
                  screenPosition: getScreenPosition(obj.position, camera, renderer)
                };
              }
            }
          }
          game.targetedEnemyId = foundEnemy?.id || null;
          setTargetedEnemy(foundEnemy);
        }
      }

      // Update camera position
      camera.position.copy(game.position);
      if (game.isDowned) camera.position.y = 0.5;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = game.yaw;
      camera.rotation.x = game.pitch;

      // Update map animations (barrel fire flicker, objective float)
      if (mapRendererRef.current) {
        mapRendererRef.current.updateAnimations(elapsedTime);
      }

      // Update ping visuals
      for (const [, mesh] of pingMeshes) {
        const age = (Date.now() - mesh.userData.createdAt) / 1000;
        if (mesh.children[0]) { mesh.children[0].scale.set(1 + age * 0.5, 1 + age * 0.5, 1); mesh.children[0].material.opacity = 1 - age / 5; }
        if (mesh.children[1]) { mesh.children[1].material.opacity = 0.5 - age / 10; }
      }

      renderer.render(scene, camera);
    };

    // Helper to get screen position
    const getScreenPosition = (worldPos, cam, rend) => {
      const pos = worldPos.clone();
      pos.y += 2;
      pos.project(cam);
      return {
        x: (pos.x * 0.5 + 0.5) * rend.domElement.clientWidth,
        y: (-pos.y * 0.5 + 0.5) * rend.domElement.clientHeight
      };
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (hudUpdateRef.current) clearInterval(hudUpdateRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('resize', handleResize);
      socket.off('gameState', handleGameState);
      socket.off('chatMessage', handleChatMessage);
      socket.off('levelUp', handleLevelUp);
      socket.off('killFeed', handleKillFeed);
      socket.off('pickupCollected', handlePickupCollected);
      socket.off('containerLooted', handleContainerLooted);
      socket.off('objectiveCollected', handleObjectiveCollected);
      socket.off('glassBroken', handleGlassBroken);
      socket.off('enemyHit', handleEnemyHit);
      socket.off('playerDamaged', handlePlayerDamaged);
      socket.off('playerDowned', handlePlayerDowned);
      socket.off('playerRevived', handlePlayerRevived);
      socket.off('ping', handlePing);
      socket.off('enemyAggro', handleEnemyAggro);
      socket.off('playerEscaped', handlePlayerEscaped);
      audioManager.stopMusic();
      if (document.pointerLockElement) document.exitPointerLock();
      if (mapRendererRef.current) mapRendererRef.current.dispose();
      if (mount && renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [gameData, playerId, socket, handleSelectPerk, settings.brightness]);

  // Calculate collected objectives count
  const collectedCount = objectives.items?.filter(i => i.collected).length || 0;
  const totalCount = objectives.items?.length || 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {isLocked && hudState && (
        <HUD
          player={hudState}
          allPlayers={hudState.allPlayers}
          level={hudState.level}
          levelName={hudState.levelName}
          playerId={playerId}
          showLevelUp={hudState.showLevelUp}
          notifications={hudState.notifications}
          killFeed={hudState.killFeed}
          damageIndicators={hudState.damageIndicators}
          showPerkSelection={showPerkSelection}
          perkChoices={perkChoices}
          onSelectPerk={handleSelectPerk}
          selectedPerks={hudState.selectedPerks}
          weapons={hudState.weapons}
          activeSlot={hudState.activeSlot}
          isDowned={hudState.isDowned}
          reviveProgress={hudState.reviveProgress}
          minimapData={hudState.minimapData}
          playerPosition={hudState.playerPosition}
          playerYaw={hudState.playerYaw}
          radarRange={hudState.radarRange}
        />
      )}

      {/* Objective Tracker */}
      {isLocked && !showEscapeMenu && !showPerkSelection && (
        <div style={{
          position: 'absolute',
          top: 100,
          left: 15,
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 8,
          padding: '10px 15px',
          border: '1px solid rgba(255,215,0,0.3)',
          zIndex: 60
        }}>
          <div style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: 8 }}>
            📋 OBJECTIVES
          </div>
          <div style={{ fontSize: '0.8rem', color: '#ddd', marginBottom: 4 }}>
            <span style={{ color: collectedCount === totalCount ? '#4f4' : '#fff' }}>
              Generator Parts: {collectedCount}/{totalCount}
            </span>
          </div>
          {objectives.escapeActive ? (
            <div style={{ fontSize: '0.8rem', color: '#4f4', marginTop: 8 }}>
              ✅ Escape vehicle ready!<br/>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Go to the extraction point</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
              Collect all parts to unlock escape
            </div>
          )}
          {hudState?.isInsideBuilding && (
            <div style={{ fontSize: '0.75rem', color: '#88ccff', marginTop: 8 }}>
              🏠 Indoors (warmth +)
            </div>
          )}
        </div>
      )}

      {/* Targeted Enemy Name Tag */}
      {targetedEnemy && targetedEnemy.identity && !showEscapeMenu && !showPerkSelection && (
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '35%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 80
        }}>
          <div style={{ textAlign: 'center', color: '#fff', textShadow: '0 0 5px black, 0 0 10px black' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffd700' }}>{targetedEnemy.identity.fullName}</div>
          </div>
        </div>
      )}

      {/* Targeted Enemy Info Panel */}
      {targetedEnemy && targetedEnemy.identity && !showEscapeMenu && !showPerkSelection && (
        <div style={{
          position: 'absolute',
          left: targetedEnemy.screenPosition?.x || '50%',
          top: Math.max(50, (targetedEnemy.screenPosition?.y || 200) - 100),
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(255,215,0,0.5)',
          borderRadius: 8,
          padding: '10px 14px',
          pointerEvents: 'none',
          zIndex: 75,
          minWidth: 160
        }}>
          <div style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 4 }}>
            {targetedEnemy.identity.fullName}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: '#888' }}>Age:</span>
              <span>{targetedEnemy.identity.age}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: '#888' }}>Gender:</span>
              <span>{targetedEnemy.identity.gender}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: '#888' }}>Net Worth:</span>
              <span style={{ color: '#4f4' }}>${targetedEnemy.identity.netWorth.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ color: '#888' }}>Type:</span>
              <span style={{ color: targetedEnemy.type === 'boss' ? '#ffd700' : targetedEnemy.type === 'brute' ? '#f60' : '#aaa', textTransform: 'capitalize' }}>{targetedEnemy.type}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Crosshair */}
      {isLocked && !hudState?.isDowned && !showEscapeMenu && !showPerkSelection && !isChatFocused && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 30 }}>
          <div style={{ position: 'relative', width: 28, height: 28 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, width: 10, height: 2, background: targetedEnemy ? '#f44' : 'rgba(255,255,255,0.9)', transform: 'translateY(-50%)' }} />
            <div style={{ position: 'absolute', top: '50%', right: 0, width: 10, height: 2, background: targetedEnemy ? '#f44' : 'rgba(255,255,255,0.9)', transform: 'translateY(-50%)' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 10, background: targetedEnemy ? '#f44' : 'rgba(255,255,255,0.9)', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 2, height: 10, background: targetedEnemy ? '#f44' : 'rgba(255,255,255,0.9)', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 4, height: 4, borderRadius: '50%', background: '#f44', transform: 'translate(-50%, -50%)' }} />
          </div>
        </div>
      )}

      {/* Chat Box / Combat Log */}
      <div style={{
        position: 'absolute',
        bottom: 15,
        right: 15,
        width: 320,
        maxHeight: 250,
        background: isChatFocused ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        border: isChatFocused ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 150,
        pointerEvents: isChatFocused ? 'auto' : 'none',
        transition: 'all 0.2s'
      }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
          <span>📜 Combat Log / Chat</span>
          <span style={{ color: '#555' }}>Press T to chat</span>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px',
          maxHeight: 160,
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          {chatMessages.slice(-20).map((msg, i) => (
            <div key={msg.id || i} style={{
              fontSize: '0.75rem',
              padding: '3px 6px',
              borderRadius: 4,
              background: msg.type === 'kill' ? 'rgba(255,50,50,0.15)' : msg.type === 'system' ? 'rgba(255,215,0,0.15)' : 'transparent',
              borderLeft: msg.type === 'kill' ? '2px solid #f44' : msg.type === 'system' ? '2px solid #ffd700' : msg.type === 'chat' ? `2px solid #${(msg.playerColor || 0x4a9eff).toString(16).padStart(6, '0')}` : 'none'
            }}>
              {msg.type === 'chat' ? (
                <>
                  <span style={{ color: `#${(msg.playerColor || 0x4a9eff).toString(16).padStart(6, '0')}`, fontWeight: 'bold' }}>{msg.playerName}: </span>
                  <span style={{ color: '#ddd' }}>{msg.text}</span>
                </>
              ) : msg.type === 'kill' ? (
                <span style={{ color: '#f88' }}>💀 {msg.text}</span>
              ) : (
                <span style={{ color: '#ffd700' }}>⚡ {msg.text}</span>
              )}
            </div>
          ))}
          {chatMessages.length === 0 && (
            <div style={{ color: '#555', fontSize: '0.75rem', textAlign: 'center', padding: 10 }}>
              No messages yet...
            </div>
          )}
        </div>
        <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsChatFocused(false);
                setChatInput('');
                if (mountRef.current?.querySelector('canvas')) {
                  mountRef.current.querySelector('canvas').requestPointerLock();
                }
              }
            }}
            onFocus={() => setIsChatFocused(true)}
            placeholder={isChatFocused ? "Type message and press Enter..." : "Press T to chat"}
            style={{
              width: '100%',
              background: isChatFocused ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '0.8rem',
              padding: '6px 8px',
              borderRadius: 4,
              pointerEvents: isChatFocused ? 'auto' : 'none'
            }}
          />
        </div>
      </div>

      {/* Perk Selection */}
      {showPerkSelection && (
        <div style={styles.perkOverlay}>
          <h2 style={{ color: '#ffd700', fontSize: '1.8rem', marginBottom: 10, textShadow: '0 0 15px rgba(255,215,0,0.5)' }}>CHOOSE A PERK</h2>
          <p style={{ color: '#888', marginBottom: 25 }}>Press 1, 2, or 3 to select</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {perkChoices.map((perk, index) => (
              <div key={perk.id} onClick={() => handleSelectPerk(perk)} style={styles.perkCard}>
                <span style={styles.perkKeyHint}>{index + 1}</span>
                <span style={{ fontSize: '2.5rem' }}>{perk.icon}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffd700', marginTop: 8 }}>{perk.name}</span>
                <span style={{ fontSize: '0.85rem', color: '#aaa', marginTop: 5 }}>{perk.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escape Menu */}
      {showEscapeMenu && (
        <div style={styles.escapeOverlay}>
          <div style={styles.escapeMenu}>
            <h2 style={{ color: '#ffd700', marginBottom: 25, fontSize: '1.6rem' }}>⚙️ MENU</h2>
            <button onClick={() => { setShowEscapeMenu(false); mountRef.current?.querySelector('canvas')?.requestPointerLock(); }} style={styles.menuButton}>▶️ Resume Game</button>
            <div style={styles.settingsSection}>
              <h3 style={{ color: '#888', fontSize: '0.9rem', marginBottom: 12 }}>AUDIO</h3>
              <SettingSlider label="Master Volume" value={settings.masterVolume} onChange={v => setSettings(s => ({ ...s, masterVolume: v }))} />
              <SettingSlider label="Music Volume" value={settings.musicVolume} onChange={v => setSettings(s => ({ ...s, musicVolume: v }))} />
              <SettingSlider label="SFX Volume" value={settings.sfxVolume} onChange={v => setSettings(s => ({ ...s, sfxVolume: v }))} />
            </div>
            <div style={styles.settingsSection}>
              <h3 style={{ color: '#888', fontSize: '0.9rem', marginBottom: 12 }}>DISPLAY</h3>
              <SettingSlider label="Brightness" value={settings.brightness} onChange={v => setSettings(s => ({ ...s, brightness: v }))} min={0.3} max={1.5} />
            </div>
            <button onClick={handleQuit} style={{ ...styles.menuButton, background: 'rgba(255,50,50,0.2)', borderColor: '#f44', marginTop: 20 }}>🚪 Quit to Menu</button>
            <p style={{ color: '#555', fontSize: '0.75rem', marginTop: 20 }}>Press ESC to close</p>
          </div>
        </div>
      )}
      
      {/* Click to play */}
      {!isLocked && !showEscapeMenu && (
        <div onClick={() => { if (document.pointerLockElement !== mountRef.current?.querySelector('canvas')) { mountRef.current?.querySelector('canvas')?.requestPointerLock(); } }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 50 }}>
          <div style={{ color: 'white', fontSize: '1.5rem', marginBottom: 10 }}>Click to Play</div>
          <div style={{ color: '#888', fontSize: '1rem' }}>WASD to move • Mouse to aim • Click to attack</div>
          <div style={{ color: '#888', fontSize: '0.9rem', marginTop: 5 }}>1/2 switch weapons • E interact • T chat • ESC menu</div>
        </div>
      )}
    </div>
  );
}

function SettingSlider({ label, value, onChange, min = 0, max = 1 }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{label}</span>
        <span style={{ color: '#fff', fontSize: '0.85rem' }}>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={min * 100} max={max * 100} value={value * 100} onChange={e => onChange(e.target.value / 100)} style={{ width: '100%', cursor: 'pointer' }} />
    </div>
  );
}

const styles = {
  perkOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 200, pointerEvents: 'auto' },
  perkCard: { background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '2px solid #444', borderRadius: 12, padding: '20px 18px', width: 150, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' },
  perkKeyHint: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#ffd700', color: '#000', fontWeight: 'bold', fontSize: '0.9rem', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  escapeOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, pointerEvents: 'auto' },
  escapeMenu: { background: 'linear-gradient(135deg, #1a1a2e, #0a0a1a)', border: '2px solid #333', borderRadius: 16, padding: '30px 40px', minWidth: 350, maxWidth: 400, textAlign: 'center' },
  menuButton: { display: 'block', width: '100%', padding: '14px 20px', margin: '8px 0', background: 'rgba(255,255,255,0.05)', border: '2px solid #444', borderRadius: 8, color: 'white', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s' },
  settingsSection: { margin: '20px 0', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: 10, textAlign: 'left' }
};

export default Game;