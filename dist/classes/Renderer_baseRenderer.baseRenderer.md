[copper3d](../README.md) / [Modules](../modules.md) / [Renderer/baseRenderer](../modules/Renderer_baseRenderer.md) / baseRenderer

# Class: baseRenderer

[Renderer/baseRenderer](../modules/Renderer_baseRenderer.md).baseRenderer

## Hierarchy

- **`baseRenderer`**

  ↳ [`copperRenderer`](Renderer_copperRenderer.copperRenderer.md)

## Table of contents

### Constructors

- [constructor](Renderer_baseRenderer.baseRenderer.md#constructor)

### Properties

- [cameraFolder](Renderer_baseRenderer.baseRenderer.md#camerafolder)
- [container](Renderer_baseRenderer.baseRenderer.md#container)
- [currentScene](Renderer_baseRenderer.baseRenderer.md#currentscene)
- [gui](Renderer_baseRenderer.baseRenderer.md#gui)
- [options](Renderer_baseRenderer.baseRenderer.md#options)
- [pmremGenerator](Renderer_baseRenderer.baseRenderer.md#pmremgenerator)
- [renderer](Renderer_baseRenderer.baseRenderer.md#renderer)
- [state](Renderer_baseRenderer.baseRenderer.md#state)
- [stats](Renderer_baseRenderer.baseRenderer.md#stats)
- [visualCtrls](Renderer_baseRenderer.baseRenderer.md#visualctrls)
- [visualiseFolder](Renderer_baseRenderer.baseRenderer.md#visualisefolder)

### Methods

- [addGui](Renderer_baseRenderer.baseRenderer.md#addgui)
- [closeGui](Renderer_baseRenderer.baseRenderer.md#closegui)
- [getCubeMapTexture](Renderer_baseRenderer.baseRenderer.md#getcubemaptexture)
- [getCurrentScene](Renderer_baseRenderer.baseRenderer.md#getcurrentscene)
- [hideGui](Renderer_baseRenderer.baseRenderer.md#hidegui)
- [init](Renderer_baseRenderer.baseRenderer.md#init)
- [setClearColor](Renderer_baseRenderer.baseRenderer.md#setclearcolor)
- [updateEnvironment](Renderer_baseRenderer.baseRenderer.md#updateenvironment)
- [updateGui](Renderer_baseRenderer.baseRenderer.md#updategui)

## Constructors

### constructor

• **new baseRenderer**(`container`, `options?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `options?` | `ICopperRenderOpt` |

#### Defined in

[src/Renderer/baseRenderer.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L31)

## Properties

### cameraFolder

• `Private` **cameraFolder**: ``null`` \| `GUI`

#### Defined in

[src/Renderer/baseRenderer.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L29)

___

### container

• **container**: `HTMLDivElement`

#### Defined in

[src/Renderer/baseRenderer.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L15)

___

### currentScene

• **currentScene**: [`baseScene`](Scene_baseScene.baseScene.md)

#### Defined in

[src/Renderer/baseRenderer.ts:20](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L20)

___

### gui

• **gui**: ``null`` \| `GUI`

#### Defined in

[src/Renderer/baseRenderer.ts:17](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L17)

___

### options

• **options**: `undefined` \| `ICopperRenderOpt`

#### Defined in

[src/Renderer/baseRenderer.ts:23](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L23)

___

### pmremGenerator

• **pmremGenerator**: `PMREMGenerator`

#### Defined in

[src/Renderer/baseRenderer.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L21)

___

### renderer

• **renderer**: `WebGLRenderer`

#### Defined in

[src/Renderer/baseRenderer.ts:16](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L16)

___

### state

• `Private` **state**: `stateType`

#### Defined in

[src/Renderer/baseRenderer.ts:24](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L24)

___

### stats

• **stats**: `Stats`

#### Defined in

[src/Renderer/baseRenderer.ts:18](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L18)

___

### visualCtrls

• `Private` **visualCtrls**: `GUIController`<`object`\>[] = `[]`

#### Defined in

[src/Renderer/baseRenderer.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L28)

___

### visualiseFolder

• `Private` **visualiseFolder**: ``null`` \| `GUI`

#### Defined in

[src/Renderer/baseRenderer.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L27)

## Methods

### addGui

▸ **addGui**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:140](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L140)

___

### closeGui

▸ **closeGui**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:132](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L132)

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

[src/Renderer/baseRenderer.ts:108](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L108)

___

### getCurrentScene

▸ **getCurrentScene**(): [`baseScene`](Scene_baseScene.baseScene.md)

#### Returns

[`baseScene`](Scene_baseScene.baseScene.md)

#### Defined in

[src/Renderer/baseRenderer.ts:126](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L126)

___

### hideGui

▸ **hideGui**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:129](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L129)

___

### init

▸ **init**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:83](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L83)

___

### setClearColor

▸ **setClearColor**(`clearColor?`, `alpha?`): `void`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `clearColor` | `number` | `0x000000` |
| `alpha` | `number` | `0` |

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:136](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L136)

___

### updateEnvironment

▸ **updateEnvironment**(`vignette?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `vignette?` | `customMeshType` |

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:95](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L95)

___

### updateGui

▸ **updateGui**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/baseRenderer.ts:198](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L198)
