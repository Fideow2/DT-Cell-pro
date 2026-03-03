/**
 * PetriDish 性能优化对比测试
 * 
 * 使用方法:
 * 1. 在浏览器控制台运行
 * 2. 比较优化前后的性能指标
 */

// 模拟原始版本的 O(n²) 攻击检测
function originalAttackDetection(bacteria) {
  const attacks = [];
  for (const b of bacteria) {
    for (const other of bacteria) {
      if (b.id === other.id) continue;
      const dist = Math.sqrt((other.x - b.x) ** 2 + (other.y - b.y) ** 2);
      if (dist < 40) {
        attacks.push({ attacker: other.id, target: b.id });
      }
    }
  }
  return attacks;
}

// 优化后的空间网格攻击检测
class SpatialGrid {
  constructor(gridSize) {
    this.cells = new Map();
    this.gridSize = gridSize;
  }

  clear() {
    this.cells.clear();
  }

  getKey(x, y) {
    const gx = Math.floor(x / this.gridSize);
    const gy = Math.floor(y / this.gridSize);
    return `${gx},${gy}`;
  }

  insert(b) {
    const key = this.getKey(b.x, b.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(b);
  }

  queryNeighbors(x, y) {
    const results = [];
    const gx = Math.floor(x / this.gridSize);
    const gy = Math.floor(y / this.gridSize);

    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      for (let iy = gy - 1; iy <= gy + 1; iy++) {
        const key = `${ix},${iy}`;
        const cell = this.cells.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }
    return results;
  }
}

function optimizedAttackDetection(bacteria) {
  const grid = new SpatialGrid(50);
  const attacks = [];
  
  // 构建网格
  for (const b of bacteria) {
    grid.insert(b);
  }
  
  // 查询邻居
  for (const b of bacteria) {
    const neighbors = grid.queryNeighbors(b.x, b.y);
    for (const other of neighbors) {
      if (b.id === other.id) continue;
      const dx = other.x - b.x;
      const dy = other.y - b.y;
      // 使用平方距离避免 sqrt
      if (dx * dx + dy * dy < 1600) { // 40^2
        attacks.push({ attacker: other.id, target: b.id });
      }
    }
  }
  return attacks;
}

// 性能测试
function runBenchmark() {
  const sizes = [10, 20, 30, 40, 50];
  const results = [];

  for (const size of sizes) {
    // 生成测试数据
    const bacteria = Array.from({ length: size }, (_, i) => ({
      id: i,
      x: Math.random() * 800,
      y: Math.random() * 600,
    }));

    // 测试原始版本
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      originalAttackDetection(bacteria);
    }
    const originalTime = performance.now() - start1;

    // 测试优化版本
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      optimizedAttackDetection(bacteria);
    }
    const optimizedTime = performance.now() - start2;

    results.push({
      size,
      original: originalTime.toFixed(2),
      optimized: optimizedTime.toFixed(2),
      speedup: (originalTime / optimizedTime).toFixed(2) + 'x',
      originalOps: bacteria.length ** 2,
      optimizedOps: '~' + (bacteria.length * 9)
    });
  }

  console.table(results);
  return results;
}

// 导出测试函数
if (typeof window !== 'undefined') {
  window.PetriDishBenchmark = { runBenchmark, originalAttackDetection, optimizedAttackDetection };
}

export { runBenchmark, originalAttackDetection, optimizedAttackDetection };
