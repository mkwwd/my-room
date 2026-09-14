import { CalendarDays } from 'lucide-react';
import Image from 'next/image';

import type { DesktopIconConfig } from './desktopConfig';

export default function DesktopIconGraphic({
  icon,
  size = 'desktop',
}: {
  icon: DesktopIconConfig;
  size?: 'desktop' | 'taskbar';
}) {
  const iconSize = size === 'desktop' ? 55 : 24;
  const sizeClass = size === 'desktop' ? 'h-12 w-12' : 'h-6 w-6';
  const textSizeClass = size === 'desktop' ? 'text-[10px]' : 'text-[9px]';

  if (icon.image) {
    return (
      <Image
        src={icon.image.src}
        alt={icon.image.alt}
        width={iconSize}
        height={iconSize}
        className={`${sizeClass} object-contain [image-rendering:pixelated]`}
        draggable={false}
      />
    );
  }

  if (icon.id === 'calendar') {
    return (
      <span
        className={`grid ${sizeClass} place-items-center rounded-sm border-2 border-[#d0d7de] bg-white text-[#1a73e8] shadow-[inset_0_4px_0_#ea4335,0_3px_8px_rgba(36,18,38,0.2)]`}>
        <CalendarDays size={size === 'desktop' ? 31 : 18} strokeWidth={2.2} />
      </span>
    );
  }

  return (
    <span
      className={`grid ${sizeClass} place-items-center rounded-sm border-2 border-black/35 ${icon.fallbackTone} ${textSizeClass} shadow-[inset_0_-3px_rgba(0,0,0,0.16),0_3px_8px_rgba(36,18,38,0.2)]`}>
      {icon.fallbackText}
    </span>
  );
}
