import { GALLERY_IMAGES } from './galleryImages';

export const GALLERY_FRAME_IDS = ['portrait', 'landscape', 'square'] as const;
export type GalleryFrameId = (typeof GALLERY_FRAME_IDS)[number];
export type GallerySelection = Record<GalleryFrameId, string>;
export const GALLERY_STORAGE_KEY = 'my-room.gallery.v1';

// Change these ids to choose the owner's first-visit arrangement.
export const DEFAULT_GALLERY_SELECTION: GallerySelection = {
  portrait: GALLERY_IMAGES[0].id,
  landscape: GALLERY_IMAGES[1].id,
  square: GALLERY_IMAGES[2].id,
};

export function getGalleryStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readGallerySelection(
  storage: Pick<Storage, 'getItem'> | null,
): GallerySelection {
  let saved: Partial<GallerySelection> | null = null;
  try {
    saved = JSON.parse(storage?.getItem(GALLERY_STORAGE_KEY) ?? 'null');
  } catch {
    // Private browsing and damaged older values should not prevent room entry.
  }
  const valid = (id: unknown) =>
    typeof id === 'string' && GALLERY_IMAGES.some((image) => image.id === id);
  return {
    portrait: valid(saved?.portrait)
      ? saved!.portrait!
      : DEFAULT_GALLERY_SELECTION.portrait,
    landscape: valid(saved?.landscape)
      ? saved!.landscape!
      : DEFAULT_GALLERY_SELECTION.landscape,
    square: valid(saved?.square)
      ? saved!.square!
      : DEFAULT_GALLERY_SELECTION.square,
  };
}

export function saveGallerySelection(
  storage: Pick<Storage, 'setItem'> | null,
  selection: GallerySelection,
) {
  try {
    if (!storage) return false;
    storage.setItem(
      GALLERY_STORAGE_KEY,
      JSON.stringify({
        portrait: selection.portrait,
        landscape: selection.landscape,
        square: selection.square,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
