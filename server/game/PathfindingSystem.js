// PathfindingSystem.js - Manages pathfinding worker and provides game API
// Handles batched pathfinding requests every 0.75 seconds

const { Worker } = require('worker_threads');
const path = require('path');

class PathfindingSystem {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.worker = null;
    this.isInitialized = false;
    
    // Request management
    this.pendingRequests = new Map();
    this.requestId = 0;
    
    // Entity paths (cached results)
    this.entityPaths = new Map(); // entityId -> { path: [], currentIndex: 0, targetPos: {x, z} }
    
    // Batch processing
    this.pathfindingInterval = 750; // 0.75 seconds in ms (45 frames at 60fps)
    this.lastPathfindingTime = 0;
    this.queuedPathRequests = []; // Requests waiting for next batch
    
    // Initialize worker
    this.initWorker();
  }
  
  initWorker() {
    try {
      this.worker = new Worker(path.join(__dirname, 'PathfindingWorker.js'));
      
      this.worker.on('message', (message) => this.handleWorkerMessage(message));
      
      this.worker.on('error', (error) => {
        console.error('[PathfindingSystem] Worker error:', error);
      });
      
      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.error('[PathfindingSystem] Worker exited with code', code);
          // Attempt to restart worker
          setTimeout(() => this.initWorker(), 1000);
        }
      });
    } catch (error) {
      console.error('[PathfindingSystem] Failed to create worker:', error);
    }
  }
  
  handleWorkerMessage(message) {
    switch (message.type) {
      case 'ready':
        // Worker is ready, send initialization data
        this.worker.postMessage({
          type: 'init',
          collisionData: this.mapManager.getCollisionData()
        });
        break;
        
      case 'init_complete':
        this.isInitialized = true;
        console.log('[PathfindingSystem] Pathfinding worker initialized');
        break;
        
      case 'path_result':
        this.handlePathResult(message.entityId, message.path);
        break;
        
      case 'paths_batch_result':
        for (const result of message.results) {
          this.handlePathResult(result.entityId, result.path);
        }
        break;
    }
  }
  
  handlePathResult(entityId, path) {
    if (path && path.length > 0) {
      this.entityPaths.set(entityId, {
        path: path,
        currentIndex: 0,
        timestamp: Date.now()
      });
    } else {
      // No path found - entity should patrol or wait
      const existing = this.entityPaths.get(entityId);
      if (existing) {
        existing.noPath = true;
      } else {
        this.entityPaths.set(entityId, {
          path: [],
          currentIndex: 0,
          noPath: true,
          timestamp: Date.now()
        });
      }
    }
  }
  
  // Request a path for an entity
  requestPath(entityId, start, goal) {
    if (!this.isInitialized) return;
    
    // Queue request for next batch
    this.queuedPathRequests.push({
      entityId,
      start: { x: start.x, z: start.z },
      goal: { x: goal.x, z: goal.z }
    });
  }
  
  // Process queued path requests (called from game update loop)
  update(currentTime) {
    if (!this.isInitialized) return;
    
    // Check if it's time to process pathfinding
    if (currentTime - this.lastPathfindingTime >= this.pathfindingInterval) {
      this.processQueuedRequests();
      this.lastPathfindingTime = currentTime;
    }
  }
  
  processQueuedRequests() {
    if (this.queuedPathRequests.length === 0) return;
    
    // Send batch request to worker
    this.worker.postMessage({
      type: 'find_paths_batch',
      requestId: this.requestId++,
      requests: this.queuedPathRequests
    });
    
    // Clear queue
    this.queuedPathRequests = [];
  }
  
  // Get next waypoint for an entity to move towards
  getNextWaypoint(entityId, currentPos, threshold = 1.5) {
    const pathData = this.entityPaths.get(entityId);
    
    if (!pathData || !pathData.path || pathData.path.length === 0) {
      return null;
    }
    
    // Check if we've reached current waypoint
    const currentWaypoint = pathData.path[pathData.currentIndex];
    if (!currentWaypoint) {
      return null;
    }
    
    const dx = currentWaypoint.x - currentPos.x;
    const dz = currentWaypoint.z - currentPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < threshold) {
      // Move to next waypoint
      pathData.currentIndex++;
      
      // Check if path complete
      if (pathData.currentIndex >= pathData.path.length) {
        return null; // Path complete
      }
      
      return pathData.path[pathData.currentIndex];
    }
    
    return currentWaypoint;
  }
  
  // Get direction to move for an entity
  getMoveDirection(entityId, currentPos) {
    const waypoint = this.getNextWaypoint(entityId, currentPos);
    
    if (!waypoint) {
      return null;
    }
    
    const dx = waypoint.x - currentPos.x;
    const dz = waypoint.z - currentPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < 0.1) {
      return null;
    }
    
    return {
      x: dx / dist,
      z: dz / dist,
      distance: dist
    };
  }
  
  // Check if entity has a valid path
  hasPath(entityId) {
    const pathData = this.entityPaths.get(entityId);
    return pathData && pathData.path && pathData.path.length > 0 && !pathData.noPath;
  }
  
  // Check if pathfinding failed for entity
  pathFailed(entityId) {
    const pathData = this.entityPaths.get(entityId);
    return pathData && pathData.noPath;
  }
  
  // Clear path for an entity
  clearPath(entityId) {
    this.entityPaths.delete(entityId);
  }
  
  // Get remaining path length for an entity
  getRemainingPathLength(entityId, currentPos) {
    const pathData = this.entityPaths.get(entityId);
    
    if (!pathData || !pathData.path || pathData.currentIndex >= pathData.path.length) {
      return 0;
    }
    
    let totalDist = 0;
    let prevPos = currentPos;
    
    for (let i = pathData.currentIndex; i < pathData.path.length; i++) {
      const waypoint = pathData.path[i];
      const dx = waypoint.x - prevPos.x;
      const dz = waypoint.z - prevPos.z;
      totalDist += Math.sqrt(dx * dx + dz * dz);
      prevPos = waypoint;
    }
    
    return totalDist;
  }
  
  // Shutdown the worker
  shutdown() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

module.exports = PathfindingSystem;
