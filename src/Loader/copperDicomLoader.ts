import * as THREE from "three";
import getVOILUT from "../Utils/getVOILUT";
import dicomParser from "dicom-parser";
import { copperVolumeType } from "../types/types";

const loader = new THREE.FileLoader().setResponseType("arraybuffer");

export function copperDicomLoader(
  url: string,
  callback?: (copperVolume: copperVolumeType) => void
) {
  loader.load(url, (arrayBuffer) => {
    var dicomFileAsBuffer = new Uint8Array(arrayBuffer as ArrayBuffer);
    const dataSet = dicomParser.parseDicom(dicomFileAsBuffer);
    let tags: any = null;
    let w: number;
    let h: number;
    let invert: boolean;
    let windowCenter: number;
    let windowWidth: number;

    try {
      tags = dicomParser.explicitDataSetToJS(dataSet);
      w = parseInt(tags["x00280011"]); //width
      h = parseInt(tags["x00280010"]); //height
      invert = tags["x00280004"] === "MONOCHROME1" ? true : false; //is invert?
      windowCenter = parseInt(tags["x00281050"]); //window center
      windowWidth = parseInt(tags["x00281051"]); //window width
    } catch {
      w = convertImplicitElement(
        dataSet.elements.x00280011,
        dicomFileAsBuffer
      )[0];
      h = convertImplicitElement(
        dataSet.elements.x00280010,
        dicomFileAsBuffer
      )[0];
      invert =
        convertImplicitElement(
          dataSet.elements.x00280004,
          dicomFileAsBuffer
        )[0] === 20301
          ? false
          : true;

      windowCenter = 226;
      windowWidth = 537;
    }
    if (windowCenter == 0 || windowWidth == 0) {
      windowCenter = 226;
      windowWidth = 537;
    }

    let pixelData = dataSet.elements.x7fe00010;
    let pixelDataBuffer = dicomParser.sharedCopy(
      dicomFileAsBuffer,
      pixelData.dataOffset,
      pixelData.length
    );
    let uint16 = new Uint16Array(
      pixelDataBuffer.buffer,
      pixelDataBuffer.byteOffset,
      pixelDataBuffer.byteLength / Uint16Array.BYTES_PER_ELEMENT
    );
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
    };
    callback && callback(copperVolume);
  });
}

function convertImplicitElement(
  elementData: dicomParser.Element,
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
