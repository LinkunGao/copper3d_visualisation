[copper3d](../README.md) / [Modules](../modules.md) / [Utils/segmentation/DragOperator](../modules/Utils_segmentation_DragOperator.md) / DragOperator

# Class: DragOperator

[Utils/segmentation/DragOperator](../modules/Utils_segmentation_DragOperator.md).DragOperator

## Table of contents

### Constructors

- [constructor](Utils_segmentation_DragOperator.DragOperator.md#constructor)

### Properties

- [container](Utils_segmentation_DragOperator.DragOperator.md#container)
- [dragEffectCanvases](Utils_segmentation_DragOperator.DragOperator.md#drageffectcanvases)
- [dragPrameters](Utils_segmentation_DragOperator.DragOperator.md#dragprameters)
- [drawingPrameters](Utils_segmentation_DragOperator.DragOperator.md#drawingprameters)
- [filterDrawedImage](Utils_segmentation_DragOperator.DragOperator.md#filterdrawedimage)
- [flipDisplayImageByAxis](Utils_segmentation_DragOperator.DragOperator.md#flipdisplayimagebyaxis)
- [gui\_states](Utils_segmentation_DragOperator.DragOperator.md#gui_states)
- [nrrd\_states](Utils_segmentation_DragOperator.DragOperator.md#nrrd_states)
- [protectedData](Utils_segmentation_DragOperator.DragOperator.md#protecteddata)
- [sensitiveArray](Utils_segmentation_DragOperator.DragOperator.md#sensitivearray)
- [setEmptyCanvasSize](Utils_segmentation_DragOperator.DragOperator.md#setemptycanvassize)
- [setIsDrawFalse](Utils_segmentation_DragOperator.DragOperator.md#setisdrawfalse)
- [setSyncsliceNum](Utils_segmentation_DragOperator.DragOperator.md#setsyncslicenum)
- [showDragNumberDiv](Utils_segmentation_DragOperator.DragOperator.md#showdragnumberdiv)

### Methods

- [cleanCanvases](Utils_segmentation_DragOperator.DragOperator.md#cleancanvases)
- [configDragMode](Utils_segmentation_DragOperator.DragOperator.md#configdragmode)
- [drag](Utils_segmentation_DragOperator.DragOperator.md#drag)
- [drawDragSlice](Utils_segmentation_DragOperator.DragOperator.md#drawdragslice)
- [drawMaskToLabelCtx](Utils_segmentation_DragOperator.DragOperator.md#drawmasktolabelctx)
- [init](Utils_segmentation_DragOperator.DragOperator.md#init)
- [removeDragMode](Utils_segmentation_DragOperator.DragOperator.md#removedragmode)
- [updateCurrentContrastSlice](Utils_segmentation_DragOperator.DragOperator.md#updatecurrentcontrastslice)
- [updateIndex](Utils_segmentation_DragOperator.DragOperator.md#updateindex)
- [updateMainSlice](Utils_segmentation_DragOperator.DragOperator.md#updatemainslice)
- [updateShowNumDiv](Utils_segmentation_DragOperator.DragOperator.md#updateshownumdiv)

## Constructors

### constructor

• **new DragOperator**(`container`, `nrrd_sates`, `gui_states`, `protectedData`, `drawingPrameters`, `setSyncsliceNum`, `setIsDrawFalse`, `flipDisplayImageByAxis`, `setEmptyCanvasSize`, `filterDrawedImage`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLElement` |
| `nrrd_sates` | `INrrdStates` |
| `gui_states` | `IGUIStates` |
| `protectedData` | `IProtected` |
| `drawingPrameters` | `IDrawingEvents` |
| `setSyncsliceNum` | () => `void` |
| `setIsDrawFalse` | (`target`: `number`) => `void` |
| `flipDisplayImageByAxis` | () => `void` |
| `setEmptyCanvasSize` | (`axis?`: ``"z"`` \| ``"y"`` \| ``"x"``) => `void` |
| `filterDrawedImage` | (`axis`: ``"z"`` \| ``"y"`` \| ``"x"``, `sliceIndex`: `number`, `paintedImages`: `IPaintImages`) => `IPaintImage` |

#### Defined in

[src/Utils/segmentation/DragOperator.ts:53](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L53)

## Properties

### container

• **container**: `HTMLElement`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:24](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L24)

___

### dragEffectCanvases

• `Private` **dragEffectCanvases**: `undefined` \| `IDragEffectCanvases`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:41](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L41)

___

### dragPrameters

• `Private` **dragPrameters**: `IDragPrameters`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:26](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L26)

___

### drawingPrameters

• `Private` **drawingPrameters**: `IDrawingEvents`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L35)

___

### filterDrawedImage

• `Private` **filterDrawedImage**: (`axis`: ``"z"`` \| ``"y"`` \| ``"x"``, `sliceIndex`: `number`, `paintedImages`: `IPaintImages`) => `IPaintImage`

#### Type declaration

▸ (`axis`, `sliceIndex`, `paintedImages`): `IPaintImage`

##### Parameters

| Name | Type |
| :------ | :------ |
| `axis` | ``"z"`` \| ``"y"`` \| ``"x"`` |
| `sliceIndex` | `number` |
| `paintedImages` | `IPaintImages` |

##### Returns

`IPaintImage`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:47](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L47)

___

### flipDisplayImageByAxis

• `Private` **flipDisplayImageByAxis**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:45](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L45)

___

### gui\_states

• `Private` **gui\_states**: `IGUIStates`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L39)

___

### nrrd\_states

• `Private` **nrrd\_states**: `INrrdStates`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L38)

___

### protectedData

• `Private` **protectedData**: `IProtected`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:40](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L40)

___

### sensitiveArray

• `Private` **sensitiveArray**: `number`[] = `[]`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:36](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L36)

___

### setEmptyCanvasSize

• `Private` **setEmptyCanvasSize**: (`axis?`: ``"z"`` \| ``"y"`` \| ``"x"``) => `void`

#### Type declaration

▸ (`axis?`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `axis?` | ``"z"`` \| ``"y"`` \| ``"x"`` |

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:46](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L46)

___

### setIsDrawFalse

• `Private` **setIsDrawFalse**: (`target`: `number`) => `void`

#### Type declaration

▸ (`target`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `number` |

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:44](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L44)

___

### setSyncsliceNum

• `Private` **setSyncsliceNum**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:43](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L43)

___

### showDragNumberDiv

• `Private` **showDragNumberDiv**: `HTMLDivElement`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:37](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L37)

## Methods

### cleanCanvases

▸ `Private` **cleanCanvases**(`flag`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `flag` | `boolean` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:337](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L337)

___

### configDragMode

▸ **configDragMode**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:378](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L378)

___

### drag

▸ **drag**(`opts?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts?` | `IDragOpts` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:99](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L99)

___

### drawDragSlice

▸ `Private` **drawDragSlice**(`canvas`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `canvas` | `any` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:265](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L265)

___

### drawMaskToLabelCtx

▸ `Private` **drawMaskToLabelCtx**(`paintedImages`, `ctx`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `paintedImages` | `IPaintImages` |
| `ctx` | `CanvasRenderingContext2D` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:312](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L312)

___

### init

▸ `Private` **init**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:84](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L84)

___

### removeDragMode

▸ **removeDragMode**(): `void`

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:391](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L391)

___

### updateCurrentContrastSlice

▸ **updateCurrentContrastSlice**(): `any`

#### Returns

`any`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:372](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L372)

___

### updateIndex

▸ **updateIndex**(`move`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `move` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:180](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L180)

___

### updateMainSlice

▸ **updateMainSlice**(`mainPreSlices`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `mainPreSlices` | `any` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:406](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L406)

___

### updateShowNumDiv

▸ **updateShowNumDiv**(`contrastNum`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `contrastNum` | `number` |

#### Returns

`void`

#### Defined in

[src/Utils/segmentation/DragOperator.ts:351](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/segmentation/DragOperator.ts#L351)
