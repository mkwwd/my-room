import type { PointerEvent as ReactPointerEvent } from 'react';

import type {
  DesktopIconConfig,
  DesktopIconId,
  DesktopIconPosition,
} from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';

type DesktopIconProps = {
  icon: DesktopIconConfig;
  position: DesktopIconPosition;
  isDragging: boolean;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => void;
  onPointerMove: (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => void;
  onPointerUp: (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => void;
};

export default function DesktopIcon({
  icon,
  position,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DesktopIconProps) {
  return (
    <button
      type="button"
      className={`absolute grid w-[58px] cursor-grab justify-items-center gap-1 rounded-md p-1 text-center text-[11px] leading-tight font-black text-white [text-shadow:0_1px_4px_rgba(35,22,35,0.65)] transition-[filter,transform] duration-150 hover:bg-white/10 focus-visible:bg-white/14 ${
        isDragging ? 'z-[3] scale-105 cursor-grabbing' : 'z-[1]'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      onPointerDown={(event) => onPointerDown(event, icon.id)}
      onPointerMove={(event) => onPointerMove(event, icon.id)}
      onPointerUp={(event) => onPointerUp(event, icon.id)}
      onPointerCancel={(event) => onPointerUp(event, icon.id)}
      aria-label={`${icon.label} desktop icon`}>
      <DesktopIconGraphic icon={icon} />
      <span>{icon.label}</span>
    </button>
  );
}
