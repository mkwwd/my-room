import * as THREE from 'three';

import type RoomCharacterController from './RoomCharacter';
import {
  ROOM_SOFA_INTERACTION,
  ROOM_DEPTH_BOUNDS,
  type FocusMode,
  type RoomHoverTarget,
  type SceneMode,
} from './roomConfig';
import type RoomEnvironment from './RoomEnvironment';

const INTERACTION_TARGETS: FocusMode[] = [
  'computer',
  'tv',
  'window',
  'aquarium',
];
export const ROOM_MARKER_TARGETS: RoomHoverTarget[] = [
  ...INTERACTION_TARGETS,
  'sofa',
  'lightSwitch',
];
const SOFA_PICK_BOX = new THREE.Box3(
  new THREE.Vector3(
    ROOM_SOFA_INTERACTION.center[0] - ROOM_SOFA_INTERACTION.halfSize[0],
    ROOM_SOFA_INTERACTION.center[1] - ROOM_SOFA_INTERACTION.halfSize[1],
    ROOM_SOFA_INTERACTION.center[2] - ROOM_SOFA_INTERACTION.halfSize[2],
  ),
  new THREE.Vector3(
    ROOM_SOFA_INTERACTION.center[0] + ROOM_SOFA_INTERACTION.halfSize[0],
    ROOM_SOFA_INTERACTION.center[1] + ROOM_SOFA_INTERACTION.halfSize[1],
    ROOM_SOFA_INTERACTION.center[2] + ROOM_SOFA_INTERACTION.halfSize[2],
  ),
);
const SOFA_HINT_ANCHOR = new THREE.Vector3(...ROOM_SOFA_INTERACTION.hintAnchor);

type InteractiveStation = {
  hintAnchor: THREE.Vector3;
  focusPosition: THREE.Vector3;
  focusTarget: THREE.Vector3;
  isPointerOver: (raycaster: THREE.Raycaster) => boolean;
};

export type ScreenPosition = {
  x: number;
  y: number;
  visible: boolean;
};
export type HintPositions = Partial<Record<RoomHoverTarget, ScreenPosition>>;

type RoomInteractionOptions = {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  stations: Record<FocusMode, InteractiveStation>;
  environment: RoomEnvironment;
  character: RoomCharacterController;
  getSceneMode: () => SceneMode;
  isEnabled: () => boolean;
  onEnterFocus: (target: FocusMode) => void;
  onExitFocus: () => void;
  onHoverTargetChange: (target: RoomHoverTarget | null) => void;
  onHintPositionsChange: (positions: HintPositions) => void;
  onToggleLights: () => void;
};

export default class RoomInteractionController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly projectedHint = new THREE.Vector3();
  private readonly facing = new THREE.Vector3();
  private readonly toCamera = new THREE.Vector3();
  private hoveredTarget: RoomHoverTarget | null = null;
  private lastHintPositions: HintPositions = {};

  constructor(private readonly options: RoomInteractionOptions) {
    options.canvas.tabIndex = 0;
    options.canvas.addEventListener('pointerdown', this.onPointerDown);
    options.canvas.addEventListener('pointermove', this.onPointerMove);
    options.canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  updateHint(width: number, height: number) {
    if (!this.options.isEnabled()) return;
    const positions: HintPositions = {};
    let changed = false;
    for (const target of ROOM_MARKER_TARGETS) {
      const anchor =
        target === 'sofa'
          ? SOFA_HINT_ANCHOR
          : target === 'lightSwitch'
            ? this.options.environment.door.hintAnchor
            : this.options.stations[target].hintAnchor;
      this.projectedHint.copy(anchor).project(this.options.camera);
      const x = Math.round((this.projectedHint.x * 0.5 + 0.5) * width);
      const y = Math.round((-this.projectedHint.y * 0.5 + 0.5) * height);
      const visible =
        this.options.getSceneMode() === 'explore' &&
        this.isTargetVisible(target) &&
        this.projectedHint.z > -1 &&
        this.projectedHint.z < 1 &&
        x >= 24 &&
        x <= width - 24 &&
        y >= 24 &&
        y <= height - 24;
      const previous = this.lastHintPositions[target];
      if (
        !previous ||
        previous.visible !== visible ||
        (visible &&
          (Math.abs(x - previous.x) > 1 || Math.abs(y - previous.y) > 1))
      ) {
        positions[target] = { x, y, visible };
        changed = true;
      } else {
        positions[target] = previous;
      }
    }
    if (changed) {
      this.lastHintPositions = positions;
      this.options.onHintPositionsChange(positions);
    }
    if (this.hoveredTarget && !positions[this.hoveredTarget]?.visible)
      this.setHoveredTarget(null);
  }

  dispose() {
    const { canvas, character } = this.options;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.style.cursor = 'default';
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    character.clearInput();
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.options.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.options.camera);
  }

  setHoveredTarget(nextTarget: RoomHoverTarget | null) {
    if (
      nextTarget &&
      (!this.options.isEnabled() ||
        this.options.getSceneMode() !== 'explore' ||
        !this.isTargetVisible(nextTarget))
    )
      nextTarget = null;
    if (this.hoveredTarget === nextTarget) return;

    this.hoveredTarget = nextTarget;
    this.options.onHoverTargetChange(nextTarget);
  }

  private isTargetVisible(target: RoomHoverTarget) {
    if (target === 'sofa') return true;
    if (target === 'lightSwitch')
      return (
        this.options.environment.walls.front.visible &&
        this.options.camera.position.z < ROOM_DEPTH_BOUNDS.front
      );
    if (target === 'window' && !this.options.environment.walls.left.visible)
      return false;
    const station = this.options.stations[target];
    if (station.hintAnchor.lengthSq() === 0) return false;
    this.facing.subVectors(station.focusPosition, station.focusTarget);
    this.toCamera.subVectors(this.options.camera.position, station.focusTarget);
    return this.facing.dot(this.toCamera) > 0;
  }

  private isPointerOverSofa() {
    return this.raycaster.ray.intersectsBox(SOFA_PICK_BOX);
  }

  private getHoveredTarget() {
    if (
      this.isTargetVisible('lightSwitch') &&
      this.options.environment.door.isPointerOver(this.raycaster)
    )
      return 'lightSwitch';
    return (
      INTERACTION_TARGETS.find(
        (target) =>
          this.isTargetVisible(target) &&
          this.options.stations[target].isPointerOver(this.raycaster),
      ) ?? (this.isPointerOverSofa() ? 'sofa' : null)
    );
  }

  activateTarget(target: RoomHoverTarget) {
    if (
      !this.options.isEnabled() ||
      this.options.getSceneMode() !== 'explore' ||
      !this.isTargetVisible(target)
    )
      return false;
    this.options.canvas.focus();
    this.setHoveredTarget(null);
    if (target === 'lightSwitch') {
      this.options.onToggleLights();
      return true;
    }
    if (target === 'sofa')
      return this.options.character.tryToggleSofaSit({ ignoreDistance: true });
    this.options.onEnterFocus(target);
    return true;
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    const { canvas, environment, character } = this.options;
    if (!this.options.isEnabled() || event.button !== 0) return;
    canvas.focus();

    if (this.options.getSceneMode() !== 'explore') return;

    this.updatePointer(event);
    const target = this.getHoveredTarget();
    if (target && this.activateTarget(target)) return;

    const floorHit = this.raycaster.intersectObjects(
      environment.floorPickTargets,
      false,
    )[0];
    if (floorHit) character.moveTo(floorHit.point);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const { canvas } = this.options;
    if (
      !this.options.isEnabled() ||
      this.options.getSceneMode() !== 'explore'
    ) {
      canvas.style.cursor = 'default';
      this.setHoveredTarget(null);
      return;
    }

    this.updatePointer(event);
    const hoveredTarget = this.getHoveredTarget();
    canvas.style.cursor = hoveredTarget ? 'pointer' : 'default';
    this.setHoveredTarget(hoveredTarget);
  };

  private readonly onPointerLeave = () => {
    this.options.canvas.style.cursor = 'default';
    this.setHoveredTarget(null);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.options.isEnabled()) return;
    if (event.key === 'Escape' && this.options.getSceneMode() !== 'explore') {
      event.preventDefault();
      this.options.onExitFocus();
      return;
    }

    if (
      event.key.toLowerCase() === 'e' &&
      this.options.getSceneMode() === 'explore' &&
      this.options.character.tryToggleSofaSit()
    ) {
      event.preventDefault();
      return;
    }

    this.options.character.pressKey(event.key);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.options.character.releaseKey(event.key);
  };
}
