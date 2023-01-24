import { saveAs } from "file-saver";

// 1. npm i file-saver
// 2. npm i --save-dev @types/file-saver

export function saveFileAsJson(blob: Blob, name: string) {
  saveAs(blob, name);
}
