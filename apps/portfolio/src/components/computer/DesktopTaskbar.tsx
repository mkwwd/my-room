import { desktopApps, desktopIcons, type DesktopAppId } from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';

export default function DesktopTaskbar({
  openApps,
  activeApp,
  onActivateApp,
}: {
  openApps: DesktopAppId[];
  activeApp: DesktopAppId | null;
  onActivateApp: (appId: DesktopAppId) => void;
}) {
  return (
    <div className="absolute right-0 bottom-0 left-0 flex h-10 items-center justify-between border-t border-black/24 bg-[linear-gradient(180deg,rgba(35,56,62,0.96),rgba(18,31,37,0.98))] px-4 text-white/88 shadow-[0_-8px_20px_rgba(13,22,28,0.2)]">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center text-white transition-opacity duration-200 hover:opacity-75"
          aria-label="Start menu">
          <span className="grid grid-cols-2 gap-[2px]">
            <span className="h-[9px] w-[9px] bg-white" />
            <span className="h-[9px] w-[9px] bg-white" />
            <span className="h-[9px] w-[9px] bg-white" />
            <span className="h-[9px] w-[9px] bg-white" />
          </span>
        </button>
        <div className="flex min-w-0 items-center gap-1">
          {openApps.map((appId) => {
            const app = desktopApps[appId];
            const icon = desktopIcons.find(
              (desktopIcon) => desktopIcon.id === app.iconId,
            );
            const isActive = activeApp === appId;

            return (
              <button
                key={app.id}
                type="button"
                className={`relative flex h-9 min-w-[120px] cursor-pointer items-center gap-2 rounded-sm px-2 text-xs font-black transition-colors duration-200 ${
                  isActive
                    ? 'bg-white/16 text-white'
                    : 'bg-white/6 text-white/78 hover:bg-white/12 hover:text-white'
                }`}
                onClick={() => onActivateApp(appId)}
                aria-label={`${app.title} taskbar button`}>
                {icon ? (
                  <DesktopIconGraphic icon={icon} size="taskbar" />
                ) : null}
                <span className="truncate">{app.title}</span>
                <span
                  className={`absolute right-2 bottom-0 left-2 h-[3px] rounded-full transition-colors duration-200 ${
                    isActive ? 'bg-[#7fd4ff]' : 'bg-white/24'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 text-white/78">
        <span className="text-sm leading-none">^</span>
        <span className="h-2 w-4 rounded-[2px] border border-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
        <span className="text-xs leading-none">)))</span>
        <div className="grid min-w-18 justify-items-end text-[10px] leading-tight font-bold">
          <span>15:19</span>
          <span>2026-06-17</span>
        </div>
      </div>
    </div>
  );
}
