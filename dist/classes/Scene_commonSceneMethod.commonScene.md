[copper3d](../README.md) / [Modules](../modules.md) / [Scene/commonSceneMethod](../modules/Scene_commonSceneMethod.md) / commonScene

# Class: commonScene

[Scene/commonSceneMethod](../modules/Scene_commonSceneMethod.md).commonScene

## Hierarchy

- **`commonScene`**

  ↳ [`baseScene`](Scene_baseScene.baseScene.md)

  ↳ [`copperMScene`](Scene_copperMScene.copperMScene.md)

## Table of contents

### Constructors

- [constructor](Scene_commonSceneMethod.commonScene.md#constructor)

### Properties

- [camera](Scene_commonSceneMethod.commonScene.md#camera)
- [container](Scene_commonSceneMethod.commonScene.md#container)
- [controls](Scene_commonSceneMethod.commonScene.md#controls)
- [copperOrthographicCamera](Scene_commonSceneMethod.commonScene.md#copperorthographiccamera)
- [copperPerspectiveCamera](Scene_commonSceneMethod.commonScene.md#copperperspectivecamera)
- [depthStep](Scene_commonSceneMethod.commonScene.md#depthstep)
- [pickableObjects](Scene_commonSceneMethod.commonScene.md#pickableobjects)
- [preRenderCallbackFunctions](Scene_commonSceneMethod.commonScene.md#prerendercallbackfunctions)
- [renderNrrdVolume](Scene_commonSceneMethod.commonScene.md#rendernrrdvolume)
- [scene](Scene_commonSceneMethod.commonScene.md#scene)
- [sort](Scene_commonSceneMethod.commonScene.md#sort)
- [subCamera](Scene_commonSceneMethod.commonScene.md#subcamera)
- [subCopperControl](Scene_commonSceneMethod.commonScene.md#subcoppercontrol)
- [subDiv](Scene_commonSceneMethod.commonScene.md#subdiv)
- [subRender](Scene_commonSceneMethod.commonScene.md#subrender)
- [subScene](Scene_commonSceneMethod.commonScene.md#subscene)

### Methods

- [addObject](Scene_commonSceneMethod.commonScene.md#addobject)
- [addPreRenderCallbackFunction](Scene_commonSceneMethod.commonScene.md#addprerendercallbackfunction)
- [addSubView](Scene_commonSceneMethod.commonScene.md#addsubview)
- [createDemoMesh](Scene_commonSceneMethod.commonScene.md#createdemomesh)
- [loadDicom](Scene_commonSceneMethod.commonScene.md#loaddicom)
- [loadNrrd](Scene_commonSceneMethod.commonScene.md#loadnrrd)
- [loadNrrdTexture3d](Scene_commonSceneMethod.commonScene.md#loadnrrdtexture3d)
- [loadOBJ](Scene_commonSceneMethod.commonScene.md#loadobj)
- [pickModel](Scene_commonSceneMethod.commonScene.md#pickmodel)
- [pickSpecifiedModel](Scene_commonSceneMethod.commonScene.md#pickspecifiedmodel)
- [removePreRenderCallbackFunction](Scene_commonSceneMethod.commonScene.md#removeprerendercallbackfunction)
- [setDepth](Scene_commonSceneMethod.commonScene.md#setdepth)
- [setDicomFilesOrder](Scene_commonSceneMethod.commonScene.md#setdicomfilesorder)
- [updateControls](Scene_commonSceneMethod.commonScene.md#updatecontrols)

## Constructors

### constructor

• **new commonScene**(`container`, `opt?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `opt?` | `ICopperSceneOpts` |

#### Defined in

[src/Scene/commonSceneMethod.ts:48](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L48)

## Properties

### camera

• **camera**: `PerspectiveCamera` \| `OrthographicCamera`

#### Defined in

[src/Scene/commonSceneMethod.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L29)

___

### container

• **container**: `HTMLDivElement`

#### Defined in

[src/Scene/commonSceneMethod.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L27)

___

### controls

• **controls**: [`Copper3dTrackballControls`](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md) \| `OrbitControls` \| `TrackballControls`

#### Defined in

[src/Scene/commonSceneMethod.ts:37](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L37)

___

### copperOrthographicCamera

• **copperOrthographicCamera**: `OrthographicCamera`

#### Defined in

[src/Scene/commonSceneMethod.ts:32](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L32)

___

### copperPerspectiveCamera

• **copperPerspectiveCamera**: `PerspectiveCamera`

#### Defined in

[src/Scene/commonSceneMethod.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L31)

___

### depthStep

• `Protected` **depthStep**: `number` = `0.4`

#### Defined in

[src/Scene/commonSceneMethod.ts:44](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L44)

___

### pickableObjects

• `Protected` **pickableObjects**: `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\>[] = `[]`

#### Defined in

[src/Scene/commonSceneMethod.ts:46](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L46)

___

### preRenderCallbackFunctions

• `Protected` **preRenderCallbackFunctions**: `preRenderCallbackFunctionType`

#### Defined in

[src/Scene/commonSceneMethod.ts:42](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L42)

___

### renderNrrdVolume

• `Protected` **renderNrrdVolume**: `boolean` = `false`

#### Defined in

[src/Scene/commonSceneMethod.ts:40](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L40)

___

### scene

• **scene**: `Scene`

#### Defined in

[src/Scene/commonSceneMethod.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L28)

___

### sort

• `Protected` **sort**: `boolean` = `true`

#### Defined in

[src/Scene/commonSceneMethod.ts:43](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L43)

___

### subCamera

• **subCamera**: ``null`` \| `PerspectiveCamera` = `null`

#### Defined in

[src/Scene/commonSceneMethod.ts:36](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L36)

___

### subCopperControl

• `Protected` **subCopperControl**: ``null`` \| [`Controls`](Controls_copperControls.Controls.md) = `null`

#### Defined in

[src/Scene/commonSceneMethod.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L39)

___

### subDiv

• **subDiv**: ``null`` \| `HTMLDivElement` = `null`

#### Defined in

[src/Scene/commonSceneMethod.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L34)

___

### subRender

• `Protected` **subRender**: ``null`` \| `WebGLRenderer` = `null`

#### Defined in

[src/Scene/commonSceneMethod.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L38)

___

### subScene

• **subScene**: `Scene`

#### Defined in

[src/Scene/commonSceneMethod.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L35)

## Methods

### addObject

▸ **addObject**(`obj`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:107](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L107)

___

### addPreRenderCallbackFunction

▸ **addPreRenderCallbackFunction**(`callbackFunction`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackFunction` | `Function` |

#### Returns

`number`

#### Defined in

[src/Scene/commonSceneMethod.ts:122](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L122)

___

### addSubView

▸ **addSubView**(): `HTMLDivElement`

create a new sub view to display models

#### Returns

`HTMLDivElement`

#### Defined in

[src/Scene/commonSceneMethod.ts:174](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L174)

___

### createDemoMesh

▸ **createDemoMesh**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:96](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L96)

___

### loadDicom

▸ **loadDicom**(`urls`, `opts?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `urls` | `string` \| `string`[] |
| `opts?` | `dicomLoaderOptsType` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:198](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L198)

___

### loadNrrd

▸ **loadNrrd**(`url`, `loadingBar`, `segmentation`, `callback?`, `opts?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `loadingBar` | `loadingBarType` |
| `segmentation` | `boolean` |
| `callback?` | (`volume`: `any`, `nrrdMeshes`: `nrrdMeshesType`, `nrrdSlices`: `nrrdSliceType`, `gui?`: `GUI`) => `void` |
| `opts?` | [`optsType`](../interfaces/Loader_copperNrrdLoader.optsType.md) |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:314](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L314)

___

### loadNrrdTexture3d

▸ **loadNrrdTexture3d**(`url`, `callback?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `callback?` | (`volume`: `any`, `gui?`: `GUI`) => `void` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:338](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L338)

___

### loadOBJ

▸ **loadOBJ**(`url`, `callback?`, `opts?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `callback?` | (`mesh`: `Group`) => `void` |
| `opts?` | `Object` |
| `opts.color` | `string` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:350](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L350)

___

### pickModel

▸ **pickModel**(`content`, `callback`, `options?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `content` | `Group` |
| `callback` | (`selectMesh`: `undefined` \| `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\>) => `void` |
| `options?` | `string`[] |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:132](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L132)

___

### pickSpecifiedModel

▸ **pickSpecifiedModel**(`content`, `mousePosition`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `content` | `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\> \| `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\>[] |
| `mousePosition` | `mouseMovePositionType` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `intersectedObject` | ``null`` \| `Object3D`<`Event`\> |
| `intersects` | `Intersection`<`Object3D`<`Event`\>\>[] |

#### Defined in

[src/Scene/commonSceneMethod.ts:154](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L154)

___

### removePreRenderCallbackFunction

▸ **removePreRenderCallbackFunction**(`id`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `number` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:128](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L128)

___

### setDepth

▸ **setDepth**(`value`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `number` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:111](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L111)

___

### setDicomFilesOrder

▸ **setDicomFilesOrder**(`value`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `value` | ``"ascending"`` \| ``"descending"`` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:114](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L114)

___

### updateControls

▸ **updateControls**(`camera`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `camera` | `PerspectiveCamera` \| `OrthographicCamera` |

#### Returns

`void`

#### Defined in

[src/Scene/commonSceneMethod.ts:329](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L329)
