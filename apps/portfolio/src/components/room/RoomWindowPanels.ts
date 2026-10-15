import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { WALL_THICKNESS } from './roomConfig';

function mergeParts(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return geometry;
}

function frameGeometry(
  width: number,
  height: number,
  rail: number,
  depth: number,
  divided = false,
) {
  const outline = new THREE.Shape();
  outline.moveTo(-width / 2, -height / 2);
  outline.lineTo(width / 2, -height / 2);
  outline.lineTo(width / 2, height / 2);
  outline.lineTo(-width / 2, height / 2);
  outline.closePath();
  const innerX = width / 2 - rail;
  const innerY = height / 2 - rail;
  for (const [bottom, top] of divided
    ? [
        [-innerY, -0.02],
        [0.02, innerY],
      ]
    : [[-innerY, innerY]]) {
    const opening = new THREE.Path();
    opening.moveTo(-innerX, bottom);
    opening.lineTo(-innerX, top);
    opening.lineTo(innerX, top);
    opening.lineTo(innerX, bottom);
    opening.closePath();
    outline.holes.push(opening);
  }
  const bevel = Math.min(0.012, rail * 0.16);
  return new THREE.ExtrudeGeometry(outline, {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
  }).translate(0, 0, -depth / 2);
}

export default class RoomWindowPanels {
  readonly root = new THREE.Group();
  private readonly left = new THREE.Group();
  private readonly right = new THREE.Group();
  private readonly frameMaterial = new THREE.MeshStandardMaterial({
    color: '#fffefa',
    roughness: 0.46,
    emissive: '#fffdf5',
    emissiveIntensity: 0.32,
  });
  private readonly handleMaterial = new THREE.MeshStandardMaterial({
    color: '#d2af6c',
    roughness: 0.3,
    metalness: 0.65,
    emissive: '#ffe4a4',
    emissiveIntensity: 0,
  });
  private open = false;
  private disposed = false;

  constructor(width: number, height: number) {
    const casingRail = 0.11;
    const leafRail = 0.065;
    const innerWidth = width - casingRail * 2;
    const leafWidth = (innerWidth - 0.024) / 2;
    const leafHeight = height - casingRail * 2;
    const revealDepth = WALL_THICKNESS + 0.18;
    const { frameMaterial, handleMaterial } = this;
    const casing = new THREE.Mesh(
      mergeParts([
        frameGeometry(width + 0.24, height + 0.16, 0.17, 0.075).translate(
          0,
          0,
          -0.035,
        ),
        frameGeometry(width, height, casingRail, revealDepth).translate(
          0,
          0,
          0.085 - revealDepth / 2,
        ),
        frameGeometry(width + 0.09, height + 0.09, 0.035, 0.025).translate(
          0,
          0,
          0.105,
        ),
      ]),
      frameMaterial,
    );
    casing.position.y = height / 2;
    this.root.add(casing);

    const sill = new THREE.Mesh(
      mergeParts([
        new RoundedBoxGeometry(width + 0.42, 0.14, 0.42, 2, 0.024).translate(
          0,
          -0.055,
          0.08,
        ),
        new RoundedBoxGeometry(width + 0.14, 0.12, 0.09, 2, 0.016).translate(
          0,
          -0.16,
          0.02,
        ),
      ]),
      frameMaterial,
    );
    this.root.add(sill);

    const leafGeometry = frameGeometry(
      leafWidth,
      leafHeight,
      leafRail,
      0.075,
      true,
    );
    const glassGeometry = new THREE.PlaneGeometry(
      leafWidth - leafRail * 2,
      leafHeight - leafRail * 2,
    );
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: '#e4f5fb',
      transparent: true,
      opacity: 0.07,
      roughness: 0.14,
      metalness: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const handleGeometry = mergeParts([
      new RoundedBoxGeometry(0.078, 0.24, 0.022, 2, 0.01),
      new RoundedBoxGeometry(0.035, 0.045, 0.07, 2, 0.01).translate(
        0,
        0.025,
        0.037,
      ),
      new RoundedBoxGeometry(0.038, 0.145, 0.042, 2, 0.014).translate(
        0,
        -0.04,
        0.075,
      ),
    ]);
    const hingeGeometry = mergeParts(
      [-1, 1].map((side) =>
        new THREE.CylinderGeometry(0.018, 0.018, 0.15, 12).translate(
          0,
          side * leafHeight * 0.32,
          0.06,
        ),
      ),
    );

    for (const [hinge, direction, name] of [
      [this.left, 1, 'window-leaf-left'],
      [this.right, -1, 'window-leaf-right'],
    ] as const) {
      hinge.name = name;
      // Exterior hinges let the leaves fold back without passing through the wall.
      hinge.position.set(
        (-direction * innerWidth) / 2,
        height / 2,
        -WALL_THICKNESS - 0.11,
      );
      const frame = new THREE.Mesh(leafGeometry, frameMaterial);
      frame.position.x = (direction * leafWidth) / 2;
      const glass = new THREE.Mesh(glassGeometry, glassMaterial);
      glass.position.set(frame.position.x, 0, 0.018);
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.position.set(direction * (leafWidth - leafRail / 2), -0.22, 0.045);
      const hinges = new THREE.Mesh(hingeGeometry, handleMaterial);
      hinge.add(frame, glass, handle, hinges);
      this.root.add(hinge);
    }

    // Keep the empty aperture clickable after the leaves swing out of it.
    const hitArea = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    hitArea.position.set(0, height / 2, 0.015);
    this.root.add(hitArea);
  }

  get isOpen() {
    return this.open;
  }

  toggle() {
    if (!this.disposed) this.open = !this.open;
    return this.open;
  }

  update(delta: number) {
    if (this.disposed) return;
    const target = this.open ? THREE.MathUtils.degToRad(170) : 0;
    const angle = THREE.MathUtils.damp(this.left.rotation.y, target, 3, delta);
    this.left.rotation.y =
      delta >= 1 || Math.abs(angle - target) < 0.0001 ? target : angle;
    this.right.rotation.y = -this.left.rotation.y;
  }

  updateHover(active: boolean, delta: number) {
    if (this.disposed) return;
    this.frameMaterial.emissiveIntensity = THREE.MathUtils.damp(
      this.frameMaterial.emissiveIntensity,
      active ? 0.5 : 0.32,
      10,
      delta,
    );
    this.handleMaterial.emissiveIntensity = THREE.MathUtils.damp(
      this.handleMaterial.emissiveIntensity,
      active ? 0.3 : 0,
      10,
      delta,
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.root.removeFromParent();
  }
}
