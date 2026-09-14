import * as THREE from 'three';

import { createHoverFrame } from './RoomHoverEffect';
import type { ProjectedScreenViewport } from './screenTransform';

type ScreenPlane = {
  centerX: number;
  centerY: number;
  centerZ: number;
  width: number;
  height: number;
};

export default class ProjectedScreen {
  private readonly highlight: THREE.Mesh<
    THREE.ShapeGeometry,
    THREE.MeshBasicMaterial
  >;
  private readonly localCorners: THREE.Vector3[];
  private readonly projectedCorners = Array.from(
    { length: 4 },
    () => new THREE.Vector3(),
  );
  private readonly viewport: ProjectedScreenViewport = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  };
  private readonly viewportPoints = [
    this.viewport.topLeft,
    this.viewport.topRight,
    this.viewport.bottomRight,
    this.viewport.bottomLeft,
  ];

  constructor(screen: ScreenPlane) {
    this.highlight = createHoverFrame(screen.width, screen.height);
    this.highlight.position.set(
      screen.centerX,
      screen.centerY,
      screen.centerZ + 0.015,
    );
    this.highlight.visible = false;
    this.localCorners = [
      new THREE.Vector3(
        screen.centerX - screen.width / 2,
        screen.centerY + screen.height / 2,
        screen.centerZ,
      ),
      new THREE.Vector3(
        screen.centerX + screen.width / 2,
        screen.centerY + screen.height / 2,
        screen.centerZ,
      ),
      new THREE.Vector3(
        screen.centerX + screen.width / 2,
        screen.centerY - screen.height / 2,
        screen.centerZ,
      ),
      new THREE.Vector3(
        screen.centerX - screen.width / 2,
        screen.centerY - screen.height / 2,
        screen.centerZ,
      ),
    ];
  }

  updateHighlight(anchor: THREE.Object3D, active: boolean, delta: number) {
    if (this.highlight.parent !== anchor) anchor.add(this.highlight);
    this.highlight.material.opacity = THREE.MathUtils.damp(
      this.highlight.material.opacity,
      active ? 0.95 : 0,
      14,
      delta,
    );
    this.highlight.visible = this.highlight.material.opacity > 0.001;
  }

  dispose() {
    this.highlight.removeFromParent();
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
  }

  project(
    anchor: THREE.Object3D,
    camera: THREE.Camera,
    viewportWidth: number,
    viewportHeight: number,
  ): ProjectedScreenViewport | null {
    anchor.updateMatrixWorld(true);
    camera.updateMatrixWorld();

    for (let index = 0; index < this.localCorners.length; index += 1) {
      const projectedCorner = this.projectedCorners[index]
        .copy(this.localCorners[index])
        .applyMatrix4(anchor.matrixWorld)
        .project(camera);
      if (projectedCorner.z < -1 || projectedCorner.z > 1) return null;

      const viewportPoint = this.viewportPoints[index];
      viewportPoint.x = (projectedCorner.x * 0.5 + 0.5) * viewportWidth;
      viewportPoint.y = (-projectedCorner.y * 0.5 + 0.5) * viewportHeight;
    }

    return this.viewport;
  }
}
