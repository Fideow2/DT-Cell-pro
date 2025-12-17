import { useState } from 'react';
import './App.css';
import Cell, { calculateStats } from './components/Cell';
import type { CellDNA } from './components/Cell';

function App() {
  const [dna, setDna] = useState<CellDNA>({
    colorHue: 80, // Lime Green
    size: 1,
    eccentricity: 1.5, // Elongated
    eyeSize: 1,
    eyeDistance: 1,
    mouthCurve: -20, // Frown/Serious
    mouthWidth: 1,
    tailLength: 1,
    tailWaviness: 0.5,
    seed: 'cell-1',
  });

  const handleChange = (key: keyof CellDNA, value: number | string) => {
    setDna((prev) => ({ ...prev, [key]: value }));
  };

  const stats = calculateStats(dna);

  return (
    <div className="app-container">
      <h1>Procedural Cell Generator</h1>
      
      <div className="main-content">
        <div className="cell-preview">
          <Cell dna={dna} />
          <div className="stats-panel" style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', border: '1px solid #ccc' }}>
            <h3 style={{ marginTop: 0 }}>Cell Stats</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left' }}>
              <div>⚡ Speed: {stats.speed}</div>
              <div>🛡️ Defense: {stats.defense}</div>
              <div>⚔️ Attack: {stats.attack}</div>
              <div>⚡ Reaction: {stats.reaction}</div>
            </div>
          </div>
        </div>

        <div className="controls">
          <div className="control-group">
            <label>Color (Hue)</label>
            <input
              type="range"
              min="0"
              max="360"
              value={dna.colorHue}
              onChange={(e) => handleChange('colorHue', Number(e.target.value))}
            />
            <span>{dna.colorHue}</span>
          </div>

          <div className="control-group">
            <label>Size</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={dna.size}
              onChange={(e) => handleChange('size', Number(e.target.value))}
            />
            <span>{dna.size}</span>
          </div>

          <div className="control-group">
            <label>Eccentricity (Shape)</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={dna.eccentricity}
              onChange={(e) => handleChange('eccentricity', Number(e.target.value))}
            />
            <span>{dna.eccentricity}</span>
          </div>

          <div className="control-group">
            <label>Eye Size</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={dna.eyeSize}
              onChange={(e) => handleChange('eyeSize', Number(e.target.value))}
            />
            <span>{dna.eyeSize}</span>
          </div>

          <div className="control-group">
            <label>Eye Distance</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={dna.eyeDistance}
              onChange={(e) => handleChange('eyeDistance', Number(e.target.value))}
            />
            <span>{dna.eyeDistance}</span>
          </div>

          <div className="control-group">
            <label>Mouth Curve (Mood)</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={dna.mouthCurve}
              onChange={(e) => handleChange('mouthCurve', Number(e.target.value))}
            />
            <span>{dna.mouthCurve}</span>
          </div>

          <div className="control-group">
            <label>Mouth Width</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={dna.mouthWidth}
              onChange={(e) => handleChange('mouthWidth', Number(e.target.value))}
            />
            <span>{dna.mouthWidth}</span>
          </div>

          <div className="control-group">
            <label>Tail Length</label>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={dna.tailLength}
              onChange={(e) => handleChange('tailLength', Number(e.target.value))}
            />
            <span>{dna.tailLength}</span>
          </div>

          <div className="control-group">
            <label>Tail Waviness</label>
            <input
              type="range"
              min="0"
              max="5.0"
              step="0.1"
              value={dna.tailWaviness}
              onChange={(e) => handleChange('tailWaviness', Number(e.target.value))}
            />
            <span>{dna.tailWaviness}</span>
          </div>

          <div className="control-group">
            <label>Seed (Random Variation)</label>
            <input
              type="text"
              value={dna.seed}
              onChange={(e) => handleChange('seed', e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
              placeholder="Enter seed..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App
