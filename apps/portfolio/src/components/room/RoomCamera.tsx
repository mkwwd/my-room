'use client';

import * as THREE from 'three';

import type { SceneMode } from './roomConfig';

const CAMERA_FOV = 42;
const COMPUTER_CAMERA_FOV = 30;
const CAMERA_DISTANCE = 10;
const CAMERA_HEIGHT = 8.1;
const CAMERA_SIDE_FOLLOW = 0.38;
const CAMERA_LOOK_DISTANCE = 0.5;
const CAMERA_LOOK_HEIGHT = 3;
const VIEW_DIRECTION_COUNT = 4;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

export type ViewDirection = 0 | 1 | 2 | 3;
export type CameraMode = SceneMode;

type CameraFrame = {
  ease: number;
  forward: THREE.Vector3;
  right: THREE.Vector3;
};

type CameraFollowOptions = {
  frame: CameraFrame;
  mode: CameraMode;
  characterPosition: THREE.Vector3;
  focusPosition: THREE.Vector3;
  focusTarget: THREE.Vector3;
};

type CameraWalls = {
  back: THREE.Object3D;
  front: THREE.Object3D;
  left: THREE.Object3D;
  right: THREE.Object3D;
};

type RoomCameraControlsProps = {
  viewDirection: ViewDirection;
  onRotate: (step: -1 | 1) => void;
  onReset: () => void;
};

function getNearestViewAngle(
  currentAngle: number,
  nextViewDirection: ViewDirection,
) {
  const baseAngle = nextViewDirection * QUARTER_TURN;
  const turnOffset = Math.round((currentAngle - baseAngle) / FULL_TURN);
  return baseAngle + turnOffset * FULL_TURN;
}

export class RoomCameraController {
  readonly camera: THREE.PerspectiveCamera;

  private orbitAngle = 0;
  private targetOrbitAngle = 0;
  private viewDirection: ViewDirection = 0;
  private readonly lookAtTarget = new THREE.Vector3(
    0,
    CAMERA_LOOK_HEIGHT,
    -CAMERA_LOOK_DISTANCE,
  );
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLookAt = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, -1);
  private readonly right = new THREE.Vector3(1, 0, 0);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100);
    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    this.camera.lookAt(0, CAMERA_LOOK_HEIGHT, -CAMERA_LOOK_DISTANCE);
  }

  setView(nextViewDirection: ViewDirection) {
    this.viewDirection = nextViewDirection;
    this.targetOrbitAngle = getNearestViewAngle(
      this.targetOrbitAngle,
      nextViewDirection,
    );
  }

  rotate(step: -1 | 1) {
    this.viewDirection = ((this.viewDirection + step + VIEW_DIRECTION_COUNT) %
      VIEW_DIRECTION_COUNT) as ViewDirection;
    this.targetOrbitAngle += step * QUARTER_TURN;

    return this.viewDirection;
  }

  beginFrame(delta: number): CameraFrame {
    const ease = 1 - Math.pow(0.02, delta);
    this.orbitAngle = THREE.MathUtils.lerp(
      this.orbitAngle,
      this.targetOrbitAngle,
      ease,
    );

    const sin = Math.sin(this.orbitAngle);
    const cos = Math.cos(this.orbitAngle);
    this.forward.set(-sin, 0, -cos);
    this.right.set(cos, 0, -sin);

    return { ease, forward: this.forward, right: this.right };
  }

  follow({
    frame,
    mode,
    characterPosition,
    focusPosition,
    focusTarget,
  }: CameraFollowOptions) {
    const cameraSideFollow = THREE.MathUtils.clamp(
      characterPosition.dot(frame.right) * CAMERA_SIDE_FOLLOW,
      -1.35,
      1.35,
    );

    if (mode !== 'explore') {
      this.desiredPosition.copy(focusPosition);
      this.desiredLookAt.copy(focusTarget);
    } else {
      this.desiredPosition
        .copy(frame.forward)
        .multiplyScalar(-CAMERA_DISTANCE)
        .addScaledVector(frame.right, cameraSideFollow);
      this.desiredPosition.y = CAMERA_HEIGHT;

      this.desiredLookAt
        .copy(frame.forward)
        .multiplyScalar(CAMERA_LOOK_DISTANCE)
        .addScaledVector(frame.right, cameraSideFollow);
      this.desiredLookAt.y = CAMERA_LOOK_HEIGHT;
    }

    const desiredFov = mode !== 'explore' ? COMPUTER_CAMERA_FOV : CAMERA_FOV;
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      desiredFov,
      frame.ease,
    );
    this.camera.updateProjectionMatrix();
    this.camera.position.lerp(this.desiredPosition, frame.ease);
    this.lookAtTarget.lerp(this.desiredLookAt, frame.ease);
    this.camera.lookAt(this.lookAtTarget);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  updateWallVisibility(
    walls: CameraWalls,
    roomWidth: number,
    roomDepth: number,
  ) {
    const halfWidth = roomWidth / 2;
    const halfDepth = roomDepth / 2;
    const margin = 0.35;

    walls.front.visible = this.camera.position.z < halfDepth + margin;
    walls.back.visible = this.camera.position.z > -halfDepth - margin;
    walls.right.visible = this.camera.position.x < halfWidth + margin;
    walls.left.visible = this.camera.position.x > -halfWidth - margin;
  }
}

export default function RoomCameraControls({
  viewDirection,
  onRotate,
  onReset,
}: RoomCameraControlsProps) {
  const controlBaseClass =
    'grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-0 bg-white/60 text-[28px] leading-none font-black text-[#4b382c] transition-[background,box-shadow,transform] duration-200 hover:-translate-y-px hover:bg-[#c8f2c4] hover:shadow-[inset_0_-3px_rgba(63,92,45,0.14)] focus-visible:-translate-y-px focus-visible:bg-[#c8f2c4] focus-visible:shadow-[inset_0_-3px_rgba(63,92,45,0.14)]';
  const activeControlClass =
    '-translate-y-px bg-[#c8f2c4] shadow-[inset_0_-3px_rgba(63,92,45,0.14)]';

  return (
    <div
      className="absolute right-[clamp(16px,3vw,36px)] bottom-[clamp(16px,3vw,32px)] z-[3] flex gap-2 rounded-full border-2 border-[rgba(84,61,43,0.16)] bg-[rgba(255,246,223,0.78)] p-2 shadow-[0_14px_40px_rgba(67,42,28,0.18)] backdrop-blur-[10px]"
      aria-label="Camera view controls">
      <button
        type="button"
        className={controlBaseClass}
        onClick={() => onRotate(-1)}
        aria-label="Rotate camera 90 degrees left">
        {'<'}
      </button>
      <button
        type="button"
        className={`${controlBaseClass} ${
          viewDirection === 0 ? activeControlClass : ''
        }`}
        onClick={onReset}
        aria-label="Return to the default view">
        o
      </button>
      <button
        type="button"
        className={controlBaseClass}
        onClick={() => onRotate(1)}
        aria-label="Rotate camera 90 degrees right">
        {'>'}
      </button>
    </div>
  );
}
