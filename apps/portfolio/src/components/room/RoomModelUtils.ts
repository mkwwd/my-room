import * as THREE from 'three';

export function normalizeModelToGround(
  object: THREE.Object3D,
  targetWidth: number,
) {
  const sourceBounds = new THREE.Box3().setFromObject(object);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const largestHorizontalSide = Math.max(sourceSize.x, sourceSize.z);
  const scale = targetWidth / Math.max(largestHorizontalSide, 0.001);

  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(object);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
  object.position.sub(
    new THREE.Vector3(scaledCenter.x, scaledBounds.min.y, scaledCenter.z),
  );
}

export function enableModelShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export function prepareModel(object: THREE.Object3D, targetWidth: number) {
  normalizeModelToGround(object, targetWidth);
  enableModelShadows(object);
}
