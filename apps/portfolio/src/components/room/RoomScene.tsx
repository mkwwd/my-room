'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import * as THREE from 'three';

import ComputerDesktopLayer from '../computer/ComputerDesktopLayer';
import ComputerStation from '../computer/ComputerStation';
import { DESKTOP_UI_HEIGHT, DESKTOP_UI_WIDTH } from '../computer/desktopConfig';
import { GalleryContext } from '../gallery/GalleryContext';
import {
  DEFAULT_GALLERY_SELECTION,
  GALLERY_FRAME_IDS,
  getGalleryStorage,
  readGallerySelection,
  saveGallerySelection,
  type GalleryFrameId,
  type GallerySelection,
} from '../gallery/gallerySelection';
import { TV_SCREEN, TV_UI_HEIGHT, TV_UI_WIDTH } from '../tv/tvConfig';
import TvScreenLayer from '../tv/TvScreenLayer';
import TvStation from '../tv/TvStation';

import { RoomCameraController, type ViewDirection } from './RoomCamera';
import RoomCatController from './RoomCat';
import RoomCharacterController from './RoomCharacter';
import {
  COMPUTER_SCREEN,
  ROOM,
  ROOM_COLLISION_BOXES,
  ROOM_DEPTH_BOUNDS,
  ROOM_SEATS,
  type FocusMode,
  type RoomHoverTarget,
  type SceneMode,
} from './roomConfig';
import RoomEntrance from './RoomEntrance';
import RoomEnvironment from './RoomEnvironment';
import type { FloorLampMode } from './RoomFloorLamp';
import RoomHud from './RoomHud';
import RoomInteractionController, {
  type HintPositions,
} from './RoomInteractionController';
import RoomLoadingGate, { type RoomLoadingPhase } from './RoomLoadingGate';
import RoomLoadingScreen from './RoomLoadingScreen';
import RoomOrientationNotice from './RoomOrientationNotice';
import orientationStyles from './RoomOrientationNotice.module.css';
import RoomPictureFrame, { FRAME_LAYOUT } from './RoomPictureFrame';
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
  const framesRef = useRef<Record<GalleryFrameId, RoomPictureFrame> | null>(
    null,
  );
  const gallerySelectionRef = useRef(DEFAULT_GALLERY_SELECTION);
  const [unavailableFrames, setUnavailableFrames] = useState<
    Partial<Record<GalleryFrameId, boolean>>
  >({});
  const [gallerySelection, setGallerySelection] = useState<GallerySelection>(
    DEFAULT_GALLERY_SELECTION,
  );
  const [loadingPhase, setLoadingPhase] = useState<RoomLoadingPhase>('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const [viewDirection, setViewDirection] = useState<ViewDirection>(0);
  const [sceneMode, setSceneMode] = useState<SceneMode>('explore');
  const [lightsOn, setLightsOn] = useState(true);
  const [floorLampMode, setFloorLampMode] = useState<FloorLampMode>('warm');
  const [windowOpen, setWindowOpen] = useState(false);
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
    interactionControllerRef.current?.setHoveredTarget(null);
    sceneModeRef.current = 'explore';
    setSceneMode('explore');
    hoveredTargetRef.current = null;
  }, []);

  const applyGallerySelection = useCallback(
    async (frame: GalleryFrameId, imageId: string) => {
      const frames = framesRef.current;
      if (!frames) throw new Error('방을 불러온 뒤 다시 적용해 주세요.');
      await frames[frame].setImage(imageId);
      if (framesRef.current !== frames)
        throw new Error('방을 다시 불러왔어요. 다시 적용해 주세요.');
      const next = { ...gallerySelectionRef.current, [frame]: imageId };
      gallerySelectionRef.current = next;
      setGallerySelection(next);
      setUnavailableFrames((current) => ({ ...current, [frame]: false }));
      if (!saveGallerySelection(getGalleryStorage(), next))
        throw new Error(
          '액자에는 적용했지만 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.',
        );
    },
    [],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let renderReady = false;
    let loadFailed = false;
    let openingPublished = false;
    let portraitViewport = window.innerWidth < window.innerHeight;
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
      Math.max(1, camera.aspect),
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
    const selection = readGallerySelection(getGalleryStorage());
    gallerySelectionRef.current = selection;
    const frames = {
      portrait: new RoomPictureFrame(environment.walls.left, 'portrait'),
      landscape: new RoomPictureFrame(environment.walls.left, 'landscape'),
      square: new RoomPictureFrame(environment.walls.left, 'square'),
    };
    framesRef.current = frames;
    // Restore before the loading gate closes, so the entrance never reveals defaults first.
    for (const id of GALLERY_FRAME_IDS) {
      void frames[id].loadInitial(selection[id], manager).then((loaded) => {
        if (!disposed)
          setUnavailableFrames((current) => ({ ...current, [id]: !loaded }));
      });
    }
    queueMicrotask(() => {
      if (!disposed) {
        setGallerySelection(selection);
        setWindowOpen(false);
        setFloorLampMode('warm');
      }
    });
    const stations = {
      computer: computerStation,
      tv: tvStation,
      window: environment.roomWindow,
      aquarium: environment.aquarium,
      ...frames,
    };

    const characterController = new RoomCharacterController({
      manager,
      limitX: ROOM.playerLimitX,
      limitZ: ROOM.playerLimitZ,
      limitBackZ: ROOM.playerLimitZ,
      limitFrontZ: ROOM_DEPTH_BOUNDS.front - 0.35,
      initialPosition: [0, 0, 0.25],
      collisionBoxes: ROOM_COLLISION_BOXES,
      seats: ROOM_SEATS,
    });
    const character = characterController.object;
    room.add(character);

    const clock = new THREE.Clock();
    let frame = 0;
    const interactionController = new RoomInteractionController({
      canvas: renderer.domElement,
      camera,
      stations,
      chair: computerStation.chair,
      environment,
      character: characterController,
      getSceneMode: () => sceneModeRef.current,
      isEnabled: () => canInteractRef.current && !portraitViewport,
      onEnterFocus: enterFocusMode,
      onExitFocus: exitFocusMode,
      onHoverTargetChange: (target) => {
        hoveredTargetRef.current = target;
      },
      onHintPositionsChange: setHintPositions,
      onToggleLights: () => setLightsOn(environment.toggleLights()),
      onCycleFloorLamp: () => setFloorLampMode(environment.floorLamp.cycle()),
      onToggleWindow: () => setWindowOpen(environment.roomWindow.toggle()),
    });
    interactionControllerRef.current = interactionController;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const viewportSize = {
      width: mount.clientWidth,
      height: Math.max(mount.clientHeight, 1),
    };

    const resize = () => {
      portraitViewport = window.innerWidth < window.innerHeight;
      setIsPortrait(portraitViewport);
      if (portraitViewport) {
        characterController.clearInput();
        interactionController.setHoveredTarget(null);
      }
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
      // Keep the loaded scene and entry pose, but do not advance behind the notice.
      if (portraitViewport) {
        frame = requestAnimationFrame(animate);
        return;
      }
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
          focusWidth:
            sceneModeRef.current === 'computer'
              ? COMPUTER_SCREEN.width
              : sceneModeRef.current === 'tv'
                ? TV_SCREEN.width
                : sceneModeRef.current === 'portrait' ||
                    sceneModeRef.current === 'landscape' ||
                    sceneModeRef.current === 'square'
                  ? FRAME_LAYOUT[sceneModeRef.current].width
                  : undefined,
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
      computerStation.updateChairHover(
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'chair',
        hoverDelta,
      );
      tvStation.updateHover(
        sceneModeRef.current === 'explore' && hoveredTargetRef.current === 'tv',
        hoverDelta,
      );
      environment.roomWindow.updateHover(
        (sceneModeRef.current === 'explore' ||
          sceneModeRef.current === 'window') &&
          hoveredTargetRef.current === 'window',
        hoverDelta,
      );
      for (const id of GALLERY_FRAME_IDS) {
        frames[id].updateHover(
          sceneModeRef.current === 'explore' && hoveredTargetRef.current === id,
          hoverDelta,
        );
      }
      environment.updateSofaHover(
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'sofa',
        hoverDelta,
      );
      environment.floorLamp.update(
        hoverDelta,
        sceneModeRef.current === 'explore' &&
          hoveredTargetRef.current === 'floorLamp',
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
      environment.floorLamp.dispose();
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
      for (const id of GALLERY_FRAME_IDS) frames[id].dispose();
      if (framesRef.current === frames) framesRef.current = null;
      renderer.dispose();
      if (cameraControllerRef.current === cameraController) {
        cameraControllerRef.current = null;
      }
    };
  }, [enterFocusMode, exitFocusMode, finishEntry]);

  return (
    <>
      <div
        className={orientationStyles.scene}
        aria-busy={loadingPhase !== 'ready'}
        inert={isPortrait}
        aria-hidden={isPortrait}>
        <div
          className="absolute inset-0"
          inert={loadingPhase !== 'ready'}
          aria-hidden={loadingPhase !== 'ready'}>
          <div
            className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
            ref={mountRef}
          />
          <GalleryContext.Provider
            value={{
              selection: gallerySelection,
              unavailableFrames,
              applySelection: applyGallerySelection,
            }}>
            <ComputerDesktopLayer
              ref={computerDesktopLayerRef}
              isFocused={sceneMode === 'computer'}
            />
          </GalleryContext.Provider>
          <TvScreenLayer
            ref={tvScreenLayerRef}
            isFocused={sceneMode === 'tv'}
          />
          {loadingPhase === 'ready' && (
            <RoomHud
              lightsOn={lightsOn}
              floorLampMode={floorLampMode}
              windowOpen={windowOpen}
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
      <RoomOrientationNotice />
    </>
  );
}
