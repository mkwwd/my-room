import * as THREE from 'three';

import { ROOM_FLOOR_LAMP } from './roomConfig';
import { addHoverRim } from './RoomHoverEffect';

export type FloorLampMode = 'warm' | 'peach' | 'off';

const LIGHT_COLORS = {
  warm: new THREE.Color('#ffe4b8'),
  peach: new THREE.Color('#ffb6bd'),
};
const LIGHT_INTENSITY = 3.2;

function makePaperTexture() {
  const width = 256;
  const height = 64;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 83;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const fold = 0.5 + 0.5 * Math.cos((x / width) * Math.PI * 48);
      const value = Math.round(218 + 34 * fold + (seed / 0xffffffff - 0.5) * 3);
      pixels.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeShadeGeometry() {
  const profile = [];
  for (let i = 0; i <= 96; i++) {
    const phase = (i % 24) / 24;
    const radius = 0.11 + 0.345 * Math.sin(phase * Math.PI) ** 1.4;
    profile.push(new THREE.Vector2(radius, 0.16 + (i / 96) * 4.12));
  }
  const geometry = new THREE.LatheGeometry(profile, 96);
  const vertices = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  // Shallow radial pleats keep their depth even when the paper is illuminated.
  for (let i = 0; i < vertices.count; i++) {
    const fold = 1 + 0.027 * Math.cos(uv.getX(i) * Math.PI * 48);
    vertices.setXYZ(
      i,
      vertices.getX(i) * fold,
      vertices.getY(i),
      vertices.getZ(i) * fold,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

export default class RoomFloorLamp {
  readonly hintAnchor = new THREE.Vector3(...ROOM_FLOOR_LAMP.position).add(
    new THREE.Vector3(0, 2.25 * ROOM_FLOOR_LAMP.scale, 0),
  );

  private readonly root = new THREE.Group();
  private readonly paperTexture = makePaperTexture();
  private readonly shadeMaterial = new THREE.MeshStandardMaterial({
    color: '#fffdf8',
    map: this.paperTexture,
    emissiveMap: this.paperTexture,
    emissive: LIGHT_COLORS.warm,
    emissiveIntensity: 0.65,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  private readonly light = new THREE.PointLight(
    LIGHT_COLORS.warm,
    LIGHT_INTENSITY,
    4.7,
    2,
  );
  private readonly hoverStrength = { value: 0 };
  private readonly pickBox = new THREE.Box3();
  private currentMode: FloorLampMode = 'warm';
  private disposed = false;

  constructor(parent: THREE.Object3D) {
    this.root.name = 'floor-lamp';
    this.root.position.set(...ROOM_FLOOR_LAMP.position);
    this.root.scale.setScalar(ROOM_FLOOR_LAMP.scale);
    parent.add(this.root);

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: '#f5f2eb',
      roughness: 0.42,
      metalness: 0.18,
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.27, 0.07, 40),
      baseMaterial,
    );
    base.position.y = 0.035;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.13, 16),
      baseMaterial,
    );
    stem.position.y = 0.12;
    const shade = new THREE.Mesh(makeShadeGeometry(), this.shadeMaterial);
    shade.name = 'lamp-shade';
    const capGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.016, 32);
    for (const y of [0.16, 4.28]) {
      const cap = new THREE.Mesh(capGeometry, baseMaterial);
      cap.position.y = y;
      this.root.add(cap);
    }
    this.light.name = 'lamp-light';
    this.light.position.y = 2.15;
    this.root.add(base, stem, shade, this.light);
    addHoverRim(this.root, this.hoverStrength);
    this.pickBox.setFromCenterAndSize(
      new THREE.Vector3(...ROOM_FLOOR_LAMP.position).add(
        new THREE.Vector3(0, 2.15 * ROOM_FLOOR_LAMP.scale, 0),
      ),
      new THREE.Vector3(0.96, 4.3, 0.96).multiplyScalar(ROOM_FLOOR_LAMP.scale),
    );
  }

  get mode() {
    return this.currentMode;
  }

  cycle() {
    if (!this.disposed)
      this.currentMode =
        this.currentMode === 'warm'
          ? 'peach'
          : this.currentMode === 'peach'
            ? 'off'
            : 'warm';
    return this.currentMode;
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return (
      !this.disposed &&
      this.root.visible &&
      raycaster.ray.intersectsBox(this.pickBox)
    );
  }

  update(delta: number, hovered: boolean) {
    if (this.disposed) return;
    const lit = this.currentMode !== 'off';
    if (this.currentMode !== 'off')
      this.light.color.lerp(
        LIGHT_COLORS[this.currentMode],
        1 - Math.exp(-12 * delta),
      );
    this.light.intensity = THREE.MathUtils.damp(
      this.light.intensity,
      lit ? LIGHT_INTENSITY : 0,
      12,
      delta,
    );
    this.shadeMaterial.emissive.copy(this.light.color);
    this.shadeMaterial.emissiveIntensity =
      (this.light.intensity / LIGHT_INTENSITY) * 0.65;
    if (!lit && this.light.intensity < 0.001) {
      this.light.intensity = 0;
      this.shadeMaterial.emissiveIntensity = 0;
    }
    this.hoverStrength.value = THREE.MathUtils.damp(
      this.hoverStrength.value,
      hovered ? 0.7 : 0,
      14,
      delta,
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.light.intensity = 0;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.paperTexture.dispose();
    this.light.dispose();
    this.root.removeFromParent();
  }
}
