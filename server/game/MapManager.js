// MapManager.js - Server-side procedural map generation
// Generates collision data, roads, buildings, and all map elements

const { SeededRandom, PerlinNoise } = require('../../shared/utils/SeededRandom');
const SKID_ROW = require('../../shared/areas/SkidRowArea');

class MapManager {
  constructor(areaId, seed) {
    this.areaId = areaId;
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.noise = new PerlinNoise(seed);
    
    // Load area definition
    this.area = this.loadAreaDefinition(areaId);
    
    // Generated data
    this.data = {
      roads: [],
      sidewalks: [],
      blocks: [],
      buildings: [],
      interiors: [], // Enterable buildings
      props: [],
      lootContainers: [],
      barrelFires: [],
      overpasses: [],
      spawnPoints: {
        players: [],
        enemies: []
      },
      objectives: []
    };
    
    // Collision grid (for pathfinding and collision detection)
    this.collisionGrid = null;
    this.gridResolution = 0.5; // 0.5 units per cell
    this.gridWidth = 0;
    this.gridHeight = 0;
  }
  
  loadAreaDefinition(areaId) {
    // For now, only Skid Row is implemented
    const areas = {
      'skid_row': SKID_ROW
    };
    return areas[areaId] || SKID_ROW;
  }
  
  // Main generation function
  generate() {
    console.log(`[MapManager] Generating ${this.area.name} with seed ${this.seed}`);
    
    // Generate in order of dependencies
    this.generateRoadNetwork();
    this.generateCityBlocks();
    this.generateBuildings();
    this.generateOverpasses();
    this.generateBarrelFires();
    this.generateProps();
    this.generateLootContainers();
    this.generateObjectives();
    this.calculateSpawnPoints();
    
    // Build collision grid last (needs all structures)
    this.buildCollisionGrid();
    
    console.log(`[MapManager] Generation complete:`);
    console.log(`  - Roads: ${this.data.roads.length}`);
    console.log(`  - Buildings: ${this.data.buildings.length}`);
    console.log(`  - Interiors: ${this.data.interiors.length}`);
    console.log(`  - Props: ${this.data.props.length}`);
    console.log(`  - Barrel Fires: ${this.data.barrelFires.length}`);
    console.log(`  - Loot Containers: ${this.data.lootContainers.length}`);
    
    return this.data;
  }
  
  // Generate the road network
  generateRoadNetwork() {
    const bounds = this.area.bounds;
    const roadConfig = this.area.roads;
    
    // Generate main horizontal roads
    const hCount = roadConfig.main.count.horizontal;
    const hSpacing = (bounds.maxZ - bounds.minZ - 40) / (hCount + 1);
    
    for (let i = 0; i < hCount; i++) {
      const z = bounds.minZ + 20 + (i + 1) * hSpacing + this.rng.float(-10, 10);
      this.data.roads.push({
        id: `road_h_${i}`,
        type: 'main',
        direction: 'horizontal',
        start: { x: bounds.minX, z: z },
        end: { x: bounds.maxX, z: z },
        width: roadConfig.main.width,
        centerZ: z
      });
      
      // Add sidewalks along the road
      this.data.sidewalks.push({
        id: `sidewalk_h_${i}_n`,
        roadId: `road_h_${i}`,
        side: 'north',
        z: z + roadConfig.main.width / 2 + roadConfig.sidewalkWidth / 2,
        width: roadConfig.sidewalkWidth
      });
      this.data.sidewalks.push({
        id: `sidewalk_h_${i}_s`,
        roadId: `road_h_${i}`,
        side: 'south',
        z: z - roadConfig.main.width / 2 - roadConfig.sidewalkWidth / 2,
        width: roadConfig.sidewalkWidth
      });
    }
    
    // Generate main vertical roads
    const vCount = roadConfig.main.count.vertical;
    const vSpacing = (bounds.maxX - bounds.minX - 40) / (vCount + 1);
    
    for (let i = 0; i < vCount; i++) {
      const x = bounds.minX + 20 + (i + 1) * vSpacing + this.rng.float(-10, 10);
      this.data.roads.push({
        id: `road_v_${i}`,
        type: 'main',
        direction: 'vertical',
        start: { x: x, z: bounds.minZ },
        end: { x: x, z: bounds.maxZ },
        width: roadConfig.main.width,
        centerX: x
      });
      
      // Add sidewalks
      this.data.sidewalks.push({
        id: `sidewalk_v_${i}_e`,
        roadId: `road_v_${i}`,
        side: 'east',
        x: x + roadConfig.main.width / 2 + roadConfig.sidewalkWidth / 2,
        width: roadConfig.sidewalkWidth
      });
      this.data.sidewalks.push({
        id: `sidewalk_v_${i}_w`,
        roadId: `road_v_${i}`,
        side: 'west',
        x: x - roadConfig.main.width / 2 - roadConfig.sidewalkWidth / 2,
        width: roadConfig.sidewalkWidth
      });
    }
  }
  
  // Generate city blocks based on road network
  generateCityBlocks() {
    const bounds = this.area.bounds;
    const roadConfig = this.area.roads;
    
    // Get road positions for block boundaries
    const hRoads = this.data.roads.filter(r => r.direction === 'horizontal')
      .map(r => r.centerZ).sort((a, b) => a - b);
    const vRoads = this.data.roads.filter(r => r.direction === 'vertical')
      .map(r => r.centerX).sort((a, b) => a - b);
    
    // Add bounds as implicit roads
    const hBoundaries = [bounds.minZ, ...hRoads, bounds.maxZ];
    const vBoundaries = [bounds.minX, ...vRoads, bounds.maxX];
    
    // Create blocks between roads
    for (let i = 0; i < hBoundaries.length - 1; i++) {
      for (let j = 0; j < vBoundaries.length - 1; j++) {
        const minZ = hBoundaries[i] + roadConfig.main.width / 2 + roadConfig.sidewalkWidth + 2;
        const maxZ = hBoundaries[i + 1] - roadConfig.main.width / 2 - roadConfig.sidewalkWidth - 2;
        const minX = vBoundaries[j] + roadConfig.main.width / 2 + roadConfig.sidewalkWidth + 2;
        const maxX = vBoundaries[j + 1] - roadConfig.main.width / 2 - roadConfig.sidewalkWidth - 2;
        
        // Skip if block is too small
        if (maxX - minX < this.area.blocks.minSize || maxZ - minZ < this.area.blocks.minSize) {
          continue;
        }
        
        this.data.blocks.push({
          id: `block_${i}_${j}`,
          bounds: { minX, maxX, minZ, maxZ },
          width: maxX - minX,
          depth: maxZ - minZ,
          hasCourtyard: this.rng.bool(this.area.blocks.innerCourtyard)
        });
      }
    }
  }
  
  // Generate buildings within city blocks
  generateBuildings() {
    const buildingTypes = this.area.buildings.types;
    let buildingId = 0;
    
    for (const block of this.data.blocks) {
      // Determine number of buildings based on block size
      const blockArea = block.width * block.depth;
      const buildingCount = Math.floor(blockArea / 200 * this.area.blocks.buildingDensity);
      
      const placedBuildings = [];
      
      for (let i = 0; i < buildingCount; i++) {
        // Select building type
        const typeData = this.rng.pickWeighted(buildingTypes.map(t => ({ item: t, weight: t.weight })));
        
        // Generate building dimensions
        const width = this.rng.float(typeData.width.min, typeData.width.max);
        const depth = this.rng.float(typeData.depth.min, typeData.depth.max);
        const floors = this.rng.int(typeData.floors.min, typeData.floors.max);
        const height = floors * 3.5; // 3.5 units per floor
        
        // Try to place building
        let placed = false;
        for (let attempt = 0; attempt < 20 && !placed; attempt++) {
          const x = this.rng.float(block.bounds.minX + width / 2 + 1, block.bounds.maxX - width / 2 - 1);
          const z = this.rng.float(block.bounds.minZ + depth / 2 + 1, block.bounds.maxZ - depth / 2 - 1);
          
          // Check for overlap with existing buildings
          const overlaps = placedBuildings.some(b => 
            this.rectanglesOverlap(
              x - width / 2 - 2, z - depth / 2 - 2, x + width / 2 + 2, z + depth / 2 + 2,
              b.x - b.width / 2, b.z - b.depth / 2, b.x + b.width / 2, b.z + b.depth / 2
            )
          );
          
          // Check if not in center spawn area
          const inSpawnArea = Math.abs(x) < 20 && Math.abs(z) < 20;
          
          if (!overlaps && !inSpawnArea) {
            const rotation = this.rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
            
            const building = {
              id: `building_${buildingId++}`,
              type: typeData.id,
              style: typeData.style,
              position: { x, y: 0, z },
              dimensions: { width, height, depth },
              floors,
              rotation,
              color: this.area.theme.building + this.rng.int(-this.area.theme.buildingVariation, this.area.theme.buildingVariation),
              windows: this.generateWindowLayout(width, height, depth, typeData),
              hasAwning: typeData.awning && this.rng.bool(0.7),
              hasRubble: typeData.rubble,
              blockId: block.id
            };
            
            // Determine if building has accessible interior
            if (typeData.hasInterior && this.rng.bool(typeData.interiorChance)) {
              building.hasInterior = true;
              building.interiorId = `interior_${building.id}`;
              
              // Generate interior data
              this.data.interiors.push(this.generateInterior(building, typeData));
            }
            
            this.data.buildings.push(building);
            placedBuildings.push({ x, z, width, depth });
            placed = true;
          }
        }
      }
      
      // Generate alley between buildings in block
      if (placedBuildings.length >= 2 && this.rng.bool(this.area.roads.alleys.frequency)) {
        // Alleys are handled implicitly by building spacing
      }
    }
  }
  
  // Generate window layout for a building
  generateWindowLayout(width, height, depth, typeData) {
    const windowConfig = this.area.buildings.windows;
    const windows = [];
    
    const floorsCount = Math.floor(height / 3.5);
    const windowsPerFloorFront = Math.floor(width / windowConfig.spacing);
    const windowsPerFloorSide = Math.floor(depth / windowConfig.spacing);
    
    // Front and back windows
    for (let floor = 0; floor < floorsCount; floor++) {
      for (let w = 0; w < windowsPerFloorFront; w++) {
        const windowX = -width / 2 + windowConfig.spacing / 2 + w * windowConfig.spacing;
        const windowY = floor * 3.5 + 2;
        
        // Front
        windows.push({
          position: { x: windowX, y: windowY, z: -depth / 2 - 0.01 },
          side: 'front',
          boarded: this.rng.bool(windowConfig.boardedChance),
          broken: this.rng.bool(windowConfig.brokenChance),
          lit: this.rng.bool(windowConfig.litChance)
        });
        
        // Back
        windows.push({
          position: { x: windowX, y: windowY, z: depth / 2 + 0.01 },
          side: 'back',
          boarded: this.rng.bool(windowConfig.boardedChance),
          broken: this.rng.bool(windowConfig.brokenChance),
          lit: this.rng.bool(windowConfig.litChance)
        });
      }
    }
    
    // Side windows
    for (let floor = 0; floor < floorsCount; floor++) {
      for (let w = 0; w < windowsPerFloorSide; w++) {
        const windowZ = -depth / 2 + windowConfig.spacing / 2 + w * windowConfig.spacing;
        const windowY = floor * 3.5 + 2;
        
        // Left
        windows.push({
          position: { x: -width / 2 - 0.01, y: windowY, z: windowZ },
          side: 'left',
          boarded: this.rng.bool(windowConfig.boardedChance),
          broken: this.rng.bool(windowConfig.brokenChance),
          lit: this.rng.bool(windowConfig.litChance)
        });
        
        // Right
        windows.push({
          position: { x: width / 2 + 0.01, y: windowY, z: windowZ },
          side: 'right',
          boarded: this.rng.bool(windowConfig.boardedChance),
          broken: this.rng.bool(windowConfig.brokenChance),
          lit: this.rng.bool(windowConfig.litChance)
        });
      }
    }
    
    return windows;
  }
  
  // Generate interior for a building
  generateInterior(building, typeData) {
    const interiorLayout = this.area.interiors.layouts[typeData.style] || this.area.interiors.layouts.residential;
    
    // Simple interior: open room with door
    const doorSide = this.rng.pick(['front', 'back', 'left', 'right']);
    let doorPosition;
    
    switch (doorSide) {
      case 'front':
        doorPosition = { x: building.position.x, z: building.position.z - building.dimensions.depth / 2 };
        break;
      case 'back':
        doorPosition = { x: building.position.x, z: building.position.z + building.dimensions.depth / 2 };
        break;
      case 'left':
        doorPosition = { x: building.position.x - building.dimensions.width / 2, z: building.position.z };
        break;
      case 'right':
        doorPosition = { x: building.position.x + building.dimensions.width / 2, z: building.position.z };
        break;
    }
    
    return {
      id: building.interiorId,
      buildingId: building.id,
      bounds: {
        minX: building.position.x - building.dimensions.width / 2 + 0.5,
        maxX: building.position.x + building.dimensions.width / 2 - 0.5,
        minZ: building.position.z - building.dimensions.depth / 2 + 0.5,
        maxZ: building.position.z + building.dimensions.depth / 2 - 0.5
      },
      door: {
        position: doorPosition,
        side: doorSide,
        width: this.area.buildings.doors.width,
        barricaded: this.rng.bool(this.area.buildings.doors.barricadedChance)
      },
      warmthBonus: this.area.interiors.warmthBonus,
      furniture: this.generateFurniture(building, interiorLayout),
      lootMultiplier: this.area.lootContainers.interiorMultiplier
    };
  }
  
  // Generate furniture for interior
  generateFurniture(building, layout) {
    const furniture = [];
    const count = this.rng.int(2, 5);
    
    for (let i = 0; i < count; i++) {
      const type = this.rng.pick(layout.furniture);
      furniture.push({
        type,
        position: {
          x: this.rng.float(building.position.x - building.dimensions.width / 2 + 1, building.position.x + building.dimensions.width / 2 - 1),
          z: this.rng.float(building.position.z - building.dimensions.depth / 2 + 1, building.position.z + building.dimensions.depth / 2 - 1)
        },
        rotation: this.rng.float(0, Math.PI * 2)
      });
    }
    
    return furniture;
  }
  
  // Generate overpasses
  generateOverpasses() {
    const config = this.area.overpasses;
    const count = this.rng.int(config.count.min, config.count.max);
    
    for (let i = 0; i < count; i++) {
      // Place overpass along a main road, but elevated
      const direction = this.rng.pick(['horizontal', 'vertical']);
      const bounds = this.area.bounds;
      
      let start, end;
      if (direction === 'horizontal') {
        const z = this.rng.float(bounds.minZ + 40, bounds.maxZ - 40);
        start = { x: bounds.minX + 20, y: config.height, z };
        end = { x: bounds.maxX - 20, y: config.height, z };
      } else {
        const x = this.rng.float(bounds.minX + 40, bounds.maxX - 40);
        start = { x, y: config.height, z: bounds.minZ + 20 };
        end = { x, y: config.height, z: bounds.maxZ - 20 };
      }
      
      // Generate pillars
      const pillars = [];
      const length = direction === 'horizontal' ? end.x - start.x : end.z - start.z;
      const pillarCount = Math.floor(length / config.pillarSpacing);
      
      for (let p = 0; p <= pillarCount; p++) {
        const t = p / pillarCount;
        pillars.push({
          position: {
            x: start.x + (end.x - start.x) * t,
            y: 0,
            z: start.z + (end.z - start.z) * t
          },
          height: config.height
        });
      }
      
      this.data.overpasses.push({
        id: `overpass_${i}`,
        direction,
        start,
        end,
        width: config.width,
        height: config.height,
        pillars
      });
    }
  }
  
  // Generate barrel fires
  generateBarrelFires() {
    const config = this.area.props.barrelFires;
    const count = this.rng.int(config.count.min, config.count.max);
    
    for (let i = 0; i < count; i++) {
      let position;
      let attempts = 0;
      
      do {
        // Try to place near buildings or in alleys
        if (config.nearWalls && this.data.buildings.length > 0 && this.rng.bool(0.6)) {
          const building = this.rng.pick(this.data.buildings);
          const side = this.rng.pick(['front', 'back', 'left', 'right']);
          const offset = 3;
          
          switch (side) {
            case 'front':
              position = {
                x: building.position.x + this.rng.float(-building.dimensions.width / 3, building.dimensions.width / 3),
                z: building.position.z - building.dimensions.depth / 2 - offset
              };
              break;
            case 'back':
              position = {
                x: building.position.x + this.rng.float(-building.dimensions.width / 3, building.dimensions.width / 3),
                z: building.position.z + building.dimensions.depth / 2 + offset
              };
              break;
            case 'left':
              position = {
                x: building.position.x - building.dimensions.width / 2 - offset,
                z: building.position.z + this.rng.float(-building.dimensions.depth / 3, building.dimensions.depth / 3)
              };
              break;
            case 'right':
              position = {
                x: building.position.x + building.dimensions.width / 2 + offset,
                z: building.position.z + this.rng.float(-building.dimensions.depth / 3, building.dimensions.depth / 3)
              };
              break;
          }
        } else {
          // Random position on sidewalk or in open area
          position = {
            x: this.rng.float(this.area.bounds.minX + 10, this.area.bounds.maxX - 10),
            z: this.rng.float(this.area.bounds.minZ + 10, this.area.bounds.maxZ - 10)
          };
        }
        
        attempts++;
      } while (this.isInsideBuilding(position.x, position.z) && attempts < 20);
      
      if (attempts < 20) {
        this.data.barrelFires.push({
          id: `barrel_fire_${i}`,
          position: { x: position.x, y: 0, z: position.z },
          warmthRadius: config.warmthRadius,
          lightRadius: config.lightRadius,
          lightIntensity: config.lightIntensity,
          lightColor: config.lightColor
        });
      }
    }
  }
  
  // Generate environmental props (trash, vehicles, etc.)
  generateProps() {
    const propsConfig = this.area.props;
    const bounds = this.area.bounds;
    
    // Generate trash clusters using noise
    const trashDensity = propsConfig.trash.density;
    for (let x = bounds.minX; x < bounds.maxX; x += 5) {
      for (let z = bounds.minZ; z < bounds.maxZ; z += 5) {
        const noiseValue = this.noise.fbm(x * 0.05, z * 0.05, 3);
        
        if (noiseValue > 0.2 && this.rng.bool(trashDensity * 0.3)) {
          // Don't place inside buildings
          if (this.isInsideBuilding(x, z)) continue;
          
          // Create trash cluster
          const clusterSize = this.rng.int(2, 6);
          for (let t = 0; t < clusterSize; t++) {
            const offsetX = this.rng.gaussian(0, 1.5);
            const offsetZ = this.rng.gaussian(0, 1.5);
            
            this.data.props.push({
              id: `trash_${this.data.props.length}`,
              type: 'trash',
              subtype: this.rng.pick(propsConfig.trash.types),
              position: { x: x + offsetX, y: 0, z: z + offsetZ },
              rotation: this.rng.float(0, Math.PI * 2),
              scale: this.rng.float(0.5, 1.2)
            });
          }
        }
      }
    }
    
    // Generate vehicles on roads
    const vehicleCount = this.rng.int(propsConfig.vehicles.count.min, propsConfig.vehicles.count.max);
    for (let i = 0; i < vehicleCount; i++) {
      const road = this.rng.pick(this.data.roads);
      let position;
      
      if (road.direction === 'horizontal') {
        position = {
          x: this.rng.float(road.start.x + 10, road.end.x - 10),
          z: road.centerZ + this.rng.float(-road.width / 3, road.width / 3)
        };
      } else {
        position = {
          x: road.centerX + this.rng.float(-road.width / 3, road.width / 3),
          z: this.rng.float(road.start.z + 10, road.end.z - 10)
        };
      }
      
      // Check not overlapping with other vehicles
      const overlaps = this.data.props.some(p => 
        p.type === 'vehicle' && 
        Math.abs(p.position.x - position.x) < 5 && 
        Math.abs(p.position.z - position.z) < 3
      );
      
      if (!overlaps) {
        this.data.props.push({
          id: `vehicle_${i}`,
          type: 'vehicle',
          subtype: this.rng.pick(propsConfig.vehicles.types),
          position: { x: position.x, y: 0, z: position.z },
          rotation: road.direction === 'horizontal' ? this.rng.pick([0, Math.PI]) : this.rng.pick([Math.PI / 2, -Math.PI / 2]),
          burned: this.rng.bool(propsConfig.vehicles.burnedChance),
          color: this.rng.int(0x333333, 0x888888)
        });
      }
    }
    
    // Generate street furniture (lampposts, benches, etc.)
    for (const road of this.data.roads) {
      const length = road.direction === 'horizontal' ? road.end.x - road.start.x : road.end.z - road.start.z;
      const lamppostCount = Math.floor(length / propsConfig.streetFurniture.lamppostSpacing);
      
      for (let i = 0; i < lamppostCount; i++) {
        const t = (i + 0.5) / lamppostCount;
        
        if (road.direction === 'horizontal') {
          // North side
          this.data.props.push({
            id: `lamppost_${this.data.props.length}`,
            type: 'lamppost',
            position: {
              x: road.start.x + (road.end.x - road.start.x) * t,
              y: 0,
              z: road.centerZ + road.width / 2 + 1.5
            },
            working: this.rng.bool(0.3) // Most are broken
          });
        } else {
          // East side
          this.data.props.push({
            id: `lamppost_${this.data.props.length}`,
            type: 'lamppost',
            position: {
              x: road.centerX + road.width / 2 + 1.5,
              y: 0,
              z: road.start.z + (road.end.z - road.start.z) * t
            },
            working: this.rng.bool(0.3)
          });
        }
      }
    }
    
    // Generate dumpsters near buildings
    for (const building of this.data.buildings) {
      if (this.rng.bool(0.4)) {
        const side = this.rng.pick(['back', 'left', 'right']);
        let position;
        
        switch (side) {
          case 'back':
            position = {
              x: building.position.x + this.rng.float(-2, 2),
              z: building.position.z + building.dimensions.depth / 2 + 2
            };
            break;
          case 'left':
            position = {
              x: building.position.x - building.dimensions.width / 2 - 2,
              z: building.position.z + this.rng.float(-2, 2)
            };
            break;
          case 'right':
            position = {
              x: building.position.x + building.dimensions.width / 2 + 2,
              z: building.position.z + this.rng.float(-2, 2)
            };
            break;
        }
        
        if (!this.isInsideBuilding(position.x, position.z)) {
          this.data.props.push({
            id: `dumpster_${this.data.props.length}`,
            type: 'dumpster',
            position: { x: position.x, y: 0, z: position.z },
            rotation: this.rng.float(0, Math.PI * 2)
          });
        }
      }
    }
    
    // Generate shelters/tents
    const shelterCount = this.rng.int(this.area.props.shelters.count.min, this.area.props.shelters.count.max);
    for (let i = 0; i < shelterCount; i++) {
      // Place near barrel fires or under overpasses
      let position;
      
      if (this.data.barrelFires.length > 0 && this.rng.bool(0.5)) {
        const fire = this.rng.pick(this.data.barrelFires);
        const angle = this.rng.float(0, Math.PI * 2);
        const dist = this.rng.float(3, 6);
        position = {
          x: fire.position.x + Math.cos(angle) * dist,
          z: fire.position.z + Math.sin(angle) * dist
        };
      } else if (this.data.overpasses.length > 0 && this.rng.bool(0.4)) {
        const overpass = this.rng.pick(this.data.overpasses);
        const t = this.rng.float(0.2, 0.8);
        position = {
          x: overpass.start.x + (overpass.end.x - overpass.start.x) * t + this.rng.float(-5, 5),
          z: overpass.start.z + (overpass.end.z - overpass.start.z) * t + this.rng.float(-5, 5)
        };
      } else {
        position = {
          x: this.rng.float(bounds.minX + 20, bounds.maxX - 20),
          z: this.rng.float(bounds.minZ + 20, bounds.maxZ - 20)
        };
      }
      
      if (!this.isInsideBuilding(position.x, position.z)) {
        this.data.props.push({
          id: `shelter_${i}`,
          type: 'shelter',
          subtype: this.rng.pick(this.area.props.shelters.types),
          position: { x: position.x, y: 0, z: position.z },
          rotation: this.rng.float(0, Math.PI * 2)
        });
      }
    }
    
    // Generate broken glass zones
    const glassCount = this.rng.int(this.area.props.glassZones.count.min, this.area.props.glassZones.count.max);
    for (let i = 0; i < glassCount; i++) {
      // Place near buildings with broken windows
      const building = this.rng.pick(this.data.buildings);
      if (!building) continue;
      
      const side = this.rng.pick(['front', 'back', 'left', 'right']);
      let position;
      
      switch (side) {
        case 'front':
          position = {
            x: building.position.x + this.rng.float(-building.dimensions.width / 3, building.dimensions.width / 3),
            z: building.position.z - building.dimensions.depth / 2 - 1.5
          };
          break;
        case 'back':
          position = {
            x: building.position.x + this.rng.float(-building.dimensions.width / 3, building.dimensions.width / 3),
            z: building.position.z + building.dimensions.depth / 2 + 1.5
          };
          break;
        case 'left':
          position = {
            x: building.position.x - building.dimensions.width / 2 - 1.5,
            z: building.position.z + this.rng.float(-building.dimensions.depth / 3, building.dimensions.depth / 3)
          };
          break;
        case 'right':
          position = {
            x: building.position.x + building.dimensions.width / 2 + 1.5,
            z: building.position.z + this.rng.float(-building.dimensions.depth / 3, building.dimensions.depth / 3)
          };
          break;
      }
      
      this.data.props.push({
        id: `glass_zone_${i}`,
        type: 'glass_zone',
        position: { x: position.x, y: 0, z: position.z },
        radius: this.area.props.glassZones.radius,
        broken: false
      });
    }
  }
  
  // Generate loot containers
  generateLootContainers() {
    const config = this.area.lootContainers;
    const count = this.rng.int(config.count.min, config.count.max);
    
    for (let i = 0; i < count; i++) {
      const containerType = this.rng.pickWeighted(config.types.map(t => ({ item: t, weight: t.weight })));
      let position;
      let isInterior = false;
      
      // Place based on container type preference
      if (containerType.position === 'interior' && this.data.interiors.length > 0) {
        const interior = this.rng.pick(this.data.interiors);
        position = {
          x: this.rng.float(interior.bounds.minX + 1, interior.bounds.maxX - 1),
          z: this.rng.float(interior.bounds.minZ + 1, interior.bounds.maxZ - 1)
        };
        isInterior = true;
      } else if (containerType.position === 'alley') {
        // Place in alley-like spaces (between buildings)
        position = {
          x: this.rng.float(this.area.bounds.minX + 20, this.area.bounds.maxX - 20),
          z: this.rng.float(this.area.bounds.minZ + 20, this.area.bounds.maxZ - 20)
        };
        // Ensure not inside building
        if (this.isInsideBuilding(position.x, position.z)) {
          continue;
        }
      } else if (containerType.position === 'road') {
        // Place near road (in vehicle or on sidewalk)
        const road = this.rng.pick(this.data.roads);
        if (road.direction === 'horizontal') {
          position = {
            x: this.rng.float(road.start.x + 10, road.end.x - 10),
            z: road.centerZ + this.rng.float(-road.width / 2 - 3, road.width / 2 + 3)
          };
        } else {
          position = {
            x: road.centerX + this.rng.float(-road.width / 2 - 3, road.width / 2 + 3),
            z: this.rng.float(road.start.z + 10, road.end.z - 10)
          };
        }
      } else {
        // Random position
        position = {
          x: this.rng.float(this.area.bounds.minX + 15, this.area.bounds.maxX - 15),
          z: this.rng.float(this.area.bounds.minZ + 15, this.area.bounds.maxZ - 15)
        };
      }
      
      // Determine loot based on table
      const lootTable = config.tables[containerType.lootTable] || config.tables.supplies;
      const loot = this.rng.pickWeighted(
        Object.entries(lootTable).map(([item, weight]) => ({ item, weight }))
      );
      
      this.data.lootContainers.push({
        id: `loot_${i}`,
        type: containerType.id,
        position: { x: position.x, y: 0, z: position.z },
        rotation: this.rng.float(0, Math.PI * 2),
        loot: loot === 'nothing' ? null : loot,
        looted: false,
        isInterior
      });
    }
  }
  
  // Generate objectives
  generateObjectives() {
    const objectiveConfig = this.area.objectives.primary;
    
    // Place objective items in interiors
    for (const item of objectiveConfig.items) {
      for (let i = 0; i < item.count; i++) {
        let position;
        
        if (item.spawnIn === 'interior' && this.data.interiors.length > 0) {
          const interior = this.rng.pick(this.data.interiors);
          position = {
            x: this.rng.float(interior.bounds.minX + 1, interior.bounds.maxX - 1),
            z: this.rng.float(interior.bounds.minZ + 1, interior.bounds.maxZ - 1)
          };
        } else {
          // Fallback to random position
          position = {
            x: this.rng.float(this.area.bounds.minX + 30, this.area.bounds.maxX - 30),
            z: this.rng.float(this.area.bounds.minZ + 30, this.area.bounds.maxZ - 30)
          };
        }
        
        this.data.objectives.push({
          id: `objective_${item.id}_${i}`,
          type: 'collect',
          itemId: item.id,
          name: item.name,
          position: { x: position.x, y: 0.5, z: position.z },
          collected: false
        });
      }
    }
    
    // Place escape zone
    const bounds = this.area.bounds;
    const escapeSide = this.rng.pick(['north', 'south', 'east', 'west']);
    let escapePosition;
    
    switch (escapeSide) {
      case 'north':
        escapePosition = { x: this.rng.float(-30, 30), z: bounds.maxZ - 15 };
        break;
      case 'south':
        escapePosition = { x: this.rng.float(-30, 30), z: bounds.minZ + 15 };
        break;
      case 'east':
        escapePosition = { x: bounds.maxX - 15, z: this.rng.float(-30, 30) };
        break;
      case 'west':
        escapePosition = { x: bounds.minX + 15, z: this.rng.float(-30, 30) };
        break;
    }
    
    this.data.objectives.push({
      id: 'escape_zone',
      type: 'escape',
      position: escapePosition,
      radius: objectiveConfig.escapeZone.radius,
      active: false, // Becomes active when all items collected
      vehicleType: this.rng.pick(['van', 'truck', 'bus'])
    });
  }
  
  // Calculate spawn points
  calculateSpawnPoints() {
    const spawnConfig = this.area.spawns;
    
    // Player spawn points (in spawn zone, avoiding buildings)
    const playerSpawnCount = 8;
    for (let i = 0; i < playerSpawnCount; i++) {
      let position;
      let attempts = 0;
      
      do {
        position = {
          x: this.rng.float(spawnConfig.players.zone.minX, spawnConfig.players.zone.maxX),
          z: this.rng.float(spawnConfig.players.zone.minZ, spawnConfig.players.zone.maxZ)
        };
        attempts++;
      } while (this.isInsideBuilding(position.x, position.z) && attempts < 20);
      
      this.data.spawnPoints.players.push({
        x: position.x,
        y: 1.6,
        z: position.z
      });
    }
    
    // Enemy spawn zones (areas where enemies can spawn)
    // These are calculated as valid areas away from player spawn
    const enemyZones = [];
    const gridSize = 20;
    const bounds = this.area.bounds;
    
    for (let x = bounds.minX + gridSize; x < bounds.maxX - gridSize; x += gridSize) {
      for (let z = bounds.minZ + gridSize; z < bounds.maxZ - gridSize; z += gridSize) {
        // Check if zone is far enough from player spawn
        const distFromSpawn = Math.sqrt(x * x + z * z);
        
        if (distFromSpawn >= spawnConfig.enemies.minDistanceFromPlayers) {
          // Check if zone has walkable space
          if (!this.isInsideBuilding(x, z)) {
            enemyZones.push({ x, z, type: 'street' });
          }
        }
      }
    }
    
    this.data.spawnPoints.enemies = enemyZones;
  }
  
  // Build collision grid
  buildCollisionGrid() {
    const bounds = this.area.bounds;
    this.gridWidth = Math.ceil((bounds.maxX - bounds.minX) / this.gridResolution);
    this.gridHeight = Math.ceil((bounds.maxZ - bounds.minZ) / this.gridResolution);
    
    // Initialize grid (0 = walkable, 1 = blocked)
    this.collisionGrid = new Uint8Array(this.gridWidth * this.gridHeight);
    
    // Mark buildings as blocked
    for (const building of this.data.buildings) {
      this.markRectangleBlocked(
        building.position.x - building.dimensions.width / 2,
        building.position.z - building.dimensions.depth / 2,
        building.position.x + building.dimensions.width / 2,
        building.position.z + building.dimensions.depth / 2
      );
    }
    
    // Mark overpass pillars as blocked
    for (const overpass of this.data.overpasses) {
      for (const pillar of overpass.pillars) {
        this.markRectangleBlocked(
          pillar.position.x - 1,
          pillar.position.z - 1,
          pillar.position.x + 1,
          pillar.position.z + 1
        );
      }
    }
    
    // Mark some vehicles as blocked (larger ones)
    for (const prop of this.data.props) {
      if (prop.type === 'vehicle') {
        const size = prop.subtype === 'bus' ? 5 : prop.subtype === 'truck' ? 3 : 2;
        this.markRectangleBlocked(
          prop.position.x - size,
          prop.position.z - 1.5,
          prop.position.x + size,
          prop.position.z + 1.5
        );
      } else if (prop.type === 'dumpster') {
        this.markRectangleBlocked(
          prop.position.x - 1.5,
          prop.position.z - 1,
          prop.position.x + 1.5,
          prop.position.z + 1
        );
      }
    }
    
    // Clear doorways for interior buildings
    for (const interior of this.data.interiors) {
      if (!interior.door.barricaded) {
        const door = interior.door;
        this.markRectangleWalkable(
          door.position.x - 1,
          door.position.z - 1,
          door.position.x + 1,
          door.position.z + 1
        );
      }
    }
    
    console.log(`[MapManager] Collision grid: ${this.gridWidth}x${this.gridHeight} cells`);
  }
  
  // Mark rectangle as blocked in collision grid
  markRectangleBlocked(minX, minZ, maxX, maxZ) {
    const bounds = this.area.bounds;
    
    const startX = Math.max(0, Math.floor((minX - bounds.minX) / this.gridResolution));
    const endX = Math.min(this.gridWidth - 1, Math.ceil((maxX - bounds.minX) / this.gridResolution));
    const startZ = Math.max(0, Math.floor((minZ - bounds.minZ) / this.gridResolution));
    const endZ = Math.min(this.gridHeight - 1, Math.ceil((maxZ - bounds.minZ) / this.gridResolution));
    
    for (let x = startX; x <= endX; x++) {
      for (let z = startZ; z <= endZ; z++) {
        this.collisionGrid[z * this.gridWidth + x] = 1;
      }
    }
  }
  
  // Mark rectangle as walkable in collision grid
  markRectangleWalkable(minX, minZ, maxX, maxZ) {
    const bounds = this.area.bounds;
    
    const startX = Math.max(0, Math.floor((minX - bounds.minX) / this.gridResolution));
    const endX = Math.min(this.gridWidth - 1, Math.ceil((maxX - bounds.minX) / this.gridResolution));
    const startZ = Math.max(0, Math.floor((minZ - bounds.minZ) / this.gridResolution));
    const endZ = Math.min(this.gridHeight - 1, Math.ceil((maxZ - bounds.minZ) / this.gridResolution));
    
    for (let x = startX; x <= endX; x++) {
      for (let z = startZ; z <= endZ; z++) {
        this.collisionGrid[z * this.gridWidth + x] = 0;
      }
    }
  }
  
  // Check if world position is blocked
  isBlocked(worldX, worldZ) {
    const bounds = this.area.bounds;
    
    // Out of bounds is blocked
    if (worldX < bounds.minX || worldX > bounds.maxX || worldZ < bounds.minZ || worldZ > bounds.maxZ) {
      return true;
    }
    
    const gridX = Math.floor((worldX - bounds.minX) / this.gridResolution);
    const gridZ = Math.floor((worldZ - bounds.minZ) / this.gridResolution);
    
    if (gridX < 0 || gridX >= this.gridWidth || gridZ < 0 || gridZ >= this.gridHeight) {
      return true;
    }
    
    return this.collisionGrid[gridZ * this.gridWidth + gridX] === 1;
  }
  
  // Check if world position is inside any building
  isInsideBuilding(worldX, worldZ) {
    for (const building of this.data.buildings) {
      const halfW = building.dimensions.width / 2;
      const halfD = building.dimensions.depth / 2;
      
      if (worldX >= building.position.x - halfW && worldX <= building.position.x + halfW &&
          worldZ >= building.position.z - halfD && worldZ <= building.position.z + halfD) {
        return true;
      }
    }
    return false;
  }
  
  // Check if two rectangles overlap
  rectanglesOverlap(ax1, az1, ax2, az2, bx1, bz1, bx2, bz2) {
    return ax1 < bx2 && ax2 > bx1 && az1 < bz2 && az2 > bz1;
  }
  
  // Get random valid enemy spawn position
  getEnemySpawnPosition(playerPositions, minDist = 25, maxDist = 80) {
    const spawnZones = this.data.spawnPoints.enemies;
    if (spawnZones.length === 0) return null;
    
    // Try to find valid spawn
    for (let attempt = 0; attempt < 20; attempt++) {
      const zone = this.rng.pick(spawnZones);
      const position = {
        x: zone.x + this.rng.float(-8, 8),
        z: zone.z + this.rng.float(-8, 8)
      };
      
      // Check distance from all players
      let validDist = true;
      for (const playerPos of playerPositions) {
        const dist = Math.sqrt(
          Math.pow(position.x - playerPos.x, 2) + 
          Math.pow(position.z - playerPos.z, 2)
        );
        
        if (dist < minDist || dist > maxDist) {
          validDist = false;
          break;
        }
      }
      
      // Check not blocked
      if (validDist && !this.isBlocked(position.x, position.z)) {
        return position;
      }
    }
    
    return null;
  }
  
  // Serialize map data for client
  toClientData() {
    return {
      areaId: this.areaId,
      seed: this.seed,
      area: this.area,
      roads: this.data.roads,
      sidewalks: this.data.sidewalks,
      buildings: this.data.buildings,
      interiors: this.data.interiors,
      overpasses: this.data.overpasses,
      props: this.data.props,
      barrelFires: this.data.barrelFires,
      lootContainers: this.data.lootContainers,
      objectives: this.data.objectives,
      spawnPoints: this.data.spawnPoints,
      bounds: this.area.bounds
    };
  }
  
  // Get collision data for pathfinding worker
  getCollisionData() {
    return {
      grid: this.collisionGrid,
      width: this.gridWidth,
      height: this.gridHeight,
      resolution: this.gridResolution,
      bounds: this.area.bounds
    };
  }
}

module.exports = MapManager;
