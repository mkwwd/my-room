import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

import {
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

import { DESKTOP_UI_HEIGHT, DESKTOP_UI_WIDTH } from './desktopConfig';

const COMPUTER_MODEL_DEPTH_SCALE = 0.12;
const COMPUTER_MODEL_HEIGHT_SCALE = 0.065;

export default class ComputerStation {
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly loader = new GLTFLoader();
  private readonly anchor = new THREE.Group();
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly screen: CSS3DObject;
  private readonly screenNormal = new THREE.Vector3();
  private readonly screenToCamera = new THREE.Vector3();
  private isDisposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly cssScene: THREE.Scene,
    desktopHost: HTMLDivElement,
  ) {
    const leftWallInnerX = -ROOM.width / 2 + COMPUTER_STATION_WALL_INSET;
    this.anchor.position.set(leftWallInnerX, 0, 2);
    this.anchor.rotation.y = Math.PI / 2;
    scene.add(this.anchor);

    this.screen = new CSS3DObject(desktopHost);
    this.screen.visible = false;
    this.screen.element.style.pointerEvents = 'none';
    cssScene.add(this.screen);

    this.loadModels();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return raycaster.intersectObjects(this.pickTargets, true).length > 0;
  }

  update(camera: THREE.Camera) {
    if (!this.screen.userData.isReady) return;

    this.screenNormal.set(0, 0, 1).applyQuaternion(this.screen.quaternion);
    this.screenToCamera
      .copy(camera.position)
      .sub(this.screen.position)
      .normalize();
    this.screen.visible = this.screenNormal.dot(this.screenToCamera) > 0.02;
  }

  dispose() {
    this.isDisposed = true;
    this.pickTargets.length = 0;
    this.screen.userData.isReady = false;
    this.screen.visible = false;
    this.scene.remove(this.anchor);
    this.cssScene.remove(this.screen);
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
      gltf.scene.rotation.y = COMPUTER_DESK_ROTATION_Y;
      prepareModel(gltf.scene, MODEL_TARGET_WIDTH.computerDesk);
      gltf.scene.scale.y *= COMPUTER_DESK_HEIGHT_SCALE;
      computerDeskAnchor.position.set(-0.1, DESK_SURFACE_HEIGHT, -0.01);
      computerDeskAnchor.add(gltf.scene);
      this.anchor.add(computerDeskAnchor);
      this.pickTargets.push(computerDeskAnchor);
      this.updateHintAnchor();
    });

    this.loader.load(ROOM_MODELS.computer, (gltf) => {
      if (this.isDisposed) return;

      const computerAnchor = new THREE.Group();
      const computerModel = new THREE.Group();
      const correctedComputer = new THREE.Group();
      correctedComputer.rotation.x = -Math.PI / 2;
      correctedComputer.scale.set(
        1,
        COMPUTER_MODEL_DEPTH_SCALE,
        COMPUTER_MODEL_HEIGHT_SCALE,
      );
      correctedComputer.add(gltf.scene);
      computerModel.add(correctedComputer);
      prepareModel(computerModel, MODEL_TARGET_WIDTH.computer);
      computerAnchor.position.set(-0.1, COMPUTER_SURFACE_HEIGHT, -0.01);
      computerAnchor.add(computerModel);
      this.anchor.add(computerAnchor);
      this.pickTargets.push(computerAnchor);

      this.anchor.updateMatrixWorld(true);
      this.updateScreenTransform();
      this.updateHintAnchor();
      this.focusPosition.copy(
        this.anchor.localToWorld(
          new THREE.Vector3(
            COMPUTER_SCREEN.centerX,
            COMPUTER_SCREEN.centerY,
            1.15,
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

  private updateScreenTransform() {
    this.screen.position.copy(
      this.anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN.centerX,
          COMPUTER_SCREEN.centerY,
          COMPUTER_SCREEN.centerZ,
        ),
      ),
    );
    this.anchor.getWorldQuaternion(this.screen.quaternion);
    this.screen.scale.set(
      COMPUTER_SCREEN.width / DESKTOP_UI_WIDTH,
      COMPUTER_SCREEN.height / DESKTOP_UI_HEIGHT,
      1,
    );
    this.screen.userData.isReady = true;
    this.screen.visible = true;
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
