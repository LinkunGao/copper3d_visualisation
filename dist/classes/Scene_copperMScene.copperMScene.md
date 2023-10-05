[copper3d](../README.md) / [Modules](../modules.md) / [Scene/copperMScene](../modules/Scene_copperMScene.md) / copperMScene

# Class: copperMScene

[Scene/copperMScene](../modules/Scene_copperMScene.md).copperMScene

## Hierarchy

- [`commonScene`](Scene_commonSceneMethod.commonScene.md)

  ↳ **`copperMScene`**

## Table of contents

### Constructors

- [constructor](Scene_copperMScene.copperMScene.md#constructor)

### Properties

- [ambientLight](Scene_copperMScene.copperMScene.md#ambientlight)
- [camera](Scene_copperMScene.copperMScene.md#camera)
- [cameraPositionFlag](Scene_copperMScene.copperMScene.md#camerapositionflag)
- [color1](Scene_copperMScene.copperMScene.md#color1)
- [color2](Scene_copperMScene.copperMScene.md#color2)
- [container](Scene_copperMScene.copperMScene.md#container)
- [content](Scene_copperMScene.copperMScene.md#content)
- [controls](Scene_copperMScene.copperMScene.md#controls)
- [copperControl](Scene_copperMScene.copperMScene.md#coppercontrol)
- [copperOrthographicCamera](Scene_copperMScene.copperMScene.md#copperorthographiccamera)
- [copperPerspectiveCamera](Scene_copperMScene.copperMScene.md#copperperspectivecamera)
- [depthStep](Scene_copperMScene.copperMScene.md#depthstep)
- [directionalLight](Scene_copperMScene.copperMScene.md#directionallight)
- [gui](Scene_copperMScene.copperMScene.md#gui)
- [guiContainer](Scene_copperMScene.copperMScene.md#guicontainer)
- [isHalfed](Scene_copperMScene.copperMScene.md#ishalfed)
- [lights](Scene_copperMScene.copperMScene.md#lights)
- [pickableObjects](Scene_copperMScene.copperMScene.md#pickableobjects)
- [preRenderCallbackFunctions](Scene_copperMScene.copperMScene.md#prerendercallbackfunctions)
- [renderNrrdVolume](Scene_copperMScene.copperMScene.md#rendernrrdvolume)
- [renderer](Scene_copperMScene.copperMScene.md#renderer)
- [scene](Scene_copperMScene.copperMScene.md#scene)
- [sceneName](Scene_copperMScene.copperMScene.md#scenename)
- [sort](Scene_copperMScene.copperMScene.md#sort)
- [subCamera](Scene_copperMScene.copperMScene.md#subcamera)
- [subCopperControl](Scene_copperMScene.copperMScene.md#subcoppercontrol)
- [subDiv](Scene_copperMScene.copperMScene.md#subdiv)
- [subRender](Scene_copperMScene.copperMScene.md#subrender)
- [subScene](Scene_copperMScene.copperMScene.md#subscene)
- [viewPoint](Scene_copperMScene.copperMScene.md#viewpoint)
- [vignette](Scene_copperMScene.copperMScene.md#vignette)

### Methods

- [addLights](Scene_copperMScene.copperMScene.md#addlights)
- [addObject](Scene_copperMScene.copperMScene.md#addobject)
- [addPreRenderCallbackFunction](Scene_copperMScene.copperMScene.md#addprerendercallbackfunction)
- [addSubView](Scene_copperMScene.copperMScene.md#addsubview)
- [createDemoMesh](Scene_copperMScene.copperMScene.md#createdemomesh)
- [drawWholeNrrd](Scene_copperMScene.copperMScene.md#drawwholenrrd)
- [init](Scene_copperMScene.copperMScene.md#init)
- [loadDicom](Scene_copperMScene.copperMScene.md#loaddicom)
- [loadGltf](Scene_copperMScene.copperMScene.md#loadgltf)
- [loadNrrd](Scene_copperMScene.copperMScene.md#loadnrrd)
- [loadNrrdTexture3d](Scene_copperMScene.copperMScene.md#loadnrrdtexture3d)
- [loadOBJ](Scene_copperMScene.copperMScene.md#loadobj)
- [loadView](Scene_copperMScene.copperMScene.md#loadview)
- [loadViewUrl](Scene_copperMScene.copperMScene.md#loadviewurl)
- [onWindowResize](Scene_copperMScene.copperMScene.md#onwindowresize)
- [pickModel](Scene_copperMScene.copperMScene.md#pickmodel)
- [pickSpecifiedModel](Scene_copperMScene.copperMScene.md#pickspecifiedmodel)
- [removeLights](Scene_copperMScene.copperMScene.md#removelights)
- [removePreRenderCallbackFunction](Scene_copperMScene.copperMScene.md#removeprerendercallbackfunction)
- [render](Scene_copperMScene.copperMScene.md#render)
- [resetView](Scene_copperMScene.copperMScene.md#resetview)
- [setCameraPosition](Scene_copperMScene.copperMScene.md#setcameraposition)
- [setControls](Scene_copperMScene.copperMScene.md#setcontrols)
- [setDepth](Scene_copperMScene.copperMScene.md#setdepth)
- [setDicomFilesOrder](Scene_copperMScene.copperMScene.md#setdicomfilesorder)
- [setViewPoint](Scene_copperMScene.copperMScene.md#setviewpoint)
- [updateBackground](Scene_copperMScene.copperMScene.md#updatebackground)
- [updateCamera](Scene_copperMScene.copperMScene.md#updatecamera)
- [updateControls](Scene_copperMScene.copperMScene.md#updatecontrols)

## Constructors

### constructor

• **new copperMScene**(`container`, `renderer`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `renderer` | `WebGLRenderer` |

#### Overrides

[commonScene](Scene_commonSceneMethod.commonScene.md).[constructor](Scene_commonSceneMethod.commonScene.md#constructor)

#### Defined in

[src/Scene/copperMScene.ts:51](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L51)

## Properties

### ambientLight

• **ambientLight**: `AmbientLight`

#### Defined in

[src/Scene/copperMScene.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L39)

___

### camera

• **camera**: `PerspectiveCamera` \| `OrthographicCamera`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[camera](Scene_commonSceneMethod.commonScene.md#camera)

#### Defined in

[src/Scene/commonSceneMethod.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L29)

___

### cameraPositionFlag

• **cameraPositionFlag**: `boolean` = `false`

#### Defined in

[src/Scene/copperMScene.ts:42](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L42)

___

### color1

• `Private` **color1**: `string` = `"#5454ad"`

#### Defined in

[src/Scene/copperMScene.ts:46](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L46)

___

### color2

• `Private` **color2**: `string` = `"#18e5a7"`

#### Defined in

[src/Scene/copperMScene.ts:47](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L47)

___

### container

• **container**: `HTMLDivElement`

#### Overrides

[commonScene](Scene_commonSceneMethod.commonScene.md).[container](Scene_commonSceneMethod.commonScene.md#container)

#### Defined in

[src/Scene/copperMScene.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L34)

___

### content

• **content**: `Group`

#### Defined in

[src/Scene/copperMScene.ts:43](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L43)

___

### controls

• **controls**: [`Copper3dTrackballControls`](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md) \| `OrbitControls` \| `TrackballControls`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[controls](Scene_commonSceneMethod.commonScene.md#controls)

#### Defined in

[src/Scene/commonSceneMethod.ts:37](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L37)

___

### copperControl

• **copperControl**: [`Controls`](Controls_copperControls.Controls.md)

#### Defined in

[src/Scene/copperMScene.ts:40](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L40)

___

### copperOrthographicCamera

• **copperOrthographicCamera**: `OrthographicCamera`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[copperOrthographicCamera](Scene_commonSceneMethod.commonScene.md#copperorthographiccamera)

#### Defined in

[src/Scene/commonSceneMethod.ts:32](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L32)

___

### copperPerspectiveCamera

• **copperPerspectiveCamera**: `PerspectiveCamera`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[copperPerspectiveCamera](Scene_commonSceneMethod.commonScene.md#copperperspectivecamera)

#### Defined in

[src/Scene/commonSceneMethod.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L31)

___

### depthStep

• `Protected` **depthStep**: `number` = `0.4`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[depthStep](Scene_commonSceneMethod.commonScene.md#depthstep)

#### Defined in

[src/Scene/commonSceneMethod.ts:44](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L44)

___

### directionalLight

• **directionalLight**: `DirectionalLight`

#### Defined in

[src/Scene/copperMScene.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L38)

___

### gui

• **gui**: `GUI`

#### Defined in

[src/Scene/copperMScene.ts:30](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L30)

___

### guiContainer

• `Private` **guiContainer**: `HTMLDivElement`

#### Defined in

[src/Scene/copperMScene.ts:49](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L49)

___

### isHalfed

• **isHalfed**: `boolean` = `false`

#### Defined in

[src/Scene/copperMScene.ts:44](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L44)

___

### lights

• `Private` **lights**: `any`[] = `[]`

#### Defined in

[src/Scene/copperMScene.ts:48](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L48)

___

### pickableObjects

• `Protected` **pickableObjects**: `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\>[] = `[]`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[pickableObjects](Scene_commonSceneMethod.commonScene.md#pickableobjects)

#### Defined in

[src/Scene/commonSceneMethod.ts:46](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L46)

___

### preRenderCallbackFunctions

• `Protected` **preRenderCallbackFunctions**: `preRenderCallbackFunctionType`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[preRenderCallbackFunctions](Scene_commonSceneMethod.commonScene.md#prerendercallbackfunctions)

#### Defined in

[src/Scene/commonSceneMethod.ts:42](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L42)

___

### renderNrrdVolume

• `Protected` **renderNrrdVolume**: `boolean` = `false`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[renderNrrdVolume](Scene_commonSceneMethod.commonScene.md#rendernrrdvolume)

#### Defined in

[src/Scene/commonSceneMethod.ts:40](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L40)

___

### renderer

• **renderer**: `WebGLRenderer`

#### Defined in

[src/Scene/copperMScene.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L35)

___

### scene

• **scene**: `Scene`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[scene](Scene_commonSceneMethod.commonScene.md#scene)

#### Defined in

[src/Scene/commonSceneMethod.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L28)

___

### sceneName

• **sceneName**: `string` = `""`

#### Defined in

[src/Scene/copperMScene.ts:36](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L36)

___

### sort

• `Protected` **sort**: `boolean` = `true`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[sort](Scene_commonSceneMethod.commonScene.md#sort)

#### Defined in

[src/Scene/commonSceneMethod.ts:43](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L43)

___

### subCamera

• **subCamera**: ``null`` \| `PerspectiveCamera` = `null`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[subCamera](Scene_commonSceneMethod.commonScene.md#subcamera)

#### Defined in

[src/Scene/commonSceneMethod.ts:36](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L36)

___

### subCopperControl

• `Protected` **subCopperControl**: ``null`` \| [`Controls`](Controls_copperControls.Controls.md) = `null`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[subCopperControl](Scene_commonSceneMethod.commonScene.md#subcoppercontrol)

#### Defined in

[src/Scene/commonSceneMethod.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L39)

___

### subDiv

• **subDiv**: ``null`` \| `HTMLDivElement` = `null`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[subDiv](Scene_commonSceneMethod.commonScene.md#subdiv)

#### Defined in

[src/Scene/commonSceneMethod.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L34)

___

### subRender

• `Protected` **subRender**: ``null`` \| `WebGLRenderer` = `null`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[subRender](Scene_commonSceneMethod.commonScene.md#subrender)

#### Defined in

[src/Scene/commonSceneMethod.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L38)

___

### subScene

• **subScene**: `Scene`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[subScene](Scene_commonSceneMethod.commonScene.md#subscene)

#### Defined in

[src/Scene/commonSceneMethod.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L35)

___

### viewPoint

• **viewPoint**: [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Defined in

[src/Scene/copperMScene.ts:41](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L41)

___

### vignette

• **vignette**: `customMeshType`

#### Defined in

[src/Scene/copperMScene.ts:37](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L37)

## Methods

### addLights

▸ **addLights**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:299](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L299)

___

### addObject

▸ **addObject**(`obj`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

`void`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[addObject](Scene_commonSceneMethod.commonScene.md#addobject)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[addPreRenderCallbackFunction](Scene_commonSceneMethod.commonScene.md#addprerendercallbackfunction)

#### Defined in

[src/Scene/commonSceneMethod.ts:122](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L122)

___

### addSubView

▸ **addSubView**(): `HTMLDivElement`

create a new sub view to display models

#### Returns

`HTMLDivElement`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[addSubView](Scene_commonSceneMethod.commonScene.md#addsubview)

#### Defined in

[src/Scene/commonSceneMethod.ts:174](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L174)

___

### createDemoMesh

▸ **createDemoMesh**(): `void`

#### Returns

`void`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[createDemoMesh](Scene_commonSceneMethod.commonScene.md#createdemomesh)

#### Defined in

[src/Scene/commonSceneMethod.ts:96](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L96)

___

### drawWholeNrrd

▸ **drawWholeNrrd**(`nrrdSlices`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `nrrdSlices` | `nrrdSliceType` |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:284](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L284)

___

### init

▸ **init**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:94](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L94)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[loadDicom](Scene_commonSceneMethod.commonScene.md#loaddicom)

#### Defined in

[src/Scene/commonSceneMethod.ts:198](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L198)

___

### loadGltf

▸ **loadGltf**(`url`, `callback?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `callback?` | (`content`: `Group`) => `void` |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:144](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L144)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[loadNrrd](Scene_commonSceneMethod.commonScene.md#loadnrrd)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[loadNrrdTexture3d](Scene_commonSceneMethod.commonScene.md#loadnrrdtexture3d)

#### Defined in

[src/Scene/commonSceneMethod.ts:338](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L338)

___

### loadOBJ

▸ **loadOBJ**(`url`, `callback?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `callback?` | (`mesh`: `Group`) => `void` |

#### Returns

`void`

#### Overrides

[commonScene](Scene_commonSceneMethod.commonScene.md).[loadOBJ](Scene_commonSceneMethod.commonScene.md#loadobj)

#### Defined in

[src/Scene/copperMScene.ts:237](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L237)

___

### loadView

▸ **loadView**(`viewpointData`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `viewpointData` | [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md) |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:331](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L331)

___

### loadViewUrl

▸ **loadViewUrl**(`url`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:319](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L319)

___

### onWindowResize

▸ **onWindowResize**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:366](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L366)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[pickModel](Scene_commonSceneMethod.commonScene.md#pickmodel)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[pickSpecifiedModel](Scene_commonSceneMethod.commonScene.md#pickspecifiedmodel)

#### Defined in

[src/Scene/commonSceneMethod.ts:154](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L154)

___

### removeLights

▸ **removeLights**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:312](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L312)

___

### removePreRenderCallbackFunction

▸ **removePreRenderCallbackFunction**(`id`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `number` |

#### Returns

`void`

#### Overrides

[commonScene](Scene_commonSceneMethod.commonScene.md).[removePreRenderCallbackFunction](Scene_commonSceneMethod.commonScene.md#removeprerendercallbackfunction)

#### Defined in

[src/Scene/copperMScene.ts:357](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L357)

___

### render

▸ **render**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:390](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L390)

___

### resetView

▸ **resetView**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:361](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L361)

___

### setCameraPosition

▸ **setCameraPosition**(`position`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `position` | `positionType` |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:350](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L350)

___

### setControls

▸ **setControls**(`type`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `number` |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:123](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L123)

___

### setDepth

▸ **setDepth**(`value`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `number` |

#### Returns

`void`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[setDepth](Scene_commonSceneMethod.commonScene.md#setdepth)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[setDicomFilesOrder](Scene_commonSceneMethod.commonScene.md#setdicomfilesorder)

#### Defined in

[src/Scene/commonSceneMethod.ts:114](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L114)

___

### setViewPoint

▸ **setViewPoint**(`camera`, `target?`): [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `camera` | `PerspectiveCamera` |
| `target?` | `number`[] |

#### Returns

[`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Defined in

[src/Scene/copperMScene.ts:215](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L215)

___

### updateBackground

▸ **updateBackground**(`color1`, `color2`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `color1` | `string` |
| `color2` | `string` |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:293](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L293)

___

### updateCamera

▸ **updateCamera**(`viewpoint`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `viewpoint` | [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md) |

#### Returns

`void`

#### Defined in

[src/Scene/copperMScene.ts:345](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperMScene.ts#L345)

___

### updateControls

▸ **updateControls**(`camera`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `camera` | `PerspectiveCamera` \| `OrthographicCamera` |

#### Returns

`void`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[updateControls](Scene_commonSceneMethod.commonScene.md#updatecontrols)

#### Defined in

[src/Scene/commonSceneMethod.ts:329](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L329)
