'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { Delete, Globe } from 'lucide-react';

type KeyboardLayout = 'english' | 'korean';

type YouTubeKeyboardProps = {
  onInput: (value: string) => void;
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
  ['\u3131', '\u3134', '\u3137', '\u3139', '\u3147', '\u3142', '\u3145'].map(
    (key) => ({
      label: key,
      value: key,
    }),
  ),
  ['\u3147', '\u3148', '\u314a', '\u314b', '\u314c', '\u314d', '\u314e'].map(
    (key) => ({
      label: key,
      value: key,
    }),
  ),
  ['\u314f', '\u3151', '\u3153', '\u3155', '\u3157', '\u315b', '\u315c'].map(
    (key) => ({
      label: key,
      value: key,
    }),
  ),
  ['\u3160', '\u3161', '\u3163', '\u3150', '\u3154', '\u3156', '\u315a'].map(
    (key) => ({
      label: key,
      value: key,
    }),
  ),
];

function KeyboardButton({
  children,
  label,
  onClick,
  variant = 'key',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'key' | 'side' | 'action' | 'primary';
}) {
  const variantClass = {
    key: 'h-9 w-9 rounded-full text-base font-semibold text-white/82 hover:bg-white/15 focus-visible:bg-white/20',
    side: 'h-9 w-[3.25rem] rounded-full text-sm font-black text-white/82 hover:bg-white/15 focus-visible:bg-white/20',
    action:
      'h-11 min-w-[8.25rem] rounded-xl bg-[#3f4a67] px-6 text-base font-black text-white/88 hover:bg-[#56637f] focus-visible:bg-[#56637f]',
    primary:
      'h-11 min-w-[8.25rem] rounded-xl bg-[#dfe8ff] px-6 text-base font-black text-[#172033] hover:bg-white focus-visible:bg-white',
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center transition-colors duration-200 ${variantClass}`}
      aria-label={label}>
      {children}
    </button>
  );
}

export default function YouTubeKeyboard({
  onInput,
  onBackspace,
  onSpace,
  onSearch,
}: YouTubeKeyboardProps) {
  const [layout, setLayout] = useState<KeyboardLayout>('english');
  const rows = layout === 'korean' ? KOREAN_ROWS : ENGLISH_ROWS;
  const isKorean = layout === 'korean';

  const toggleLayout = () => {
    setLayout((currentLayout) =>
      currentLayout === 'english' ? 'korean' : 'english',
    );
  };

  return (
    <div className="space-y-3 rounded-3xl bg-[#121b30]/30 p-1 text-white [text-shadow:0_0_12px_rgba(173,201,255,0.7)]">
      <div className="space-y-4">
        {rows.map((row, rowIndex) => (
          <div
            key={`${layout}-${rowIndex}`}
            className="grid grid-cols-[repeat(7,2.25rem)_3.25rem] items-center gap-3">
            {row.map((key) => (
              <KeyboardButton
                key={key.label}
                label={`Input ${key.label}`}
                onClick={() => onInput(key.value)}>
                <span className={isKorean ? 'text-2xl' : undefined}>
                  {key.label}
                </span>
              </KeyboardButton>
            ))}

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
                label="Open symbol keyboard"
                onClick={() => undefined}
                variant="side">
                &amp;123
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
          {isKorean ? '\uc2a4\ud398\uc774\uc2a4' : 'SPACE'}
        </KeyboardButton>

        <KeyboardButton
          label="Delete last search character"
          onClick={onBackspace}
          variant="action">
          {isKorean ? '\uc9c0\uc6b0\uae30' : 'DELETE'}
        </KeyboardButton>

        <KeyboardButton
          label="Search YouTube"
          onClick={onSearch}
          variant="primary">
          {isKorean ? '\uac80\uc0c9' : 'SEARCH'}
        </KeyboardButton>
      </div>
    </div>
  );
}
