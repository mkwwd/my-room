'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

import ComputerDesktop, {
  DESKTOP_UI_HEIGHT,
  DESKTOP_UI_WIDTH,
} from './ComputerDesktop';
import ComputerStation from './ComputerStation';
import RoomCameraControls, {
  RoomCameraController,
  type ViewDirection,
} from './RoomCamera';
import RoomCharacterController from './RoomCharacter';
import { ROOM, type SceneMode } from './roomConfig';
import RoomEnvironment from './RoomEnvironment';
import RoomInteractionController, {
  type ScreenPosition,
} from './RoomInteractionController';

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

    const computerStation = new ComputerStation(
      scene,
      cssScene,
      computerDesktopHost,
    );

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

    const clock = new THREE.Clock();
    let frame = 0;
    const interactionController = new RoomInteractionController({
      canvas: renderer.domElement,
      camera,
      computerStation,
      environment,
      character: characterController,
      getSceneMode: () => sceneModeRef.current,
      onEnterComputer: enterComputerMode,
      onExitComputer: exitComputerMode,
      onComputerHoverChange: setIsComputerHovered,
      onHintPositionChange: setComputerHintPosition,
    });

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(mount.clientHeight, 1);
      cameraController.resize(width, height);
      renderer.setSize(width, height);
      cssRenderer.setSize(width, height);
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
        focusPosition: computerStation.focusPosition,
        focusTarget: computerStation.focusTarget,
      });
      computerStation.update(camera);

      interactionController.updateHint(mount.clientWidth, mount.clientHeight);

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

    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      interactionController.dispose();
      mount.removeChild(renderer.domElement);
      mount.removeChild(cssRenderer.domElement);
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
      computerStation.dispose();
      environment.dispose();
      computerDesktopParkingRef.current?.appendChild(computerDesktopHost);
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
