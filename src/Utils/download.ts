// 1. npm i file-saver
// 2. npm i --save-dev @types/file-saver

var FileSaver = require("file-saver");

export function saveFileAsJson(blob: Blob, name: string) {
  FileSaver.saveAs(blob, name);
}
