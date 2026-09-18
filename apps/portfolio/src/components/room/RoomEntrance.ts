import * as THREE from 'three';

import createEntranceGarden from './RoomEntranceGarden';

const smooth = (value: number) => THREE.MathUtils.smoothstep(value, 0, 1);

// A small, temporary front garden shares the room's renderer and camera. No second GLB
// or WebGL context is needed; the room stays behind the closed door until ready.
export default class RoomEntrance {
  readonly root = new THREE.Group();
  readonly cameraPosition = new THREE.Vector3();
  readonly cameraTarget = new THREE.Vector3();
  readonly catStart: THREE.Vector3;
  readonly catTarget: THREE.Vector3;
  readonly doorZ: number;
  opening = false;
  entered = false;
  complete = false;
  fov = 32;
  private time = 0;
  private disposed = false;
  private readonly hinge = new THREE.Group();
  private readonly lights = new THREE.Group();
  private readonly fill = new THREE.HemisphereLight('#f4f7f2', '#717c73', 2.2);
  private readonly key = new THREE.DirectionalLight('#fff6e9', 2);
  private readonly path: THREE.CubicBezierCurve3;
  private readonly settlePath: THREE.CubicBezierCurve3;
  private readonly insideTarget: THREE.Vector3;
  private readonly startTarget: THREE.Vector3;
  private readonly endTarget = new THREE.Vector3(0, 3, -0.5);
  private readonly shadowTexture: THREE.DataTexture;
  private readonly shadow: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  >;

  constructor(
    private readonly destination: THREE.Vector3,
    aspect: number,
    roomFront: number,
  ) {
    this.destination = destination.clone();
    this.doorZ = roomFront;
    this.catStart = new THREE.Vector3(-2.6, 0, this.doorZ + 3.5);
    this.catTarget = new THREE.Vector3(-0.45, 0, this.doorZ + 0.9);
    this.startTarget = new THREE.Vector3(0, 2.35, this.doorZ);
    this.cameraTarget.copy(this.startTarget);
    this.cameraPosition.set(0, 2.35, this.doorZ + Math.max(15, 12.6 / aspect));
    const threshold = new THREE.Vector3(0, 2.35, this.doorZ - 1.2);
    this.insideTarget = new THREE.Vector3(0, 2.35, this.doorZ - 6);
    this.path = new THREE.CubicBezierCurve3(
      this.cameraPosition.clone(),
      new THREE.Vector3(0, 2.35, this.doorZ + 9),
      new THREE.Vector3(0, 2.35, this.doorZ + 1),
      threshold,
    );
    this.settlePath = new THREE.CubicBezierCurve3(
      threshold,
      new THREE.Vector3(0, 5, this.doorZ - 2),
      destination.clone(),
      destination.clone(),
    );
    const plaster = new THREE.MeshStandardMaterial({
      color: '#dceaf0',
      roughness: 0.95,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: '#f2f0e9',
      roughness: 0.72,
    });
    const paint = new THREE.MeshStandardMaterial({
      color: '#8da69a',
      roughness: 0.68,
    });
    const recess = new THREE.MeshStandardMaterial({
      color: '#6c897c',
      roughness: 0.82,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: '#c5ae77',
      metalness: 0.65,
      roughness: 0.3,
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
    // The wall is genuinely open between the jambs, so the real room is visible
    // through it as soon as the door swings inward.
    for (const side of [-1, 1]) {
      box(this.root, [30, 24, 0.35], [side * 16.6, 12, this.doorZ], plaster);
      box(
        this.root,
        [0.16, 4.7, 0.45],
        [side * 1.65, 2.35, this.doorZ + 0.04],
        trim,
      );
      box(
        this.root,
        [30, 0.18, 0.08],
        [side * 16.6, 0.09, this.doorZ + 0.22],
        trim,
      );
    }
    box(this.root, [3.2, 20, 0.35], [0, 14.6, this.doorZ], plaster);
    box(this.root, [3.45, 0.17, 0.46], [0, 4.64, this.doorZ + 0.04], trim);
    box(this.root, [3.25, 0.055, 0.5], [0, 0.02, this.doorZ], metal);
    this.root.add(createEntranceGarden(this.doorZ));
    this.hinge.position.set(-1.6, 0, this.doorZ);
    this.root.add(this.hinge);
    box(this.hinge, [3.18, 4.55, 0.15], [1.6, 2.3, 0], paint);
    for (const [y, height] of [
      [1.18, 1.75],
      [3.28, 1.85],
    ]) {
      box(this.hinge, [2.76, height, 0.035], [1.6, y, 0.09], recess);
      box(this.hinge, [2.6, height - 0.16, 0.04], [1.6, y, 0.112], paint);
    }
    box(this.hinge, [0.13, 0.35, 0.075], [2.87, 2.1, 0.14], metal);
    box(this.hinge, [0.4, 0.075, 0.09], [2.73, 2.16, 0.2], metal);
    this.key.position.set(-3, 7, this.doorZ + 5);
    this.key.target.position.set(0, 1, this.doorZ);
    this.lights.add(this.fill, this.key, this.key.target);
    this.root.add(this.lights);

    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
        const index = (y * 32 + x) * 4;
        pixels[index + 3] = Math.round(
          100 * Math.pow(Math.max(0, 1 - radius), 2),
        );
      }
    this.shadowTexture = new THREE.DataTexture(pixels, 32, 32);
    this.shadowTexture.needsUpdate = true;
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.05),
      new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.shadow);
    this.shadow.visible = false;
  }

  update(
    delta: number,
    ready: boolean,
    catPosition: THREE.Vector3 | null,
    reducedMotion: boolean,
  ) {
    if (this.complete) return;
    if (ready && reducedMotion) {
      this.cameraPosition.copy(this.destination);
      this.cameraTarget.copy(this.endTarget);
      this.fov = 32;
      this.complete = true;
      return;
    }
    if (
      !this.opening &&
      ready &&
      catPosition &&
      catPosition.distanceTo(this.catTarget) < 0.4
    )
      this.opening = true;
    if (!this.opening) return;
    this.time += delta;
    this.hinge.rotation.y = smooth(this.time / 1.05) * Math.PI * 0.53;
    if (this.time > 0.85) this.catTarget.set(0.65, 0, this.doorZ - 8);
    const approach = smooth((this.time - 0.9) / 2.4);
    this.path.getPoint(approach, this.cameraPosition);
    this.cameraTarget.lerpVectors(
      this.startTarget,
      this.insideTarget,
      approach,
    );
    if (approach >= 1) {
      // The temporary facade is now entirely behind the camera. Remove it
      // before lifting back into the normal cutaway view of the actual room.
      this.entered = true;
      this.root.visible = false;
      const settle = smooth((this.time - 3.3) / 2.6);
      this.settlePath.getPoint(settle, this.cameraPosition);
      this.cameraTarget.lerpVectors(this.insideTarget, this.endTarget, settle);
      if (settle >= 1) this.complete = true;
    }
    const foyerLight = 1 - smooth(this.time / 0.8);
    this.fill.intensity = 2.2 * foyerLight;
    this.key.intensity = 2 * foyerLight;
  }

  updateCatShadow(cat: THREE.Object3D) {
    this.shadow.visible = cat.children.length > 0;
    this.shadow.position.set(
      cat.position.x + 0.08,
      0.006,
      cat.position.z + 0.04,
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      if (object instanceof THREE.InstancedMesh) object.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        const map = (material as THREE.MeshStandardMaterial).map;
        if (map) textures.add(map);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }
}
