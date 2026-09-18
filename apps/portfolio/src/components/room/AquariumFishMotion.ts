import * as THREE from 'three';

export default class AquariumFishMotion {
  private readonly curve = new THREE.QuadraticBezierCurve3();
  private readonly velocity = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly heading = new THREE.Quaternion();
  private readonly rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  private segment = -1;
  private lastTime: number | null = null;
  private tailPhase: number;

  constructor(
    private readonly index: number,
    private readonly center: THREE.Vector3,
    private readonly radius: THREE.Vector3,
  ) {
    this.tailPhase = index * 2.1;
  }

  private waypoint(step: number, target: THREE.Vector3) {
    const seed = 173 + this.index * 7919 + step * 104729;
    target.set(
      THREE.MathUtils.seededRandom(seed) * 2 - 1,
      THREE.MathUtils.seededRandom(seed + 31) * 2 - 1,
      THREE.MathUtils.seededRandom(seed + 73) * 2 - 1,
    );
    return target.multiply(this.radius).add(this.center);
  }

  update(
    time: number,
    root: THREE.Group,
    model: THREE.Object3D,
    tail?: THREE.Object3D,
  ) {
    const duration = 7.5 + this.index * 1.3;
    const progress = Math.max(0, time) / duration + this.index * 0.37;
    const segment = Math.floor(progress);
    if (segment !== this.segment) {
      this.segment = segment;
      this.waypoint(segment, this.curve.v0);
      this.waypoint(segment + 1, this.curve.v1);
      this.waypoint(segment + 2, this.curve.v2);
      // Midpoint joins keep both position and tangent continuous. The convex
      // curve stays inside the inset swim box without bouncing off the glass.
      this.curve.v0.lerp(this.curve.v1, 0.5);
      this.curve.v2.lerp(this.curve.v1, 0.5);
    }

    const phase = progress - segment;
    const cycle = phase * Math.PI * 2;
    const u = phase - (0.65 * Math.sin(cycle)) / (Math.PI * 2);
    this.curve.getPoint(u, root.position);
    this.velocity
      .subVectors(this.curve.v1, this.curve.v0)
      .multiplyScalar(2 * (1 - u));
    this.scratch.subVectors(this.curve.v2, this.curve.v1);
    this.velocity.addScaledVector(this.scratch, 2 * u);
    const speed =
      (this.velocity.length() * (1 - 0.65 * Math.cos(cycle))) / duration;
    const delta =
      this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);

    if (this.velocity.lengthSq() > 0.000001) {
      this.rotation.set(
        0,
        Math.atan2(-this.velocity.z, this.velocity.x),
        THREE.MathUtils.clamp(
          Math.atan2(
            this.velocity.y,
            Math.hypot(this.velocity.x, this.velocity.z),
          ),
          -0.28,
          0.28,
        ),
      );
      this.heading.setFromEuler(this.rotation);
      if (this.lastTime === null || time < this.lastTime)
        root.quaternion.copy(this.heading);
      else root.quaternion.rotateTowards(this.heading, delta * 1.8);
    }
    this.tailPhase += Math.min(delta, 0.25) * (3 + speed * 25);
    const effort = THREE.MathUtils.clamp(speed / 0.18, 0, 1);
    model.rotation.y = Math.sin(this.tailPhase) * (0.01 + effort * 0.025);
    if (tail)
      tail.rotation.y = Math.sin(this.tailPhase) * (0.08 + effort * 0.24);
    this.lastTime = time;
  }
}
