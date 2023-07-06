import {
  EventDispatcher,
  MathUtils,
  MOUSE,
  Quaternion,
  Vector2,
  Vector3,
  PerspectiveCamera,
  OrthographicCamera,
} from "three";

const _changeEvent = { type: "change" };
const _startEvent = { type: "start" };
const _endEvent = { type: "end" };

type IState = {
  NONE: -1;
  ROTATE: 0;
  ZOOM: 1;
  PAN: 2;
  TOUCH_ROTATE: 3;
  TOUCH_ZOOM: 4;
  TOUCH_PAN: 5;
  TOUCH_ZOOM_PAN: 6;
};

class Copper3dTrackballControls extends EventDispatcher {
  object: PerspectiveCamera | OrthographicCamera;
  domElement: HTMLElement;
  enabled: boolean;
  screen: { left: number; top: number; width: number; height: number };

  rotateSpeed: number;
  zoomSpeed: number;
  panSpeed: number;

  noRotate: boolean;
  noZoom: boolean;
  noPan: boolean;

  staticMoving: boolean;
  dynamicDampingFactor: number;

  minDistance: number;
  maxDistance: number;

  minZoom: number;
  maxZoom: number;

  keys: ["KeyA" /*A*/, "KeyS" /*S*/, "KeyD" /*D*/];

  mouseButtons: {
    LEFT: MOUSE.ROTATE | MOUSE.PAN | -1;
    MIDDLE: MOUSE.DOLLY | MOUSE.ROTATE | MOUSE.PAN | -1;
    RIGHT: MOUSE.ROTATE | MOUSE.PAN | -1;
  };

  target: Vector3;

  target0: Vector3;
  position0: Vector3;
  up0: Vector3;
  zoom0: number;

  // methods
  handleResize: () => void;

  rotateCamera: () => void;
  zoomCamera: () => void;
  panCamera: () => void;

  checkDistances: () => void;

  update: () => void;
  reset: () => void;

  dispose: () => void;

  constructor(
    object: PerspectiveCamera | OrthographicCamera,
    domElement: HTMLElement
  ) {
    super();

    const scope = this;
    const STATE: IState = {
      NONE: -1,
      ROTATE: 0,
      ZOOM: 1,
      PAN: 2,
      TOUCH_ROTATE: 3,
      TOUCH_ZOOM: 4,
      TOUCH_PAN: 5,
      TOUCH_ZOOM_PAN: 6,
    };

    this.object = object;
    this.domElement = domElement;
    this.domElement.style.touchAction = "none"; // disable touch scroll

    // API

    this.enabled = true;

    this.screen = { left: 0, top: 0, width: 0, height: 0 };

    this.rotateSpeed = 1.0;
    this.zoomSpeed = 1.2;
    this.panSpeed = 0.3;

    this.noRotate = false;
    this.noZoom = false;
    this.noPan = false;

    this.staticMoving = false;
    this.dynamicDampingFactor = 0.2;

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.minZoom = 0;
    this.maxZoom = Infinity;

    this.keys = ["KeyA" /*A*/, "KeyS" /*S*/, "KeyD" /*D*/];

    this.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    };

    // internals

    this.target = new Vector3();

    const EPS: number = 0.000001;

    const lastPosition: Vector3 = new Vector3();
    let lastZoom: number = 1;

    let _state: number = STATE.NONE,
      _keyState: number = STATE.NONE,
      _touchZoomDistanceStart: number = 0,
      _touchZoomDistanceEnd: number = 0,
      _lastAngle: number = 0;

    const _eye: Vector3 = new Vector3(),
      _movePrev: Vector2 = new Vector2(),
      _moveCurr: Vector2 = new Vector2(),
      _lastAxis: Vector3 = new Vector3(),
      _zoomStart: Vector2 = new Vector2(),
      _zoomEnd: Vector2 = new Vector2(),
      _panStart: Vector2 = new Vector2(),
      _panEnd: Vector2 = new Vector2(),
      _pointers: Array<PointerEvent> = [],
      _pointerPositions: { [key: string]: Vector2 } = {};

    // for reset

    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.up0 = this.object.up.clone();
    this.zoom0 = this.object.zoom;

    // methods

    this.handleResize = function () {
      const box: DOMRect = scope.domElement.getBoundingClientRect();
      // adjustments come from similar code in the jquery offset() function
      const d: HTMLElement = scope.domElement.ownerDocument.documentElement;
      scope.screen.left = box.left + window.pageXOffset - d.clientLeft;
      scope.screen.top = box.top + window.pageYOffset - d.clientTop;
      scope.screen.width = box.width;
      scope.screen.height = box.height;
    };

    const getMouseOnScreen = (function () {
      const vector: Vector2 = new Vector2();

      return function getMouseOnScreen(pageX: number, pageY: number) {
        vector.set(
          (pageX - scope.screen.left) / scope.screen.width,
          (pageY - scope.screen.top) / scope.screen.height
        );

        return vector;
      };
    })();

    const getMouseOnCircle = (function () {
      const vector: Vector2 = new Vector2();

      return function getMouseOnCircle(pageX: number, pageY: number) {
        vector.set(
          (pageX - scope.screen.width * 0.5 - scope.screen.left) /
            (scope.screen.width * 0.5),
          (scope.screen.height + 2 * (scope.screen.top - pageY)) /
            scope.screen.width // screen.width intentional
        );

        return vector;
      };
    })();

    this.rotateCamera = (function () {
      const axis: Vector3 = new Vector3(),
        quaternion: Quaternion = new Quaternion(),
        eyeDirection: Vector3 = new Vector3(),
        objectUpDirection: Vector3 = new Vector3(),
        objectSidewaysDirection: Vector3 = new Vector3(),
        moveDirection: Vector3 = new Vector3();

      return function rotateCamera() {
        moveDirection.set(
          _moveCurr.x - _movePrev.x,
          _moveCurr.y - _movePrev.y,
          0
        );
        let angle: number = moveDirection.length();

        if (angle) {
          _eye.copy(scope.object.position).sub(scope.target);

          eyeDirection.copy(_eye).normalize();
          objectUpDirection.copy(scope.object.up).normalize();
          objectSidewaysDirection
            .crossVectors(objectUpDirection, eyeDirection)
            .normalize();

          objectUpDirection.setLength(_moveCurr.y - _movePrev.y);
          objectSidewaysDirection.setLength(_moveCurr.x - _movePrev.x);

          moveDirection.copy(objectUpDirection.add(objectSidewaysDirection));

          axis.crossVectors(moveDirection, _eye).normalize();

          angle *= scope.rotateSpeed;
          quaternion.setFromAxisAngle(axis, angle);

          _eye.applyQuaternion(quaternion);
          scope.object.up.applyQuaternion(quaternion);

          _lastAxis.copy(axis);
          _lastAngle = angle;
        } else if (!scope.staticMoving && _lastAngle) {
          _lastAngle *= Math.sqrt(1.0 - scope.dynamicDampingFactor);
          _eye.copy(scope.object.position).sub(scope.target);
          quaternion.setFromAxisAngle(_lastAxis, _lastAngle);
          _eye.applyQuaternion(quaternion);
          scope.object.up.applyQuaternion(quaternion);
        }

        _movePrev.copy(_moveCurr);
      };
    })();

    this.zoomCamera = function () {
      let factor: number;

      const zoomCore = function (factor: number) {
        if ((scope.object as PerspectiveCamera).isPerspectiveCamera) {
          _eye.multiplyScalar(factor);
        } else if ((scope.object as OrthographicCamera).isOrthographicCamera) {
          scope.object.zoom = MathUtils.clamp(
            scope.object.zoom / factor,
            scope.minZoom,
            scope.maxZoom
          );
          if (lastZoom !== scope.object.zoom) {
            scope.object.updateProjectionMatrix();
          }
        } else {
          console.warn("THREE.TrackballControls: Unsupported camera type");
        }
      };

      if (_state === STATE.TOUCH_ZOOM_PAN) {
        factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
        _touchZoomDistanceStart = _touchZoomDistanceEnd;

        zoomCore(factor);
      } else {
        factor = 1.0 + (_zoomEnd.y - _zoomStart.y) * scope.zoomSpeed;

        if (factor !== 1.0 && factor > 0.0) {
          zoomCore(factor);
        }

        if (scope.staticMoving) {
          _zoomStart.copy(_zoomEnd);
        } else {
          _zoomStart.y +=
            (_zoomEnd.y - _zoomStart.y) * this.dynamicDampingFactor;
        }
      }
    };

    this.panCamera = (function () {
      const mouseChange: Vector2 = new Vector2(),
        objectUp: Vector3 = new Vector3(),
        pan: Vector3 = new Vector3();

      return function panCamera() {
        mouseChange.copy(_panEnd).sub(_panStart);

        if (mouseChange.lengthSq()) {
          if ((scope.object as OrthographicCamera).isOrthographicCamera) {
            const scale_x: number =
              ((scope.object as OrthographicCamera).right -
                (scope.object as OrthographicCamera).left) /
              scope.object.zoom /
              scope.domElement.clientWidth;
            const scale_y: number =
              ((scope.object as OrthographicCamera).top -
                (scope.object as OrthographicCamera).bottom) /
              scope.object.zoom /
              scope.domElement.clientWidth;

            mouseChange.x *= scale_x;
            mouseChange.y *= scale_y;
          }

          mouseChange.multiplyScalar(_eye.length() * scope.panSpeed);

          pan.copy(_eye).cross(scope.object.up).setLength(mouseChange.x);
          pan.add(objectUp.copy(scope.object.up).setLength(mouseChange.y));

          scope.object.position.add(pan);
          scope.target.add(pan);

          if (scope.staticMoving) {
            _panStart.copy(_panEnd);
          } else {
            _panStart.add(
              mouseChange
                .subVectors(_panEnd, _panStart)
                .multiplyScalar(scope.dynamicDampingFactor)
            );
          }
        }
      };
    })();

    this.checkDistances = function () {
      if (!scope.noZoom || !scope.noPan) {
        if (_eye.lengthSq() > scope.maxDistance * scope.maxDistance) {
          scope.object.position.addVectors(
            scope.target,
            _eye.setLength(scope.maxDistance)
          );
          _zoomStart.copy(_zoomEnd);
        }

        if (_eye.lengthSq() < scope.minDistance * scope.minDistance) {
          scope.object.position.addVectors(
            scope.target,
            _eye.setLength(scope.minDistance)
          );
          _zoomStart.copy(_zoomEnd);
        }
      }
    };

    this.update = function () {
      _eye.subVectors(scope.object.position, scope.target);

      if (!scope.noRotate) {
        scope.rotateCamera();
      }

      if (!scope.noZoom) {
        scope.zoomCamera();
      }

      if (!scope.noPan) {
        scope.panCamera();
      }

      scope.object.position.addVectors(scope.target, _eye);

      if ((scope.object as PerspectiveCamera).isPerspectiveCamera) {
        scope.checkDistances();

        scope.object.lookAt(scope.target);

        if (lastPosition.distanceToSquared(scope.object.position) > EPS) {
          scope.dispatchEvent(_changeEvent);

          lastPosition.copy(scope.object.position);
        }
      } else if ((scope.object as OrthographicCamera).isOrthographicCamera) {
        scope.object.lookAt(scope.target);

        if (
          lastPosition.distanceToSquared(scope.object.position) > EPS ||
          lastZoom !== scope.object.zoom
        ) {
          scope.dispatchEvent(_changeEvent);

          lastPosition.copy(scope.object.position);
          lastZoom = scope.object.zoom;
        }
      } else {
        console.warn("THREE.TrackballControls: Unsupported camera type");
      }
    };

    this.reset = function () {
      _state = STATE.NONE;
      _keyState = STATE.NONE;

      scope.target.copy(scope.target0);
      scope.object.position.copy(scope.position0);
      scope.object.up.copy(scope.up0);
      scope.object.zoom = scope.zoom0;

      scope.object.updateProjectionMatrix();

      _eye.subVectors(scope.object.position, scope.target);

      scope.object.lookAt(scope.target);

      scope.dispatchEvent(_changeEvent);

      lastPosition.copy(scope.object.position);
      lastZoom = scope.object.zoom;
    };

    // listeners

    function onPointerDown(event: PointerEvent) {
      if (scope.enabled === false) return;

      if (_pointers.length === 0) {
        scope.domElement.setPointerCapture(event.pointerId);

        scope.domElement.addEventListener("pointermove", onPointerMove);
        scope.domElement.addEventListener("pointerup", onPointerUp);
      }

      //

      addPointer(event);

      if (event.pointerType === "touch") {
        onTouchStart(event);
      } else {
        onMouseDown(event);
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (scope.enabled === false) return;

      if (event.pointerType === "touch") {
        onTouchMove(event);
      } else {
        onMouseMove(event);
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (scope.enabled === false) return;

      if (event.pointerType === "touch") {
        onTouchEnd(event);
      } else {
        onMouseUp();
      }

      //

      removePointer(event);

      if (_pointers.length === 0) {
        scope.domElement.releasePointerCapture(event.pointerId);

        scope.domElement.removeEventListener("pointermove", onPointerMove);
        scope.domElement.removeEventListener("pointerup", onPointerUp);
      }
    }

    function onPointerCancel(event: PointerEvent) {
      removePointer(event);
    }

    function keydown(event: KeyboardEvent) {
      if (scope.enabled === false) return;

      window.removeEventListener("keydown", keydown);

      if (_keyState !== STATE.NONE) {
        return;
      } else if (event.code === scope.keys[STATE.ROTATE] && !scope.noRotate) {
        _keyState = STATE.ROTATE;
      } else if (event.code === scope.keys[STATE.ZOOM] && !scope.noZoom) {
        _keyState = STATE.ZOOM;
      } else if (event.code === scope.keys[STATE.PAN] && !scope.noPan) {
        _keyState = STATE.PAN;
      }
    }

    function keyup() {
      if (scope.enabled === false) return;

      _keyState = STATE.NONE;

      window.addEventListener("keydown", keydown);
    }

    function onMouseDown(event: PointerEvent) {
      if (_state === STATE.NONE) {
        switch (event.button) {
          case 0: // mouse left
            _state = scope.mouseButtons.LEFT;
            break;

          case 1: // mouse wheel
            _state = scope.mouseButtons.MIDDLE;
            break;

          case 2: // mouse right
            _state = scope.mouseButtons.RIGHT;
            break;
        }
      }

      const state: number = _keyState !== STATE.NONE ? _keyState : _state;

      if (state === STATE.ROTATE && !scope.noRotate) {
        _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
        _movePrev.copy(_moveCurr);
      } else if (state === STATE.ZOOM && !scope.noZoom) {
        _zoomStart.copy(getMouseOnScreen(event.pageX, event.pageY));
        _zoomEnd.copy(_zoomStart);
      } else if (state === STATE.PAN && !scope.noPan) {
        _panStart.copy(getMouseOnScreen(event.pageX, event.pageY));
        _panEnd.copy(_panStart);
      }

      scope.dispatchEvent(_startEvent);
    }

    function onMouseMove(event: PointerEvent) {
      const state: number = _keyState !== STATE.NONE ? _keyState : _state;

      if (state === STATE.ROTATE && !scope.noRotate) {
        _movePrev.copy(_moveCurr);
        _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
      } else if (state === STATE.ZOOM && !scope.noZoom) {
        _zoomEnd.copy(getMouseOnScreen(event.pageX, event.pageY));
      } else if (state === STATE.PAN && !scope.noPan) {
        _panEnd.copy(getMouseOnScreen(event.pageX, event.pageY));
      }
    }

    function onMouseUp() {
      _state = STATE.NONE;

      scope.dispatchEvent(_endEvent);
    }

    function onMouseWheel(event: WheelEvent) {
      if (scope.enabled === false) return;

      if (scope.noZoom === true) return;

      event.preventDefault();

      switch (event.deltaMode) {
        case 2:
          // Zoom in pages
          _zoomStart.y -= event.deltaY * 0.025;
          break;

        case 1:
          // Zoom in lines
          _zoomStart.y -= event.deltaY * 0.01;
          break;

        default:
          // undefined, 0, assume pixels
          _zoomStart.y -= event.deltaY * 0.00025;
          break;
      }

      scope.dispatchEvent(_startEvent);
      scope.dispatchEvent(_endEvent);
    }

    function onTouchStart(event: PointerEvent) {
      trackPointer(event);

      switch (_pointers.length) {
        case 1:
          _state = STATE.TOUCH_ROTATE;
          _moveCurr.copy(
            getMouseOnCircle(_pointers[0].pageX, _pointers[0].pageY)
          );
          _movePrev.copy(_moveCurr);
          break;

        case 2:
          _state = STATE.TOUCH_ZOOM_PAN;
          const dx: number = _pointers[0].pageX - _pointers[1].pageX;
          const dy: number = _pointers[0].pageY - _pointers[1].pageY;
          _touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt(
            dx * dx + dy * dy
          );

          const x: number = (_pointers[0].pageX + _pointers[1].pageX) / 2;
          const y: number = (_pointers[0].pageY + _pointers[1].pageY) / 2;
          _panStart.copy(getMouseOnScreen(x, y));
          _panEnd.copy(_panStart);
          break;

        case 3:
          _state = STATE.TOUCH_PAN;

          const centerX: number =
            (_pointers[0].pageX + _pointers[1].pageX + _pointers[2].pageX) / 3;
          const centerY: number =
            (_pointers[0].pageY + _pointers[1].pageY + _pointers[2].pageY) / 3;
          _panStart.copy(getMouseOnScreen(centerX, centerY));
          _panEnd.copy(_panStart);
          break;
      }

      scope.dispatchEvent(_startEvent);
    }

    function onTouchMove(event: PointerEvent) {
      trackPointer(event);
      let position: Vector2, x: number, y: number;

      switch (_pointers.length) {
        case 1:
          if (_state != STATE.TOUCH_ROTATE) return;

          _movePrev.copy(_moveCurr);
          _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
          break;

        case 2:
          if (_state != STATE.TOUCH_ZOOM_PAN) return;
          position = getSecondPointerPosition(event);

          const dx: number = event.pageX - position.x;
          const dy: number = event.pageY - position.y;
          _touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy);

          x = (event.pageX + position.x) / 2;
          y = (event.pageY + position.y) / 2;
          _panEnd.copy(getMouseOnScreen(x, y));
          break;

        case 3:
          if (_state != STATE.TOUCH_PAN) return;
          const point_1: Vector2 = _pointerPositions[_pointers[0].pointerId];
          const point_2: Vector2 = _pointerPositions[_pointers[1].pointerId];
          const point_3: Vector2 = _pointerPositions[_pointers[2].pointerId];

          const centerX: number = (point_1.x + point_2.x + point_3.x) / 3;
          const centerY: number = (point_1.y + point_2.y + point_3.y) / 3;

          _panEnd.copy(getMouseOnScreen(centerX, centerY));
          break;
      }
    }

    function onTouchEnd(event: PointerEvent) {
      switch (_pointers.length) {
        case 0:
          _state = STATE.NONE;
          break;

        case 1:
          _state = STATE.TOUCH_ROTATE;
          _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
          _movePrev.copy(_moveCurr);
          break;

        case 2:
          _state = STATE.TOUCH_ZOOM_PAN;

          for (let i = 0; i < _pointers.length; i++) {
            if (_pointers[i].pointerId !== event.pointerId) {
              const position: Vector2 =
                _pointerPositions[_pointers[i].pointerId];
              _moveCurr.copy(getMouseOnScreen(position.x, position.y));
              _movePrev.copy(_moveCurr);
              break;
            }
          }
          break;

        case 3:
          _state = STATE.TOUCH_PAN;

          for (let i = 0; i < _pointers.length; i++) {
            if (_pointers[i].pointerId !== event.pointerId) {
              const position: Vector2 =
                _pointerPositions[_pointers[i].pointerId];
              _moveCurr.copy(getMouseOnScreen(position.x, position.y));
              _movePrev.copy(_moveCurr);
              break;
            }
          }
          break;
      }

      scope.dispatchEvent(_endEvent);
    }

    function contextmenu(event: MouseEvent) {
      if (scope.enabled === false) return;

      event.preventDefault();
    }

    function addPointer(event: PointerEvent) {
      _pointers.push(event);
    }

    function removePointer(event: PointerEvent) {
      delete _pointerPositions[event.pointerId];

      for (let i = 0; i < _pointers.length; i++) {
        if (_pointers[i].pointerId == event.pointerId) {
          _pointers.splice(i, 1);
          return;
        }
      }
    }

    function trackPointer(event: PointerEvent) {
      let position: Vector2 = _pointerPositions[event.pointerId];

      if (position === undefined) {
        position = new Vector2();
        _pointerPositions[event.pointerId] = position;
      }

      position.set(event.pageX, event.pageY);
    }

    function getSecondPointerPosition(event: PointerEvent) {
      const pointer: PointerEvent =
        event.pointerId === _pointers[0].pointerId
          ? _pointers[1]
          : _pointers[0];

      return _pointerPositions[pointer.pointerId];
    }

    this.dispose = function () {
      scope.domElement.removeEventListener("contextmenu", contextmenu);

      scope.domElement.removeEventListener("pointerdown", onPointerDown);
      scope.domElement.removeEventListener("pointercancel", onPointerCancel);
      scope.domElement.removeEventListener("wheel", onMouseWheel);

      scope.domElement.removeEventListener("pointermove", onPointerMove);
      scope.domElement.removeEventListener("pointerup", onPointerUp);

      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };

    this.domElement.addEventListener("contextmenu", contextmenu);

    this.domElement.addEventListener("pointerdown", onPointerDown);
    this.domElement.addEventListener("pointercancel", onPointerCancel);
    this.domElement.addEventListener("wheel", onMouseWheel, { passive: false });

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    this.handleResize();

    // force an update at start
    this.update();
  }
}

export { Copper3dTrackballControls };
