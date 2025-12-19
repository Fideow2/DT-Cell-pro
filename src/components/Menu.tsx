import React from 'react';
import './Menu.css';

interface MenuProps {
  onStartGame: () => void;
  onStartPetriDish: () => void;
}

const Menu: React.FC<MenuProps> = ({ onStartGame, onStartPetriDish }) => {
  return (
    <div className="menu-container">
      <h1 className="menu-title">游戏菜单</h1>
      <div className="menu-options">
        <button className="menu-button" onClick={onStartGame}>
          <span className="button-icon">👗</span>
          <span className="button-text">奇迹暖暖</span>
        </button>
        <button className="menu-button" onClick={onStartPetriDish}>
          <span className="button-icon">🧫</span>
          <span className="button-text">培养皿</span>
        </button>
        <button className="menu-button disabled" disabled>
          <span className="button-icon">🔒</span>
          <span className="button-text">敬请期待</span>
        </button>
      </div>
    </div>
  );
};

export default Menu;
