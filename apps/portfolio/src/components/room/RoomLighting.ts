import * as THREE from 'three';

import { ROOM, ROOM_WINDOW } from './roomConfig';

function makeWindowLightTexture() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / 7;
      const alpha = THREE.MathUtils.smoothstep(edge, 0, 1);
      pixels.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeWindowPatch(
  material: THREE.Material,
  slopeX: number,
  slopeZ: number,
) {
  const vertices: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const gap = 0.09;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const bottom =
        ROOM_WINDOW.bottomHeight + (row * ROOM_WINDOW.height) / 2 + gap;
      const top = bottom + ROOM_WINDOW.height / 2 - gap * 2;
      const left =
        ROOM_WINDOW.centerZ -
        ROOM_WINDOW.width / 2 +
        (col * ROOM_WINDOW.width) / 2 +
        gap;
      const right = left + ROOM_WINDOW.width / 2 - gap * 2;
      const start = vertices.length / 3;
      for (const [height, z] of [
        [bottom, left],
        [top, left],
        [top, right],
        [bottom, right],
      ]) {
        vertices.push(
          -ROOM.width / 2 + height * slopeX,
          0.016,
          z + height * slopeZ,
        );
      }
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, material);
}

export default class RoomLighting {
  readonly root = new THREE.Group();
  readonly windowLight = new THREE.SpotLight(
    '#ffe6b7',
    38,
    15,
    Math.PI / 3,
    0.8,
    2,
  );
  isOn = true;
  indoorLevel = 1;

  private readonly hemisphere = new THREE.HemisphereLight('#ffffff', '#b9a89c');
  private readonly ambient = new THREE.AmbientLight('#d8e5ff');
  private readonly ceiling = new THREE.DirectionalLight('#fff4df');
  private readonly lamp = new THREE.PointLight('#ffd59a', 1.35, 10);
  private readonly windowFill = new THREE.DirectionalLight('#ffe6b7');
  private readonly patchTexture = makeWindowLightTexture();
  private readonly dayMaterial = new THREE.MeshBasicMaterial({
    map: this.patchTexture,
    color: '#ffe3a8',
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  private readonly nightMaterial = new THREE.MeshBasicMaterial({
    map: this.patchTexture,
    color: '#91b9ef',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  private readonly dayPatch = makeWindowPatch(this.dayMaterial, 1.02, 0.22);
  private readonly nightPatch = makeWindowPatch(
    this.nightMaterial,
    0.72,
    -0.12,
  );

  constructor(parent: THREE.Object3D) {
    parent.add(this.root);
    this.ceiling.position.set(-3, 8, 4);
    this.lamp.position.set(-2.8, 2.5, 1.4);
    this.windowLight.position.set(
      -ROOM.width / 2 + 0.3,
      4.3,
      ROOM_WINDOW.centerZ,
    );
    this.windowLight.target.position.set(-1.4, 0, ROOM_WINDOW.centerZ + 0.7);
    this.windowFill.position.copy(this.windowLight.position);
    this.windowFill.target.position.copy(this.windowLight.target.position);
    this.root.add(
      this.hemisphere,
      this.ambient,
      this.ceiling,
      this.lamp,
      this.windowLight,
      this.windowLight.target,
      this.windowFill,
      this.windowFill.target,
      this.dayPatch,
      this.nightPatch,
    );
  }

  toggle() {
    this.isOn = !this.isOn;
    return this.isOn;
  }

  update(delta: number, isDaytime: boolean) {
    this.indoorLevel = THREE.MathUtils.damp(
      this.indoorLevel,
      this.isOn ? 1 : 0,
      10,
      delta,
    );
    this.hemisphere.intensity =
      (isDaytime ? 0.42 : 0.11) + 1.05 * this.indoorLevel;
    this.ambient.intensity =
      (isDaytime ? 0.08 : 0.025) + 0.2 * this.indoorLevel;
    this.ceiling.intensity = 0.95 * this.indoorLevel;
    this.lamp.intensity = 1.35 * this.indoorLevel;
    this.windowLight.color.set(isDaytime ? '#ffe6b7' : '#9dbff4');
    this.windowLight.intensity = isDaytime ? 38 : 9;
    this.windowFill.color.copy(this.windowLight.color);
    this.windowFill.intensity = isDaytime ? 0.5 : 0.16;
    this.dayPatch.visible = isDaytime;
    this.nightPatch.visible = !isDaytime;
  }

  dispose() {
    this.root.removeFromParent();
    this.dayPatch.geometry.dispose();
    this.nightPatch.geometry.dispose();
    this.dayMaterial.dispose();
    this.nightMaterial.dispose();
    this.patchTexture.dispose();
  }
}
