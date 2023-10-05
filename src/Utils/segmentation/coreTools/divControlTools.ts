import { IDownloadImageConfig } from "./coreType";

/**
 * A div for show the slice and contrast numbers on
 * the top of container.
 *
 * @returns  div with absolute style
 */
function createShowSliceNumberDiv() {
  const sliceNumberDiv = document.createElement("div");
  sliceNumberDiv.className = "copper3d_sliceNumber";
  sliceNumberDiv.style.position = "absolute";
  sliceNumberDiv.style.zIndex = "100";
  sliceNumberDiv.style.top = "20px";
  sliceNumberDiv.style.left = "100px";

  return sliceNumberDiv;
}

/**
 * set mouse to auto focus on the div
 * @param container the operate container div
 */
function autoFocusDiv(container: HTMLDivElement) {
  container.tabIndex = 10;
  container.addEventListener("mouseover", () => {
    container.focus();
  });
  container.style.outline = "none";
}

/**
 * Enable download single slice as a png/jpg image
 * @param config
 */
function enableDownload(config: IDownloadImageConfig) {
  let downloadCanvas: HTMLCanvasElement | null =
    document.createElement("canvas");
  let downloadImage: HTMLAnchorElement | null = document.createElement("a");
  downloadImage.href = "";
  downloadImage.target = "_blank";
  downloadImage.download = `slice_${config.axis}_#${config.currentIndex}`;
  const downloadCtx = downloadCanvas.getContext(
    "2d"
  ) as CanvasRenderingContext2D;
  downloadCanvas.width = config.originWidth;
  downloadCanvas.height = config.originHeight;

  downloadCtx.drawImage(
    config.drawingCanvas,
    0,
    0,
    config.originWidth,
    config.originHeight
  );
  downloadImage.href = downloadCanvas.toDataURL();
  downloadImage.click();

  //let javascript recycle this element
  downloadCanvas = null;
  downloadImage = null;
}

export { createShowSliceNumberDiv, autoFocusDiv, enableDownload };
