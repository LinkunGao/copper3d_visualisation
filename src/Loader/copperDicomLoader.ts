import * as THREE from "three";
import getVOILUT from "../Utils/getVOILUT";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.min";
import * as dicomParser from "dicom-parser";

export function copperDicomLoader(
  url: string,
  callback?: (tags: any, w: number, h: number, uint8: Uint8ClampedArray) => void
) {
  const loader = new THREE.FileLoader().setResponseType("arraybuffer");
  loader.load(url, (arrayBuffer) => {
    var dicomFileAsBuffer = new Uint8Array(arrayBuffer as ArrayBuffer);
    const dataSet = dicomParser.parseDicom(dicomFileAsBuffer);
    let tags: any = dicomParser.explicitDataSetToJS(dataSet);
    let w = parseInt(tags["x00280011"]); //width
    let h = parseInt(tags["x00280010"]); //height
    let invert = tags["x00280004"] === "MONOCHROME1" ? true : false; //is invert?
    let windowCenter = parseInt(tags["x00281050"]); //window center
    let windowWidth = parseInt(tags["x00281051"]); //window width

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
    callback && callback(tags, w, h, uint8);
  });
}

function getLut(
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
