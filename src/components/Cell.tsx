import React from 'react';
import { AVAILABLE_ITEMS } from './items';

export interface CellDNA {
  colorHue: number;      // 0-360
  size: number;          // 0.5 - 2.0
  eccentricity: number;  // 0.5 (tall) - 2.0 (wide)
  eyeSize: number;       // 0.5 - 2.0 (relative scale)
  eyeDistance: number;   // 0.5 - 2.0 (relative scale)
  mouthCurve: number;    // -50 (frown) to 50 (smile)
  mouthWidth: number;    // 0.5 - 2.0 (relative scale)
  tailLength: number;    // 0.5 - 3.0
  tailWaviness: number;  // 0 - 5.0
  seed: string;
}

export const calculateStats = (dna: CellDNA, items: string[] = []) => {
  const { size, eccentricity, tailLength, tailWaviness, mouthCurve, seed } = dna;

  // Helper for seeded random
  const getSeededRandoms = (seedStr: string, count: number) => {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      const char = seedStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const randoms = [];
    let currentSeed = hash;
    for(let i=0; i<count; i++) {
        const x = Math.sin(currentSeed++) * 10000;
        randoms.push(x - Math.floor(x));
    }
    return randoms;
  };

  // Combine all DNA properties into the seed string so every trait affects the random outcome
  const compositeSeed = `${seed}-${dna.colorHue}-${dna.size}-${dna.eccentricity}-${dna.eyeSize}-${dna.eyeDistance}-${dna.mouthCurve}-${dna.mouthWidth}-${dna.tailLength}-${dna.tailWaviness}`;
  const randoms = getSeededRandoms(compositeSeed, 4);

  // Speed: Smaller size -> faster, Higher eccentricity -> faster
  let speed = 50;
  speed += (2.0 - size) * 20; 
  speed += (eccentricity - 0.5) * 10;
  speed += tailLength * 5;
  speed += tailWaviness * 2;
  speed += randoms[0] * 20; 

  // Defense: Eccentricity -> higher, Size -> higher
  let defense = 20;
  defense += size * 20; 
  defense += eccentricity * 10; 
  defense += randoms[1] * 15;

  // Attack: Angrier (lower mouthCurve) -> higher
  let attack = 30;
  attack += (50 - mouthCurve) * 0.4; 
  attack += randoms[2] * 25;

  // Reaction: Angrier -> lower reaction
  let reaction = 50;
  reaction -= (50 - mouthCurve) * 0.3; 
  reaction += randoms[3] * 15;

  // Item modifiers
  if (items.includes('spear')) {
    attack += 30;
    speed -= 5;
  }
  if (items.includes('hammer')) {
    attack += 40;
    speed -= 10;
  }
  if (items.includes('wrench')) {
    attack += 20;
    reaction += 10;
  }
  if (items.includes('shield')) {
    defense += 40;
    speed -= 10;
  }
  if (items.includes('safehat')) {
    defense += 15;
  }
  if (items.includes('band')) {
    defense += 5;
  }

  return {
    speed: Math.round(speed),
    defense: Math.round(defense),
    attack: Math.round(attack),
    reaction: Math.round(reaction)
  };
};

interface CellProps {
  dna: CellDNA;
  items?: string[];
  id?: string;
  rotation?: number; // in degrees
  flipX?: boolean;
}

const Cell: React.FC<CellProps> = ({ dna, items = [], id, rotation = 0, flipX = false }) => {
  const {
    colorHue,
    size,
    eccentricity,
    eyeSize,
    eyeDistance,
    mouthCurve,
    mouthWidth,
    tailLength,
    tailWaviness,
  } = dna;

  // Base dimensions
  const baseRadius = 50;
  const rx = baseRadius * eccentricity * size;
  const ry = (baseRadius / eccentricity) * size;

  // Side view calculations
  // Face is on the right side (positive x)
  const faceCenterX = rx * 0.6;
  const faceCenterY = -ry * 0.1;


  // Eye calculations
  // In side view, we only see one eye
  const eyeBaseRadius = 6 * size * eyeSize;
  
  // Front eye (closer to viewer)
  const frontEyeX = faceCenterX + (6 * size * eyeDistance);
  const frontEyeY = faceCenterY - 10 * size;

  // Mouth calculations
  // We anchor the mouth start (center of face) and let the end (corner) move based on expression
  const mouthCenterY = faceCenterY + 15 * size;
  
  // Calculate target Y for the mouth corner based on curve (smile/frown)
  // Smile (positive): Corner goes up (negative Y offset)
  // Frown (negative): Corner goes down (positive Y offset)
  let targetMouthCornerY = mouthCenterY - (mouthCurve * 0.5 * size);

  // Clamp vertical positions to be strictly inside the ellipse
  // Safety margin of 10% or 5px
  const maxY = ry * 0.9;
  const clampedMouthStartY = Math.max(-maxY, Math.min(maxY, mouthCenterY));
  const clampedMouthEndY = Math.max(-maxY, Math.min(maxY, targetMouthCornerY));

  // Calculate the x-boundary at the mouth corner's Y position
  const yRatio = Math.min(Math.abs(clampedMouthEndY) / ry, 0.99);
  const boundaryX = rx * Math.sqrt(1 - yRatio * yRatio);
  
  // Position the end of the mouth (corner) near the boundary
  const mouthEndX = boundaryX - 3 * size;
  
  // The width of the half-mouth
  const halfMouthWidth = (20 * mouthWidth * size) / 2;
  const mouthStartX = mouthEndX - halfMouthWidth;
  
  // Control point for quadratic bezier
  // Start tangent is horizontal (at mouthStartX, clampedMouthStartY)
  // So control point Y must be clampedMouthStartY
  const mouthControlX = (mouthStartX + mouthEndX) / 2;
  const mouthControlY = clampedMouthStartY;

  // Update start/end points for the path
  const finalMouthStartY = clampedMouthStartY;
  const finalMouthEndY = clampedMouthEndY;

  // Tail calculations
  const tailBaseX = -rx * 0.85; 
  const tailBaseY = 0;
  const actualTailLength = 80 * tailLength * size;
  const waveAmplitude = 10 * size;
  
  let tailPath = `M ${tailBaseX} ${tailBaseY}`;
  
  // Generate tail path
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = tailBaseX - t * actualTailLength;
      // Sine wave: sin(t * PI * 2 * waviness)
      // Amplitude tapers off slightly towards the end (1 - t*0.5)
      const y = tailBaseY + Math.sin(t * Math.PI * 2 * tailWaviness) * waveAmplitude * (1 - t * 0.3);
      tailPath += ` L ${x} ${y}`;
  }

  // Eye Shape (Angry/Determined look from image)
  // A semi-circle or flattened top ellipse
  const getEyePath = (cx: number, cy: number, r: number) => {
    // Simple flat top eye
    // Top is flat, bottom is round
    const topY = cy - r * 0.5; // Flattened top
    const bottomY = cy + r;
    const leftX = cx - r;
    const rightX = cx + r;
    
    // If mouthCurve is negative (frown/angry), flatten the top more or slant it
    const isAngry = mouthCurve < 0;
    const slant = isAngry ? 3 * size : 0;

    return `
      M ${leftX} ${cy}
      Q ${cx} ${bottomY + r*0.5} ${rightX} ${cy}
      L ${rightX} ${topY + slant}
      L ${leftX} ${topY - slant}
      Z
    `;
  };

  const gradientId = id ? `cellGradient-${id}` : `cellGradient-${colorHue}`;

  const activeItems = AVAILABLE_ITEMS.filter(item => items.includes(item.id));

  // Attachment points
  const handAttachX = rx * 0.8;
  const handAttachY = ry * 0.6;

  // Prepare render layers
  interface RenderLayer {
    id: string;
    zIndex: number;
    content: React.ReactNode;
  }
  
  const layers: RenderLayer[] = [];

  // 1. Tail (zIndex: -10)
  layers.push({
    id: 'tail',
    zIndex: -10,
    content: (
      <path
        key="tail"
        d={tailPath}
        fill="none"
        stroke="black"
        strokeWidth={4 * size}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  });

  // 2. Body (zIndex: 0)
  layers.push({
    id: 'body',
    zIndex: 0,
    content: (
      <ellipse
        key="body"
        cx="0"
        cy="0"
        rx={rx}
        ry={ry}
        fill={`url(#${gradientId})`}
        stroke="black"
        strokeWidth={3 * size}
      />
    )
  });

  // 4. Facial Features (zIndex: 10)
  layers.push({
    id: 'eye',
    zIndex: 10,
    content: (
      <path
        key="eye"
        d={getEyePath(frontEyeX, frontEyeY, eyeBaseRadius)}
        fill="black"
      />
    )
  });

  layers.push({
    id: 'mouth',
    zIndex: 10,
    content: (
      <path
        key="mouth"
        d={`M ${mouthStartX} ${finalMouthStartY} Q ${mouthControlX} ${mouthControlY} ${mouthEndX} ${finalMouthEndY}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * size}
        strokeLinecap="round"
      />
    )
  });

  // 5. Items
  activeItems.forEach(item => {
    let x = 0, y = 0, w = 0, h = 0, cx = 0, cy = 0;
    const s = item.scale || 1;
    
    if (item.type === 'main-hand' || item.type === 'off-hand') {
      w = 60 * size * s;
      h = 60 * size * s;
      x = handAttachX - 30 * size * s + (item.offsetX || 0);
      y = handAttachY - 30 * size * s + (item.offsetY || 0);
      cx = handAttachX;
      cy = handAttachY;
    } else if (item.type === 'head') {
      w = 80 * size * s;
      h = 80 * size * s;
      x = -40 * size * s + (item.offsetX || 0);
      y = -ry - 50 * size * s + (item.offsetY || 0);
      cx = 0;
      cy = -ry;
    } else if (item.type === 'body') {
      w = 60 * size * s;
      h = 60 * size * s;
      x = -30 * size * s + (item.offsetX || 0);
      y = -30 * size * s + (item.offsetY || 0);
      cx = 0;
      cy = 0;
    }

    const itemCenterX = x + w/2;
    const itemCenterY = y + h/2;
    
    let transform = `rotate(${item.rotation || 0}, ${cx}, ${cy})`;
    if (item.flipX) {
       transform += ` translate(${itemCenterX}, ${itemCenterY}) scale(-1, 1) translate(${-itemCenterX}, ${-itemCenterY})`;
    }
    
    // Default zIndices: Head=20, Hand=5, Body=1
    const defaultZ = item.type === 'head' ? 20 : (item.type === 'main-hand' || item.type === 'off-hand') ? 5 : 1;

    layers.push({
        id: item.id,
        zIndex: item.zIndex ?? defaultZ,
        content: (
          <image
            key={item.id}
            href={item.src}
            x={x}
            y={y}
            width={w}
            height={h}
            transform={transform}
          />
        )
    });
  });

  // Sort layers by zIndex
  layers.sort((a, b) => a.zIndex - b.zIndex);

  const transform = `${flipX ? 'scale(-1, 1)' : ''} rotate(${rotation})`;

  return (
    <div className="cell-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width="100%" height="100%" viewBox="-150 -150 300 300" style={{ maxWidth: '300px', maxHeight: '300px' }}>
        <defs>
          <radialGradient id={gradientId} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor={`hsl(${colorHue}, 70%, 80%)`} />
            <stop offset="100%" stopColor={`hsl(${colorHue}, 80%, 40%)`} />
          </radialGradient>
        </defs>

        <g transform={transform}>
          {layers.map(l => l.content)}
        </g>

      </svg>
    </div>
  );


};

export default Cell;
