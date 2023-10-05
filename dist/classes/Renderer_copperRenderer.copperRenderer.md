[copper3d](../README.md) / [Modules](../modules.md) / [Renderer/copperRenderer](../modules/Renderer_copperRenderer.md) / copperRenderer

# Class: copperRenderer

[Renderer/copperRenderer](../modules/Renderer_copperRenderer.md).copperRenderer

## Hierarchy

- [`baseRenderer`](Renderer_baseRenderer.baseRenderer.md)

  ↳ **`copperRenderer`**

## Table of contents

### Constructors

- [constructor](Renderer_copperRenderer.copperRenderer.md#constructor)

### Properties

- [container](Renderer_copperRenderer.copperRenderer.md#container)
- [currentScene](Renderer_copperRenderer.copperRenderer.md#currentscene)
- [delta](Renderer_copperRenderer.copperRenderer.md#delta)
- [fps](Renderer_copperRenderer.copperRenderer.md#fps)
- [gui](Renderer_copperRenderer.copperRenderer.md#gui)
- [interval](Renderer_copperRenderer.copperRenderer.md#interval)
- [options](Renderer_copperRenderer.copperRenderer.md#options)
- [pmremGenerator](Renderer_copperRenderer.copperRenderer.md#pmremgenerator)
- [preRenderCallbackFunctions](Renderer_copperRenderer.copperRenderer.md#prerendercallbackfunctions)
- [renderClock](Renderer_copperRenderer.copperRenderer.md#renderclock)
- [renderer](Renderer_copperRenderer.copperRenderer.md#renderer)
- [sceneMap](Renderer_copperRenderer.copperRenderer.md#scenemap)
- [stats](Renderer_copperRenderer.copperRenderer.md#stats)

### Methods

- [addGui](Renderer_copperRenderer.copperRenderer.md#addgui)
- [addPreRenderCallbackFunction](Renderer_copperRenderer.copperRenderer.md#addprerendercallbackfunction)
- [animate](Renderer_copperRenderer.copperRenderer.md#animate)
- [closeGui](Renderer_copperRenderer.copperRenderer.md#closegui)
- [createScene](Renderer_copperRenderer.copperRenderer.md#createscene)
- [getCurrentScene](Renderer_copperRenderer.copperRenderer.md#getcurrentscene)
- [getSceneByName](Renderer_copperRenderer.copperRenderer.md#getscenebyname)
- [hideGui](Renderer_copperRenderer.copperRenderer.md#hidegui)
- [init](Renderer_copperRenderer.copperRenderer.md#init)
- [onWindowResize](Renderer_copperRenderer.copperRenderer.md#onwindowresize)
- [render](Renderer_copperRenderer.copperRenderer.md#render)
- [setClearColor](Renderer_copperRenderer.copperRenderer.md#setclearcolor)
- [setCurrentScene](Renderer_copperRenderer.copperRenderer.md#setcurrentscene)
- [setFPS](Renderer_copperRenderer.copperRenderer.md#setfps)
- [updateEnvironment](Renderer_copperRenderer.copperRenderer.md#updateenvironment)
- [updateGui](Renderer_copperRenderer.copperRenderer.md#updategui)

## Constructors

### constructor

• **new copperRenderer**(`container`, `options?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `options?` | `ICopperRenderOpt` |

#### Overrides

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[constructor](Renderer_baseRenderer.baseRenderer.md#constructor)

#### Defined in

[src/Renderer/copperRenderer.ts:19](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L19)

## Properties

### container

• **container**: `HTMLDivElement`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[container](Renderer_baseRenderer.baseRenderer.md#container)

#### Defined in

[src/Renderer/baseRenderer.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L15)

___

### currentScene

• **currentScene**: [`baseScene`](Scene_baseScene.baseScene.md)

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[currentScene](Renderer_baseRenderer.baseRenderer.md#currentscene)

#### Defined in

[src/Renderer/baseRenderer.ts:20](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L20)

___

### delta

• `Private` **delta**: `number` = `0`

#### Defined in

[src/Renderer/copperRenderer.ts:14](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L14)

___

### fps

• `Private` **fps**: `number` = `30`

#### Defined in

[src/Renderer/copperRenderer.ts:12](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L12)

___

### gui

• **gui**: ``null`` \| `GUI`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[gui](Renderer_baseRenderer.baseRenderer.md#gui)

#### Defined in

[src/Renderer/baseRenderer.ts:17](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L17)

___

### interval

• `Private` **interval**: `number`

#### Defined in

[src/Renderer/copperRenderer.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L15)

___

### options

• **options**: `undefined` \| `ICopperRenderOpt`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[options](Renderer_baseRenderer.baseRenderer.md#options)

#### Defined in

[src/Renderer/baseRenderer.ts:23](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L23)

___

### pmremGenerator

• **pmremGenerator**: `PMREMGenerator`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[pmremGenerator](Renderer_baseRenderer.baseRenderer.md#pmremgenerator)

#### Defined in

[src/Renderer/baseRenderer.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L21)

___

### preRenderCallbackFunctions

• **preRenderCallbackFunctions**: `Function`[] = `[]`

#### Defined in

[src/Renderer/copperRenderer.ts:17](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L17)

___

### renderClock

• `Private` **renderClock**: `Clock`

#### Defined in

[src/Renderer/copperRenderer.ts:13](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L13)

___

### renderer

• **renderer**: `WebGLRenderer`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[renderer](Renderer_baseRenderer.baseRenderer.md#renderer)

#### Defined in

[src/Renderer/baseRenderer.ts:16](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L16)

___

### sceneMap

• `Private` **sceneMap**: `SceneMapType` = `{}`

#### Defined in

[src/Renderer/copperRenderer.ts:11](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L11)

___

### stats

• **stats**: `Stats`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[stats](Renderer_baseRenderer.baseRenderer.md#stats)

#### Defined in

[src/Renderer/baseRenderer.ts:18](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L18)

## Methods

### addGui

▸ **addGui**(): `void`

#### Returns

`void`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[addGui](Renderer_baseRenderer.baseRenderer.md#addgui)

#### Defined in

[src/Renderer/baseRenderer.ts:140](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L140)

___

### addPreRenderCallbackFunction

▸ **addPreRenderCallbackFunction**(`callbackFunction`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackFunction` | `Function` |

#### Returns

`void`

#### Defined in

[src/Renderer/copperRenderer.ts:58](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L58)

___

### animate

▸ **animate**(`time?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `time?` | `number` |

#### Returns

`void`

#### Defined in

[src/Renderer/copperRenderer.ts:64](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L64)

___

### closeGui

▸ **closeGui**(): `void`

#### Returns

`void`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[closeGui](Renderer_baseRenderer.baseRenderer.md#closegui)

#### Defined in

[src/Renderer/baseRenderer.ts:132](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L132)

___

### createScene

▸ **createScene**(`name`): `undefined` \| [`copperScene`](Scene_copperScene.copperScene.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`undefined` \| [`copperScene`](Scene_copperScene.copperScene.md)

#### Defined in

[src/Renderer/copperRenderer.ts:41](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L41)

___

### getCurrentScene

▸ **getCurrentScene**(): [`baseScene`](Scene_baseScene.baseScene.md)

#### Returns

[`baseScene`](Scene_baseScene.baseScene.md)

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[getCurrentScene](Renderer_baseRenderer.baseRenderer.md#getcurrentscene)

#### Defined in

[src/Renderer/baseRenderer.ts:126](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L126)

___

### getSceneByName

▸ **getSceneByName**(`name`): [`copperScene`](Scene_copperScene.copperScene.md) \| [`baseScene`](Scene_baseScene.baseScene.md) \| [`copperMScene`](Scene_copperMScene.copperMScene.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

[`copperScene`](Scene_copperScene.copperScene.md) \| [`baseScene`](Scene_baseScene.baseScene.md) \| [`copperMScene`](Scene_copperMScene.copperMScene.md)

#### Defined in

[src/Renderer/copperRenderer.ts:23](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L23)

___

### hideGui

▸ **hideGui**(): `void`

#### Returns

`void`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[hideGui](Renderer_baseRenderer.baseRenderer.md#hidegui)

#### Defined in

[src/Renderer/baseRenderer.ts:129](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L129)

___

### init

▸ **init**(): `void`

#### Returns

`void`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[init](Renderer_baseRenderer.baseRenderer.md#init)

#### Defined in

[src/Renderer/baseRenderer.ts:83](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L83)

___

### onWindowResize

▸ **onWindowResize**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/copperRenderer.ts:62](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L62)

___

### render

▸ **render**(): `void`

#### Returns

`void`

#### Defined in

[src/Renderer/copperRenderer.ts:89](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L89)

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

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[setClearColor](Renderer_baseRenderer.baseRenderer.md#setclearcolor)

#### Defined in

[src/Renderer/baseRenderer.ts:136](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L136)

___

### setCurrentScene

▸ **setCurrentScene**(`sceneIn`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sceneIn` | [`copperScene`](Scene_copperScene.copperScene.md) |

#### Returns

`void`

#### Defined in

[src/Renderer/copperRenderer.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L31)

___

### setFPS

▸ **setFPS**(`fps`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fps` | `number` |

#### Returns

`void`

#### Defined in

[src/Renderer/copperRenderer.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/copperRenderer.ts#L27)

___

### updateEnvironment

▸ **updateEnvironment**(`vignette?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `vignette?` | `customMeshType` |

#### Returns

`void`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[updateEnvironment](Renderer_baseRenderer.baseRenderer.md#updateenvironment)

#### Defined in

[src/Renderer/baseRenderer.ts:95](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L95)

___

### updateGui

▸ **updateGui**(): `void`

#### Returns

`void`

#### Inherited from

[baseRenderer](Renderer_baseRenderer.baseRenderer.md).[updateGui](Renderer_baseRenderer.baseRenderer.md#updategui)

#### Defined in

[src/Renderer/baseRenderer.ts:198](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Renderer/baseRenderer.ts#L198)
