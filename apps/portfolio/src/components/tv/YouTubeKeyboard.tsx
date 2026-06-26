'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { Delete, Globe } from 'lucide-react';

type KeyboardLayout = 'english' | 'korean' | 'symbol';
type LetterKeyboardLayout = Exclude<KeyboardLayout, 'symbol'>;

type YouTubeKeyboardProps = {
  onInput: (value: string, type?: KeyboardLayout) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onSearch: () => void;
};

type KeyboardKey = {
  label: string;
  value: string;
};

const ENGLISH_ROWS: KeyboardKey[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((key) => ({
    label: key,
    value: key.toLowerCase(),
  })),
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'].map((key) => ({
    label: key,
    value: key.toLowerCase(),
  })),
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'].map((key) => ({
    label: key,
    value: key.toLowerCase(),
  })),
  ['V', 'W', 'X', 'Y', 'Z', '-', "'"].map((key) => ({
    label: key,
    value: key.toLowerCase(),
  })),
];

const KOREAN_ROWS: KeyboardKey[][] = [
  ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ'].map((key) => ({
    label: key,
    value: key,
  })),
  ['ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'].map((key) => ({
    label: key,
    value: key,
  })),
  ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ'].map((key) => ({
    label: key,
    value: key,
  })),
  ['ㅠ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅒ', 'ㅔ', 'ㅖ'].map((key) => ({
    label: key,
    value: key,
  })),
];

const SYMBOL_ROWS: KeyboardKey[][] = [
  ['1', '2', '3', '&', '#', '(', ')'].map((key) => ({
    label: key,
    value: key,
  })),
  ['4', '5', '6', '@', '!', '?', ':'].map((key) => ({
    label: key,
    value: key,
  })),
  ['7', '8', '9', '.', '-', '_', '"'].map((key) => ({
    label: key,
    value: key,
  })),
  ['0', '/', '$', '%', '+', '[', ']'].map((key) => ({
    label: key,
    value: key,
  })),
];

const KOREAN_DOUBLE_CONSONANTS: Partial<Record<string, string>> = {
  '\u3131': '\u3132',
  '\u3137': '\u3138',
  '\u3142': '\u3143',
  '\u3145': '\u3146',
  '\u3148': '\u3149',
};

function KeyboardButton({
  children,
  label,
  onClick,
  popupLabel,
  onPopupClick,
  variant = 'key',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  popupLabel?: string;
  onPopupClick?: () => void;
  variant?: 'key' | 'side' | 'action' | 'primary';
}) {
  const variantClass = {
    key: 'h-9 w-9 rounded-xl text-base font-semibold text-white/82 hover:bg-white/15 focus-visible:bg-white/20',
    side: 'h-9 w-[3.25rem] rounded-xl text-sm font-black text-white/82 hover:bg-white/15 focus-visible:bg-white/20',
    action:
      'h-11 min-w-[8.25rem] rounded-xl bg-[#3a3a3a] px-6 text-base font-black text-white/88 hover:bg-white/20 focus-visible:bg-white/20',
    primary:
      'h-11 min-w-[8.25rem] rounded-xl bg-[#dfe8ff] px-6 text-base font-black text-[#172033] hover:bg-white focus-visible:bg-white',
  }[variant];

  return (
    <span className="group/key relative inline-flex overflow-visible">
      <button
        type="button"
        onClick={onClick}
        className={`flex cursor-pointer items-center justify-center transition-colors duration-200 ${variantClass}`}
        aria-label={label}>
        {children}
      </button>

      {popupLabel ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPopupClick?.();
          }}
          className="pointer-events-none absolute bottom-[calc(100%-0.12rem)] left-1/2 z-30 flex h-10 w-10 -translate-x-1/2 -translate-y-full cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-[#2d3340]/95 text-2xl font-semibold text-white/90 opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur transition-opacity duration-150 hover:bg-white/15 focus-visible:bg-white/20 group-hover/key:pointer-events-auto group-hover/key:opacity-100 group-focus-within/key:pointer-events-auto group-focus-within/key:opacity-100"
          aria-label={`Input ${popupLabel}`}>
          {popupLabel}
        </button>
      ) : null}
    </span>
  );
}

export default function YouTubeKeyboard({
  onInput,
  onBackspace,
  onSpace,
  onSearch,
}: YouTubeKeyboardProps) {
  const [layout, setLayout] = useState<KeyboardLayout>('english');
  const [letterLayout, setLetterLayout] =
    useState<LetterKeyboardLayout>('english');
  const rows =
    layout === 'symbol'
      ? SYMBOL_ROWS
      : layout === 'korean'
        ? KOREAN_ROWS
        : ENGLISH_ROWS;
  const isKorean = layout === 'korean';
  const isSymbol = layout === 'symbol';
  const useKoreanActions = letterLayout === 'korean';

  const toggleLayout = () => {
    const nextLayout = letterLayout === 'english' ? 'korean' : 'english';

    setLetterLayout(nextLayout);
    setLayout(nextLayout);
  };

  const toggleSymbolLayout = () => {
    setLayout((currentLayout) =>
      currentLayout === 'symbol' ? letterLayout : 'symbol',
    );
  };

  return (
    <div className="space-y-3 text-white [text-shadow:0_0_12px_rgba(173,201,255,0.7)]">
      <div className="space-y-4">
        {rows.map((row, rowIndex) => (
          <div
            key={`${layout}-${rowIndex}`}
            className="grid grid-cols-[repeat(7,2.25rem)_3.25rem] items-center gap-3">
            {row.map((key) => {
              const doubleConsonant =
                layout === 'korean'
                  ? KOREAN_DOUBLE_CONSONANTS[key.value]
                  : undefined;

              return (
                <KeyboardButton
                  key={key.label}
                  label={`Input ${key.label}`}
                  onClick={() => onInput(key.value, layout)}
                  popupLabel={doubleConsonant}
                  onPopupClick={
                    doubleConsonant
                      ? () => onInput(doubleConsonant, layout)
                      : undefined
                  }>
                  <span className="text-2xl leading-none">{key.label}</span>
                </KeyboardButton>
              );
            })}

            {rowIndex === 0 ? (
              <KeyboardButton
                label="Delete last search character"
                onClick={onBackspace}
                variant="side">
                <Delete size={23} strokeWidth={2.4} />
              </KeyboardButton>
            ) : null}

            {rowIndex === 1 ? (
              <KeyboardButton
                label={
                  isSymbol
                    ? 'Return to letter keyboard'
                    : 'Open symbol keyboard'
                }
                onClick={toggleSymbolLayout}
                variant="side">
                {isSymbol ? 'ABC' : '&123'}
              </KeyboardButton>
            ) : null}

            {rowIndex === 2 ? (
              <KeyboardButton
                label={
                  isKorean
                    ? 'Switch to English keyboard'
                    : 'Switch to Korean keyboard'
                }
                onClick={toggleLayout}
                variant="side">
                <Globe size={25} strokeWidth={2.2} />
              </KeyboardButton>
            ) : null}

            {rowIndex === 3 ? <span aria-hidden="true" /> : null}
          </div>
        ))}
      </div>

      <div className="flex gap-4 pt-2">
        <KeyboardButton label="Insert space" onClick={onSpace} variant="action">
          {useKoreanActions ? '스페이스' : 'SPACE'}
        </KeyboardButton>

        <KeyboardButton
          label="Delete last search character"
          onClick={onBackspace}
          variant="action">
          {useKoreanActions ? '지우기' : 'DELETE'}
        </KeyboardButton>

        <KeyboardButton
          label="Search YouTube"
          onClick={onSearch}
          variant="primary">
          {useKoreanActions ? '검색' : 'SEARCH'}
        </KeyboardButton>
      </div>
    </div>
  );
}
