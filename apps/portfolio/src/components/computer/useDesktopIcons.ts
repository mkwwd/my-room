'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  defaultDesktopIconPositions,
  DESKTOP_GRID_SIZE,
  DESKTOP_ICON_STORAGE_KEY,
  DESKTOP_TASKBAR_HEIGHT,
  DESKTOP_UI_HEIGHT,
  DESKTOP_UI_WIDTH,
  desktopIcons,
  type DesktopIconId,
  type DesktopIconPosition,
} from './desktopConfig';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapDesktopIconPosition(
  position: DesktopIconPosition,
  bounds: { width: number; height: number },
) {
  const maxX = Math.max(bounds.width - 58, 0);
  const maxY = Math.max(bounds.height - DESKTOP_TASKBAR_HEIGHT - 74, 0);

  return {
    x: clamp(
      Math.round(position.x / DESKTOP_GRID_SIZE) * DESKTOP_GRID_SIZE + 26,
      14,
      maxX,
    ),
    y: clamp(
      Math.round((position.y - 24) / DESKTOP_GRID_SIZE) * DESKTOP_GRID_SIZE +
        24,
      14,
      maxY,
    ),
  };
}

function getStoredIconPositions() {
  if (typeof window === 'undefined') return defaultDesktopIconPositions;

  try {
    const savedPositions = window.localStorage.getItem(
      DESKTOP_ICON_STORAGE_KEY,
    );
    if (!savedPositions) return defaultDesktopIconPositions;

    const parsedPositions = JSON.parse(savedPositions) as Partial<
      Record<DesktopIconId, DesktopIconPosition>
    >;

    return desktopIcons.reduce<Record<DesktopIconId, DesktopIconPosition>>(
      (positions, icon) => {
        const savedPosition = parsedPositions[icon.id];
        positions[icon.id] =
          typeof savedPosition?.x === 'number' &&
          typeof savedPosition?.y === 'number'
            ? savedPosition
            : defaultDesktopIconPositions[icon.id];
        return positions;
      },
      { ...defaultDesktopIconPositions },
    );
  } catch {
    return defaultDesktopIconPositions;
  }
}

export default function useDesktopIcons() {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const iconPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragIconRef = useRef(false);
  const draggingIconRef = useRef<{
    id: DesktopIconId;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [iconPositions, setIconPositions] = useState<
    Record<DesktopIconId, DesktopIconPosition>
  >(getStoredIconPositions);
  const [draggingIcon, setDraggingIcon] = useState<{
    id: DesktopIconId;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      DESKTOP_ICON_STORAGE_KEY,
      JSON.stringify(iconPositions),
    );
  }, [iconPositions]);

  const updateIconPosition = (
    iconId: DesktopIconId,
    nextPosition: DesktopIconPosition,
    shouldSnap = false,
  ) => {
    const boundedPosition = {
      x: clamp(nextPosition.x, 14, DESKTOP_UI_WIDTH - 58),
      y: clamp(
        nextPosition.y,
        14,
        DESKTOP_UI_HEIGHT - DESKTOP_TASKBAR_HEIGHT - 80,
      ),
    };
    const finalPosition = shouldSnap
      ? snapDesktopIconPosition(boundedPosition, {
          width: DESKTOP_UI_WIDTH,
          height: DESKTOP_UI_HEIGHT,
        })
      : boundedPosition;

    setIconPositions((positions) => ({
      ...positions,
      [iconId]: finalPosition,
    }));
  };

  const startIconDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    const desktop = desktopRef.current;
    if (!desktop) return;

    const desktopBounds = desktop.getBoundingClientRect();
    const iconPosition = iconPositions[iconId];
    const scaleX = desktopBounds.width / DESKTOP_UI_WIDTH;
    const scaleY = desktopBounds.height / DESKTOP_UI_HEIGHT;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    iconPointerStartRef.current = { x: event.clientX, y: event.clientY };
    didDragIconRef.current = false;
    const nextDraggingIcon = {
      id: iconId,
      offsetX:
        (event.clientX - desktopBounds.left) / Math.max(scaleX, 0.001) -
        iconPosition.x,
      offsetY:
        (event.clientY - desktopBounds.top) / Math.max(scaleY, 0.001) -
        iconPosition.y,
    };
    draggingIconRef.current = nextDraggingIcon;
    setDraggingIcon(nextDraggingIcon);
  };

  const moveIcon = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    const activeDrag = draggingIconRef.current;
    if (!activeDrag || activeDrag.id !== iconId) return;

    const desktop = desktopRef.current;
    if (!desktop) return;

    const desktopBounds = desktop.getBoundingClientRect();
    const scaleX = desktopBounds.width / DESKTOP_UI_WIDTH;
    const scaleY = desktopBounds.height / DESKTOP_UI_HEIGHT;
    const pointerStart = iconPointerStartRef.current;
    if (
      pointerStart &&
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 4
    ) {
      didDragIconRef.current = true;
    }

    updateIconPosition(iconId, {
      x:
        (event.clientX - desktopBounds.left) / Math.max(scaleX, 0.001) -
        activeDrag.offsetX,
      y:
        (event.clientY - desktopBounds.top) / Math.max(scaleY, 0.001) -
        activeDrag.offsetY,
    });
  };

  const stopIconDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    const activeDrag = draggingIconRef.current;
    if (!activeDrag || activeDrag.id !== iconId) return false;

    const shouldOpenApp = !didDragIconRef.current;
    const desktop = desktopRef.current;
    if (desktop) {
      const desktopBounds = desktop.getBoundingClientRect();
      const scaleX = desktopBounds.width / DESKTOP_UI_WIDTH;
      const scaleY = desktopBounds.height / DESKTOP_UI_HEIGHT;
      updateIconPosition(
        iconId,
        {
          x:
            (event.clientX - desktopBounds.left) / Math.max(scaleX, 0.001) -
            activeDrag.offsetX,
          y:
            (event.clientY - desktopBounds.top) / Math.max(scaleY, 0.001) -
            activeDrag.offsetY,
        },
        true,
      );
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    iconPointerStartRef.current = null;
    didDragIconRef.current = false;
    draggingIconRef.current = null;
    setDraggingIcon(null);

    return shouldOpenApp;
  };

  return {
    desktopRef,
    iconPositions,
    draggingIcon,
    startIconDrag,
    moveIcon,
    stopIconDrag,
  };
}
