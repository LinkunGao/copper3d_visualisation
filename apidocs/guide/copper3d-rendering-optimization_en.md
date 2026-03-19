# Copper3D GLB Rendering Optimization

## Overview

This document describes the rendering optimizations applied to the Copper3D library's Three.js pipeline to improve GLB model visual quality in the medical image annotator. The original rendering produced dull, dark, and detail-less models. The following changes address lighting, tone mapping, material enhancement, and environment mapping.

---

## 1. Renderer Settings (`baseRenderer.ts`)

### Tone Mapping & Exposure

| Setting | Before | After |
|---------|--------|-------|
| Tone Mapping | Default (Linear) | `THREE.ACESFilmicToneMapping` |
| Tone Mapping Exposure | 1.0 | **1.8** |
| Output Color Space | Default | `THREE.SRGBColorSpace` |
| Pixel Ratio | `window.devicePixelRatio` | `Math.min(window.devicePixelRatio, 2)` |

- **ACES Filmic Tone Mapping**: Industry-standard cinematic tone mapping that provides better contrast and color reproduction compared to linear mapping. It compresses highlights naturally while preserving shadow detail.
- **Exposure 1.8**: Significantly brighter than default (1.0), compensating for the overall dark appearance.
- **SRGBColorSpace**: Ensures correct gamma-aware color output for displays.

---

## 2. Multi-Light System (`baseScene.ts`)

The original single-light or minimal-light setup left large areas of the model in darkness (especially the top). A 5-light system was implemented:

### Light Configuration

| Light | Type | Color | Intensity | Position | Attached To |
|-------|------|-------|-----------|----------|-------------|
| Hemisphere | HemisphereLight | Sky: `#ddeeff`, Ground: `#0f0e0d` | 0.6 | Scene root | Scene |
| Ambient | AmbientLight | `#606060` | 0.8 | - | Camera |
| Key (Main) | DirectionalLight | `#ffffff` | 1.0 | `(0.5, 0.5, 0.866)` | Camera |
| Fill | DirectionalLight | `#ffffff` | 0.4 | `(-0.5, -0.2, -0.866)` | Camera |
| Top | DirectionalLight | `#ffffff` | 0.5 | `(0, 1, 0.2)` | Camera |

### Design Rationale

- **Camera-attached lights**: All directional lights and the ambient light are children of the camera, so lighting remains consistent regardless of orbit angle. The model always appears well-lit from the viewer's perspective.
- **Hemisphere Light**: Provides soft, omnidirectional ambient fill simulating sky/ground bounce light.
- **Key Light** (front-right): Primary modeling light that defines shape and surface detail.
- **Fill Light** (back-left): Reduces harsh shadows on the opposite side of the key light.
- **Top Light** (directly above): Specifically added to solve the dark-top problem where the crown of anatomical models was not receiving illumination.

---

## 3. HDR Environment Mapping (`baseRenderer.ts`)

### Setup

- **HDR Source**: `venice_sunset_1k.hdr` loaded via `RGBELoader`
- **Processing**: `PMREMGenerator` creates a pre-filtered, mipmapped radiance environment map
- **Application**:
  - `scene.environment` — used by PBR materials for realistic reflections
  - `scene.background` — provides a natural backdrop (overridden by vignette)

### Why HDR Environment Matters

PBR (Physically Based Rendering) materials in Three.js rely on environment maps for realistic reflections and ambient lighting. Without an environment map, metallic and reflective surfaces appear flat and black. The HDR environment provides:

- Realistic specular reflections on glossy surfaces
- Image-based lighting (IBL) that adds ambient detail
- Natural color variation in reflections

---

## 4. PBR Material Enhancement (`copperScene.ts`)

When GLB models are loaded via `loadPureGLB()`, materials are automatically optimized:

```typescript
if (child.material instanceof THREE.MeshStandardMaterial) {
    child.material.roughness = Math.min(child.material.roughness, 0.35);
    child.material.metalness = Math.max(child.material.metalness, 0.05);
    child.material.envMapIntensity = 1.2;
    child.material.side = THREE.DoubleSide;
}
```

| Property | Constraint | Purpose |
|----------|-----------|---------|
| `roughness` | Capped at **0.35** | Ensures surfaces appear polished and reflective, not matte |
| `metalness` | Minimum **0.05** | Adds subtle metallic reflection even to non-metal surfaces |
| `envMapIntensity` | Set to **1.2** | Boosts HDR environment reflections for more visible detail |
| `side` | `DoubleSide` | Prevents missing faces on thin anatomical structures |

### Why These Values

Medical GLB models exported from segmentation pipelines often have default roughness of 1.0 (completely matte) and metalness of 0.0 (no reflection). This makes them look like clay. By clamping roughness to 0.35 and adding minimal metalness, the models gain visible surface detail and a sense of material quality without appearing unrealistically shiny.

---

## 5. Background Vignette

A gradient vignette background replaces the plain color:

- **Color 1**: `#5454ad` (purple-blue)
- **Color 2**: `#18e5a7` (cyan-green)
- **Grain Scale**: `0.001` (subtle noise to prevent banding)
- **Render Order**: `-1` (behind all scene objects)

This provides a professional, non-distracting backdrop that contrasts well with anatomical models.

---

## 6. GUI Controls

All lighting and rendering parameters are exposed through a dat.GUI panel for real-time adjustment:

- **Lights**: Toggle on/off, adjust ambient/directional intensity (0-4) and color
- **Exposure**: Tone mapping exposure slider
- **Background**: Gradient color pickers
- **Wireframe**: Toggle mode
- **Model Visibility**: Per-mesh toggle

---

## Architecture Diagram

```
Camera
├── AmbientLight (intensity: 0.8)
├── DirectionalLight [Key] (intensity: 1.0, pos: front-right)
├── DirectionalLight [Fill] (intensity: 0.4, pos: back-left)
└── DirectionalLight [Top] (intensity: 0.5, pos: above)

Scene
├── HemisphereLight (intensity: 0.6)
├── HDR Environment (venice_sunset_1k.hdr → PMREMGenerator)
├── Vignette Background (render order: -1)
└── GLB Model
    └── MeshStandardMaterial (roughness ≤ 0.35, metalness ≥ 0.05, envMapIntensity: 1.2)

Renderer
├── ACESFilmicToneMapping
├── Exposure: 1.8
├── SRGBColorSpace
└── Pixel Ratio: min(devicePixelRatio, 2)
```

---

## Summary of Impact

| Problem | Solution | Files Modified |
|---------|----------|----------------|
| Model looks dull/flat | PBR material clamping + HDR environment | `copperScene.ts` |
| Scene too dark | ACES tone mapping + exposure 1.8 | `baseRenderer.ts` |
| Top of model is black | Added dedicated top light | `baseScene.ts` |
| No surface reflections | HDR environment map + envMapIntensity 1.2 | `baseRenderer.ts`, `copperScene.ts` |
| Harsh shadows | Multi-light system with fill light | `baseScene.ts` |
| Lighting changes with rotation | Camera-attached lights | `baseScene.ts` |
