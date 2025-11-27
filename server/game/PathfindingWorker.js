// PathfindingWorker.js - A* pathfinding implementation running in a worker thread
// Handles pathfinding requests from the main game thread

const { parentPort, workerData } = require('worker_threads');

// A* Pathfinding implementation
class AStar {
  constructor(grid, width, height, resolution, bounds) {
    this.grid = grid;
    this.width = width;
    this.height = height;
    this.resolution = resolution;
    this.bounds = bounds;
    
    // Pre-allocate arrays for performance
    this.openSet = [];
    this.closedSet = new Set();
    this.gScore = new Map();
    this.fScore = new Map();
    this.cameFrom = new Map();
  }
  
  // Convert world coordinates to grid coordinates
  worldToGrid(worldX, worldZ) {
    return {
      x: Math.floor((worldX - this.bounds.minX) / this.resolution),
      z: Math.floor((worldZ - this.bounds.minZ) / this.resolution)
    };
  }
  
  // Convert grid coordinates to world coordinates
  gridToWorld(gridX, gridZ) {
    return {
      x: this.bounds.minX + (gridX + 0.5) * this.resolution,
      z: this.bounds.minZ + (gridZ + 0.5) * this.resolution
    };
  }
  
  // Check if grid cell is walkable
  isWalkable(gridX, gridZ) {
    if (gridX < 0 || gridX >= this.width || gridZ < 0 || gridZ >= this.height) {
      return false;
    }
    return this.grid[gridZ * this.width + gridX] === 0;
  }
  
  // Get cell key for hash maps
  cellKey(x, z) {
    return `${x},${z}`;
  }
  
  // Heuristic function (Euclidean distance)
  heuristic(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    return Math.sqrt(dx * dx + dz * dz);
  }
  
  // Get neighbors of a cell (8-directional)
  getNeighbors(x, z) {
    const neighbors = [];
    const directions = [
      { dx: 0, dz: -1, cost: 1 },      // North
      { dx: 1, dz: 0, cost: 1 },       // East
      { dx: 0, dz: 1, cost: 1 },       // South
      { dx: -1, dz: 0, cost: 1 },      // West
      { dx: 1, dz: -1, cost: 1.414 },  // NE
      { dx: 1, dz: 1, cost: 1.414 },   // SE
      { dx: -1, dz: 1, cost: 1.414 },  // SW
      { dx: -1, dz: -1, cost: 1.414 }  // NW
    ];
    
    for (const dir of directions) {
      const nx = x + dir.dx;
      const nz = z + dir.dz;
      
      if (this.isWalkable(nx, nz)) {
        // For diagonal movement, check that we can actually move diagonally
        // (not cutting through corners)
        if (dir.dx !== 0 && dir.dz !== 0) {
          if (!this.isWalkable(x + dir.dx, z) || !this.isWalkable(x, z + dir.dz)) {
            continue; // Can't cut corner
          }
        }
        
        neighbors.push({ x: nx, z: nz, cost: dir.cost });
      }
    }
    
    return neighbors;
  }
  
  // Find path from start to goal
  findPath(startWorld, goalWorld, maxIterations = 2000) {
    // Reset state
    this.openSet = [];
    this.closedSet.clear();
    this.gScore.clear();
    this.fScore.clear();
    this.cameFrom.clear();
    
    // Convert to grid coordinates
    const start = this.worldToGrid(startWorld.x, startWorld.z);
    const goal = this.worldToGrid(goalWorld.x, goalWorld.z);
    
    // Check if start and goal are valid
    if (!this.isWalkable(start.x, start.z)) {
      // Try to find nearby walkable cell for start
      const nearStart = this.findNearbyWalkable(start.x, start.z);
      if (!nearStart) return null;
      start.x = nearStart.x;
      start.z = nearStart.z;
    }
    
    if (!this.isWalkable(goal.x, goal.z)) {
      // Try to find nearby walkable cell for goal
      const nearGoal = this.findNearbyWalkable(goal.x, goal.z);
      if (!nearGoal) return null;
      goal.x = nearGoal.x;
      goal.z = nearGoal.z;
    }
    
    const startKey = this.cellKey(start.x, start.z);
    
    this.gScore.set(startKey, 0);
    this.fScore.set(startKey, this.heuristic(start.x, start.z, goal.x, goal.z));
    this.openSet.push({ x: start.x, z: start.z, f: this.fScore.get(startKey) });
    
    let iterations = 0;
    
    while (this.openSet.length > 0 && iterations < maxIterations) {
      iterations++;
      
      // Get node with lowest fScore
      this.openSet.sort((a, b) => a.f - b.f);
      const current = this.openSet.shift();
      const currentKey = this.cellKey(current.x, current.z);
      
      // Check if reached goal
      if (current.x === goal.x && current.z === goal.z) {
        return this.reconstructPath(current, start);
      }
      
      this.closedSet.add(currentKey);
      
      // Check neighbors
      for (const neighbor of this.getNeighbors(current.x, current.z)) {
        const neighborKey = this.cellKey(neighbor.x, neighbor.z);
        
        if (this.closedSet.has(neighborKey)) {
          continue;
        }
        
        const tentativeG = this.gScore.get(currentKey) + neighbor.cost;
        
        const inOpenSet = this.openSet.some(n => n.x === neighbor.x && n.z === neighbor.z);
        
        if (!inOpenSet || tentativeG < (this.gScore.get(neighborKey) || Infinity)) {
          this.cameFrom.set(neighborKey, current);
          this.gScore.set(neighborKey, tentativeG);
          const f = tentativeG + this.heuristic(neighbor.x, neighbor.z, goal.x, goal.z);
          this.fScore.set(neighborKey, f);
          
          if (!inOpenSet) {
            this.openSet.push({ x: neighbor.x, z: neighbor.z, f });
          }
        }
      }
    }
    
    // No path found
    return null;
  }
  
  // Reconstruct path from goal to start
  reconstructPath(goal, start) {
    const path = [];
    let current = goal;
    
    while (current.x !== start.x || current.z !== start.z) {
      const worldPos = this.gridToWorld(current.x, current.z);
      path.unshift(worldPos);
      
      const currentKey = this.cellKey(current.x, current.z);
      current = this.cameFrom.get(currentKey);
      
      if (!current) break;
    }
    
    // Simplify path - remove collinear points
    return this.simplifyPath(path);
  }
  
  // Simplify path by removing unnecessary waypoints
  simplifyPath(path) {
    if (path.length <= 2) return path;
    
    const simplified = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      // Check if current point is necessary (direction change)
      const dir1 = { x: curr.x - prev.x, z: curr.z - prev.z };
      const dir2 = { x: next.x - curr.x, z: next.z - curr.z };
      
      // Normalize
      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.z * dir1.z);
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.z * dir2.z);
      
      if (len1 > 0 && len2 > 0) {
        dir1.x /= len1; dir1.z /= len1;
        dir2.x /= len2; dir2.z /= len2;
        
        const dot = dir1.x * dir2.x + dir1.z * dir2.z;
        
        // If direction changed significantly, keep this point
        if (dot < 0.95) {
          simplified.push(curr);
        }
      }
    }
    
    simplified.push(path[path.length - 1]);
    return simplified;
  }
  
  // Find nearby walkable cell
  findNearbyWalkable(x, z, maxRadius = 10) {
    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r || Math.abs(dz) === r) {
            const nx = x + dx;
            const nz = z + dz;
            if (this.isWalkable(nx, nz)) {
              return { x: nx, z: nz };
            }
          }
        }
      }
    }
    return null;
  }
}

// Worker state
let astar = null;
let pendingRequests = new Map();
let requestId = 0;

// Initialize with collision data
function initialize(collisionData) {
  astar = new AStar(
    collisionData.grid,
    collisionData.width,
    collisionData.height,
    collisionData.resolution,
    collisionData.bounds
  );
  console.log('[PathfindingWorker] Initialized with grid', collisionData.width, 'x', collisionData.height);
}

// Handle messages from main thread
parentPort.on('message', (message) => {
  switch (message.type) {
    case 'init':
      initialize(message.collisionData);
      parentPort.postMessage({ type: 'init_complete' });
      break;
      
    case 'find_path':
      if (!astar) {
        parentPort.postMessage({
          type: 'path_result',
          requestId: message.requestId,
          entityId: message.entityId,
          path: null,
          error: 'Pathfinder not initialized'
        });
        return;
      }
      
      const path = astar.findPath(message.start, message.goal);
      
      parentPort.postMessage({
        type: 'path_result',
        requestId: message.requestId,
        entityId: message.entityId,
        path: path
      });
      break;
      
    case 'find_paths_batch':
      // Process multiple pathfinding requests at once
      if (!astar) {
        parentPort.postMessage({
          type: 'paths_batch_result',
          requestId: message.requestId,
          results: message.requests.map(r => ({ entityId: r.entityId, path: null }))
        });
        return;
      }
      
      const results = message.requests.map(request => {
        const path = astar.findPath(request.start, request.goal);
        return {
          entityId: request.entityId,
          path: path
        };
      });
      
      parentPort.postMessage({
        type: 'paths_batch_result',
        requestId: message.requestId,
        results: results
      });
      break;
      
    case 'update_grid':
      // Update collision grid (e.g., when doors open/close)
      if (astar) {
        astar.grid = message.grid;
      }
      break;
  }
});

// Initial setup message
parentPort.postMessage({ type: 'ready' });
