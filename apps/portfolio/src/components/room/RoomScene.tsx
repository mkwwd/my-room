'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';

import ComputerDesktopLayer from '../computer/ComputerDesktopLayer';
import ComputerStation from '../computer/ComputerStation';
import { DESKTOP_UI_HEIGHT, DESKTOP_UI_WIDTH } from '../computer/desktopConfig';
import TvScreenLayer from '../tv/TvScreenLayer';
import TvStation from '../tv/TvStation';
import { TV_UI_HEIGHT, TV_UI_WIDTH } from '../tv/tvConfig';

import { RoomCameraController, type ViewDirection } from './RoomCamera';
import RoomCharacterController from './RoomCharacter';
import { ROOM, type FocusMode, type SceneMode } from './roomConfig';
import RoomEnvironment from './RoomEnvironment';
import RoomHud from './RoomHud';
import RoomInteractionController, {
  type ScreenPosition,
} from './RoomInteractionController';
import { createScreenTransform } from './screenTransform';

function syncScreenLayer(
  layer: HTMLDivElement | null,
  transform: string | null,
  isInteractive: boolean,
) {
  if (!layer) return;

  if (transform) {
    layer.style.visibility = 'visible';
    layer.style.pointerEvents = isInteractive ? 'auto' : 'none';
    layer.style.transform = transform;
    return;
  }

  layer.style.visibility = 'hidden';
  layer.style.pointerEvents = 'none';
}

export default function RoomScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const computerDesktopLayerRef = useRef<HTMLDivElement | null>(null);
  const tvScreenLayerRef = useRef<HTMLDivElement | null>(null);
  const cameraControllerRef = useRef<RoomCameraController | null>(null);
  const sceneModeRef = useRef<SceneMode>('explore');
  const [viewDirection, setViewDirection] = useState<ViewDirection>(0);
  const [sceneMode, setSceneMode] = useState<SceneMode>('explore');
  const [hoveredTarget, setHoveredTarget] = useState<FocusMode | null>(null);
  const [hintPosition, setHintPosition] = useState<ScreenPosition>({
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

  const enterFocusMode = useCallback((target: FocusMode) => {
    sceneModeRef.current = target;
    setSceneMode(target);
    setHoveredTarget(null);
  }, []);

  const exitFocusMode = useCallback(() => {
    sceneModeRef.current = 'explore';
    setSceneMode('explore');
    setHoveredTarget(null);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    mount.appendChild(renderer.domElement);

    const computerStation = new ComputerStation(scene);
    const tvStation = new TvStation(scene);

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
      stations: {
        computer: computerStation,
        tv: tvStation,
      },
      environment,
      character: characterController,
      getSceneMode: () => sceneModeRef.current,
      onEnterFocus: enterFocusMode,
      onExitFocus: exitFocusMode,
      onHoverTargetChange: setHoveredTarget,
      onHintPositionChange: setHintPosition,
    });

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(mount.clientHeight, 1);
      cameraController.resize(width, height);
      renderer.setSize(width, height);
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

      const focusedStation =
        sceneModeRef.current === 'tv' ? tvStation : computerStation;
      cameraController.follow({
        frame: cameraFrame,
        mode: sceneModeRef.current,
        characterPosition: character.position,
        focusPosition: focusedStation.focusPosition,
        focusTarget: focusedStation.focusTarget,
      });
      const isComputerMode = sceneModeRef.current === 'computer';
      const computerViewport = computerStation.getScreenViewport(
        camera,
        mount.clientWidth,
        mount.clientHeight,
      );
      const computerTransform = computerViewport
        ? createScreenTransform(
            computerViewport,
            DESKTOP_UI_WIDTH,
            DESKTOP_UI_HEIGHT,
          )
        : null;
      syncScreenLayer(
        computerDesktopLayerRef.current,
        computerTransform,
        isComputerMode,
      );

      const isTvMode = sceneModeRef.current === 'tv';
      const tvViewport = tvStation.getScreenViewport(
        camera,
        mount.clientWidth,
        mount.clientHeight,
      );
      const tvTransform = tvViewport
        ? createScreenTransform(tvViewport, TV_UI_WIDTH, TV_UI_HEIGHT)
        : null;
      syncScreenLayer(tvScreenLayerRef.current, tvTransform, isTvMode);

      interactionController.updateHint(mount.clientWidth, mount.clientHeight);

      cameraController.updateWallVisibility(
        environment.walls,
        ROOM.width,
        ROOM.depth,
      );
      environment.update(clock.elapsedTime);

      renderer.render(scene, camera);
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
      tvStation.dispose();
      environment.dispose();
      renderer.dispose();
      if (cameraControllerRef.current === cameraController) {
        cameraControllerRef.current = null;
      }
    };
  }, [enterFocusMode, exitFocusMode]);

  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
        ref={mountRef}
      />
      <ComputerDesktopLayer
        ref={computerDesktopLayerRef}
        isFocused={sceneMode === 'computer'}
        onClose={exitFocusMode}
      />
      <TvScreenLayer
        ref={tvScreenLayerRef}
        isFocused={sceneMode === 'tv'}
      />
      <RoomHud
        sceneMode={sceneMode}
        hoveredTarget={hoveredTarget}
        hintPosition={hintPosition}
        viewDirection={viewDirection}
        onExitFocus={exitFocusMode}
        onRotateView={rotateView}
        onResetView={() => setView(0)}
      />
    </div>
  );
}
