import * as THREE from 'three';

import { ROOM, WALL_THICKNESS } from './roomConfig';

function makeHand(
  name: string,
  length: number,
  width: number,
  z: number,
  material: THREE.Material,
  tail = 0.035,
) {
  const outline = new THREE.Shape();
  outline.moveTo(-width / 2, -tail);
  outline.lineTo(width / 2, -tail);
  outline.lineTo(width * 0.3, length - 0.025);
  outline.lineTo(0, length);
  outline.lineTo(-width * 0.3, length - 0.025);
  outline.closePath();
  const hand = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outline, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSize: Math.min(0.002, width / 5),
      bevelThickness: 0.003,
      bevelSegments: 1,
      steps: 1,
    }),
    material,
  );
  hand.name = name;
  hand.position.z = z;
  return hand;
}

export default class RoomWallClock {
  private readonly root = new THREE.Group();
  private readonly hourHand: THREE.Mesh;
  private readonly minuteHand: THREE.Mesh;
  private readonly secondHand: THREE.Mesh;
  private readonly dialMaterial = new THREE.MeshStandardMaterial({
    color: '#fffdf8',
    metalness: 0.02,
    roughness: 0.42,
    emissive: '#fff8ed',
    emissiveIntensity: 0.34,
  });
  private disposed = false;

  constructor(wall: THREE.Object3D) {
    this.root.name = 'wall-clock';
    this.root.position.set(
      4.2,
      4.6 - ROOM.wallHeight / 2,
      WALL_THICKNESS / 2 + 0.015,
    );
    wall.add(this.root);

    const champagne = new THREE.MeshStandardMaterial({
      color: '#ecd4a5',
      metalness: 0.36,
      roughness: 0.28,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: '#ab8543',
      metalness: 0.36,
      roughness: 0.3,
    });
    const ink = new THREE.MeshStandardMaterial({
      color: '#8c7960',
      metalness: 0.2,
      roughness: 0.4,
    });

    const profile = [
      [0.8, 0],
      [0.836, 0],
      [0.85, 0.02],
      [0.85, 0.085],
      [0.843, 0.11],
      [0.818, 0.11],
      [0.811, 0.096],
      [0.811, 0.055],
    ].map(([radius, depth]) => new THREE.Vector2(radius, depth));
    const caseGeometry = new THREE.LatheGeometry(profile, 96);
    caseGeometry.rotateX(Math.PI / 2);
    const casing = new THREE.Mesh(caseGeometry, champagne);
    casing.name = 'clock-case';
    this.root.add(casing);

    const dialGeometry = new THREE.CylinderGeometry(0.817, 0.817, 0.04, 96);
    dialGeometry.rotateX(Math.PI / 2);
    const dial = new THREE.Mesh(dialGeometry, this.dialMaterial);
    dial.name = 'clock-dial';
    dial.position.z = 0.07;
    this.root.add(dial);

    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.783, 0.0035, 6, 96),
      champagne,
    );
    innerRim.position.z = 0.096;
    this.root.add(innerRim);

    const hourMarks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.025, 0.095, 0.019),
      gold,
      12,
    );
    const marker = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      marker.position.set(
        Math.sin(angle) * 0.665,
        Math.cos(angle) * 0.665,
        0.104,
      );
      marker.rotation.z = -angle;
      marker.scale.set(i % 3 === 0 ? 1.15 : 0.8, i % 3 === 0 ? 1.3 : 1, 1);
      marker.updateMatrix();
      hourMarks.setMatrixAt(i, marker.matrix);
    }
    this.root.add(hourMarks);

    this.hourHand = makeHand('hour-hand', 0.395, 0.033, 0.128, gold);
    this.minuteHand = makeHand('minute-hand', 0.565, 0.021, 0.15, gold);
    this.secondHand = makeHand('second-hand', 0.61, 0.006, 0.173, ink, 0.1);
    this.root.add(this.hourHand, this.minuteHand, this.secondHand);
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.031, 16, 8),
      champagne,
    );
    pin.scale.z = 0.4;
    pin.position.z = 0.198;
    this.root.add(pin);
    this.update();
  }

  update(indoorLevel = 1, now = new Date()) {
    this.dialMaterial.emissiveIntensity = 0.34 * indoorLevel;
    // Read wall-clock time, not accumulated frame time, so background tabs catch up.
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    this.hourHand.rotation.z = (-hours * Math.PI) / 6;
    this.minuteHand.rotation.z = (-minutes * Math.PI) / 30;
    this.secondHand.rotation.z = (-seconds * Math.PI) / 30;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of meshMaterials) materials.add(material);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.root.removeFromParent();
  }
}
