## 🐛 性能问题：PetriDish 竞技场在细胞数量增加时严重卡顿

### 问题描述
当培养皿中的细菌数量达到 30-50 个时，页面帧率显著下降，用户体验变得卡顿。经过分析，主要性能瓶颈在于攻击检测的 O(n²) 时间复杂度。

### 性能分析

#### 1. O(n²) 攻击检测循环（严重）
**位置**: `PetriDish.tsx` 第 180-195 行

```typescript
prev.bacteria.forEach(other => {
  if (b.id === other.id) return;
  const dist = Math.sqrt((other.x - nx) ** 2 + (other.y - ny) ** 2);
  // ...
});
```

当细菌数量达到 50 时，每帧需要进行 2500 次距离计算。

| 细胞数量 | 每帧检测次数 | 预估耗时 |
|---------|-------------|---------|
| 10 | 100 | ~0.1ms |
| 20 | 400 | ~0.4ms |
| 30 | 900 | ~0.9ms |
| 40 | 1,600 | ~1.6ms |
| 50 | 2,500 | ~2.5ms |

#### 2. 频繁的 React 状态更新
每帧调用 `setGameState` 触发 React 重渲染，即使使用 requestAnimationFrame，React 的调和过程仍会造成明显卡顿。

#### 3. 不必要的数组拷贝
```typescript
const nextFood = [...prev.food];
```
每帧都创建新数组，即使食物没有变化。

#### 4. 频繁的 Math.sqrt 调用
距离计算中大量使用 `Math.sqrt`，可以用平方距离比较来避免。

### 复现步骤
1. 进入培养皿模式
2. 等待细菌繁殖到 30-50 个
3. 观察帧率下降

### 环境信息
- 浏览器: Chrome/Firefox/Safari
- 设备: 普通笔记本电脑

### 建议的优化方案

#### 阶段 1: JavaScript 层面优化
1. **使用空间哈希网格优化攻击检测** - 将 O(n²) 降为 O(n)
2. **使用平方距离避免 Math.sqrt**
3. **使用 useRef 存储游戏状态** - 绕过 React 渲染周期
4. **批量渲染** - 使用单个 setState 触发渲染，而非每帧更新

#### 阶段 2: Rust WASM 优化（可选）
对于更极致的性能，可以将物理计算和碰撞检测移至 Rust WASM。

### 预期性能提升
- 攻击检测: O(n²) → O(n)，50 个细胞时从 2500 次检测降至约 200 次
- 渲染帧率: 从 ~30fps 提升至 ~60fps
- 内存分配: 减少约 70% 的临时对象创建

### 相关代码
- `src/components/PetriDish.tsx`
- `src/components/Cell.tsx`

---

**标签**: `performance`, `optimization`, `help wanted`
