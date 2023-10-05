[copper3d](../README.md) / [Modules](../modules.md) / [Renderer/copperMSceneRenderer](../modules/Renderer_copperMSceneRenderer.md) / copperMSceneRenderer

# Class: copperMSceneRenderer

[Renderer/copperMSceneRenderer](../modules/Renderer_copperMSceneRenderer.md).copperMSceneRenderer

## Table of contents

### Constructors

- [constructor](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#constructor)

### Properties

- [cameras](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#cameras)
- [canvas](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#canvas)
- [container](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#container)
- [elems](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#elems)
- [numberOfScene](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#numberofscene)
- [pmremGenerator](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#pmremgenerator)
- [renderer](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#renderer)
- [sceneInfos](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#sceneinfos)
- [scenes](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#scenes)

### Methods

- [animate](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#animate)
- [getCubeMapTexture](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#getcubemaptexture)
- [init](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#init)
- [renderSceneInfo](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#rendersceneinfo)
- [resizeRendererToDisplaySize](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#resizerenderertodisplaysize)
- [updateEnvironment](Renderer_copperMSceneRenderer.copperMSceneRenderer.md#updateenvironment)

## Constructors

### constructor

• **new copperMSceneRenderer**(`container`, `numberOfScene`, `cameraPosition?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `numberOfScene` | `number` |
| `cameraPosition?` | `positionType` |

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L21)

## Properties

### cameras

• **cameras**: `PerspectiveCamera`[]

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:12](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L12)

___

### canvas

• **canvas**: `HTMLCanvasElement`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:17](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L17)

___

### container

• **container**: `HTMLDivElement`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:9](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L9)

___

### elems

• **elems**: `HTMLDivElement`[]

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:10](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L10)

___

### numberOfScene

• **numberOfScene**: `number`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:8](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L8)

___

### pmremGenerator

• **pmremGenerator**: `PMREMGenerator`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:19](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L19)

___

### renderer

• **renderer**: `WebGLRenderer`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:13](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L13)

___

### sceneInfos

• **sceneInfos**: [`copperMScene`](Scene_copperMScene.copperMScene.md)[]

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:18](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L18)

___

### scenes

• **scenes**: `Scene`[]

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:11](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L11)

## Methods

### animate

▸ **animate**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:139](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L139)

___

### getCubeMapTexture

▸ `Private` **getCubeMapTexture**(`environment`): `Promise`<`unknown`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `environment` | `environmentType` |

#### Returns

`Promise`<`unknown`\>

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:76](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L76)

___

### init

▸ **init**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L39)

___

### renderSceneInfo

▸ **renderSceneInfo**(`sceneInfo`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sceneInfo` | [`copperMScene`](Scene_copperMScene.copperMScene.md) |

#### Returns

`void`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:94](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L94)

___

### resizeRendererToDisplaySize

▸ **resizeRendererToDisplaySize**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:117](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L117)

___

### updateEnvironment

▸ **updateEnvironment**(`sceneIn`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sceneIn` | [`copperMScene`](Scene_copperMScene.copperMScene.md) |

#### Returns

`void`

#### Defined in

[src/Renderer/copperMSceneRenderer.ts:64](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperMSceneRenderer.ts#L64)
