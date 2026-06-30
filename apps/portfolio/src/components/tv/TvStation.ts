import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import ProjectedScreen from '../room/ProjectedScreen';
import {
  MODEL_TARGET_WIDTH,
  ROOM,
  ROOM_MODELS,
  TV_BOTTOM_HEIGHT,
} from '../room/roomConfig';
import { prepareModel } from '../room/RoomModelUtils';
import type { ProjectedScreenViewport } from '../room/screenTransform';

import { TV_SCREEN } from './tvConfig';

export default class TvStation {
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly loader = new GLTFLoader();
  private readonly anchor = new THREE.Group();
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly projectedScreen = new ProjectedScreen(TV_SCREEN);
  private isScreenReady = false;
  private isDisposed = false;

  constructor(private readonly scene: THREE.Scene) {
    const backWallInnerZ = -ROOM.depth / 2 + 0.08;
    this.anchor.position.set(0, TV_BOTTOM_HEIGHT, backWallInnerZ);
    scene.add(this.anchor);
    this.loadModel();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return raycaster.intersectObjects(this.pickTargets, true).length > 0;
  }

  getScreenViewport(
    camera: THREE.Camera,
    viewportWidth: number,
    viewportHeight: number,
  ): ProjectedScreenViewport | null {
    if (!this.isScreenReady) return null;
    return this.projectedScreen.project(
      this.anchor,
      camera,
      viewportWidth,
      viewportHeight,
    );
  }

  dispose() {
    this.isDisposed = true;
    this.pickTargets.length = 0;
    this.isScreenReady = false;
    this.scene.remove(this.anchor);
  }

  private loadModel() {
    this.loader.load(ROOM_MODELS.tv, (gltf) => {
      if (this.isDisposed) return;

      prepareModel(gltf.scene, MODEL_TARGET_WIDTH.tv);
      this.anchor.add(gltf.scene);
      this.pickTargets.push(gltf.scene);

      this.anchor.updateMatrixWorld(true);
      this.isScreenReady = true;
      this.hintAnchor.copy(
        this.anchor.localToWorld(
          new THREE.Vector3(
            TV_SCREEN.centerX,
            TV_SCREEN.centerY + TV_SCREEN.height / 2 + 0.5,
            TV_SCREEN.centerZ,
          ),
        ),
      );
      this.focusPosition.copy(
        this.anchor.localToWorld(
          new THREE.Vector3(
            TV_SCREEN.centerX,
            TV_SCREEN.centerY,
            TV_SCREEN.centerZ + TV_SCREEN.focusDistance,
          ),
        ),
      );
      this.focusTarget.copy(
        this.anchor.localToWorld(
          new THREE.Vector3(
            TV_SCREEN.centerX,
            TV_SCREEN.centerY,
            TV_SCREEN.centerZ,
          ),
        ),
      );
    });
  }
}
