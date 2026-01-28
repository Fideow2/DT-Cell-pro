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

const MAX_BACTERIA = 50;
const FOOD_SPAWN_RATE = 0.05;
const MAX_FOOD = 30;
const ENERGY_LOSS_PER_FRAME = 0.08;
const REPRODUCTION_ENERGY = 150;
const MUTATION_RATE = 0.2;
const DETECTION_RANGE = 150;
const GRID_SIZE = 50;

const PetriDish: React.FC<PetriDishProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<{
    bacteria: Bacterium[];
    food: Food[];
  }>({ bacteria: [], food: [] });
  const [isFrozen, setIsFrozen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Bacterium | null>(null);
  const [dishDimensions, setDishDimensions] = useState({ width: 800, height: 600 });
  
  const DISH_WIDTH = dishDimensions.width;
  const DISH_HEIGHT = dishDimensions.height;
  
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);

  // Calculate dish size based on viewport
  useEffect(() => {
    const updateDimensions = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Reserve space for header (~8vh) and margins (~2vh)
      const availableHeight = vh * 0.88;
      const availableWidth = vw * 0.98;
      
      // Maintain aspect ratio of 4:3
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
    };
  }, []);

  const mutateDNA = (dna: CellDNA): CellDNA => {
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
  };

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
    setGameState({
      bacteria: [createBacterium(initialDNA, dishDimensions.width / 2, dishDimensions.height / 2)],
      food: []
    });
  }, [createBacterium, dishDimensions]);

  const update = useCallback((time: number) => {
    if (lastTimeRef.current !== undefined) {
      // 如果冷冻模式开启，停止所有更新
      if (isFrozen) {
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(update);
        return;
      }
      
      setGameState(prev => {
        const nextBacteria: Bacterium[] = [];
        const nextFood = [...prev.food];

        // 1. Build Spatial Grid for Food (Efficiency)
        const grid: Record<string, Food[]> = {};
        nextFood.forEach(f => {
          const gx = Math.floor(f.x / GRID_SIZE);
          const gy = Math.floor(f.y / GRID_SIZE);
          const key = `${gx},${gy}`;
          if (!grid[key]) grid[key] = [];
          grid[key].push(f);
        });

        // 2. Update Bacteria
        prev.bacteria.forEach(b => {
          let { x, y, vx, vy, ax, ay, energy, health } = b;

          // Search for nearby food in the grid
          let closestFood: Food | null = null;
          let minDist = DETECTION_RANGE;

          const bgx = Math.floor(x / GRID_SIZE);
          const bgy = Math.floor(y / GRID_SIZE);
          const range = Math.ceil(DETECTION_RANGE / GRID_SIZE);

          for (let ix = bgx - range; ix <= bgx + range; ix++) {
            for (let iy = bgy - range; iy <= bgy + range; iy++) {
              const cellFood = grid[`${ix},${iy}`];
              if (cellFood) {
                for (const f of cellFood) {
                  const d = Math.sqrt((f.x - x) ** 2 + (f.y - y) ** 2);
                  if (d < minDist) {
                    minDist = d;
                    closestFood = f;
                  }
                }
              }
            }
          }

          // Steering towards food
          let nax = ax;
          let nay = ay;

          if (closestFood) {
            const angle = Math.atan2(closestFood.y - y, closestFood.x - x);
            const force = 0.2 * (b.stats.reaction / 50);
            nax += Math.cos(angle) * force;
            nay += Math.sin(angle) * force;
          } else {
            // Random roaming if no food nearby
            nax += (Math.random() - 0.5) * 0.15;
            nay += (Math.random() - 0.5) * 0.15;
          }
          
          // Damping on acceleration
          nax *= 0.85;
          nay *= 0.85;

          // Update velocity with acceleration
          vx += nax;
          vy += nay;

          // Apply friction to velocity
          vx *= 0.99;
          vy *= 0.99;

          // Speed limit based on DNA stats
          const currentSpeed = Math.sqrt(vx * vx + vy * vy);
          const maxAllowedSpeed = (b.stats.speed / 30); 
          if (currentSpeed > maxAllowedSpeed) {
            vx = (vx / currentSpeed) * maxAllowedSpeed;
            vy = (vy / currentSpeed) * maxAllowedSpeed;
          }

          // Move
          let nx = x + vx;
          let ny = y + vy;

          // Bounce
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

          // Energy and Health loss (Larger cells consume more energy)
          energy -= ENERGY_LOSS_PER_FRAME * b.dna.size;

          // Starvation: if energy is 0, lose health
          if (energy <= 0) {
            energy = 0;
            // Larger cells lose health faster when starving
            health -= 0.5 * b.dna.size; 
          }

          if (health <= 0) return; // Dead

          // Interaction with food (Eating)
          const foodIndex = nextFood.findIndex(f => {
            const dist = Math.sqrt((f.x - nx) ** 2 + (f.y - ny) ** 2);
            return dist < 20 * b.dna.size;
          });
          if (foodIndex !== -1) {
            energy += nextFood[foodIndex].energy;
            health = Math.min(100, health + 10); // Eating restores health
            nextFood.splice(foodIndex, 1);
          }

          // Interaction with other bacteria (Attack)
          prev.bacteria.forEach(other => {
            if (b.id === other.id) return;
            const dist = Math.sqrt((other.x - nx) ** 2 + (other.y - ny) ** 2);
            const colorDiff = Math.abs(b.dna.colorHue - other.dna.colorHue);
            const isEnemy = Math.min(colorDiff, 360 - colorDiff) > 45;

            if (dist < 40 * b.dna.size && isEnemy) {
              // I am being attacked by 'other'
              const damage = (other.stats.attack / b.stats.defense) * 0.1;
              health -= damage;
              // Small knockback from the attacker
              const angle = Math.atan2(ny - other.y, nx - other.x);
              vx += Math.cos(angle) * 0.2;
              vy += Math.sin(angle) * 0.2;
            }
          });

          if (health <= 0) return; // Dead

          // Reproduction
          if (energy >= REPRODUCTION_ENERGY && nextBacteria.length + prev.bacteria.length < MAX_BACTERIA) {
            energy /= 2;
            const childDna = mutateDNA(b.dna);
            nextBacteria.push(createBacterium(childDna, nx + (Math.random() - 0.5) * 20, ny + (Math.random() - 0.5) * 20));
          }

          nextBacteria.push({ ...b, x: nx, y: ny, vx, vy, ax: nax, ay: nay, energy, health });
        });

        // 3. Spawn food
        if (nextFood.length < MAX_FOOD && Math.random() < FOOD_SPAWN_RATE) {
          nextFood.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * DISH_WIDTH,
            y: Math.random() * DISH_HEIGHT,
            energy: 40,
          });
        }

        return { bacteria: nextBacteria, food: nextFood };
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(update);
  }, [createBacterium, isFrozen]);

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
      setGameState(prev => ({
        ...prev,
        bacteria: prev.bacteria.filter(b => b.id !== selectedCell.id)
      }));
      setSelectedCell(null);
    }
  };

  return (
    <div className="petri-dish-container">
      <div className="petri-dish-header">
        <button className="dish-back-btn" onClick={onBack}>← 返回菜单</button>
        <h1>培养皿模式</h1>
        <div className="stats">
          数量: {gameState.bacteria.length} | 食物: {gameState.food.length}
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
        {gameState.food.map(f => (
          <div 
            key={f.id} 
            className="food" 
            style={{ left: f.x, top: f.y }}
          />
        ))}
        {gameState.bacteria.map(b => {
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
              <Cell dna={b.dna} id={b.id} rotation={rotation} flipX={flipX} />
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
