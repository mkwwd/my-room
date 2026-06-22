export type ComputerScreenPoint = {
  x: number;
  y: number;
};

export type ComputerScreenViewport = {
  topLeft: ComputerScreenPoint;
  topRight: ComputerScreenPoint;
  bottomRight: ComputerScreenPoint;
  bottomLeft: ComputerScreenPoint;
};

const EPSILON = 0.000001;

export function createComputerScreenTransform(
  viewport: ComputerScreenViewport,
  sourceWidth: number,
  sourceHeight: number,
) {
  const { topLeft, topRight, bottomRight, bottomLeft } = viewport;
  const deltaX1 = topRight.x - bottomRight.x;
  const deltaX2 = bottomLeft.x - bottomRight.x;
  const deltaX3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const deltaY1 = topRight.y - bottomRight.y;
  const deltaY2 = bottomLeft.y - bottomRight.y;
  const deltaY3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;

  let perspectiveX = 0;
  let perspectiveY = 0;
  if (Math.abs(deltaX3) > EPSILON || Math.abs(deltaY3) > EPSILON) {
    const denominator = deltaX1 * deltaY2 - deltaX2 * deltaY1;
    if (Math.abs(denominator) < EPSILON) return null;

    perspectiveX = (deltaX3 * deltaY2 - deltaX2 * deltaY3) / denominator;
    perspectiveY = (deltaX1 * deltaY3 - deltaX3 * deltaY1) / denominator;
  }

  const scaleX = topRight.x - topLeft.x + perspectiveX * topRight.x;
  const skewX = bottomLeft.x - topLeft.x + perspectiveY * bottomLeft.x;
  const scaleY = topRight.y - topLeft.y + perspectiveX * topRight.y;
  const skewY = bottomLeft.y - topLeft.y + perspectiveY * bottomLeft.y;

  return `matrix3d(
    ${scaleX / sourceWidth}, ${scaleY / sourceWidth}, 0, ${perspectiveX / sourceWidth},
    ${skewX / sourceHeight}, ${skewY / sourceHeight}, 0, ${perspectiveY / sourceHeight},
    0, 0, 1, 0,
    ${topLeft.x}, ${topLeft.y}, 0, 1
  )`;
}
