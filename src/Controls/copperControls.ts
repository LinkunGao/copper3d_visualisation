import * as THREE from "three";
export class Controls {
  private currentCamera: THREE.PerspectiveCamera;
  private directionalLight: THREE.DirectionalLight | null = null;
  private viewpoint: CameraViewPoint;

  constructor(camera: THREE.PerspectiveCamera) {
    this.currentCamera = camera;
    this.viewpoint = new CameraViewPoint();
  }

  setCameraViewPoint() {
    this.currentCamera.near = this.viewpoint.nearPlane;
    this.currentCamera.far = this.viewpoint.farPlane;
    this.currentCamera.position.set(
      this.viewpoint.eyePosition[0],
      this.viewpoint.eyePosition[1],
      this.viewpoint.eyePosition[2]
    );
    this.currentCamera.lookAt(
      this.viewpoint.targetPosition[0],
      this.viewpoint.targetPosition[1],
      this.viewpoint.targetPosition[2]
    );
    this.currentCamera.up.set(
      this.viewpoint.upVector[0],
      this.viewpoint.upVector[1],
      this.viewpoint.upVector[2]
    );
    this.currentCamera.updateProjectionMatrix();
    this.updateDirectionalLight();
  }
  updateCameraViewPoint(viewpoint: CameraViewPoint) {
    this.viewpoint = viewpoint;
    this.setCameraViewPoint();
  }

  updateDirectionalLight(directionalLight?: THREE.DirectionalLight) {
    if (directionalLight) {
      this.directionalLight = directionalLight;
      this.directionalLight.position.set(
        this.currentCamera.position.x,
        this.currentCamera.position.y,
        this.currentCamera.position.z
      );
    }
  }
}

export class CameraViewPoint {
  nearPlane: number = 0.1;
  farPlane: number = 2000.0;
  eyePosition: Array<number> = [0.0, 0.0, 0.0];
  targetPosition: Array<number> = [0.0, 0.0, 0.0];
  upVector: Array<number> = [0.0, 1.0, 0.0];
}
