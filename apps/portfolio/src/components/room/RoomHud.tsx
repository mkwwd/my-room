import RoomCameraControls, { type ViewDirection } from './RoomCamera';
import type { RoomHoverTarget, SceneMode } from './roomConfig';
import styles from './RoomHud.module.css';
import {
  ROOM_MARKER_TARGETS,
  type HintPositions,
} from './RoomInteractionController';

type RoomHudProps = {
  lightsOn: boolean;
  sceneMode: SceneMode;
  hintPositions: HintPositions;
  onHoverTarget: (target: RoomHoverTarget | null) => void;
  onActivateTarget: (target: RoomHoverTarget) => void;
  viewDirection: ViewDirection;
  onExitFocus: () => void;
  onRotateView: (step: -1 | 1) => void;
  onResetView: () => void;
};

const TARGET_ACTIONS = {
  computer: 'Open computer',
  tv: 'Watch TV',
  window: 'Look through window',
  sofa: 'Sit or stand up',
  lightSwitch: 'Room lights',
};

export default function RoomHud({
  lightsOn,
  sceneMode,
  hintPositions,
  onHoverTarget,
  onActivateTarget,
  viewDirection,
  onExitFocus,
  onRotateView,
  onResetView,
}: RoomHudProps) {
  return (
    <>
      {sceneMode === 'explore' ? (
        <section
          className="pointer-events-none absolute top-[clamp(16px,3vw,34px)] left-[clamp(16px,3vw,36px)] z-[2] grid gap-1.5 text-[#fff9e9] [text-shadow:0_2px_12px_rgba(50,34,24,0.42)]"
          aria-label="Room controls">
          <p className="m-0 text-[clamp(34px,5vw,64px)] leading-[0.92] font-black">
            My Room
          </p>
          <span className="max-w-60 text-sm leading-[1.45] font-extrabold opacity-[0.88]">
            WASD / Arrow keys or click the floor to move / Press E near sofa to
            sit
          </span>
        </section>
      ) : null}

      {sceneMode === 'explore' &&
        ROOM_MARKER_TARGETS.map((target) => {
          const position = hintPositions[target];
          if (!position?.visible) return null;
          return (
            <button
              key={target}
              type="button"
              aria-label={TARGET_ACTIONS[target]}
              aria-pressed={target === 'lightSwitch' ? lightsOn : undefined}
              data-room-target={target}
              className={styles.keyboardTarget}
              style={{ left: position.x, top: position.y }}
              onFocus={() => onHoverTarget(target)}
              onPointerEnter={() => onHoverTarget(target)}
              onPointerLeave={() => onHoverTarget(null)}
              onBlur={() => onHoverTarget(null)}
              onClick={() => onActivateTarget(target)}
            />
          );
        })}

      {sceneMode !== 'explore' ? (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          <button
            type="button"
            className="pointer-events-auto absolute top-0 bottom-0 left-0 z-[1] flex w-[clamp(64px,12vw,180px)] cursor-pointer items-center justify-start border-0 bg-transparent px-4 text-[#fff6df] transition-colors duration-200 hover:bg-[#17110e]/12 focus-visible:bg-[#17110e]/16"
            onClick={onExitFocus}
            aria-label="Back to room from the left side"></button>
          <button
            type="button"
            className="pointer-events-auto absolute top-0 right-0 bottom-0 z-[1] flex w-[clamp(64px,12vw,180px)] cursor-pointer items-center justify-end border-0 bg-transparent px-4 text-[#fff6df] transition-colors duration-200 hover:bg-[#17110e]/12 focus-visible:bg-[#17110e]/16"
            onClick={onExitFocus}
            aria-label="Back to room from the right side"></button>
        </div>
      ) : null}

      {sceneMode === 'explore' ? (
        <RoomCameraControls
          viewDirection={viewDirection}
          onRotate={onRotateView}
          onReset={onResetView}
        />
      ) : null}
    </>
  );
}
