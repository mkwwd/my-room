import * as THREE from 'three';

export function loadGalleryTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      reject(
        new Error('사진을 불러오지 못했어요. 잠시 후 다시 적용해 주세요.'),
      );
    }, 12000);
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (finished) {
          texture.dispose();
          return;
        }
        finished = true;
        clearTimeout(timer);
        resolve(texture);
      },
      undefined,
      () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(
          new Error(
            '사진을 불러오지 못했어요. 연결을 확인하고 다시 적용해 주세요.',
          ),
        );
      },
    );
  });
}
