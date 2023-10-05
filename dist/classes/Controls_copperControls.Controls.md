[copper3d](../README.md) / [Modules](../modules.md) / [Controls/copperControls](../modules/Controls_copperControls.md) / Controls

# Class: Controls

[Controls/copperControls](../modules/Controls_copperControls.md).Controls

## Table of contents

### Constructors

- [constructor](Controls_copperControls.Controls.md#constructor)

### Properties

- [currentCamera](Controls_copperControls.Controls.md#currentcamera)
- [directionalLight](Controls_copperControls.Controls.md#directionallight)
- [viewpoint](Controls_copperControls.Controls.md#viewpoint)

### Methods

- [setCameraViewPoint](Controls_copperControls.Controls.md#setcameraviewpoint)
- [updateCameraViewPoint](Controls_copperControls.Controls.md#updatecameraviewpoint)
- [updateDirectionalLight](Controls_copperControls.Controls.md#updatedirectionallight)

## Constructors

### constructor

• **new Controls**(`camera`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `camera` | `PerspectiveCamera` |

#### Defined in

[src/Controls/copperControls.ts:7](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L7)

## Properties

### currentCamera

• `Private` **currentCamera**: `PerspectiveCamera`

#### Defined in

[src/Controls/copperControls.ts:3](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L3)

___

### directionalLight

• `Private` **directionalLight**: ``null`` \| `DirectionalLight` = `null`

#### Defined in

[src/Controls/copperControls.ts:4](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L4)

___

### viewpoint

• `Private` **viewpoint**: [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md)

#### Defined in

[src/Controls/copperControls.ts:5](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L5)

## Methods

### setCameraViewPoint

▸ **setCameraViewPoint**(): `void`

#### Returns

`void`

#### Defined in

[src/Controls/copperControls.ts:12](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L12)

___

### updateCameraViewPoint

▸ **updateCameraViewPoint**(`viewpoint`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `viewpoint` | [`CameraViewPoint`](Controls_copperControls.CameraViewPoint.md) |

#### Returns

`void`

#### Defined in

[src/Controls/copperControls.ts:33](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L33)

___

### updateDirectionalLight

▸ **updateDirectionalLight**(`directionalLight?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `directionalLight?` | `DirectionalLight` |

#### Returns

`void`

#### Defined in

[src/Controls/copperControls.ts:38](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Controls/copperControls.ts#L38)
