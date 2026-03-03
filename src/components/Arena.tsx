import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cell, { type CellDNA } from './Cell';
import './Arena.css';

interface ArenaCell {
  id: string;
  x: number;
  y: number;
  angle: number;
  teamId: string;
  isLeader: boolean;
  health: number;
  maxHealth: number;
  dna: CellDNA;
  items: string[];
  invincible: number; // 无敌帧
  attackAnimation: number; // 攻击动画剩余帧数
}

interface BloodDrop {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  life: number;
  color: string;
}

interface Team {
  id: string;
  name: string;
  isPlayer: boolean;
  cells: string[]; // cell ids in order (leader first)
  foodEaten: number;
  colorHue: number;
  targetAngle?: number;
  attackCooldown: number;
  // AI 追击状态
  chaseTargetId?: string;
  chaseInterest: number; // 追击兴趣值 (0-100)
  lastChaseTime: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
  energy: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface ArenaProps {
  onBack: () => void;
  playerDna: CellDNA;
  playerItems: string[];
}

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1500;
const CELL_SIZE = 35;
const FOOD_SIZE = 10;
const BASE_SPEED = 3.2;
const BOOST_SPEED = 4.5;
const ATTACK_KEY = 'j';
const FOLLOW_DISTANCE = 38;
const ATTACK_RANGE = 100;
const ATTACK_ANGLE = Math.PI / 3; // 60度扇形
const ATTACK_DAMAGE = 45;
const ATTACK_COOLDOWN = 40;
const ATTACK_ANIMATION_DURATION = 15; // 攻击动画帧数
const FOOD_TO_GROW = 3;
const INITIAL_TEAMS = 8;

const Arena: React.FC<ArenaProps> = ({ onBack, playerDna, playerItems }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [mouseDown, setMouseDown] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bloodDrops, setBloodDrops] = useState<BloodDrop[]>([]);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [cells, setCells] = useState<Map<string, ArenaCell>>(new Map());
  const [foods, setFoods] = useState<Food[]>([]);
  
  const gameLoopRef = useRef<number | null>(null);
  const teamsRef = useRef<Team[]>([]);
  const cellsRef = useRef<Map<string, ArenaCell>>(new Map());
  const foodsRef = useRef<Food[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const bloodDropsRef = useRef<BloodDrop[]>([]);
  
  // Keep refs in sync
  useEffect(() => { teamsRef.current = teams; }, [teams]);
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { foodsRef.current = foods; }, [foods]);
  useEffect(() => { keysRef.current = keys; }, [keys]);
  useEffect(() => { bloodDropsRef.current = bloodDrops; }, [bloodDrops]);
  

  // Initialize game
  useEffect(() => {
    const initialCells = new Map<string, ArenaCell>();
    const initialTeams: Team[] = [];
    
    // Create player team
    const playerCell: ArenaCell = {
      id: 'player-cell',
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      angle: 0,
      teamId: 'player',
      isLeader: true,
      health: 100,
      maxHealth: 100,
      dna: { ...playerDna, size: 0.5 },
      items: ['spear'],
      invincible: 0,
      attackAnimation: 0,
    };
    initialCells.set(playerCell.id, playerCell);
    
    initialTeams.push({
      id: 'player',
      name: '你',
      isPlayer: true,
      cells: [playerCell.id],
      foodEaten: 0,
      colorHue: playerDna.colorHue,
      attackCooldown: 0,
      chaseInterest: 0,
      lastChaseTime: 0,
    });

    // Create AI teams
    const colors = [0, 60, 120, 180, 240, 300];
    for (let i = 0; i < INITIAL_TEAMS; i++) {
      const teamId = `ai-${i}`;
      const colorHue = colors[i % colors.length];
      const aiCell: ArenaCell = {
        id: `ai-cell-${i}`,
        x: Math.random() * (WORLD_WIDTH - 200) + 100,
        y: Math.random() * (WORLD_HEIGHT - 200) + 100,
        angle: Math.random() * Math.PI * 2,
        teamId,
        isLeader: true,
        health: 100,
        maxHealth: 100,
        dna: {
          colorHue,
          size: 0.5 + Math.random() * 0.2,
          eccentricity: 1.2,
          eyeSize: 1,
          eyeDistance: 1,
          mouthCurve: -10,
          mouthWidth: 1,
          tailLength: 1,
          tailWaviness: 0.5,
          seed: `ai-${i}`,
        },
        items: ['spear'],
        invincible: 0,
        attackAnimation: 0,
      };
      initialCells.set(aiCell.id, aiCell);
      
      initialTeams.push({
        id: teamId,
        name: `敌人${i + 1}`,
        isPlayer: false,
        cells: [aiCell.id],
        foodEaten: 0,
        colorHue,
        targetAngle: Math.random() * Math.PI * 2,
        attackCooldown: 0,
        chaseInterest: 0,
        lastChaseTime: 0,
      });
    }

    // Create initial food
    const initialFood: Food[] = [];
    for (let i = 0; i < 80; i++) {
      initialFood.push({
        id: `food-${i}`,
        x: Math.random() * (WORLD_WIDTH - 50) + 25,
        y: Math.random() * (WORLD_HEIGHT - 50) + 25,
        energy: 20,
      });
    }

    setCells(initialCells);
    setTeams(initialTeams);
    setFoods(initialFood);
  }, [playerDna, playerItems]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => new Set([...prev, e.key.toLowerCase()]));
      if (e.code === 'Space') {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => {
        const newKeys = new Set(prev);
        newKeys.delete(e.key.toLowerCase());
        return newKeys;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse handlers for attack
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        setMouseDown(true);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setMouseDown(false);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Create particle effect
  const createParticles = useCallback((x: number, y: number, color: string, count: number = 5) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: `p-${Date.now()}-${i}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 30,
        color,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      // Get current state from refs
      const currentTeams = teamsRef.current.map(t => ({ ...t, cells: [...t.cells] }));
      const currentCells = new Map(cellsRef.current);
      const currentFoods = [...foodsRef.current];
      let hasChanges = false;

      // Update each team
      currentTeams.forEach(team => {
        if (team.cells.length === 0) return;

        const leader = currentCells.get(team.cells[0])!;
        if (!leader) return;

        // Get all alive cells in team
        const aliveTeamCells = team.cells
          .map(id => currentCells.get(id))
          .filter((c): c is ArenaCell => c !== undefined && c.health > 0);

        if (aliveTeamCells.length === 0) {
          team.cells = [];
          hasChanges = true;
          return;
        }

        // Update leader
        if (team.isPlayer) {
          // Player control - use keysRef for real-time input
          const k = keysRef.current;
          let dx = 0, dy = 0;
          if (k.has('w') || k.has('arrowup')) dy = -1;
          if (k.has('s') || k.has('arrowdown')) dy = 1;
          if (k.has('a') || k.has('arrowleft')) dx = -1;
          if (k.has('d') || k.has('arrowright')) dx = 1;
          
          if (dx !== 0 || dy !== 0) {
            // Calculate target angle from input
            const len = Math.sqrt(dx * dx + dy * dy);
            const targetAngle = Math.atan2(dy / len, dx / len);
            
            // Smooth rotation towards target angle
            let angleDiff = targetAngle - leader.angle;
            // Normalize to -PI to PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Apply rotation speed (0.15 radians per frame for smooth feel)
            const rotationSpeed = 0.15;
            if (Math.abs(angleDiff) < rotationSpeed) {
              leader.angle = targetAngle;
            } else {
              leader.angle += Math.sign(angleDiff) * rotationSpeed;
            }
          }
          // Player always moves (no idle)
          hasChanges = true;
        } else {
          // AI behavior
          updateAI(team, leader, currentCells, currentFoods, currentTeams);
          hasChanges = true;
        }

        // Move leader (player can boost with space)
        let speed = BASE_SPEED;
        if (team.isPlayer && keysRef.current.has(' ')) {
          speed = BOOST_SPEED;
        }
        leader.x += Math.cos(leader.angle) * speed;
        leader.y += Math.sin(leader.angle) * speed;
        hasChanges = true;

        // Boundary check
        leader.x = Math.max(CELL_SIZE/2, Math.min(WORLD_WIDTH - CELL_SIZE/2, leader.x));
        leader.y = Math.max(CELL_SIZE/2, Math.min(WORLD_HEIGHT - CELL_SIZE/2, leader.y));

        // Update invincible frames
        if (leader.invincible > 0) {
          leader.invincible--;
          hasChanges = true;
        }

        // Update attack animation
        if (leader.attackAnimation > 0) {
          leader.attackAnimation--;
          hasChanges = true;
        }

        // Check food eating (leader only)
        for (let i = currentFoods.length - 1; i >= 0; i--) {
          const food = currentFoods[i];
          const dist = Math.hypot(food.x - leader.x, food.y - leader.y);
          if (dist < CELL_SIZE/2 + FOOD_SIZE) {
            currentFoods.splice(i, 1);
            team.foodEaten++;
            hasChanges = true;
            createParticles(food.x, food.y, '#10b981', 3);
            
            // Grow team
            if (team.foodEaten >= FOOD_TO_GROW) {
              team.foodEaten = 0;
              const lastCell = aliveTeamCells[aliveTeamCells.length - 1];
              const newCell: ArenaCell = {
                id: `cell-${Date.now()}-${Math.random()}`,
                x: lastCell.x,
                y: lastCell.y,
                angle: lastCell.angle,
                teamId: team.id,
                isLeader: false,
                health: 100,
                maxHealth: 100,
                dna: { ...leader.dna, size: 0.45 },
                items: [],
                invincible: 0,
                attackAnimation: 0,
              };
              currentCells.set(newCell.id, newCell);
              team.cells.push(newCell.id);
            }
            break;
          }
        }

        // Handle attack
        if (team.attackCooldown > 0) {
          team.attackCooldown--;
          hasChanges = true;
        }
        
        const wantsAttack = team.isPlayer 
          ? (keysRef.current.has(ATTACK_KEY) || mouseDown) 
          : team.attackCooldown === 0;
        
        if (wantsAttack && team.attackCooldown === 0) {
          team.attackCooldown = ATTACK_COOLDOWN;
          leader.attackAnimation = ATTACK_ANIMATION_DURATION;
          hasChanges = true;
          let hitSomeone = false;
          
          // Find targets in attack range
          currentTeams.forEach(targetTeam => {
            if (targetTeam.id === team.id) return;
            
            targetTeam.cells.forEach((targetId) => {
              const target = currentCells.get(targetId);
              if (!target || target.health <= 0 || target.invincible > 0) return;
              
              const dist = Math.hypot(target.x - leader.x, target.y - leader.y);
              if (dist > ATTACK_RANGE) return;
              
              const angleToTarget = Math.atan2(target.y - leader.y, target.x - leader.x);
              let angleDiff = angleToTarget - leader.angle;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              
              if (Math.abs(angleDiff) < ATTACK_ANGLE / 2) {
                // Hit!
                hitSomeone = true;
                target.health -= ATTACK_DAMAGE;
                target.invincible = 10;
                hasChanges = true;
                
                // Create blood drops
                const bloodColor = `hsl(${target.dna.colorHue}, 80%, 40%)`;
                for (let i = 0; i < 3; i++) {
                  const dropAngle = leader.angle + (Math.random() - 0.5) * 0.5;
                  const dropSpeed = 3 + Math.random() * 3;
                  bloodDropsRef.current.push({
                    id: `blood-${Date.now()}-${Math.random()}`,
                    x: target.x + (Math.random() - 0.5) * 20,
                    y: target.y + (Math.random() - 0.5) * 20,
                    vx: Math.cos(dropAngle) * dropSpeed,
                    vy: Math.sin(dropAngle) * dropSpeed,
                    rotation: Math.random() * 360,
                    life: 25 + Math.floor(Math.random() * 10),
                    color: bloodColor,
                  });
                }
                
                // Check if target died
                if (target.health <= 0) {
                  // If killed a follower, sever the tail
                  if (!target.isLeader) {
                    const targetIndex = targetTeam.cells.indexOf(targetId);
                    if (targetIndex > 0) {
                      const severedIds = targetTeam.cells.slice(targetIndex);
                      targetTeam.cells = targetTeam.cells.slice(0, targetIndex);
                      
                      // Convert severed cells to attacker's team
                      severedIds.forEach((id) => {
                        const cell = currentCells.get(id);
                        if (cell) {
                          cell.teamId = team.id;
                          cell.dna = { ...cell.dna, colorHue: team.colorHue };
                          cell.health = cell.maxHealth;
                          cell.invincible = 30;
                        }
                      });
                      team.cells.push(...severedIds);
                    }
                  }
                }
              }
            });
          });
          
          // Update blood drops state if we hit someone
          if (hitSomeone) {
            setBloodDrops([...bloodDropsRef.current]);
          }
        }

        // Update followers
        for (let i = 1; i < aliveTeamCells.length; i++) {
          const follower = aliveTeamCells[i];
          const target = aliveTeamCells[i - 1];
          
          const dx = target.x - follower.x;
          const dy = target.y - follower.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist > FOLLOW_DISTANCE) {
            const moveRatio = (dist - FOLLOW_DISTANCE) / dist;
            follower.x += dx * moveRatio * 0.3;
            follower.y += dy * moveRatio * 0.3;
            follower.angle = Math.atan2(dy, dx);
            hasChanges = true;
          }
          
          if (follower.invincible > 0) {
            follower.invincible--;
            hasChanges = true;
          }
        }

        // Update team cells list (remove dead)
        const originalLength = team.cells.length;
        team.cells = team.cells.filter(id => {
          const cell = currentCells.get(id);
          return cell && cell.health > 0;
        });
        if (team.cells.length !== originalLength) {
          hasChanges = true;
        }
      });

      // Spawn new food
      if (currentFoods.length < 60 && Math.random() < 0.05) {
        currentFoods.push({
          id: `food-${Date.now()}`,
          x: Math.random() * (WORLD_WIDTH - 50) + 25,
          y: Math.random() * (WORLD_HEIGHT - 50) + 25,
          energy: 20,
        });
        hasChanges = true;
      }

      // Update state if changed
      if (hasChanges) {
        setTeams(currentTeams);
        setCells(currentCells);
        setFoods(currentFoods);
      }

      // Update particles
      setParticles(prevParticles =>
        prevParticles
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 }))
          .filter(p => p.life > 0)
      );

      // Update blood drops
      setBloodDrops(prevDrops =>
        prevDrops
          .map(d => ({
            ...d,
            x: d.x + d.vx,
            y: d.y + d.vy,
            vy: d.vy + 0.15, // gravity
            life: d.life - 1,
          }))
          .filter(d => d.life > 0)
      );

      // Update camera to follow player
      const playerTeam = currentTeams.find(t => t.isPlayer);
      if (playerTeam && playerTeam.cells.length > 0) {
        const playerCell = currentCells.get(playerTeam.cells[0]);
        if (playerCell) {
          setCamera({ x: playerCell.x, y: playerCell.y });
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [teams, createParticles]);

  // AI behavior - aggressive chasing with limited vision
  const updateAI = (
    team: Team, 
    leader: ArenaCell, 
    allCells: Map<string, ArenaCell>, 
    foods: Food[],
    allTeams: Team[]
  ) => {
    const VISION_RANGE = 180; // AI 视野范围（较小）
    const CHASE_GIVE_UP_DISTANCE = 350; // 超过这个距离放弃追击

    let targetFood: Food | null = null;
    let targetEnemy: ArenaCell | null = null;
    let minFoodDist = 300;
    let minEnemyDist = VISION_RANGE;

    // Find nearest food
    foods.forEach(food => {
      const dist = Math.hypot(food.x - leader.x, food.y - leader.y);
      if (dist < minFoodDist) {
        minFoodDist = dist;
        targetFood = food;
      }
    });

    // Find nearest enemy
    allTeams.forEach(otherTeam => {
      if (otherTeam.id === team.id) return;
      otherTeam.cells.forEach(cellId => {
        const cell = allCells.get(cellId);
        if (!cell || cell.health <= 0) return;
        const dist = Math.hypot(cell.x - leader.x, cell.y - leader.y);
        
        // 优先追击较近的敌人
        if (dist < minEnemyDist) {
          minEnemyDist = dist;
          targetEnemy = cell;
        }
      });
    });

    // 有追击目标且距离不远，持续追击
    if (team.chaseTargetId) {
      const chaseTarget = allCells.get(team.chaseTargetId);
      if (chaseTarget && chaseTarget.health > 0) {
        const dist = Math.hypot(chaseTarget.x - leader.x, chaseTarget.y - leader.y);
        if (dist < CHASE_GIVE_UP_DISTANCE) {
          targetEnemy = chaseTarget;
          minEnemyDist = dist;
        } else {
          // 太远放弃
          team.chaseTargetId = undefined;
        }
      } else {
        team.chaseTargetId = undefined;
      }
    }

    // 发现新目标，开始追击
    if (targetEnemy) {
      team.chaseTargetId = targetEnemy.id;
    }

    // Decide action
    if (targetEnemy) {
      // Chase enemy aggressively
      const enemy = targetEnemy as ArenaCell;
      const targetAngle = Math.atan2(enemy.y - leader.y, enemy.x - leader.x);
      
      // Smooth turn towards target
      let angleDiff = targetAngle - leader.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      leader.angle += angleDiff * 0.15;
      
      // Auto attack if close
      if (minEnemyDist < ATTACK_RANGE && team.attackCooldown === 0) {
        team.attackCooldown = 1;
      }
    } else if (targetFood) {
      // Go to food
      const food = targetFood as Food;
      const angle = Math.atan2(food.y - leader.y, food.x - leader.x);
      let angleDiff = angle - leader.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      leader.angle += angleDiff * 0.1;
    } else {
      // Random wander
      if (Math.random() < 0.02) {
        team.targetAngle = Math.random() * Math.PI * 2;
      }
      if (team.targetAngle !== undefined) {
        let angleDiff = team.targetAngle - leader.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        leader.angle += angleDiff * 0.05;
      }
    }
  };

  // Get render transform
  const getScreenPos = (worldX: number, worldY: number) => {
    if (!canvasRef.current) return { x: worldX, y: worldY };
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    return {
      x: centerX + (worldX - camera.x),
      y: centerY + (worldY - camera.y),
    };
  };

  const playerTeam = teams.find(t => t.isPlayer);
  const teamRank = teams.filter(t => t.cells.length > 0)
    .sort((a, b) => b.cells.length - a.cells.length)
    .findIndex(t => t.id === 'player') + 1;
  const totalAliveTeams = teams.filter(t => t.cells.length > 0).length;

  return (
    <div className="arena-container">
      <div className="arena-header">
        <button className="arena-back-btn" onClick={onBack}>← 返回菜单</button>
        <h1>竞技场</h1>
        <div className="arena-stats">
          <span>长度: {playerTeam?.cells.length || 0}</span>
          <span>排名: {teamRank}/{totalAliveTeams}</span>
        </div>
      </div>

      <div 
        ref={canvasRef}
        className="arena-canvas"
        tabIndex={0}
      >
        {/* World border */}
        <div 
          className="arena-world"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            left: getScreenPos(0, 0).x,
            top: getScreenPos(0, 0).y,
          }}
        >
          {/* Grid */}
          <div className="arena-grid" />

          {/* Food */}
          {foods.map(food => (
            <div
              key={food.id}
              className="arena-food"
              style={{
                left: food.x - FOOD_SIZE/2,
                top: food.y - FOOD_SIZE/2,
                width: FOOD_SIZE,
                height: FOOD_SIZE,
              }}
            />
          ))}

          {/* Cells */}
          {Array.from(cells.values()).map(cell => {
            if (cell.health <= 0) return null;
            const flipX = Math.cos(cell.angle) < 0;
            const rotation = flipX 
              ? Math.atan2(Math.sin(cell.angle), -Math.cos(cell.angle)) * 180 / Math.PI
              : Math.atan2(Math.sin(cell.angle), Math.cos(cell.angle)) * 180 / Math.PI;
            
            return (
              <div
                key={cell.id}
                className="arena-cell"
                style={{
                  left: cell.x - CELL_SIZE/2,
                  top: cell.y - CELL_SIZE/2,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  opacity: cell.invincible > 0 && cell.invincible % 4 < 2 ? 0.5 : 1,
                }}
              >
                <Cell 
                  dna={cell.dna}
                  items={cell.items}
                  rotation={rotation}
                  flipX={flipX}
                  animated={true}
                  disableBobbing={true}
                  attackProgress={cell.attackAnimation > 0 ? cell.attackAnimation / ATTACK_ANIMATION_DURATION : 0}
                />
                {/* Health bar - above cell */}
                <div className="cell-health-bar">
                  <div 
                    className="cell-health-fill"
                    style={{ width: `${(cell.health / cell.maxHealth) * 100}%` }}
                  />
                </div>
                {/* Attack cooldown bar - below cell (player only) */}
                {cell.isLeader && cell.teamId === 'player' && playerTeam && (
                  <div className="cell-cooldown-bar">
                    <div className="cooldown-track-blue">
                      <div 
                        className="cooldown-fill-blue"
                        style={{ 
                          width: `${playerTeam.attackCooldown > 0 
                            ? ((ATTACK_COOLDOWN - playerTeam.attackCooldown) / ATTACK_COOLDOWN) * 100 
                            : 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Attack range indicator for player */}
          {playerTeam && playerTeam.cells.length > 0 && (() => {
            const leader = cells.get(playerTeam.cells[0]);
            if (!leader) return null;
            return (
              <div
                className="attack-indicator"
                style={{
                  left: leader.x - ATTACK_RANGE,
                  top: leader.y - ATTACK_RANGE,
                  width: ATTACK_RANGE * 2,
                  height: ATTACK_RANGE * 2,
                  opacity: playerTeam.attackCooldown > ATTACK_COOLDOWN - 10 ? 0.3 : 0,
                }}
              />
            );
          })()}

          {/* Player cooldown bar - positioned above player cell */}
          {playerTeam && playerTeam.cells.length > 0 && (() => {
            const leader = cells.get(playerTeam.cells[0]);
            if (!leader) return null;
            const cooldownPercent = playerTeam.attackCooldown > 0 
              ? (ATTACK_COOLDOWN - playerTeam.attackCooldown) / ATTACK_COOLDOWN 
              : 1;
            return (
              <div
                className="player-cooldown-bar"
                style={{
                  left: leader.x - 20,
                  top: leader.y - CELL_SIZE - 8,
                }}
              >
                <div className="cooldown-track">
                  <div 
                    className="cooldown-fill"
                    style={{
                      width: `${cooldownPercent * 100}%`,
                      backgroundColor: cooldownPercent >= 1 ? '#10b981' : '#ef4444',
                    }}
                  />
                </div>
                <span className="cooldown-text">{cooldownPercent >= 1 ? 'J' : ''}</span>
              </div>
            );
          })()}
        </div>

        {/* Particles */}
        {particles.map(p => {
          const pos = getScreenPos(p.x, p.y);
          return (
            <div
              key={p.id}
              className="arena-particle"
              style={{
                left: pos.x,
                top: pos.y,
                backgroundColor: p.color,
                opacity: p.life / 30,
              }}
            />
          );
        })}

        {/* Blood drops */}
        {bloodDrops.map(d => {
          const pos = getScreenPos(d.x, d.y);
          return (
            <div
              key={d.id}
              className="blood-drop"
              style={{
                left: pos.x,
                top: pos.y,
                backgroundColor: d.color,
                transform: `rotate(${d.rotation}deg)`,
                opacity: Math.min(1, d.life / 10),
              }}
            />
          );
        })}
      </div>

      <div className="arena-controls">
        <p>WASD / 方向键 移动 | 空格 加速 | J / 鼠标左键 攻击</p>
        <p>吃掉食物增长队伍，攻击其他细胞截断它们的尾巴！</p>
      </div>
    </div>
  );
};

export default Arena;
