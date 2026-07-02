import * as THREE from 'three';

const CHARACTER_SPEED = 3.1;
const CHARACTER_BOB_HEIGHT = 0.025;
const CHARACTER_BOB_SPEED = 10;
const CHARACTER_MOVEMENT_THRESHOLD = 0.0002;

type RoomCharacterOptions = {
  limitX: number;
  limitZ: number;
  initialPosition: [number, number, number];
};

type CharacterUpdateOptions = {
  delta: number;
  elapsedTime: number;
  movementEnabled: boolean;
  viewForward: THREE.Vector3;
  viewRight: THREE.Vector3;
};

function makeMaterial(color: string) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.02,
  });
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function buildCharacter() {
  const character = new THREE.Group();
  const skin = makeMaterial('#f2c7a2');
  const shirt = makeMaterial('#f4a261');
  const hat = makeMaterial('#e9d18b');
  const pants = makeMaterial('#8a6a53');

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.45, 8, 16),
    shirt,
  );
  body.position.y = 0.58;
  body.castShadow = true;
  character.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), skin);
  head.position.y = 1.02;
  head.castShadow = true;
  character.add(head);

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.045, 32),
    hat,
  );
  brim.position.y = 1.16;
  brim.castShadow = true;
  character.add(brim);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.34, 0.18, 28),
    hat,
  );
  crown.position.y = 1.25;
  crown.castShadow = true;
  character.add(crown);

  addBox(character, [0.16, 0.28, 0.16], [-0.12, 0.18, 0], pants);
  addBox(character, [0.16, 0.28, 0.16], [0.12, 0.18, 0], pants);

  return character;
}

export default class RoomCharacterController {
  readonly object = buildCharacter();

  private readonly pressedKeys = new Set<string>();
  private readonly targetPosition: THREE.Vector3;
  private readonly direction = new THREE.Vector3();
  private readonly previousPosition = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();

  constructor(private readonly options: RoomCharacterOptions) {
    this.object.position.set(...options.initialPosition);
    this.targetPosition = this.object.position.clone();
  }

  pressKey(key: string) {
    this.pressedKeys.add(key.toLowerCase());
  }

  releaseKey(key: string) {
    this.pressedKeys.delete(key.toLowerCase());
  }

  clearInput() {
    this.pressedKeys.clear();
  }

  moveTo(position: THREE.Vector3) {
    this.targetPosition.copy(position);
    this.targetPosition.y = 0;
    this.clampTargetPosition();
  }

  update({
    delta,
    elapsedTime,
    movementEnabled,
    viewForward,
    viewRight,
  }: CharacterUpdateOptions) {
    const moveRight =
      (this.hasKey('d', 'arrowright') ? 1 : 0) -
      (this.hasKey('a', 'arrowleft') ? 1 : 0);
    const moveForward =
      (this.hasKey('w', 'arrowup') ? 1 : 0) -
      (this.hasKey('s', 'arrowdown') ? 1 : 0);

    this.direction
      .set(0, 0, 0)
      .addScaledVector(viewRight, moveRight)
      .addScaledVector(viewForward, moveForward);

    if (movementEnabled && this.direction.lengthSq() > 0) {
      this.direction.normalize();
      this.targetPosition.addScaledVector(
        this.direction,
        CHARACTER_SPEED * delta,
      );
      this.clampTargetPosition();
    }

    this.previousPosition.copy(this.object.position);
    this.object.position.lerp(this.targetPosition, 1 - Math.pow(0.001, delta));
    this.movement.copy(this.object.position).sub(this.previousPosition);

    const isMoving = this.movement.lengthSq() > CHARACTER_MOVEMENT_THRESHOLD;
    if (isMoving) {
      this.object.rotation.y = Math.atan2(this.movement.x, this.movement.z);
    }

    this.object.position.y = isMoving
      ? CHARACTER_BOB_HEIGHT * Math.sin(elapsedTime * CHARACTER_BOB_SPEED)
      : 0;
  }

  private hasKey(primary: string, alternate: string) {
    return this.pressedKeys.has(primary) || this.pressedKeys.has(alternate);
  }

  private clampTargetPosition() {
    this.targetPosition.x = THREE.MathUtils.clamp(
      this.targetPosition.x,
      -this.options.limitX,
      this.options.limitX,
    );
    this.targetPosition.z = THREE.MathUtils.clamp(
      this.targetPosition.z,
      -this.options.limitZ,
      this.options.limitZ,
    );
  }
}
