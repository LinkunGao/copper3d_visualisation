import * as THREE from "three";
import getVOILUT from "../Utils/getVOILUT";
import dicomParser from "dicom-parser";
import { copperVolumeType, planeCorners } from "../types/types";
// import { TAG_DICT } from "../lib/dicom_pharser_dictionary";

const loader = new THREE.FileLoader().setResponseType("arraybuffer");

export function copperDicomLoader(
  url: string,
  callback?: (copperVolume: copperVolumeType) => void
) {
  loader.load(url, (arrayBuffer) => {
    var dicomFileAsBuffer = new Uint8Array(arrayBuffer as ArrayBuffer);

    const dataSet = dicomParser.parseDicom(dicomFileAsBuffer);

    // const dataSet = dicomParser.parseDicom(dicomFileAsBuffer, {
    //   vrCallback(tag) {
    //     const formatted = `(${tag.substring(1, 5)},${tag.substring(5, 9)})`;

    //     return !!TAG_DICT[formatted] ? TAG_DICT[formatted].vr : undefined;
    //   },
    // });
    let tags: any = null;
    let w: number;
    let h: number;
    let invert: boolean;
    let windowCenter: number;
    let windowWidth: number;
    let order: number = 0;

    try {
      tags = dicomParser.explicitDataSetToJS(dataSet);

      if (dataSet.elements.x00181060) {
        order = parseInt(tags["x00181060"]);
      } else if (dataSet.elements.x00201041) {
        order = parseInt(tags["x00201041"]);
      }
      w = parseInt(tags["x00280011"]); //width
      h = parseInt(tags["x00280010"]); //height
      invert = tags["x00280004"] === "MONOCHROME1" ? true : false; //is invert?
      windowCenter = parseInt(tags["x00281050"]); //window center
      windowWidth = parseInt(tags["x00281051"]); //window width
    } catch {
      w = dataSet.uint16("x00280011") as number;
      h = dataSet.uint16("x00280010") as number;
      invert = dataSet.string("x00280004") === "MONOCHROME1" ? true : false;
      windowCenter = parseInt(dataSet.string("x00281050") as string);
      windowWidth = parseInt(dataSet.string("x00281051") as string);
      if (dataSet.elements.x00181060) {
        order = parseInt(dataSet.string("x00181060") as string);
      } else if (dataSet.elements.x00201041) {
        order = parseInt(dataSet.string("x00201041") as string);
      }
    }

    if (windowCenter == 0 || windowWidth == 0) {
      windowCenter = 226;
      windowWidth = 537;
    }

    // Spatial geometry tags (DS VR, backslash-delimited) used to place the image plane
    // at its true world pose, plus InstanceNumber as an ordering fallback.
    const ipp = parseDS(dataSet.string("x00200032")); // ImagePositionPatient
    const iop = parseDS(dataSet.string("x00200037")); // ImageOrientationPatient
    const spacing = parseDS(dataSet.string("x00280030")); // PixelSpacing
    // FrameOfReferenceUID: two series share a world coordinate system only if this matches.
    // It is the only field that lets another modality prove it is already registered to this one.
    const frameOfReferenceUID = dataSet.string("x00200052") ?? undefined;
    let instanceNumber: number | undefined = parseInt(
      dataSet.string("x00200013") as string
    );
    if (Number.isNaN(instanceNumber)) instanceNumber = undefined;
    const corners =
      ipp && iop && spacing
        ? computeImagePlaneCorners(ipp, iop, spacing, w, h)
        : undefined;

    let pixelData = dataSet.elements.x7fe00010;
    let uint16 = convertImplicitElement(pixelData, dicomFileAsBuffer);
    let voiLUT;
    let lut = getLut(uint16, windowWidth, windowCenter, invert, voiLUT);
    let uint8 = new Uint8ClampedArray(uint16.length);
    for (let i = 0, len = uint16.length; i < len; i++) {
      uint8[i] = lut.lutArray[uint16[i]];
    }
    const copperVolume: copperVolumeType = {
      tags,
      width: w,
      height: h,
      windowCenter,
      windowWidth,
      invert,
      uint16,
      uint8,
      order,
      instanceNumber,
      imagePositionPatient: ipp,
      imageOrientationPatient: iop,
      pixelSpacing: spacing,
      frameOfReferenceUID,
      corners,
    };
    callback && callback(copperVolume);
  });
}

// Parse a DICOM DS/IS multi-value string ("a\\b\\c") into a number[].
function parseDS(s?: string): number[] | undefined {
  if (!s) return undefined;
  const a = s.split("\\").map((v) => parseFloat(v));
  return a.length && !a.some((n) => Number.isNaN(n)) ? a : undefined;
}

/**
 * Compute the 4 world-space corners of a DICOM image plane from its geometry tags.
 * IPP is the CENTER of pixel (0,0), so corners sit half a pixel out. PixelSpacing is
 * [rowSpacing, colSpacing]; IOP's first vector is the +column-index direction.
 */
export function computeImagePlaneCorners(
  ipp: number[],
  iop: number[],
  spacing: number[],
  cols: number,
  rows: number
): planeCorners {
  const row = new THREE.Vector3(iop[0], iop[1], iop[2]); // +column-index dir
  const col = new THREE.Vector3(iop[3], iop[4], iop[5]); // +row-index dir
  const sc = spacing[1]; // column spacing (along row)
  const sr = spacing[0]; // row spacing (along col)
  const O = new THREE.Vector3(ipp[0], ipp[1], ipp[2]); // center of pixel (0,0)
  const p = (a: number, b: number) =>
    O.clone()
      .addScaledVector(row, a * sc)
      .addScaledVector(col, b * sr)
      .toArray() as [number, number, number];
  return {
    tl: p(-0.5, -0.5),
    tr: p(cols - 0.5, -0.5),
    bl: p(-0.5, rows - 0.5),
    br: p(cols - 0.5, rows - 0.5),
  };
}

function convertImplicitElement(
  elementData: any,
  dicomFileAsBuffer: Uint8Array
) {
  let w1Buffer = dicomParser.sharedCopy(
    dicomFileAsBuffer,
    elementData.dataOffset,
    elementData.length
  );
  let unit16 = new Uint16Array(
    w1Buffer.buffer,
    w1Buffer.byteOffset,
    w1Buffer.byteLength / Uint16Array.BYTES_PER_ELEMENT
  );
  return unit16;
}

export function getLut(
  data: Uint16Array,
  windowWidth: number,
  windowCenter: number,
  invert: boolean,
  voiLUT: any
) {
  let minPixelValue = 0;
  let maxPixelValue = 0;
  for (let i = 0, len = data.length; i < len; i++) {
    if (minPixelValue > data[i]) {
      minPixelValue = data[i];
    }
    if (maxPixelValue < data[i]) {
      maxPixelValue = data[i];
    }
  }
  let offset = Math.min(minPixelValue, 0);
  let lutArray = new Uint8ClampedArray(maxPixelValue - offset + 1);
  const vlutfn = getVOILUT(windowWidth, windowCenter, voiLUT, true);
  if (invert === true) {
    for (
      let storedValue = minPixelValue;
      storedValue <= maxPixelValue;
      storedValue++
    ) {
      lutArray[storedValue + -offset] = 255 - vlutfn(storedValue);
    }
  } else {
    for (
      let storedValue = minPixelValue;
      storedValue <= maxPixelValue;
      storedValue++
    ) {
      lutArray[storedValue + -offset] = vlutfn(storedValue);
    }
  }
  return {
    minPixelValue: minPixelValue,
    maxPixelValue: maxPixelValue,
    lutArray: lutArray,
  };
}
