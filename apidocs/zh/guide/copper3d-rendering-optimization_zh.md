# Copper3D GLB 渲染优化

## 概述

本文档描述了对 Copper3D 库中 Three.js 渲染管线的优化，以提升医学图像标注器中 GLB 模型的视觉质量。原始渲染效果暗淡、缺乏细节、没有光泽感。以下改动涵盖了光照、色调映射、材质增强和环境贴图等方面。

---

## 1. 渲染器设置 (`baseRenderer.ts`)

### 色调映射与曝光

| 设置项 | 修改前 | 修改后 |
|--------|--------|--------|
| 色调映射 | 默认（线性） | `THREE.ACESFilmicToneMapping` |
| 曝光度 | 1.0 | **1.8** |
| 输出色彩空间 | 默认 | `THREE.SRGBColorSpace` |
| 像素比 | `window.devicePixelRatio` | `Math.min(window.devicePixelRatio, 2)` |

- **ACES 电影色调映射**：业界标准的电影级色调映射算法，相比线性映射，能提供更好的对比度和色彩还原。自然压缩高光的同时保留暗部细节。
- **曝光度 1.8**：显著高于默认值 1.0，补偿原本过暗的整体画面。
- **SRGBColorSpace**：确保输出正确的 gamma 感知色彩。

---

## 2. 多光源系统 (`baseScene.ts`)

原始的单光源或最小光源配置导致模型大面积区域（尤其是顶部）处于黑暗中。现已实现 5 光源系统：

### 光源配置

| 光源 | 类型 | 颜色 | 强度 | 位置 | 挂载于 |
|------|------|------|------|------|--------|
| 半球光 | HemisphereLight | 天空: `#ddeeff`, 地面: `#0f0e0d` | 0.6 | 场景根节点 | 场景 |
| 环境光 | AmbientLight | `#606060` | 0.8 | - | 相机 |
| 主光（Key Light） | DirectionalLight | `#ffffff` | 1.0 | `(0.5, 0.5, 0.866)` | 相机 |
| 补光（Fill Light） | DirectionalLight | `#ffffff` | 0.4 | `(-0.5, -0.2, -0.866)` | 相机 |
| 顶光（Top Light） | DirectionalLight | `#ffffff` | 0.5 | `(0, 1, 0.2)` | 相机 |

### 设计理由

- **相机挂载光源**：所有方向光和环境光都作为相机的子对象，因此无论轨道旋转角度如何，光照始终保持一致。模型在任何视角下都能获得良好的照明。
- **半球光**：提供柔和的全方位环境填充光，模拟天空和地面的漫反射光。
- **主光**（前方偏右）：主要的造型光，定义模型的形状和表面细节。
- **补光**（后方偏左）：减少主光对面的硬阴影。
- **顶光**（正上方）：专门添加以解决模型顶部发黑的问题——解剖模型的顶部此前无法接收到足够的光照。

---

## 3. HDR 环境贴图 (`baseRenderer.ts`)

### 配置

- **HDR 来源**：`venice_sunset_1k.hdr`，通过 `RGBELoader` 加载
- **处理方式**：`PMREMGenerator` 生成预过滤的多级渐远纹理辐照度环境贴图
- **应用方式**：
  - `scene.environment` — 供 PBR 材质用于真实反射
  - `scene.background` — 提供自然背景（被渐晕层覆盖）

### HDR 环境的重要性

Three.js 中的 PBR（基于物理的渲染）材质依赖环境贴图实现真实反射。没有环境贴图时，金属和反射表面会显得平坦而发黑。HDR 环境提供：

- 光滑表面上的真实高光反射
- 基于图像的光照（IBL），增添环境细节
- 反射中的自然色彩变化

---

## 4. PBR 材质增强 (`copperScene.ts`)

通过 `loadPureGLB()` 加载 GLB 模型时，材质会自动优化：

```typescript
if (child.material instanceof THREE.MeshStandardMaterial) {
    child.material.roughness = Math.min(child.material.roughness, 0.35);
    child.material.metalness = Math.max(child.material.metalness, 0.05);
    child.material.envMapIntensity = 1.2;
    child.material.side = THREE.DoubleSide;
}
```

| 属性 | 约束 | 用途 |
|------|------|------|
| `roughness`（粗糙度） | 上限 **0.35** | 确保表面呈现抛光反射效果，而非哑光 |
| `metalness`（金属度） | 下限 **0.05** | 即使非金属表面也添加微妙的金属反射 |
| `envMapIntensity`（环境贴图强度） | 设为 **1.2** | 增强 HDR 环境反射，使细节更加可见 |
| `side`（渲染面） | `DoubleSide` | 防止薄壁解剖结构出现面片缺失 |

### 为何选择这些数值

从分割流水线导出的医学 GLB 模型通常默认粗糙度为 1.0（完全哑光）、金属度为 0.0（无反射），看起来像泥塑。将粗糙度限制在 0.35 并添加最小金属度后，模型获得了可见的表面细节和材质质感，同时不会显得过度反光。

---

## 5. 背景渐晕

使用渐变渐晕背景替代纯色背景：

- **颜色 1**：`#5454ad`（紫蓝色）
- **颜色 2**：`#18e5a7`（青绿色）
- **颗粒度**：`0.001`（微弱噪点，防止色带效应）
- **渲染顺序**：`-1`（在所有场景对象后面渲染）

提供专业、不分散注意力的背景，与解剖模型形成良好对比。

---

## 6. GUI 控制面板

所有光照和渲染参数通过 dat.GUI 面板暴露，支持实时调节：

- **光照**：开关切换、环境光/方向光强度（0-4）和颜色调节
- **曝光度**：色调映射曝光度滑块
- **背景**：渐变颜色选择器
- **线框模式**：切换开关
- **模型可见性**：逐网格切换

---

## 架构示意图

```
Camera（相机）
├── AmbientLight 环境光 (强度: 0.8)
├── DirectionalLight [主光] (强度: 1.0, 位置: 前方偏右)
├── DirectionalLight [补光] (强度: 0.4, 位置: 后方偏左)
└── DirectionalLight [顶光] (强度: 0.5, 位置: 正上方)

Scene（场景）
├── HemisphereLight 半球光 (强度: 0.6)
├── HDR 环境贴图 (venice_sunset_1k.hdr → PMREMGenerator)
├── 渐晕背景 (渲染顺序: -1)
└── GLB 模型
    └── MeshStandardMaterial (粗糙度 ≤ 0.35, 金属度 ≥ 0.05, 环境贴图强度: 1.2)

Renderer（渲染器）
├── ACES 电影色调映射
├── 曝光度: 1.8
├── SRGB 色彩空间
└── 像素比: min(devicePixelRatio, 2)
```

---

## 改动总结

| 问题 | 解决方案 | 修改文件 |
|------|----------|----------|
| 模型暗淡/扁平 | PBR 材质参数约束 + HDR 环境贴图 | `copperScene.ts` |
| 场景整体过暗 | ACES 色调映射 + 曝光度 1.8 | `baseRenderer.ts` |
| 模型顶部发黑 | 添加专用顶光 | `baseScene.ts` |
| 表面无反射 | HDR 环境贴图 + envMapIntensity 1.2 | `baseRenderer.ts`, `copperScene.ts` |
| 阴影过硬 | 多光源系统 + 补光 | `baseScene.ts` |
| 旋转时光照变化 | 光源挂载到相机 | `baseScene.ts` |
