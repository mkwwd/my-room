import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import createDayWindowView from './DayWindowView';
import createNightWindowView from './NightWindowView';
import {
  MODEL_TARGET_WIDTH,
  ROOM,
  ROOM_DEPTH_BOUNDS,
  ROOM_MODELS,
  ROOM_WINDOW,
  WALL_THICKNESS,
} from './roomConfig';
import { createHoverFrame } from './RoomHoverEffect';
import { prepareModel } from './RoomModelUtils';

function softenWindowGlass(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    const isGlassMaterial = (material: THREE.Material) =>
      child.name.toLowerCase().includes('glass') ||
      material.transparent ||
      (material instanceof THREE.MeshPhysicalMaterial &&
        material.transmission > 0);

    if (!materials.some(isGlassMaterial)) return;

    const glassMaterials = materials.map((material) => {
      if (!isGlassMaterial(material)) return material;

      const glassMaterial = material.clone();
      glassMaterial.transparent = true;
      glassMaterial.opacity = 0.15;
      glassMaterial.depthWrite = false;

      if (glassMaterial instanceof THREE.MeshStandardMaterial) {
        glassMaterial.color.set('#d9f4ff');
        glassMaterial.roughness = 0.08;
        glassMaterial.metalness = 0.02;
        glassMaterial.envMapIntensity = 0.7;
      }

      return glassMaterial;
    });

    child.material = Array.isArray(child.material)
      ? glassMaterials
      : glassMaterials[0];
    child.castShadow = false;
  });
}

export default class RoomWindow {
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly root = new THREE.Group();
  private readonly hoverFrame = createHoverFrame(
    ROOM_WINDOW.width,
    ROOM_WINDOW.height,
  );
  private readonly loader: GLTFLoader;
  private readonly pickTargets: THREE.Object3D[] = [];
  private readonly dayView: ReturnType<typeof createDayWindowView>;
  private readonly nightView: ReturnType<typeof createNightWindowView>;
  private isDisposed = false;
  private lastTimeCheck = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly leftWall: THREE.Group,
    manager: THREE.LoadingManager,
  ) {
    this.loader = new GLTFLoader(manager);
    this.dayView = createDayWindowView(
      ROOM_WINDOW.width,
      ROOM_WINDOW.height,
      manager,
    );
    this.nightView = createNightWindowView(
      ROOM_WINDOW.width,
      ROOM_WINDOW.height,
      manager,
    );
    this.root.position.set(
      WALL_THICKNESS / 2 + 0.05,
      ROOM_WINDOW.bottomHeight - ROOM.wallHeight / 2,
      ROOM_WINDOW.centerZ - ROOM_DEPTH_BOUNDS.sideWallCenterZ,
    );
    leftWall.add(this.root);
    this.hoverFrame.rotation.y = Math.PI / 2;
    this.hoverFrame.position.set(0.22, ROOM_WINDOW.height / 2, 0);
    this.root.add(this.hoverFrame);

    this.root.add(this.dayView.root, this.nightView.root);
    this.updateAppearance();
    this.loadModel();
  }

  update(elapsedTime: number) {
    this.dayView.update(elapsedTime);
    this.nightView.update(elapsedTime);
    if (elapsedTime - this.lastTimeCheck < 30) return;
    this.lastTimeCheck = elapsedTime;
    this.updateAppearance();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return raycaster.intersectObjects(this.pickTargets, true).length > 0;
  }

  get isDaytime() {
    return this.dayView.root.visible;
  }

  updateHover(active: boolean, delta: number) {
    this.hoverFrame.material.opacity = THREE.MathUtils.damp(
      this.hoverFrame.material.opacity,
      active && this.leftWall.visible ? 0.95 : 0,
      14,
      delta,
    );
    this.hoverFrame.visible = this.hoverFrame.material.opacity > 0.001;
  }

  dispose() {
    this.hoverFrame.geometry.dispose();
    this.hoverFrame.material.dispose();
    this.isDisposed = true;
    this.pickTargets.length = 0;
    this.dayView.dispose();
    this.nightView.dispose();
    this.leftWall.remove(this.root);
  }

  private updateAppearance() {
    const hour = new Date().getHours();
    const isDaytime =
      hour >= ROOM_WINDOW.dayStartsAt && hour < ROOM_WINDOW.nightStartsAt;
    this.dayView.root.visible = isDaytime;
    this.nightView.root.visible = !isDaytime;
  }

  private loadModel() {
    this.loader.load(ROOM_MODELS.window, (gltf) => {
      if (this.isDisposed) return;

      prepareModel(gltf.scene, MODEL_TARGET_WIDTH.window);

      const preparedBounds = new THREE.Box3().setFromObject(gltf.scene);
      const preparedHeight = preparedBounds.getSize(new THREE.Vector3()).y;
      gltf.scene.scale.y *=
        ROOM_WINDOW.height / Math.max(preparedHeight, 0.001);
      gltf.scene.updateMatrixWorld(true);
      const frameBounds = new THREE.Box3().setFromObject(gltf.scene);
      const frameCenter = frameBounds.getCenter(new THREE.Vector3());
      this.hoverFrame.position.set(
        frameBounds.max.x + 0.006,
        frameCenter.y,
        frameCenter.z,
      );

      softenWindowGlass(gltf.scene);
      this.root.add(gltf.scene);
      this.pickTargets.push(gltf.scene);

      this.leftWall.updateMatrixWorld(true);
      this.hintAnchor.copy(
        this.root.localToWorld(
          new THREE.Vector3(0.2, ROOM_WINDOW.height / 2, 0),
        ),
      );
      this.focusTarget.copy(
        this.root.localToWorld(new THREE.Vector3(0, ROOM_WINDOW.height / 2, 0)),
      );
      this.focusPosition.copy(
        this.root.localToWorld(
          new THREE.Vector3(
            ROOM_WINDOW.focusDistance,
            ROOM_WINDOW.height / 2,
            0,
          ),
        ),
      );
    });
  }
}
