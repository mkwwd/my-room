'use client';

import { Search } from 'lucide-react';

import { desktopIcons } from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';
import useVelogPosts, { VELOG_PROFILE_URL } from './useVelogPosts';
import WindowControls from './WindowControls';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '최근 작성';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(date);
}

export default function VelogWindow({
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
  const velogIcon = desktopIcons.find((icon) => icon.id === 'velog');
  const { status, posts } = useVelogPosts();

  return (
    <article
      className={`absolute top-[44px] left-[150px] h-[500px] w-[850px] overflow-hidden rounded-sm border-2 bg-white text-[#212529] ${
        isActive
          ? 'z-[4] border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.38)]'
          : 'z-[2] border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.24)]'
      }`}
      style={isMaximized ? { top: 0, left: 0, width: '100%', height: '100%' } : undefined}
      onPointerDown={onActivate}
      aria-label="Velog posts window">
      <div className="flex h-9 items-center justify-between border-b-2 border-[#1f1a20] bg-[#211b26] px-3 text-white">
        <div className="flex items-center gap-2 text-sm font-black">
          {velogIcon ? <DesktopIconGraphic icon={velogIcon} size="taskbar" /> : null}
          <span>Velog</span>
        </div>
        <WindowControls
          appName="Velog"
          isMaximized={isMaximized}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
        />
      </div>

      <div className="h-[calc(100%-36px)] overflow-y-auto bg-white">
        <nav className="sticky top-0 z-[1] flex h-14 items-center justify-between border-b border-[#f1f3f5] bg-white/95 px-8 backdrop-blur-sm">
          <span className="font-serif text-2xl font-black tracking-tight text-[#212529]">velog</span>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold ${status === 'ready' ? 'text-[#12b886]' : 'text-[#868e96]'}`}>
              {status === 'ready' ? 'LIVE' : status === 'loading' ? 'LOADING' : 'OFFLINE'}
            </span>
            <button type="button" className="grid h-8 w-8 cursor-pointer place-items-center rounded-full transition-colors duration-200 hover:bg-[#f1f3f5]" aria-label="Search Velog posts">
              <Search size={19} strokeWidth={2.4} />
            </button>
            <a href={VELOG_PROFILE_URL} target="_blank" rel="noreferrer" className="cursor-pointer rounded-full bg-[#343a40] px-4 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-[#495057] focus-visible:outline-2 focus-visible:outline-[#20c997]">
              Velog 방문
            </a>
          </div>
        </nav>

        <main className="mx-auto w-[690px] py-8">
          <header className="flex items-center gap-5">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[#20c997] text-4xl font-black text-white shadow-sm">V</div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight">mkwhwkdud</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#495057]">생각과 배움을 기록하는 개발 블로그입니다.</p>
              <a href={VELOG_PROFILE_URL} target="_blank" rel="noreferrer" className="mt-2 inline-block cursor-pointer text-xs font-bold text-[#12b886] hover:underline">
                velog.io/@mkwhwkdud
              </a>
            </div>
          </header>

          <div className="mt-7 flex h-11 items-end gap-8 border-b border-[#dee2e6] text-sm font-bold text-[#868e96]">
            <span className="h-full border-b-2 border-[#20c997] px-1 pt-3 text-[#212529]">글</span>
            <span className="px-1 pb-3">시리즈</span>
            <span className="px-1 pb-3">소개</span>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-8 pt-6">
            <aside>
              <h3 className="text-sm font-bold">태그 목록</h3>
              <div className="mt-3 flex flex-col items-start gap-2 text-xs text-[#495057]">
                <span className="cursor-default font-bold text-[#12b886]">전체보기 ({posts.length})</span>
                <span>최근 글</span>
              </div>
            </aside>

            <section aria-label="최근 게시글">
              {status === 'loading' ? (
                <p className="border-b border-[#e9ecef] py-8 text-sm text-[#868e96]">게시글을 불러오는 중...</p>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <a key={post.id} href={post.link} target="_blank" rel="noreferrer" className="group flex cursor-pointer gap-5 border-b border-[#e9ecef] py-5 first:pt-0 focus-visible:outline-2 focus-visible:outline-[#20c997]">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold tracking-tight text-[#212529] transition-colors duration-200 group-hover:text-[#12b886]">{post.title}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#868e96]">{post.description || '게시글 내용을 확인해 보세요.'}</p>
                      <time className="mt-3 block text-[10px] text-[#adb5bd]">{formatDate(post.publishedAt)}</time>
                    </div>
                    {post.thumbnail ? (
                      <div className="h-20 w-28 shrink-0 overflow-hidden rounded bg-[#f1f3f5]">
                        <img src={post.thumbnail} alt="" className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-85" />
                      </div>
                    ) : null}
                  </a>
                ))
              ) : (
                <div className="border-b border-[#e9ecef] py-8 text-sm text-[#868e96]">
                  게시글을 불러오지 못했어요. <a href={VELOG_PROFILE_URL} target="_blank" rel="noreferrer" className="font-bold text-[#12b886] hover:underline">Velog에서 보기</a>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </article>
  );
}
