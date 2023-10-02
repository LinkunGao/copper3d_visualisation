// Not use this function now!!!
import { saveFileAsJson } from "../../download";
import { ICommXYZ, INrrdStates, IProtected } from "./coreType";
import {
  restructData,
  convertReformatDataToBlob,
} from "../../workers/reformatSaveDataWorker";
function verifyCanvasIsEmpty(canvas: any, protectedData: any) {
  protectedData.canvases.emptyCanvas.width = canvas.width;
  protectedData.canvases.emptyCanvas.height = canvas.height;

  const validation =
    canvas.toDataURL() === protectedData.canvases.emptyCanvas.toDataURL();

  return validation;
}

function exportData(nrrd_states: INrrdStates, protectedData: IProtected) {
  let exportDataFormat: ICommXYZ = { x: [], y: [], z: [] };

  window.alert("Export masks, starting!!!");
  const masks = restructData(
    protectedData.maskData.paintImages.z,
    nrrd_states.nrrd_z_pixel,
    nrrd_states.nrrd_x_pixel,
    nrrd_states.nrrd_y_pixel
  );
  const blob = convertReformatDataToBlob(masks);
  if (blob) {
    saveFileAsJson(blob, "copper3D_export data_z.json");
    window.alert("Export masks successfully!!!");
  } else {
    window.alert("Export failed!");
  }
}
