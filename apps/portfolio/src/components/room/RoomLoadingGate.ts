import { LoadingManager } from 'three';

export type RoomLoadingPhase = 'loading' | 'opening' | 'ready' | 'error';

export default class RoomLoadingGate {
  readonly manager = new LoadingManager();
  private disposed = false;
  private failed = false;
  private preparing = false;
  private setupComplete = false;

  constructor(
    prepare: () => Promise<void>,
    onReady: () => void,
    onError: () => void,
    onProgress?: (percent: number) => void,
  ) {
    let progress = 0;
    this.manager.onProgress = (_url, loaded, total) => {
      if (this.disposed || this.failed || !this.setupComplete) return;
      // Nested textures can grow the total. Keep an estimate stable and reserve
      // the last 5% for GPU preparation; the setup sentinel is not an asset.
      progress = Math.max(
        progress,
        Math.floor((95 * (loaded - 1)) / Math.max(1, total - 1)),
      );
      onProgress?.(progress);
    };
    // Hold the batch open while constructors register their loaders, including cache hits.
    this.manager.itemStart('room-setup');
    this.manager.onError = () => {
      if (this.disposed || this.failed) return;
      this.failed = true;
      onError();
    };
    this.manager.onLoad = async () => {
      if (this.disposed || this.failed || this.preparing) return;
      this.preparing = true;
      try {
        await prepare();
        if (!this.disposed && !this.failed) {
          onProgress?.(100);
          onReady();
        }
      } catch {
        this.manager.onError?.('room-render');
      }
    };
  }

  completeSetup() {
    this.setupComplete = true;
    this.manager.itemEnd('room-setup');
  }

  dispose() {
    this.disposed = true;
  }
}
