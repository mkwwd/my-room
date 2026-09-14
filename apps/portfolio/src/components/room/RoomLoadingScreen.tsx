import { RotateCw } from 'lucide-react';

import type { RoomLoadingPhase } from './RoomLoadingGate';
import styles from './RoomLoadingScreen.module.css';

type Props = { phase: RoomLoadingPhase; progress: number };

export default function RoomLoadingScreen({ phase, progress }: Props) {
  return (
    <div className={styles.screen} data-phase={phase} data-room-loading="true">
      <h1 className={styles.title}>My Room</h1>
      <div className={styles.statusArea}>
        {phase !== 'error' && (
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="방 준비 진행률 (파일 수 기준 추정)"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}>
            {progress}
            <span>%</span>
          </div>
        )}
        <p
          className={styles.status}
          role={phase === 'error' ? 'alert' : 'status'}>
          {phase === 'error'
            ? '방을 불러오지 못했어요.'
            : phase === 'opening'
              ? '어서 와요.'
              : progress === 100
                ? '고양이와 함께 들어가요'
                : progress >= 95
                  ? '문 앞에서 마지막 준비 중'
                  : '방을 준비하고 있어요'}
        </p>
        {phase === 'error' && (
          <button
            className={styles.retry}
            type="button"
            onClick={() => window.location.reload()}>
            <RotateCw size={16} aria-hidden="true" /> 다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
