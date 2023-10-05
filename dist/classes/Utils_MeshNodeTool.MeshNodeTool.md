[copper3d](../README.md) / [Modules](../modules.md) / [Utils/MeshNodeTool](../modules/Utils_MeshNodeTool.md) / MeshNodeTool

# Class: MeshNodeTool

[Utils/MeshNodeTool](../modules/Utils_MeshNodeTool.md).MeshNodeTool

## Table of contents

### Constructors

- [constructor](Utils_MeshNodeTool.MeshNodeTool.md#constructor)

### Properties

- [elements](Utils_MeshNodeTool.MeshNodeTool.md#elements)
- [nodes](Utils_MeshNodeTool.MeshNodeTool.md#nodes)

### Methods

- [addElement](Utils_MeshNodeTool.MeshNodeTool.md#addelement)
- [addNode](Utils_MeshNodeTool.MeshNodeTool.md#addnode)
- [evaluate](Utils_MeshNodeTool.MeshNodeTool.md#evaluate)
- [find](Utils_MeshNodeTool.MeshNodeTool.md#find)
- [getNodeMaterialPoints](Utils_MeshNodeTool.MeshNodeTool.md#getnodematerialpoints)
- [loadMesh](Utils_MeshNodeTool.MeshNodeTool.md#loadmesh)
- [search](Utils_MeshNodeTool.MeshNodeTool.md#search)

## Constructors

### constructor

• **new MeshNodeTool**()

## Properties

### elements

• **elements**: `Object` = `{}`

#### Index signature

▪ [key: `string`]: [`Element`](Utils_MeshNodeTool.Element.md)

#### Defined in

[src/Utils/MeshNodeTool.ts:28](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L28)

___

### nodes

• **nodes**: `Object` = `{}`

#### Index signature

▪ [key: `string`]: [`Node`](Utils_MeshNodeTool.Node.md)

#### Defined in

[src/Utils/MeshNodeTool.ts:27](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L27)

## Methods

### addElement

▸ **addElement**(`id`, `basis`, `nodeIds`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `string` |
| `basis` | `string`[] |
| `nodeIds` | `string`[] |

#### Returns

`void`

#### Defined in

[src/Utils/MeshNodeTool.ts:33](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L33)

___

### addNode

▸ **addNode**(`id`, `p`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `string` |
| `p` | `number`[] |

#### Returns

`void`

#### Defined in

[src/Utils/MeshNodeTool.ts:30](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L30)

___

### evaluate

▸ **evaluate**(`elementId`, `xi`): `number`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `elementId` | `string` |
| `xi` | `number`[] |

#### Returns

`number`[]

#### Defined in

[src/Utils/MeshNodeTool.ts:56](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L56)

___

### find

▸ **find**(`point`, `startingNodeId`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `point` | `Vector3` |
| `startingNodeId` | `string` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `elementId` | `string` |
| `xi` | `number`[] |

#### Defined in

[src/Utils/MeshNodeTool.ts:61](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L61)

___

### getNodeMaterialPoints

▸ **getNodeMaterialPoints**(`nodeId`): { `[key: string]`: `any`; `elementId`: `string` ; `xi`: `number`[]  }[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `nodeId` | `string` |

#### Returns

{ `[key: string]`: `any`; `elementId`: `string` ; `xi`: `number`[]  }[]

#### Defined in

[src/Utils/MeshNodeTool.ts:215](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L215)

___

### loadMesh

▸ **loadMesh**(`json`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `json` | `IMeshNodes` |

#### Returns

`void`

#### Defined in

[src/Utils/MeshNodeTool.ts:46](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L46)

___

### search

▸ **search**(`point`, `startingNodeId`, `tol`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `point` | `Vector3` |
| `startingNodeId` | `string` |
| `tol` | `number` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `elementId` | `string` |
| `xi` | `number`[] |

#### Defined in

[src/Utils/MeshNodeTool.ts:118](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/MeshNodeTool.ts#L118)
