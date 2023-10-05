[copper3d](../README.md) / [Modules](../modules.md) / [Utils/segmentation/NrrdTools](../modules/Utils_segmentation_NrrdTools.md) / NrrdTools

# Class: NrrdTools

[Utils/segmentation/NrrdTools](../modules/Utils_segmentation_NrrdTools.md).NrrdTools

## Hierarchy

- [`DrawToolCore`](Utils_segmentation_DrawToolCore.DrawToolCore.md)

  ↳ **`NrrdTools`**

## Table of contents

### Constructors

- [constructor](Utils_segmentation_NrrdTools.NrrdTools.md#constructor)

### Properties

- [baseCanvasesSize](Utils_segmentation_NrrdTools.NrrdTools.md#basecanvasessize)
- [container](Utils_segmentation_NrrdTools.NrrdTools.md#container)
- [cursorPage](Utils_segmentation_NrrdTools.NrrdTools.md#cursorpage)
- [dragOperator](Utils_segmentation_NrrdTools.NrrdTools.md#dragoperator)
- [drawingPrameters](Utils_segmentation_NrrdTools.NrrdTools.md#drawingprameters)
- [eraserUrls](Utils_segmentation_NrrdTools.NrrdTools.md#eraserurls)
- [gui\_states](Utils_segmentation_NrrdTools.NrrdTools.md#gui_states)
- [initState](Utils_segmentation_NrrdTools.NrrdTools.md#initstate)
- [mainAreaContainer](Utils_segmentation_NrrdTools.NrrdTools.md#mainareacontainer)
- [nrrd\_states](Utils_segmentation_NrrdTools.NrrdTools.md#nrrd_states)
- [paintedImage](Utils_segmentation_NrrdTools.NrrdTools.md#paintedimage)
- [pencilUrls](Utils_segmentation_NrrdTools.NrrdTools.md#pencilurls)
- [preTimer](Utils_segmentation_NrrdTools.NrrdTools.md#pretimer)
- [protectedData](Utils_segmentation_NrrdTools.NrrdTools.md#protecteddata)
- [start](Utils_segmentation_NrrdTools.NrrdTools.md#start)
- [storedPaintImages](Utils_segmentation_NrrdTools.NrrdTools.md#storedpaintimages)
- [undoArray](Utils_segmentation_NrrdTools.NrrdTools.md#undoarray)

### Methods

- [addSkip](Utils_segmentation_NrrdTools.NrrdTools.md#addskip)
- [afterLoadSlice](Utils_segmentation_NrrdTools.NrrdTools.md#afterloadslice)
- [appendLoadingbar](Utils_segmentation_NrrdTools.NrrdTools.md#appendloadingbar)
- [clear](Utils_segmentation_NrrdTools.NrrdTools.md#clear)
- [clearDictionary](Utils_segmentation_NrrdTools.NrrdTools.md#cleardictionary)
- [clearPaint](Utils_segmentation_NrrdTools.NrrdTools.md#clearpaint)
- [clearStoreImages](Utils_segmentation_NrrdTools.NrrdTools.md#clearstoreimages)
- [convertCursorPoint](Utils_segmentation_NrrdTools.NrrdTools.md#convertcursorpoint)
- [createEmptyPaintImage](Utils_segmentation_NrrdTools.NrrdTools.md#createemptypaintimage)
- [drag](Utils_segmentation_NrrdTools.NrrdTools.md#drag)
- [draw](Utils_segmentation_NrrdTools.NrrdTools.md#draw)
- [drawSphere](Utils_segmentation_NrrdTools.NrrdTools.md#drawsphere)
- [filterDrawedImage](Utils_segmentation_NrrdTools.NrrdTools.md#filterdrawedimage)
- [flipDisplayImageByAxis](Utils_segmentation_NrrdTools.NrrdTools.md#flipdisplayimagebyaxis)
- [getContainer](Utils_segmentation_NrrdTools.NrrdTools.md#getcontainer)
- [getCurrentImageDimension](Utils_segmentation_NrrdTools.NrrdTools.md#getcurrentimagedimension)
- [getCurrentSliceIndex](Utils_segmentation_NrrdTools.NrrdTools.md#getcurrentsliceindex)
- [getCurrentSlicesNumAndContrastNum](Utils_segmentation_NrrdTools.NrrdTools.md#getcurrentslicesnumandcontrastnum)
- [getDrawingCanvas](Utils_segmentation_NrrdTools.NrrdTools.md#getdrawingcanvas)
- [getIsShowContrastState](Utils_segmentation_NrrdTools.NrrdTools.md#getisshowcontraststate)
- [getMaskData](Utils_segmentation_NrrdTools.NrrdTools.md#getmaskdata)
- [getMaxSliceNum](Utils_segmentation_NrrdTools.NrrdTools.md#getmaxslicenum)
- [getNrrdToolsSettings](Utils_segmentation_NrrdTools.NrrdTools.md#getnrrdtoolssettings)
- [getSharedPlace](Utils_segmentation_NrrdTools.NrrdTools.md#getsharedplace)
- [getSpaceOrigin](Utils_segmentation_NrrdTools.NrrdTools.md#getspaceorigin)
- [getVoxelSpacing](Utils_segmentation_NrrdTools.NrrdTools.md#getvoxelspacing)
- [init](Utils_segmentation_NrrdTools.NrrdTools.md#init)
- [initPaintImages](Utils_segmentation_NrrdTools.NrrdTools.md#initpaintimages)
- [loadDisplaySlicesArray](Utils_segmentation_NrrdTools.NrrdTools.md#loaddisplayslicesarray)
- [loadingMaskByLabel](Utils_segmentation_NrrdTools.NrrdTools.md#loadingmaskbylabel)
- [redrawDisplayCanvas](Utils_segmentation_NrrdTools.NrrdTools.md#redrawdisplaycanvas)
- [redrawMianPreOnDisplayCanvas](Utils_segmentation_NrrdTools.NrrdTools.md#redrawmianpreondisplaycanvas)
- [reloadMaskToLabel](Utils_segmentation_NrrdTools.NrrdTools.md#reloadmasktolabel)
- [removeSkip](Utils_segmentation_NrrdTools.NrrdTools.md#removeskip)
- [repraintCurrentContrastSlice](Utils_segmentation_NrrdTools.NrrdTools.md#repraintcurrentcontrastslice)
- [resetDisplaySlicesStatus](Utils_segmentation_NrrdTools.NrrdTools.md#resetdisplayslicesstatus)
- [resetLayerCanvas](Utils_segmentation_NrrdTools.NrrdTools.md#resetlayercanvas)
- [resetPaintAreaUIPosition](Utils_segmentation_NrrdTools.NrrdTools.md#resetpaintareauiposition)
- [resizePaintArea](Utils_segmentation_NrrdTools.NrrdTools.md#resizepaintarea)
- [setAllSlices](Utils_segmentation_NrrdTools.NrrdTools.md#setallslices)
- [setBaseDrawDisplayCanvasesSize](Utils_segmentation_NrrdTools.NrrdTools.md#setbasedrawdisplaycanvasessize)
- [setDisplaySlicesBaseOnAxis](Utils_segmentation_NrrdTools.NrrdTools.md#setdisplayslicesbaseonaxis)
- [setEmptyCanvasSize](Utils_segmentation_NrrdTools.NrrdTools.md#setemptycanvassize)
- [setEraserUrls](Utils_segmentation_NrrdTools.NrrdTools.md#seteraserurls)
- [setIsDrawFalse](Utils_segmentation_NrrdTools.NrrdTools.md#setisdrawfalse)
- [setMainAreaSize](Utils_segmentation_NrrdTools.NrrdTools.md#setmainareasize)
- [setMainPreSlice](Utils_segmentation_NrrdTools.NrrdTools.md#setmainpreslice)
- [setMasksData](Utils_segmentation_NrrdTools.NrrdTools.md#setmasksdata)
- [setOriginCanvasAndPre](Utils_segmentation_NrrdTools.NrrdTools.md#setorigincanvasandpre)
- [setPencilIconUrls](Utils_segmentation_NrrdTools.NrrdTools.md#setpenciliconurls)
- [setShowInMainArea](Utils_segmentation_NrrdTools.NrrdTools.md#setshowinmainarea)
- [setSliceMoving](Utils_segmentation_NrrdTools.NrrdTools.md#setslicemoving)
- [setSliceOrientation](Utils_segmentation_NrrdTools.NrrdTools.md#setsliceorientation)
- [setSyncsliceNum](Utils_segmentation_NrrdTools.NrrdTools.md#setsyncslicenum)
- [setupConfigs](Utils_segmentation_NrrdTools.NrrdTools.md#setupconfigs)
- [setupGUI](Utils_segmentation_NrrdTools.NrrdTools.md#setupgui)
- [storeAllImages](Utils_segmentation_NrrdTools.NrrdTools.md#storeallimages)
- [storeEachLayerImage](Utils_segmentation_NrrdTools.NrrdTools.md#storeeachlayerimage)
- [switchAllSlicesArrayData](Utils_segmentation_NrrdTools.NrrdTools.md#switchallslicesarraydata)
- [undoLastPainting](Utils_segmentation_NrrdTools.NrrdTools.md#undolastpainting)
- [updateMaxIndex](Utils_segmentation_NrrdTools.NrrdTools.md#updatemaxindex)
- [updateOriginAndChangedWH](Utils_segmentation_NrrdTools.NrrdTools.md#updateoriginandchangedwh)
- [updateSlicesContrast](Utils_segmentation_NrrdTools.NrrdTools.md#updateslicescontrast)

## Constructors

### constructor

• **new NrrdTools**(`container`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` |

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[constructor](Utils_segmentation_DrawToolCore.DrawToolCore.md#constructor)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L34)

## Properties

### baseCanvasesSize

• **baseCanvasesSize**: `number` = `1`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[baseCanvasesSize](Utils_segmentation_DrawToolCore.DrawToolCore.md#basecanvasessize)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:14](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L14)

___

### container

• **container**: `HTMLDivElement`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[container](Utils_segmentation_DrawToolCore.DrawToolCore.md#container)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:23](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L23)

___

### cursorPage

• **cursorPage**: `ICursorPage`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[cursorPage](Utils_segmentation_DrawToolCore.DrawToolCore.md#cursorpage)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:70](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L70)

___

### dragOperator

• **dragOperator**: [`DragOperator`](Utils_segmentation_DragOperator.DragOperator.md)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:26](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L26)

___

### drawingPrameters

• **drawingPrameters**: `IDrawingEvents`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[drawingPrameters](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawingprameters)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:16](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L16)

___

### eraserUrls

• **eraserUrls**: `string`[] = `[]`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[eraserUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#eraserurls)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L27)

___

### gui\_states

• **gui\_states**: `IGUIStates`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[gui_states](Utils_segmentation_DrawToolCore.DrawToolCore.md#gui_states)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:91](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L91)

___

### initState

• `Private` **initState**: `boolean` = `true`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L31)

___

### mainAreaContainer

• **mainAreaContainer**: `HTMLDivElement`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[mainAreaContainer](Utils_segmentation_DrawToolCore.DrawToolCore.md#mainareacontainer)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L15)

___

### nrrd\_states

• **nrrd\_states**: `INrrdStates`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[nrrd_states](Utils_segmentation_DrawToolCore.DrawToolCore.md#nrrd_states)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:15](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L15)

___

### paintedImage

• `Private` **paintedImage**: `undefined` \| `IPaintImage`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L29)

___

### pencilUrls

• **pencilUrls**: `string`[] = `[]`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[pencilUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#pencilurls)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L28)

___

### preTimer

• `Private` **preTimer**: `any`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:32](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L32)

___

### protectedData

• **protectedData**: `IProtected`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[protectedData](Utils_segmentation_DrawToolCore.DrawToolCore.md#protecteddata)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:141](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L141)

___

### start

• **start**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[start](Utils_segmentation_DrawToolCore.DrawToolCore.md#start)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:32](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L32)

___

### storedPaintImages

• **storedPaintImages**: `undefined` \| `IStoredPaintImages`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L27)

___

### undoArray

• **undoArray**: `IUndoType`[] = `[]`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[undoArray](Utils_segmentation_DrawToolCore.DrawToolCore.md#undoarray)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L29)

## Methods

### addSkip

▸ **addSkip**(`index`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:649](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L649)

___

### afterLoadSlice

▸ `Private` **afterLoadSlice**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:879](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L879)

___

### appendLoadingbar

▸ **appendLoadingbar**(`loadingbar`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `loadingbar` | `HTMLDivElement` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:935](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L935)

___

### clear

▸ **clear**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:667](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L667)

___

### clearDictionary

▸ `Private` **clearDictionary**(`dic`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `dic` | `ISkipSlicesDictType` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:1162](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L1162)

___

### clearPaint

▸ **clearPaint**(): `void`

Clear mask on current slice canvas

#### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[clearPaint](Utils_segmentation_DrawToolCore.DrawToolCore.md#clearpaint)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1059](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1059)

___

### clearStoreImages

▸ **clearStoreImages**(): `void`

Rewrite this {clearStoreImages} function under NrrdTools

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[clearStoreImages](Utils_segmentation_DrawToolCore.DrawToolCore.md#clearstoreimages)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:939](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L939)

___

### convertCursorPoint

▸ **convertCursorPoint**(`from`, `to`, `cursorNumX`, `cursorNumY`, `currentSliceIndex`): `undefined` \| { `convertCursorNumX`: `number` ; `convertCursorNumY`: `number` ; `currentIndex`: `number` ; `oldIndex`: `number`  }

We generate the MRI slice from threejs based on mm, but when we display it is based on pixel size/distance.
So, the index munber on each axis (sagittal, axial, coronal) is the slice's depth in mm distance. And the width and height displayed on screen is the slice's width and height in pixel distance.

When we switch into different axis' views, we need to convert current view's the depth to the pixel distance in other views width or height, and convert the current view's width or height from pixel distance to mm distance as other views' depth (slice index) in general.

Then as for the crosshair (Cursor Inspector), we also need to convert the cursor point (x, y, z) to other views' (x, y, z).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `from` | ``"z"`` \| ``"y"`` \| ``"x"`` | "x" \| "y" \| "z", current view axis, "x: sagittle, y: coronal, z: axial". |
| `to` | ``"z"`` \| ``"y"`` \| ``"x"`` | "x" \| "y" \| "z", target view axis (where you want jump to), "x: sagittle, y: coronal, z: axial". |
| `cursorNumX` | `number` | number, cursor point x on current axis's slice. (pixel distance) |
| `cursorNumY` | `number` | number, cursor point y on current axis's slice. (pixel distance) |
| `currentSliceIndex` | `number` | number, current axis's slice's index/depth. (mm distance) |

#### Returns

`undefined` \| { `convertCursorNumX`: `number` ; `convertCursorNumY`: `number` ; `currentIndex`: `number` ; `oldIndex`: `number`  }

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[convertCursorPoint](Utils_segmentation_DrawToolCore.DrawToolCore.md#convertcursorpoint)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:402](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L402)

___

### createEmptyPaintImage

▸ `Private` **createEmptyPaintImage**(`dimensions`, `paintImages`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `dimensions` | `number`[] |
| `paintImages` | `IPaintImages` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:346](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L346)

___

### drag

▸ **drag**(`opts?`): `void`

core function for drag slices

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts?` | `IDragOpts` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:65](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L65)

___

### draw

▸ **draw**(`opts?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts?` | `IDrawOpts` |

#### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[draw](Utils_segmentation_DrawToolCore.DrawToolCore.md#draw)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:99](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L99)

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

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[drawSphere](Utils_segmentation_DrawToolCore.DrawToolCore.md#drawsphere)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:976](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L976)

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

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[filterDrawedImage](Utils_segmentation_DrawToolCore.DrawToolCore.md#filterdrawedimage)

#### Defined in

[src/Utils/segmentation/CommToolsData.ts:328](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/CommToolsData.ts#L328)

___

### flipDisplayImageByAxis

▸ **flipDisplayImageByAxis**(): `void`

flip the canvas to a correct position.
This is because the slice canvas from threejs is not in a correct 2D postion.
Thus, everytime when we redraw the display canvas, we need to flip to draw the origin canvas from threejs.
Under different axis(sagittal, Axial, Coronal), the flip orientation is different.

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[flipDisplayImageByAxis](Utils_segmentation_DrawToolCore.DrawToolCore.md#flipdisplayimagebyaxis)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:1145](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L1145)

___

### getContainer

▸ **getContainer**(): `HTMLElement`

#### Returns

`HTMLElement`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:731](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L731)

___

### getCurrentImageDimension

▸ **getCurrentImageDimension**(): `number`[]

#### Returns

`number`[]

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:288](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L288)

___

### getCurrentSliceIndex

▸ **getCurrentSliceIndex**(): `number`

#### Returns

`number`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:758](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L758)

___

### getCurrentSlicesNumAndContrastNum

▸ **getCurrentSlicesNumAndContrastNum**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `contrastIndex` | `number` |
| `currentIndex` | `number` |

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:751](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L751)

___

### getDrawingCanvas

▸ **getDrawingCanvas**(): `HTMLCanvasElement`

#### Returns

`HTMLCanvasElement`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:734](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L734)

___

### getIsShowContrastState

▸ **getIsShowContrastState**(): `boolean`

#### Returns

`boolean`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:764](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L764)

___

### getMaskData

▸ **getMaskData**(): `IMaskData`

#### Returns

`IMaskData`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:298](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L298)

___

### getMaxSliceNum

▸ **getMaxSliceNum**(): `number`[]

#### Returns

`number`[]

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:741](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L741)

___

### getNrrdToolsSettings

▸ **getNrrdToolsSettings**(): `INrrdStates`

#### Returns

`INrrdStates`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:737](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L737)

___

### getSharedPlace

▸ `Private` **getSharedPlace**(`len`, `ratio`): `number`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `len` | `number` |
| `ratio` | `number` |

#### Returns

`number`[]

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:302](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L302)

___

### getSpaceOrigin

▸ **getSpaceOrigin**(): `number`[]

#### Returns

`number`[]

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:295](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L295)

___

### getVoxelSpacing

▸ **getVoxelSpacing**(): `number`[]

#### Returns

`number`[]

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:292](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L292)

___

### init

▸ `Private` **init**(): `void`

A initialise function for nrrd_tools

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:131](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L131)

___

### initPaintImages

▸ `Private` **initPaintImages**(`dimensions`): `void`

init all painted images for store images

#### Parameters

| Name | Type |
| :------ | :------ |
| `dimensions` | `number`[] |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:327](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L327)

___

### loadDisplaySlicesArray

▸ `Private` **loadDisplaySlicesArray**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:797](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L797)

___

### loadingMaskByLabel

▸ `Private` **loadingMaskByLabel**(`masks`, `index`, `imageData`): `ImageData`

#### Parameters

| Name | Type |
| :------ | :------ |
| `masks` | `exportPaintImageType`[] |
| `index` | `number` |
| `imageData` | `ImageData` |

#### Returns

`ImageData`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:203](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L203)

___

### redrawDisplayCanvas

▸ **redrawDisplayCanvas**(): `void`

Redraw current contrast image to display canvas.
It is more related to change the contrast slice image's window width or center.

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[redrawDisplayCanvas](Utils_segmentation_DrawToolCore.DrawToolCore.md#redrawdisplaycanvas)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:1202](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L1202)

___

### redrawMianPreOnDisplayCanvas

▸ **redrawMianPreOnDisplayCanvas**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:987](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L987)

___

### reloadMaskToLabel

▸ `Private` **reloadMaskToLabel**(`paintImages`, `ctx`): `void`

Used to init the mask on each label and reload

#### Parameters

| Name | Type |
| :------ | :------ |
| `paintImages` | `IPaintImages` |
| `ctx` | `CanvasRenderingContext2D` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:1084](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L1084)

___

### removeSkip

▸ **removeSkip**(`index`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:661](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L661)

___

### repraintCurrentContrastSlice

▸ **repraintCurrentContrastSlice**(): `void`

#### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[repraintCurrentContrastSlice](Utils_segmentation_DrawToolCore.DrawToolCore.md#repraintcurrentcontrastslice)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1637](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1637)

___

### resetDisplaySlicesStatus

▸ `Private` **resetDisplaySlicesStatus**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:824](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L824)

___

### resetLayerCanvas

▸ **resetLayerCanvas**(): `void`

Clear masks on drawingCanvas layers.

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[resetLayerCanvas](Utils_segmentation_DrawToolCore.DrawToolCore.md#resetlayercanvas)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:976](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L976)

___

### resetPaintAreaUIPosition

▸ **resetPaintAreaUIPosition**(`l?`, `t?`): `void`

Reset the draw and display canvases layout after mouse pan.
If no params in, then center the draw and display canvases.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `l?` | `number` | number, Offset to the left |
| `t?` | `number` | number, Offset to the top |

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[resetPaintAreaUIPosition](Utils_segmentation_DrawToolCore.DrawToolCore.md#resetpaintareauiposition)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:961](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L961)

___

### resizePaintArea

▸ **resizePaintArea**(`factor`): `void`

Resize the draw and display canvas size based on the input size factor number.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `factor` | `number` | number |

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[resizePaintArea](Utils_segmentation_DrawToolCore.DrawToolCore.md#resizepaintarea)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:1015](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L1015)

___

### setAllSlices

▸ **setAllSlices**(`allSlices`): `void`

entry function
  * {
   x:slice,
   y:slice,
   z:slice
}

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `allSlices` | `nrrdSliceType`[] | all nrrd contrast slices |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:153](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L153)

___

### setBaseDrawDisplayCanvasesSize

▸ **setBaseDrawDisplayCanvasesSize**(`size`): `void`

Set the Draw Display Canvas base size

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `size` | `number` | number |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:81](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L81)

___

### setDisplaySlicesBaseOnAxis

▸ `Private` **setDisplaySlicesBaseOnAxis**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:784](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L784)

___

### setEmptyCanvasSize

▸ **setEmptyCanvasSize**(`axis?`): `void`

Set the empty canvas width and height based on the axis (pixel distance not the mm), to reduce duplicate codes.

#### Parameters

| Name | Type |
| :------ | :------ |
| `axis?` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[setEmptyCanvasSize](Utils_segmentation_DrawToolCore.DrawToolCore.md#setemptycanvassize)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:1173](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L1173)

___

### setEraserUrls

▸ **setEraserUrls**(`urls`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `urls` | `string`[] |

#### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[setEraserUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#seteraserurls)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:62](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L62)

___

### setIsDrawFalse

▸ **setIsDrawFalse**(`target`): `void`

Give a delay time to finish the last drawing before upcoming interrupt opreations.
Give a delay time number (ms) to disable the draw function,
After your interrupt opeartion, you should enable the draw fucntion.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `target` | `number` | number |

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[setIsDrawFalse](Utils_segmentation_DrawToolCore.DrawToolCore.md#setisdrawfalse)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:774](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L774)

___

### setMainAreaSize

▸ **setMainAreaSize**(`factor`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `factor` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:718](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L718)

___

### setMainPreSlice

▸ `Private` **setMainPreSlice**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:848](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L848)

___

### setMasksData

▸ **setMasksData**(`masksData`, `loadingBar?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `masksData` | `storeExportPaintImageType` |
| `loadingBar?` | `loadingBarType` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:220](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L220)

___

### setOriginCanvasAndPre

▸ `Private` **setOriginCanvasAndPre**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:855](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L855)

___

### setPencilIconUrls

▸ **setPencilIconUrls**(`urls`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `urls` | `string`[] |

#### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[setPencilIconUrls](Utils_segmentation_DrawToolCore.DrawToolCore.md#setpenciliconurls)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:65](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L65)

___

### setShowInMainArea

▸ `Private` **setShowInMainArea**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:284](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L284)

___

### setSliceMoving

▸ **setSliceMoving**(`step`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `step` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:709](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L709)

___

### setSliceOrientation

▸ **setSliceOrientation**(`axisTo`): `void`

Switch all contrast slices' orientation

#### Parameters

| Name | Type |
| :------ | :------ |
| `axisTo` | ``"z"`` \| ``"y"`` \| ``"x"`` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:499](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L499)

___

### setSyncsliceNum

▸ **setSyncsliceNum**(): `void`

Keep all contrast slice index to same.
Synchronize the slice indexes of all the contrasts so that they are consistent with the main slice's index.

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[setSyncsliceNum](Utils_segmentation_DrawToolCore.DrawToolCore.md#setsyncslicenum)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:927](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L927)

___

### setupConfigs

▸ `Private` **setupConfigs**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:831](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L831)

___

### setupGUI

▸ **setupGUI**(`gui`): `void`

Set up GUI for drawing panel

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `gui` | `GUI` | GUI |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:95](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L95)

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

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[storeAllImages](Utils_segmentation_DrawToolCore.DrawToolCore.md#storeallimages)

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

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[storeEachLayerImage](Utils_segmentation_DrawToolCore.DrawToolCore.md#storeeachlayerimage)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1390](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1390)

___

### switchAllSlicesArrayData

▸ **switchAllSlicesArrayData**(`allSlices`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `allSlices` | `nrrdSliceType`[] |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:818](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L818)

___

### undoLastPainting

▸ **undoLastPainting**(): `void`

Rewrite this {undoLastPainting} function under DrawToolCore

#### Returns

`void`

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[undoLastPainting](Utils_segmentation_DrawToolCore.DrawToolCore.md#undolastpainting)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1078](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1078)

___

### updateMaxIndex

▸ `Private` **updateMaxIndex**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:899](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L899)

___

### updateOriginAndChangedWH

▸ **updateOriginAndChangedWH**(): `void`

Update the original canvas size, allow set to threejs load one (pixel distance not the mm).
Then update the changedWidth and changedHeight based on the sizeFoctor.

#### Returns

`void`

#### Overrides

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[updateOriginAndChangedWH](Utils_segmentation_DrawToolCore.DrawToolCore.md#updateoriginandchangedwh)

#### Defined in

[src/Utils/segmentation/NrrdTools.ts:909](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/NrrdTools.ts#L909)

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

#### Inherited from

[DrawToolCore](Utils_segmentation_DrawToolCore.DrawToolCore.md).[updateSlicesContrast](Utils_segmentation_DrawToolCore.DrawToolCore.md#updateslicescontrast)

#### Defined in

[src/Utils/segmentation/DrawToolCore.ts:1612](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DrawToolCore.ts#L1612)
