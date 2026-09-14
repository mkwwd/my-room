import * as THREE from 'three';

export function createHoverFrame(width: number, height: number) {
  const x = width / 2;
  const y = height / 2;
  const thickness = 0.06;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-x + thickness, -y + thickness);
  hole.lineTo(-x + thickness, y - thickness);
  hole.lineTo(x - thickness, y - thickness);
  hole.lineTo(x - thickness, -y + thickness);
  hole.closePath();
  shape.holes.push(hole);
  const frame = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: '#edf5ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  frame.visible = false;
  return frame;
}

// Add a view-dependent rim in the existing material pass, preserving the upholstery.
export function addHoverRim(root: THREE.Object3D, strength: { value: number }) {
  const materials = new Set<THREE.MeshStandardMaterial>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(child.material)
      ? child.material
      : [child.material]) {
      if (material instanceof THREE.MeshStandardMaterial)
        materials.add(material);
    }
  });
  materials.forEach((material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.roomHoverStrength = strength;
      shader.fragmentShader =
        `uniform float roomHoverStrength;\n${shader.fragmentShader}`.replace(
          '#include <opaque_fragment>',
          `float hoverRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 4.0);
        outgoingLight += vec3(0.82, 0.9, 1.0) * hoverRim * roomHoverStrength;
        #include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => 'room-hover-rim-v1';
    material.needsUpdate = true;
  });
}
