import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  COMPUTER_BASE_HEIGHT,
  COMPUTER_DESK_HEIGHT_SCALE,
  COMPUTER_DESK_ROTATION_Y,
  COMPUTER_SCREEN,
  COMPUTER_STATION_WALL_INSET,
  COMPUTER_SURFACE_HEIGHT,
  DESK_ROTATION_Y,
  DESK_SURFACE_HEIGHT,
  MODEL_TARGET_WIDTH,
  ROOM,
  ROOM_MODELS,
} from '../room/roomConfig';
import { prepareModel } from '../room/RoomModelUtils';

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

import type { ComputerScreenViewport } from './computerScreenTransform';

const COMPUTER_MODEL_HEIGHT_SCALE = 1;
const COMPUTER_MODEL_DEPTH_SCALE = 0.015;

export default class ComputerStation {
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly loader = new GLTFLoader();
  private readonly anchor = new THREE.Group();
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly localScreenCorners = [
    new THREE.Vector3(
      COMPUTER_SCREEN.centerX - COMPUTER_SCREEN.width / 2,
      COMPUTER_SCREEN.centerY + COMPUTER_SCREEN.height / 2,
      COMPUTER_SCREEN.centerZ,
    ),
    new THREE.Vector3(
      COMPUTER_SCREEN.centerX + COMPUTER_SCREEN.width / 2,
      COMPUTER_SCREEN.centerY + COMPUTER_SCREEN.height / 2,
      COMPUTER_SCREEN.centerZ,
    ),
    new THREE.Vector3(
      COMPUTER_SCREEN.centerX + COMPUTER_SCREEN.width / 2,
      COMPUTER_SCREEN.centerY - COMPUTER_SCREEN.height / 2,
      COMPUTER_SCREEN.centerZ,
    ),
    new THREE.Vector3(
      COMPUTER_SCREEN.centerX - COMPUTER_SCREEN.width / 2,
      COMPUTER_SCREEN.centerY - COMPUTER_SCREEN.height / 2,
      COMPUTER_SCREEN.centerZ,
    ),
  ];
  private readonly projectedScreenCorners = Array.from(
    { length: 4 },
    () => new THREE.Vector3(),
  );
  private readonly screenViewport: ComputerScreenViewport = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  };
  private readonly screenViewportPoints = [
    this.screenViewport.topLeft,
    this.screenViewport.topRight,
    this.screenViewport.bottomRight,
    this.screenViewport.bottomLeft,
  ];
  private isScreenReady = false;
  private isDisposed = false;

  constructor(private readonly scene: THREE.Scene) {
    const leftWallInnerX = -ROOM.width / 2 + COMPUTER_STATION_WALL_INSET;
    this.anchor.position.set(leftWallInnerX, 0, 2);
    this.anchor.rotation.y = Math.PI / 2;
    scene.add(this.anchor);

    this.loadModels();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return raycaster.intersectObjects(this.pickTargets, true).length > 0;
  }

  getScreenViewport(
    camera: THREE.Camera,
    viewportWidth: number,
    viewportHeight: number,
  ): ComputerScreenViewport | null {
    if (!this.isScreenReady) return null;

    this.anchor.updateMatrixWorld(true);
    camera.updateMatrixWorld();

    for (let index = 0; index < this.localScreenCorners.length; index += 1) {
      const projectedCorner = this.projectedScreenCorners[index]
        .copy(this.localScreenCorners[index])
        .applyMatrix4(this.anchor.matrixWorld)
        .project(camera);
      if (projectedCorner.z < -1 || projectedCorner.z > 1) return null;

      const viewportPoint = this.screenViewportPoints[index];
      viewportPoint.x = (projectedCorner.x * 0.5 + 0.5) * viewportWidth;
      viewportPoint.y = (-projectedCorner.y * 0.5 + 0.5) * viewportHeight;
    }

    return this.screenViewport;
  }

  dispose() {
    this.isDisposed = true;
    this.pickTargets.length = 0;
    this.isScreenReady = false;
    this.scene.remove(this.anchor);
  }

  private loadModels() {
    this.loader.load(ROOM_MODELS.desk, (gltf) => {
      if (this.isDisposed) return;

      gltf.scene.rotation.y = DESK_ROTATION_Y;
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
      computerDeskAnchor.position.set(-0.1, DESK_SURFACE_HEIGHT, -0.01);
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
      softenComputerWarmHighlights(computerModel);
      computerAnchor.position.set(-0.1, COMPUTER_BASE_HEIGHT, -0.01);
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
        new THREE.Vector3(-0.08, COMPUTER_SURFACE_HEIGHT + 1.42, -0.02),
      ),
    );
  }
}
