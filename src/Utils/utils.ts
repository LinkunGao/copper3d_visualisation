export function fullScreenListenner(
  container: HTMLDivElement | HTMLCanvasElement
) {
  const fullscreenElement =
    document.fullscreenElement || (document as any).webkitFullscreenElement;
  if (!fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if ((container as any).webkitRequestFullscreen) {
      (container as any).webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  }
}

export function isIOS() {
  return (
    [
      "iPad Simulator",
      "iPhone Simulator",
      "iPod Simulator",
      "iPad",
      "iPhone",
      "iPod",
    ].includes(navigator.platform) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

export function traverseMaterials(
  object: THREE.Group,
  callback: (material: any) => void
) {
  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    if (Array.isArray((node as THREE.Mesh).material)) {
      callback((node as THREE.Mesh).material);
    } else {
      [(node as THREE.Mesh).material].forEach(callback);
    }
  });
}

export function loading() {
  let loadingContainer = document.createElement("div");
  const loadingDiv = document.createElement("div");
  let progress = document.createElement("div");
  loadingContainer.style.position = "relative";
  // loadingContainer.style.top = "50%";
  // loadingContainer.style.left = "50%";
  loadingContainer.style.display = "none";
  progress.style.color = "#000";
  loadingContainer.style.zIndex = "1000";
  loadingContainer.className = "copper3D_flex-center";
  loadingDiv.className = "copper3D_three-balls-bounce";

  loadingDiv.innerHTML = `<div class='copper3D_circle'></div><div class='copper3D_circle'></div><div class='copper3D_circle'></div><div class='copper3D_shadow'></div><div class='copper3D_shadow'></div><div class='copper3D_shadow'></div>`;

  loadingContainer.appendChild(loadingDiv);
  loadingContainer.appendChild(progress);

  return { loadingContainer, progress };
}
