import { RotateCw, Smartphone } from 'lucide-react';

import styles from './RoomOrientationNotice.module.css';

export default function RoomOrientationNotice() {
  return (
    <section className={styles.notice} role="status" aria-live="polite">
      <p className={styles.brand}>My Room</p>
      <div className={styles.content}>
        <div className={styles.illustration} aria-hidden="true">
          <Smartphone className={styles.phone} strokeWidth={1.6} />
          <RotateCw className={styles.arrow} strokeWidth={1.8} />
        </div>
        <h2 className={styles.title}>화면을 가로로 돌려주세요</h2>
      </div>
    </section>
  );
}
