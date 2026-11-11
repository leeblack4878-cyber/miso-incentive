import { test, expect } from '@playwright/test';

const reportUrl = 'https://placeholder.supabase.co/functions/v1/monthly-ranking';
const snapshot = (store_name, metrics) => ({
  store_name, as_of_date: '2026-11-04', confirmed: true, has_input: true, metrics,
});

async function openProgress(page, response, screen = '') {
  await page.clock.setFixedTime(new Date('2026-11-04T07:00:00Z'));
  await page.route('https://placeholder.supabase.co/**', route => route.fulfill({
    json: route.request().url().includes('store_goals') ? [] : null,
  }));
  await page.route(reportUrl, response);
  await page.goto(`/tests/ui/evaluation.html?manager${screen}`);
  await page.getByRole('button', { name: '점장정책 진척도 비교' }).click();
}

for (const width of [320, 390]) {
  test(`${width}px progress, PNG download and file sharing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperties(navigator, {
        canShare: { configurable: true, value: () => true },
        share: { configurable: true, value: async ({ files }) => {
          window.sharedImage = { type: files[0].type, size: files[0].size };
        } },
      });
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      window.imageText = [];
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        window.imageText.push(text);
        return fillText.call(this, text, ...args);
      };
    });
    await openProgress(page, route => route.fulfill({ json: { slotAt: '2026-11-04T15:00:00+09:00', rows: [
      snapshot('신천동_삼미시장2호점', { hs: 58, simMnp: 4, secondTotal: 3, home: 0 }),
      { ...snapshot('광정동_산본점', { hs: 100, simMnp: 0, secondTotal: 0, home: 10 }), amounts: { current: 1234567, forecast: 2456789 } },
    ] } }), '&payroll');
    await expect(page.getByText('2026-11-04 15:00 기준 (한국시간)', { exact: false })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(13);
    await expect(page.locator('tbody')).toContainText('1,234,567원');
    await expect(page.locator('tbody tr').first()).toContainText('63.5 / 65건');
    await expect(page.locator('tbody tr').first()).toContainText('97.6% · 1위');
    await expect(page.locator('tbody tr').first()).toContainText('남은 1.5건');
    await expect(page.locator('tbody tr').first()).toContainText('0 / 7건');
    await expect(page.locator('tbody tr').first()).toContainText('미입력');
    await expect(page.locator('tbody')).toContainText('88건');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    const save = page.getByRole('link', { name: 'PNG 저장' });
    const png = await save.evaluate(async link => {
      const blob = await fetch(link.href).then(res => res.blob());
      const bitmap = await createImageBitmap(blob);
      return { type: blob.type, width: bitmap.width, height: bitmap.height };
    });
    expect(png).toEqual({ type: 'image/png', width: 1170, height: 7146 });
    const downloadEvent = page.waitForEvent('download');
    await save.click();
    expect((await downloadEvent).suggestedFilename()).toMatch(/2026-11.*\.png$/);
    await page.getByRole('button', { name: '이미지 공유' }).click();
    expect(await page.evaluate(() => window.sharedImage)).toMatchObject({ type: 'image/png' });
    const imageText = await page.evaluate(() => window.imageText.join(' '));
    expect(imageText).toMatch(/63.5 \/ 65건/);
    expect(imageText).toMatch(/미입력/);
    expect(imageText).toMatch(/평가 제외/);
    expect(imageText).not.toMatch(/급여|지급액|1,234,567|2,456,789/);
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: () => false }));
    await page.getByRole('button', { name: '이미지 공유' }).click();
    await expect(page.getByRole('status').filter({ hasText: '카카오톡' })).toBeVisible();
    await page.getByRole('button', { name: '관리자 급여로' }).click();
    await expect(page.getByRole('button', { name: '월 급여 예상' })).toBeVisible();
  });
}

test('failed data load never generates a misleading report, and retry distinguishes missing data', async ({ page }) => {
  let calls = 0;
  await openProgress(page, route => ++calls === 1
    ? route.fulfill({ status: 500, json: { message: 'unavailable' } })
    : route.fulfill({ json: { slotAt: null, rows: [] } }));
  await expect(page.getByRole('alert')).toContainText('불러오지 못했어요');
  await expect(page.getByRole('link', { name: 'PNG 저장' })).toHaveCount(0);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('status').filter({ hasText: '아직 저장된' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'PNG 저장' })).toHaveCount(0);
});
