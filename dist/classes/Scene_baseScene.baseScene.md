[copper3d](../README.md) / [Modules](../modules.md) / [Scene/baseScene](../modules/Scene_baseScene.md) / baseScene

# Class: baseScene

[Scene/baseScene](../modules/Scene_baseScene.md).baseScene

## Hierarchy

- [`commonScene`](Scene_commonSceneMethod.commonScene.md)

  ↳ **`baseScene`**

  ↳↳ [`copperScene`](Scene_copperScene.copperScene.md)

  ↳↳ [`copperSceneOnDemond`](Scene_copperSceneOnDemond.copperSceneOnDemond.md)

## Table of contents

### Constructors

- [constructor](Scene_baseScene.baseScene.md#constructor)

### Properties

- [ambientLight](Scene_baseScene.baseScene.md#ambientlight)
- [camera](Scene_baseScene.baseScene.md#camera)
- [cameraPositionFlag](Scene_baseScene.baseScene.md#camerapositionflag)
- [color1](Scene_baseScene.baseScene.md#color1)
- [color2](Scene_baseScene.baseScene.md#color2)
- [container](Scene_baseScene.baseScene.md#container)
- [content](Scene_baseScene.baseScene.md#content)
- [controls](Scene_baseScene.baseScene.md#controls)
- [copperControl](Scene_baseScene.baseScene.md#coppercontrol)
- [copperOrthographicCamera](Scene_baseScene.baseScene.md#copperorthographiccamera)
- [copperPerspectiveCamera](Scene_baseScene.baseScene.md#copperperspectivecamera)
- [depthStep](Scene_baseScene.baseScene.md#depthstep)
- [directionalLight](Scene_baseScene.baseScene.md#directionallight)
- [exportContent](Scene_baseScene.baseScene.md#exportcontent)
- [isHalfed](Scene_baseScene.baseScene.md#ishalfed)
- [lights](Scene_baseScene.baseScene.md#lights)
- [pickableObjects](Scene_baseScene.baseScene.md#pickableobjects)
- [preRenderCallbackFunctions](Scene_baseScene.baseScene.md#prerendercallbackfunctions)
- [renderNrrdVolume](Scene_baseScene.baseScene.md#rendernrrdvolume)
- [renderer](Scene_baseScene.baseScene.md#renderer)
- [scene](Scene_baseScene.baseScene.md#scene)
- [sceneName](Scene_baseScene.baseScene.md#scenename)
- [sort](Scene_baseScene.baseScene.md#sort)
- [subCamera](Scene_baseScene.baseScene.md#subcamera)
- [subCopperControl](Scene_baseScene.baseScene.md#subcoppercontrol)
- [subDiv](Scene_baseScene.baseScene.md#subdiv)
- [subRender](Scene_baseScene.baseScene.md#subrender)
- [subScene](Scene_baseScene.baseScene.md#subscene)
- [viewPoint](Scene_baseScene.baseScene.md#viewpoint)
- [vignette](Scene_baseScene.baseScene.md#vignette)

### Methods

- [addLights](Scene_baseScene.baseScene.md#addlights)
- [addObject](Scene_baseScene.baseScene.md#addobject)
- [addPreRenderCallbackFunction](Scene_baseScene.baseScene.md#addprerendercallbackfunction)
- [addSubView](Scene_baseScene.baseScene.md#addsubview)
- [createDemoMesh](Scene_baseScene.baseScene.md#createdemomesh)
- [getDefaultViewPoint](Scene_baseScene.baseScene.md#getdefaultviewpoint)
- [init](Scene_baseScene.baseScene.md#init)
- [loadDicom](Scene_baseScene.baseScene.md#loaddicom)
- [loadMetadataUrl](Scene_baseScene.baseScene.md#loadmetadataurl)
- [loadNrrd](Scene_baseScene.baseScene.md#loadnrrd)
- [loadNrrdTexture3d](Scene_baseScene.baseScene.md#loadnrrdtexture3d)
- [loadOBJ](Scene_baseScene.baseScene.md#loadobj)
- [loadView](Scene_baseScene.baseScene.md#loadview)
- [loadViewUrl](Scene_baseScene.baseScene.md#loadviewurl)
- [onRenderCameraChange](Scene_baseScene.baseScene.md#onrendercamerachange)
- [onWindowResize](Scene_baseScene.baseScene.md#onwindowresize)
- [pickModel](Scene_baseScene.baseScene.md#pickmodel)
- [pickSpecifiedModel](Scene_baseScene.baseScene.md#pickspecifiedmodel)
- [removeLights](Scene_baseScene.baseScene.md#removelights)
- [removePreRenderCallbackFunction](Scene_baseScene.baseScene.md#removeprerendercallbackfunction)
- [render](Scene_baseScene.baseScene.md#render)
- [setDepth](Scene_baseScene.baseScene.md#setdepth)
- [setDicomFilesOrder](Scene_baseScene.baseScene.md#setdicomfilesorder)
- [setViewPoint](Scene_baseScene.baseScene.md#setviewpoint)
- [updateBackground](Scene_baseScene.baseScene.md#updatebackground)
- [updateControls](Scene_baseScene.baseScene.md#updatecontrols)
- [updateDisplay](Scene_baseScene.baseScene.md#updatedisplay)
- [updateLights](Scene_baseScene.baseScene.md#updatelights)
- [updateModelChildrenVisualisation](Scene_baseScene.baseScene.md#updatemodelchildrenvisualisation)

## Constructors

### constructor

• **new baseScene**(`container`, `renderer`, `opt?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `renderer` | `WebGLRenderer` |
| `opt?` | `ICopperSceneOpts` |

#### Overrides

[commonScene](Scene_commonSceneMethod.commonScene.md).[constructor](Scene_commonSceneMethod.commonScene.md#constructor)

#### Defined in

[src/Scene/baseScene.ts:30](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L30)

## Properties

### ambientLight

• **ambientLight**: `AmbientLight`

#### Defined in

[src/Scene/baseScene.ts:18](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L18)

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

[src/Scene/baseScene.ts:20](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L20)

___

### color1

• `Private` **color1**: `string` = `"#5454ad"`

#### Defined in

[src/Scene/baseScene.ts:26](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L26)

___

### color2

• `Private` **color2**: `string` = `"#18e5a7"`

#### Defined in

[src/Scene/baseScene.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L27)

___

### container

• **container**: `HTMLDivElement`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[container](Scene_commonSceneMethod.commonScene.md#container)

#### Defined in

[src/Scene/commonSceneMethod.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L27)

___

### content

• **content**: `Group`

#### Defined in

[src/Scene/baseScene.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L21)

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

[src/Scene/baseScene.ts:19](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L19)

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

[src/Scene/baseScene.ts:17](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L17)

___

### exportContent

• **exportContent**: `Group`

#### Defined in

[src/Scene/baseScene.ts:22](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L22)

___

### isHalfed

• **isHalfed**: `boolean` = `false`

#### Defined in

[src/Scene/baseScene.ts:23](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L23)

___

### lights

• `Private` **lights**: `any`[] = `[]`

#### Defined in

[src/Scene/baseScene.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L28)

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

[src/Scene/baseScene.ts:12](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L12)

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

[src/Scene/baseScene.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L15)

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

[src/Scene/baseScene.ts:24](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L24)

___

### vignette

• **vignette**: `undefined` \| `customMeshType`

#### Defined in

[src/Scene/baseScene.ts:16](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L16)

## Methods

### addLights

▸ **addLights**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:138](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L138)

___

### addObject

▸ **addObject**(`obj`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj` | `any` |

#### Returns

`void`

#### Overrides

[commonScene](Scene_commonSceneMethod.commonScene.md).[addObject](Scene_commonSceneMethod.commonScene.md#addobject)

#### Defined in

[src/Scene/baseScene.ts:134](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L134)

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

### getDefaultViewPoint

▸ **getDefaultViewPoint**(): [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Returns

[`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Defined in

[src/Scene/baseScene.ts:109](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L109)

___

### init

▸ **init**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:54](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L54)

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

### loadMetadataUrl

▸ **loadMetadataUrl**(`url`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:68](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L68)

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

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[loadOBJ](Scene_commonSceneMethod.commonScene.md#loadobj)

#### Defined in

[src/Scene/commonSceneMethod.ts:350](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L350)

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

[src/Scene/baseScene.ts:97](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L97)

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

[src/Scene/baseScene.ts:85](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L85)

___

### onRenderCameraChange

▸ **onRenderCameraChange**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:193](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L193)

___

### onWindowResize

▸ **onWindowResize**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:199](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L199)

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

[src/Scene/baseScene.ts:151](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L151)

___

### removePreRenderCallbackFunction

▸ **removePreRenderCallbackFunction**(`id`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `number` |

#### Returns

`void`

#### Inherited from

[commonScene](Scene_commonSceneMethod.commonScene.md).[removePreRenderCallbackFunction](Scene_commonSceneMethod.commonScene.md#removeprerendercallbackfunction)

#### Defined in

[src/Scene/commonSceneMethod.ts:128](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L128)

___

### render

▸ **render**(`time?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `time?` | `number` |

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:214](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L214)

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

[src/Scene/baseScene.ts:113](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L113)

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

[src/Scene/baseScene.ts:179](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L179)

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

___

### updateDisplay

▸ **updateDisplay**(`state`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | `baseStateType` |

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:174](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L174)

___

### updateLights

▸ **updateLights**(`state`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | `baseStateType` |

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:157](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L157)

___

### updateModelChildrenVisualisation

▸ **updateModelChildrenVisualisation**(`child`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `child` | `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\> |

#### Returns

`void`

#### Defined in

[src/Scene/baseScene.ts:184](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L184)
