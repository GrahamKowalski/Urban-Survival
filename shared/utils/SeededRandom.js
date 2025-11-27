// SeededRandom.js - Deterministic random number generator
// Used for procedural generation to ensure server and client generate identical maps

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    this.current = seed;
  }
  
  // Core random function using Mulberry32 algorithm
  // Fast, good distribution, deterministic
  next() {
    let t = this.current += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  // Get float in range [min, max)
  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }
  
  // Get integer in range [min, max] (inclusive)
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  
  // Get boolean with given probability
  bool(probability = 0.5) {
    return this.next() < probability;
  }
  
  // Pick random element from array
  pick(array) {
    if (!array || array.length === 0) return undefined;
    return array[Math.floor(this.next() * array.length)];
  }
  
  // Pick random element with weights
  // items: [{ item: any, weight: number }, ...]
  pickWeighted(items) {
    if (!items || items.length === 0) return undefined;
    
    const totalWeight = items.reduce((sum, i) => sum + (i.weight || 1), 0);
    let random = this.next() * totalWeight;
    
    for (const item of items) {
      random -= item.weight || 1;
      if (random <= 0) return item.item || item;
    }
    
    return items[items.length - 1].item || items[items.length - 1];
  }
  
  // Shuffle array in place (Fisher-Yates)
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  // Get normally distributed value (Box-Muller transform)
  gaussian(mean = 0, stdDev = 1) {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
  
  // Generate random point in circle
  pointInCircle(centerX, centerY, radius) {
    const angle = this.next() * Math.PI * 2;
    const r = Math.sqrt(this.next()) * radius;
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r
    };
  }
  
  // Generate random point in rectangle
  pointInRect(minX, minY, maxX, maxY) {
    return {
      x: this.float(minX, maxX),
      y: this.float(minY, maxY)
    };
  }
  
  // Generate unique seed for sub-generation
  deriveSeed(modifier) {
    return (this.seed * 31 + modifier) | 0;
  }
  
  // Fork the RNG (create independent stream)
  fork() {
    return new SeededRandom(this.next() * 2147483647);
  }
  
  // Reset to initial seed
  reset() {
    this.current = this.seed;
  }
}

// 2D Perlin Noise implementation for natural terrain/placement
class PerlinNoise {
  constructor(seed) {
    this.rng = new SeededRandom(seed);
    this.permutation = [];
    
    // Generate permutation table
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    this.rng.shuffle(this.permutation);
    
    // Duplicate for overflow
    for (let i = 0; i < 256; i++) {
      this.permutation[i + 256] = this.permutation[i];
    }
  }
  
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  lerp(a, b, t) {
    return a + t * (b - a);
  }
  
  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;
    
    return this.lerp(
      this.lerp(
        this.grad(this.permutation[A], x, y),
        this.grad(this.permutation[B], x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.permutation[A + 1], x, y - 1),
        this.grad(this.permutation[B + 1], x - 1, y - 1),
        u
      ),
      v
    );
  }
  
  // Multi-octave noise for more natural patterns
  fbm(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    return value / maxValue;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SeededRandom, PerlinNoise };
} else if (typeof window !== 'undefined') {
  window.SeededRandom = SeededRandom;
  window.PerlinNoise = PerlinNoise;
}
