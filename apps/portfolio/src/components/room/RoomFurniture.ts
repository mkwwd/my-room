import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MODEL_TARGET_WIDTH, ROOM_MODELS } from './roomConfig';
import { prepareModel } from './RoomModelUtils';

const LIVING_ROOM = {
  carpetPosition: new THREE.Vector3(0, 0.025, -5.35),
  sofaPosition: new THREE.Vector3(0, 0.03, -3.95),
  miniTablePosition: new THREE.Vector3(0, 0.03, -5.45),
  vaseOffset: new THREE.Vector3(0.08, 0.02, -0.02),
  sofaRotationY: Math.PI,
  miniTableRotationY: 0,
} as const;

export default class RoomFurniture {
  private readonly root = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private isDisposed = false;

  constructor(private readonly parent: THREE.Object3D) {
    parent.add(this.root);

    this.loadCarpet();
    this.loadSofa();
    this.loadMiniTableWithVase();
  }

  dispose() {
    this.isDisposed = true;
    this.parent.remove(this.root);
  }

  private loadPlacedModel({
    path,
    targetWidth,
    position,
    rotationY = 0,
    onReady,
  }: {
    path: string;
    targetWidth: number;
    position: THREE.Vector3;
    rotationY?: number;
    onReady?: (model: THREE.Object3D) => void;
  }) {
    this.loader.load(path, (gltf) => {
      if (this.isDisposed) return;

      gltf.scene.rotation.y = rotationY;
      prepareModel(gltf.scene, targetWidth);
      gltf.scene.position.copy(position);
      this.root.add(gltf.scene);
      onReady?.(gltf.scene);
    });
  }

  private loadCarpet() {
    this.loadPlacedModel({
      path: ROOM_MODELS.carpet,
      targetWidth: MODEL_TARGET_WIDTH.carpet,
      position: LIVING_ROOM.carpetPosition,
    });
  }

  private loadSofa() {
    this.loadPlacedModel({
      path: ROOM_MODELS.pinkSofa,
      targetWidth: MODEL_TARGET_WIDTH.pinkSofa,
      position: LIVING_ROOM.sofaPosition,
      rotationY: LIVING_ROOM.sofaRotationY,
    });
  }

  private loadMiniTableWithVase() {
    this.loadPlacedModel({
      path: ROOM_MODELS.miniTable,
      targetWidth: MODEL_TARGET_WIDTH.miniTable,
      position: LIVING_ROOM.miniTablePosition,
      rotationY: LIVING_ROOM.miniTableRotationY,
      onReady: (miniTable) => {
        const tableBounds = new THREE.Box3().setFromObject(miniTable);
        const tableTopY = tableBounds.max.y;

        this.loadPlacedModel({
          path: ROOM_MODELS.vase,
          targetWidth: MODEL_TARGET_WIDTH.vase,
          position: new THREE.Vector3(
            LIVING_ROOM.miniTablePosition.x + LIVING_ROOM.vaseOffset.x,
            tableTopY + LIVING_ROOM.vaseOffset.y,
            LIVING_ROOM.miniTablePosition.z + LIVING_ROOM.vaseOffset.z,
          ),
        });
      },
    });
  }
}
