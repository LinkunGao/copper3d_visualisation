[copper3d](../README.md) / [Modules](../modules.md) / [Utils/segmentation/DrawToolCore](../modules/Utils_segmentation_DrawToolCore.md) / DrawToolCore

# Class: DrawToolCore

[Utils/segmentation/DrawToolCore](../modules/Utils_segmentation_DrawToolCore.md).DrawToolCore

## Hierarchy

- [`CommToolsData`](Utils_segmentation_CommToolsData.CommToolsData.md)

  ↳ **`DrawToolCore`**

  ↳↳ [`NrrdTools`](Utils_segmentation_NrrdTools.NrrdTools.md)

## Table of contents

### Constructors

- [constructor](Utils_segmentation_DrawToolCore.DrawToolCore.md#constructor)

### Properties

- [baseCanvasesSize](Utils_segmentation_DrawToolCore.DrawToolCore.md#basecanvasessize)
- [container](Utils_segmentation_DrawToolCore.DrawToolCore.md#container)
- [cursorPage](Utils_segmentation_DrawToolCore.DrawToolCore.md#cursorpage)
- [drawingPrameters](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawingprameters)
- [eraserUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#eraserurls)
- [gui\_states](Utils_segmentation_DrawToolCore.DrawToolCore.md#gui_states)
- [mainAreaContainer](Utils_segmentation_DrawToolCore.DrawToolCore.md#mainareacontainer)
- [nrrd\_states](Utils_segmentation_DrawToolCore.DrawToolCore.md#nrrd_states)
- [pencilUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#pencilurls)
- [protectedData](Utils_segmentation_DrawToolCore.DrawToolCore.md#protecteddata)
- [start](Utils_segmentation_DrawToolCore.DrawToolCore.md#start)
- [undoArray](Utils_segmentation_DrawToolCore.DrawToolCore.md#undoarray)

### Methods

- [checkSharedPlaceSlice](Utils_segmentation_DrawToolCore.DrawToolCore.md#checksharedplaceslice)
- [clearPaint](Utils_segmentation_DrawToolCore.DrawToolCore.md#clearpaint)
- [clearStoreImages](Utils_segmentation_DrawToolCore.DrawToolCore.md#clearstoreimages)
- [configMouseSphereWheel](Utils_segmentation_DrawToolCore.DrawToolCore.md#configmousespherewheel)
- [configMouseZoomWheel](Utils_segmentation_DrawToolCore.DrawToolCore.md#configmousezoomwheel)
- [convertCursorPoint](Utils_segmentation_DrawToolCore.DrawToolCore.md#convertcursorpoint)
- [draw](Utils_segmentation_DrawToolCore.DrawToolCore.md#draw)
- [drawImageOnEmptyImage](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawimageonemptyimage)
- [drawLine](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawline)
- [drawLinesOnLayer](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawlinesonlayer)
- [drawSphere](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawsphere)
- [drawSphereCore](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawspherecore)
- [drawSphereOnEachViews](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawsphereoneachviews)
- [enableCrosshair](Utils_segmentation_DrawToolCore.DrawToolCore.md#enablecrosshair)
- [filterDrawedImage](Utils_segmentation_DrawToolCore.DrawToolCore.md#filterdrawedimage)
- [findSliceInSharedPlace](Utils_segmentation_DrawToolCore.DrawToolCore.md#findsliceinsharedplace)
- [flipDisplayImageByAxis](Utils_segmentation_DrawToolCore.DrawToolCore.md#flipdisplayimagebyaxis)
- [getCurrentUndo](Utils_segmentation_DrawToolCore.DrawToolCore.md#getcurrentundo)
- [getRestLabel](Utils_segmentation_DrawToolCore.DrawToolCore.md#getrestlabel)
- [initAllCanvas](Utils_segmentation_DrawToolCore.DrawToolCore.md#initallcanvas)
- [initDrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md#initdrawtoolcore)
- [paintOnCanvas](Utils_segmentation_DrawToolCore.DrawToolCore.md#paintoncanvas)
- [paintOnCanvasLayer](Utils_segmentation_DrawToolCore.DrawToolCore.md#paintoncanvaslayer)
- [redrawDisplayCanvas](Utils_segmentation_DrawToolCore.DrawToolCore.md#redrawdisplaycanvas)
- [replaceArray](Utils_segmentation_DrawToolCore.DrawToolCore.md#replacearray)
- [replaceHorizontalRowPixels](Utils_segmentation_DrawToolCore.DrawToolCore.md#replacehorizontalrowpixels)
- [replaceVerticalColPixels](Utils_segmentation_DrawToolCore.DrawToolCore.md#replaceverticalcolpixels)
- [repraintCurrentContrastSlice](Utils_segmentation_DrawToolCore.DrawToolCore.md#repraintcurrentcontrastslice)
- [resetLayerCanvas](Utils_segmentation_DrawToolCore.DrawToolCore.md#resetlayercanvas)
- [resetPaintAreaUIPosition](Utils_segmentation_DrawToolCore.DrawToolCore.md#resetpaintareauiposition)
- [resizePaintArea](Utils_segmentation_DrawToolCore.DrawToolCore.md#resizepaintarea)
- [setCurrentLayer](Utils_segmentation_DrawToolCore.DrawToolCore.md#setcurrentlayer)
- [setEmptyCanvasSize](Utils_segmentation_DrawToolCore.DrawToolCore.md#setemptycanvassize)
- [setEraserUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#seteraserurls)
- [setIsDrawFalse](Utils_segmentation_DrawToolCore.DrawToolCore.md#setisdrawfalse)
- [setPencilIconUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#setpenciliconurls)
- [setSphereCanvasSize](Utils_segmentation_DrawToolCore.DrawToolCore.md#setspherecanvassize)
- [setSyncsliceNum](Utils_segmentation_DrawToolCore.DrawToolCore.md#setsyncslicenum)
- [setUpSphereOrigins](Utils_segmentation_DrawToolCore.DrawToolCore.md#setupsphereorigins)
- [sliceArrayH](Utils_segmentation_DrawToolCore.DrawToolCore.md#slicearrayh)
- [sliceArrayV](Utils_segmentation_DrawToolCore.DrawToolCore.md#slicearrayv)
- [storeAllImages](Utils_segmentation_DrawToolCore.DrawToolCore.md#storeallimages)
- [storeEachLayerImage](Utils_segmentation_DrawToolCore.DrawToolCore.md#storeeachlayerimage)
- [storeImageToAxis](Utils_segmentation_DrawToolCore.DrawToolCore.md#storeimagetoaxis)
- [storeImageToLabel](Utils_segmentation_DrawToolCore.DrawToolCore.md#storeimagetolabel)
- [storeSphereImages](Utils_segmentation_DrawToolCore.DrawToolCore.md#storesphereimages)
- [undoLastPainting](Utils_segmentation_DrawToolCore.DrawToolCore.md#undolastpainting)
- [updateOriginAndChangedWH](Utils_segmentation_DrawToolCore.DrawToolCore.md#updateoriginandchangedwh)
- [updateSlicesContrast](Utils_segmentation_DrawToolCore.DrawToolCore.md#updateslicescontrast)
- [useEraser](Utils_segmentation_DrawToolCore.DrawToolCore.md#useeraser)

## Constructors

### constructor

• **new DrawToolCore**(`container`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLElement` |

#### Overrides

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[constructor](Utils_segmentation_CommToolsData.CommToolsData.md#constructor)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L34)

## Properties

### baseCanvasesSize

• **baseCanvasesSize**: `number` = `1`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[baseCanvasesSize](Utils_segmentation_CommToolsData.CommToolsData.md#basecanvasessize)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:14](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L14)

___

### container

• **container**: `HTMLElement`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:14](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L14)

___

### cursorPage

• **cursorPage**: `ICursorPage`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[cursorPage](Utils_segmentation_CommToolsData.CommToolsData.md#cursorpage)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:70](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L70)

___

### drawingPrameters

• **drawingPrameters**: `IDrawingEvents`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:16](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L16)

___

### eraserUrls

• **eraserUrls**: `string`[] = `[]`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L27)

___

### gui\_states

• **gui\_states**: `IGUIStates`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[gui_states](Utils_segmentation_CommToolsData.CommToolsData.md#gui_states)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:91](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L91)

___

### mainAreaContainer

• **mainAreaContainer**: `HTMLDivElement`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L15)

___

### nrrd\_states

• **nrrd\_states**: `INrrdStates`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[nrrd_states](Utils_segmentation_CommToolsData.CommToolsData.md#nrrd_states)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L15)

___

### pencilUrls

• **pencilUrls**: `string`[] = `[]`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L28)

___

### protectedData

• **protectedData**: `IProtected`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[protectedData](Utils_segmentation_CommToolsData.CommToolsData.md#protecteddata)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:141](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L141)

___

### start

• **start**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:32](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L32)

___

### undoArray

• **undoArray**: `IUndoType`[] = `[]`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L29)

## Methods

### checkSharedPlaceSlice

▸ `Private` **checkSharedPlaceSlice**(`width`, `height`, `imageData`): `Uint8ClampedArray`

**************************** Utils for store image and itksnap core *************************************

#### Parameters

| Name | Type |
| :------ | :------ |
| `width` | `number` |
| `height` | `number` |
| `imageData` | `ImageData` |

#### Returns

`Uint8ClampedArray`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1524](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1524)

___

### clearPaint

▸ **clearPaint**(): `void`

Clear mask on current slice canvas

#### Returns

`void`

#### Overrides

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[clearPaint](Utils_segmentation_CommToolsData.CommToolsData.md#clearpaint)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1059](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1059)

___

### clearStoreImages

▸ **clearStoreImages**(): `void`

Rewrite this {clearStoreImages} function under NrrdTools

#### Returns

`void`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[clearStoreImages](Utils_segmentation_CommToolsData.CommToolsData.md#clearstoreimages)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:228](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L228)

___

### configMouseSphereWheel

▸ `Private` **configMouseSphereWheel**(): (`e`: `WheelEvent`) => `void`

#### Returns

`fn`

▸ (`e`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `e` | `WheelEvent` |

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:954](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L954)

___

### configMouseZoomWheel

▸ `Private` **configMouseZoomWheel**(): (`e`: `WheelEvent`) => `void`

#### Returns

`fn`

▸ (`e`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `e` | `WheelEvent` |

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:783](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L783)

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

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[convertCursorPoint](Utils_segmentation_CommToolsData.CommToolsData.md#convertcursorpoint)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:284](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L284)

___

### draw

▸ **draw**(`opts?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts?` | `IDrawOpts` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:99](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L99)

___

### drawImageOnEmptyImage

▸ `Private` **drawImageOnEmptyImage**(`canvas`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `canvas` | `HTMLCanvasElement` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:855](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L855)

___

### drawLine

▸ `Private` **drawLine**(`x1`, `y1`, `x2`, `y2`): `void`

***********************************May consider to move outside ******************************************

#### Parameters

| Name | Type |
| :------ | :------ |
| `x1` | `number` |
| `y1` | `number` |
| `x2` | `number` |
| `y2` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:641](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L641)

___

### drawLinesOnLayer

▸ `Private` **drawLinesOnLayer**(`ctx`, `x`, `y`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctx` | `CanvasRenderingContext2D` |
| `x` | `number` |
| `y` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:649](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L649)

___

### drawSphere

▸ **drawSphere**(`mouseX`, `mouseY`, `radius`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `mouseX` | `number` |
| `mouseY` | `number` |
| `radius` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:976](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L976)

___

### drawSphereCore

▸ `Private` **drawSphereCore**(`ctx`, `x`, `y`, `radius`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `ctx` | `CanvasRenderingContext2D` |
| `x` | `number` |
| `y` | `number` |
| `radius` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:918](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L918)

___

### drawSphereOnEachViews

▸ `Private` **drawSphereOnEachViews**(`decay`, `axis`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `decay` | `number` |
| `axis` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:885](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L885)

___

### enableCrosshair

▸ `Private` **enableCrosshair**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:834](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L834)

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

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[filterDrawedImage](Utils_segmentation_CommToolsData.CommToolsData.md#filterdrawedimage)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:328](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L328)

___

### findSliceInSharedPlace

▸ `Private` **findSliceInSharedPlace**(): `ImageData`[]

#### Returns

`ImageData`[]

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1564](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1564)

___

### flipDisplayImageByAxis

▸ **flipDisplayImageByAxis**(): `void`

Rewrite this {flipDisplayImageByAxis} function under NrrdTools

#### Returns

`void`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[flipDisplayImageByAxis](Utils_segmentation_CommToolsData.CommToolsData.md#flipdisplayimagebyaxis)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:260](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L260)

___

### getCurrentUndo

▸ `Private` **getCurrentUndo**(): `IUndoType`[]

************************** Undo clear functions***************************************************

#### Returns

`IUndoType`[]

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1050](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1050)

___

### getRestLabel

▸ `Private` **getRestLabel**(): (``"label1"`` \| ``"label2"`` \| ``"label3"``)[]

**************************label div controls***************************************************

#### Returns

(``"label1"`` \| ``"label2"`` \| ``"label3"``)[]

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1040](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1040)

___

### initAllCanvas

▸ `Private` **initAllCanvas**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:684](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L684)

___

### initDrawToolCore

▸ `Private` **initDrawToolCore**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:43](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L43)

___

### paintOnCanvas

▸ `Private` **paintOnCanvas**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:107](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L107)

___

### paintOnCanvasLayer

▸ `Private` **paintOnCanvasLayer**(`x`, `y`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |
| `y` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:672](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L672)

___

### redrawDisplayCanvas

▸ **redrawDisplayCanvas**(): `void`

Rewrite this {redrawDisplayCanvas} function under NrrdTools

#### Returns

`void`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[redrawDisplayCanvas](Utils_segmentation_CommToolsData.CommToolsData.md#redrawdisplaycanvas)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:314](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L314)

___

### replaceArray

▸ `Private` **replaceArray**(`mainArr`, `replaceArr`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `mainArr` | `number`[] \| `Uint8ClampedArray` |
| `replaceArr` | `number`[] \| `Uint8ClampedArray` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1551](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1551)

___

### replaceHorizontalRowPixels

▸ `Private` **replaceHorizontalRowPixels**(`paintImageArray`, `length`, `ratio`, `markedArr`, `targetWidth`, `convertIndex`): `void`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `paintImageArray` | `IPaintImage`[] | : the target view slice's marked images array |
| `length` | `number` | : the target view slice's dimention (total slice index num) |
| `ratio` | `number` | : the target slice image's width/height ratio of its dimention length |
| `markedArr` | `number`[][] \| `Uint8ClampedArray`[] | : current painted image's horizontal 2d Array |
| `targetWidth` | `number` | : the target image width |
| `convertIndex` | `number` | : Mapping current image's index to target slice image's width/height pixel start point |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1503](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1503)

___

### replaceVerticalColPixels

▸ `Private` **replaceVerticalColPixels**(`paintImageArray`, `length`, `ratio`, `markedArr`, `targetWidth`, `convertIndex`): `void`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `paintImageArray` | `IPaintImage`[] | : the target view slice's marked images array |
| `length` | `number` | : the target view slice's dimention (total slice index num) |
| `ratio` | `number` | : the target slice image's width/height ratio of its dimention length |
| `markedArr` | `number`[][] \| `Uint8ClampedArray`[] | : current painted image's vertical 2d Array |
| `targetWidth` | `number` | : the target image width |
| `convertIndex` | `number` | : Mapping current image's index to target slice image's width/height pixel start point |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1470](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1470)

___

### repraintCurrentContrastSlice

▸ **repraintCurrentContrastSlice**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1637](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1637)

___

### resetLayerCanvas

▸ **resetLayerCanvas**(): `void`

Rewrite this {resetLayerCanvas} function under NrrdTools

#### Returns

`void`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[resetLayerCanvas](Utils_segmentation_CommToolsData.CommToolsData.md#resetlayercanvas)

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

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[resetPaintAreaUIPosition](Utils_segmentation_CommToolsData.CommToolsData.md#resetpaintareauiposition)

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

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[resizePaintArea](Utils_segmentation_CommToolsData.CommToolsData.md#resizepaintarea)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:236](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L236)

___

### setCurrentLayer

▸ `Private` **setCurrentLayer**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `canvas` | `HTMLCanvasElement` |
| `ctx` | `CanvasRenderingContext2D` |

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:75](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L75)

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

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[setEmptyCanvasSize](Utils_segmentation_CommToolsData.CommToolsData.md#setemptycanvassize)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:276](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L276)

___

### setEraserUrls

▸ **setEraserUrls**(`urls`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `urls` | `string`[] |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:62](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L62)

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

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[setIsDrawFalse](Utils_segmentation_CommToolsData.CommToolsData.md#setisdrawfalse)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:244](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L244)

___

### setPencilIconUrls

▸ **setPencilIconUrls**(`urls`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `urls` | `string`[] |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:65](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L65)

___

### setSphereCanvasSize

▸ `Private` **setSphereCanvasSize**(`axis?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `axis?` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:931](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L931)

___

### setSyncsliceNum

▸ **setSyncsliceNum**(): `void`

Rewrite this {setSyncsliceNum} function under NrrdTools

#### Returns

`void`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[setSyncsliceNum](Utils_segmentation_CommToolsData.CommToolsData.md#setsyncslicenum)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:306](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L306)

___

### setUpSphereOrigins

▸ `Private` **setUpSphereOrigins**(`mouseX`, `mouseY`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `mouseX` | `number` |
| `mouseY` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1000](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1000)

___

### sliceArrayH

▸ `Private` **sliceArrayH**(`arr`, `row`, `col`): `Uint8ClampedArray`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `arr` | `Uint8ClampedArray` |
| `row` | `number` |
| `col` | `number` |

#### Returns

`Uint8ClampedArray`[]

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1432](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1432)

___

### sliceArrayV

▸ `Private` **sliceArrayV**(`arr`, `row`, `col`): `number`[][]

#### Parameters

| Name | Type |
| :------ | :------ |
| `arr` | `Uint8ClampedArray` |
| `row` | `number` |
| `col` | `number` |

#### Returns

`number`[][]

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1443](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1443)

___

### storeAllImages

▸ **storeAllImages**(`index`, `label`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |
| `label` | `string` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1189](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1189)

___

### storeEachLayerImage

▸ **storeEachLayerImage**(`index`, `label`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |
| `label` | `string` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1390](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1390)

___

### storeImageToAxis

▸ `Private` **storeImageToAxis**(`index`, `paintedImages`, `imageData`, `axis?`): `void`

**************************Store images***************************************************

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |
| `paintedImages` | `IPaintImages` |
| `imageData` | `ImageData` |
| `axis?` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1155](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1155)

___

### storeImageToLabel

▸ `Private` **storeImageToLabel**(`index`, `canvas`, `paintedImages`): `ImageData`

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |
| `canvas` | `HTMLCanvasElement` |
| `paintedImages` | `IPaintImages` |

#### Returns

`ImageData`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1370](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1370)

___

### storeSphereImages

▸ `Private` **storeSphereImages**(`index`, `axis`): `void`

**************************Sphere functions***************************************************

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |
| `axis` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:868](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L868)

___

### undoLastPainting

▸ **undoLastPainting**(): `void`

Rewrite this {undoLastPainting} function under DrawToolCore

#### Returns

`void`

#### Overrides

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[undoLastPainting](Utils_segmentation_CommToolsData.CommToolsData.md#undolastpainting)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1078](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1078)

___

### updateOriginAndChangedWH

▸ **updateOriginAndChangedWH**(): `void`

Rewrite this {updateOriginAndChangedWH} function under NrrdTools

#### Returns

`void`

#### Inherited from

[CommToolsData](Utils_segmentation_CommToolsData.CommToolsData.md).[updateOriginAndChangedWH](Utils_segmentation_CommToolsData.CommToolsData.md#updateoriginandchangedwh)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:252](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L252)

___

### updateSlicesContrast

▸ **updateSlicesContrast**(`value`, `flag`): `void`

****************************** Utils gui related functions **************************************

#### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `number` |
| `flag` | `string` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1612](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1612)

___

### useEraser

▸ `Private` **useEraser**(): (`x`: `number`, `y`: `number`, `radius`: `number`) => `void`

#### Returns

`fn`

▸ (`x`, `y`, `radius`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |
| `y` | `number` |
| `radius` | `number` |

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:742](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L742)
