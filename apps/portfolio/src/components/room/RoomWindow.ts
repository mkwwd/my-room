import * as THREE from 'three';

import createDayWindowView from './DayWindowView';
import createNightWindowView from './NightWindowView';
import {
  ROOM,
  ROOM_DEPTH_BOUNDS,
  ROOM_WINDOW,
  WALL_THICKNESS,
} from './roomConfig';
import { createHoverFrame } from './RoomHoverEffect';
import RoomWindowPanels from './RoomWindowPanels';

export default class RoomWindow {
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly root = new THREE.Group();
  private readonly hoverFrame = createHoverFrame(
    ROOM_WINDOW.width + 0.24,
    ROOM_WINDOW.height + 0.16,
  );
  private readonly panels = new RoomWindowPanels(
    ROOM_WINDOW.width,
    ROOM_WINDOW.height,
  );
  private readonly dayView: ReturnType<typeof createDayWindowView>;
  private readonly nightView: ReturnType<typeof createNightWindowView>;
  private isDisposed = false;
  private lastTimeCheck = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly leftWall: THREE.Group,
    manager: THREE.LoadingManager,
  ) {
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
    this.panels.root.rotation.y = Math.PI / 2;
    this.root.add(this.panels.root);
    this.hoverFrame.rotation.y = Math.PI / 2;
    this.hoverFrame.position.set(0.16, ROOM_WINDOW.height / 2, 0);
    this.root.add(this.hoverFrame);

    this.root.add(this.dayView.root, this.nightView.root);
    this.updateAppearance();
    leftWall.updateMatrixWorld(true);
    this.hintAnchor.copy(
      this.root.localToWorld(new THREE.Vector3(0.2, ROOM_WINDOW.height / 2, 0)),
    );
    this.focusTarget.copy(
      this.root.localToWorld(new THREE.Vector3(0, ROOM_WINDOW.height / 2, 0)),
    );
    this.focusPosition.copy(
      this.root.localToWorld(
        new THREE.Vector3(ROOM_WINDOW.focusDistance, ROOM_WINDOW.height / 2, 0),
      ),
    );
  }

  get isOpen() {
    return this.panels.isOpen;
  }

  toggle() {
    return this.panels.toggle();
  }

  update(elapsedTime: number, delta: number) {
    this.panels.update(delta);
    this.dayView.update(elapsedTime);
    this.nightView.update(elapsedTime);
    if (elapsedTime - this.lastTimeCheck < 30) return;
    this.lastTimeCheck = elapsedTime;
    this.updateAppearance();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return (
      this.leftWall.visible &&
      raycaster.intersectObject(this.panels.root, true).length > 0
    );
  }

  get isDaytime() {
    return this.dayView.root.visible;
  }

  updateHover(active: boolean, delta: number) {
    this.panels.updateHover(active && this.leftWall.visible, delta);
    this.hoverFrame.material.opacity = THREE.MathUtils.damp(
      this.hoverFrame.material.opacity,
      active && this.leftWall.visible ? 0.65 : 0,
      14,
      delta,
    );
    this.hoverFrame.visible = this.hoverFrame.material.opacity > 0.001;
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.panels.dispose();
    this.hoverFrame.geometry.dispose();
    this.hoverFrame.material.dispose();
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
}
