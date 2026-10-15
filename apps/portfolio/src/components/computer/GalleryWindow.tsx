'use client';

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  ImageOff,
  Images,
  LoaderCircle,
  RectangleHorizontal,
  RectangleVertical,
  Square,
} from 'lucide-react';
import Image from 'next/image';

import { useGallery } from '../gallery/GalleryContext';
import {
  GALLERY_IMAGE_LICENSE_URL,
  GALLERY_IMAGES,
} from '../gallery/galleryImages';
import {
  GALLERY_FRAME_IDS,
  type GalleryFrameId as Frame,
} from '../gallery/gallerySelection';

import {
  DESKTOP_TASKBAR_HEIGHT,
  DESKTOP_UI_HEIGHT,
  DESKTOP_UI_WIDTH,
  desktopIcons,
} from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';
import WindowControls from './WindowControls';

type ApplyStatus = 'idle' | 'pending' | 'success' | 'error';

const FRAME_LABELS = {
  portrait: '세로 포스터',
  landscape: '가로 포스터',
  square: '정사각 포스터',
};
// Match RoomPictureFrame's edge-to-edge photo planes.
const FRAME_ASPECT_RATIOS = {
  portrait: 1.64 / 2.44,
  landscape: 2.04 / 1.52,
  square: 1,
};
const WINDOW_WIDTH = 920;
const WINDOW_HEIGHT = 540;
const APP_AREA_HEIGHT = DESKTOP_UI_HEIGHT - DESKTOP_TASKBAR_HEIGHT;
const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ef2c3]';

function GalleryPhoto({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (failedSource === src) {
    return (
      <span
        role="img"
        aria-label={`${alt}: 사진을 불러올 수 없습니다`}
        title="사진을 불러올 수 없습니다"
        className="absolute inset-0 grid place-items-center bg-[#211b26] text-[#e4dfea]">
        <ImageOff size={30} aria-hidden="true" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      draggable={false}
      className="object-cover object-center"
      onError={() => setFailedSource(src)}
    />
  );
}

export default function GalleryWindow({
  isActive,
  isMaximized,
  onActivate,
  onMinimize,
  onToggleMaximize,
  onClose,
}: {
  isActive: boolean;
  isMaximized: boolean;
  onActivate: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  const { selection, unavailableFrames, applySelection } = useGallery();
  const [frame, setFrame] = useState<Frame>('portrait');
  const [drafts, setDrafts] = useState<Partial<Record<Frame, string>>>({});
  const [status, setStatus] = useState<ApplyStatus>('idle');
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ x: 130, y: 25 });
  const windowRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const galleryIcon = desktopIcons.find((icon) => icon.id === 'gallery');
  const selectedId = drafts[frame] ?? selection[frame];
  const selectedPhoto = GALLERY_IMAGES.find((photo) => photo.id === selectedId);
  const appliedPhoto = unavailableFrames[frame]
    ? undefined
    : GALLERY_IMAGES.find((photo) => photo.id === selection[frame]);
  const visibleError =
    status === 'error'
      ? error
      : unavailableFrames[frame]
        ? '사진을 불러오지 못했어요. 적용 버튼으로 다시 시도해 주세요.'
        : '';
  const isPending = status === 'pending';
  const isApplied = selectedId === selection[frame];
  const aspectRatio = FRAME_ASPECT_RATIOS[frame];

  const applyPhoto = async () => {
    if (!selectedPhoto || isPending) return;
    setStatus('pending');
    setError('');
    try {
      await applySelection(frame, selectedPhoto.id);
      setStatus('success');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '사진을 적용하지 못했습니다. 다시 시도해 주세요.',
      );
      setStatus('error');
    }
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      isMaximized ||
      event.button !== 0 ||
      !event.isPrimary ||
      (event.target as HTMLElement).closest('button')
    )
      return;
    const bounds = windowRef.current?.parentElement?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX:
        ((event.clientX - bounds.left) * DESKTOP_UI_WIDTH) / bounds.width -
        position.x,
      offsetY:
        ((event.clientY - bounds.top) * APP_AREA_HEIGHT) / bounds.height -
        position.y,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const bounds = windowRef.current?.parentElement?.getBoundingClientRect();
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      isMaximized ||
      !bounds?.width ||
      !bounds.height
    )
      return;
    setPosition({
      x: Math.max(
        0,
        Math.min(
          DESKTOP_UI_WIDTH - WINDOW_WIDTH,
          ((event.clientX - bounds.left) * DESKTOP_UI_WIDTH) / bounds.width -
            drag.offsetX,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          APP_AREA_HEIGHT - WINDOW_HEIGHT,
          ((event.clientY - bounds.top) * APP_AREA_HEIGHT) / bounds.height -
            drag.offsetY,
        ),
      ),
    });
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <article
      ref={windowRef}
      className={`absolute flex flex-col overflow-hidden rounded-sm border-2 bg-[#100e13] text-white selection:bg-[#9ef2c3] selection:text-[#173329] ${
        isActive
          ? 'z-[4] border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.4)]'
          : 'z-[2] border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.25)]'
      }`}
      style={
        isMaximized
          ? { top: 0, left: 0, width: '100%', height: '100%' }
          : {
              top: position.y,
              left: position.x,
              width: WINDOW_WIDTH,
              height: WINDOW_HEIGHT,
            }
      }
      onPointerDown={onActivate}
      onFocus={onActivate}
      aria-label="Gallery window">
      <div
        className={`flex h-9 shrink-0 touch-none items-center justify-between border-b-2 border-[#1f1a20] bg-[#211b26] px-3 select-none ${isMaximized ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) {
            onToggleMaximize();
          }
        }}>
        <div className="flex items-center gap-2 text-sm font-black">
          {galleryIcon ? (
            <DesktopIconGraphic icon={galleryIcon} size="taskbar" />
          ) : (
            <Images size={20} aria-hidden="true" />
          )}
          <span>Gallery</span>
        </div>
        <WindowControls
          appName="Gallery"
          isMaximized={isMaximized}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
        />
      </div>

      <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 border-b border-[#3a3145] bg-[#19131d] px-4">
        <fieldset className="flex gap-1" disabled={isPending}>
          <legend className="sr-only">포스터 선택</legend>
          {GALLERY_FRAME_IDS.map((mode) => {
            const FrameIcon =
              mode === 'portrait'
                ? RectangleVertical
                : mode === 'landscape'
                  ? RectangleHorizontal
                  : Square;
            return (
              <label key={mode} className="relative">
                <input
                  type="radio"
                  name="gallery-frame"
                  value={mode}
                  checked={frame === mode}
                  onChange={() => {
                    setFrame(mode);
                    setStatus('idle');
                    setError('');
                  }}
                  className="peer sr-only"
                />
                <span className="flex h-12 min-w-[170px] cursor-pointer items-center justify-center gap-3 rounded-sm border border-[#514859] px-4 text-xl font-bold text-[#e4dfea] transition-colors hover:bg-white/10 peer-checked:border-[#9ef2c3] peer-checked:bg-[#173329] peer-checked:text-[#9ef2c3] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#9ef2c3] peer-disabled:cursor-wait peer-disabled:opacity-60">
                  <FrameIcon size={24} aria-hidden="true" />
                  {FRAME_LABELS[mode]}
                </span>
              </label>
            );
          })}
        </fieldset>
        <a
          href={GALLERY_IMAGE_LICENSE_URL}
          target="_blank"
          rel="noreferrer"
          className={`flex shrink-0 items-center gap-2 py-3 text-lg text-[#9ef2c3] underline-offset-4 hover:underline ${focusClass}`}>
          무료 라이선스
          <ExternalLink size={18} aria-hidden="true" />
        </a>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <section
          className="overflow-y-auto overscroll-contain p-4 [scrollbar-color:#716779_#19131d] [scrollbar-width:thin]"
          aria-label="사진 선택">
          <div className="grid grid-cols-3 gap-3">
            {GALLERY_IMAGES.map((photo) => (
              <button
                key={photo.id}
                type="button"
                aria-label={photo.title}
                aria-pressed={selectedId === photo.id}
                disabled={isPending}
                onClick={() => {
                  setDrafts((current) => ({ ...current, [frame]: photo.id }));
                  setStatus('idle');
                  setError('');
                }}
                className={`min-w-0 cursor-pointer overflow-hidden rounded-sm border-2 text-left transition-colors disabled:cursor-wait ${focusClass} ${
                  selectedId === photo.id
                    ? 'border-[#9ef2c3] bg-[#173329] text-[#9ef2c3]'
                    : 'border-[#3a3145] bg-[#211b26] text-[#e4dfea] hover:border-[#b4aaba]'
                }`}>
                <span className="relative block aspect-[3/2] w-full overflow-hidden bg-[#211b26]">
                  <GalleryPhoto src={photo.thumbnailUrl} alt="" sizes="200px" />
                  {selectedId === photo.id ? (
                    <span className="absolute right-1 bottom-1 grid h-8 w-8 place-items-center rounded-sm bg-[#9ef2c3] text-[#173329]">
                      <Check size={24} strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span
                  className="block h-9 truncate px-2 text-base leading-9 font-bold"
                  title={photo.title}>
                  {photo.title}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section
          className="flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-[#3a3145] bg-[#19131d] p-4 [scrollbar-color:#716779_#19131d] [scrollbar-width:thin]"
          aria-label={`${FRAME_LABELS[frame]} 미리보기`}>
          <div className="grid h-[208px] shrink-0 place-items-center">
            {selectedPhoto ? (
              <div
                className="relative overflow-hidden bg-[#211b26] shadow-[0_8px_18px_rgba(0,0,0,0.3)]"
                style={{
                  aspectRatio,
                  height: frame === 'landscape' ? undefined : 196,
                  width:
                    frame === 'landscape' ? 'calc(100% - 12px)' : undefined,
                }}>
                <GalleryPhoto
                  src={selectedPhoto.url}
                  alt={`${selectedPhoto.title} 미리보기`}
                  sizes="320px"
                />
              </div>
            ) : null}
          </div>
          <h2
            className="shrink-0 truncate text-xl leading-7 font-bold"
            title={selectedPhoto?.title}>
            {selectedPhoto?.title ?? '사진 선택'}
          </h2>
          {selectedPhoto ? (
            <a
              href={selectedPhoto.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={`flex shrink-0 items-center gap-1 text-sm leading-5 text-[#d8d1e8] underline-offset-4 hover:text-white hover:underline ${focusClass}`}
              title={selectedPhoto.credit}>
              <span className="truncate">{selectedPhoto.credit}</span>
              <ExternalLink size={16} className="shrink-0" aria-hidden="true" />
            </a>
          ) : null}
          <div className="mt-auto flex min-h-[52px] shrink-0 items-center gap-3 border-t border-[#3a3145] pt-2">
            {appliedPhoto ? (
              <div
                className="relative h-11 shrink-0 overflow-hidden bg-[#211b26] outline-2 outline-[#9ef2c3]"
                style={{ aspectRatio }}>
                <GalleryPhoto
                  src={appliedPhoto.url}
                  alt={`현재 적용된 사진: ${appliedPhoto.title}`}
                  sizes="80px"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-sm leading-5 font-bold text-[#9ef2c3]">
                현재 적용
              </p>
              <p
                className="truncate text-base leading-6 text-[#e4dfea]"
                title={appliedPhoto?.title}>
                {appliedPhoto?.title ?? '적용된 사진 없음'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="flex min-h-[68px] shrink-0 items-center justify-between gap-4 border-t border-[#3a3145] bg-[#211b26] px-4 py-2">
        <p
          role={visibleError && !isPending ? 'alert' : 'status'}
          aria-live={visibleError && !isPending ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`flex min-w-0 items-center gap-2 text-lg leading-6 ${visibleError && !isPending ? 'text-[#ffb4a9]' : 'text-[#d8d1e8]'}`}>
          {visibleError && !isPending ? (
            <AlertTriangle size={22} className="shrink-0" aria-hidden="true" />
          ) : null}
          {status === 'success' ? (
            <CheckCircle2
              size={22}
              className="shrink-0 text-[#9ef2c3]"
              aria-hidden="true"
            />
          ) : null}
          <span className="break-words">
            {isPending
              ? '포스터에 사진을 불러오는 중...'
              : visibleError
                ? visibleError
                : status === 'success'
                  ? `${FRAME_LABELS[frame]}에 적용했습니다.`
                  : isApplied
                    ? '현재 포스터에 적용된 사진'
                    : `${FRAME_LABELS[frame]}에 적용할 사진`}
          </span>
        </p>
        <button
          type="button"
          disabled={isPending || !selectedPhoto}
          aria-busy={isPending}
          onClick={() => void applyPhoto()}
          className={`flex h-12 w-[188px] shrink-0 cursor-pointer items-center justify-center gap-3 rounded-sm border-2 border-[#9ef2c3] bg-[#9ef2c3] px-4 text-xl font-bold text-[#173329] transition-colors hover:bg-[#c4ffde] disabled:cursor-default disabled:border-[#514859] disabled:bg-[#352f3d] disabled:text-[#d8d1e8] ${focusClass}`}>
          {isPending ? (
            <LoaderCircle
              size={24}
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Check size={24} aria-hidden="true" />
          )}
          {isPending ? '적용 중...' : '적용'}
        </button>
      </footer>
    </article>
  );
}
