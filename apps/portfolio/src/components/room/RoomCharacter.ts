import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  ROOM_MODELS,
  type RoomCollisionBox,
  type RoomSeat,
  type RoomSeatId,
} from './roomConfig';

const CHARACTER_SPEED = 4.25;
const CHARACTER_BOB_HEIGHT = 0.025;
const CHARACTER_BOB_SPEED = 14;
const CHARACTER_COLLISION_RADIUS = 0.34;
const CHARACTER_MOVEMENT_THRESHOLD = 0.0002;
const CHARACTER_MODEL_HEIGHT = 2.4;
const CHARACTER_TURN_SMOOTHING = 14;
const WALK_ANIMATION_NAME = 'Walking';
const WALK_ANIMATION_TIME_SCALE = 2.55;
const WALK_FADE_DURATION = 0.12;
const WALK_ANIMATION_FALLBACK_INDEX = 0;
const SIT_ANIMATION_NAME = 'Sitting';
const SIT_FADE_DURATION = 0.18;
const SIT_ANIMATION_FALLBACK_INDEX = 1;

type RoomCharacterOptions = {
  manager: THREE.LoadingManager;
  limitX: number;
  limitZ: number;
  limitBackZ?: number;
  limitFrontZ?: number;
  initialPosition: [number, number, number];
  collisionBoxes?: RoomCollisionBox[];
  seats?: Partial<Record<RoomSeatId, RoomSeat>>;
};

type CharacterUpdateOptions = {
  delta: number;
  elapsedTime: number;
  movementEnabled: boolean;
  viewForward: THREE.Vector3;
  viewRight: THREE.Vector3;
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

function normalizeCharacterModel(object: THREE.Object3D) {
  const sourceBounds = new THREE.Box3().setFromObject(object);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const scale = CHARACTER_MODEL_HEIGHT / Math.max(sourceSize.y, 0.001);

  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(object);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
  object.position.sub(
    new THREE.Vector3(scaledCenter.x, scaledBounds.min.y, scaledCenter.z),
  );
}

function prepareCharacterModel(object: THREE.Object3D) {
  normalizeCharacterModel(object);
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.visible = true;
      child.frustumCulled = false;
      child.receiveShadow = false;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      child.castShadow = !materials.some((material) => material.transparent);

      materials.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    }
  });
}

function findWalkClip(animations: THREE.AnimationClip[]) {
  const walkClip =
    THREE.AnimationClip.findByName(animations, WALK_ANIMATION_NAME) ??
    animations.find((clip) => clip.name.toLowerCase().includes('walk')) ??
    animations[WALK_ANIMATION_FALLBACK_INDEX] ??
    animations[0] ??
    null;

  return walkClip ? makeInPlaceWalkClip(walkClip) : null;
}

function findSitClip(animations: THREE.AnimationClip[]) {
  const sitClip =
    THREE.AnimationClip.findByName(animations, SIT_ANIMATION_NAME) ??
    animations.find((clip) => clip.name.toLowerCase().includes('sit')) ??
    animations[SIT_ANIMATION_FALLBACK_INDEX] ??
    null;

  return sitClip ? makeInPlaceClip(sitClip) : null;
}

function makeInPlaceWalkClip(clip: THREE.AnimationClip) {
  return makeInPlaceClip(clip);
}

function makeInPlaceClip(clip: THREE.AnimationClip) {
  return new THREE.AnimationClip(
    clip.name,
    clip.duration,
    clip.tracks
      .filter((track) => !track.name.startsWith('Root.position'))
      .map((track) => track.clone()),
  );
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

export default class RoomCharacterController {
  readonly object = new THREE.Group();

  private readonly dracoLoader: DRACOLoader;
  private readonly loader: GLTFLoader;
  private readonly pressedKeys = new Set<string>();
  private readonly targetPosition: THREE.Vector3;
  private readonly direction = new THREE.Vector3();
  private readonly previousPosition = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private readonly moveToTarget = new THREE.Vector3();
  private readonly currentGroundPosition = new THREE.Vector3();
  private readonly seatPosition = new THREE.Vector3();
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private sitAction: THREE.AnimationAction | null = null;
  private blinkAction: THREE.AnimationAction | null = null;
  private blinkDelay = 2;
  private walkFadeTimeRemaining = 0;
  private isWalking = false;
  private activeSeat: RoomSeatId | null = null;
  private isDisposed = false;

  constructor(private readonly options: RoomCharacterOptions) {
    this.dracoLoader = new DRACOLoader(options.manager);
    this.loader = new GLTFLoader(options.manager);
    this.dracoLoader.setDecoderPath('/draco/');
    this.dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.dracoLoader.preload();
    this.loader.setDRACOLoader(this.dracoLoader);
    this.object.position.set(...options.initialPosition);
    this.targetPosition = this.object.position.clone();
    this.loadCharacterModel();
  }

  pressKey(key: string) {
    this.pressedKeys.add(key.toLowerCase());
  }

  releaseKey(key: string) {
    this.pressedKeys.delete(key.toLowerCase());
  }

  clearInput() {
    this.pressedKeys.clear();
  }

  moveTo(position: THREE.Vector3) {
    this.exitSitting();
    this.targetPosition.copy(position);
    this.targetPosition.y = 0;
    this.clampTargetPosition();
  }

  private get isSitting() {
    return this.activeSeat !== null;
  }

  tryToggleNearbySeat() {
    if (this.activeSeat) return this.tryToggleSeat(this.activeSeat);
    let nearest: RoomSeatId | null = null;
    let nearestDistance = Infinity;
    for (const id of Object.keys(this.options.seats ?? {}) as RoomSeatId[]) {
      const seat = this.options.seats![id]!;
      const distance = Math.hypot(
        this.object.position.x - seat.position[0],
        this.object.position.z - seat.position[2],
      );
      if (distance <= seat.interactionRadius && distance < nearestDistance) {
        nearest = id;
        nearestDistance = distance;
      }
    }
    return nearest ? this.tryToggleSeat(nearest) : false;
  }

  tryToggleSeat(id: RoomSeatId, { ignoreDistance = false } = {}) {
    if (this.activeSeat === id) {
      this.exitSitting();
      return true;
    }

    const seat = this.options.seats?.[id];
    if (!seat) return false;

    const distanceToSeat = Math.hypot(
      this.object.position.x - seat.position[0],
      this.object.position.z - seat.position[2],
    );
    if (!ignoreDistance && distanceToSeat > seat.interactionRadius) {
      return false;
    }

    this.clearInput();
    this.activeSeat = id;
    this.seatPosition.set(...seat.position);
    this.isWalking = false;
    this.walkFadeTimeRemaining = 0;
    this.targetPosition.copy(this.seatPosition);
    this.object.position.copy(this.seatPosition);
    this.object.rotation.y = seat.rotationY;
    this.playSitAnimation();
    return true;
  }

  update({
    delta,
    elapsedTime,
    movementEnabled,
    viewForward,
    viewRight,
  }: CharacterUpdateOptions) {
    this.updateAnimations(delta);
    const moveRight =
      (this.hasKey('d', 'arrowright') ? 1 : 0) -
      (this.hasKey('a', 'arrowleft') ? 1 : 0);
    const moveForward =
      (this.hasKey('w', 'arrowup') ? 1 : 0) -
      (this.hasKey('s', 'arrowdown') ? 1 : 0);
    const hasMovementInput = moveRight !== 0 || moveForward !== 0;

    this.previousPosition.copy(this.object.position);

    if (!movementEnabled) {
      if (this.isSitting) {
        this.object.position.copy(this.seatPosition);
        this.targetPosition.copy(this.seatPosition);
        return;
      }
      this.targetPosition.set(
        this.object.position.x,
        0,
        this.object.position.z,
      );
      this.updateWalkAnimation(delta, false);
      this.object.position.y = 0;
      return;
    }

    if (this.isSitting) {
      if (!hasMovementInput) {
        this.object.position.copy(this.seatPosition);
        this.targetPosition.copy(this.seatPosition);
        return;
      }

      this.exitSitting();
    }

    this.direction
      .set(0, 0, 0)
      .addScaledVector(viewRight, moveRight)
      .addScaledVector(viewForward, moveForward);

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      this.targetPosition.set(
        this.object.position.x + this.direction.x * CHARACTER_SPEED * delta,
        0,
        this.object.position.z + this.direction.z * CHARACTER_SPEED * delta,
      );
      this.clampTargetPosition();
      this.applyGroundPosition(this.targetPosition.x, this.targetPosition.z);
      this.targetPosition.set(
        this.object.position.x,
        0,
        this.object.position.z,
      );
    } else {
      this.moveToTarget
        .set(this.targetPosition.x, 0, this.targetPosition.z)
        .sub(
          this.currentGroundPosition.set(
            this.object.position.x,
            0,
            this.object.position.z,
          ),
        );

      const distanceToTarget = this.moveToTarget.length();
      const step = CHARACTER_SPEED * delta;

      if (distanceToTarget > step) {
        this.moveToTarget.normalize();
        this.applyGroundPosition(
          this.object.position.x + this.moveToTarget.x * step,
          this.object.position.z + this.moveToTarget.z * step,
        );
      } else {
        const didReachTarget = this.applyGroundPosition(
          this.targetPosition.x,
          this.targetPosition.z,
        );

        if (!didReachTarget) {
          this.targetPosition.set(
            this.object.position.x,
            0,
            this.object.position.z,
          );
        }
      }
    }

    this.movement.set(
      this.object.position.x - this.previousPosition.x,
      0,
      this.object.position.z - this.previousPosition.z,
    );

    const isMoving = this.movement.lengthSq() > CHARACTER_MOVEMENT_THRESHOLD;
    if (isMoving) {
      this.object.rotation.y = dampAngle(
        this.object.rotation.y,
        Math.atan2(this.movement.x, this.movement.z),
        CHARACTER_TURN_SMOOTHING,
        delta,
      );
    }

    this.updateWalkAnimation(delta, isMoving);

    this.object.position.y =
      isMoving && !this.walkAction
        ? CHARACTER_BOB_HEIGHT * Math.sin(elapsedTime * CHARACTER_BOB_SPEED)
        : 0;
  }

  dispose() {
    this.isDisposed = true;
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.walkAction = null;
    this.sitAction = null;
    this.blinkAction = null;
    this.walkFadeTimeRemaining = 0;
    this.dracoLoader.dispose();
  }

  private hasKey(primary: string, alternate: string) {
    return this.pressedKeys.has(primary) || this.pressedKeys.has(alternate);
  }

  private clampTargetPosition() {
    this.targetPosition.x = THREE.MathUtils.clamp(
      this.targetPosition.x,
      -this.options.limitX,
      this.options.limitX,
    );
    this.targetPosition.z = THREE.MathUtils.clamp(
      this.targetPosition.z,
      -(this.options.limitBackZ ?? this.options.limitZ),
      this.options.limitFrontZ ?? this.options.limitZ,
    );
  }

  private applyGroundPosition(nextX: number, nextZ: number) {
    const clampedX = THREE.MathUtils.clamp(
      nextX,
      -this.options.limitX,
      this.options.limitX,
    );
    const clampedZ = THREE.MathUtils.clamp(
      nextZ,
      -(this.options.limitBackZ ?? this.options.limitZ),
      this.options.limitFrontZ ?? this.options.limitZ,
    );
    const currentX = this.object.position.x;
    const currentZ = this.object.position.z;

    if (this.canOccupy(clampedX, clampedZ)) {
      this.object.position.x = clampedX;
      this.object.position.z = clampedZ;
      return true;
    }

    let appliedX = currentX;
    let appliedZ = currentZ;

    if (this.canOccupy(clampedX, currentZ)) {
      appliedX = clampedX;
    }

    if (this.canOccupy(appliedX, clampedZ)) {
      appliedZ = clampedZ;
    }

    this.object.position.x = appliedX;
    this.object.position.z = appliedZ;
    return appliedX === clampedX && appliedZ === clampedZ;
  }

  private canOccupy(x: number, z: number) {
    return !this.options.collisionBoxes?.some((box) => {
      const xDistance = Math.abs(x - box.centerX);
      const zDistance = Math.abs(z - box.centerZ);

      return (
        xDistance < box.halfWidth + CHARACTER_COLLISION_RADIUS &&
        zDistance < box.halfDepth + CHARACTER_COLLISION_RADIUS
      );
    });
  }

  private loadCharacterModel() {
    this.loader.load(
      ROOM_MODELS.character,
      (gltf) => {
        const model = gltf.scene;

        if (this.isDisposed) {
          disposeObjectResources(model);
          return;
        }

        prepareCharacterModel(model);
        this.object.add(model);

        const walkClip = findWalkClip(gltf.animations);
        const sitClip = findSitClip(gltf.animations);
        const blinkClip = THREE.AnimationClip.findByName(
          gltf.animations,
          'Blink',
        );
        if (!walkClip && !sitClip && !blinkClip) return;

        this.mixer = new THREE.AnimationMixer(model);
        if (blinkClip) {
          this.blinkAction = this.mixer.clipAction(blinkClip);
          this.blinkAction.setLoop(THREE.LoopOnce, 1);
        }
        if (walkClip) {
          this.walkAction = this.mixer.clipAction(walkClip);
          this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
          this.walkAction.clampWhenFinished = false;
          this.walkAction.enabled = true;
          this.walkAction.setEffectiveWeight(0);
          this.walkAction.setEffectiveTimeScale(WALK_ANIMATION_TIME_SCALE);
        }

        if (sitClip) {
          this.sitAction = this.mixer.clipAction(sitClip);
          this.sitAction.setLoop(THREE.LoopOnce, 1);
          this.sitAction.clampWhenFinished = true;
          this.sitAction.enabled = true;
          this.sitAction.setEffectiveWeight(0);
        }

        if (this.isSitting) {
          this.playSitAnimation();
        }
      },
      undefined,
      (error) => {
        console.error('Failed to load character model:', error);
      },
    );
  }

  private updateWalkAnimation(delta: number, isMoving: boolean) {
    if (!this.walkAction || !this.mixer) return;

    this.walkAction.setEffectiveTimeScale(WALK_ANIMATION_TIME_SCALE);

    if (isMoving !== this.isWalking) {
      this.isWalking = isMoving;
      this.walkFadeTimeRemaining = WALK_FADE_DURATION;

      if (isMoving) {
        this.walkAction
          .reset()
          .setEffectiveTimeScale(WALK_ANIMATION_TIME_SCALE)
          .setEffectiveWeight(1)
          .fadeIn(WALK_FADE_DURATION)
          .play();
      } else {
        this.walkAction.fadeOut(WALK_FADE_DURATION);
      }
    }

    if (this.walkFadeTimeRemaining > 0) {
      this.walkFadeTimeRemaining = Math.max(
        0,
        this.walkFadeTimeRemaining - delta,
      );

      if (!this.isWalking && this.walkFadeTimeRemaining === 0) {
        this.walkAction.stop();
        this.walkAction.setEffectiveWeight(0);
      }
    }
  }

  private playSitAnimation() {
    if (!this.sitAction || !this.mixer) return;

    this.walkAction?.fadeOut(WALK_FADE_DURATION);
    this.sitAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(SIT_FADE_DURATION)
      .play();
    this.mixer.update(0);
  }

  private updateAnimations(delta: number) {
    if (!this.mixer) return;
    if (this.blinkAction) {
      this.blinkDelay -= delta;
      if (this.blinkDelay <= 0) {
        this.blinkAction.reset().play();
        this.blinkDelay = 3 + Math.random() * 3;
      }
    }
    // Idle frames still need to advance blinks and the seated pose's fade-out.
    this.mixer.update(delta);
  }

  private exitSitting() {
    if (!this.isSitting) return;

    const exitPosition = this.options.seats?.[this.activeSeat!]?.exitPosition;
    this.activeSeat = null;
    this.sitAction?.fadeOut(SIT_FADE_DURATION);

    if (exitPosition && this.canOccupy(exitPosition[0], exitPosition[2])) {
      this.object.position.set(...exitPosition);
    } else {
      this.object.position.y = 0;
    }

    this.targetPosition.set(this.object.position.x, 0, this.object.position.z);
  }
}
