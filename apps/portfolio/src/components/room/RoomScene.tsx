'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';

import ComputerDesktopLayer from '../computer/ComputerDesktopLayer';
import ComputerStation from '../computer/ComputerStation';
import { createComputerScreenTransform } from '../computer/computerScreenTransform';
import { DESKTOP_UI_HEIGHT, DESKTOP_UI_WIDTH } from '../computer/desktopConfig';

import { RoomCameraController, type ViewDirection } from './RoomCamera';
import RoomCharacterController from './RoomCharacter';
import { ROOM, type SceneMode } from './roomConfig';
import RoomEnvironment from './RoomEnvironment';
import RoomHud from './RoomHud';
import RoomInteractionController, {
  type ScreenPosition,
} from './RoomInteractionController';

export default function RoomScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const computerDesktopLayerRef = useRef<HTMLDivElement | null>(null);
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
      const isComputerMode = sceneModeRef.current === 'computer';
      const desktopLayer = computerDesktopLayerRef.current;
      const screenViewport = computerStation.getScreenViewport(
        camera,
        mount.clientWidth,
        mount.clientHeight,
      );
      const screenTransform = screenViewport
        ? createComputerScreenTransform(
            screenViewport,
            DESKTOP_UI_WIDTH,
            DESKTOP_UI_HEIGHT,
          )
        : null;
      if (desktopLayer && screenTransform) {
        desktopLayer.style.visibility = 'visible';
        desktopLayer.style.pointerEvents = isComputerMode ? 'auto' : 'none';
        desktopLayer.style.transform = screenTransform;
      } else if (desktopLayer) {
        desktopLayer.style.visibility = 'hidden';
        desktopLayer.style.pointerEvents = 'none';
      }

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
      <ComputerDesktopLayer
        ref={computerDesktopLayerRef}
        isFocused={sceneMode === 'computer'}
        onClose={exitComputerMode}
      />
      <RoomHud
        sceneMode={sceneMode}
        isComputerHovered={isComputerHovered}
        computerHintPosition={computerHintPosition}
        viewDirection={viewDirection}
        onExitComputer={exitComputerMode}
        onRotateView={rotateView}
        onResetView={() => setView(0)}
      />
    </div>
  );
}
