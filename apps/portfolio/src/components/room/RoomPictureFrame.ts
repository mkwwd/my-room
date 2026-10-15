import * as THREE from 'three';

import { GALLERY_IMAGES } from '../gallery/galleryImages';
import type { GalleryFrameId } from '../gallery/gallerySelection';
import { loadGalleryTexture } from '../gallery/loadGalleryTexture';

import { ROOM, ROOM_DEPTH_BOUNDS, WALL_THICKNESS } from './roomConfig';
import { createHoverFrame } from './RoomHoverEffect';

export const FRAME_LAYOUT = {
  portrait: {
    width: 1.64,
    height: 2.44,
    centerY: 4.92,
    centerZ: -0.32,
    focusDistance: 6.2,
  },
  landscape: {
    width: 2.04,
    height: 1.52,
    centerY: 5.46,
    centerZ: 5.34,
    focusDistance: 4,
  },
  square: {
    width: 1.32,
    height: 1.32,
    centerY: 3.9,
    centerZ: 4.88,
    focusDistance: 3.6,
  },
} as const;

function makePaperShadow() {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      pixels[(y * size + x) * 4 + 3] = Math.round(
        255 * THREE.MathUtils.smoothstep(edge, 0, 2),
      );
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export default class RoomPictureFrame {
  readonly root = new THREE.Group();
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();
  imageId: string | null = null;

  private readonly photo: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  >;
  private readonly paperShadow = makePaperShadow();
  private readonly hoverFrame: ReturnType<typeof createHoverFrame>;
  private requestId = 0;
  private disposed = false;

  constructor(
    private readonly wall: THREE.Group,
    readonly id: GalleryFrameId,
  ) {
    const { width, height, centerY, centerZ, focusDistance } = FRAME_LAYOUT[id];
    this.root.name = `gallery-${id}`;
    this.root.position.set(
      WALL_THICKNESS / 2 + 0.018,
      centerY - ROOM.wallHeight / 2,
      centerZ - ROOM_DEPTH_BOUNDS.sideWallCenterZ,
    );
    this.root.rotation.y = Math.PI / 2;
    wall.add(this.root);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.06, height + 0.06),
      new THREE.MeshBasicMaterial({
        color: '#443e39',
        map: this.paperShadow,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shadow.name = 'poster-shadow';
    shadow.position.set(0.008, -0.012, -0.01);
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.003),
      new THREE.MeshStandardMaterial({ color: '#fcfaf5', roughness: 1 }),
    );
    paper.name = 'poster-paper';
    paper.position.z = 0.0015;
    this.photo = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: '#e5e9e3', toneMapped: false }),
    );
    this.photo.name = 'poster-image';
    this.photo.position.z = 0.0036;
    this.hoverFrame = createHoverFrame(width + 0.018, height + 0.018);
    this.hoverFrame.position.z = 0.008;
    this.root.add(shadow, paper, this.photo, this.hoverFrame);
    wall.updateMatrixWorld(true);
    this.root.getWorldPosition(this.focusTarget);
    this.hintAnchor.copy(this.focusTarget);
    this.focusPosition
      .copy(this.focusTarget)
      .add(new THREE.Vector3(focusDistance, 0, 0));
  }

  async loadInitial(imageId: string, manager: THREE.LoadingManager) {
    const key = `gallery-initial-${this.id}`;
    // Optional remote art participates in entry loading without failing the whole room.
    manager.itemStart(key);
    try {
      await this.setImage(imageId);
      return true;
    } catch {
      return false;
    } finally {
      manager.itemEnd(key);
    }
  }

  async setImage(imageId: string) {
    if (this.disposed) throw new Error('Room has closed.');
    const image = GALLERY_IMAGES.find((entry) => entry.id === imageId);
    if (!image)
      throw new Error('선택한 사진을 찾을 수 없어요. 다른 사진을 골라 주세요.');
    const requestId = ++this.requestId;
    if (this.imageId === imageId && this.photo.material.map) return;
    const texture = await loadGalleryTexture(image.url);
    if (this.disposed || requestId !== this.requestId) {
      texture.dispose();
      throw new Error('Photo request was replaced.');
    }
    const { width, height } = this.photo.geometry.parameters;
    const source = texture.image as { width: number; height: number };
    const aspect = source.width / source.height;
    const targetAspect = width / height;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.repeat.set(
      Math.min(1, targetAspect / aspect),
      Math.min(1, aspect / targetAspect),
    );
    texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
    texture.needsUpdate = true;
    this.photo.material.map?.dispose();
    this.photo.material.map = texture;
    this.photo.material.color.set('#ffffff');
    this.photo.material.needsUpdate = true;
    this.imageId = imageId;
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return (
      this.wall.visible &&
      raycaster.intersectObject(this.photo, false).length > 0
    );
  }

  updateHover(active: boolean, delta: number) {
    this.hoverFrame.material.opacity = THREE.MathUtils.damp(
      this.hoverFrame.material.opacity,
      active && this.wall.visible ? 0.95 : 0,
      14,
      delta,
    );
    this.hoverFrame.visible = this.hoverFrame.material.opacity > 0.001;
  }

  dispose() {
    this.disposed = true;
    this.requestId++;
    this.photo.material.map?.dispose();
    this.paperShadow.dispose();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    this.root.removeFromParent();
  }
}
