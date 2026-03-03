import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cell, { type CellDNA, calculateStats } from './Cell';
import './PetriDish.css';

interface Bacterium {
  id: string;
  dna: CellDNA;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  energy: number;
  health: number;
  stats: ReturnType<typeof calculateStats>;
  // 缓存网格坐标，避免重复计算
  gridX: number;
  gridY: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
  energy: number;
}

interface PetriDishProps {
  onBack: () => void;
}

// 性能优化常量
const MAX_BACTERIA = 50;
const FOOD_SPAWN_RATE = 0.05;
const MAX_FOOD = 30;
const ENERGY_LOSS_PER_FRAME = 0.08;
const REPRODUCTION_ENERGY = 150;
const MUTATION_RATE = 0.2;
const DETECTION_RANGE = 150;
const DETECTION_RANGE_SQ = DETECTION_RANGE * DETECTION_RANGE; // 平方距离，避免 sqrt
const GRID_SIZE = 50;
const ATTACK_RANGE = 40;
const ATTACK_RANGE_SQ = ATTACK_RANGE * ATTACK_RANGE; // 平方距离

// 空间网格类 - 用于高效碰撞检测
class SpatialGrid {
  private cells: Map<string, Bacterium[]> = new Map();
  private gridSize: number;

  constructor(gridSize: number) {
    this.gridSize = gridSize;
  }

  clear() {
    this.cells.clear();
  }

  getKey(x: number, y: number): string {
    const gx = Math.floor(x / this.gridSize);
    const gy = Math.floor(y / this.gridSize);
    return `${gx},${gy}`;
  }

  insert(b: Bacterium) {
    const key = this.getKey(b.x, b.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)!.push(b);
  }

  // 获取指定范围内的所有细菌
  queryRange(x: number, y: number, range: number): Bacterium[] {
    const results: Bacterium[] = [];
    const rangeSq = range * range;
    const gx = Math.floor(x / this.gridSize);
    const gy = Math.floor(y / this.gridSize);
    const cellRange = Math.ceil(range / this.gridSize);

    for (let ix = gx - cellRange; ix <= gx + cellRange; ix++) {
      for (let iy = gy - cellRange; iy <= gy + cellRange; iy++) {
        const key = `${ix},${iy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const b of cell) {
            const dx = b.x - x;
            const dy = b.y - y;
            if (dx * dx + dy * dy <= rangeSq) {
              results.push(b);
            }
          }
        }
      }
    }
    return results;
  }

  // 获取相邻网格中的细菌（用于攻击检测）
  queryNeighbors(x: number, y: number): Bacterium[] {
    const results: Bacterium[] = [];
    const gx = Math.floor(x / this.gridSize);
    const gy = Math.floor(y / this.gridSize);

    // 只检查相邻的 9 个网格
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

const PetriDish: React.FC<PetriDishProps> = ({ onBack }) => {
  // 使用 ref 存储游戏状态，避免每帧触发 React 重渲染
  const gameStateRef = useRef<{ bacteria: Bacterium[]; food: Food[] }>({ 
    bacteria: [], 
    food: [] 
  });
  const spatialGridRef = useRef(new SpatialGrid(GRID_SIZE));
  
  // 仅用于触发渲染的计数器
  const [renderTick, setRenderTick] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Bacterium | null>(null);
  const [dishDimensions, setDishDimensions] = useState({ width: 800, height: 600 });
  
  const DISH_WIDTH = dishDimensions.width;
  const DISH_HEIGHT = dishDimensions.height;
  
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);

  // 计算 dish 大小
  useEffect(() => {
    const updateDimensions = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const availableHeight = vh * 0.88;
      const availableWidth = vw * 0.98;
      
      let width = availableWidth;
      let height = availableWidth * 0.75;
      
      if (height > availableHeight) {
        height = availableHeight;
        width = availableHeight * 1.33;
      }
      
      setDishDimensions({ 
        width: Math.floor(width), 
        height: Math.floor(height) 
      });
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const createBacterium = useCallback((dna: CellDNA, x: number, y: number): Bacterium => {
    const stats = calculateStats(dna, []);
    return {
      id: Math.random().toString(36).substr(2, 9),
      dna,
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      ax: 0,
      ay: 0,
      energy: 100,
      health: 100,
      stats,
      gridX: Math.floor(x / GRID_SIZE),
      gridY: Math.floor(y / GRID_SIZE),
    };
  }, []);

  const mutateDNA = useCallback((dna: CellDNA): CellDNA => {
    const newDna = { ...dna, seed: Math.random().toString(36).substr(2, 9) };
    const keys: (keyof CellDNA)[] = [
      'colorHue', 'size', 'eccentricity', 'eyeSize', 'eyeDistance', 
      'mouthCurve', 'mouthWidth', 'tailLength', 'tailWaviness'
    ];

    keys.forEach(key => {
      if (Math.random() < MUTATION_RATE) {
        if (key === 'colorHue') {
          (newDna as any)[key] = ((newDna[key] as number) + (Math.random() - 0.5) * 120 + 360) % 360;
        } else if (key !== 'seed') {
          const val = newDna[key] as number;
          let min = 0.5, max = 2.0;
          if (key === 'tailLength') max = 3.0;
          if (key === 'tailWaviness') { min = 0; max = 5.0; }
          if (key === 'mouthCurve') { min = -50; max = 50; }
          
          (newDna as any)[key] = Math.max(min, Math.min(max, val + (Math.random() - 0.5) * 0.5));
        }
      }
    });
    return newDna;
  }, []);

  // 初始化
  useEffect(() => {
    const initialDNA: CellDNA = {
      colorHue: Math.random() * 360,
      size: 0.8,
      eccentricity: 1.2,
      eyeSize: 1,
      eyeDistance: 1,
      mouthCurve: 0,
      mouthWidth: 1,
      tailLength: 1,
      tailWaviness: 0.5,
      seed: 'initial',
    };
    gameStateRef.current = {
      bacteria: [createBacterium(initialDNA, dishDimensions.width / 2, dishDimensions.height / 2)],
      food: []
    };
    setRenderTick(t => t + 1);
  }, [createBacterium, dishDimensions]);

  // 游戏主循环
  const update = useCallback((time: number) => {
    const deltaTime = time - lastTimeRef.current;
    
    // 限制更新频率为 60fps
    if (deltaTime < 16.67) {
      requestRef.current = requestAnimationFrame(update);
      return;
    }
    
    lastTimeRef.current = time;
    
    // 如果冷冻模式开启，只渲染不更新
    if (isFrozen) {
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const state = gameStateRef.current;
    const nextBacteria: Bacterium[] = [];
    const nextFood = state.food;

    // 1. 构建食物空间网格
    const foodGrid: Record<string, Food[]> = {};
    for (let i = nextFood.length - 1; i >= 0; i--) {
      const f = nextFood[i];
      const gx = Math.floor(f.x / GRID_SIZE);
      const gy = Math.floor(f.y / GRID_SIZE);
      const key = `${gx},${gy}`;
      if (!foodGrid[key]) foodGrid[key] = [];
      foodGrid[key].push(f);
    }

    // 2. 重建细菌空间网格
    spatialGridRef.current.clear();
    for (const b of state.bacteria) {
      spatialGridRef.current.insert(b);
    }

    // 3. 更新细菌
    for (const b of state.bacteria) {
      let { x, y, vx, vy, ax, ay, energy, health } = b;

      // 搜索附近食物 - 使用空间网格
      let closestFood: Food | null = null;
      let minDistSq = DETECTION_RANGE_SQ;

      const bgx = Math.floor(x / GRID_SIZE);
      const bgy = Math.floor(y / GRID_SIZE);
      const range = Math.ceil(DETECTION_RANGE / GRID_SIZE);

      for (let ix = bgx - range; ix <= bgx + range; ix++) {
        for (let iy = bgy - range; iy <= bgy + range; iy++) {
          const cellFood = foodGrid[`${ix},${iy}`];
          if (cellFood) {
            for (const f of cellFood) {
              const dx = f.x - x;
              const dy = f.y - y;
              const distSq = dx * dx + dy * dy;
              if (distSq < minDistSq) {
                minDistSq = distSq;
                closestFood = f;
              }
            }
          }
        }
      }

      // 转向食物
      let nax = ax;
      let nay = ay;

      if (closestFood) {
        const angle = Math.atan2(closestFood.y - y, closestFood.x - x);
        const force = 0.2 * (b.stats.reaction / 50);
        nax += Math.cos(angle) * force;
        nay += Math.sin(angle) * force;
      } else {
        // 随机漫游
        nax += (Math.random() - 0.5) * 0.15;
        nay += (Math.random() - 0.5) * 0.15;
      }
      
      // 加速度阻尼
      nax *= 0.85;
      nay *= 0.85;

      // 更新速度
      vx += nax;
      vy += nay;

      // 速度摩擦
      vx *= 0.99;
      vy *= 0.99;

      // 速度限制
      const currentSpeedSq = vx * vx + vy * vy;
      const maxAllowedSpeed = (b.stats.speed / 30); 
      const maxAllowedSpeedSq = maxAllowedSpeed * maxAllowedSpeed;
      
      if (currentSpeedSq > maxAllowedSpeedSq) {
        const scale = maxAllowedSpeed / Math.sqrt(currentSpeedSq);
        vx *= scale;
        vy *= scale;
      }

      // 移动
      let nx = x + vx;
      let ny = y + vy;

      // 边界反弹
      if (nx < 0 || nx > DISH_WIDTH) {
        vx *= -0.5;
        nax *= -1;
      }
      if (ny < 0 || ny > DISH_HEIGHT) {
        vy *= -0.5;
        nay *= -1;
      }
      nx = Math.max(0, Math.min(DISH_WIDTH, nx));
      ny = Math.max(0, Math.min(DISH_HEIGHT, ny));

      // 能量和健康损失
      energy -= ENERGY_LOSS_PER_FRAME * b.dna.size;

      // 饥饿：能量为 0 时损失健康
      if (energy <= 0) {
        energy = 0;
        health -= 0.5 * b.dna.size; 
      }

      if (health <= 0) continue; // 死亡

      // 吃食物 - 使用平方距离比较
      const eatRangeSq = (20 * b.dna.size) ** 2;
      let ateFood = false;
      for (let i = nextFood.length - 1; i >= 0; i--) {
        const f = nextFood[i];
        const dx = f.x - nx;
        const dy = f.y - ny;
        if (dx * dx + dy * dy < eatRangeSq) {
          energy += f.energy;
          health = Math.min(100, health + 10);
          nextFood.splice(i, 1);
          ateFood = true;
          break;
        }
      }

      // 攻击检测 - 使用空间网格优化，O(n²) -> O(n)
      const neighbors = spatialGridRef.current.queryNeighbors(nx, ny);
      for (const other of neighbors) {
        if (b.id === other.id) continue;
        
        const dx = other.x - nx;
        const dy = other.y - ny;
        const distSq = dx * dx + dy * dy;
        
        // 使用平方距离比较，避免 sqrt
        const attackRange = ATTACK_RANGE * b.dna.size;
        if (distSq < attackRange * attackRange) {
          const colorDiff = Math.abs(b.dna.colorHue - other.dna.colorHue);
          const isEnemy = Math.min(colorDiff, 360 - colorDiff) > 45;

          if (isEnemy) {
            // 被攻击
            const damage = (other.stats.attack / b.stats.defense) * 0.1;
            health -= damage;
            // 击退效果
            const angle = Math.atan2(ny - other.y, nx - other.x);
            vx += Math.cos(angle) * 0.2;
            vy += Math.sin(angle) * 0.2;
          }
        }
      }

      if (health <= 0) continue; // 死亡

      // 繁殖
      if (energy >= REPRODUCTION_ENERGY && nextBacteria.length + state.bacteria.length < MAX_BACTERIA) {
        energy /= 2;
        const childDna = mutateDNA(b.dna);
        nextBacteria.push(createBacterium(childDna, nx + (Math.random() - 0.5) * 20, ny + (Math.random() - 0.5) * 20));
      }

      nextBacteria.push({ 
        ...b, 
        x: nx, 
        y: ny, 
        vx, 
        vy, 
        ax: nax, 
        ay: nay, 
        energy, 
        health,
        gridX: Math.floor(nx / GRID_SIZE),
        gridY: Math.floor(ny / GRID_SIZE),
      });
    }

    // 生成食物
    if (nextFood.length < MAX_FOOD && Math.random() < FOOD_SPAWN_RATE) {
      nextFood.push({
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * DISH_WIDTH,
        y: Math.random() * DISH_HEIGHT,
        energy: 40,
      });
    }

    // 更新状态
    gameStateRef.current = { bacteria: nextBacteria, food: nextFood };
    
    // 每 2 帧触发一次渲染（30fps 渲染）
    frameCountRef.current++;
    if (frameCountRef.current % 2 === 0) {
      setRenderTick(t => t + 1);
    }

    requestRef.current = requestAnimationFrame(update);
  }, [createBacterium, mutateDNA, isFrozen, DISH_WIDTH, DISH_HEIGHT]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  const handleCellClick = (bacterium: Bacterium) => {
    if (isFrozen) {
      setSelectedCell(bacterium);
    }
  };

  const handleDeleteCell = () => {
    if (selectedCell) {
      gameStateRef.current.bacteria = gameStateRef.current.bacteria.filter(b => b.id !== selectedCell.id);
      setSelectedCell(null);
      setRenderTick(t => t + 1);
    }
  };

  // 使用 ref 中的数据渲染
  const { bacteria, food } = gameStateRef.current;

  return (
    <div className="petri-dish-container">
      <div className="petri-dish-header">
        <button className="dish-back-btn" onClick={onBack}>← 返回菜单</button>
        <h1>培养皿模式 (优化版)</h1>
        <div className="stats">
          数量: {bacteria.length} | 食物: {food.length}
        </div>
        <button 
          className="freeze-btn" 
          onClick={() => {
            setIsFrozen(!isFrozen);
            if (!isFrozen) {
              setSelectedCell(null);
            }
          }}
          style={{ 
            backgroundColor: isFrozen ? '#10b981' : '#94a3b8',
            color: 'white',
          }}
        >
          {isFrozen ? '❄️ 已冷冻' : '▶️ 运行中'}
        </button>
      </div>
      <div className="dish-viewport" style={{ 
        width: `${DISH_WIDTH}px`, 
        height: `${DISH_HEIGHT}px`,
      }}>
        {food.map(f => (
          <div 
            key={f.id} 
            className="food" 
            style={{ left: f.x, top: f.y }}
          />
        ))}
        {bacteria.map(b => {
          const flipX = b.vx < 0;
          const rotation = (flipX ? Math.atan2(b.vy, -b.vx) : Math.atan2(b.vy, b.vx)) * 180 / Math.PI;
          
          return (
            <div 
              key={b.id} 
              className="bacterium-wrapper" 
              onClick={() => handleCellClick(b)}
              style={{ 
                left: b.x, 
                top: b.y, 
                transform: `translate(-50%, -50%) scale(${0.3 * b.dna.size})`,
                zIndex: Math.floor(b.y),
                cursor: isFrozen ? 'pointer' : 'default',
                outline: selectedCell?.id === b.id ? '3px solid #10b981' : 'none',
                borderRadius: '50%',
                padding: '10px'
              }}
            >
              <Cell dna={b.dna} id={b.id} rotation={rotation} flipX={flipX} animated={false} />
              <div className="health-bar">
                <div className="health-fill" style={{ width: `${b.health}%` }} />
              </div>
              <div className="energy-bar">
                <div className="energy-fill" style={{ width: `${Math.min(100, (b.energy / REPRODUCTION_ENERGY) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {isFrozen && selectedCell && (
        <div className="cell-info-panel">
          <h3>细胞属性</h3>
          <div className="info-item">
            <strong>能量:</strong> 
            <span>{selectedCell.energy.toFixed(1)} / {REPRODUCTION_ENERGY}</span>
          </div>
          <div className="info-item">
            <strong>健康:</strong> 
            <span>{selectedCell.health.toFixed(1)} / 100</span>
          </div>
          <div className="info-item">
            <strong>速度:</strong> 
            <span>{selectedCell.stats.speed}</span>
          </div>
          <div className="info-item">
            <strong>防御:</strong> 
            <span>{selectedCell.stats.defense}</span>
          </div>
          <div className="info-item">
            <strong>攻击:</strong> 
            <span>{selectedCell.stats.attack}</span>
          </div>
          <div className="info-item">
            <strong>反应:</strong> 
            <span>{selectedCell.stats.reaction}</span>
          </div>
          <div className="info-item">
            <strong>大小:</strong> 
            <span>{selectedCell.dna.size.toFixed(2)}</span>
          </div>
          <div className="info-item">
            <strong>颜色:</strong> 
            <span style={{
              display: 'inline-block',
              width: '18px',
              height: '18px',
              backgroundColor: `hsl(${selectedCell.dna.colorHue}, 70%, 50%)`,
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 0 0 1px #e2e8f0'
            }}></span>
          </div>
          <button onClick={handleDeleteCell} className="delete-btn">
            🗑️ 删除细胞
          </button>
        </div>
      )}
      <div className="instructions">
        <p>观察细菌的繁衍、变异和自然选择。</p>
        <p>不同颜色的种群会互相攻击。能量充足时会分裂。</p>
        {isFrozen && <p style={{ color: '#10b981', fontWeight: 'bold' }}>❄️ 冷冻模式：点击细胞查看属性并删除</p>}
      </div>
    </div>
  );
};

export default PetriDish;
