/**
 * Type declarations for nifti-reader-js
 *
 * NOTE: this is an ambient `declare module`, so it REPLACES the typings shipped in
 * node_modules/nifti-reader-js/dist entirely — anything the package really exports but
 * is missing here simply does not exist as far as TypeScript is concerned. Keep it in
 * step with the installed version when adding new API surface.
 *
 * @see https://github.com/rii-mango/NIFTI-Reader-JS
 */

declare module 'nifti-reader-js' {
    /**
     * NIfTI header information
     */
    export interface NIFTI1Header {
        /** Header size (348 for NIFTI-1) */
        sizeof_hdr: number;
        /** Data array dimensions */
        dims: number[];
        /** Data type */
        datatypeCode: number;
        /** Number of bits per voxel */
        numBitsPerVoxel: number;
        /** Voxel dimensions (spacing) */
        pixDims: number[];
        /** Data offset */
        vox_offset: number;
        /** Slope for intensity scaling */
        scl_slope: number;
        /** Intercept for intensity scaling */
        scl_inter: number;
        /** X-form code for qform */
        qform_code: number;
        /** X-form code for sform */
        sform_code: number;
        /** Quaternion parameters */
        quatern_b: number;
        quatern_c: number;
        quatern_d: number;
        /** Quaternion offset */
        qoffset_x: number;
        qoffset_y: number;
        qoffset_z: number;
        /** Affine matrix */
        affine: number[][];
        /** Description */
        description: string;
        /** Data type string */
        getDatatypeCodeString(code: number): string;
    }

    export interface NIFTI2Header extends NIFTI1Header {
        /** Header size (540 for NIFTI-2) */
        sizeof_hdr: number;
    }

    /**
     * Check if data is compressed (gzip)
     */
    export function isCompressed(data: ArrayBuffer): boolean;

    /**
     * Decompress gzip data
     */
    export function decompress(data: ArrayBuffer): ArrayBuffer;

    /**
     * Check if data is a valid NIFTI file
     */
    export function isNIFTI(data: ArrayBuffer): boolean;

    /**
     * Check if data is NIFTI-1 format
     */
    export function isNIFTI1(data: ArrayBuffer): boolean;

    /**
     * Check if data is NIFTI-2 format
     */
    export function isNIFTI2(data: ArrayBuffer): boolean;

    /**
     * Read NIFTI header from data
     */
    export function readHeader(data: ArrayBuffer): NIFTI1Header | NIFTI2Header | null;

    /**
     * Read NIFTI image data
     */
    export function readImage(header: NIFTI1Header | NIFTI2Header, data: ArrayBuffer): ArrayBuffer | null;

    /**
     * Read NIFTI extension data
     */
    export function readExtension(header: NIFTI1Header | NIFTI2Header, data: ArrayBuffer): ArrayBuffer | null;

    /**
     * Check if extension exists
     */
    export function hasExtension(header: NIFTI1Header | NIFTI2Header): boolean;

    /**
     * NIFTI-1 header class. Only the static pseudo-constants are declared: they are
     * how callers name the datatype / transform / unit codes (`NIFTI1.TYPE_INT16`
     * rather than a bare `4`), and the instance shape is already covered by the
     * NIFTI1Header interface above.
     *
     * Values mirror node_modules/nifti-reader-js/dist/nifti1.d.ts and are fixed by the
     * NIfTI-1 specification, so they do not drift between package versions.
     */
    export class NIFTI1 {
        /*** Data type codes (header.datatypeCode) ***/
        static readonly TYPE_NONE: 0;
        static readonly TYPE_BINARY: 1;
        static readonly TYPE_UINT8: 2;
        static readonly TYPE_INT16: 4;
        static readonly TYPE_INT32: 8;
        static readonly TYPE_FLOAT32: 16;
        static readonly TYPE_COMPLEX64: 32;
        static readonly TYPE_FLOAT64: 64;
        static readonly TYPE_RGB24: 128;
        static readonly TYPE_INT8: 256;
        static readonly TYPE_UINT16: 512;
        static readonly TYPE_UINT32: 768;
        static readonly TYPE_INT64: 1024;
        static readonly TYPE_UINT64: 1280;
        static readonly TYPE_FLOAT128: 1536;
        static readonly TYPE_COMPLEX128: 1792;
        static readonly TYPE_COMPLEX256: 2048;

        /*** Coordinate transform codes (qform_code / sform_code) ***/
        static readonly XFORM_UNKNOWN: 0;
        static readonly XFORM_SCANNER_ANAT: 1;
        static readonly XFORM_ALIGNED_ANAT: 2;
        static readonly XFORM_TALAIRACH: 3;
        static readonly XFORM_MNI_152: 4;

        /*** Unit codes (xyzt_units) ***/
        static readonly SPATIAL_UNITS_MASK: 7;
        static readonly TEMPORAL_UNITS_MASK: 56;
        static readonly UNITS_UNKNOWN: 0;
        static readonly UNITS_METER: 1;
        static readonly UNITS_MM: 2;
        static readonly UNITS_MICRON: 3;
        static readonly UNITS_SEC: 8;
        static readonly UNITS_MSEC: 16;
        static readonly UNITS_USEC: 24;
        static readonly UNITS_HZ: 32;
        static readonly UNITS_PPM: 40;
        static readonly UNITS_RADS: 48;

        /*** Header layout ***/
        static readonly MAGIC_COOKIE: 348;
        static readonly STANDARD_HEADER_SIZE: 348;
        static readonly MAGIC_NUMBER_LOCATION: 344;
        static readonly MAGIC_NUMBER: number[];
        static readonly MAGIC_NUMBER2: number[];
        static readonly EXTENSION_HEADER_SIZE: 8;
    }

    /**
     * NIFTI-2 header class. Inherits NIFTI-1's datatype / transform / unit codes,
     * which are identical between the two revisions.
     *
     * Its own MAGIC_COOKIE / STANDARD_HEADER_SIZE (540, vs NIFTI-1's 348) are
     * deliberately NOT redeclared: narrowing an inherited static to a different
     * literal type is a static-side conflict, and nothing in this codebase reads
     * them. Add them by restructuring (a shared base + two siblings) if that changes.
     */
    export class NIFTI2 extends NIFTI1 {
    }
}
