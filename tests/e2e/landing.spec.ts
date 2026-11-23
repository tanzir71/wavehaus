import { test, expect } from '@playwright/test';

test('the footer remains reachable in one jump to the bottom', async ({ browser, baseURL }, info) => {
  const widths = info.project.name === 'desktop' ? [1440, 1920] : [412];
  for (const width of widths) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: width === 412 ? 915 : 820 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(baseURL!);
    await page.keyboard.press('End');
    // Native smooth scrolling can expose the credit line before it has reached
    // the final bottom padding. Wait for this same End-key scroll to settle.
    await expect.poll(() => page.evaluate(() => Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 1)).toBe(true);
    await expect(page.locator('.footer-credit')).toBeInViewport({ ratio: 1 });
    const bounds = await page.evaluate(() => ({
      atBottom: Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 1,
      overflow: document.documentElement.scrollWidth > innerWidth,
      wave: document.querySelector('.wave-field')!.getBoundingClientRect().toJSON(),
    }));
    expect(bounds.atBottom).toBe(true);
    expect(bounds.overflow).toBe(false);
    expect(bounds.wave.left).toBeLessThanOrEqual(0);
    expect(bounds.wave.right).toBeGreaterThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`footer-${width}.png`) });
    await context.close();
  }
});

test('the design previews load local artwork with visible geometry', async ({ page }) => {
  await page.goto('');
  const previews = page.locator('.design-preview');
  await expect(previews).toHaveCount(8);
  for (const preview of await previews.all()) {
    await preview.scrollIntoViewIfNeeded();
    // The design deliberately clips the lower parts of the product screens.
    // Native lazy images outside those clips do not need to be requested.
    await expect.poll(() => preview.locator('img').evaluateAll(images => images.every(image => {
      const img = image as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      let left = rect.left, right = rect.right, top = rect.top, bottom = rect.bottom;
      for (let parent = img.parentElement; parent; parent = parent.parentElement) {
        if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(parent).overflow)) {
          const clip = parent.getBoundingClientRect();
          left = Math.max(left, clip.left); right = Math.min(right, clip.right);
          top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
        }
      }
      if (right <= left || bottom <= top) return true;
      return img.complete && img.naturalWidth > 0 && rect.width > 0 && rect.height > 0;
    }))).toBe(true);
  }
  const remote = await page.locator('img').evaluateAll(images => images.filter(img => new URL((img as HTMLImageElement).src).origin !== location.origin).length);
  expect(remote).toBe(0);
});
