'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import ComputerDesktop, { type ScreenBounds } from './ComputerDesktop';

const ROOM = {
  width: 13.4,
  depth: 20,
  wallHeight: 8,
  playerLimitX: 5.25,
  playerLimitZ: 8.75,
};

const WALL_THICKNESS = 0.32;
const CAMERA_FOV = 42;
const COMPUTER_CAMERA_FOV = 30;
const CAMERA_DISTANCE = 10;
const CAMERA_HEIGHT = 8.1;
const CAMERA_SIDE_FOLLOW = 0.38;
const CAMERA_LOOK_DISTANCE = 0.5;
const CAMERA_LOOK_HEIGHT = 3;
const VIEW_DIRECTION_COUNT = 4;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const DESK_MODEL_PATH = '/desk1.glb';
const DESKTOP_MODEL_PATH = '/desktop.glb';
const TV_MODEL_PATH = '/tv.glb';
const DESK_TARGET_WIDTH = 3.1;
const DESKTOP_TARGET_WIDTH = 2;
const DESK_SURFACE_HEIGHT = 1.71;
const TV_TARGET_WIDTH = 5.4;
const TV_BOTTOM_HEIGHT = 2.28;
const COMPUTER_SCREEN_CENTER_X = -0.27;
const COMPUTER_SCREEN_CENTER_Y = DESK_SURFACE_HEIGHT + 0.92;
const COMPUTER_SCREEN_CENTER_Z = -0.35;
const COMPUTER_SCREEN_WIDTH = 1.42;
const COMPUTER_SCREEN_HEIGHT = 0.76;

type RoomWalls = {
  back: THREE.Mesh;
  front: THREE.Mesh;
  left: THREE.Mesh;
  right: THREE.Mesh;
};
type ViewDirection = 0 | 1 | 2 | 3;
type SceneMode = 'explore' | 'computer';
type ScreenPosition = {
  x: number;
  y: number;
  visible: boolean;
};
type ScreenFrameRef = {
  corners: THREE.Vector3[] | null;
};

function makeMaterial(color: string, roughness = 0.85, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function getNearestViewAngle(
  currentAngle: number,
  nextViewDirection: ViewDirection,
) {
  const baseAngle = nextViewDirection * QUARTER_TURN;
  const turnOffset = Math.round((currentAngle - baseAngle) / FULL_TURN);
  return baseAngle + turnOffset * FULL_TURN;
}

function getOrbitVectors(angle: number) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  return {
    forward: new THREE.Vector3(-sin, 0, -cos),
    right: new THREE.Vector3(cos, 0, -sin),
  };
}

function buildRoom(
  scene: THREE.Scene,
  floorPickTargets: THREE.Object3D[],
): RoomWalls {
  const floorMaterial = makeMaterial('#ffffff');
  const wallMaterial = makeMaterial('#e7f7ff');
  const halfWidth = ROOM.width / 2;
  const halfDepth = ROOM.depth / 2;
  const wallY = ROOM.wallHeight / 2;

  const floor = addBox(
    scene,
    [ROOM.width, 0.22, ROOM.depth],
    [0, -0.12, 0],
    floorMaterial,
  );
  floorPickTargets.push(floor);

  const back = addBox(
    scene,
    [ROOM.width + WALL_THICKNESS * 2, ROOM.wallHeight, WALL_THICKNESS],
    [0, wallY, -halfDepth - WALL_THICKNESS / 2],
    wallMaterial,
  );
  const front = addBox(
    scene,
    [ROOM.width + WALL_THICKNESS * 2, ROOM.wallHeight, WALL_THICKNESS],
    [0, wallY, halfDepth + WALL_THICKNESS / 2],
    wallMaterial.clone(),
  );
  const left = addBox(
    scene,
    [WALL_THICKNESS, ROOM.wallHeight, ROOM.depth + WALL_THICKNESS],
    [-halfWidth - WALL_THICKNESS / 2, wallY, -WALL_THICKNESS / 2],
    wallMaterial,
  );
  const right = addBox(
    scene,
    [WALL_THICKNESS, ROOM.wallHeight, ROOM.depth + WALL_THICKNESS],
    [halfWidth + WALL_THICKNESS / 2, wallY, -WALL_THICKNESS / 2],
    wallMaterial.clone(),
  );

  return { back, front, left, right };
}

function buildCharacter() {
  const character = new THREE.Group();
  const skin = makeMaterial('#f2c7a2');
  const shirt = makeMaterial('#f4a261');
  const hat = makeMaterial('#e9d18b');
  const pants = makeMaterial('#8a6a53');

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.45, 8, 16),
    shirt,
  );
  body.position.y = 0.58;
  body.castShadow = true;
  character.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), skin);
  head.position.y = 1.02;
  head.castShadow = true;
  character.add(head);

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.045, 32),
    hat,
  );
  brim.position.y = 1.16;
  brim.castShadow = true;
  character.add(brim);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.34, 0.18, 28),
    hat,
  );
  crown.position.y = 1.25;
  crown.castShadow = true;
  character.add(crown);

  addBox(character, [0.16, 0.28, 0.16], [-0.12, 0.18, 0], pants);
  addBox(character, [0.16, 0.28, 0.16], [0.12, 0.18, 0], pants);

  return character;
}

function normalizeModelToGround(object: THREE.Object3D, targetWidth: number) {
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

function loadDeskModel(
  scene: THREE.Scene,
  computerPickTargets: THREE.Object3D[],
  computerFocusCamera: THREE.Vector3,
  computerFocusTarget: THREE.Vector3,
  computerHintAnchor: THREE.Vector3,
  computerScreenFrameRef: ScreenFrameRef,
) {
  const loader = new GLTFLoader();
  const anchor = new THREE.Group();
  const leftWallInnerX = -ROOM.width / 2 + 0.88;

  anchor.position.set(leftWallInnerX, 0, 2);
  anchor.rotation.y = Math.PI / 2;
  scene.add(anchor);

  let isDisposed = false;

  const prepareModel = (object: THREE.Object3D, targetWidth: number) => {
    normalizeModelToGround(object, targetWidth);
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  };

  const updateComputerScreenFrame = () => {
    const halfScreenWidth = COMPUTER_SCREEN_WIDTH / 2;
    const halfScreenHeight = COMPUTER_SCREEN_HEIGHT / 2;

    anchor.updateMatrixWorld(true);
    computerScreenFrameRef.corners = [
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN_CENTER_X - halfScreenWidth,
          COMPUTER_SCREEN_CENTER_Y + halfScreenHeight,
          COMPUTER_SCREEN_CENTER_Z,
        ),
      ),
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN_CENTER_X + halfScreenWidth,
          COMPUTER_SCREEN_CENTER_Y + halfScreenHeight,
          COMPUTER_SCREEN_CENTER_Z,
        ),
      ),
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN_CENTER_X - halfScreenWidth,
          COMPUTER_SCREEN_CENTER_Y - halfScreenHeight,
          COMPUTER_SCREEN_CENTER_Z,
        ),
      ),
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN_CENTER_X + halfScreenWidth,
          COMPUTER_SCREEN_CENTER_Y - halfScreenHeight,
          COMPUTER_SCREEN_CENTER_Z,
        ),
      ),
    ];
  };

  loader.load(DESK_MODEL_PATH, (gltf) => {
    if (isDisposed) return;

    const desk = gltf.scene;
    prepareModel(desk, DESK_TARGET_WIDTH);
    anchor.add(desk);
    computerPickTargets.push(desk);
    anchor.updateMatrixWorld(true);
    computerHintAnchor.copy(
      anchor.localToWorld(
        new THREE.Vector3(-0.08, DESK_SURFACE_HEIGHT + 1.42, -0.02),
      ),
    );
  });

  loader.load(DESKTOP_MODEL_PATH, (gltf) => {
    if (isDisposed) return;

    const desktop = gltf.scene;
    const desktopAnchor = new THREE.Group();

    prepareModel(desktop, DESKTOP_TARGET_WIDTH);
    desktopAnchor.position.set(-0.1, DESK_SURFACE_HEIGHT, -0.01);
    desktopAnchor.rotation.y = 0;
    desktopAnchor.add(desktop);
    anchor.add(desktopAnchor);
    computerPickTargets.push(desktopAnchor);

    anchor.updateMatrixWorld(true);
    updateComputerScreenFrame();
    computerHintAnchor.copy(
      anchor.localToWorld(
        new THREE.Vector3(-0.08, DESK_SURFACE_HEIGHT + 1.42, -0.02),
      ),
    );
    computerFocusCamera.copy(
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN_CENTER_X,
          COMPUTER_SCREEN_CENTER_Y,
          1.15,
        ),
      ),
    );
    computerFocusTarget.copy(
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN_CENTER_X,
          COMPUTER_SCREEN_CENTER_Y,
          COMPUTER_SCREEN_CENTER_Z,
        ),
      ),
    );
  });

  return () => {
    isDisposed = true;
    computerPickTargets.length = 0;
    computerScreenFrameRef.corners = null;
    scene.remove(anchor);
  };
}

function loadWallTvModel(scene: THREE.Scene) {
  const loader = new GLTFLoader();
  const anchor = new THREE.Group();
  const backWallInnerZ = -ROOM.depth / 2 + 0.08;

  anchor.position.set(0, TV_BOTTOM_HEIGHT, backWallInnerZ);
  anchor.rotation.y = 0;
  scene.add(anchor);

  let isDisposed = false;

  loader.load(TV_MODEL_PATH, (gltf) => {
    if (isDisposed) return;

    const tv = gltf.scene;
    normalizeModelToGround(tv, TV_TARGET_WIDTH);
    tv.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    anchor.add(tv);
  });

  return () => {
    isDisposed = true;
    scene.remove(anchor);
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function RoomScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewDirectionRef = useRef<ViewDirection>(0);
  const targetOrbitAngleRef = useRef(0);
  const sceneModeRef = useRef<SceneMode>('explore');
  const [viewDirection, setViewDirection] = useState<ViewDirection>(0);
  const [sceneMode, setSceneMode] = useState<SceneMode>('explore');
  const [isComputerHovered, setIsComputerHovered] = useState(false);
  const [computerHintPosition, setComputerHintPosition] =
    useState<ScreenPosition>({
      x: 0,
      y: 0,
      visible: false,
    });
  const [computerScreenBounds, setComputerScreenBounds] =
    useState<ScreenBounds>({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
      visible: false,
    });

  const controlBaseClass =
    'grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-0 bg-white/60 text-[28px] leading-none font-black text-[#4b382c] transition-[background,box-shadow,transform] duration-200 hover:-translate-y-px hover:bg-[#c8f2c4] hover:shadow-[inset_0_-3px_rgba(63,92,45,0.14)] focus-visible:-translate-y-px focus-visible:bg-[#c8f2c4] focus-visible:shadow-[inset_0_-3px_rgba(63,92,45,0.14)]';
  const activeControlClass =
    '-translate-y-px bg-[#c8f2c4] shadow-[inset_0_-3px_rgba(63,92,45,0.14)]';

  const setView = (nextViewDirection: ViewDirection) => {
    viewDirectionRef.current = nextViewDirection;
    targetOrbitAngleRef.current = getNearestViewAngle(
      targetOrbitAngleRef.current,
      nextViewDirection,
    );
    setViewDirection(nextViewDirection);
  };

  const rotateView = (step: -1 | 1) => {
    const nextViewDirection = ((viewDirectionRef.current +
      step +
      VIEW_DIRECTION_COUNT) %
      VIEW_DIRECTION_COUNT) as ViewDirection;

    viewDirectionRef.current = nextViewDirection;
    targetOrbitAngleRef.current += step * QUARTER_TURN;
    setViewDirection(nextViewDirection);
  };

  const enterComputerMode = useCallback(() => {
    sceneModeRef.current = 'computer';
    setSceneMode('computer');
    setIsComputerHovered(false);
  }, []);

  const exitComputerMode = useCallback(() => {
    sceneModeRef.current = 'explore';
    setSceneMode('explore');
    setIsComputerHovered(false);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const skyColor = '#c9ecff';
    scene.background = new THREE.Color(skyColor);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      100,
    );
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(0, CAMERA_LOOK_HEIGHT, -CAMERA_LOOK_DISTANCE);

    scene.add(new THREE.HemisphereLight('#ffffff', '#b99572', 1.7));
    scene.add(new THREE.AmbientLight('#ffffff', 0.35));

    const lamp = new THREE.PointLight('#ffd59a', 1.35, 10);
    lamp.position.set(-2.8, 2.5, 1.4);
    scene.add(lamp);

    const floorPickTargets: THREE.Object3D[] = [];
    const walls = buildRoom(scene, floorPickTargets);

    const character = buildCharacter();
    character.position.set(0, 0, 0.25);
    scene.add(character);

    const computerPickTargets: THREE.Object3D[] = [];
    const computerFocusCamera = new THREE.Vector3();
    const computerFocusTarget = new THREE.Vector3();
    const computerHintAnchor = new THREE.Vector3();
    const computerScreenFrameRef: ScreenFrameRef = { corners: null };
    const disposeDeskModel = loadDeskModel(
      scene,
      computerPickTargets,
      computerFocusCamera,
      computerFocusTarget,
      computerHintAnchor,
      computerScreenFrameRef,
    );
    const disposeWallTvModel = loadWallTvModel(scene);

    const keys = new Set<string>();
    const targetPosition = new THREE.Vector3(0, 0, 0.25);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    const lookAtTarget = new THREE.Vector3(
      0,
      CAMERA_LOOK_HEIGHT,
      -CAMERA_LOOK_DISTANCE,
    );
    let orbitAngle = targetOrbitAngleRef.current;
    let isHoveringComputer = false;
    let lastHintPosition: ScreenPosition = { x: 0, y: 0, visible: false };
    let lastScreenBounds: ScreenBounds = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
      visible: false,
    };
    let frame = 0;

    const setComputerHoverState = (nextIsHovering: boolean) => {
      if (isHoveringComputer === nextIsHovering) return;

      isHoveringComputer = nextIsHovering;
      setIsComputerHovered(nextIsHovering);
    };

    const setComputerHintScreenPosition = (nextPosition: ScreenPosition) => {
      const roundedPosition = {
        x: Math.round(nextPosition.x),
        y: Math.round(nextPosition.y),
        visible: nextPosition.visible,
      };
      const hasMoved =
        Math.abs(roundedPosition.x - lastHintPosition.x) > 1 ||
        Math.abs(roundedPosition.y - lastHintPosition.y) > 1;

      if (
        roundedPosition.visible !== lastHintPosition.visible ||
        (roundedPosition.visible && hasMoved)
      ) {
        lastHintPosition = roundedPosition;
        setComputerHintPosition(roundedPosition);
      }
    };

    const setComputerScreenBoundsState = (nextBounds: ScreenBounds) => {
      const roundedBounds = {
        x: Math.round(nextBounds.x),
        y: Math.round(nextBounds.y),
        width: Math.round(nextBounds.width),
        height: Math.round(nextBounds.height),
        clipPath: nextBounds.clipPath,
        visible: nextBounds.visible,
      };
      const hasChanged =
        roundedBounds.visible !== lastScreenBounds.visible ||
        roundedBounds.clipPath !== lastScreenBounds.clipPath ||
        Math.abs(roundedBounds.x - lastScreenBounds.x) > 1 ||
        Math.abs(roundedBounds.y - lastScreenBounds.y) > 1 ||
        Math.abs(roundedBounds.width - lastScreenBounds.width) > 1 ||
        Math.abs(roundedBounds.height - lastScreenBounds.height) > 1;

      if (hasChanged) {
        lastScreenBounds = roundedBounds;
        setComputerScreenBounds(roundedBounds);
      }
    };

    const updateComputerScreenBounds = () => {
      if (!computerScreenFrameRef.corners) {
        setComputerScreenBoundsState({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
          visible: false,
        });
        return;
      }

      const projectedCorners = computerScreenFrameRef.corners.map((corner) => {
        const projectedCorner = corner.clone().project(camera);

        return {
          x: (projectedCorner.x * 0.5 + 0.5) * mount.clientWidth,
          y: (-projectedCorner.y * 0.5 + 0.5) * mount.clientHeight,
          z: projectedCorner.z,
        };
      });

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let isVisible = false;

      projectedCorners.forEach((corner) => {
        isVisible = isVisible || (corner.z > -1 && corner.z < 1);

        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      });

      const rawWidth = maxX - minX;
      const rawHeight = maxY - minY;
      const insetLeft = rawWidth * 0.006;
      const insetTop = rawHeight * 0.008;
      const insetRight = rawWidth * 0.006;
      const insetBottom = rawHeight * 0.008;
      const boundsX = minX + insetLeft;
      const boundsY = minY + insetTop;
      const boundsWidth = Math.max(rawWidth - insetLeft - insetRight, 0);
      const boundsHeight = Math.max(rawHeight - insetTop - insetBottom, 0);

      const getClipPoint = (corner: { x: number; y: number }) => {
        const x = clamp(((corner.x - boundsX) / boundsWidth) * 100, 0, 100);
        const y = clamp(((corner.y - boundsY) / boundsHeight) * 100, 0, 100);

        return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
      };

      const clipPath = `polygon(${getClipPoint(
        projectedCorners[0],
      )}, ${getClipPoint(projectedCorners[1])}, ${getClipPoint(
        projectedCorners[3],
      )}, ${getClipPoint(projectedCorners[2])})`;

      setComputerScreenBoundsState({
        x: boundsX,
        y: boundsY,
        width: boundsWidth,
        height: boundsHeight,
        clipPath,
        visible: isVisible && rawWidth > 24 && rawHeight > 18,
      });
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const clampTarget = () => {
      targetPosition.x = THREE.MathUtils.clamp(
        targetPosition.x,
        -ROOM.playerLimitX,
        ROOM.playerLimitX,
      );
      targetPosition.z = THREE.MathUtils.clamp(
        targetPosition.z,
        -ROOM.playerLimitZ,
        ROOM.playerLimitZ,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      renderer.domElement.focus();

      if (sceneModeRef.current === 'computer') {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const computerHit = raycaster.intersectObjects(
        computerPickTargets,
        true,
      )[0];
      if (computerHit) {
        setComputerHoverState(false);
        enterComputerMode();
        return;
      }

      const floorHit = raycaster.intersectObjects(floorPickTargets, false)[0];
      if (!floorHit) return;

      targetPosition.copy(floorHit.point);
      targetPosition.y = 0;
      clampTarget();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (sceneModeRef.current === 'computer') {
        renderer.domElement.style.cursor = 'default';
        setComputerHoverState(false);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const isHoveringComputer =
        raycaster.intersectObjects(computerPickTargets, true).length > 0;
      renderer.domElement.style.cursor = isHoveringComputer
        ? 'pointer'
        : 'default';
      setComputerHoverState(isHoveringComputer);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === 'Escape' || event.key === 'Backspace') &&
        sceneModeRef.current === 'computer'
      ) {
        event.preventDefault();
        exitComputerMode();
        return;
      }

      keys.add(event.key.toLowerCase());
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.04);
      const cameraEase = 1 - Math.pow(0.02, delta);
      orbitAngle = THREE.MathUtils.lerp(
        orbitAngle,
        targetOrbitAngleRef.current,
        cameraEase,
      );
      const { forward: viewForward, right: viewRight } =
        getOrbitVectors(orbitAngle);
      const moveRight =
        (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
        (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const moveForward =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);

      const direction = new THREE.Vector3()
        .addScaledVector(viewRight, moveRight)
        .addScaledVector(viewForward, moveForward);

      if (sceneModeRef.current === 'explore' && direction.lengthSq() > 0) {
        direction.normalize();
        targetPosition.add(direction.multiplyScalar(3.1 * delta));
        clampTarget();
      }

      const before = character.position.clone();
      character.position.lerp(targetPosition, 1 - Math.pow(0.001, delta));
      const movement = character.position.clone().sub(before);

      if (movement.lengthSq() > 0.0002) {
        character.rotation.y = Math.atan2(movement.x, movement.z);
      }

      character.position.y =
        movement.lengthSq() > 0.0002
          ? 0.025 * Math.sin(clock.elapsedTime * 10)
          : 0;

      const desiredCamera = new THREE.Vector3();
      const desiredLookAt = new THREE.Vector3();
      const cameraSideFollow = THREE.MathUtils.clamp(
        character.position.dot(viewRight) * CAMERA_SIDE_FOLLOW,
        -1.35,
        1.35,
      );

      if (sceneModeRef.current === 'computer') {
        desiredCamera.copy(computerFocusCamera);
        desiredLookAt.copy(computerFocusTarget);
      } else {
        desiredCamera
          .copy(viewForward)
          .multiplyScalar(-CAMERA_DISTANCE)
          .addScaledVector(viewRight, cameraSideFollow);
        desiredCamera.y = CAMERA_HEIGHT;

        desiredLookAt
          .copy(viewForward)
          .multiplyScalar(CAMERA_LOOK_DISTANCE)
          .addScaledVector(viewRight, cameraSideFollow);
        desiredLookAt.y = CAMERA_LOOK_HEIGHT;
      }

      const desiredFov =
        sceneModeRef.current === 'computer' ? COMPUTER_CAMERA_FOV : CAMERA_FOV;
      camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov, cameraEase);
      camera.updateProjectionMatrix();
      camera.position.lerp(desiredCamera, cameraEase);
      lookAtTarget.lerp(desiredLookAt, cameraEase);
      camera.lookAt(lookAtTarget);
      updateComputerScreenBounds();

      if (sceneModeRef.current === 'explore' && isHoveringComputer) {
        const projectedHintPosition = computerHintAnchor
          .clone()
          .project(camera);
        setComputerHintScreenPosition({
          x: (projectedHintPosition.x * 0.5 + 0.5) * mount.clientWidth,
          y: (-projectedHintPosition.y * 0.5 + 0.5) * mount.clientHeight,
          visible: projectedHintPosition.z > -1 && projectedHintPosition.z < 1,
        });
      } else {
        setComputerHintScreenPosition({ x: 0, y: 0, visible: false });
      }

      const halfWidth = ROOM.width / 2;
      const halfDepth = ROOM.depth / 2;
      const wallVisibilityMargin = 0.35;
      walls.front.visible =
        camera.position.z < halfDepth + wallVisibilityMargin;
      walls.back.visible =
        camera.position.z > -halfDepth - wallVisibilityMargin;
      walls.right.visible =
        camera.position.x < halfWidth + wallVisibilityMargin;
      walls.left.visible =
        camera.position.x > -halfWidth - wallVisibilityMargin;

      lamp.intensity = 1.35 + 0.05 * Math.sin(clock.elapsedTime * 2.1);

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    resize();
    animate();

    renderer.domElement.tabIndex = 0;
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.style.cursor = 'default';
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      disposeDeskModel();
      disposeWallTvModel();
      renderer.dispose();
    };
  }, [enterComputerMode, exitComputerMode]);

  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
        ref={mountRef}
      />
      {sceneMode === 'explore' ? (
        <section
          className="pointer-events-none absolute top-[clamp(16px,3vw,34px)] left-[clamp(16px,3vw,36px)] z-[2] grid gap-1.5 text-[#fff9e9] [text-shadow:0_2px_12px_rgba(50,34,24,0.42)]"
          aria-label="Room controls">
          <p className="m-0 text-[clamp(34px,5vw,64px)] leading-[0.92] font-black">
            My Room
          </p>
          <span className="max-w-60 text-sm leading-[1.45] font-extrabold opacity-[0.88]">
            WASD / Arrow keys or click the floor to move
          </span>
        </section>
      ) : null}
      {isComputerHovered &&
      sceneMode === 'explore' &&
      computerHintPosition.visible ? (
        <div
          className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-full rounded-full border-2 border-[#4b382c]/20 bg-[#fff6df]/95 px-4 py-2 text-sm font-black text-[#4b382c] shadow-[0_12px_30px_rgba(67,42,28,0.2)]"
          style={{
            left: `${computerHintPosition.x}px`,
            top: `${computerHintPosition.y}px`,
          }}>
          <span>Click computer screen</span>
          <span className="absolute top-full left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-[5px] rotate-45 border-r-2 border-b-2 border-[#4b382c]/20 bg-[#fff6df]/95" />
        </div>
      ) : null}
      <ComputerDesktop
        bounds={computerScreenBounds}
        isFocused={sceneMode === 'computer'}
        onClose={exitComputerMode}
      />
      {sceneMode === 'computer' ? (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          <button
            type="button"
            className="pointer-events-auto absolute top-0 bottom-0 left-0 z-[1] flex w-[clamp(64px,12vw,180px)] cursor-pointer items-center justify-start border-0 bg-transparent px-4 text-[#fff6df] transition-colors duration-200 hover:bg-[#17110e]/12 focus-visible:bg-[#17110e]/16"
            onClick={exitComputerMode}
            aria-label="Back to room from the left side">
            <span className="rounded-full border-2 border-[#fff6df]/70 bg-[#17110e]/58 px-3 py-2 text-xl font-black shadow-[0_10px_28px_rgba(20,12,8,0.28)]">
              {'<'}
            </span>
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute top-0 right-0 bottom-0 z-[1] flex w-[clamp(64px,12vw,180px)] cursor-pointer items-center justify-end border-0 bg-transparent px-4 text-[#fff6df] transition-colors duration-200 hover:bg-[#17110e]/12 focus-visible:bg-[#17110e]/16"
            onClick={exitComputerMode}
            aria-label="Back to room from the right side">
            <span className="rounded-full border-2 border-[#fff6df]/70 bg-[#17110e]/58 px-3 py-2 text-xl font-black shadow-[0_10px_28px_rgba(20,12,8,0.28)]">
              {'>'}
            </span>
          </button>
        </div>
      ) : null}
      {sceneMode === 'explore' ? (
        <div
          className="absolute right-[clamp(16px,3vw,36px)] bottom-[clamp(16px,3vw,32px)] z-[3] flex gap-2 rounded-full border-2 border-[rgba(84,61,43,0.16)] bg-[rgba(255,246,223,0.78)] p-2 shadow-[0_14px_40px_rgba(67,42,28,0.18)] backdrop-blur-[10px]"
          aria-label="Camera view controls">
          <button
            type="button"
            className={controlBaseClass}
            onClick={() => rotateView(1)}
            aria-label="Rotate camera 90 degrees left">
            {'<'}
          </button>
          <button
            type="button"
            className={`${controlBaseClass} ${
              viewDirection === 0 ? activeControlClass : ''
            }`}
            onClick={() => setView(0)}
            aria-label="Return to the default view">
            o
          </button>
          <button
            type="button"
            className={controlBaseClass}
            onClick={() => rotateView(-1)}
            aria-label="Rotate camera 90 degrees right">
            {'>'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
