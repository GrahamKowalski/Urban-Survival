// CollisionSystem.js - Handles collision detection and resolution with wall sliding
// Server-authoritative collision system

class CollisionSystem {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.collisionData = mapManager.getCollisionData();
    
    // Entity radius for collision (approximate)
    this.playerRadius = 0.4;
    this.enemyRadius = 0.5;
    
    // Wall slide parameters
    this.slideSmoothing = 0.8; // How smoothly to slide along walls
  }
  
  // Check if a position is walkable
  isWalkable(x, z) {
    return !this.mapManager.isBlocked(x, z);
  }
  
  // Check if a circle at position is walkable (for entities with radius)
  isCircleWalkable(x, z, radius) {
    // Check center and 8 points around the circle
    if (!this.isWalkable(x, z)) return false;
    
    const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
    for (const angle of angles) {
      const checkX = x + Math.cos(angle) * radius;
      const checkZ = z + Math.sin(angle) * radius;
      if (!this.isWalkable(checkX, checkZ)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Move an entity with collision and wall sliding
  // Returns the actual new position after collision resolution
  moveWithCollision(currentX, currentZ, desiredX, desiredZ, radius) {
    // If no movement, return current position
    const dx = desiredX - currentX;
    const dz = desiredZ - currentZ;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
      return { x: currentX, z: currentZ };
    }
    
    // Try full movement first
    if (this.isCircleWalkable(desiredX, desiredZ, radius)) {
      return { x: desiredX, z: desiredZ };
    }
    
    // Wall sliding - try moving on each axis separately
    let newX = currentX;
    let newZ = currentZ;
    
    // Try X movement
    if (Math.abs(dx) > 0.001) {
      const testX = currentX + dx;
      if (this.isCircleWalkable(testX, currentZ, radius)) {
        newX = testX;
      } else {
        // Slide along wall - try smaller movements
        const slideAmount = dx * this.slideSmoothing;
        for (let i = 1; i <= 4; i++) {
          const tryX = currentX + slideAmount * (1 - i * 0.2);
          if (this.isCircleWalkable(tryX, currentZ, radius)) {
            newX = tryX;
            break;
          }
        }
      }
    }
    
    // Try Z movement
    if (Math.abs(dz) > 0.001) {
      const testZ = currentZ + dz;
      if (this.isCircleWalkable(newX, testZ, radius)) {
        newZ = testZ;
      } else {
        // Slide along wall - try smaller movements
        const slideAmount = dz * this.slideSmoothing;
        for (let i = 1; i <= 4; i++) {
          const tryZ = currentZ + slideAmount * (1 - i * 0.2);
          if (this.isCircleWalkable(newX, tryZ, radius)) {
            newZ = tryZ;
            break;
          }
        }
      }
    }
    
    // Final check - if still blocked, try diagonal slide
    if (!this.isCircleWalkable(newX, newZ, radius)) {
      // Try finding any valid nearby position
      const directions = [
        { x: 1, z: 0 }, { x: -1, z: 0 },
        { x: 0, z: 1 }, { x: 0, z: -1 },
        { x: 0.7, z: 0.7 }, { x: -0.7, z: 0.7 },
        { x: 0.7, z: -0.7 }, { x: -0.7, z: -0.7 }
      ];
      
      const moveLen = Math.sqrt(dx * dx + dz * dz) * 0.5;
      
      for (const dir of directions) {
        const tryX = currentX + dir.x * moveLen;
        const tryZ = currentZ + dir.z * moveLen;
        if (this.isCircleWalkable(tryX, tryZ, radius)) {
          return { x: tryX, z: tryZ };
        }
      }
      
      // If all else fails, stay at current position
      return { x: currentX, z: currentZ };
    }
    
    return { x: newX, z: newZ };
  }
  
  // Move player with collision - applies player-specific radius
  movePlayer(currentPos, desiredPos) {
    const result = this.moveWithCollision(
      currentPos.x, currentPos.z,
      desiredPos.x, desiredPos.z,
      this.playerRadius
    );
    
    return {
      x: result.x,
      y: currentPos.y, // Preserve Y (height)
      z: result.z
    };
  }
  
  // Move enemy with collision - applies enemy-specific radius
  moveEnemy(currentPos, desiredPos) {
    const result = this.moveWithCollision(
      currentPos.x, currentPos.z,
      desiredPos.x, desiredPos.z,
      this.enemyRadius
    );
    
    return {
      x: result.x,
      y: currentPos.y, // Preserve Y
      z: result.z
    };
  }
  
  // Check line of sight between two points
  hasLineOfSight(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < 0.1) return true;
    
    // Step along the line and check for obstacles
    const steps = Math.ceil(dist / this.collisionData.resolution);
    const stepX = dx / steps;
    const stepZ = dz / steps;
    
    for (let i = 1; i < steps; i++) {
      const checkX = x1 + stepX * i;
      const checkZ = z1 + stepZ * i;
      
      if (!this.isWalkable(checkX, checkZ)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Find nearest walkable position to a point
  findNearestWalkable(x, z, maxSearchRadius = 10) {
    if (this.isWalkable(x, z)) {
      return { x, z };
    }
    
    // Spiral outward search
    const step = this.collisionData.resolution;
    
    for (let radius = step; radius <= maxSearchRadius; radius += step) {
      // Check points in a circle at this radius
      const circumference = 2 * Math.PI * radius;
      const pointCount = Math.max(8, Math.ceil(circumference / step));
      
      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * 2 * Math.PI;
        const checkX = x + Math.cos(angle) * radius;
        const checkZ = z + Math.sin(angle) * radius;
        
        if (this.isWalkable(checkX, checkZ)) {
          return { x: checkX, z: checkZ };
        }
      }
    }
    
    // No walkable position found
    return null;
  }
  
  // Check if entity is inside a building interior
  isInInterior(x, z) {
    for (const interior of this.mapManager.data.interiors) {
      if (x >= interior.bounds.minX && x <= interior.bounds.maxX &&
          z >= interior.bounds.minZ && z <= interior.bounds.maxZ) {
        return interior;
      }
    }
    return null;
  }
  
  // Check if position is near a barrel fire (for warmth)
  getNearbyBarrelFire(x, z) {
    for (const fire of this.mapManager.data.barrelFires) {
      const dx = fire.position.x - x;
      const dz = fire.position.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist <= fire.warmthRadius) {
        return {
          fire,
          distance: dist,
          warmthFactor: 1 - (dist / fire.warmthRadius) // Closer = warmer
        };
      }
    }
    return null;
  }
  
  // Clamp position to map bounds
  clampToMap(x, z) {
    const bounds = this.mapManager.area.bounds;
    return {
      x: Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, x)),
      z: Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, z))
    };
  }
  
  // Get all glass zones at a position
  getGlassZoneAt(x, z) {
    for (const prop of this.mapManager.data.props) {
      if (prop.type === 'glass_zone' && !prop.broken) {
        const dx = prop.position.x - x;
        const dz = prop.position.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist <= prop.radius) {
          return prop;
        }
      }
    }
    return null;
  }
}

module.exports = CollisionSystem;
