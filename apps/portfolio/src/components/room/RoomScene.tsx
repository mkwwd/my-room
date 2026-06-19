'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';

import ComputerDesktop, {
  DESKTOP_UI_HEIGHT,
  DESKTOP_UI_WIDTH,
} from './ComputerDesktop';
import RoomCameraControls, {
  RoomCameraController,
  type ViewDirection,
} from './RoomCamera';
import RoomCharacterController from './RoomCharacter';
import {
  COMPUTER_SCREEN,
  DESK_SURFACE_HEIGHT,
  MODEL_TARGET_WIDTH,
  ROOM,
  ROOM_MODELS,
} from './roomConfig';
import RoomEnvironment from './RoomEnvironment';
import { prepareModel } from './RoomModelUtils';

type SceneMode = 'explore' | 'computer';
type ScreenPosition = {
  x: number;
  y: number;
  visible: boolean;
};

function loadDeskModel(
  scene: THREE.Scene,
  computerPickTargets: THREE.Object3D[],
  computerFocusCamera: THREE.Vector3,
  computerFocusTarget: THREE.Vector3,
  computerHintAnchor: THREE.Vector3,
  computerScreen: CSS3DObject,
) {
  const loader = new GLTFLoader();
  const anchor = new THREE.Group();
  const leftWallInnerX = -ROOM.width / 2 + 0.88;

  anchor.position.set(leftWallInnerX, 0, 2);
  anchor.rotation.y = Math.PI / 2;
  scene.add(anchor);

  let isDisposed = false;

  const updateComputerScreenTransform = () => {
    anchor.updateMatrixWorld(true);
    computerScreen.position.copy(
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN.centerX,
          COMPUTER_SCREEN.centerY,
          COMPUTER_SCREEN.centerZ,
        ),
      ),
    );
    anchor.getWorldQuaternion(computerScreen.quaternion);
    computerScreen.scale.set(
      COMPUTER_SCREEN.width / DESKTOP_UI_WIDTH,
      COMPUTER_SCREEN.height / DESKTOP_UI_HEIGHT,
      1,
    );
    computerScreen.userData.isReady = true;
    computerScreen.visible = true;
  };

  loader.load(ROOM_MODELS.desk, (gltf) => {
    if (isDisposed) return;

    const desk = gltf.scene;
    prepareModel(desk, MODEL_TARGET_WIDTH.desk);
    anchor.add(desk);
    computerPickTargets.push(desk);
    anchor.updateMatrixWorld(true);
    computerHintAnchor.copy(
      anchor.localToWorld(
        new THREE.Vector3(-0.08, DESK_SURFACE_HEIGHT + 1.42, -0.02),
      ),
    );
  });

  loader.load(ROOM_MODELS.desktop, (gltf) => {
    if (isDisposed) return;

    const desktop = gltf.scene;
    const desktopAnchor = new THREE.Group();

    prepareModel(desktop, MODEL_TARGET_WIDTH.desktop);
    desktopAnchor.position.set(-0.1, DESK_SURFACE_HEIGHT, -0.01);
    desktopAnchor.rotation.y = 0;
    desktopAnchor.add(desktop);
    anchor.add(desktopAnchor);
    computerPickTargets.push(desktopAnchor);

    anchor.updateMatrixWorld(true);
    updateComputerScreenTransform();
    computerHintAnchor.copy(
      anchor.localToWorld(
        new THREE.Vector3(-0.08, DESK_SURFACE_HEIGHT + 1.42, -0.02),
      ),
    );
    computerFocusCamera.copy(
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN.centerX,
          COMPUTER_SCREEN.centerY,
          1.15,
        ),
      ),
    );
    computerFocusTarget.copy(
      anchor.localToWorld(
        new THREE.Vector3(
          COMPUTER_SCREEN.centerX,
          COMPUTER_SCREEN.centerY,
          COMPUTER_SCREEN.centerZ,
        ),
      ),
    );
  });

  return () => {
    isDisposed = true;
    computerPickTargets.length = 0;
    computerScreen.userData.isReady = false;
    computerScreen.visible = false;
    scene.remove(anchor);
  };
}

export default function RoomScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const computerDesktopHostRef = useRef<HTMLDivElement | null>(null);
  const computerDesktopParkingRef = useRef<HTMLDivElement | null>(null);
  const cameraControllerRef = useRef<RoomCameraController | null>(null);
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
  const setView = (nextViewDirection: ViewDirection) => {
    cameraControllerRef.current?.setView(nextViewDirection);
    setViewDirection(nextViewDirection);
  };

  const rotateView = (step: -1 | 1) => {
    const nextViewDirection = cameraControllerRef.current?.rotate(step);
    if (nextViewDirection === undefined) return;
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
    const computerDesktopHost = computerDesktopHostRef.current;
    if (!mount || !computerDesktopHost) return;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    mount.appendChild(renderer.domElement);

    const cssScene = new THREE.Scene();
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(mount.clientWidth, Math.max(mount.clientHeight, 1));
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.inset = '0';
    cssRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(cssRenderer.domElement);

    const computerScreen = new CSS3DObject(computerDesktopHost);
    computerScreen.visible = false;
    computerScreen.userData.isReady = false;
    computerScreen.element.style.pointerEvents = 'none';
    cssScene.add(computerScreen);

    const cameraController = new RoomCameraController(
      mount.clientWidth / Math.max(mount.clientHeight, 1),
    );
    cameraControllerRef.current = cameraController;
    const camera = cameraController.camera;

    const environment = new RoomEnvironment(scene);

    const characterController = new RoomCharacterController({
      limitX: ROOM.playerLimitX,
      limitZ: ROOM.playerLimitZ,
      initialPosition: [0, 0, 0.25],
    });
    const character = characterController.object;
    scene.add(character);

    const computerPickTargets: THREE.Object3D[] = [];
    const computerFocusCamera = new THREE.Vector3();
    const computerFocusTarget = new THREE.Vector3();
    const computerHintAnchor = new THREE.Vector3();
    const disposeDeskModel = loadDeskModel(
      scene,
      computerPickTargets,
      computerFocusCamera,
      computerFocusTarget,
      computerHintAnchor,
      computerScreen,
    );
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    const computerScreenNormal = new THREE.Vector3();
    const computerToCamera = new THREE.Vector3();
    let isHoveringComputer = false;
    let lastHintPosition: ScreenPosition = { x: 0, y: 0, visible: false };
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

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(mount.clientHeight, 1);
      cameraController.resize(width, height);
      renderer.setSize(width, height);
      cssRenderer.setSize(width, height);
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

      const floorHit = raycaster.intersectObjects(
        environment.floorPickTargets,
        false,
      )[0];
      if (!floorHit) return;

      characterController.moveTo(floorHit.point);
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

      characterController.pressKey(event.key);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      characterController.releaseKey(event.key);
    };

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.04);
      const cameraFrame = cameraController.beginFrame(delta);
      const { forward: viewForward, right: viewRight } = cameraFrame;
      characterController.update({
        delta,
        elapsedTime: clock.elapsedTime,
        movementEnabled: sceneModeRef.current === 'explore',
        viewForward,
        viewRight,
      });

      cameraController.follow({
        frame: cameraFrame,
        mode: sceneModeRef.current,
        characterPosition: character.position,
        focusPosition: computerFocusCamera,
        focusTarget: computerFocusTarget,
      });

      if (computerScreen.userData.isReady) {
        computerScreenNormal
          .set(0, 0, 1)
          .applyQuaternion(computerScreen.quaternion);
        computerToCamera
          .copy(camera.position)
          .sub(computerScreen.position)
          .normalize();
        computerScreen.visible =
          computerScreenNormal.dot(computerToCamera) > 0.02;
      }

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

      cameraController.updateWallVisibility(
        environment.walls,
        ROOM.width,
        ROOM.depth,
      );
      environment.update(clock.elapsedTime);

      renderer.render(scene, camera);
      cssRenderer.render(cssScene, camera);
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
      characterController.clearInput();
      mount.removeChild(renderer.domElement);
      cssScene.remove(computerScreen);
      mount.removeChild(cssRenderer.domElement);
      computerDesktopParkingRef.current?.appendChild(computerDesktopHost);
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
      environment.dispose();
      renderer.dispose();
      if (cameraControllerRef.current === cameraController) {
        cameraControllerRef.current = null;
      }
    };
  }, [enterComputerMode, exitComputerMode]);

  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
        ref={mountRef}
      />
      <div
        className="hidden"
        ref={computerDesktopParkingRef}
        aria-hidden="true">
        <div
          ref={computerDesktopHostRef}
          style={{
            width: `${DESKTOP_UI_WIDTH}px`,
            height: `${DESKTOP_UI_HEIGHT}px`,
            overflow: 'hidden',
            backfaceVisibility: 'hidden',
            pointerEvents: 'none',
          }}>
          <ComputerDesktop
            isFocused={sceneMode === 'computer'}
            onClose={exitComputerMode}
          />
        </div>
      </div>
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
        <RoomCameraControls
          viewDirection={viewDirection}
          onRotate={rotateView}
          onReset={() => setView(0)}
        />
      ) : null}
    </div>
  );
}
