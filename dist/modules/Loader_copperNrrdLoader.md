[copper3d](../README.md) / [Modules](../modules.md) / Loader/copperNrrdLoader

# Module: Loader/copperNrrdLoader

## Table of contents

### Interfaces

- [optsType](../interfaces/Loader_copperNrrdLoader.optsType.md)

### Functions

- [addBoxHelper](Loader_copperNrrdLoader.md#addboxhelper)
- [copperNrrdLoader](Loader_copperNrrdLoader.md#coppernrrdloader)
- [copperNrrdTexture3dLoader](Loader_copperNrrdLoader.md#coppernrrdtexture3dloader)
- [getWholeSlices](Loader_copperNrrdLoader.md#getwholeslices)

## Functions

### addBoxHelper

▸ **addBoxHelper**(`scene`, `volume`, `boxCube?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `scene` | [`copperScene`](../classes/Scene_copperScene.copperScene.md) |
| `volume` | `any` |
| `boxCube?` | `Object3D`<`Event`\> |

#### Returns

`void`

#### Defined in

[src/Loader/copperNrrdLoader.ts:435](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Loader/copperNrrdLoader.ts#L435)

___

### copperNrrdLoader

▸ **copperNrrdLoader**(`url`, `loadingBar`, `segmentation`, `callback?`, `opts?`): `void`

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

[src/Loader/copperNrrdLoader.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Loader/copperNrrdLoader.ts#L38)

___

### copperNrrdTexture3dLoader

▸ **copperNrrdTexture3dLoader**(`url`, `scene`, `container`, `callback?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `url` | `string` |
| `scene` | `Scene` |
| `container` | `HTMLDivElement` |
| `callback?` | (`volume`: `any`, `gui?`: `GUI`) => `void` |

#### Returns

`void`

#### Defined in

[src/Loader/copperNrrdLoader.ts:177](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Loader/copperNrrdLoader.ts#L177)

___

### getWholeSlices

▸ **getWholeSlices**(`nrrdSlices`, `scene`, `gui`, `controls`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `nrrdSlices` | `nrrdSliceType` |
| `scene` | `Scene` |
| `gui` | `GUI` |
| `controls` | [`Copper3dTrackballControls`](../classes/Controls_Copper3dTrackballControls.Copper3dTrackballControls.md) |

#### Returns

`void`

#### Defined in

[src/Loader/copperNrrdLoader.ts:335](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Loader/copperNrrdLoader.ts#L335)
