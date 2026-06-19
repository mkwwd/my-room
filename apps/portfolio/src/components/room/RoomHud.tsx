import RoomCameraControls, { type ViewDirection } from './RoomCamera';
import type { SceneMode } from './roomConfig';
import type { ScreenPosition } from './RoomInteractionController';

type RoomHudProps = {
  sceneMode: SceneMode;
  isComputerHovered: boolean;
  computerHintPosition: ScreenPosition;
  viewDirection: ViewDirection;
  onExitComputer: () => void;
  onRotateView: (step: -1 | 1) => void;
  onResetView: () => void;
};

export default function RoomHud({
  sceneMode,
  isComputerHovered,
  computerHintPosition,
  viewDirection,
  onExitComputer,
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
            onClick={onExitComputer}
            aria-label="Back to room from the left side">
            <span className="rounded-full border-2 border-[#fff6df]/70 bg-[#17110e]/58 px-3 py-2 text-xl font-black shadow-[0_10px_28px_rgba(20,12,8,0.28)]">
              {'<'}
            </span>
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute top-0 right-0 bottom-0 z-[1] flex w-[clamp(64px,12vw,180px)] cursor-pointer items-center justify-end border-0 bg-transparent px-4 text-[#fff6df] transition-colors duration-200 hover:bg-[#17110e]/12 focus-visible:bg-[#17110e]/16"
            onClick={onExitComputer}
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
          onRotate={onRotateView}
          onReset={onResetView}
        />
      ) : null}
    </>
  );
}
