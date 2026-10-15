import * as THREE from 'three';

import { GALLERY_IMAGES } from '../gallery/galleryImages';
import { loadGalleryTexture } from '../gallery/loadGalleryTexture';

import { ROOM, ROOM_DEPTH_BOUNDS, WALL_THICKNESS } from './roomConfig';

function makeCorkTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 43;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const fleck = (seed / 0xffffffff - 0.5) * 28;
      const grain = Math.sin(x * 0.7 + Math.sin(y * 0.45)) * 7;
      const offset = (y * size + x) * 4;
      pixels.set(
        [207 + fleck + grain, 178 + fleck + grain, 140 + fleck + grain, 255],
        offset,
      );
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeMemoTexture() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4).fill(255);
  for (let row = 0; row < 4; row++) {
    const y = 19 + row * 9;
    const end = [51, 45, 48, 36][row];
    for (let x = 12; x < end; x++) {
      const offset = ((y + (x % 11 === 0 ? 1 : 0)) * size + x) * 4;
      pixels.set([137, 144, 137, 255], offset);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export default class RoomPinboard {
  private readonly root = new THREE.Group();
  private disposed = false;

  constructor(wall: THREE.Group, manager: THREE.LoadingManager) {
    this.root.name = 'room-pinboard';
    this.root.position.set(
      WALL_THICKNESS / 2 + 0.03,
      4.95 - ROOM.wallHeight / 2,
      2.475 - ROOM_DEPTH_BOUNDS.sideWallCenterZ,
    );
    this.root.rotation.y = Math.PI / 2;
    wall.add(this.root);

    const white = new THREE.MeshStandardMaterial({
      color: '#fffdf8',
      roughness: 0.8,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.03, 2.5, 0.08), white);
    frame.position.z = 0.04;
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(2.91, 2.38, 0.016),
      new THREE.MeshStandardMaterial({ map: makeCorkTexture(), roughness: 1 }),
    );
    cork.position.z = 0.081;
    this.root.add(frame, cork);

    const pinStemGeometry = new THREE.CylinderGeometry(0.013, 0.013, 0.04, 8);
    const pinHeadGeometry = new THREE.SphereGeometry(0.035, 10, 8);
    const pinStemMaterial = new THREE.MeshStandardMaterial({
      color: '#aa9779',
      metalness: 0.6,
      roughness: 0.4,
    });
    const pinColors = ['#c88080', '#81a39c', '#e1ba70', '#c88080'];
    let pinIndex = 0;
    const paper = (
      x: number,
      y: number,
      width: number,
      height: number,
      angle: number,
      color: string,
    ) => {
      const group = new THREE.Group();
      group.position.set(x, y, 0.096);
      group.rotation.z = angle;
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.008),
        color === '#fffdf8'
          ? white
          : new THREE.MeshStandardMaterial({ color, roughness: 1 }),
      );
      const stem = new THREE.Mesh(pinStemGeometry, pinStemMaterial);
      stem.rotation.x = Math.PI / 2;
      stem.position.set(0, height / 2 - 0.065, 0.021);
      const head = new THREE.Mesh(
        pinHeadGeometry,
        new THREE.MeshStandardMaterial({
          color: pinColors[pinIndex++],
          roughness: 0.5,
        }),
      );
      head.position.set(0, stem.position.y, 0.046);
      head.scale.z = 0.6;
      group.add(card, stem, head);
      this.root.add(group);
      return group;
    };

    const photoCards = [
      { id: 'woodland-mist', x: -0.72, y: 0.48, angle: 0.08 },
      { id: 'lavender-sunset', x: 0.72, y: -0.49, angle: -0.07 },
    ];
    for (const { id, x, y, angle } of photoCards) {
      const card = paper(x, y, 0.79, 1.03, angle, '#fffdf8');
      const photo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.69, 0.78),
        new THREE.MeshStandardMaterial({ color: '#d7ddd3', roughness: 1 }),
      );
      photo.position.set(0, 0.035, 0.005);
      card.add(photo);
      const image = GALLERY_IMAGES.find((image) => image.id === id)!;
      void this.loadPhoto(photo, image.thumbnailUrl, manager, `pinboard-${id}`);
    }

    const memoTexture = makeMemoTexture();
    for (const { x, y, angle, color } of [
      { x: 0.72, y: 0.54, angle: -0.06, color: '#f3e5a9' },
      { x: -0.72, y: -0.51, angle: 0.045, color: '#d6e5df' },
    ]) {
      const card = paper(x, y, 0.65, 0.62, angle, color);
      const note = new THREE.Mesh(
        new THREE.PlaneGeometry(0.63, 0.6),
        new THREE.MeshStandardMaterial({
          color,
          map: memoTexture,
          roughness: 1,
        }),
      );
      note.position.z = 0.005;
      card.add(note);
    }
  }

  private async loadPhoto(
    photo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>,
    url: string,
    manager: THREE.LoadingManager,
    key: string,
  ) {
    manager.itemStart(key);
    try {
      const texture = await loadGalleryTexture(url);
      if (this.disposed) {
        texture.dispose();
        return;
      }
      const { width, height } = texture.image as {
        width: number;
        height: number;
      };
      const aspect = width / height;
      const target =
        photo.geometry.parameters.width / photo.geometry.parameters.height;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.repeat.set(
        Math.min(1, target / aspect),
        Math.min(1, aspect / target),
      );
      texture.offset.set(
        (1 - texture.repeat.x) / 2,
        (1 - texture.repeat.y) / 2,
      );
      texture.needsUpdate = true;
      photo.material.map = texture;
      photo.material.color.set('#ffffff');
      photo.material.needsUpdate = true;
    } catch {
      // Keep the paper placeholder if this optional photo is unavailable.
    } finally {
      manager.itemEnd(key);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const resources = new Set<
      THREE.BufferGeometry | THREE.Material | THREE.Texture
    >();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      resources.add(object.material);
      if (object.material.map) resources.add(object.material.map);
    });
    for (const resource of resources) resource.dispose();
    this.root.removeFromParent();
  }
}
