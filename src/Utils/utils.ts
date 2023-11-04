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

export function loading(loadingGif?: string) {
  let loadingContainer = document.createElement("div");
  const loadingDiv = document.createElement("div");
  let progress = document.createElement("div");
  if (!!loadingGif) {
    loadingContainer.style.position = "relative";
    loadingContainer.style.display = "none";
    loadingContainer.style.flexDirection = "column";
    loadingContainer.style.justifyContent = "center";
    loadingContainer.style.alignItems = "center";
    loadingDiv.style.width = "100px";
    loadingDiv.style.height = "100px";
    const image = document.createElement("img");
    image.src = loadingGif;
    loadingDiv.appendChild(image);
    image.style.width = "100%";
    image.style.height = "100%";
  } else {
    loadingContainer.style.position = "relative";
    loadingContainer.style.display = "none";
    progress.style.color = "#000";
    loadingContainer.style.zIndex = "1000";
    loadingContainer.className = "copper3D_flex-center";
    loadingDiv.className = "copper3D_three-balls-bounce";
    progress.className = "copper3D_loading_progress";
    loadingDiv.innerHTML = `<div class='copper3D_circle'></div><div class='copper3D_circle'></div><div class='copper3D_circle'></div><div class='copper3D_shadow'></div><div class='copper3D_shadow'></div><div class='copper3D_shadow'></div>`;
  }

  loadingContainer.style.zIndex = "1000";
  loadingContainer.appendChild(loadingDiv);
  loadingContainer.appendChild(progress);

  return { loadingContainer, progress };
}

export function switchPencilIcon(icon: string, urls?: string[]) {
  let url = "";
  if (!!urls && urls.length > 0) {
    switch (icon) {
      case "crosshair":
        url = "crosshair";
        break;
      case "pencil":
        url = `url(${urls[1]}), auto`;
        break;
      case "dot":
        url = `url(${urls[0]})12 12, auto`;
        break;
      default:
        url = `url(${urls[0]})12 12, auto`;
        break;
    }
  } else {
    switch (icon) {
      case "crosshair":
        url = "crosshair";
        break;
      case "pencil":
        url =
          "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/pencil-black.svg), auto";
        break;
      case "dot":
        url =
          "url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/dot.svg) 12 12,auto";
        break;
      default:
        url =
          "url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/dot.svg) 12 12,auto";
        break;
    }
  }
  return url;
}

export function switchEraserSize(size: number, urls?: string[]) {
  let url = "";
  if (!!urls && urls.length > 0) {
    if (size <= 3) {
      url = `url(${urls[0]}) 3 3, crosshair`;
    } else if (3 < size && size <= 8) {
      url = `url(${urls[1]}) 8 8, crosshair`;
    } else if (8 < size && size <= 13) {
      url = `url(${urls[2]}) 13 13, crosshair`;
    } else if (13 < size && size <= 18) {
      url = `url(${urls[3]}) 18 18, crosshair`;
    } else if (18 < size && size <= 23) {
      url = `url(${urls[4]}) 23 23, crosshair`;
    } else if (23 < size && size <= 28) {
      url = `url(${urls[5]}) 28 28, crosshair`;
    } else if (28 < size && size <= 33) {
      url = `url(${urls[6]}) 33 33, crosshair`;
    } else if (33 < size && size <= 38) {
      url = `url(${urls[7]}) 38 38, crosshair`;
    } else if (38 < size && size <= 43) {
      url = `url(${urls[8]}) 43 43, crosshair`;
    } else if (43 < size && size <= 48) {
      url = `url(${urls[9]}) 48 48, crosshair`;
    } else if (48 < size && size <= 53) {
      url = `url(${urls[10]}) 52 52, crosshair`;
    } else {
      url = `url(${urls[11]}) 52 52, crosshair`;
    }
  } else {
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
  }

  return url;
}

export function throttle(callback: (event: MouseEvent) => void, wait: number) {
  let start: number = 0;
  return function (event: MouseEvent) {
    const current: number = Date.now();
    if (current - start > wait) {
      callback.call(null, event);
      start = current;
    }
  };
}

/**
 * Cubic-Lagrange basis function
 * @param x
 * @returns
 */
export function L3(x: number) {
  let L1 = 1 - x;
  let L2 = x;
  let sc = 9 / 2;
  return [
    0.5 * L1 * (3 * L1 - 1) * (3 * L1 - 2),
    sc * L1 * L2 * (3 * L1 - 1),
    sc * L1 * L2 * (3 * L2 - 1),
    0.5 * L2 * (3 * L2 - 1) * (3 * L2 - 2),
  ];
}

/**
 * Cubic-Hermite basis function.
 * @param x
 * @returns
 */

export function H3(x: number) {
  let x2 = x * x;
  return [
    1 - 3 * x2 + 2 * x * x2,
    x * (x - 1) * (x - 1),
    x2 * (3 - 2 * x),
    x2 * (x - 1),
  ];
}

/**
 * To calculate the weights for each element of Xi using the cubic Lagrange basis functions.
 * @param Xi
 * @returns
 */

export function getWightsL3L3L3(Xi: number[]) {
  let W0, W1, W2;
  W0 = L3(Xi[0]);
  W1 = L3(Xi[1]);
  W2 = L3(Xi[2]);
  let w = [];
  for (let k2 in W2) {
    for (let k1 in W1) {
      for (let k0 in W0) {
        w.push(W0[k0] * W1[k1] * W2[k2]);
      }
    }
  }
  return w;
}

export function getWightsH3H3H3(Xi: number[][]) {
  let mixIdx = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 0],
    [3, 0],
    [2, 1],
    [3, 1],
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 3],
    [2, 2],
    [3, 2],
    [2, 3],
    [3, 3],
  ];

  let weights = [];
  let W0, W1;
  for (let idx in Xi) {
    W0 = H3(Xi[idx][0]);
    W1 = H3(Xi[idx][1]);
    let w = [];
    for (let k in mixIdx) {
      w.push(W0[mixIdx[k][0]] * W1[mixIdx[k][1]]);
    }
    weights.push(w);
  }
  return weights;
}

/**
 * Euclidean distance n dimensions
 * @param x0
 * @param x1
 * @returns
 */
export function calcDistance(x0: number[], x1: number[]) {
  let dx2 = 0;
  for (let i = 0; i < x0.length; i++) {
    let dx = x0[i] - x1[i];
    dx2 += dx * dx;
  }
  return Math.sqrt(dx2);
}

export function perturbRandom(x: number[], dx: number) {
  let xp = [];
  for (let i = 0; i < x.length; i++) {
    xp.push(x[i] + 2 * dx * (Math.random() - 0.5));
    if (xp[i] < 0) {
      xp[i] = 0;
    } else if (xp[i] > 1) {
      xp[i] = 1;
    }
  }
  return xp;
}
