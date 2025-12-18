export type ItemType = 'main-hand' | 'off-hand' | 'head' | 'body';

export interface CellItem {
  id: string;
  name: string;
  type: ItemType;
  src: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  flipX?: boolean;
  zIndex?: number;
}

export const AVAILABLE_ITEMS: CellItem[] = [
  { 
    id: 'spear', 
    name: 'Spear', 
    type: 'main-hand', 
    src: '/items/spear.png',
    scale: 3.0,
    offsetX: 8,
    offsetY: -2,
    rotation: -25,
    flipX: false,
    zIndex: -1
  },
  { 
    id: 'hammer', 
    name: 'Hammer', 
    type: 'main-hand', 
    src: '/items/hammer.png',
    scale: 2,
    offsetX: 0,
    offsetY: -20,
    rotation: 30,
    flipX: true,
    zIndex: -1
  },
  { 
    id: 'wrench', 
    name: 'Wrench', 
    type: 'off-hand', 
    src: '/items/wrench.png',
    scale: 1.2,
    offsetX: -20,
    offsetY: 12,
    rotation: 15,
    flipX: false,
    zIndex: 5
  },
  { 
    id: 'shield', 
    name: 'Shield', 
    type: 'off-hand', 
    src: '/items/shield.png',
    scale: 1,
    offsetX: 15,
    offsetY: -5,
    rotation: 0,
    flipX: true,
    zIndex: 20
  },
  { 
    id: 'safehat', 
    name: 'Safety Hat', 
    type: 'head', 
    src: '/items/safehat.png',
    scale: 1.2,
    offsetX: 10,
    offsetY: 0,
    rotation: 0,
    flipX: true,
    zIndex: 20
  },
  { 
    id: 'band', 
    name: 'Bandage', 
    type: 'body', 
    src: '/items/band.png',
    scale: 0.8,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    flipX: false,
    zIndex: 1
  },
];
