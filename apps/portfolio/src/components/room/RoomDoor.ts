import * as THREE from 'three';

import { ROOM, WALL_THICKNESS } from './roomConfig';
import { createHoverFrame } from './RoomHoverEffect';

export default class RoomDoor {
  readonly hintAnchor = new THREE.Vector3();
  private readonly root = new THREE.Group();
  private readonly switchRoot = new THREE.Group();
  private readonly rocker = new THREE.Group();
  private readonly indicator = new THREE.MeshBasicMaterial({
    color: '#97e3b8',
    toneMapped: false,
  });
  private readonly highlight = createHoverFrame(0.42, 0.62);
  private readonly pickTargets: THREE.Object3D[] = [];

  constructor(private readonly wall: THREE.Object3D) {
    this.root.position.set(
      0,
      -ROOM.wallHeight / 2,
      -WALL_THICKNESS / 2 - 0.025,
    );
    this.root.rotation.y = Math.PI;
    wall.add(this.root);
    const trim = new THREE.MeshStandardMaterial({
      color: '#f5f3ed',
      roughness: 0.72,
    });
    const paint = new THREE.MeshStandardMaterial({
      color: '#c9d3ca',
      roughness: 0.8,
    });
    const recess = new THREE.MeshStandardMaterial({
      color: '#aebcb1',
      roughness: 0.87,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: '#adb2b3',
      metalness: 0.72,
      roughness: 0.32,
    });
    const box = (
      parent: THREE.Object3D,
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    box(this.root, [2.25, 4.1, 0.09], [0, 2.1, 0.05], paint);
    for (const x of [-1.22, 1.22])
      box(this.root, [0.17, 4.35, 0.16], [x, 2.175, 0.08], trim);
    box(this.root, [2.6, 0.17, 0.16], [0, 4.35, 0.08], trim);
    for (const [y, height] of [
      [1.05, 1.35],
      [2.93, 1.85],
    ]) {
      box(this.root, [1.86, height, 0.025], [0, y, 0.108], recess);
      box(this.root, [1.73, height - 0.13, 0.028], [0, y, 0.123], paint);
    }
    box(this.root, [0.11, 0.34, 0.065], [0.85, 1.97, 0.14], metal);
    box(this.root, [0.31, 0.065, 0.07], [0.73, 2.04, 0.2], metal);
    box(this.root, [2.38, 0.045, 0.24], [0, 0.035, 0.11], metal);

    this.switchRoot.position.set(1.72, 2.05, 0.04);
    this.root.add(this.switchRoot);
    this.pickTargets.push(
      box(this.switchRoot, [0.42, 0.62, 0.065], [0, 0, 0], trim),
    );
    this.rocker.position.z = 0.055;
    this.switchRoot.add(this.rocker);
    this.pickTargets.push(
      box(this.rocker, [0.29, 0.43, 0.04], [0, 0, 0], trim),
    );
    box(this.rocker, [0.07, 0.018, 0.005], [0, -0.13, 0.023], this.indicator);
    this.highlight.position.z = 0.039;
    this.switchRoot.add(this.highlight);
    this.root.updateWorldMatrix(true, true);
    this.switchRoot.getWorldPosition(this.hintAnchor);
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return (
      this.wall.visible &&
      raycaster.intersectObjects(this.pickTargets, false).length > 0
    );
  }

  update(isOn: boolean, hovered: boolean, delta: number) {
    this.rocker.rotation.x = THREE.MathUtils.damp(
      this.rocker.rotation.x,
      isOn ? -0.12 : 0.12,
      16,
      delta,
    );
    this.indicator.color.set(isOn ? '#97e3b8' : '#c2b9a6');
    this.highlight.material.opacity = THREE.MathUtils.damp(
      this.highlight.material.opacity,
      hovered ? 0.95 : 0,
      14,
      delta,
    );
    this.highlight.visible = this.highlight.material.opacity > 0.001;
  }

  dispose() {
    this.root.removeFromParent();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    });
    materials.forEach((material) => material.dispose());
  }
}
