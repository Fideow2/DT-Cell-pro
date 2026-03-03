# PetriDish 竞技场性能优化方案

## 当前性能瓶颈分析

### 1. O(n²) 攻击检测循环 (严重)
**位置**: `PetriDish.tsx` 第 180-195 行
```typescript
prev.bacteria.forEach(other => {
  if (b.id === other.id) return;
  const dist = Math.sqrt((other.x - nx) ** 2 + (other.y - ny) ** 2);
  // ...
});
```
当细菌数量达到 50 时，每帧需要进行 2500 次距离计算，时间复杂度为 O(n²)。

### 2. 频繁的 React 状态更新 (严重)
**位置**: `update` 回调函数
每帧调用 `setGameState` 触发 React 重渲染，即使使用 requestAnimationFrame，React 的调和过程仍会造成明显卡顿。

### 3. 不必要的数组拷贝
**位置**: `update` 函数第 95 行
```typescript
const nextFood = [...prev.food];
```
每帧都创建新数组，即使食物没有变化。

### 4. 空间网格查询效率低
**位置**: 食物检测循环
使用嵌套 for 循环查询网格，可以优化。

### 5. 频繁的 Math.sqrt 调用
距离计算中大量使用 `Math.sqrt`，可以用平方距离比较来避免。

### 6. calculateStats 重复计算
在 `createBacterium` 和攻击检测中重复计算 stats。

## 优化方案

### 阶段 1: JavaScript 层面优化
1. **使用空间哈希网格优化攻击检测** - 将 O(n²) 降为 O(n)
2. **使用平方距离避免 Math.sqrt**
3. **使用 useRef 存储游戏状态** - 绕过 React 渲染周期
4. **批量渲染** - 使用单个 setState 触发渲染，而非每帧更新

### 阶段 2: Rust WASM 优化 (可选)
对于更极致的性能，可以将物理计算和碰撞检测移至 Rust WASM。

## 预期性能提升
- 攻击检测: O(n²) → O(n)，50 个细胞时从 2500 次检测降至约 200 次
- 渲染帧率: 从 ~30fps 提升至 ~60fps
- 内存分配: 减少约 70% 的临时对象创建
