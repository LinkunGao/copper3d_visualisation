import * as Saver from "file-saver";

// 1. npm i file-saver
// 2. npm i --save-dev @types/file-saver

// var FileSaver = require("file-saver");

export function saveFileAsJson(blob: Blob, name: string) {
  if (!!Saver && !!Saver.default) {
    (Saver as any).default.saveAs(blob, name);
  } else if (!!Saver) {
    Saver.saveAs(blob, name);
  } else {
    var FileSaver = require("file-saver");
    FileSaver.saveAs(blob, name);
  }
}

// var FileSaver = require("file-saver");

// export function saveFileAsJson(blob: Blob, name: string) {
//   FileSaver.saveAs(blob, name);
// }
