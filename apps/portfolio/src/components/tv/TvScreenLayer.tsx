'use client';

import { forwardRef } from 'react';

import TvScreen from './TvScreen';
import { TV_UI_HEIGHT, TV_UI_WIDTH } from './tvConfig';

type TvScreenLayerProps = {
  isFocused: boolean;
  onClose: () => void;
};

const TvScreenLayer = forwardRef<HTMLDivElement, TvScreenLayerProps>(
  function TvScreenLayer({ isFocused, onClose }, ref) {
    return (
      <div
        ref={ref}
        className="pointer-events-none invisible absolute top-0 left-0 z-[2] origin-top-left overflow-hidden will-change-transform"
        style={{
          width: `${TV_UI_WIDTH}px`,
          height: `${TV_UI_HEIGHT}px`,
          transform: 'translate3d(-10000px, -10000px, 0) scale(0)',
        }}
        aria-hidden={!isFocused}>
        <TvScreen isFocused={isFocused} onClose={onClose} />
      </div>
    );
  },
);

export default TvScreenLayer;
