import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Menu.css';
import Cell, { type CellDNA } from './Cell';

interface MenuProps {
  onStartGame: () => void;
  onStartPetriDish: () => void;
  onStartArena?: () => void;
  cellDna: CellDNA;
  cellItems: string[];
}

// Cell state in menu
interface MenuCell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number | null;
  targetY: number | null;
  isMovingToTarget: boolean;
}

const Menu: React.FC<MenuProps> = ({ onStartGame, onStartPetriDish, onStartArena, cellDna, cellItems }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Cell state
  const [cell, setCell] = useState<MenuCell>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    vx: 0,
    vy: 0,
    targetX: null,
    targetY: null,
    isMovingToTarget: false,
  });

  // Random wander target
  const [wanderTarget, setWanderTarget] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const wanderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate new random wander target
  const generateWanderTarget = useCallback(() => {
    const padding = 100;
    setWanderTarget({
      x: padding + Math.random() * (window.innerWidth - padding * 2),
      y: padding + Math.random() * (window.innerHeight - padding * 2),
    });
  }, []);

  // Schedule next wander
  const scheduleWander = useCallback(() => {
    if (wanderTimerRef.current) {
      clearTimeout(wanderTimerRef.current);
    }
    const delay = 500 + Math.random() * 1500; // 0.5-2 seconds (less idle, more swimming)
    wanderTimerRef.current = setTimeout(() => {
      generateWanderTarget();
      scheduleWander();
    }, delay);
  }, [generateWanderTarget]);

  // Initialize wander
  useEffect(() => {
    scheduleWander();
    return () => {
      if (wanderTimerRef.current) {
        clearTimeout(wanderTimerRef.current);
      }
    };
  }, [scheduleWander]);

  // Handle container click - set target for cell to swim to
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCell(prev => ({
      ...prev,
      targetX: x,
      targetY: y,
      isMovingToTarget: true,
    }));

    // Clear target after 5 seconds and resume wandering
    if (wanderTimerRef.current) {
      clearTimeout(wanderTimerRef.current);
    }
    wanderTimerRef.current = setTimeout(() => {
      setCell(prev => ({
        ...prev,
        targetX: null,
        targetY: null,
        isMovingToTarget: false,
      }));
      generateWanderTarget();
      scheduleWander();
    }, 5000);
  }, [generateWanderTarget, scheduleWander]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setCell(prev => {
        const { x, y, vx, vy, targetX, targetY, isMovingToTarget } = prev;
        
        let target = isMovingToTarget && targetX !== null && targetY !== null
          ? { x: targetX, y: targetY }
          : wanderTarget;

        // Calculate direction to target
        const dx = target.x - x;
        const dy = target.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let newVx = vx;
        let newVy = vy;

        if (dist > 10) {
          // Steering force towards target (slower, more graceful swimming)
          const maxSpeed = 1.2;
          const maxForce = 0.05;
          
          // Desired velocity
          const desiredVx = (dx / dist) * maxSpeed;
          const desiredVy = (dy / dist) * maxSpeed;
          
          // Steering = desired - current
          let steerX = desiredVx - vx;
          let steerY = desiredVy - vy;
          
          // Limit steering force
          const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
          if (steerMag > maxForce) {
            steerX = (steerX / steerMag) * maxForce;
            steerY = (steerY / steerMag) * maxForce;
          }
          
          newVx += steerX;
          newVy += steerY;
        } else {
          // Arrived at target - slow down
          newVx *= 0.9;
          newVy *= 0.9;
          
          // If was moving to click target, clear it and pick new wander target
          if (isMovingToTarget) {
            generateWanderTarget();
            return {
              ...prev,
              x: x + newVx,
              y: y + newVy,
              vx: newVx,
              vy: newVy,
              targetX: null,
              targetY: null,
              isMovingToTarget: false,
            };
          }
        }

        // Apply slight friction
        newVx *= 0.98;
        newVy *= 0.98;

        // Update position
        let newX = x + newVx;
        let newY = y + newVy;

        // Boundary check - bounce off edges
        const padding = 80;
        if (newX < padding) {
          newX = padding;
          newVx *= -0.5;
        }
        if (newX > window.innerWidth - padding) {
          newX = window.innerWidth - padding;
          newVx *= -0.5;
        }
        if (newY < padding) {
          newY = padding;
          newVy *= -0.5;
        }
        if (newY > window.innerHeight - padding) {
          newY = window.innerHeight - padding;
          newVy *= -0.5;
        }

        return {
          ...prev,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy,
        };
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [wanderTarget, generateWanderTarget]);

  // Calculate rotation based on velocity
  // Flip when moving left, but adjust rotation to keep cell upright
  const flipX = cell.vx < 0;
  const rotation = (flipX 
    ? Math.atan2(cell.vy, -cell.vx) 
    : Math.atan2(cell.vy, cell.vx)
  ) * 180 / Math.PI;

  return (
    <div 
      ref={containerRef}
      className="menu-container"
      onClick={handleContainerClick}
      style={{ cursor: 'crosshair' }}
    >
      {/* Background swimming cell */}
      <div 
        className="menu-background-cell"
        style={{
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          transform: 'translate(-50%, -50%) scale(0.8)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.9,
        }}
      >
        <Cell 
          dna={cellDna} 
          items={cellItems} 
          rotation={rotation}
          flipX={flipX}
          animated={true}
          disableBobbing={true}
        />
      </div>

      {/* Click hint */}
      <div className="menu-click-hint">
        点击任意位置，细胞会游过去哦 ~
      </div>

      <h1 className="menu-title">游戏菜单</h1>
      <div className="menu-options" style={{ position: 'relative', zIndex: 10 }}>
        <button className="menu-button" onClick={(e) => { e.stopPropagation(); onStartGame(); }}>
          <span className="button-icon">👗</span>
          <span className="button-text">奇迹暖暖</span>
        </button>
        <button className="menu-button" onClick={(e) => { e.stopPropagation(); onStartPetriDish(); }}>
          <span className="button-icon">🧫</span>
          <span className="button-text">培养皿</span>
        </button>
        <button className="menu-button" onClick={(e) => { e.stopPropagation(); onStartArena?.(); }}>
          <span className="button-icon">⚔️</span>
          <span className="button-text">竞技场</span>
        </button>
      </div>
    </div>
  );
};

export default Menu;
