// Spatial Grid for efficient collision detection
// Reduces O(n²) complexity to O(n) for nearby queries

export interface SpatialGridItem {
  x: number;
  y: number;
}

export class SpatialGrid<T extends SpatialGridItem> {
  private cells: Map<string, string[]> = new Map();
  private cellSize: number;
  private itemMap: Map<string, T> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(id: string, item: T): void {
    const key = this.getCellKey(item.x, item.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)!.push(id);
    this.itemMap.set(id, item);
  }

  remove(id: string): void {
    const item = this.itemMap.get(id);
    if (!item) return;
    
    const key = this.getCellKey(item.x, item.y);
    const cell = this.cells.get(key);
    if (cell) {
      const idx = cell.indexOf(id);
      if (idx > -1) cell.splice(idx, 1);
    }
    this.itemMap.delete(id);
  }

  update(id: string, item: T): void {
    this.remove(id);
    this.insert(id, item);
  }

  // Query items within range (checks neighboring cells)
  query(x: number, y: number, range: number): string[] {
    const results: string[] = [];
    const cellRange = Math.ceil(range / this.cellSize);
    const centerCX = Math.floor(x / this.cellSize);
    const centerCY = Math.floor(y / this.cellSize);

    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        const key = `${centerCX + dx},${centerCY + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }
    return results;
  }

  // Query with distance filtering (returns items within circular range)
  queryInRange(x: number, y: number, range: number): Array<{ id: string; item: T; dist: number }> {
    const rangeSq = range * range;
    const candidates = this.query(x, y, range);
    
    return candidates
      .map(id => {
        const item = this.itemMap.get(id)!;
        const dx = item.x - x;
        const dy = item.y - y;
        const distSq = dx * dx + dy * dy;
        return { id, item, distSq };
      })
      .filter(({ distSq }) => distSq <= rangeSq)
      .map(({ id, item, distSq }) => ({ id, item, dist: Math.sqrt(distSq) }));
  }

  clear(): void {
    this.cells.clear();
    this.itemMap.clear();
  }

  get size(): number {
    return this.itemMap.size;
  }
}

// Object pool for particles to reduce GC pressure
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;

  constructor(createFn: () => T, resetFn: (item: T) => void, initialSize = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  acquire(): T {
    return this.pool.pop() || this.createFn();
  }

  release(item: T): void {
    this.resetFn(item);
    this.pool.push(item);
  }

  releaseMany(items: T[]): void {
    for (const item of items) {
      this.resetFn(item);
      this.pool.push(item);
    }
  }

  get available(): number {
    return this.pool.length;
  }
}

// Performance monitoring utility
export interface PerfStats {
  frameTime: number[];
  collisionChecks: number;
  activeParticles: number;
  lastReportTime: number;
}

export function createPerfStats(): PerfStats {
  return {
    frameTime: [],
    collisionChecks: 0,
    activeParticles: 0,
    lastReportTime: performance.now(),
  };
}

export function recordFrameTime(stats: PerfStats, startTime: number): void {
  const elapsed = performance.now() - startTime;
  stats.frameTime.push(elapsed);
  
  // Keep last 60 frames
  if (stats.frameTime.length > 60) {
    stats.frameTime.shift();
  }
}

export function getAverageFrameTime(stats: PerfStats): number {
  if (stats.frameTime.length === 0) return 0;
  return stats.frameTime.reduce((a, b) => a + b, 0) / stats.frameTime.length;
}

export function shouldReport(stats: PerfStats): boolean {
  const now = performance.now();
  if (now - stats.lastReportTime > 1000) { // Report every second
    stats.lastReportTime = now;
    return true;
  }
  return false;
}

export function logPerfReport(stats: PerfStats): void {
  const avgFrameTime = getAverageFrameTime(stats);
  const estimatedFPS = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0;
  
  console.table({
    'Avg Frame Time (ms)': avgFrameTime.toFixed(2),
    'Estimated FPS': estimatedFPS,
    'Collision Checks': stats.collisionChecks,
    'Active Particles': stats.activeParticles,
  });
}
