'use client';

import { createContext, useContext } from 'react';

import type { GalleryFrameId, GallerySelection } from './gallerySelection';

export const GalleryContext = createContext<{
  selection: GallerySelection;
  unavailableFrames: Partial<Record<GalleryFrameId, boolean>>;
  applySelection: (frame: GalleryFrameId, imageId: string) => Promise<void>;
} | null>(null);

export function useGallery() {
  const gallery = useContext(GalleryContext);
  if (!gallery) throw new Error('Gallery must be inside the room.');
  return gallery;
}
