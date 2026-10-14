/**
 * three's `RASDimensions` for a grid: per axis, `(n − 1)·s + 1`.
 *
 * three places the plane for slice index `k·s` at `k·s − (RASDimensions − 1)/2`, and every
 * texture spans `n·s` centred on 0, drawing voxel k's centre at `k·s − (n − 1)·s/2`. This value
 * makes the two the same point. It also makes `RSAMaxIndex = RASDimensions − 1` exactly the last
 * voxel's index `(n − 1)·s`, so a slider stepping `voxel × spacing` reaches it. Not an integer.
 */
export function rasDimensions(dims: ArrayLike<number>, spacing: ArrayLike<number>): [number, number, number] {
  return [0, 1, 2].map((a) => (dims[a] - 1) * spacing[a] + 1) as [number, number, number];
}
