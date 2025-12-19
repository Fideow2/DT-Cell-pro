import { useState } from 'react';
import './App.css';
import Cell, { calculateStats } from './components/Cell';
import type { CellDNA } from './components/Cell';
import { AVAILABLE_ITEMS } from './components/items';
import Menu from './components/Menu';
import PetriDish from './components/PetriDish';

function App() {
  const [view, setView] = useState<'menu' | 'game' | 'petri-dish'>('menu');
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

  const [items, setItems] = useState<string[]>([]);

  const handleChange = (key: keyof CellDNA, value: number | string) => {
    setDna((prev) => ({ ...prev, [key]: value }));
  };

  const toggleItem = (id: string) => {
    setItems(prev => {
      const item = AVAILABLE_ITEMS.find(i => i.id === id);
      if (!item) return prev;

      // If it's a main-hand or off-hand item, remove other items of the same type
      if (item.type === 'main-hand' || item.type === 'off-hand') {
        const otherItemsOfSameType = AVAILABLE_ITEMS.filter(i => i.type === item.type && i.id !== id).map(i => i.id);
        const newItems = prev.filter(i => !otherItemsOfSameType.includes(i));
        return newItems.includes(id) ? newItems.filter(i => i !== id) : [...newItems, id];
      }
      
      // For other items, just toggle
      return prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
    });
  };

  const stats = calculateStats(dna, items);

  if (view === 'menu') {
    return <Menu onStartGame={() => setView('game')} onStartPetriDish={() => setView('petri-dish')} />;
  }

  if (view === 'petri-dish') {
    return <PetriDish onBack={() => setView('menu')} />;
  }

  return (
    <div className="app-container">
      <div className="header">
        <button className="back-btn" onClick={() => setView('menu')}>← 返回菜单</button>
        <h1>Procedural Cell Generator</h1>
      </div>
      
      <div className="main-content">
        <div className="cell-preview">
          <Cell dna={dna} items={items} />
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
            <label>Equipment</label>
            <div className="items-grid">
              {AVAILABLE_ITEMS.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => toggleItem(item.id)}
                  className={`item-btn ${items.includes(item.id) ? 'active' : ''}`}
                  title={item.name}
                >
                  <img src={item.src} alt={item.name} />
                </button>
              ))}
            </div>
          </div>

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
