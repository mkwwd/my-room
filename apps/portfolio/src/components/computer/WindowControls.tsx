import { Maximize2, Minimize2, Minus, X } from 'lucide-react';

export default function WindowControls({
  appName,
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
}: {
  appName: string;
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  const buttonClass =
    'grid h-7 w-8 cursor-pointer place-items-center text-white/85 transition-colors duration-150 hover:bg-white/14 hover:text-white focus-visible:bg-white/18 focus-visible:text-white focus-visible:outline-none';

  return (
    <div className="-mr-3 flex h-9 items-center">
      <button
        type="button"
        className={buttonClass}
        onClick={(event) => {
          event.stopPropagation();
          onMinimize();
        }}
        aria-label={`Minimize ${appName} window`}>
        <Minus size={15} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMaximize();
        }}
        aria-label={`${isMaximized ? 'Restore' : 'Maximize'} ${appName} window`}>
        {isMaximized ? (
          <Minimize2 size={14} strokeWidth={1.8} />
        ) : (
          <Maximize2 size={14} strokeWidth={1.8} />
        )}
      </button>
      <button
        type="button"
        className={`${buttonClass} hover:bg-[#c42b1c] focus-visible:bg-[#c42b1c]`}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${appName} window`}>
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
