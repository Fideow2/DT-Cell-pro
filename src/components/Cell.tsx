import React from 'react';

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

export const calculateStats = (dna: CellDNA) => {
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

  return {
    speed: Math.round(speed),
    defense: Math.round(defense),
    attack: Math.round(attack),
    reaction: Math.round(reaction)
  };
};

interface CellProps {
  dna: CellDNA;
}

const Cell: React.FC<CellProps> = ({ dna }) => {
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

  const gradientId = `cellGradient-${colorHue}`;

  return (
    <div style={{ width: 300, height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width="300" height="300" viewBox="-150 -150 300 300">
        <defs>
          <radialGradient id={gradientId} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor={`hsl(${colorHue}, 70%, 80%)`} />
            <stop offset="100%" stopColor={`hsl(${colorHue}, 80%, 40%)`} />
          </radialGradient>
        </defs>

        {/* Tail */}
        <path
          d={tailPath}
          fill="none"
          stroke="black"
          strokeWidth={4 * size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Body */}
        <ellipse
          cx="0"
          cy="0"
          rx={rx}
          ry={ry}
          fill={`url(#${gradientId})`}
          stroke="black"
          strokeWidth={3 * size}
        />

        {/* Front Eye */}
        <path
          d={getEyePath(frontEyeX, frontEyeY, eyeBaseRadius)}
          fill="black"
        />

        {/* Mouth */}
        <path
          d={`M ${mouthStartX} ${finalMouthStartY} Q ${mouthControlX} ${mouthControlY} ${mouthEndX} ${finalMouthEndY}`}
          fill="none"
          stroke="black"
          strokeWidth={3 * size}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default Cell;
