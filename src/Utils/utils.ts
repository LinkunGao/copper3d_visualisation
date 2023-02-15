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
  progress.className = "copper3D_loading_progress";

  loadingDiv.innerHTML = `<div class='copper3D_circle'></div><div class='copper3D_circle'></div><div class='copper3D_circle'></div><div class='copper3D_shadow'></div><div class='copper3D_shadow'></div><div class='copper3D_shadow'></div>`;

  loadingContainer.appendChild(loadingDiv);
  loadingContainer.appendChild(progress);

  return { loadingContainer, progress };
}

export function switchEraserSize(size: number) {
  let url = "";
  if (size <= 3) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_3.png) 3 3, crosshair`;
  } else if (3 < size && size <= 8) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_8.png) 8 8, crosshair`;
  } else if (8 < size && size <= 13) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_13.png) 13 13, crosshair`;
  } else if (13 < size && size <= 18) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_18.png) 18 18, crosshair`;
  } else if (18 < size && size <= 23) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_23.png) 23 23, crosshair`;
  } else if (23 < size && size <= 28) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_28.png) 28 28, crosshair`;
  } else if (28 < size && size <= 33) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_33.png) 33 33, crosshair`;
  } else if (33 < size && size <= 38) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_38.png) 38 38, crosshair`;
  } else if (38 < size && size <= 43) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_43.png) 43 43, crosshair`;
  } else if (43 < size && size <= 48) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_48.png) 48 48, crosshair`;
  } else if (48 < size && size <= 53) {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_52.png) 52 52, crosshair`;
  } else {
    url = `url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_52.png) 52 52, crosshair`;
  }
  return url;
}
