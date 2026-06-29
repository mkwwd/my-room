'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';

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

type KeyboardNavPosition = {
  row: number;
  col: number;
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
  ㄱ: 'ㄲ',
  ㄷ: 'ㄸ',
  ㅂ: 'ㅃ',
  ㅅ: 'ㅆ',
  ㅈ: 'ㅉ',
};

function KeyboardButton({
  children,
  label,
  onClick,
  navPosition,
  popupLabel,
  onPopupClick,
  variant = 'key',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  navPosition?: KeyboardNavPosition;
  popupLabel?: string;
  onPopupClick?: () => void;
  variant?: 'key' | 'side' | 'action';
}) {
  const variantClass = {
    key: 'h-9 w-9 rounded-xl text-base font-semibold text-white/82 hover:bg-white hover:text-black focus-visible:bg-white/20',
    side: 'h-9 w-[3.25rem] rounded-xl text-sm font-black text-white/82 hover:bg-white hover:text-black focus-visible:bg-white/20',
    action:
      'h-11 min-w-[6.25rem] rounded-xl bg-[#3a3a3a] px-6 text-base font-black text-white/88 hover:bg-white/20 focus-visible:bg-white/20',
  }[variant];

  return (
    <span className="group/key relative inline-flex overflow-visible">
      <button
        type="button"
        onClick={onClick}
        data-youtube-keyboard-nav={navPosition ? 'true' : undefined}
        data-youtube-keyboard-row={navPosition?.row}
        data-youtube-keyboard-col={navPosition?.col}
        className={`flex cursor-pointer items-center justify-center transition-colors duration-200 ${variantClass}`}
        aria-label={label}>
        {children}
      </button>

      {popupLabel ? (
        <button
          type="button"
          tabIndex={-1}
          data-youtube-keyboard-popup="true"
          data-youtube-keyboard-popup-row={navPosition?.row}
          data-youtube-keyboard-popup-col={navPosition?.col}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onPopupClick?.();
          }}
          className="pointer-events-none absolute bottom-[calc(100%-0.25rem)] left-1/2 z-30 flex h-10 w-10 -translate-x-1/2 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-[#3a3a3a] text-2xl font-semibold text-white/90 opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur transition-opacity duration-150 hover:bg-white hover:text-black focus-visible:bg-white/20 group-hover/key:pointer-events-auto group-hover/key:opacity-100 group-focus-within/key:pointer-events-auto group-focus-within/key:opacity-100"
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
  const keyboardRef = useRef<HTMLDivElement>(null);
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

  const focusKeyboardButton = (row: number, col: number) => {
    const keyboard = keyboardRef.current;

    if (!keyboard) {
      return;
    }

    const buttons = Array.from(
      keyboard.querySelectorAll<HTMLButtonElement>(
        '[data-youtube-keyboard-nav="true"]',
      ),
    );
    const rowButtons = buttons.filter(
      (button) => Number(button.dataset.youtubeKeyboardRow) === row,
    );

    if (rowButtons.length === 0) {
      return;
    }

    const nextButton = rowButtons.reduce((nearestButton, button) => {
      const nearestDistance = Math.abs(
        Number(nearestButton.dataset.youtubeKeyboardCol) - col,
      );
      const buttonDistance = Math.abs(
        Number(button.dataset.youtubeKeyboardCol) - col,
      );

      return buttonDistance < nearestDistance ? button : nearestButton;
    }, rowButtons[0]);

    nextButton.focus();
  };

  const focusPopupButton = (row: number, col: number) => {
    const popupButton = keyboardRef.current?.querySelector<HTMLButtonElement>(
      `[data-youtube-keyboard-popup="true"][data-youtube-keyboard-popup-row="${row}"][data-youtube-keyboard-popup-col="${col}"]`,
    );

    popupButton?.focus();
    return Boolean(popupButton);
  };

  const handleKeyboardNavigation = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)
    ) {
      return;
    }

    const popupButton =
      event.target instanceof HTMLButtonElement
        ? event.target.closest<HTMLButtonElement>(
            '[data-youtube-keyboard-popup="true"]',
          )
        : null;

    if (popupButton) {
      const parentRow = Number(popupButton.dataset.youtubeKeyboardPopupRow);
      const parentCol = Number(popupButton.dataset.youtubeKeyboardPopupCol);

      if (!Number.isFinite(parentRow) || !Number.isFinite(parentCol)) {
        return;
      }

      event.preventDefault();

      if (event.key === 'ArrowDown') {
        focusKeyboardButton(parentRow, parentCol);
        return;
      }

      if (event.key === 'ArrowLeft') {
        focusKeyboardButton(parentRow, parentCol - 1);
        return;
      }

      if (event.key === 'ArrowRight') {
        focusKeyboardButton(parentRow, parentCol + 1);
        return;
      }

      focusKeyboardButton(parentRow - 1, parentCol);
      return;
    }

    const currentButton =
      event.target instanceof HTMLButtonElement
        ? event.target.closest<HTMLButtonElement>(
            '[data-youtube-keyboard-nav="true"]',
          )
        : null;

    if (!currentButton) {
      return;
    }

    const currentRow = Number(currentButton.dataset.youtubeKeyboardRow);
    const currentCol = Number(currentButton.dataset.youtubeKeyboardCol);

    if (!Number.isFinite(currentRow) || !Number.isFinite(currentCol)) {
      return;
    }

    event.preventDefault();

    if (event.key === 'ArrowLeft') {
      focusKeyboardButton(currentRow, currentCol - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      focusKeyboardButton(currentRow, currentCol + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (focusPopupButton(currentRow, currentCol)) {
        return;
      }

      focusKeyboardButton(currentRow - 1, currentCol);
      return;
    }

    focusKeyboardButton(currentRow + 1, currentCol);
  };

  return (
    <div
      ref={keyboardRef}
      onKeyDown={handleKeyboardNavigation}
      className="space-y-3 text-white [text-shadow:0_0_12px_rgba(173,201,255,0.7)]">
      <div className="space-y-4">
        {rows.map((row, rowIndex) => (
          <div
            key={`${layout}-${rowIndex}`}
            className="grid grid-cols-[repeat(7,2.25rem)_3.25rem] items-center gap-3">
            {row.map((key, keyIndex) => {
              const doubleConsonant =
                layout === 'korean'
                  ? KOREAN_DOUBLE_CONSONANTS[key.value]
                  : undefined;

              return (
                <KeyboardButton
                  key={key.label}
                  label={`Input ${key.label}`}
                  navPosition={{ row: rowIndex, col: keyIndex }}
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
                navPosition={{ row: rowIndex, col: 7 }}
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
                navPosition={{ row: rowIndex, col: 7 }}
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
                navPosition={{ row: rowIndex, col: 7 }}
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
        <KeyboardButton
          label="Insert space"
          navPosition={{ row: rows.length, col: 0 }}
          onClick={onSpace}
          variant="action">
          {useKoreanActions ? '스페이스' : 'SPACE'}
        </KeyboardButton>

        <KeyboardButton
          label="Delete last search character"
          navPosition={{ row: rows.length, col: 1 }}
          onClick={onBackspace}
          variant="action">
          {useKoreanActions ? '지우기' : 'DELETE'}
        </KeyboardButton>

        <KeyboardButton
          label="Search YouTube"
          navPosition={{ row: rows.length, col: 2 }}
          onClick={onSearch}
          variant="action">
          {useKoreanActions ? '검색' : 'SEARCH'}
        </KeyboardButton>
      </div>
    </div>
  );
}
