import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import ProjectedScreen from '../room/ProjectedScreen';
import {
  COMPUTER_BASE_HEIGHT,
  COMPUTER_CHAIR,
  COMPUTER_DESK_HEIGHT_SCALE,
  COMPUTER_DESK_ROTATION_Y,
  COMPUTER_DESKTOP_OFFSET_Z,
  COMPUTER_SCREEN,
  COMPUTER_STATION_WALL_INSET,
  DESK_SURFACE_HEIGHT,
  MODEL_TARGET_WIDTH,
  ROOM,
  ROOM_MODELS,
} from '../room/roomConfig';
import { addHoverRim } from '../room/RoomHoverEffect';
import { enableModelShadows, prepareModel } from '../room/RoomModelUtils';
import type { ProjectedScreenViewport } from '../room/screenTransform';

function softenComputerWarmHighlights(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    const softenedMaterials = materials.map((material) => {
      const softenedMaterial = material.clone();

      if (
        softenedMaterial instanceof THREE.MeshStandardMaterial ||
        softenedMaterial instanceof THREE.MeshPhysicalMaterial
      ) {
        softenedMaterial.roughness = Math.max(softenedMaterial.roughness, 0.85);
        softenedMaterial.metalness = Math.min(softenedMaterial.metalness, 0.12);
        softenedMaterial.envMapIntensity = Math.min(
          softenedMaterial.envMapIntensity,
          0.45,
        );
      }

      return softenedMaterial;
    });

    child.material = Array.isArray(child.material)
      ? softenedMaterials
      : softenedMaterials[0];
  });
}

const COMPUTER_MODEL_HEIGHT_SCALE = 1;
const COMPUTER_MODEL_DEPTH_SCALE = 0.015;

export default class ComputerStation {
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly loader: GLTFLoader;
  private readonly anchor = new THREE.Group();
  private readonly chairAnchor = new THREE.Group();
  private readonly chairHover = { value: 0 };
  readonly chair = {
    hintAnchor: new THREE.Vector3(),
    isPointerOver: (raycaster: THREE.Raycaster) =>
      raycaster.intersectObject(this.chairAnchor, true).length > 0,
  };
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly projectedScreen = new ProjectedScreen(COMPUTER_SCREEN);
  private isScreenReady = false;
  private isDisposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    manager: THREE.LoadingManager,
  ) {
    this.loader = new GLTFLoader(manager);
    const leftWallInnerX = -ROOM.width / 2 + COMPUTER_STATION_WALL_INSET;
    this.anchor.position.set(leftWallInnerX, 0, 2);
    this.anchor.rotation.y = Math.PI / 2;
    scene.add(this.anchor);
    this.chairAnchor.position.set(...COMPUTER_CHAIR.position);
    this.chairAnchor.rotation.y = COMPUTER_CHAIR.rotationY;
    scene.add(this.chairAnchor);

    this.loadModels();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return raycaster.intersectObjects(this.pickTargets, true).length > 0;
  }

  updateHover(active: boolean, delta: number) {
    this.projectedScreen.updateHighlight(
      this.anchor,
      active && this.isScreenReady,
      delta,
    );
  }

  updateChairHover(active: boolean, delta: number) {
    this.chairHover.value = THREE.MathUtils.damp(
      this.chairHover.value,
      active ? 1.1 : 0,
      14,
      delta,
    );
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
    this.projectedScreen.dispose();
    this.isDisposed = true;
    this.pickTargets.length = 0;
    this.isScreenReady = false;
    this.scene.remove(this.anchor);
    this.scene.remove(this.chairAnchor);
    this.chair.hintAnchor.set(0, 0, 0);
  }

  private loadModels() {
    for (const [key, x] of [
      ['keyboard', -0.18],
      ['mouse', 0.9],
    ] as const) {
      this.loader.load(ROOM_MODELS[key], (gltf) => {
        if (this.isDisposed) return;
        enableModelShadows(gltf.scene);
        gltf.scene.position.set(
          x,
          DESK_SURFACE_HEIGHT,
          0.55 + COMPUTER_DESKTOP_OFFSET_Z,
        );
        this.anchor.add(gltf.scene);
      });
    }
    this.loader.load(ROOM_MODELS.gamingChair, (gltf) => {
      if (this.isDisposed) return;
      enableModelShadows(gltf.scene);
      addHoverRim(gltf.scene, this.chairHover);
      this.chairAnchor.add(gltf.scene);
      this.chairAnchor.updateMatrixWorld(true);
      this.chair.hintAnchor.copy(
        this.chairAnchor.localToWorld(new THREE.Vector3(0, 1.8, 0)),
      );
    });

    this.loader.load(ROOM_MODELS.desk, (gltf) => {
      if (this.isDisposed) return;

      prepareModel(gltf.scene, MODEL_TARGET_WIDTH.desk);
      this.anchor.add(gltf.scene);
      this.pickTargets.push(gltf.scene);
      this.updateHintAnchor();
    });

    this.loader.load(ROOM_MODELS.computerDesk, (gltf) => {
      if (this.isDisposed) return;

      const computerDeskAnchor = new THREE.Group();
      const computerDeskModel = new THREE.Group();
      const adjustedComputerDesk = new THREE.Group();
      adjustedComputerDesk.rotation.y = COMPUTER_DESK_ROTATION_Y;
      adjustedComputerDesk.scale.y = COMPUTER_DESK_HEIGHT_SCALE;
      adjustedComputerDesk.add(gltf.scene);
      computerDeskModel.add(adjustedComputerDesk);
      prepareModel(computerDeskModel, MODEL_TARGET_WIDTH.computerDesk);
      computerDeskAnchor.position.set(
        -0.1,
        DESK_SURFACE_HEIGHT,
        -0.01 + COMPUTER_DESKTOP_OFFSET_Z,
      );
      computerDeskAnchor.add(computerDeskModel);
      this.anchor.add(computerDeskAnchor);
      this.pickTargets.push(computerDeskAnchor);
      this.updateHintAnchor();
    });

    this.loader.load(ROOM_MODELS.computer, (gltf) => {
      if (this.isDisposed) return;

      const computerAnchor = new THREE.Group();
      const computerModel = new THREE.Group();
      const correctedComputer = new THREE.Group();
      correctedComputer.rotation.y = Math.PI;
      correctedComputer.scale.set(
        1,
        COMPUTER_MODEL_HEIGHT_SCALE,
        COMPUTER_MODEL_DEPTH_SCALE,
      );
      correctedComputer.add(gltf.scene);
      computerModel.add(correctedComputer);
      prepareModel(computerModel, MODEL_TARGET_WIDTH.computer);
      // This GLB places its black display exactly on the chassis front face.
      const display = computerModel.getObjectByName('Object_6');
      if (display) {
        const depthScale = display.getWorldScale(new THREE.Vector3()).z;
        display.position.z -= 0.006 / depthScale;
      }
      softenComputerWarmHighlights(computerModel);
      computerAnchor.position.set(
        -0.1,
        COMPUTER_BASE_HEIGHT,
        -0.01 + COMPUTER_DESKTOP_OFFSET_Z,
      );
      computerAnchor.add(computerModel);
      this.anchor.add(computerAnchor);
      this.pickTargets.push(computerAnchor);

      this.anchor.updateMatrixWorld(true);
      this.isScreenReady = true;
      this.updateHintAnchor();
      this.focusPosition.copy(
        this.anchor.localToWorld(
          new THREE.Vector3(
            COMPUTER_SCREEN.centerX,
            COMPUTER_SCREEN.centerY,
            COMPUTER_SCREEN.centerZ + COMPUTER_SCREEN.focusDistance,
          ),
        ),
      );
      this.focusTarget.copy(
        this.anchor.localToWorld(
          new THREE.Vector3(
            COMPUTER_SCREEN.centerX,
            COMPUTER_SCREEN.centerY,
            COMPUTER_SCREEN.centerZ,
          ),
        ),
      );
    });
  }

  private updateHintAnchor() {
    this.anchor.updateMatrixWorld(true);
    this.hintAnchor.copy(
      this.anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN.centerX,
          COMPUTER_SCREEN.centerY,
          COMPUTER_SCREEN.centerZ,
        ),
      ),
    );
  }
}
