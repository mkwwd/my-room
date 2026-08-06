import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MODEL_TARGET_WIDTH, ROOM_MODELS } from './roomConfig';
import { prepareModel } from './RoomModelUtils';

const CAT_SPEED = 2.15;
const CAT_CATCH_UP_SPEED = 0.55;
const CAT_MAX_SPEED = 2.65;
const CAT_STOP_DISTANCE = 0.28;
const CAT_TRAIL_DISTANCE = 0.98;
const CAT_SIDE_OFFSET = 0.58;
const CAT_TURN_SMOOTHING = 8;
const CAT_MOVEMENT_THRESHOLD = 0.00012;
const CAT_BOB_HEIGHT = 0.018;
const CAT_BOB_SPEED = 9;
const CAT_WALK_FADE_DURATION = 0.22;
const CAT_WALK_TIME_SCALE = 0.78;

type RoomCatOptions = {
  initialPosition: [number, number, number];
};

type RoomCatUpdateOptions = {
  delta: number;
  elapsedTime: number;
  followTarget: THREE.Object3D;
  movementEnabled: boolean;
};

function disposeObjectResources(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();

      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function dampAngle(
  current: number,
  target: number,
  smoothing: number,
  delta: number,
) {
  const angleDelta =
    THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) -
    Math.PI;

  return current + angleDelta * (1 - Math.exp(-smoothing * delta));
}

function findCatWalkClip(animations: THREE.AnimationClip[]) {
  return (
    animations.find((clip) => clip.name.toLowerCase().includes('walk')) ??
    animations.find((clip) => clip.name.toLowerCase().includes('trot')) ??
    animations.find((clip) => clip.name.toLowerCase().includes('run')) ??
    animations[0] ??
    null
  );
}

export default class RoomCatController {
  readonly object = new THREE.Group();

  private readonly dracoLoader = new DRACOLoader();
  private readonly loader = new GLTFLoader();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly targetForward = new THREE.Vector3();
  private readonly targetRight = new THREE.Vector3();
  private readonly toDesiredPosition = new THREE.Vector3();
  private readonly previousPosition = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private isWalking = false;
  private isDisposed = false;

  constructor(options: RoomCatOptions) {
    this.dracoLoader.setDecoderPath('/draco/');
    this.dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.dracoLoader.preload();
    this.loader.setDRACOLoader(this.dracoLoader);
    this.object.position.set(...options.initialPosition);
    this.loadCatModel();
  }

  update({
    delta,
    elapsedTime,
    followTarget,
    movementEnabled,
  }: RoomCatUpdateOptions) {
    this.previousPosition.copy(this.object.position);

    if (movementEnabled) {
      this.updateDesiredPosition(followTarget);
      this.moveTowardDesiredPosition(delta);
    }

    this.movement.set(
      this.object.position.x - this.previousPosition.x,
      0,
      this.object.position.z - this.previousPosition.z,
    );

    const isMoving = this.movement.lengthSq() > CAT_MOVEMENT_THRESHOLD;
    if (isMoving) {
      this.object.rotation.y = dampAngle(
        this.object.rotation.y,
        Math.atan2(this.movement.x, this.movement.z),
        CAT_TURN_SMOOTHING,
        delta,
      );
    }

    this.updateWalkAnimation(delta, isMoving);
    this.object.position.y =
      isMoving && !this.walkAction
        ? CAT_BOB_HEIGHT * Math.sin(elapsedTime * CAT_BOB_SPEED)
        : 0;
  }

  dispose() {
    this.isDisposed = true;
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.walkAction = null;
    this.dracoLoader.dispose();
  }

  private updateDesiredPosition(followTarget: THREE.Object3D) {
    this.targetForward.set(
      Math.sin(followTarget.rotation.y),
      0,
      Math.cos(followTarget.rotation.y),
    );
    this.targetRight.set(
      Math.cos(followTarget.rotation.y),
      0,
      -Math.sin(followTarget.rotation.y),
    );

    this.desiredPosition
      .copy(followTarget.position)
      .addScaledVector(this.targetForward, -CAT_TRAIL_DISTANCE)
      .addScaledVector(this.targetRight, CAT_SIDE_OFFSET);
    this.desiredPosition.y = 0;
  }

  private moveTowardDesiredPosition(delta: number) {
    this.toDesiredPosition
      .copy(this.desiredPosition)
      .sub(this.object.position)
      .setY(0);

    const distance = this.toDesiredPosition.length();
    if (distance <= CAT_STOP_DISTANCE) return;

    const speed = Math.min(
      CAT_MAX_SPEED,
      CAT_SPEED +
        Math.max(distance - CAT_TRAIL_DISTANCE, 0) * CAT_CATCH_UP_SPEED,
    );
    const step = Math.min(distance - CAT_STOP_DISTANCE, speed * delta);
    this.toDesiredPosition.normalize();
    this.object.position.addScaledVector(this.toDesiredPosition, step);
  }

  private loadCatModel() {
    this.loader.load(
      ROOM_MODELS.cat,
      (gltf) => {
        const model = gltf.scene;

        if (this.isDisposed) {
          disposeObjectResources(model);
          return;
        }

        prepareModel(model, MODEL_TARGET_WIDTH.cat);
        this.object.add(model);

        const walkClip = findCatWalkClip(gltf.animations);
        if (!walkClip) return;

        this.mixer = new THREE.AnimationMixer(model);
        this.walkAction = this.mixer.clipAction(walkClip);
        this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
        this.walkAction.clampWhenFinished = false;
        this.walkAction.enabled = true;
        this.walkAction.setEffectiveWeight(0);
      },
      undefined,
      (error) => {
        console.error('Failed to load cat model:', error);
      },
    );
  }

  private updateWalkAnimation(delta: number, isMoving: boolean) {
    if (!this.walkAction || !this.mixer) return;

    if (isMoving !== this.isWalking) {
      this.isWalking = isMoving;

      if (isMoving) {
        this.walkAction
          .reset()
          .setEffectiveTimeScale(CAT_WALK_TIME_SCALE)
          .setEffectiveWeight(1)
          .fadeIn(CAT_WALK_FADE_DURATION)
          .play();
      } else {
        this.walkAction.fadeOut(CAT_WALK_FADE_DURATION);
      }
    }

    this.mixer.update(delta);
  }
}
