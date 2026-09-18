'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';

import ComputerDesktopLayer from '../computer/ComputerDesktopLayer';
import ComputerStation from '../computer/ComputerStation';
import { DESKTOP_UI_HEIGHT, DESKTOP_UI_WIDTH } from '../computer/desktopConfig';
import { TV_UI_HEIGHT, TV_UI_WIDTH } from '../tv/tvConfig';
import TvScreenLayer from '../tv/TvScreenLayer';
import TvStation from '../tv/TvStation';

import { RoomCameraController, type ViewDirection } from './RoomCamera';
import RoomCatController from './RoomCat';
import RoomCharacterController from './RoomCharacter';
import {
  ROOM,
  ROOM_COLLISION_BOXES,
  ROOM_DEPTH_BOUNDS,
  ROOM_SOFA_SEAT,
  type FocusMode,
  type RoomHoverTarget,
  type SceneMode,
} from './roomConfig';
import RoomEntrance from './RoomEntrance';
import RoomEnvironment from './RoomEnvironment';
import RoomHud from './RoomHud';
import RoomInteractionController, {
  type HintPositions,
} from './RoomInteractionController';
import RoomLoadingGate, { type RoomLoadingPhase } from './RoomLoadingGate';
import RoomLoadingScreen from './RoomLoadingScreen';
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
  const interactionControllerRef = useRef<RoomInteractionController | null>(
    null,
  );
  const hoveredTargetRef = useRef<RoomHoverTarget | null>(null);
  const sceneModeRef = useRef<SceneMode>('explore');
  const canInteractRef = useRef(false);
  const [loadingPhase, setLoadingPhase] = useState<RoomLoadingPhase>('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewDirection, setViewDirection] = useState<ViewDirection>(0);
  const [sceneMode, setSceneMode] = useState<SceneMode>('explore');
  const [lightsOn, setLightsOn] = useState(true);
  const [hintPositions, setHintPositions] = useState<HintPositions>({});
  const finishEntry = useCallback(() => {
    canInteractRef.current = true;
    setLoadingPhase('ready');
  }, []);
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
    hoveredTargetRef.current = null;
  }, []);

  const exitFocusMode = useCallback(() => {
    sceneModeRef.current = 'explore';
    setSceneMode('explore');
    hoveredTargetRef.current = null;
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let renderReady = false;
    let loadFailed = false;
    let openingPublished = false;
    canInteractRef.current = false;

    const scene = new THREE.Scene();
    const room = new THREE.Scene();
    room.visible = false;
    scene.add(room);
    scene.background = new THREE.Color('#dddeda');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => {
        if (!disposed) setLoadingPhase('error');
      });
      return () => {
        disposed = true;
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.localClippingEnabled = false;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    mount.appendChild(renderer.domElement);

    const loading = new RoomLoadingGate(
      async () => {
        await document.fonts.ready;
        if (disposed) return;
        const textures = new Set<THREE.Texture>();
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite))
            return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            for (const value of Object.values(material)) {
              if (value instanceof THREE.Texture) textures.add(value);
            }
          }
        });
        textures.forEach((texture) => renderer.initTexture(texture));
        room.visible = true;
        const compilation = renderer.compileAsync(scene, camera);
        room.visible = false;
        await compilation;
        if (disposed) return;
        renderer.render(scene, camera);
        renderReady = true;
      },
      () => {},
      () => {
        renderReady = false;
        loadFailed = true;
        canInteractRef.current = false;
        setLoadingPhase('error');
      },
      setLoadingProgress,
    );
    const manager = loading.manager;
    const cameraController = new RoomCameraController(
      mount.clientWidth / Math.max(mount.clientHeight, 1),
    );
    cameraControllerRef.current = cameraController;
    const camera = cameraController.camera;
    const entrance = new RoomEntrance(
      camera.position,
      camera.aspect,
      ROOM_DEPTH_BOUNDS.front,
    );
    scene.add(entrance.root);
    cameraController.setPose(
      entrance.cameraPosition,
      entrance.cameraTarget,
      entrance.fov,
    );
    const catController = new RoomCatController({
      manager,
      initialPosition: entrance.catStart.toArray() as [number, number, number],
    });
    const cat = catController.object;
    scene.add(cat);
    const computerStation = new ComputerStation(room, manager);
    const tvStation = new TvStation(room, manager);

    const environment = new RoomEnvironment(room, manager);
    const stations = {
      computer: computerStation,
      tv: tvStation,
      window: environment.roomWindow,
      aquarium: environment.aquarium,
    };

    const characterController = new RoomCharacterController({
      manager,
      limitX: ROOM.playerLimitX,
      limitZ: ROOM.playerLimitZ,
      limitBackZ: ROOM.playerLimitZ,
      limitFrontZ: ROOM_DEPTH_BOUNDS.front - 0.35,
      initialPosition: [0, 0, 0.25],
      collisionBoxes: ROOM_COLLISION_BOXES,
      sofaSeat: ROOM_SOFA_SEAT,
    });
    const character = characterController.object;
    room.add(character);

    const clock = new THREE.Clock();
    let frame = 0;
    const interactionController = new RoomInteractionController({
      canvas: renderer.domElement,
      camera,
      stations,
      environment,
      character: characterController,
      getSceneMode: () => sceneModeRef.current,
      isEnabled: () => canInteractRef.current,
      onEnterFocus: enterFocusMode,
      onExitFocus: exitFocusMode,
      onHoverTargetChange: (target) => {
        hoveredTargetRef.current = target;
      },
      onHintPositionsChange: setHintPositions,
      onToggleLights: () => setLightsOn(environment.toggleLights()),
    });
    interactionControllerRef.current = interactionController;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const viewportSize = {
      width: mount.clientWidth,
      height: Math.max(mount.clientHeight, 1),
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(mount.clientHeight, 1);
      viewportSize.width = width;
      viewportSize.height = height;
      cameraController.resize(width, height);
      environment.aquarium.resize(width / height);
      renderer.setSize(width, height);
    };

    const animate = () => {
      const frameDelta = Math.min(clock.getDelta(), 0.25);
      const delta = Math.min(frameDelta, 0.04);
      const cameraFrame = cameraController.beginFrame(frameDelta);
      const { forward: viewForward, right: viewRight } = cameraFrame;
      characterController.update({
        delta,
        elapsedTime: clock.elapsedTime,
        movementEnabled:
          canInteractRef.current && sceneModeRef.current === 'explore',
        viewForward,
        viewRight,
      });
      if (!entrance.complete && !loadFailed) {
        entrance.update(
          frameDelta,
          renderReady,
          cat.children.length ? cat.position : null,
          reducedMotion.matches,
        );
        if (cat.children.length && !reducedMotion.matches)
          catController.walkTo(entrance.catTarget, delta, clock.elapsedTime);
        entrance.updateCatShadow(cat);
        cameraController.setPose(
          entrance.cameraPosition,
          entrance.cameraTarget,
          entrance.fov,
        );
        if (entrance.opening && !openingPublished) {
          openingPublished = true;
          setLoadingPhase('opening');
        }
        if (entrance.complete) {
          if (reducedMotion.matches) cat.position.set(0.75, 0, 1.05);
          entrance.dispose();
          finishEntry();
        }
      } else if (!loadFailed)
        catController.update({
          delta,
          elapsedTime: clock.elapsedTime,
          followTarget: character,
          movementEnabled:
            canInteractRef.current && sceneModeRef.current === 'explore',
        });

      const focusedStation =
        stations[
          sceneModeRef.current === 'explore' ? 'computer' : sceneModeRef.current
        ];
      if (entrance.complete)
        cameraController.follow({
          frame: cameraFrame,
          mode: sceneModeRef.current,
          characterPosition: character.position,
          focusPosition: focusedStation.focusPosition,
          focusTarget: focusedStation.focusTarget,
        });
      const isComputerMode = sceneModeRef.current === 'computer';
      const computerViewport = isComputerMode
        ? computerStation.getScreenViewport(
            camera,
            viewportSize.width,
            viewportSize.height,
          )
        : null;
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
      if (isTvMode) tvStation.turnOn();
      const tvViewport = tvStation.getScreenViewport(
        camera,
        viewportSize.width,
        viewportSize.height,
      );
      const tvTransform = tvViewport
        ? createScreenTransform(tvViewport, TV_UI_WIDTH, TV_UI_HEIGHT)
        : null;
      syncScreenLayer(tvScreenLayerRef.current, tvTransform, isTvMode);

      cameraController.updateWallVisibility(
        environment.walls,
        ROOM.width,
        ROOM_DEPTH_BOUNDS.depth,
        ROOM_DEPTH_BOUNDS.centerZ,
      );
      if (!entrance.complete) environment.walls.front.visible = false;
      interactionController.updateHint(viewportSize.width, viewportSize.height);
      const hoverDelta = reducedMotion.matches ? 1 : frameDelta;
      computerStation.updateHover(
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'computer',
        hoverDelta,
      );
      tvStation.updateHover(
        sceneModeRef.current === 'explore' && hoveredTargetRef.current === 'tv',
        hoverDelta,
      );
      environment.roomWindow.updateHover(
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'window',
        hoverDelta,
      );
      environment.updateSofaHover(
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'sofa',
        hoverDelta,
      );
      environment.aquarium.updateHover(
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'aquarium',
        hoverDelta,
      );
      environment.update(
        clock.elapsedTime,
        hoverDelta,
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'lightSwitch',
      );

      room.visible = renderReady && (entrance.opening || entrance.complete);
      if (
        renderReady &&
        scene.background instanceof THREE.Color &&
        room.background instanceof THREE.Color
      ) {
        scene.background.lerp(room.background, 1 - Math.exp(-3 * frameDelta));
      }
      if (entrance.complete) scene.background = room.background;
      if (!loadFailed) renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    resize();
    animate();
    loading.completeSetup();

    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      canInteractRef.current = false;
      loading.dispose();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      interactionController.dispose();
      interactionControllerRef.current = null;
      mount.removeChild(renderer.domElement);
      characterController.dispose();
      catController.dispose();
      entrance.dispose();
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
  }, [enterFocusMode, exitFocusMode, finishEntry]);

  return (
    <div className="absolute inset-0" aria-busy={loadingPhase !== 'ready'}>
      <div
        className="absolute inset-0"
        inert={loadingPhase !== 'ready'}
        aria-hidden={loadingPhase !== 'ready'}>
        <div
          className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
          ref={mountRef}
        />
        <ComputerDesktopLayer
          ref={computerDesktopLayerRef}
          isFocused={sceneMode === 'computer'}
          onClose={exitFocusMode}
        />
        <TvScreenLayer ref={tvScreenLayerRef} isFocused={sceneMode === 'tv'} />
        {loadingPhase === 'ready' && (
          <RoomHud
            lightsOn={lightsOn}
            sceneMode={sceneMode}
            hintPositions={hintPositions}
            onHoverTarget={(target) =>
              interactionControllerRef.current?.setHoveredTarget(target)
            }
            onActivateTarget={(target) =>
              interactionControllerRef.current?.activateTarget(target)
            }
            viewDirection={viewDirection}
            onExitFocus={exitFocusMode}
            onRotateView={rotateView}
            onResetView={() => setView(0)}
          />
        )}
      </div>
      {loadingPhase !== 'ready' && (
        <RoomLoadingScreen phase={loadingPhase} progress={loadingProgress} />
      )}
    </div>
  );
}
