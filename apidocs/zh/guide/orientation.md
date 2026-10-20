# 患者方位 <Badge type="tip" text="4.1.0" />

`loadNrrd` 返回的每一个体数据都处于**标准体素序**,不管它的文件里存的是什么顺序。正因为如此,
调用方什么都不用做,每个视图出来就是放射显示惯例。

## 标准序

| 体素下标 | 递增方向 |
|---|---|
| `i` | 患者**左**侧 (**L**eft) |
| `j` | **后** (**P**osterior) |
| `k` | **上** (**S**uperior) |

轴向代码采用 DICOM、nibabel 和 SimpleITK 的 **TOWARD(指向)** 约定,所以这个顺序叫 `LPS`。

::: warning 同一个顺序有两个名字
旧版 ITK 和 **ITK-SNAP 把这个完全相同的顺序叫 `RAI`** —— 它们命名的是每个下标**来自**哪一侧,
而不是**指向**哪一侧。如果你在和 ITK-SNAP 对照,那边的 `RAI` 和这里的 `LPS` 是同一回事,不是对不上。
:::

进入标准序的过程是**轴的置换加翻转,绝不重采样**。每个原生轴被指派给与它最接近的解剖轴,方向相反
就翻过来。因此斜角(obliquity)被保留在几何信息里,而不是被"掰正"抹掉 —— 没有任何插值,没有任何
体素值被改动。

## 你能拿到什么

```ts
scene.loadNrrd(url, loadingBar, (volume, meshes, slices) => {
  volume.orientation.transform;    // 文件的体素是怎么被重排的
  volume.orientation.nativeDims;   // 文件自己的 dims，重排之前
  volume.orientation.geometry;     // LPS 下的标准网格，含斜角
});
```

`volume.orientation.geometry` **不会被掰正**,这一点和 `volume.matrix` 不同。需要真实患者空间
坐标时用它。

```ts
interface VolumeOrientation {
  transform: OrientationTransform;
  nativeDims: [number, number, number];
  geometry: VolumeGeometry;
}

interface OrientationTransform {
  /** perm[c]：原生的哪个轴变成了轴 c */
  perm: [number, number, number];
  /** flip[c]：下标 c 与该原生轴反向 */
  flip: [boolean, boolean, boolean];
  /** 轴 c 与其解剖轴之间的夹角，单位为度 */
  obliquityDeg: [number, number, number];
}

interface VolumeGeometry {
  dims: [number, number, number];
  /** directions[a] 是沿体素轴 a 走一步，单位为 LPS 毫米；其模长即 spacing */
  directions: [Vec3, Vec3, Vec3];
  /** 体素 (0, 0, 0) 中心在 LPS 下的位置 */
  origin: [number, number, number];
}
```

## 无法确定方位的体数据会被拒绝

**绝不猜测**。加载会通过 `opts.onError` 以一个 `OrientationError` 失败,并且什么都不会显示:

```ts
import { OrientationError } from "copper3d";

scene.loadNrrd(url, loadingBar, onLoaded, {
  openGui: false,
  onError: (err) => {
    if (err instanceof OrientationError) {
      showFailure(`这个文件无法确定方位：${err.detail}`);   // err.code 是稳定的
    } else {
      showFailure(err);                                    // 网络、解析、abort
    }
  },
});
```

`OrientationError` 能完整穿过 worker 边界,所以它到达时仍是引擎自己的错误类型,而不是一个普通
`Error` —— 你正是靠这一点把"方位被拒绝"和"下载失败"区分开。

| `err.code` | 含义 |
|---|---|
| `no_space` | header 里没有 `space` 字段 |
| `unknown_space` / `non_anatomical_space` | `space` 指的不是解剖空间(`3d-right-handed` 等) |
| `time_space` | 含时间轴的空间(`rast`、`last`、`lpst`、`*-time`) |
| `scanner_space` | 相对扫描仪而非相对患者 |
| `no_directions` / `no_origin` / `not_3d` | 缺少必需的几何字段,或不是三维体数据 |
| `degenerate` | 方向向量张不满三维 |
| `ambiguous_oblique` | 某个体素轴距每一个解剖轴都约 45°,没有"最接近"的那一个 |

## 视图的方位字母

`viewLabels` 给出该放在视图各边的字母,遵循 3D Slicer 的规则 —— 与解剖轴夹角超过 1° 的轴也会
带上那个轴的字母:

```ts
import { viewLabels } from "copper3d";

const labels = viewLabels("z", volume.orientation.geometry);
// 横断面得到 { left: "R", right: "L", top: "A", bottom: "P" }
```

它假定的布局,和 `SliceRenderPipeline.flipDisplayImageByAxis` 实际绘制的布局是同一个,两者是
刻意保持同步的 —— 见[翻转机制](./segmentation-module#_6-翻转-flip-机制)。

| 视图 | 屏幕向右 | 屏幕向下 |
|---|---|---|
| 横断面 (`z`) | `+i`(患者左侧) | `+j`(后) |
| 冠状面 (`y`) | `+i` | `−k`(上方在顶部) |
| 矢状面 (`x`) | `+j`(前侧在左边) | `−k` |

## 自己处理 header

这个模块是**纯函数**的 —— 不依赖 DOM,也不依赖 three —— 所以它在 NRRD worker 里和主线程上都能跑。

| 函数 | 作用 |
|---|---|
| `readNrrdOrientationFields(headerText)` | 从 NRRD header 文本里取出 `space`、`sizes`、`space directions`、`space origin` |
| `geometryFromNrrd(fields)` | 把这些字段变成 LPS 下的 `VolumeGeometry`。会抛 `OrientationError` |
| `canonicalTransform(geometry)` | 进入标准序所需的变换 |
| `reorientedGeometry(geometry, transform)` | 同一个网格在新顺序下的描述;原点移动到新的第一个体素 |
| `reorientVoxels(data, dims, transform)` | 把置换和翻转应用到一个类型化数组上 |
| `viewLabels(axis, geometry)` | 各屏幕边上的字母 |

```ts
import {
  readNrrdOrientationFields, geometryFromNrrd,
  canonicalTransform, reorientVoxels, reorientedGeometry,
} from "copper3d";

const fields   = readNrrdOrientationFields(headerText);
const geometry = geometryFromNrrd(fields);          // 无法确定方位时抛 OrientationError
const t        = canonicalTransform(geometry);
const voxels   = reorientVoxels(raw, geometry.dims, t);
const grid     = reorientedGeometry(geometry, t);
```

在 Node 里(转换脚本、服务端、测试),推荐从 `copper3d/orientation` 导入。它只包含上面这些函数,
不带 three、不带 WebGL、也不带库的其余部分,ESM 和 CommonJS 都可以用。

```ts
import { canonicalTransform, geometryFromNrrd } from "copper3d/orientation";
```

::: tip 外部 mask 必须用同样的方式重排
你从别处拿来的 mask 处在**它自己**文件的顺序里。交给 `setMasksFromNIfTI` 之前,请先用同一对
`canonicalTransform` / `reorientVoxels` 处理一遍,否则它会落在正确的网格上、但顺序是错的。
`registerNiftiMaskGrid` 拦得住**网格**不匹配,拦不住**顺序**不匹配。
:::
