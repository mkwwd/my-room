'use client';

import { forwardRef } from 'react';

import ComputerDesktop from './ComputerDesktop';
import { DESKTOP_UI_HEIGHT, DESKTOP_UI_WIDTH } from './desktopConfig';

type ComputerDesktopLayerProps = {
  isFocused: boolean;
  onClose: () => void;
};

const ComputerDesktopLayer = forwardRef<
  HTMLDivElement,
  ComputerDesktopLayerProps
>(function ComputerDesktopLayer({ isFocused, onClose }, ref) {
  return (
    <div
      ref={ref}
      className="pointer-events-none invisible absolute top-0 left-0 z-[2] origin-top-left overflow-hidden will-change-transform"
      style={{
        width: `${DESKTOP_UI_WIDTH}px`,
        height: `${DESKTOP_UI_HEIGHT}px`,
        transform: 'translate3d(-10000px, -10000px, 0) scale(0)',
      }}
      aria-hidden={!isFocused}>
      <ComputerDesktop isFocused={isFocused} onClose={onClose} />
    </div>
  );
});

export default ComputerDesktopLayer;
