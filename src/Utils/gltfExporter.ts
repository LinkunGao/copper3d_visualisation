import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { optionsGltfExporterType } from "../types/types";

export default class ExportGltf {
  private gltfExporter: GLTFExporter = new GLTFExporter();
  private options: optionsGltfExporterType = {
    trs: false,
    onlyVisible: true,
    truncateDrawRange: true,
    binary: false,
    maxTextureSize: 40960000000,
    animations: [],
  };
  private link: HTMLAnchorElement;

  constructor(opts: optionsGltfExporterType) {
    Object.assign(this.options, opts);
    this.link = document.createElement("a");
    this.link.style.display = "none";
    document.body.appendChild(this.link);
  }

  export(input: any) {
    const name: string = input.name ? input.name : "export";
    this.gltfExporter.parse(
      input,
      (result) => {
        if (result instanceof ArrayBuffer) {
          this.saveArrayBuffer(result, name + ".glb");
        } else {
          const output = JSON.stringify(result, null, 2);
          this.saveString(output, name + ".gltf");
        }
      },
      function (error) {
        console.log("An error happened during parsing", error);
      },
      this.options
    );
  }

  save(blob: Blob, fileName: string) {
    this.link.href = URL.createObjectURL(blob);
    this.link.download = fileName;
    this.link.click();
  }
  saveString(text: string, fileName: string) {
    this.save(new Blob([text], { type: "text/plain" }), fileName);
  }
  saveArrayBuffer(buffer: ArrayBuffer, fileName: string) {
    this.save(
      new Blob([buffer], { type: "application/octet-stream" }),
      fileName
    );
  }
}
