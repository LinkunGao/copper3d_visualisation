[copper3d](../README.md) / [Modules](../modules.md) / [Utils/segmentation/CommToolsData](../modules/Utils_segmentation_CommToolsData.md) / CommToolsData

# Class: CommToolsData

[Utils/segmentation/CommToolsData](../modules/Utils_segmentation_CommToolsData.md).CommToolsData

## Hierarchy

- **`CommToolsData`**

  ↳ [`DrawToolCore`](Utils_segmentation_DrawToolCore.DrawToolCore.md)

## Table of contents

### Constructors

- [constructor](Utils_segmentation_CommToolsData.CommToolsData.md#constructor)

### Properties

- [baseCanvasesSize](Utils_segmentation_CommToolsData.CommToolsData.md#basecanvasessize)
- [cursorPage](Utils_segmentation_CommToolsData.CommToolsData.md#cursorpage)
- [gui\_states](Utils_segmentation_CommToolsData.CommToolsData.md#gui_states)
- [nrrd\_states](Utils_segmentation_CommToolsData.CommToolsData.md#nrrd_states)
- [protectedData](Utils_segmentation_CommToolsData.CommToolsData.md#protecteddata)

### Methods

- [clearPaint](Utils_segmentation_CommToolsData.CommToolsData.md#clearpaint)
- [clearStoreImages](Utils_segmentation_CommToolsData.CommToolsData.md#clearstoreimages)
- [convertCursorPoint](Utils_segmentation_CommToolsData.CommToolsData.md#convertcursorpoint)
- [filterDrawedImage](Utils_segmentation_CommToolsData.CommToolsData.md#filterdrawedimage)
- [flipDisplayImageByAxis](Utils_segmentation_CommToolsData.CommToolsData.md#flipdisplayimagebyaxis)
- [generateCanvases](Utils_segmentation_CommToolsData.CommToolsData.md#generatecanvases)
- [redrawDisplayCanvas](Utils_segmentation_CommToolsData.CommToolsData.md#redrawdisplaycanvas)
- [resetLayerCanvas](Utils_segmentation_CommToolsData.CommToolsData.md#resetlayercanvas)
- [resetPaintAreaUIPosition](Utils_segmentation_CommToolsData.CommToolsData.md#resetpaintareauiposition)
- [resizePaintArea](Utils_segmentation_CommToolsData.CommToolsData.md#resizepaintarea)
- [setEmptyCanvasSize](Utils_segmentation_CommToolsData.CommToolsData.md#setemptycanvassize)
- [setIsDrawFalse](Utils_segmentation_CommToolsData.CommToolsData.md#setisdrawfalse)
- [setSyncsliceNum](Utils_segmentation_CommToolsData.CommToolsData.md#setsyncslicenum)
- [undoLastPainting](Utils_segmentation_CommToolsData.CommToolsData.md#undolastpainting)
- [updateOriginAndChangedWH](Utils_segmentation_CommToolsData.CommToolsData.md#updateoriginandchangedwh)

## Constructors

### constructor

• **new CommToolsData**(`container`, `mainAreaContainer`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLElement` |
| `mainAreaContainer` | `HTMLElement` |

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:142](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L142)

## Properties

### baseCanvasesSize

• **baseCanvasesSize**: `number` = `1`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:14](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L14)

___

### cursorPage

• **cursorPage**: `ICursorPage`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:70](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L70)

___

### gui\_states

• **gui\_states**: `IGUIStates`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:91](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L91)

___

### nrrd\_states

• **nrrd\_states**: `INrrdStates`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L15)

___

### protectedData

• **protectedData**: `IProtected`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:141](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L141)

## Methods

### clearPaint

▸ **clearPaint**(): `void`

Rewrite this {clearPaint} function under DrawToolCore

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:212](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L212)

___

### clearStoreImages

▸ **clearStoreImages**(): `void`

Rewrite this {clearStoreImages} function under NrrdTools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:228](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L228)

___

### convertCursorPoint

▸ **convertCursorPoint**(`from`, `to`, `cursorNumX`, `cursorNumY`, `currentSliceIndex`): `undefined` \| `IConvertObjType`

Rewrite this {convertCursorPoint} function under NrrdTools

#### Parameters

| Name | Type |
| :------ | :------ |
| `from` | ``"z"`` \| ``"y"`` \| ``"x"`` |
| `to` | ``"z"`` \| ``"y"`` \| ``"x"`` |
| `cursorNumX` | `number` |
| `cursorNumY` | `number` |
| `currentSliceIndex` | `number` |

#### Returns

`undefined` \| `IConvertObjType`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:284](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L284)

___

### filterDrawedImage

▸ **filterDrawedImage**(`axis`, `sliceIndex`, `paintedImages`): `IPaintImage`

Get a painted mask image (IPaintImage) based on current axis and input slice index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `axis` | ``"z"`` \| ``"y"`` \| ``"x"`` | "x" \| "y" \| "z" |
| `sliceIndex` | `number` | number |
| `paintedImages` | `IPaintImages` | IPaintImages, All painted mask images. |

#### Returns

`IPaintImage`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:328](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L328)

___

### flipDisplayImageByAxis

▸ **flipDisplayImageByAxis**(): `void`

Rewrite this {flipDisplayImageByAxis} function under NrrdTools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:260](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L260)

___

### generateCanvases

▸ `Private` **generateCanvases**(): `HTMLCanvasElement`[]

#### Returns

`HTMLCanvasElement`[]

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:200](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L200)

___

### redrawDisplayCanvas

▸ **redrawDisplayCanvas**(): `void`

Rewrite this {redrawDisplayCanvas} function under NrrdTools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:314](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L314)

___

### resetLayerCanvas

▸ **resetLayerCanvas**(): `void`

Rewrite this {resetLayerCanvas} function under NrrdTools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:298](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L298)

___

### resetPaintAreaUIPosition

▸ **resetPaintAreaUIPosition**(`l?`, `t?`): `void`

Rewrite this {resetPaintAreaUIPosition} function under NrrdTools

#### Parameters

| Name | Type |
| :------ | :------ |
| `l?` | `number` |
| `t?` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:268](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L268)

___

### resizePaintArea

▸ **resizePaintArea**(`factor`): `void`

Rewrite this {resizePaintArea} function under NrrdTools

#### Parameters

| Name | Type |
| :------ | :------ |
| `factor` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:236](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L236)

___

### setEmptyCanvasSize

▸ **setEmptyCanvasSize**(`axis?`): `void`

Rewrite this {resetPaintAreaUIPosition} function under NrrdTools

#### Parameters

| Name | Type |
| :------ | :------ |
| `axis?` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:276](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L276)

___

### setIsDrawFalse

▸ **setIsDrawFalse**(`target`): `void`

Rewrite this {setIsDrawFalse} function under NrrdTools

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:244](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L244)

___

### setSyncsliceNum

▸ **setSyncsliceNum**(): `void`

Rewrite this {setSyncsliceNum} function under NrrdTools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:306](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L306)

___

### undoLastPainting

▸ **undoLastPainting**(): `void`

Rewrite this {undoLastPainting} function under DrawToolCore

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:220](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L220)

___

### updateOriginAndChangedWH

▸ **updateOriginAndChangedWH**(): `void`

Rewrite this {updateOriginAndChangedWH} function under NrrdTools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:252](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L252)
