import assert from 'node:assert/strict';

// Run with a connected Browser tab after its focus transition has settled.
export async function checkFocusedScreen(tab, label) {
  const samples = await tab.playwright.evaluate((screenLabel) => {
    const screen = document.querySelector(
      `section[aria-label="${screenLabel}"]`,
    );
    if (!screen) return [];
    const rect = screen.getBoundingClientRect();
    const left = Math.max(0, rect.left) + 4;
    const right = Math.min(innerWidth, rect.right) - 4;
    const top = Math.max(0, rect.top) + 4;
    const bottom = Math.min(innerHeight, rect.bottom) - 4;
    return [
      [left, (top + bottom) / 2],
      [right, (top + bottom) / 2],
      [(left + right) / 2, (top + bottom) / 2],
    ].map(([x, y]) => {
      const target = document.elementFromPoint(x, y);
      return {
        x,
        y,
        insideScreen: screen.contains(target),
        interceptedBy: target?.closest('button')?.getAttribute('aria-label'),
      };
    });
  }, label);
  assert.equal(samples.length, 3, `${label} is mounted`);
  for (const sample of samples) {
    assert.ok(sample.insideScreen, `${label}: ${JSON.stringify(sample)}`);
  }
  if (label === 'Focused computer desktop') {
    const hasCloseButton = await tab.playwright.evaluate(() =>
      Boolean(document.querySelector('[aria-label="Close computer desktop"]')),
    );
    assert.equal(
      hasCloseButton,
      false,
      'no extra room-exit X inside the desktop',
    );
  }
  return samples;
}
