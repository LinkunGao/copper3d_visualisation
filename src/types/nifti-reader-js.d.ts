/**
 * Type declarations for nifti-reader-js
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
}
