import * as THREE from 'three';

import ComputerStation from '../computer/ComputerStation';

import type RoomCharacterController from './RoomCharacter';
import type { SceneMode } from './roomConfig';
import type RoomEnvironment from './RoomEnvironment';

export type ScreenPosition = {
  x: number;
  y: number;
  visible: boolean;
};

type RoomInteractionOptions = {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  computerStation: ComputerStation;
  environment: RoomEnvironment;
  character: RoomCharacterController;
  getSceneMode: () => SceneMode;
  onEnterComputer: () => void;
  onExitComputer: () => void;
  onComputerHoverChange: (isHovering: boolean) => void;
  onHintPositionChange: (position: ScreenPosition) => void;
};

export default class RoomInteractionController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly projectedHint = new THREE.Vector3();
  private isHoveringComputer = false;
  private lastHintPosition: ScreenPosition = { x: 0, y: 0, visible: false };

  constructor(private readonly options: RoomInteractionOptions) {
    options.canvas.tabIndex = 0;
    options.canvas.addEventListener('pointerdown', this.onPointerDown);
    options.canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  updateHint(width: number, height: number) {
    if (this.options.getSceneMode() !== 'explore' || !this.isHoveringComputer) {
      this.setHintPosition({ x: 0, y: 0, visible: false });
      return;
    }

    this.projectedHint
      .copy(this.options.computerStation.hintAnchor)
      .project(this.options.camera);
    this.setHintPosition({
      x: (this.projectedHint.x * 0.5 + 0.5) * width,
      y: (-this.projectedHint.y * 0.5 + 0.5) * height,
      visible: this.projectedHint.z > -1 && this.projectedHint.z < 1,
    });
  }

  dispose() {
    const { canvas, character } = this.options;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
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

  private setComputerHover(nextIsHovering: boolean) {
    if (this.isHoveringComputer === nextIsHovering) return;

    this.isHoveringComputer = nextIsHovering;
    this.options.onComputerHoverChange(nextIsHovering);
  }

  private setHintPosition(nextPosition: ScreenPosition) {
    const roundedPosition = {
      x: Math.round(nextPosition.x),
      y: Math.round(nextPosition.y),
      visible: nextPosition.visible,
    };
    const hasMoved =
      Math.abs(roundedPosition.x - this.lastHintPosition.x) > 1 ||
      Math.abs(roundedPosition.y - this.lastHintPosition.y) > 1;

    if (
      roundedPosition.visible !== this.lastHintPosition.visible ||
      (roundedPosition.visible && hasMoved)
    ) {
      this.lastHintPosition = roundedPosition;
      this.options.onHintPositionChange(roundedPosition);
    }
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    const { canvas, computerStation, environment, character } = this.options;
    canvas.focus();

    if (this.options.getSceneMode() === 'computer') return;

    this.updatePointer(event);
    if (computerStation.isPointerOver(this.raycaster)) {
      this.setComputerHover(false);
      this.options.onEnterComputer();
      return;
    }

    const floorHit = this.raycaster.intersectObjects(
      environment.floorPickTargets,
      false,
    )[0];
    if (floorHit) character.moveTo(floorHit.point);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const { canvas, computerStation } = this.options;
    if (this.options.getSceneMode() === 'computer') {
      canvas.style.cursor = 'default';
      this.setComputerHover(false);
      return;
    }

    this.updatePointer(event);
    const isHoveringComputer = computerStation.isPointerOver(this.raycaster);
    canvas.style.cursor = isHoveringComputer ? 'pointer' : 'default';
    this.setComputerHover(isHoveringComputer);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (
      (event.key === 'Escape' || event.key === 'Backspace') &&
      this.options.getSceneMode() === 'computer'
    ) {
      event.preventDefault();
      this.options.onExitComputer();
      return;
    }

    this.options.character.pressKey(event.key);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.options.character.releaseKey(event.key);
  };
}
