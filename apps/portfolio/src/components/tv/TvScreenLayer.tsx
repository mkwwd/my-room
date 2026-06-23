'use client';

import { forwardRef } from 'react';

import { TV_UI_HEIGHT, TV_UI_WIDTH } from './tvConfig';
import TvScreen from './TvScreen';

type TvScreenLayerProps = {
  isFocused: boolean;
};

const TvScreenLayer = forwardRef<HTMLDivElement, TvScreenLayerProps>(
  function TvScreenLayer({ isFocused }, ref) {
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
        <TvScreen />
      </div>
    );
  },
);

export default TvScreenLayer;
