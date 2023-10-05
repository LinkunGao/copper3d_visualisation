[copper3d](../README.md) / [Modules](../modules.md) / Utils/utils

# Module: Utils/utils

## Table of contents

### Functions

- [H3](Utils_utils.md#h3)
- [L3](Utils_utils.md#l3)
- [calcDistance](Utils_utils.md#calcdistance)
- [fullScreenListenner](Utils_utils.md#fullscreenlistenner)
- [getWightsH3H3H3](Utils_utils.md#getwightsh3h3h3)
- [getWightsL3L3L3](Utils_utils.md#getwightsl3l3l3)
- [isIOS](Utils_utils.md#isios)
- [loading](Utils_utils.md#loading)
- [perturbRandom](Utils_utils.md#perturbrandom)
- [switchEraserSize](Utils_utils.md#switcherasersize)
- [switchPencilIcon](Utils_utils.md#switchpencilicon)
- [throttle](Utils_utils.md#throttle)
- [traverseMaterials](Utils_utils.md#traversematerials)

## Functions

### H3

▸ **H3**(`x`): `number`[]

Cubic-Hermite basis function.

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |

#### Returns

`number`[]

#### Defined in

[src/Utils/utils.ts:203](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L203)

___

### L3

▸ **L3**(`x`): `number`[]

Cubic-Lagrange basis function

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |

#### Returns

`number`[]

#### Defined in

[src/Utils/utils.ts:185](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L185)

___

### calcDistance

▸ **calcDistance**(`x0`, `x1`): `number`

Euclidean distance n dimensions

#### Parameters

| Name | Type |
| :------ | :------ |
| `x0` | `number`[] |
| `x1` | `number`[] |

#### Returns

`number`

#### Defined in

[src/Utils/utils.ts:275](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L275)

___

### fullScreenListenner

▸ **fullScreenListenner**(`container`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `container` | `HTMLDivElement` \| `HTMLCanvasElement` |

#### Returns

`void`

#### Defined in

[src/Utils/utils.ts:1](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L1)

___

### getWightsH3H3H3

▸ **getWightsH3H3H3**(`Xi`): `number`[][]

#### Parameters

| Name | Type |
| :------ | :------ |
| `Xi` | `number`[][] |

#### Returns

`number`[][]

#### Defined in

[src/Utils/utils.ts:235](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L235)

___

### getWightsL3L3L3

▸ **getWightsL3L3L3**(`Xi`): `number`[]

To calculate the weights for each element of Xi using the cubic Lagrange basis functions.

#### Parameters

| Name | Type |
| :------ | :------ |
| `Xi` | `number`[] |

#### Returns

`number`[]

#### Defined in

[src/Utils/utils.ts:219](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L219)

___

### isIOS

▸ **isIOS**(): `boolean`

#### Returns

`boolean`

#### Defined in

[src/Utils/utils.ts:21](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L21)

___

### loading

▸ **loading**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `loadingContainer` | `HTMLDivElement` |
| `progress` | `HTMLDivElement` |

#### Defined in

[src/Utils/utils.ts:49](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L49)

___

### perturbRandom

▸ **perturbRandom**(`x`, `dx`): `number`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number`[] |
| `dx` | `number` |

#### Returns

`number`[]

#### Defined in

[src/Utils/utils.ts:284](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L284)

___

### switchEraserSize

▸ **switchEraserSize**(`size`, `urls?`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `size` | `number` |
| `urls?` | `string`[] |

#### Returns

`string`

#### Defined in

[src/Utils/utils.ts:110](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L110)

___

### switchPencilIcon

▸ **switchPencilIcon**(`icon`, `urls?`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `icon` | `string` |
| `urls?` | `string`[] |

#### Returns

`string`

#### Defined in

[src/Utils/utils.ts:71](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L71)

___

### throttle

▸ **throttle**(`callback`, `wait`): (`event`: `MouseEvent`) => `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `callback` | (`event`: `MouseEvent`) => `void` |
| `wait` | `number` |

#### Returns

`fn`

▸ (`event`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `event` | `MouseEvent` |

##### Returns

`void`

#### Defined in

[src/Utils/utils.ts:169](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L169)

___

### traverseMaterials

▸ **traverseMaterials**(`object`, `callback`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `object` | `Group` |
| `callback` | (`material`: `any`) => `void` |

#### Returns

`void`

#### Defined in

[src/Utils/utils.ts:35](https://github.com/LinkunGao/copper3d_visualisation/blob/9f197bb/src/Utils/utils.ts#L35)
