// MapRenderer.js - Client-side Three.js renderer for procedural maps
// Place in: client/src/game/MapRenderer.js

import * as THREE from 'three';

export class MapRenderer {
  constructor(scene, mapData) {
    this.scene = scene;
    this.mapData = mapData;
    this.area = mapData.area;
    
    // Store created objects for cleanup
    this.objects = {
      ground: null,
      roads: [],
      sidewalks: [],
      buildings: [],
      overpasses: [],
      props: [],
      barrelFires: [],
      lootContainers: [],
      objectives: [],
      lights: []
    };
    
    // Materials (reusable)
    this.materials = this.createMaterials();
  }
  
  createMaterials() {
    const theme = this.area.theme;
    
    return {
      ground: new THREE.MeshLambertMaterial({ color: theme.ground }),
      road: new THREE.MeshLambertMaterial({ color: theme.road }),
      sidewalk: new THREE.MeshLambertMaterial({ color: theme.sidewalk }),
      building: new THREE.MeshLambertMaterial({ color: theme.building }),
      buildingDark: new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
      window: new THREE.MeshLambertMaterial({ color: 0x111122, transparent: true, opacity: 0.7 }),
      windowLit: new THREE.MeshBasicMaterial({ color: 0xffee99 }),
      windowBoarded: new THREE.MeshLambertMaterial({ color: 0x4a3a2a }),
      door: new THREE.MeshLambertMaterial({ color: 0x3a2a1a }),
      awning: new THREE.MeshLambertMaterial({ color: 0x884422 }),
      concrete: new THREE.MeshLambertMaterial({ color: 0x555555 }),
      metal: new THREE.MeshLambertMaterial({ color: 0x444444 }),
      rust: new THREE.MeshLambertMaterial({ color: 0x553322 }),
      trash: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
      barrel: new THREE.MeshLambertMaterial({ color: 0x333333 }),
      fire: new THREE.MeshBasicMaterial({ color: 0xff6622 }),
      vehicle: new THREE.MeshLambertMaterial({ color: 0x444455 }),
      vehicleBurned: new THREE.MeshLambertMaterial({ color: 0x222222 }),
      tent: new THREE.MeshLambertMaterial({ color: 0x556655 }),
      tarp: new THREE.MeshLambertMaterial({ color: 0x4477aa }),
      glass: new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }),
      objective: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
      escapeZone: new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 })
    };
  }
  
  render() {
    console.log('[MapRenderer] Rendering map...');
    
    // Apply theme
    this.applyTheme();
    
    // Render in order
    this.renderGround();
    this.renderRoads();
    this.renderSidewalks();
    this.renderBuildings();
    this.renderOverpasses();
    this.renderBarrelFires();
    this.renderProps();
    this.renderLootContainers();
    this.renderObjectives();
    
    console.log('[MapRenderer] Rendering complete');
    
    return this.objects;
  }
  
  applyTheme() {
    const theme = this.area.theme;
    
    // Fog
    this.scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
    this.scene.background = new THREE.Color(theme.sky);
    
    // Ambient light
    const ambient = new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity);
    this.scene.add(ambient);
    this.objects.lights.push(ambient);
    
    // Directional light (sun/moon)
    const directional = new THREE.DirectionalLight(theme.directional.color, theme.directional.intensity);
    directional.position.set(
      theme.directional.position.x,
      theme.directional.position.y,
      theme.directional.position.z
    );
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 1;
    directional.shadow.camera.far = 200;
    directional.shadow.camera.left = -100;
    directional.shadow.camera.right = 100;
    directional.shadow.camera.top = 100;
    directional.shadow.camera.bottom = -100;
    this.scene.add(directional);
    this.objects.lights.push(directional);
  }
  
  renderGround() {
    const bounds = this.mapData.bounds;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 20, depth + 20),
      this.materials.ground
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(
      (bounds.minX + bounds.maxX) / 2,
      0,
      (bounds.minZ + bounds.maxZ) / 2
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.objects.ground = ground;
  }
  
  renderRoads() {
    for (const road of this.mapData.roads) {
      let width, depth, x, z;
      
      if (road.direction === 'horizontal') {
        width = road.end.x - road.start.x;
        depth = road.width;
        x = (road.start.x + road.end.x) / 2;
        z = road.centerZ;
      } else {
        width = road.width;
        depth = road.end.z - road.start.z;
        x = road.centerX;
        z = (road.start.z + road.end.z) / 2;
      }
      
      const roadMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        this.materials.road
      );
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(x, 0.01, z);
      roadMesh.receiveShadow = true;
      this.scene.add(roadMesh);
      this.objects.roads.push(roadMesh);
      
      // Road markings
      this.addRoadMarkings(road, x, z, width, depth);
    }
  }
  
  addRoadMarkings(road, x, z, width, depth) {
    const markingMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    
    if (road.direction === 'horizontal') {
      // Center line
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.9, 0.2),
        markingMaterial
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, z);
      this.scene.add(line);
      this.objects.roads.push(line);
    } else {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, depth * 0.9),
        markingMaterial
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, z);
      this.scene.add(line);
      this.objects.roads.push(line);
    }
  }
  
  renderSidewalks() {
    const bounds = this.mapData.bounds;
    
    for (const sidewalk of this.mapData.sidewalks) {
      const road = this.mapData.roads.find(r => r.id === sidewalk.roadId);
      if (!road) continue;
      
      let width, depth, x, z;
      
      if (road.direction === 'horizontal') {
        width = road.end.x - road.start.x;
        depth = sidewalk.width;
        x = (road.start.x + road.end.x) / 2;
        z = sidewalk.z;
      } else {
        width = sidewalk.width;
        depth = road.end.z - road.start.z;
        x = sidewalk.x;
        z = (road.start.z + road.end.z) / 2;
      }
      
      const sidewalkMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.15, depth),
        this.materials.sidewalk
      );
      sidewalkMesh.position.set(x, 0.075, z);
      sidewalkMesh.receiveShadow = true;
      sidewalkMesh.castShadow = true;
      this.scene.add(sidewalkMesh);
      this.objects.sidewalks.push(sidewalkMesh);
    }
  }
  
  renderBuildings() {
    for (const building of this.mapData.buildings) {
      const buildingGroup = this.createBuilding(building);
      buildingGroup.position.set(
        building.position.x,
        0,
        building.position.z
      );
      buildingGroup.rotation.y = building.rotation || 0;
      this.scene.add(buildingGroup);
      this.objects.buildings.push(buildingGroup);
    }
  }
  
  createBuilding(building) {
    const group = new THREE.Group();
    const { width, height, depth } = building.dimensions;
    
    // Main structure
    const buildingColor = new THREE.Color(building.color || this.area.theme.building);
    const buildingMat = new THREE.MeshLambertMaterial({ color: buildingColor });
    
    const mainMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      buildingMat
    );
    mainMesh.position.y = height / 2;
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);
    
    // Windows
    if (building.windows) {
      for (const window of building.windows) {
        let windowMat;
        if (window.boarded) {
          windowMat = this.materials.windowBoarded;
        } else if (window.lit) {
          windowMat = this.materials.windowLit;
        } else {
          windowMat = this.materials.window;
        }
        
        const windowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 1.8),
          windowMat
        );
        
        // Position based on side
        switch (window.side) {
          case 'front':
            windowMesh.position.set(window.position.x, window.position.y, -depth / 2 - 0.02);
            break;
          case 'back':
            windowMesh.position.set(window.position.x, window.position.y, depth / 2 + 0.02);
            windowMesh.rotation.y = Math.PI;
            break;
          case 'left':
            windowMesh.position.set(-width / 2 - 0.02, window.position.y, window.position.z);
            windowMesh.rotation.y = -Math.PI / 2;
            break;
          case 'right':
            windowMesh.position.set(width / 2 + 0.02, window.position.y, window.position.z);
            windowMesh.rotation.y = Math.PI / 2;
            break;
        }
        
        group.add(windowMesh);
      }
    }
    
    // Awning (for storefronts)
    if (building.hasAwning) {
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, 0.1, 2),
        this.materials.awning
      );
      awning.position.set(0, 3.5, -depth / 2 - 1);
      awning.rotation.x = -0.15;
      group.add(awning);
    }
    
    // Rubble (for ruined buildings)
    if (building.hasRubble) {
      const rubbleCount = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < rubbleCount; i++) {
        const rubble = new THREE.Mesh(
          new THREE.BoxGeometry(
            Math.random() * 2 + 0.5,
            Math.random() * 1 + 0.3,
            Math.random() * 2 + 0.5
          ),
          this.materials.concrete
        );
        rubble.position.set(
          (Math.random() - 0.5) * width * 1.2,
          0.2,
          (Math.random() - 0.5) * depth * 1.2
        );
        rubble.rotation.set(
          Math.random() * 0.3,
          Math.random() * Math.PI,
          Math.random() * 0.3
        );
        group.add(rubble);
      }
    }
    
    // Store building data for collision reference
    group.userData = {
      type: 'building',
      buildingId: building.id,
      hasInterior: building.hasInterior,
      interiorId: building.interiorId,
      dimensions: building.dimensions
    };
    
    return group;
  }
  
  renderOverpasses() {
    for (const overpass of this.mapData.overpasses) {
      const group = new THREE.Group();
      
      // Main deck
      const length = overpass.direction === 'horizontal'
        ? overpass.end.x - overpass.start.x
        : overpass.end.z - overpass.start.z;
      
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(
          overpass.direction === 'horizontal' ? length : overpass.width,
          0.8,
          overpass.direction === 'horizontal' ? overpass.width : length
        ),
        this.materials.concrete
      );
      deck.position.set(
        (overpass.start.x + overpass.end.x) / 2,
        overpass.height,
        (overpass.start.z + overpass.end.z) / 2
      );
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);
      
      // Pillars
      for (const pillar of overpass.pillars) {
        const pillarMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 1, pillar.height, 8),
          this.materials.concrete
        );
        pillarMesh.position.set(
          pillar.position.x,
          pillar.height / 2,
          pillar.position.z
        );
        pillarMesh.castShadow = true;
        group.add(pillarMesh);
      }
      
      // Barriers on sides
      const barrierHeight = 1;
      const barrier1 = new THREE.Mesh(
        new THREE.BoxGeometry(
          overpass.direction === 'horizontal' ? length : 0.3,
          barrierHeight,
          overpass.direction === 'horizontal' ? 0.3 : length
        ),
        this.materials.concrete
      );
      barrier1.position.set(
        (overpass.start.x + overpass.end.x) / 2 + (overpass.direction === 'horizontal' ? 0 : overpass.width / 2 - 0.15),
        overpass.height + 0.4 + barrierHeight / 2,
        (overpass.start.z + overpass.end.z) / 2 + (overpass.direction === 'horizontal' ? overpass.width / 2 - 0.15 : 0)
      );
      group.add(barrier1);
      
      const barrier2 = barrier1.clone();
      barrier2.position.set(
        (overpass.start.x + overpass.end.x) / 2 - (overpass.direction === 'horizontal' ? 0 : overpass.width / 2 - 0.15),
        overpass.height + 0.4 + barrierHeight / 2,
        (overpass.start.z + overpass.end.z) / 2 - (overpass.direction === 'horizontal' ? overpass.width / 2 - 0.15 : 0)
      );
      group.add(barrier2);
      
      this.scene.add(group);
      this.objects.overpasses.push(group);
    }
  }
  
  renderBarrelFires() {
    for (const fire of this.mapData.barrelFires) {
      const group = new THREE.Group();
      
      // Barrel
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 1, 8),
        this.materials.barrel
      );
      barrel.position.y = 0.5;
      barrel.castShadow = true;
      group.add(barrel);
      
      // Fire glow (simple sphere)
      const fireGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        this.materials.fire
      );
      fireGlow.position.y = 1.1;
      group.add(fireGlow);
      
      // Point light
      const light = new THREE.PointLight(fire.lightColor, fire.lightIntensity, fire.lightRadius);
      light.position.y = 1.5;
      group.add(light);
      
      group.position.set(fire.position.x, fire.position.y, fire.position.z);
      
      // Store fire data
      group.userData = {
        type: 'barrelFire',
        fireId: fire.id,
        warmthRadius: fire.warmthRadius,
        light: light
      };
      
      this.scene.add(group);
      this.objects.barrelFires.push(group);
    }
  }
  
  renderProps() {
    for (const prop of this.mapData.props) {
      let propMesh;
      
      switch (prop.type) {
        case 'trash':
          propMesh = this.createTrash(prop);
          break;
        case 'vehicle':
          propMesh = this.createVehicle(prop);
          break;
        case 'lamppost':
          propMesh = this.createLamppost(prop);
          break;
        case 'dumpster':
          propMesh = this.createDumpster(prop);
          break;
        case 'shelter':
          propMesh = this.createShelter(prop);
          break;
        case 'glass_zone':
          propMesh = this.createGlassZone(prop);
          break;
        default:
          continue;
      }
      
      if (propMesh) {
        propMesh.position.set(prop.position.x, prop.position.y || 0, prop.position.z);
        if (prop.rotation) propMesh.rotation.y = prop.rotation;
        propMesh.userData = { type: prop.type, propId: prop.id, ...prop };
        this.scene.add(propMesh);
        this.objects.props.push(propMesh);
      }
    }
  }
  
  createTrash(prop) {
    const scale = prop.scale || 1;
    let mesh;
    
    switch (prop.subtype) {
      case 'bag':
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.25 * scale, 6, 6),
          this.materials.trash
        );
        mesh.scale.y = 0.7;
        mesh.position.y = 0.15;
        break;
      case 'can':
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.15 * scale, 8),
          this.materials.metal
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = 0.08;
        break;
      case 'box':
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.4 * scale, 0.3 * scale, 0.3 * scale),
          new THREE.MeshLambertMaterial({ color: 0x8b7355 })
        );
        mesh.position.y = 0.15;
        break;
      default:
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.2 * scale, 0.1 * scale, 0.2 * scale),
          this.materials.trash
        );
        mesh.position.y = 0.05;
    }
    
    return mesh;
  }
  
  createVehicle(prop) {
    const group = new THREE.Group();
    const material = prop.burned ? this.materials.vehicleBurned : 
      new THREE.MeshLambertMaterial({ color: prop.color || 0x444455 });
    
    let bodyWidth, bodyLength, bodyHeight;
    
    switch (prop.subtype) {
      case 'bus':
        bodyWidth = 2.5;
        bodyLength = 10;
        bodyHeight = 2.8;
        break;
      case 'truck':
        bodyWidth = 2.2;
        bodyLength = 6;
        bodyHeight = 2.2;
        break;
      case 'van':
        bodyWidth = 2;
        bodyLength = 5;
        bodyHeight = 2;
        break;
      default: // car
        bodyWidth = 1.8;
        bodyLength = 4;
        bodyHeight = 1.4;
    }
    
    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength),
      material
    );
    body.position.y = bodyHeight / 2 + 0.3;
    body.castShadow = true;
    group.add(body);
    
    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    
    const wheelPositions = [
      { x: -bodyWidth / 2 - 0.1, z: bodyLength / 3 },
      { x: bodyWidth / 2 + 0.1, z: bodyLength / 3 },
      { x: -bodyWidth / 2 - 0.1, z: -bodyLength / 3 },
      { x: bodyWidth / 2 + 0.1, z: -bodyLength / 3 }
    ];
    
    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.35, pos.z);
      group.add(wheel);
    }
    
    return group;
  }
  
  createLamppost(prop) {
    const group = new THREE.Group();
    
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 6, 8),
      this.materials.metal
    );
    pole.position.y = 3;
    pole.castShadow = true;
    group.add(pole);
    
    // Arm
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.1, 0.1),
      this.materials.metal
    );
    arm.position.set(0.75, 5.8, 0);
    group.add(arm);
    
    // Light fixture
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.15, 0.3),
      this.materials.metal
    );
    fixture.position.set(1.4, 5.7, 0);
    group.add(fixture);
    
    // Light (if working)
    if (prop.working) {
      const light = new THREE.PointLight(0xffffaa, 0.5, 15);
      light.position.set(1.4, 5.5, 0);
      group.add(light);
    }
    
    return group;
  }
  
  createDumpster(prop) {
    const group = new THREE.Group();
    
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.5, 1.5),
      new THREE.MeshLambertMaterial({ color: 0x2a5a2a })
    );
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);
    
    // Lid
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.1, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x1a4a1a })
    );
    lid.position.set(0, 1.55, 0.35);
    lid.rotation.x = 0.3;
    group.add(lid);
    
    return group;
  }
  
  createShelter(prop) {
    const group = new THREE.Group();
    
    switch (prop.subtype) {
      case 'tent':
        // Triangle tent
        const tentGeom = new THREE.ConeGeometry(1.5, 1.5, 4);
        const tent = new THREE.Mesh(tentGeom, this.materials.tent);
        tent.position.y = 0.75;
        tent.rotation.y = Math.PI / 4;
        tent.scale.set(1, 1, 1.5);
        group.add(tent);
        break;
        
      case 'tarp':
        // Tarp shelter
        const tarp = new THREE.Mesh(
          new THREE.PlaneGeometry(3, 2),
          this.materials.tarp
        );
        tarp.position.set(0, 1, 0);
        tarp.rotation.x = -0.5;
        group.add(tarp);
        
        // Support pole
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 1.5),
          this.materials.metal
        );
        pole.position.set(0, 0.75, -0.5);
        group.add(pole);
        break;
        
      case 'cardboard':
        // Cardboard box shelter
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 1, 2),
          new THREE.MeshLambertMaterial({ color: 0x8b7355 })
        );
        box.position.y = 0.5;
        group.add(box);
        break;
        
      default:
        // Shopping cart with blankets
        const cart = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.8, 1),
          this.materials.metal
        );
        cart.position.y = 0.4;
        group.add(cart);
    }
    
    return group;
  }
  
  createGlassZone(prop) {
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(prop.radius * 2, prop.radius * 2),
      this.materials.glass
    );
    glass.rotation.x = -Math.PI / 2;
    glass.position.y = 0.02;
    
    glass.userData = {
      type: 'glass_zone',
      glassId: prop.id,
      radius: prop.radius,
      broken: prop.broken || false
    };
    
    return glass;
  }
  
  renderLootContainers() {
    for (const container of this.mapData.lootContainers) {
      let mesh;
      
      switch (container.type) {
        case 'dumpster':
          mesh = this.createDumpster(container);
          break;
        case 'crate':
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 0.8),
            new THREE.MeshLambertMaterial({ color: 0x5a4a3a })
          );
          mesh.position.y = 0.4;
          break;
        case 'locker':
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.8, 0.5),
            this.materials.metal
          );
          mesh.position.y = 0.9;
          break;
        case 'cabinet':
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.2, 0.4),
            new THREE.MeshLambertMaterial({ color: 0xeeeeee })
          );
          mesh.position.y = 0.6;
          break;
        case 'backpack':
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.5, 0.25),
            new THREE.MeshLambertMaterial({ color: 0x3a5a3a })
          );
          mesh.position.y = 0.25;
          break;
        case 'cooler':
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x4488aa })
          );
          mesh.position.y = 0.2;
          break;
        case 'car_trunk':
          // Just a marker - car is already rendered
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.3, 0.5),
            new THREE.MeshLambertMaterial({ color: 0x555555, transparent: true, opacity: 0 })
          );
          break;
        default:
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.6, 0.6),
            new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
          );
          mesh.position.y = 0.3;
      }
      
      mesh.position.x = container.position.x;
      mesh.position.z = container.position.z;
      if (container.rotation) mesh.rotation.y = container.rotation;
      
      mesh.userData = {
        type: 'lootContainer',
        containerId: container.id,
        containerType: container.type,
        looted: container.looted,
        loot: container.loot
      };
      
      this.scene.add(mesh);
      this.objects.lootContainers.push(mesh);
    }
  }
  
  renderObjectives() {
    for (const objective of this.mapData.objectives) {
      if (objective.type === 'collect') {
        // Objective item - glowing cube
        const group = new THREE.Group();
        
        const item = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          this.materials.objective
        );
        item.position.y = 0.5;
        group.add(item);
        
        // Glow effect
        const glow = new THREE.PointLight(0xffff00, 0.5, 5);
        glow.position.y = 0.5;
        group.add(glow);
        
        // Floating animation will be handled in update
        group.userData = {
          type: 'objective',
          objectiveId: objective.id,
          itemId: objective.itemId,
          name: objective.name,
          collected: objective.collected,
          baseY: objective.position.y
        };
        
        group.position.set(objective.position.x, objective.position.y, objective.position.z);
        this.scene.add(group);
        this.objects.objectives.push(group);
        
      } else if (objective.type === 'escape') {
        // Escape zone - circular area
        const zone = new THREE.Mesh(
          new THREE.CircleGeometry(objective.radius, 32),
          this.materials.escapeZone
        );
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(objective.position.x, 0.05, objective.position.z);
        
        zone.userData = {
          type: 'escapeZone',
          active: objective.active,
          radius: objective.radius
        };
        
        // Initially hidden until objectives complete
        zone.visible = objective.active;
        
        this.scene.add(zone);
        this.objects.objectives.push(zone);
        
        // Escape vehicle
        if (objective.vehicleType) {
          const vehicle = this.createVehicle({ 
            subtype: objective.vehicleType, 
            burned: false,
            color: 0x2255aa
          });
          vehicle.position.set(objective.position.x, 0, objective.position.z);
          vehicle.visible = objective.active;
          vehicle.userData = { type: 'escapeVehicle' };
          this.scene.add(vehicle);
          this.objects.objectives.push(vehicle);
        }
      }
    }
  }
  
  // Update methods for dynamic elements
  updateObjectiveCollected(objectiveId) {
    const obj = this.objects.objectives.find(o => o.userData.objectiveId === objectiveId);
    if (obj) {
      obj.visible = false;
      obj.userData.collected = true;
    }
  }
  
  activateEscapeZone() {
    for (const obj of this.objects.objectives) {
      if (obj.userData.type === 'escapeZone' || obj.userData.type === 'escapeVehicle') {
        obj.visible = true;
        obj.userData.active = true;
      }
    }
  }
  
  updateLootContainer(containerId, looted) {
    const container = this.objects.lootContainers.find(c => c.userData.containerId === containerId);
    if (container) {
      container.userData.looted = looted;
      // Visual feedback - dim the container
      if (looted && container.material) {
        container.material.opacity = 0.5;
        container.material.transparent = true;
      }
    }
  }
  
  breakGlassZone(glassId) {
    const glass = this.objects.props.find(p => p.userData.glassId === glassId);
    if (glass) {
      glass.visible = false;
      glass.userData.broken = true;
    }
  }
  
  // Animate floating objectives
  updateAnimations(time) {
    for (const obj of this.objects.objectives) {
      if (obj.userData.type === 'objective' && !obj.userData.collected) {
        // Float up and down
        obj.position.y = obj.userData.baseY + Math.sin(time * 2) * 0.2;
        // Rotate
        obj.rotation.y = time;
      }
    }
    
    // Flicker barrel fires
    for (const fire of this.objects.barrelFires) {
      const light = fire.userData.light;
      if (light) {
        light.intensity = fire.userData.lightIntensity * (0.8 + Math.random() * 0.4);
      }
    }
  }
  
  // Cleanup
  dispose() {
    // Remove all objects from scene
    const removeGroup = (group) => {
      if (Array.isArray(group)) {
        group.forEach(obj => {
          this.scene.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      } else if (group) {
        this.scene.remove(group);
        if (group.geometry) group.geometry.dispose();
        if (group.material) group.material.dispose();
      }
    };
    
    removeGroup(this.objects.ground);
    removeGroup(this.objects.roads);
    removeGroup(this.objects.sidewalks);
    removeGroup(this.objects.buildings);
    removeGroup(this.objects.overpasses);
    removeGroup(this.objects.props);
    removeGroup(this.objects.barrelFires);
    removeGroup(this.objects.lootContainers);
    removeGroup(this.objects.objectives);
    removeGroup(this.objects.lights);
    
    // Dispose materials
    Object.values(this.materials).forEach(mat => mat.dispose());
  }
}

export default MapRenderer;
