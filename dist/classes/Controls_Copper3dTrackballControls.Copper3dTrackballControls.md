[copper3d](../README.md) / [Modules](../modules.md) / [Controls/Copper3dTrackballControls](../modules/Controls_Copper3dTrackballControls.md) / Copper3dTrackballControls

# Class: Copper3dTrackballControls

[Controls/Copper3dTrackballControls](../modules/Controls_Copper3dTrackballControls.md).Copper3dTrackballControls

## Hierarchy

- `EventDispatcher`

  ↳ **`Copper3dTrackballControls`**

## Table of contents

### Constructors

- [constructor](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#constructor)

### Properties

- [checkDistances](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#checkdistances)
- [dispose](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#dispose)
- [domElement](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#domelement)
- [dynamicDampingFactor](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#dynamicdampingfactor)
- [enabled](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#enabled)
- [handleResize](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#handleresize)
- [keys](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#keys)
- [maxDistance](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#maxdistance)
- [maxZoom](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#maxzoom)
- [minDistance](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#mindistance)
- [minZoom](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#minzoom)
- [mouseButtons](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#mousebuttons)
- [noPan](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#nopan)
- [noRotate](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#norotate)
- [noZoom](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#nozoom)
- [object](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#object)
- [panCamera](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#pancamera)
- [panSpeed](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#panspeed)
- [position0](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#position0)
- [reset](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#reset)
- [rotateCamera](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#rotatecamera)
- [rotateSpeed](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#rotatespeed)
- [screen](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#screen)
- [staticMoving](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#staticmoving)
- [target](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#target)
- [target0](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#target0)
- [up0](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#up0)
- [update](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#update)
- [zoom0](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#zoom0)
- [zoomCamera](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#zoomcamera)
- [zoomSpeed](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#zoomspeed)

### Methods

- [addEventListener](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#addeventlistener)
- [dispatchEvent](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#dispatchevent)
- [hasEventListener](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#haseventlistener)
- [removeEventListener](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md#removeeventlistener)

## Constructors

### constructor

• **new Copper3dTrackballControls**(`object`, `domElement`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `object` | `PerspectiveCamera` \| `OrthographicCamera` |
| `domElement` | `HTMLElement` |

#### Overrides

EventDispatcher.constructor

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:79](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L79)

## Properties

### checkDistances

• **checkDistances**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:72](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L72)

___

### dispose

• **dispose**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:77](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L77)

___

### domElement

• **domElement**: `HTMLElement`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:29](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L29)

___

### dynamicDampingFactor

• **dynamicDampingFactor**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:42](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L42)

___

### enabled

• **enabled**: `boolean`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:30](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L30)

___

### handleResize

• **handleResize**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:66](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L66)

___

### keys

• **keys**: [``"KeyA"``, ``"KeyS"``, ``"KeyD"``]

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:50](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L50)

___

### maxDistance

• **maxDistance**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:45](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L45)

___

### maxZoom

• **maxZoom**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:48](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L48)

___

### minDistance

• **minDistance**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:44](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L44)

___

### minZoom

• **minZoom**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:47](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L47)

___

### mouseButtons

• **mouseButtons**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `LEFT` | ``-1`` \| `LEFT` \| `RIGHT` |
| `MIDDLE` | ``-1`` \| `LEFT` \| `MIDDLE` \| `RIGHT` |
| `RIGHT` | ``-1`` \| `LEFT` \| `RIGHT` |

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:52](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L52)

___

### noPan

• **noPan**: `boolean`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:39](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L39)

___

### noRotate

• **noRotate**: `boolean`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:37](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L37)

___

### noZoom

• **noZoom**: `boolean`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L38)

___

### object

• **object**: `PerspectiveCamera` \| `OrthographicCamera`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L28)

___

### panCamera

• **panCamera**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:70](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L70)

___

### panSpeed

• **panSpeed**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L35)

___

### position0

• **position0**: `Vector3`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:61](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L61)

___

### reset

• **reset**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:75](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L75)

___

### rotateCamera

• **rotateCamera**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:68](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L68)

___

### rotateSpeed

• **rotateSpeed**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:33](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L33)

___

### screen

• **screen**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `height` | `number` |
| `left` | `number` |
| `top` | `number` |
| `width` | `number` |

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:31](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L31)

___

### staticMoving

• **staticMoving**: `boolean`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:41](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L41)

___

### target

• **target**: `Vector3`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:58](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L58)

___

### target0

• **target0**: `Vector3`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:60](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L60)

___

### up0

• **up0**: `Vector3`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:62](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L62)

___

### update

• **update**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:74](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L74)

___

### zoom0

• **zoom0**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:63](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L63)

___

### zoomCamera

• **zoomCamera**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:69](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L69)

___

### zoomSpeed

• **zoomSpeed**: `number`

#### Defined in

[src/Controls/Copper3dTrackballControls.ts:34](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/Copper3dTrackballControls.ts#L34)

## Methods

### addEventListener

▸ **addEventListener**<`T`\>(`type`, `listener`): `void`

Adds a listener to an event type.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `string` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `T` | The type of event to listen to. |
| `listener` | `EventListener`<`Event`, `T`, [`Copper3dTrackballControls`](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md)\> | The function that gets called when the event is fired. |

#### Returns

`void`

#### Inherited from

EventDispatcher.addEventListener

#### Defined in

node_modules/@types/three/src/core/EventDispatcher.d.ts:46

___

### dispatchEvent

▸ **dispatchEvent**(`event`): `void`

Fire an event type.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | `Event` | The event that gets fired. |

#### Returns

`void`

#### Inherited from

EventDispatcher.dispatchEvent

#### Defined in

node_modules/@types/three/src/core/EventDispatcher.d.ts:66

___

### hasEventListener

▸ **hasEventListener**<`T`\>(`type`, `listener`): `boolean`

Checks if listener is added to an event type.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `string` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `T` | The type of event to listen to. |
| `listener` | `EventListener`<`Event`, `T`, [`Copper3dTrackballControls`](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md)\> | The function that gets called when the event is fired. |

#### Returns

`boolean`

#### Inherited from

EventDispatcher.hasEventListener

#### Defined in

node_modules/@types/three/src/core/EventDispatcher.d.ts:53

___

### removeEventListener

▸ **removeEventListener**<`T`\>(`type`, `listener`): `void`

Removes a listener from an event type.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `string` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `T` | The type of the listener that gets removed. |
| `listener` | `EventListener`<`Event`, `T`, [`Copper3dTrackballControls`](Controls_Copper3dTrackballControls.Copper3dTrackballControls.md)\> | The listener function that gets removed. |

#### Returns

`void`

#### Inherited from

EventDispatcher.removeEventListener

#### Defined in

node_modules/@types/three/src/core/EventDispatcher.d.ts:60
