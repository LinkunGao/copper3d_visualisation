[copper3d](../README.md) / [Modules](../modules.md) / [Scene/copperSceneOnDemond](../modules/Scene_copperSceneOnDemond.md) / copperSceneOnDemond

# Class: copperSceneOnDemond

[Scene/copperSceneOnDemond](../modules/Scene_copperSceneOnDemond.md).copperSceneOnDemond

## Hierarchy

- [`baseScene`](Scene_baseScene.baseScene.md)

  ↳ **`copperSceneOnDemond`**

## Table of contents

### Constructors

- [constructor](Scene_copperSceneOnDemond.copperSceneOnDemond.md#constructor)

### Properties

- [ambientLight](Scene_copperSceneOnDemond.copperSceneOnDemond.md#ambientlight)
- [camera](Scene_copperSceneOnDemond.copperSceneOnDemond.md#camera)
- [cameraPositionFlag](Scene_copperSceneOnDemond.copperSceneOnDemond.md#camerapositionflag)
- [container](Scene_copperSceneOnDemond.copperSceneOnDemond.md#container)
- [content](Scene_copperSceneOnDemond.copperSceneOnDemond.md#content)
- [controls](Scene_copperSceneOnDemond.copperSceneOnDemond.md#controls)
- [copperControl](Scene_copperSceneOnDemond.copperSceneOnDemond.md#coppercontrol)
- [copperOrthographicCamera](Scene_copperSceneOnDemond.copperSceneOnDemond.md#copperorthographiccamera)
- [copperPerspectiveCamera](Scene_copperSceneOnDemond.copperSceneOnDemond.md#copperperspectivecamera)
- [depthStep](Scene_copperSceneOnDemond.copperSceneOnDemond.md#depthstep)
- [directionalLight](Scene_copperSceneOnDemond.copperSceneOnDemond.md#directionallight)
- [exportContent](Scene_copperSceneOnDemond.copperSceneOnDemond.md#exportcontent)
- [isHalfed](Scene_copperSceneOnDemond.copperSceneOnDemond.md#ishalfed)
- [isResize](Scene_copperSceneOnDemond.copperSceneOnDemond.md#isresize)
- [pickableObjects](Scene_copperSceneOnDemond.copperSceneOnDemond.md#pickableobjects)
- [preRenderCallbackFunctions](Scene_copperSceneOnDemond.copperSceneOnDemond.md#prerendercallbackfunctions)
- [renderNrrdVolume](Scene_copperSceneOnDemond.copperSceneOnDemond.md#rendernrrdvolume)
- [renderRequested](Scene_copperSceneOnDemond.copperSceneOnDemond.md#renderrequested)
- [renderer](Scene_copperSceneOnDemond.copperSceneOnDemond.md#renderer)
- [scene](Scene_copperSceneOnDemond.copperSceneOnDemond.md#scene)
- [sceneName](Scene_copperSceneOnDemond.copperSceneOnDemond.md#scenename)
- [sort](Scene_copperSceneOnDemond.copperSceneOnDemond.md#sort)
- [subCamera](Scene_copperSceneOnDemond.copperSceneOnDemond.md#subcamera)
- [subCopperControl](Scene_copperSceneOnDemond.copperSceneOnDemond.md#subcoppercontrol)
- [subDiv](Scene_copperSceneOnDemond.copperSceneOnDemond.md#subdiv)
- [subRender](Scene_copperSceneOnDemond.copperSceneOnDemond.md#subrender)
- [subScene](Scene_copperSceneOnDemond.copperSceneOnDemond.md#subscene)
- [viewPoint](Scene_copperSceneOnDemond.copperSceneOnDemond.md#viewpoint)
- [vignette](Scene_copperSceneOnDemond.copperSceneOnDemond.md#vignette)

### Methods

- [addLights](Scene_copperSceneOnDemond.copperSceneOnDemond.md#addlights)
- [addObject](Scene_copperSceneOnDemond.copperSceneOnDemond.md#addobject)
- [addPreRenderCallbackFunction](Scene_copperSceneOnDemond.copperSceneOnDemond.md#addprerendercallbackfunction)
- [addSubView](Scene_copperSceneOnDemond.copperSceneOnDemond.md#addsubview)
- [confirmResize](Scene_copperSceneOnDemond.copperSceneOnDemond.md#confirmresize)
- [createDemoMesh](Scene_copperSceneOnDemond.copperSceneOnDemond.md#createdemomesh)
- [getDefaultViewPoint](Scene_copperSceneOnDemond.copperSceneOnDemond.md#getdefaultviewpoint)
- [init](Scene_copperSceneOnDemond.copperSceneOnDemond.md#init)
- [loadDicom](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loaddicom)
- [loadGltf](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadgltf)
- [loadMetadataUrl](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadmetadataurl)
- [loadNrrd](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadnrrd)
- [loadNrrdTexture3d](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadnrrdtexture3d)
- [loadOBJ](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadobj)
- [loadView](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadview)
- [loadViewUrl](Scene_copperSceneOnDemond.copperSceneOnDemond.md#loadviewurl)
- [onRenderCameraChange](Scene_copperSceneOnDemond.copperSceneOnDemond.md#onrendercamerachange)
- [onWindowResize](Scene_copperSceneOnDemond.copperSceneOnDemond.md#onwindowresize)
- [pickModel](Scene_copperSceneOnDemond.copperSceneOnDemond.md#pickmodel)
- [pickSpecifiedModel](Scene_copperSceneOnDemond.copperSceneOnDemond.md#pickspecifiedmodel)
- [removeLights](Scene_copperSceneOnDemond.copperSceneOnDemond.md#removelights)
- [removePreRenderCallbackFunction](Scene_copperSceneOnDemond.copperSceneOnDemond.md#removeprerendercallbackfunction)
- [render](Scene_copperSceneOnDemond.copperSceneOnDemond.md#render)
- [requestRenderIfNotRequested](Scene_copperSceneOnDemond.copperSceneOnDemond.md#requestrenderifnotrequested)
- [setDepth](Scene_copperSceneOnDemond.copperSceneOnDemond.md#setdepth)
- [setDicomFilesOrder](Scene_copperSceneOnDemond.copperSceneOnDemond.md#setdicomfilesorder)
- [setViewPoint](Scene_copperSceneOnDemond.copperSceneOnDemond.md#setviewpoint)
- [updateBackground](Scene_copperSceneOnDemond.copperSceneOnDemond.md#updatebackground)
- [updateControls](Scene_copperSceneOnDemond.copperSceneOnDemond.md#updatecontrols)
- [updateDisplay](Scene_copperSceneOnDemond.copperSceneOnDemond.md#updatedisplay)
- [updateLights](Scene_copperSceneOnDemond.copperSceneOnDemond.md#updatelights)
- [updateModelChildrenVisualisation](Scene_copperSceneOnDemond.copperSceneOnDemond.md#updatemodelchildrenvisualisation)

## Constructors

### constructor

• **new copperSceneOnDemond**(`container`, `renderer`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |
| `renderer` | `WebGLRenderer` |

#### Overrides

[baseScene](Scene_baseScene.baseScene.md).[constructor](Scene_baseScene.baseScene.md#constructor)

#### Defined in

[src/Scene/copperSceneOnDemond.ts:12](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L12)

## Properties

### ambientLight

• **ambientLight**: `AmbientLight`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[ambientLight](Scene_baseScene.baseScene.md#ambientlight)

#### Defined in

[src/Scene/baseScene.ts:18](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L18)

___

### camera

• **camera**: `PerspectiveCamera` \| `OrthographicCamera`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[camera](Scene_baseScene.baseScene.md#camera)

#### Defined in

[src/Scene/commonSceneMethod.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L29)

___

### cameraPositionFlag

• **cameraPositionFlag**: `boolean` = `false`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[cameraPositionFlag](Scene_baseScene.baseScene.md#camerapositionflag)

#### Defined in

[src/Scene/baseScene.ts:20](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L20)

___

### container

• **container**: `HTMLDivElement`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[container](Scene_baseScene.baseScene.md#container)

#### Defined in

[src/Scene/commonSceneMethod.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L27)

___

### content

• **content**: `Group`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[content](Scene_baseScene.baseScene.md#content)

#### Defined in

[src/Scene/baseScene.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L21)

___

### controls

• **controls**: `OrbitControls`

#### Overrides

[baseScene](Scene_baseScene.baseScene.md).[controls](Scene_baseScene.baseScene.md#controls)

#### Defined in

[src/Scene/copperSceneOnDemond.ts:8](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L8)

___

### copperControl

• **copperControl**: [`Controls`](Controls_copperControls.Controls.md)

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[copperControl](Scene_baseScene.baseScene.md#coppercontrol)

#### Defined in

[src/Scene/baseScene.ts:19](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L19)

___

### copperOrthographicCamera

• **copperOrthographicCamera**: `OrthographicCamera`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[copperOrthographicCamera](Scene_baseScene.baseScene.md#copperorthographiccamera)

#### Defined in

[src/Scene/commonSceneMethod.ts:32](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L32)

___

### copperPerspectiveCamera

• **copperPerspectiveCamera**: `PerspectiveCamera`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[copperPerspectiveCamera](Scene_baseScene.baseScene.md#copperperspectivecamera)

#### Defined in

[src/Scene/commonSceneMethod.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L31)

___

### depthStep

• `Protected` **depthStep**: `number` = `0.4`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[depthStep](Scene_baseScene.baseScene.md#depthstep)

#### Defined in

[src/Scene/commonSceneMethod.ts:44](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L44)

___

### directionalLight

• **directionalLight**: `DirectionalLight`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[directionalLight](Scene_baseScene.baseScene.md#directionallight)

#### Defined in

[src/Scene/baseScene.ts:17](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L17)

___

### exportContent

• **exportContent**: `Group`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[exportContent](Scene_baseScene.baseScene.md#exportcontent)

#### Defined in

[src/Scene/baseScene.ts:22](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L22)

___

### isHalfed

• **isHalfed**: `boolean` = `false`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[isHalfed](Scene_baseScene.baseScene.md#ishalfed)

#### Defined in

[src/Scene/baseScene.ts:23](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L23)

___

### isResize

• **isResize**: `boolean` = `false`

#### Defined in

[src/Scene/copperSceneOnDemond.ts:10](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L10)

___

### pickableObjects

• `Protected` **pickableObjects**: `Mesh`<`BufferGeometry`<`NormalBufferAttributes`\>, `Material` \| `Material`[]\>[] = `[]`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[pickableObjects](Scene_baseScene.baseScene.md#pickableobjects)

#### Defined in

[src/Scene/commonSceneMethod.ts:46](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L46)

___

### preRenderCallbackFunctions

• `Protected` **preRenderCallbackFunctions**: `preRenderCallbackFunctionType`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[preRenderCallbackFunctions](Scene_baseScene.baseScene.md#prerendercallbackfunctions)

#### Defined in

[src/Scene/commonSceneMethod.ts:42](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L42)

___

### renderNrrdVolume

• `Protected` **renderNrrdVolume**: `boolean` = `false`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[renderNrrdVolume](Scene_baseScene.baseScene.md#rendernrrdvolume)

#### Defined in

[src/Scene/commonSceneMethod.ts:40](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L40)

___

### renderRequested

• **renderRequested**: `undefined` \| `boolean` = `false`

#### Defined in

[src/Scene/copperSceneOnDemond.ts:9](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L9)

___

### renderer

• **renderer**: `WebGLRenderer`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[renderer](Scene_baseScene.baseScene.md#renderer)

#### Defined in

[src/Scene/baseScene.ts:12](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L12)

___

### scene

• **scene**: `Scene`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[scene](Scene_baseScene.baseScene.md#scene)

#### Defined in

[src/Scene/commonSceneMethod.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L28)

___

### sceneName

• **sceneName**: `string` = `""`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[sceneName](Scene_baseScene.baseScene.md#scenename)

#### Defined in

[src/Scene/baseScene.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L15)

___

### sort

• `Protected` **sort**: `boolean` = `true`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[sort](Scene_baseScene.baseScene.md#sort)

#### Defined in

[src/Scene/commonSceneMethod.ts:43](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L43)

___

### subCamera

• **subCamera**: ``null`` \| `PerspectiveCamera` = `null`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[subCamera](Scene_baseScene.baseScene.md#subcamera)

#### Defined in

[src/Scene/commonSceneMethod.ts:36](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L36)

___

### subCopperControl

• `Protected` **subCopperControl**: ``null`` \| [`Controls`](Controls_copperControls.Controls.md) = `null`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[subCopperControl](Scene_baseScene.baseScene.md#subcoppercontrol)

#### Defined in

[src/Scene/commonSceneMethod.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L39)

___

### subDiv

• **subDiv**: ``null`` \| `HTMLDivElement` = `null`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[subDiv](Scene_baseScene.baseScene.md#subdiv)

#### Defined in

[src/Scene/commonSceneMethod.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L34)

___

### subRender

• `Protected` **subRender**: ``null`` \| `WebGLRenderer` = `null`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[subRender](Scene_baseScene.baseScene.md#subrender)

#### Defined in

[src/Scene/commonSceneMethod.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L38)

___

### subScene

• **subScene**: `Scene`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[subScene](Scene_baseScene.baseScene.md#subscene)

#### Defined in

[src/Scene/commonSceneMethod.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L35)

___

### viewPoint

• **viewPoint**: [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[viewPoint](Scene_baseScene.baseScene.md#viewpoint)

#### Defined in

[src/Scene/baseScene.ts:24](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L24)

___

### vignette

• **vignette**: `undefined` \| `customMeshType`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[vignette](Scene_baseScene.baseScene.md#vignette)

#### Defined in

[src/Scene/baseScene.ts:16](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L16)

## Methods

### addLights

▸ **addLights**(): `void`

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[addLights](Scene_baseScene.baseScene.md#addlights)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[addObject](Scene_baseScene.baseScene.md#addobject)

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

[baseScene](Scene_baseScene.baseScene.md).[addPreRenderCallbackFunction](Scene_baseScene.baseScene.md#addprerendercallbackfunction)

#### Defined in

[src/Scene/commonSceneMethod.ts:122](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L122)

___

### addSubView

▸ **addSubView**(): `HTMLDivElement`

create a new sub view to display models

#### Returns

`HTMLDivElement`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[addSubView](Scene_baseScene.baseScene.md#addsubview)

#### Defined in

[src/Scene/commonSceneMethod.ts:174](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L174)

___

### confirmResize

▸ **confirmResize**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperSceneOnDemond.ts:58](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L58)

___

### createDemoMesh

▸ **createDemoMesh**(): `void`

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[createDemoMesh](Scene_baseScene.baseScene.md#createdemomesh)

#### Defined in

[src/Scene/commonSceneMethod.ts:96](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L96)

___

### getDefaultViewPoint

▸ **getDefaultViewPoint**(): [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Returns

[`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[getDefaultViewPoint](Scene_baseScene.baseScene.md#getdefaultviewpoint)

#### Defined in

[src/Scene/baseScene.ts:109](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L109)

___

### init

▸ **init**(): `void`

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[init](Scene_baseScene.baseScene.md#init)

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

[baseScene](Scene_baseScene.baseScene.md).[loadDicom](Scene_baseScene.baseScene.md#loaddicom)

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

[src/Scene/copperSceneOnDemond.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L21)

___

### loadMetadataUrl

▸ **loadMetadataUrl**(`url`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[loadMetadataUrl](Scene_baseScene.baseScene.md#loadmetadataurl)

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

[baseScene](Scene_baseScene.baseScene.md).[loadNrrd](Scene_baseScene.baseScene.md#loadnrrd)

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

[baseScene](Scene_baseScene.baseScene.md).[loadNrrdTexture3d](Scene_baseScene.baseScene.md#loadnrrdtexture3d)

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

[baseScene](Scene_baseScene.baseScene.md).[loadOBJ](Scene_baseScene.baseScene.md#loadobj)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[loadView](Scene_baseScene.baseScene.md#loadview)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[loadViewUrl](Scene_baseScene.baseScene.md#loadviewurl)

#### Defined in

[src/Scene/baseScene.ts:85](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L85)

___

### onRenderCameraChange

▸ **onRenderCameraChange**(): `void`

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[onRenderCameraChange](Scene_baseScene.baseScene.md#onrendercamerachange)

#### Defined in

[src/Scene/baseScene.ts:193](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L193)

___

### onWindowResize

▸ **onWindowResize**(): `void`

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[onWindowResize](Scene_baseScene.baseScene.md#onwindowresize)

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

[baseScene](Scene_baseScene.baseScene.md).[pickModel](Scene_baseScene.baseScene.md#pickmodel)

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

[baseScene](Scene_baseScene.baseScene.md).[pickSpecifiedModel](Scene_baseScene.baseScene.md#pickspecifiedmodel)

#### Defined in

[src/Scene/commonSceneMethod.ts:154](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L154)

___

### removeLights

▸ **removeLights**(): `void`

#### Returns

`void`

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[removeLights](Scene_baseScene.baseScene.md#removelights)

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

[baseScene](Scene_baseScene.baseScene.md).[removePreRenderCallbackFunction](Scene_baseScene.baseScene.md#removeprerendercallbackfunction)

#### Defined in

[src/Scene/commonSceneMethod.ts:128](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/commonSceneMethod.ts#L128)

___

### render

▸ **render**(): `void`

#### Returns

`void`

#### Overrides

[baseScene](Scene_baseScene.baseScene.md).[render](Scene_baseScene.baseScene.md#render)

#### Defined in

[src/Scene/copperSceneOnDemond.ts:63](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L63)

___

### requestRenderIfNotRequested

▸ **requestRenderIfNotRequested**(): `void`

#### Returns

`void`

#### Defined in

[src/Scene/copperSceneOnDemond.ts:70](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/copperSceneOnDemond.ts#L70)

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

[baseScene](Scene_baseScene.baseScene.md).[setDepth](Scene_baseScene.baseScene.md#setdepth)

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

[baseScene](Scene_baseScene.baseScene.md).[setDicomFilesOrder](Scene_baseScene.baseScene.md#setdicomfilesorder)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[setViewPoint](Scene_baseScene.baseScene.md#setviewpoint)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[updateBackground](Scene_baseScene.baseScene.md#updatebackground)

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

[baseScene](Scene_baseScene.baseScene.md).[updateControls](Scene_baseScene.baseScene.md#updatecontrols)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[updateDisplay](Scene_baseScene.baseScene.md#updatedisplay)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[updateLights](Scene_baseScene.baseScene.md#updatelights)

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

#### Inherited from

[baseScene](Scene_baseScene.baseScene.md).[updateModelChildrenVisualisation](Scene_baseScene.baseScene.md#updatemodelchildrenvisualisation)

#### Defined in

[src/Scene/baseScene.ts:184](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Scene/baseScene.ts#L184)
