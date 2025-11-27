// SkidRowArea.js - Procedural generation definition for Skid Row
// Shared between server (generation) and client (rendering)

const SKID_ROW = {
  id: 'skid_row',
  name: 'Skid Row',
  description: 'Desolate urban streets filled with abandoned buildings and makeshift shelters',
  
  // Map dimensions (much larger than before)
  bounds: {
    minX: -120,
    maxX: 120,
    minZ: -120,
    maxZ: 120
  },
  
  // Visual theme
  theme: {
    fog: { color: 0x1a1a1f, near: 20, far: 100 },
    sky: 0x0a0a0f,
    ambient: { color: 0x303038, intensity: 0.35 },
    directional: { color: 0xffeedd, intensity: 0.4, position: { x: 50, y: 80, z: 30 } },
    ground: 0x2a2a2a,
    road: 0x1a1a1a,
    sidewalk: 0x3a3a3a,
    building: 0x3a3a40,
    buildingVariation: 0x0a0a0a, // Random variation in building color
  },
  
  // Road network configuration
  roads: {
    // Main roads (wider, run full length)
    main: {
      width: 12,
      count: { horizontal: 3, vertical: 3 },
      spacing: { min: 60, max: 80 }
    },
    // Side streets (narrower, connect main roads)
    side: {
      width: 8,
      frequency: 0.4, // Chance of side street between buildings
    },
    // Alleys (narrow passages between buildings)
    alleys: {
      width: 3,
      frequency: 0.3
    },
    sidewalkWidth: 2.5,
    // Road details
    details: {
      cracks: true,
      potholes: true,
      manholes: true,
      crosswalks: true
    }
  },
  
  // City block configuration
  blocks: {
    minSize: 25,
    maxSize: 45,
    buildingDensity: 0.7, // Percentage of block filled with buildings
    innerCourtyard: 0.2 // Chance of inner courtyard in block
  },
  
  // Building generation
  buildings: {
    types: [
      { 
        id: 'apartment', 
        weight: 35,
        floors: { min: 3, max: 8 },
        width: { min: 8, max: 15 },
        depth: { min: 8, max: 12 },
        hasInterior: true,
        interiorChance: 0.3,
        style: 'residential'
      },
      { 
        id: 'warehouse', 
        weight: 20,
        floors: { min: 1, max: 2 },
        width: { min: 15, max: 25 },
        depth: { min: 12, max: 20 },
        hasInterior: true,
        interiorChance: 0.5,
        style: 'industrial'
      },
      { 
        id: 'storefront', 
        weight: 25,
        floors: { min: 1, max: 3 },
        width: { min: 6, max: 12 },
        depth: { min: 8, max: 12 },
        hasInterior: true,
        interiorChance: 0.4,
        style: 'commercial',
        awning: true
      },
      { 
        id: 'office', 
        weight: 10,
        floors: { min: 4, max: 12 },
        width: { min: 12, max: 20 },
        depth: { min: 12, max: 18 },
        hasInterior: true,
        interiorChance: 0.2,
        style: 'corporate'
      },
      { 
        id: 'ruined', 
        weight: 10,
        floors: { min: 2, max: 5 },
        width: { min: 8, max: 15 },
        depth: { min: 8, max: 12 },
        hasInterior: false,
        style: 'destroyed',
        rubble: true
      }
    ],
    // Building details
    windows: {
      spacing: 2.5,
      width: 1.2,
      height: 1.8,
      boardedChance: 0.4,
      brokenChance: 0.3,
      litChance: 0.1
    },
    doors: {
      width: 1.5,
      height: 2.5,
      barricadedChance: 0.5
    }
  },
  
  // Overpasses and elevated structures
  overpasses: {
    count: { min: 1, max: 3 },
    height: 8,
    width: 14,
    pillarSpacing: 15,
    style: 'highway'
  },
  
  // Environmental props
  props: {
    // Trash and litter
    trash: {
      density: 0.8, // Higher = more trash
      types: ['bag', 'can', 'bottle', 'paper', 'box', 'tire'],
      clusters: true
    },
    // Barrel fires (provide warmth)
    barrelFires: {
      count: { min: 12, max: 20 },
      nearWalls: true,
      warmthRadius: 8,
      lightRadius: 10,
      lightIntensity: 1.2,
      lightColor: 0xff6622
    },
    // Makeshift shelters/tents
    shelters: {
      count: { min: 8, max: 15 },
      types: ['tent', 'cardboard', 'tarp', 'shopping_cart'],
      clusterChance: 0.4
    },
    // Abandoned vehicles
    vehicles: {
      count: { min: 15, max: 25 },
      types: ['car', 'truck', 'van', 'bus'],
      burnedChance: 0.3,
      onRoad: true,
      parkingLots: true
    },
    // Street furniture
    streetFurniture: {
      types: ['lamppost', 'bench', 'mailbox', 'hydrant', 'dumpster', 'newspaper_box'],
      lamppostSpacing: 20,
      dumpsterPerBlock: 2
    },
    // Graffiti and signs
    graffiti: {
      frequency: 0.4,
      onWalls: true
    },
    // Broken glass zones
    glassZones: {
      count: { min: 15, max: 25 },
      radius: 2,
      nearWindows: true
    }
  },
  
  // Loot containers
  lootContainers: {
    types: [
      { id: 'dumpster', weight: 30, lootTable: 'trash', position: 'alley' },
      { id: 'car_trunk', weight: 20, lootTable: 'vehicle', position: 'road' },
      { id: 'crate', weight: 15, lootTable: 'supplies', position: 'any' },
      { id: 'locker', weight: 10, lootTable: 'weapons', position: 'interior' },
      { id: 'cabinet', weight: 10, lootTable: 'medical', position: 'interior' },
      { id: 'backpack', weight: 10, lootTable: 'survival', position: 'any' },
      { id: 'cooler', weight: 5, lootTable: 'food', position: 'any' }
    ],
    // Interior buildings have higher loot density
    interiorMultiplier: 2.5,
    // Loot tables
    tables: {
      trash: { food: 0.3, ammo: 0.1, medicine: 0.1, nothing: 0.5 },
      vehicle: { ammo: 0.3, pistol: 0.15, food: 0.2, medicine: 0.15, nothing: 0.2 },
      supplies: { ammo: 0.4, food: 0.3, blanket: 0.2, medicine: 0.1 },
      weapons: { pistol: 0.3, shotgun: 0.2, smg: 0.15, rifle: 0.1, bat: 0.15, pipe: 0.1 },
      medical: { medicine: 0.6, bandage: 0.3, nothing: 0.1 },
      survival: { food: 0.3, water: 0.3, blanket: 0.2, ammo: 0.2 },
      food: { food: 0.7, water: 0.3 }
    },
    count: { min: 40, max: 60 }
  },
  
  // Interior region configuration
  interiors: {
    // Interiors are warmer
    warmthBonus: 0.5, // Reduces warmth drain by 50%
    // Interior layouts
    layouts: {
      residential: {
        rooms: ['living', 'kitchen', 'bedroom', 'bathroom'],
        furniture: ['couch', 'table', 'bed', 'cabinet']
      },
      commercial: {
        rooms: ['main', 'storage', 'office'],
        furniture: ['counter', 'shelves', 'desk', 'chair']
      },
      industrial: {
        rooms: ['main', 'office'],
        furniture: ['crates', 'machinery', 'desk']
      }
    }
  },
  
  // Spawn configuration
  spawns: {
    players: {
      type: 'zone',
      zone: { minX: -15, maxX: 15, minZ: -15, maxZ: 15 },
      avoidBuildings: true,
      preferRoads: true
    },
    enemies: {
      minDistanceFromPlayers: 25,
      maxDistanceFromPlayers: 80,
      preferAlleys: true,
      avoidLitAreas: true,
      spawnZones: [
        { weight: 0.3, type: 'alley' },
        { weight: 0.3, type: 'building_interior' },
        { weight: 0.2, type: 'street' },
        { weight: 0.2, type: 'under_overpass' }
      ]
    }
  },
  
  // Objective configuration
  objectives: {
    primary: {
      type: 'collect_and_escape',
      items: [
        { id: 'generator_part', name: 'Generator Part', count: 3, spawnIn: 'interior' },
      ],
      escapeZone: {
        type: 'vehicle',
        position: 'map_edge',
        radius: 5
      }
    },
    optional: [
      { type: 'rescue_survivor', reward: 'ally_npc' },
      { type: 'clear_building', reward: 'weapon_cache' }
    ]
  },
  
  // Enemy behavior modifiers for this area
  enemies: {
    types: ['normal', 'runner', 'thrower'],
    bossType: 'brute',
    // Enemies are more aggressive in enclosed spaces
    interiorAggressionBonus: 1.3,
    // Pack behavior near shelters
    packBehavior: true,
    maxPackSize: 4
  },
  
  // Audio atmosphere
  audio: {
    ambience: ['wind', 'distant_traffic', 'dogs_barking', 'metal_creaking'],
    music: 'tension_urban',
    interiorAmbience: ['dripping', 'creaking_floor', 'rats']
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SKID_ROW;
} else if (typeof window !== 'undefined') {
  window.SKID_ROW = SKID_ROW;
}
